import type { ReactNode, Ref } from 'react'
import type { PressableProps, StyleProp, View, ViewStyle } from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'

import { StyleSheet } from 'react-native'
import Animated from 'react-native-reanimated'

import type {
  ButtonLinkForm,
  ButtonPressForm,
  ButtonToggleForm,
} from '../../button'
import type { PaletteName } from '../../button/palettes'
import type { IconStyle } from '../../glyphs/icon-style'

import {
  AnimatedPressable,
  buttonStyles,
  HEIGHTS,
  OUTLINE_WIDTHS,
  PRESSED_CORNERS,
  toggleState,
  useButtonAction,
  useCorner,
} from '../../button'
import { palettesOf } from '../../button/palettes'
import { IconStyleContext } from '../../glyphs/icon-style'
import { hitSlop, usePressFeedback } from '../../press'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// The icon buttons spec page's four styles at its five sizes, as kanso-ui's
// IconButton draws them: Button's chrome around a single icon. The pairs are
// the page's: filled on primary, tonal on secondary container, outlined with
// an outline-variant rule and an on-surface-variant icon, and standard,
// transparent, with the same icon over whatever it sits on. Disabled is
// Button's, on-surface at the two disabled opacities, and a standard button
// takes the text button's colour since neither has a container.
//
// The sizes are the page's XS to XL at Button's five heights, so the two line
// up in a row: a square of 32, 40, 56, 96 or 136dp holding an icon of 20, 24,
// 24, 32 or 40dp. The two middle sizes share one icon, and the container
// alone grows between them. The two smallest take presses over a 48dp target
// through `hitSlop`, which is the page's floor for them.
//
// **A toggle is the same button reporting a state.** Given `isSelected`,
// `defaultSelected` or `onChange` it takes the page's second pair of colour
// roles for its variant: a filled toggle rests on surface container with an
// on-surface-variant icon and takes primary once selected, a tonal one moves
// from the secondary container pair to secondary, a standard one stays
// transparent while its icon moves to primary, and an outlined one swaps its
// rule for the inverse surface pair. So a selected filled toggle looks like a
// plain filled button, and an unselected one does not.
//
// **The corner morphs from a circle to a rounded square.** A press tightens
// it to the size's pressed corner, 8dp for the two small sizes, 12dp at
// `lg` and 16dp at the two large, and a selected toggle rests there, which is
// the page's round-to-square morph. It eases as Button's does.
//
// The forms, the toggle's state, what a press does and the corner's ease are
// src/button's, shared with Button.

type IconButtonProps = (ButtonLinkForm | ButtonPressForm | ButtonToggleForm) &
  Omit<PressableProps, 'aria-label' | 'children' | 'disabled' | 'style'> & {
    /**
     * What the button does, in words. Required rather than optional: an icon
     * on its own has no accessible name, so without this the control
     * announces nothing at all.
     */
    readonly 'aria-label': string
    /**
     * The icon. The button hands it its colour and the page's icon size for
     * the button's size through `useIconStyle()`.
     */
    readonly children?: ReactNode
    /**
     * Draws no press ripple. The state layer is unaffected.
     * @default false
     */
    readonly disableRipple?: boolean
    /**
     * Draws the button disabled, and takes no presses.
     * @default false
     */
    readonly isDisabled?: boolean
    readonly ref?: Ref<View>
    /**
     * Control size: `xs` 32dp, `md` 40dp, `lg` 56dp, `xl` 96dp, `xxl` 136dp,
     * the icon buttons spec page's XS to XL, and the same heights `Button`
     * uses, so the two line up beside each other in a row. The icon is 20dp,
     * 24dp, 24dp, 32dp and 40dp in turn.
     * @default 'md'
     */
    readonly size?: IconButtonSize
    readonly style?: StyleProp<ViewStyle>
    /**
     * `standard` is transparent and tints what it sits on; `outlined` is
     * transparent with a rule around it; `filled` and `tonal` carry a
     * container of their own.
     * @default 'standard'
     */
    readonly variant?: IconButtonVariant
  }

type IconButtonSize = 'lg' | 'md' | 'xl' | 'xs' | 'xxl'

type IconButtonVariant = 'filled' | 'outlined' | 'standard' | 'tonal'

// The disabled container each variant draws. Filled and tonal share the
// page's one disabled container, and standard draws the text button's
// colour, which is the icon alone.
const DISABLED: Readonly<Record<IconButtonVariant, PaletteName>> = {
  filled: 'filledDisabled',
  outlined: 'outlinedDisabled',
  standard: 'textDisabled',
  tonal: 'filledDisabled',
}

// The icon each size holds, from the page's size token sets. Literals, as on
// web: they are icon sizes, which the theme has no scale for.
const ICON_SIZES: Readonly<Record<IconButtonSize, number>> = {
  lg: 24,
  md: 24,
  xl: 32,
  xs: 20,
  xxl: 40,
}

// Which container a toggle draws, selected and not. An unselected outlined,
// standard or tonal toggle is the plain button of that variant.
const TOGGLE_PALETTES: Readonly<
  Record<
    IconButtonVariant,
    Readonly<Record<'selected' | 'unselected', PaletteName>>
  >
> = {
  filled: { selected: 'filledToggleSelected', unselected: 'filledToggle' },
  outlined: { selected: 'outlinedToggleSelected', unselected: 'outlined' },
  standard: { selected: 'standardToggleSelected', unselected: 'standard' },
  tonal: { selected: 'tonalToggleSelected', unselected: 'tonal' },
}

const styles = StyleSheet.create({
  // The icon sits in the middle of a square that a row never squeezes.
  base: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
  },
})

// The outlined rule's width at each size, Button's.
const outlineWidths = StyleSheet.create({
  lg: { borderWidth: OUTLINE_WIDTHS.lg },
  md: { borderWidth: OUTLINE_WIDTHS.md },
  xl: { borderWidth: OUTLINE_WIDTHS.xl },
  xs: { borderWidth: OUTLINE_WIDTHS.xs },
  xxl: { borderWidth: OUTLINE_WIDTHS.xxl },
})

// Square, so one control height sets both edges.
const sizesOf = themedStyles(({ sizing }) => {
  function square(size: IconButtonSize): ViewStyle {
    const edge = sizing[HEIGHTS[size]]

    return { height: edge, width: edge }
  }

  return StyleSheet.create({
    lg: square('lg'),
    md: square('md'),
    xl: square('xl'),
    xs: square('xs'),
    xxl: square('xxl'),
  })
})

/**
 * A button that is an icon, at five control heights, with web's props and
 * values. Given `href` it is a link with the same appearance, and given
 * `isSelected`, `defaultSelected` or `onChange` it is a toggle, which reports
 * its state to a screen reader and draws the page's second pair of colour
 * roles for its variant. The three forms are exclusive, so a toggle given
 * `href` does not compile.
 *
 * ```tsx
 * <IconButton aria-label="Label" defaultSelected variant="tonal">
 *   <Icon />
 * </IconButton>
 * ```
 *
 * The two sizes under 48dp, `xs` and `md`, take presses over a 48dp target
 * through `hitSlop`, which a `hitSlop` of the call site's own replaces.
 * `style`, `ref` and `testID` land on the `Pressable`.
 */
function IconButton({
  children,
  defaultSelected,
  disableRipple = false,
  hitSlop: ownHitSlop,
  href,
  isDisabled = false,
  isSelected,
  onBlur,
  onChange,
  onFocus,
  onHoverIn,
  onHoverOut,
  onLayout,
  onPress,
  onPressIn,
  onPressOut,
  size = 'md',
  slot,
  style,
  type,
  variant = 'standard',
  ...props
}: IconButtonProps) {
  const theme = useTheme()

  // The three props that make this a toggle, read as web reads them.
  const isToggle =
    defaultSelected !== undefined ||
    isSelected !== undefined ||
    onChange !== undefined
  const action = useButtonAction({
    defaultSelected,
    href,
    isSelected,
    isToggle,
    onChange,
    onPress,
    slot: slot ?? 'default',
    type,
  })
  const colors =
    palettesOf(theme)[
      isDisabled
        ? DISABLED[variant]
        : isToggle
          ? TOGGLE_PALETTES[variant][
              action.selected ? 'selected' : 'unselected'
            ]
          : variant
    ]

  const feedback = usePressFeedback({
    color: colors.content,
    disabled: isDisabled,
    disableRipple,
    onBlur,
    onFocus,
    onHoverIn,
    onHoverOut,
    onPressIn,
    onPressOut,
  })

  const { radii, sizing } = theme
  const edge = sizing[HEIGHTS[size]]
  const shaped = useCorner(
    feedback.pressed || action.selected
      ? radii[PRESSED_CORNERS[size]]
      : radii.pill,
    onLayout,
  )

  return (
    <AnimatedPressable
      role={href === undefined ? 'button' : 'link'}
      {...(isToggle ? toggleState(action.selected) : undefined)}
      {...props}
      {...feedback.handlers}
      disabled={isDisabled}
      hitSlop={ownHitSlop ?? hitSlop(edge, edge)}
      onLayout={shaped.onLayout}
      onPress={action.onPress}
      style={composeStyles<AnimatedStyle<ViewStyle>>(
        styles.base,
        sizesOf(theme)[size],
        variant === 'outlined' ? outlineWidths[size] : undefined,
        colors.container,
        shaped.corner,
        feedback.ring,
        style,
      )}
    >
      <Animated.View
        style={composeStyles<AnimatedStyle<ViewStyle>>(
          buttonStyles.clip,
          shaped.corner,
        )}
      >
        {feedback.layer}
      </Animated.View>
      <IconStyleContext value={iconStyleOf(colors.content, size)}>
        {children}
      </IconStyleContext>
    </AnimatedPressable>
  )
}

function iconStyleOf(color: string, size: IconButtonSize): IconStyle {
  return { color, size: ICON_SIZES[size] }
}

export { IconButton }
export type { IconButtonProps, IconButtonSize, IconButtonVariant }
