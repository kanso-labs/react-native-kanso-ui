import type { ComponentRef, ReactNode, Ref } from 'react'
import type {
  LayoutChangeEvent,
  StyleProp,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle, SharedValue } from 'react-native-reanimated'
import type { Edge } from 'react-native-safe-area-context'

import { useMemo } from 'react'
import { I18nManager, ScrollView, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { NavigationItemProps } from '../../navigation'
import type { ResolvedTheme } from '../../theme/scope'

import { NavigationContext, NavigationItem } from '../../navigation'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// kanso-ui's NavigationRail, the navigation rail page's rail, in both its
// forms: collapsed, a 96dp column of vertical destinations down the leading
// edge, and expanded, between 220dp and 360dp with each destination the
// page's 56dp horizontal pill. Both are on the surface role, with their
// contents 44dp from the top: the first destination, or a header when the
// rail has one, such as a menu button that expands it, with the first
// destination 40dp under it. The destinations are src/navigation's, shared
// with NavigationBar, which holds their values.
//
// **The rail widens and narrows** when `isExpanded` changes: its surface
// moves from one form's width to the other's over `durationLong2` on the
// emphasized curve, as the active indicator moves, while the destinations
// take their new form at once and the surface reveals or covers them. Web
// changes width at once. Under reduced motion it does here too. The width it
// moves to is the one the new form lays out at, measured, so an expanded
// rail is as wide as its longest label asks within the page's bounds.
//
// The rail paints its surface under the status bar, the home indicator and a
// landscape notch on its leading side, and keeps its header and destinations
// inside the safe area: a `SafeAreaView` pads it by the top, the bottom and
// the leading inset, the left one or under right-to-left the right, wherever
// the rail meets them. Its trailing side faces the screen's content, so it
// takes no inset there.
//
// The destinations scroll in a block of their own under the header, so a
// rail shorter than they are scrolls them rather than squashing each below
// its height, and the header stays where it is. What they scroll in is at
// least as tall as that block, as web's list is, so a destination wrapped in
// a view with `marginTop: 'auto'` sits at the rail's foot, below the rest,
// while a rail they do not fit in still scrolls them. The block is a
// `tablist` and each destination a `tab`, which is how both platforms
// announce a set of top-level destinations; the header is outside it, since
// what it holds is not one of them. Web's rail is a landmark of links, which
// native has no counterpart for. A destination still goes to its `href`
// through the app's router, see `RouterProvider`.

type NavigationRailItemProps = NavigationItemProps

type NavigationRailProps = Omit<ViewProps, 'children' | 'style'> & {
  /** The destinations: `NavigationRail.Item`s. */
  readonly children?: ReactNode
  /**
   * What the rail draws above its destinations: a menu button that expands
   * it, or a floating action button.
   */
  readonly header?: ReactNode
  /**
   * Whether the rail is in its expanded form, each destination a pill with
   * its label beside the icon, rather than collapsed with the label under it.
   * @default false
   */
  readonly isExpanded?: boolean
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * The route of the current destination, matched against each
   * destination's `href`. The match is selected and draws the active
   * indicator.
   */
  readonly selectedRoute?: string
  readonly style?: StyleProp<ViewStyle>
}

type Timing = {
  readonly duration: number
  readonly easing: ReturnType<typeof Easing.bezier>
}

// The collapsed rail's width, and the expanded rail's bounds.
const COLLAPSED_WIDTH = 96
const EXPANDED_MIN_WIDTH = 220
const EXPANDED_MAX_WIDTH = 360

// The page's 44dp above the contents, header or not, and the 20dp either
// side of the expanded rail's pills, which fall between two steps of the
// spacing scale and so are written out.
const TOP_PADDING = 44
const EXPANDED_PADDING = 20

// How far a destination's focus ring reaches past it: the 2dp offset and the
// 2dp ring. A scroll view clips what overflows it, so the block the
// destinations scroll in is padded by this much and pulled back out by as
// much, which leaves every destination where it was and every ring whole.
const RING_REACH = 4

const styles = StyleSheet.create({
  // The form being drawn, as wide as it lays out, whatever the surface
  // around it is moving through.
  content: {
    flexShrink: 0,
  },
  // The destinations' block, which takes the height the header leaves and
  // scrolls what does not fit in it.
  destinations: {
    alignSelf: 'stretch',
    flexBasis: 'auto',
    flexGrow: 1,
    flexShrink: 1,
    margin: -RING_REACH,
  },
  // The safe area and the form inside it take the rail's height and no more,
  // shrinking below what their destinations ask, since a view keeps its
  // content's height by default and the block would then never scroll.
  inset: {
    flexGrow: 1,
    flexShrink: 1,
  },
})

const stylesOf = themedStyles(({ colors, spacing }) =>
  StyleSheet.create({
    // The collapsed rail, its destinations centred in it.
    collapsed: {
      alignItems: 'center',
      flexGrow: 1,
      flexShrink: 1,
      paddingBottom: spacing.xl,
      paddingTop: TOP_PADDING,
      width: COLLAPSED_WIDTH,
    },
    // The collapsed rail's destinations, 4dp apart, in a list at least as
    // tall as the block it scrolls in, which leaves an automatic margin the
    // height they do not take.
    collapsedList: {
      alignItems: 'center',
      flexGrow: 1,
      gap: spacing.xs,
      padding: RING_REACH,
    },
    // The expanded rail: as wide as its pills ask, within the page's bounds,
    // 20dp either side of them.
    expanded: {
      flexGrow: 1,
      flexShrink: 1,
      maxWidth: EXPANDED_MAX_WIDTH,
      minWidth: EXPANDED_MIN_WIDTH,
      paddingBottom: spacing.xl,
      paddingHorizontal: EXPANDED_PADDING,
      paddingTop: TOP_PADDING,
    },
    // The expanded rail's pills, at its leading edge with no gap between,
    // in a list as tall as the collapsed rail's.
    expandedList: {
      alignItems: 'flex-start',
      flexGrow: 1,
      padding: RING_REACH,
    },
    // What the rail draws above its destinations, the page's 40dp clear of
    // the first: the collapsed rail's 4dp gap, and the rest of its own here.
    header: {
      alignItems: 'center',
      marginBottom: spacing.xxxl - spacing.xs,
    },
    // The expanded rail has no gap between destinations, so its header keeps
    // the whole 40dp. It starts at the leading edge where the pills do, 8dp
    // in from there: a 40dp icon button centres its 24dp icon, and 8dp puts
    // that icon over the pills' icons, 16dp into each pill.
    headerExpanded: {
      alignItems: 'flex-start',
      alignSelf: 'stretch',
      marginBottom: spacing.xxxl,
      paddingStart: spacing.sm,
    },
    // The rail's surface. It keeps its width whatever sits beside it, and
    // holds the form being drawn at its leading edge, clipping it while the
    // surface is narrower.
    rail: {
      backgroundColor: colors.surface,
      flexDirection: 'row',
      flexShrink: 0,
      overflow: 'hidden',
    },
  }),
)

// The edges the rail meets: the top, the bottom and its leading side, which
// is the right one under right-to-left.
function edgesOf(): readonly Edge[] {
  return ['bottom', I18nManager.isRTL ? 'right' : 'left', 'top']
}

/**
 * The column of top-level destinations a medium or wider window keeps at its
 * leading edge, collapsed or, with `isExpanded`, expanded. Each destination
 * goes to its `href` through the app's router, see `RouterProvider`.
 *
 * ```tsx
 * <NavigationRail selectedRoute="/first">
 *   <NavigationRail.Item href="/first" icon={<FirstIcon />}>
 *     First item
 *   </NavigationRail.Item>
 *   <NavigationRail.Item href="/second" icon={<SecondIcon />}>
 *     Second item
 *   </NavigationRail.Item>
 * </NavigationRail>
 * ```
 *
 * Draw it at the leading edge of a row holding the screen's content, which
 * gives it its height: it paints its surface to the screen's edges and keeps
 * its destinations clear of the status bar, the home indicator and a notch
 * itself.
 *
 * A destination wrapped in a view with `marginTop: 'auto'` sits at the
 * rail's foot, below the rest. Give the view `alignSelf: 'stretch'` as well,
 * so a collapsed destination in it is as wide as the others.
 *
 * `aria-label` names the destinations' tab list. `style`, `ref` and `testID`
 * land on the rail's own view, its surface.
 */
function NavigationRail({
  'aria-label': ariaLabel,
  children,
  header,
  isExpanded = false,
  selectedRoute,
  style,
  ...props
}: NavigationRailProps) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const reduceMotion = useReducedMotion()
  // The surface's width, unset until the form being drawn is first measured,
  // which leaves the surface as wide as that form.
  const width = useSharedValue<number | undefined>(undefined)
  const context = useMemo(
    () => ({
      form: isExpanded ? ('expanded' as const) : ('collapsed' as const),
      measuring: false,
      selectedRoute,
    }),
    [isExpanded, selectedRoute],
  )
  const widthStyle = useAnimatedStyle(() => {
    'worklet'
    const current = width.get()

    return current === undefined ? {} : { width: current }
  })

  return (
    <Animated.View
      {...props}
      style={composeStyles<AnimatedStyle<ViewStyle>>(
        own.rail,
        widthStyle,
        style,
      )}
    >
      <View
        onLayout={widthThen(width, reduceMotion, timingOf(theme))}
        style={styles.content}
      >
        <SafeAreaView edges={edgesOf()} style={styles.inset}>
          <View style={isExpanded ? own.expanded : own.collapsed}>
            {header === undefined ? null : (
              <View
                style={composeStyles<ViewStyle>(
                  own.header,
                  isExpanded ? own.headerExpanded : undefined,
                )}
              >
                {header}
              </View>
            )}
            <ScrollView
              aria-label={ariaLabel}
              contentContainerStyle={
                isExpanded ? own.expandedList : own.collapsedList
              }
              role="tablist"
              style={styles.destinations}
            >
              <NavigationContext value={context}>{children}</NavigationContext>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Animated.View>
  )
}

/**
 * One destination of a navigation rail: an icon, a label and, while it is
 * the current one, the active indicator. Pressing it calls `onPress`, then
 * goes to its `href`. Renders nothing of its own outside a `NavigationRail`,
 * whose `selectedRoute` says whether it is selected.
 *
 * `style`, `ref` and `testID` land on the destination's `Pressable`.
 */
function NavigationRailItem(props: NavigationRailItemProps) {
  return <NavigationItem {...props} />
}

// The rail's change of width, on the active indicator's duration and curve.
function timingOf({ motion }: ResolvedTheme): Timing {
  return {
    duration: motion.durationLong2,
    easing: Easing.bezier(...motion.easingEmphasized),
  }
}

// Moves the surface to the width the form being drawn lays out at: at once
// the first time, and under reduced motion, and over the rail's timing
// after that. Built by a call rather than written inline at the prop, which
// is what react-perf's jsx-no-new-function-as-prop is after.
function widthThen(
  width: SharedValue<number | undefined>,
  reduceMotion: boolean,
  timing: Timing,
) {
  return (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width

    width.set(
      width.get() === undefined || reduceMotion
        ? next
        : withTiming(next, timing),
    )
  }
}

NavigationRail.Item = NavigationRailItem

export type { NavigationRailItemProps, NavigationRailProps }

export { NavigationRail, NavigationRailItem }
