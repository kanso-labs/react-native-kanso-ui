import type { ReactNode, Ref } from 'react'
import type {
  PressableProps,
  StyleProp,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'

import { Text as NativeText, StyleSheet } from 'react-native'
import Animated from 'react-native-reanimated'

import type {
  ButtonLinkForm,
  ButtonPressForm,
  ButtonToggleForm,
} from '../../button'
import type { PaletteName } from '../../button/palettes'
import type { IconStyle } from '../../glyphs/icon-style'
import type { ResolvedTheme } from '../../theme/scope'
import type { TypeRole } from '../../typography/roles'

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
import { useTypeRole } from '../../typography/roles'

// The buttons spec page's five colour styles, five sizes and two shapes, as
// kanso-ui's Button draws them. The variant carries colour and the size
// carries geometry, so the two never argue: the padding belongs to the size
// alone, and a text button is as wide as a filled one at the same size.
//
// The colour pairs are the page's: filled on primary, tonal on secondary
// container, outlined with an outline-variant rule and an on-surface-variant
// label, text on primary, and elevated on surface container low with a
// primary label. Elevated is the one variant whose shadow is part of it: it
// rests at elevation 1, rises to 2 under a pointer and settles back while
// pressed, where filled and tonal rest flat and lift to 1 under a pointer
// only. The shadow is the theme's `boxShadow` value, which React Native draws
// on iOS and Android as React Native Web draws it in a browser.
//
// The state layers, the ripple and the focus ring are src/press's, drawn in
// the label's colour over the container, as on web.
//
// **Disabled is the page's colour at an opacity, translucent.** A container
// is on-surface at the `disabledContainer` opacity, and the label on-surface
// at `disabledContent`, over whatever the button sits on rather than mixed
// over the surface role as web's are; src/button/palettes.ts gives the
// reason. Disabled drops the shadow, since a shadow says a control is there
// to press.
//
// **A toggle is the same button reporting a state.** Given `isSelected`,
// `defaultSelected` or `onChange` it takes the page's second pair of colour
// roles for its variant: a filled toggle rests on surface container with an
// on-surface-variant label and takes primary once selected, a tonal one moves
// from the secondary container pair to secondary, an elevated one keeps its
// low surface until it takes primary, and an outlined one swaps its rule for
// the inverse surface pair. The page gives text no pair, so a text button
// given those props stays a plain one.
//
// **The corner is a shape the button morphs between.** `round` rests as the
// pill and `square` at the size's square corner: 12dp up to the page's S,
// 16dp at M and 28dp above. A press tightens either to the size's pressed
// corner, 8dp, 12dp or 16dp, and a toggle trades its shape for the other
// once selected. The corner eases through Reanimated, as src/button's
// `useCorner` sets out.
//
// The forms, the toggle's state, what a press does and the corner's ease are
// src/button's, shared with IconButton.

type ButtonForm =
  | ButtonLinkForm
  | ButtonPressForm
  | (ButtonToggleForm & {
      /**
       * A toggle takes any variant but `text`, which the page gives no
       * selected colours.
       */
      readonly variant?: Exclude<ButtonVariant, 'text'>
    })

type ButtonProps = ButtonForm &
  Omit<PressableProps, 'children' | 'disabled' | 'style'> & {
    /** The label. */
    readonly children?: ReactNode
    /**
     * Draws no press ripple. The state layer is unaffected.
     * @default false
     */
    readonly disableRipple?: boolean
    /**
     * An icon before the label, at the page's icon size for the button's
     * size: 20dp at `xs` and `md`, 24dp at `lg`, 32dp at `xl` and 40dp at
     * `xxl`. The slot hands it the label's colour and that size through
     * `useIconStyle()`.
     */
    readonly icon?: ReactNode
    /**
     * Draws the button disabled, and takes no presses.
     * @default false
     */
    readonly isDisabled?: boolean
    readonly ref?: Ref<View>
    /**
     * The corner the button rests at: `round` is the pill, `square` the
     * page's rounded rectangle, 12dp up to `md`, 16dp at `lg` and 28dp above.
     * Either tightens while pressed, and a toggle trades one for the other
     * once selected.
     * @default 'round'
     */
    readonly shape?: ButtonShape
    /**
     * Control height: `xs` 32dp, `md` 40dp, `lg` 56dp, `xl` 96dp, `xxl` 136dp,
     * the buttons spec page's XS, S, M, L and XL, each with its own padding
     * and type role. `md` is the page's default. The height is a floor, so a
     * label that wraps, or that the device's text size enlarges, grows the
     * button rather than running out of it.
     * @default 'md'
     */
    readonly size?: ButtonSize
    readonly style?: StyleProp<ViewStyle>
    /**
     * How much weight the button pulls. `filled` and `tonal` carry a container
     * of their own; `outlined` and `text` sit on the page; `elevated` sits on
     * a low surface and lifts off it with a shadow, for a button that has to
     * separate from a busy background rather than from the page.
     * @default 'filled'
     */
    readonly variant?: ButtonVariant
  }

type ButtonShape = 'round' | 'square'

type ButtonSize = 'lg' | 'md' | 'xl' | 'xs' | 'xxl'

type ButtonVariant = 'elevated' | 'filled' | 'outlined' | 'text' | 'tonal'

type ToggleVariant = Exclude<ButtonVariant, 'text'>

// The disabled container each variant draws. Filled, tonal and elevated share
// one, which is the page's single disabled container for all three.
const DISABLED: Readonly<Record<ButtonVariant, PaletteName>> = {
  elevated: 'filledDisabled',
  filled: 'filledDisabled',
  outlined: 'outlinedDisabled',
  text: 'textDisabled',
  tonal: 'filledDisabled',
}

// The icon each size draws, from the page's size token sets. Literals, as on
// web: they are icon sizes, which the theme has no scale for.
const ICON_SIZES: Readonly<Record<ButtonSize, number>> = {
  lg: 24,
  md: 20,
  xl: 32,
  xs: 20,
  xxl: 40,
}

// The type role each size sets its label in, taken whole: label-large for the
// two small sizes, then title-medium, headline-small and headline-large.
const ROLES: Readonly<Record<ButtonSize, TypeRole>> = {
  lg: 'titleMedium',
  md: 'labelLarge',
  xl: 'headlineSmall',
  xs: 'labelLarge',
  xxl: 'headlineLarge',
}

// The square corner each size rests at, and a round toggle takes once
// selected.
const SQUARE_CORNERS = {
  lg: 'lg',
  md: 'md',
  xl: 'xl',
  xs: 'md',
  xxl: 'xl',
} as const satisfies Record<ButtonSize, keyof ResolvedTheme['radii']>

// Which container a toggle draws, selected and not.
const TOGGLE_PALETTES: Readonly<
  Record<
    ToggleVariant,
    Readonly<Record<'selected' | 'unselected', PaletteName>>
  >
> = {
  elevated: { selected: 'elevatedToggleSelected', unselected: 'elevated' },
  filled: { selected: 'filledToggleSelected', unselected: 'filledToggle' },
  outlined: { selected: 'outlinedToggleSelected', unselected: 'outlined' },
  tonal: { selected: 'tonalToggleSelected', unselected: 'tonal' },
}

const styles = StyleSheet.create({
  // The label sits in the middle of a button wider than it, one stretched by
  // a column or given a width, as the page draws every button, and a button
  // is never wider than what holds it.
  base: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  icon: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
  },
  // A label too long for the row wraps, its lines centred, and grows the
  // button with it.
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
})

// Each size's inline padding. The two largest are literals: 48 and 64 are not
// steps of the spacing scale, and the scale should not grow to fit one
// component. `xs` pads 12 a side, the extra-small token set's leading and
// trailing space.
function inlinePaddings({
  spacing,
}: ResolvedTheme): Readonly<Record<ButtonSize, number>> {
  return { lg: spacing.xl, md: spacing.lg, xl: 48, xs: spacing.md, xxl: 64 }
}

const shadowsOf = themedStyles(({ shadows }) =>
  StyleSheet.create({
    elevation1: { boxShadow: shadows.elevation1 },
    elevation2: { boxShadow: shadows.elevation2 },
  }),
)

// The five sizes, from the page's size token sets: the container height, the
// padding, and the gap before an icon. The height is a floor rather than a
// fixed size, and the block padding is what keeps a wrapped label off the
// pill's edge: a step short of a single line's own inset, so a label on one
// line still draws exactly the page's height.
const sizesOf = themedStyles((theme) => {
  const { sizing, spacing } = theme
  const inline = inlinePaddings(theme)

  return StyleSheet.create({
    lg: {
      gap: spacing.sm,
      minHeight: sizing.controlLg,
      paddingHorizontal: inline.lg,
      paddingVertical: spacing.md,
    },
    md: {
      gap: spacing.sm,
      minHeight: sizing.controlSm,
      paddingHorizontal: inline.md,
      paddingVertical: spacing.sm,
    },
    xl: {
      gap: spacing.md,
      minHeight: sizing.controlXl,
      paddingHorizontal: inline.xl,
      paddingVertical: spacing.xl,
    },
    xs: {
      gap: spacing.sm,
      minHeight: sizing.controlXs,
      paddingHorizontal: inline.xs,
      paddingVertical: spacing.xs,
    },
    xxl: {
      gap: spacing.lg,
      minHeight: sizing.controlXxl,
      paddingHorizontal: inline.xxl,
      paddingVertical: spacing.xxl,
    },
  })
})

// The outlined button draws its rule inside the width the other variants
// take, as the page's buttons do: the padding gives up what the rule takes,
// so an outlined and a filled button with one label are one width.
const outlinedSizesOf = themedStyles((theme) => {
  const inline = inlinePaddings(theme)

  function outlined(size: ButtonSize): ViewStyle {
    return {
      borderWidth: OUTLINE_WIDTHS[size],
      paddingHorizontal: inline[size] - OUTLINE_WIDTHS[size],
    }
  }

  return StyleSheet.create({
    lg: outlined('lg'),
    md: outlined('md'),
    xl: outlined('xl'),
    xs: outlined('xs'),
    xxl: outlined('xxl'),
  })
})

/**
 * The design's button, at five emphasis levels and five control heights,
 * round or square, with web's props and values. Given `href` it is a link with
 * the same appearance, and given `isSelected`, `defaultSelected` or
 * `onChange` it is a toggle, which reports its state to a screen reader and
 * draws the page's second pair of colour roles for its variant.
 *
 * ```tsx
 * <Button defaultSelected variant="tonal">
 *   Label
 * </Button>
 * ```
 *
 * A column stretches a button across it, as it does any view, and as a flex
 * column does a button on web; a column that should hold its buttons at their
 * labels' width says so with `alignItems`.
 *
 * The two sizes under 48dp tall, `xs` and `md`, take presses over a 48dp
 * target through `hitSlop`, which a `hitSlop` of the call site's own replaces.
 * `style`, `ref` and `testID` land on the `Pressable`.
 */
function Button({
  children,
  defaultSelected,
  disableRipple = false,
  hitSlop: ownHitSlop,
  href,
  icon,
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
  shape = 'round',
  size = 'md',
  slot,
  style,
  type,
  variant = 'filled',
  ...props
}: ButtonProps) {
  const theme = useTheme()
  const role = useTypeRole(ROLES[size])

  // The three props that make this a toggle, read as web reads them. The
  // types keep them off a `text` button; the check here keeps a call site
  // that slipped past them a plain button.
  const isToggle =
    variant !== 'text' &&
    (defaultSelected !== undefined ||
      isSelected !== undefined ||
      onChange !== undefined)
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
        : variant !== 'text' && isToggle
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

  const { radii } = theme
  const resting =
    (shape === 'square') !== action.selected
      ? radii[SQUARE_CORNERS[size]]
      : radii.pill
  const shaped = useCorner(
    feedback.pressed ? radii[PRESSED_CORNERS[size]] : resting,
    onLayout,
  )

  return (
    <AnimatedPressable
      role={href === undefined ? 'button' : 'link'}
      {...(isToggle ? toggleState(action.selected) : undefined)}
      {...props}
      {...feedback.handlers}
      disabled={isDisabled}
      hitSlop={ownHitSlop ?? hitSlop(theme.sizing[HEIGHTS[size]])}
      onLayout={shaped.onLayout}
      onPress={action.onPress}
      style={composeStyles<AnimatedStyle<ViewStyle>>(
        styles.base,
        sizesOf(theme)[size],
        variant === 'outlined' ? outlinedSizesOf(theme)[size] : undefined,
        colors.container,
        shadowOf(variant, feedback, isDisabled, theme),
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
      {icon === undefined ? null : (
        <IconStyleContext value={iconStyleOf(colors.content, size)}>
          {icon}
        </IconStyleContext>
      )}
      {children === undefined ? null : (
        <NativeText
          style={composeStyles<TextStyle>(role, styles.label, colors.label)}
        >
          {children}
        </NativeText>
      )}
    </AnimatedPressable>
  )
}

function iconStyleOf(color: string, size: ButtonSize): IconStyle {
  return { color, size: ICON_SIZES[size] }
}

// The shadow a variant draws in its state: elevated rests at 1 and rises to 2
// under a pointer, filled and tonal rest flat and rise to 1, and a press
// brings each back to where it rests.
function shadowOf(
  variant: ButtonVariant,
  {
    hovered,
    pressed,
  }: { readonly hovered: boolean; readonly pressed: boolean },
  isDisabled: boolean,
  theme: ResolvedTheme,
): undefined | ViewStyle {
  const lifted = hovered && !pressed

  if (isDisabled) {
    return undefined
  }

  if (variant === 'elevated') {
    return shadowsOf(theme)[lifted ? 'elevation2' : 'elevation1']
  }

  return (variant === 'filled' || variant === 'tonal') && lifted
    ? shadowsOf(theme).elevation1
    : undefined
}

export { Button }
export type { ButtonProps, ButtonShape, ButtonSize, ButtonVariant }
