import type { ComponentRef, ReactNode, Ref } from 'react'
import type { ColorValue, ViewProps, ViewStyle } from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { Edge } from 'react-native-safe-area-context'

import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { IconStyle } from '../../glyphs/icon-style'
import type { TypeRole } from '../../typography/roles'

import { IconStyleContext } from '../../glyphs/icon-style'
import { COLLAPSED_BLOCK_SIZE } from '../../hooks/useAppBarScroll'
import { TARGET_SIZE } from '../../press'
import { hasContent } from '../../row'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { Text } from '../text'

// kanso-ui's AppBar, Material Design's top app bar in the three sizes the spec
// recommends. `md` and `lg` are its medium and large *flexible* bars, the
// newer of the two sets the spec gives and the one it recommends. The old
// center-aligned variant is a configuration of every size, which is why
// alignment is a prop.
//
// Heights are minimums rather than fixed. The flexible bars hug their text,
// so a headline that wraps, or a larger text size the device asks for, makes
// the bar taller rather than being cut off.
//
// The bar paints its surface from the screen's top edge, under the status
// bar, and keeps its contents inside the safe area: a `SafeAreaView` pads it
// by the status bar, the notch and a rounded corner wherever the bar meets
// them, and by nothing where it does not, so a bar drawn below another view
// takes no inset of its own.
//
// Three things differ from web's, each because of the platform.
//
// - **No heading level.** Native screen readers have no levels to move
//   between, so the headline is a header and `headingLevel` is gone.
// - **`pinned` means outside the scroll view.** Native has no sticky
//   position, so a pinned bar is one the screen draws above its scroll view
//   rather than inside it, and the content scrolls beneath its lower edge.
// - **The fill eases and the height does not.** Collapsing moves the height
//   and the headline's type role at once. React Native has no transition for
//   a type role, and easing the height alone would leave the text jumping
//   inside a moving bar. The fill a scrolled bar takes eases over medium 1
//   on the emphasized curve, as web's does, and arrives at once under
//   reduced motion.

// The geometry Material Design lays a bar's icon buttons out on: a 48dp
// target per button, edge to edge, with a 24dp icon centred in each, and the
// outermost target 4dp in from the bar's edge, so a glyph lands at the
// page's margin. IconButton draws a 40dp box with its 48dp target spilling
// out through `hitSlop`, so a slot pads half the difference either side and
// puts the whole of it between two buttons, which lays the targets edge to
// edge as the spec does.
const ICON_SIZE = 24

// How far an icon sits inside its target, which is how much less than the
// content inset the row is padded on an edge that holds a slot. That puts a
// leading glyph, rather than the edge of its target, at the inset.
const GLYPH_INSET = (TARGET_SIZE - ICON_SIZE) / 2

const HEIGHTS = {
  lg: { plain: 120, withSubtitle: 152 },
  md: { plain: 112, withSubtitle: 136 },
  sm: { plain: COLLAPSED_BLOCK_SIZE, withSubtitle: COLLAPSED_BLOCK_SIZE },
} as const

// One type role per size, as Material Design's own title tokens alias the
// type scale rather than giving sizes of their own. A collapsed bar takes the
// small one's.
const HEADLINE_ROLES: Readonly<Record<AppBarSize, TypeRole>> = {
  lg: 'headlineMedium',
  md: 'headlineSmall',
  sm: 'titleLarge',
}

// The bar's sides as well as its top, so a landscape notch is cleared too.
// The bottom is the content's.
const EDGES: readonly Edge[] = ['left', 'right', 'top']

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  // Drawn over what follows it, so whatever strays past the scroll view's
  // top edge, an overscroll or a shadow, passes beneath the bar.
  pinned: {
    zIndex: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  // The row, centred once it reaches `contentMaxInlineSize`.
  safeArea: {
    alignItems: 'center',
  },
})

const stylesOf = themedStyles(({ sizing, spacing }) =>
  StyleSheet.create({
    row: {
      gap: spacing.xs,
    },
    // Slots hold their own size rather than being squeezed by a long
    // headline, and space their icon buttons by the spec's targets.
    slot: {
      alignItems: 'center',
      flexDirection: 'row',
      flexShrink: 0,
      gap: TARGET_SIZE - sizing.controlSm,
      paddingHorizontal: (TARGET_SIZE - sizing.controlSm) / 2,
    },
    // The text takes the room the slots leave, and wraps inside it.
    text: {
      flexGrow: 1,
      flexShrink: 1,
      justifyContent: 'center',
      minWidth: 0,
      paddingVertical: spacing.sm,
    },
  }),
)

type AppBarProps = Omit<ViewProps, 'children'> & {
  /**
   * Which of Material Design's alignments the text takes. `center` is the
   * configuration that replaced the old center-aligned variant.
   * @default 'start'
   */
  readonly align?: 'center' | 'start'
  /**
   * Collapses a flexible bar to the height and headline of the small one,
   * for a `pinned` bar over content that has been scrolled. Without it a
   * pinned `lg` keeps 152dp of the screen for as long as the screen is open.
   *
   * Controlled, as `scrolled` is: only the app knows which view scrolls and
   * how far into it the bar should have collapsed. `useAppBarScroll` derives
   * both from that view's scroll, and is the way to set them unless the app
   * needs a rule of its own. Ignored on `sm`, which is already the height
   * this collapses to, and the subtitle goes with the height.
   * @default false
   */
  readonly collapsed?: boolean
  /**
   * Where the bar's content starts on each edge, in dp: the headline where
   * nothing comes before it, and the leading icon's glyph where something
   * does. The trailing edge is the same mirrored. `0` draws a bar flush.
   *
   * The default is Material Design's margin for a top app bar, the spacing
   * scale's `lg` step, which is also the margin it gives body content, so a
   * bar and the screen beneath line up without either being told about the
   * other.
   * @default spacing.lg
   */
  readonly contentInset?: number
  /**
   * How wide the bar's contents may run, in dp, before they stop growing,
   * with the row centred in what is left. The bar's surface still paints
   * edge to edge. Unset, the row is as wide as the bar.
   */
  readonly contentMaxInlineSize?: number
  /**
   * The screen's title, a header for a screen reader. Wraps rather than
   * truncating, and grows the bar with it.
   */
  readonly headline?: ReactNode
  /**
   * Usually a back or menu icon button. Sits before the text, and hands an
   * icon the on-surface colour and a 24dp size through `useIconStyle()`.
   */
  readonly leading?: ReactNode
  /**
   * Marks a bar drawn above the screen's scroll view rather than inside it,
   * so it stays put while the content scrolls beneath its lower edge, and is
   * drawn over that content. A pinned bar is the one `collapsed` and
   * `scrolled` are for.
   * @default false
   */
  readonly pinned?: boolean
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * Whether the content beneath has been scrolled. Material Design separates
   * a bar from scrolled content with a fill colour rather than a shadow, the
   * surface container role, and this is what applies it.
   *
   * Controlled, with no listener of its own: only the app knows which view
   * scrolls. `useAppBarScroll` derives it.
   * @default false
   */
  readonly scrolled?: boolean
  /**
   * `sm` is Material Design's small bar, 64dp; `md` and `lg` are its medium
   * and large flexible bars, 112dp and 120dp, or 136dp and 152dp with a
   * subtitle, which hug their text. The headline is title large, headline
   * small and headline medium in turn.
   * @default 'sm'
   */
  readonly size?: AppBarSize
  /** A second line under the headline. Makes `md` and `lg` taller. */
  readonly subtitle?: ReactNode
  /**
   * Actions, at the far end, usually icon buttons. An icon here takes the
   * on-surface-variant colour and a 24dp size through `useIconStyle()`.
   */
  readonly trailing?: ReactNode
}

type AppBarSize = 'lg' | 'md' | 'sm'

type SlotProps = {
  readonly children: ReactNode
  readonly color: ColorValue
}

/**
 * Material Design's top app bar: the bar at the top of a screen carrying its
 * title, one or two actions, and the way back out.
 *
 * ```tsx
 * <AppBar
 *   headline="Headline"
 *   leading={<IconButton aria-label="Back"><ArrowBackGlyph /></IconButton>}
 * />
 * ```
 *
 * Three sizes. `sm` is a 64dp bar for a screen whose title is a label; `md`
 * and `lg` are the flexible bars, which give the headline a larger type role
 * and grow to fit a subtitle or a headline that wraps.
 *
 * It paints its own surface, from the screen's top edge, and keeps its
 * contents clear of the status bar and the notch. Separating itself from the
 * content beneath is its job, which is why `scrolled` and `collapsed` exist;
 * `useAppBarScroll` sets both from the screen's scroll view.
 */
function AppBar({
  align = 'start',
  collapsed = false,
  contentInset,
  contentMaxInlineSize,
  headline,
  leading,
  pinned = false,
  scrolled = false,
  size = 'sm',
  style,
  subtitle,
  trailing,
  ...props
}: AppBarProps) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const inset = contentInset ?? theme.spacing.lg
  // `sm` is already what the flexible bars collapse to, so collapsing it is
  // a no-op rather than an error, for a size chosen by the window.
  const collapse = collapsed && size !== 'sm'
  const hasLeading = hasContent(leading)
  const hasTrailing = hasContent(trailing)
  const showsSubtitle = hasContent(subtitle) && !collapse
  const heights = HEIGHTS[collapse ? 'sm' : size]
  const fill = useFill(scrolled)

  return (
    <Animated.View
      {...props}
      style={composeStyles<AnimatedStyle<ViewStyle>>(
        fill,
        pinned ? styles.pinned : null,
        style,
      )}
    >
      <SafeAreaView edges={EDGES} style={styles.safeArea}>
        <View
          style={composeStyles<ViewStyle>(styles.row, own.row, {
            maxWidth: contentMaxInlineSize,
            minHeight: showsSubtitle ? heights.withSubtitle : heights.plain,
            paddingEnd: edgePadding(inset, hasTrailing),
            paddingStart: edgePadding(inset, hasLeading),
          })}
        >
          {hasLeading ? (
            <Slot color={theme.colors.onSurface}>{leading}</Slot>
          ) : null}
          <View style={own.text}>
            {hasContent(headline) ? (
              <Text
                role="heading"
                style={align === 'center' ? styles.center : undefined}
                variant={HEADLINE_ROLES[collapse ? 'sm' : size]}
              >
                {headline}
              </Text>
            ) : null}
            {showsSubtitle ? (
              <Text
                style={align === 'center' ? styles.center : undefined}
                tone="muted"
                variant="bodyMedium"
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
          {hasTrailing ? (
            <Slot color={theme.colors.onSurfaceVariant}>{trailing}</Slot>
          ) : null}
        </View>
      </SafeAreaView>
    </Animated.View>
  )
}

// The row's padding on one edge, for the inset the call site gave. Where the
// edge holds a slot the row stops short of the inset by GLYPH_INSET, clamped
// at zero for an inset smaller than a glyph's own room.
function edgePadding(inset: number, hasSlot: boolean): number {
  return hasSlot ? Math.max(0, inset - GLYPH_INSET) : inset
}

// Built by a call rather than written inline at the prop, which is what
// react-perf's jsx-no-new-object-as-prop is after; the React Compiler
// memoises the result on its inputs.
function iconStyleOf(color: ColorValue): IconStyle {
  return { color, size: ICON_SIZE }
}

// A slot's icons draw at 24dp in the slot's colour. An icon button inside it
// hands its own icon the button's colour instead.
function Slot({ children, color }: SlotProps) {
  const own = stylesOf(useTheme())

  return (
    <IconStyleContext value={iconStyleOf(color)}>
      <View style={own.slot}>{children}</View>
    </IconStyleContext>
  )
}

// The bar's surface, which takes the surface container role once the
// content beneath has scrolled. It eases over medium 1 on the emphasized
// curve, and arrives at once under reduced motion.
function useFill(scrolled: boolean) {
  const { colors, motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const fill = scrolled ? colors.surfaceContainer : colors.surface
  const timing = {
    duration: motion.durationMedium1,
    easing: Easing.bezier(...motion.easingEmphasized),
  }

  return useAnimatedStyle(() => {
    'worklet'
    return {
      backgroundColor: reduceMotion ? fill : withTiming(fill, timing),
    }
  })
}

export { AppBar }
export type { AppBarProps }
