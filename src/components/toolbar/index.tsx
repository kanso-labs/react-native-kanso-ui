import type { ComponentRef, ReactNode, Ref } from 'react'
import type { ColorValue, StyleProp, ViewProps, ViewStyle } from 'react-native'

import { Platform, StyleSheet, View } from 'react-native'

import type { IconStyle } from '../../glyphs/icon-style'

import { IconStyleContext } from '../../glyphs/icon-style'
import { SeparatorOrientationContext } from '../../separator'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// kanso-ui's Toolbar: the toolbars page's container, a row of frequently used
// controls on a surface of its own. The page calls it "a container with
// configurable slots", so nothing here says what goes in one: an icon
// button, a button, a field or a rule are all the call site's to place.
//
// The measurements are the page's, stated there in words: 64dp across the
// bar, its contents centred, 8dp between items and 16dp of padding at the two
// ends. The two colour schemes are its own too, standard on surface container
// and vibrant on primary container, each with its content role on what the
// bar holds: on-surface variant, and on-primary container. `tone` spells the
// standard one `neutral`, the word every `tone` in the library uses for its
// neutral role. That role reaches a bare icon placed in the bar through
// `useIconStyle()`, while a control keeps its own colours.
//
// **A rule inside it runs across the bar, not along it.** The bar tells a
// `Separator` among its controls to run the other way, so a rule between two
// controls is correct without the call site saying which way it runs. A modal
// window opened from the bar clears that, and an overlay never sees it, so a
// rule in a dialog, sheet or popover draws as it does anywhere else.
//
// It is announced as a toolbar, which tells a screen reader its controls
// belong together. Web's arrow keys between the controls are React Aria's and
// have no counterpart on a touch screen, so each control is reached as any
// other is.
//
// One departure, about the shape, and it is web's. The page gives the
// container's corner as a token its widget draws rather than writes, so there
// is no value to read. The fully rounded corner here, and the bar hugging its
// controls rather than spanning its parent, are the library's choice for a
// bar that floats over a screen; a docked one spans its container and squares
// its corner, both from the call site's `style`.

type ToolbarProps = Omit<ViewProps, 'children' | 'style'> & {
  /** The controls, and any rule between them. */
  readonly children?: ReactNode
  /**
   * Which way the bar runs. A `Separator` among its controls runs across it.
   * @default 'horizontal'
   */
  readonly orientation?: 'horizontal' | 'vertical'
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
  /**
   * Which of the page's two colour schemes the bar takes. `neutral` is the
   * page's standard scheme, the surface container it draws by default;
   * `vibrant` moves it to primary container, for a bar meant to carry the
   * screen's accent.
   * @default 'neutral'
   */
  readonly tone?: ToolbarTone
}

type ToolbarTone = 'neutral' | 'vibrant'

// The icon a bare glyph in the bar draws at, the 24dp grid Material Symbols
// are drawn on.
const ICON_SIZE = 24

// React Native Web writes `aria-orientation` onto the element, which React
// Native's types do not name. A horizontal bar needs none, since that is the
// toolbar role's own default.
const VERTICAL = { 'aria-orientation': 'vertical' } as const

const stylesOf = themedStyles(({ colors, radii, spacing }) =>
  StyleSheet.create({
    base: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: radii.pill,
      gap: spacing.sm,
      justifyContent: 'center',
    },
    // The page's 64dp across the bar, and its 16dp of padding at the two
    // ends. A minimum rather than a fixed size, since a field or a button
    // taller than 64dp should make the bar taller rather than overflow it.
    //
    // The cross axis takes the 8dp the page puts between items rather than
    // nothing. A `Separator` takes its length from the bar, so with no
    // padding there a rule would run the full 64dp and cut the container in
    // two instead of dividing what is inside it.
    horizontal: {
      flexDirection: 'row',
      minHeight: 64,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    neutral: {
      backgroundColor: colors.surfaceContainer,
    },
    vertical: {
      flexDirection: 'column',
      minWidth: 64,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.lg,
    },
    vibrant: {
      backgroundColor: colors.primaryContainer,
    },
  }),
)

// Built by a call rather than written inline at the prop, which is what
// react-perf's jsx-no-new-object-as-prop is after; the React Compiler
// memoises the result on its inputs.
function iconStyleOf(color: ColorValue): IconStyle {
  return { color, size: ICON_SIZE }
}

/**
 * A container for a set of controls, announced as a toolbar so a screen
 * reader reads them as one group.
 *
 * ```tsx
 * <Toolbar aria-label="Label">
 *   <IconButton aria-label="First item">
 *     <FirstIcon />
 *   </IconButton>
 *   <Separator />
 *   <IconButton aria-label="Second item">
 *     <SecondIcon />
 *   </IconButton>
 * </Toolbar>
 * ```
 *
 * Name it with `aria-label` or `aria-labelledby`: nothing here labels it for
 * you, and a toolbar with no name is a group a screen reader cannot
 * announce.
 *
 * `orientation` decides which way the bar runs, and a `Separator` among its
 * controls draws across that direction without being told; one inside an
 * overlay opened from the bar draws as it would anywhere else. `style`,
 * `ref` and `testID` land on the bar, which is the element a layout
 * positions.
 */
function Toolbar({
  children,
  orientation = 'horizontal',
  style,
  tone = 'neutral',
  ...props
}: ToolbarProps) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const content =
    tone === 'vibrant'
      ? theme.colors.onPrimaryContainer
      : theme.colors.onSurfaceVariant

  return (
    <SeparatorOrientationContext
      value={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
    >
      <IconStyleContext value={iconStyleOf(content)}>
        <View
          role="toolbar"
          {...(Platform.OS === 'web' && orientation === 'vertical'
            ? VERTICAL
            : undefined)}
          {...props}
          style={composeStyles<ViewStyle>(
            own.base,
            own[orientation],
            own[tone],
            style,
          )}
        >
          {children}
        </View>
      </IconStyleContext>
    </SeparatorOrientationContext>
  )
}

export { Toolbar }
export type { ToolbarProps, ToolbarTone }
