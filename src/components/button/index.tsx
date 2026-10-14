import type { ReactNode, Ref } from 'react'
import type {
  GestureResponderEvent,
  LayoutChangeEvent,
  PressableProps,
  StyleProp,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle, SharedValue } from 'react-native-reanimated'

import { useState } from 'react'
import {
  Text as NativeText,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import type { IconStyle } from '../../glyphs/icon-style'
import type { ResolvedTheme } from '../../theme/scope'
import type { TypeRole } from '../../typography/roles'

import { IconStyleContext } from '../../glyphs/icon-style'
import { hitSlop, usePressFeedback } from '../../press'
import { useOpenLink } from '../../router'
import { withOpacity } from '../../theme/color'
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
// at `disabledContent`. Web mixes both over the surface role, since a
// `color-mix()` needs a colour to mix with; React Native has none, and the
// page gives the two as opacities over whatever the button sits on, which is
// what they are drawn as here. Disabled drops the shadow, since a shadow says
// a control is there to press.
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
// once selected. The corner eases over the motion tokens' short duration on
// the emphasised curve, through Reanimated, and moves at once for a reader
// who asks the device for reduced motion. The pill is the radius scale's
// `pill`, far larger than any button, so the morph runs from half the
// button's measured height rather than from that: otherwise the corner would
// hold the pill for most of the ease and jump at its end.

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

/**
 * The three forms a button takes, of which a call site writes exactly one: a
 * plain button, a link, or a toggle. Each names the props of the other two as
 * `never`, so a toggle given `href` is a compile error rather than a prop that
 * silently does nothing.
 */
type ButtonLinkForm = {
  readonly defaultSelected?: never
  /**
   * Where the button leads. Given one, a press opens it through the
   * `RouterProvider` around the button, or through the platform for a URL
   * with a scheme of its own, and the button is announced as a link.
   */
  readonly href: string
  readonly isSelected?: never
  readonly onChange?: never
}

type ButtonPressForm = {
  readonly defaultSelected?: never
  readonly href?: never
  readonly isSelected?: never
  readonly onChange?: never
}

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

type ButtonToggleForm = {
  /**
   * Whether a toggle starts selected, when it keeps its own state. Passing
   * this, `isSelected` or `onChange` is what makes the button a toggle.
   */
  readonly defaultSelected?: boolean
  readonly href?: never
  /**
   * Whether a toggle is selected, when the call site holds the state. Pass
   * it with `onChange`; passing this, `defaultSelected` or `onChange` is what
   * makes the button a toggle.
   */
  readonly isSelected?: boolean
  /**
   * Called with the new state when a toggle is pressed, after `onPress`.
   * Passing this, `isSelected` or `defaultSelected` is what makes the button
   * a toggle.
   */
  readonly onChange?: (isSelected: boolean) => void
}

type ButtonVariant = 'elevated' | 'filled' | 'outlined' | 'text' | 'tonal'

/** What a container draws: its own style, and the colour of what is on it. */
type Palette = {
  readonly container: ViewStyle
  readonly content: string
  readonly label: TextStyle
}

// Every container a button draws, by the name web's styles give it. Three of
// a toggle's eight are the plain button's own: an unselected tonal, elevated
// or outlined toggle is the tonal, elevated or outlined button.
type PaletteName =
  | 'elevated'
  | 'elevatedToggleSelected'
  | 'filled'
  | 'filledDisabled'
  | 'filledToggle'
  | 'filledToggleSelected'
  | 'outlined'
  | 'outlinedDisabled'
  | 'outlinedToggleSelected'
  | 'text'
  | 'textDisabled'
  | 'tonal'
  | 'tonalToggleSelected'

/** How a toggle reports its state to a screen reader. */
type ToggleState = {
  readonly 'aria-pressed'?: boolean
  readonly 'aria-selected'?: boolean
}

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

// The control height each size reads, for the target it is brought up to.
const HEIGHTS = {
  lg: 'controlLg',
  md: 'controlSm',
  xl: 'controlXl',
  xs: 'controlXs',
  xxl: 'controlXxl',
} as const satisfies Record<ButtonSize, keyof ResolvedTheme['sizing']>

// The icon each size draws, from the page's size token sets. Literals, as on
// web: they are icon sizes, which the theme has no scale for.
const ICON_SIZES: Readonly<Record<ButtonSize, number>> = {
  lg: 24,
  md: 20,
  xl: 32,
  xs: 20,
  xxl: 40,
}

// The outlined button's rule thickens with the size, as the page's size
// tokens have it: 1dp up to M, 2dp at L, 3dp at XL.
const OUTLINE_WIDTHS: Readonly<Record<ButtonSize, number>> = {
  lg: 1,
  md: 1,
  xl: 2,
  xs: 1,
  xxl: 3,
}

// The corner each size presses to, whatever its shape.
const PRESSED_CORNERS = {
  lg: 'md',
  md: 'sm',
  xl: 'lg',
  xs: 'sm',
  xxl: 'lg',
} as const satisfies Record<ButtonSize, keyof ResolvedTheme['radii']>

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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

// Web's toggle reports `aria-pressed`, which React Native Web writes onto the
// element. React Native has no pressed state to report, and reports the
// selected one instead, which VoiceOver and TalkBack both read out.
const toggleState = Platform.select<(selected: boolean) => ToggleState>({
  default: (selected) => ({ 'aria-selected': selected }),
  web: (selected) => ({ 'aria-pressed': selected }),
})

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
  // Clips the state layer and the ripple to the corner as it morphs, and
  // takes no touches.
  clip: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
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

function palette(content: string, container: ViewStyle = {}): Palette {
  return { container, content, label: { color: content } }
}

const palettesOf = themedStyles(
  ({ colors, stateLayerOpacity }): Readonly<Record<PaletteName, Palette>> => {
    const disabledContainer = withOpacity(
      colors.onSurface,
      stateLayerOpacity.disabledContainer,
    )
    const disabledContent = withOpacity(
      colors.onSurface,
      stateLayerOpacity.disabledContent,
    )

    return {
      elevated: palette(colors.primary, {
        backgroundColor: colors.surfaceContainerLow,
      }),
      elevatedToggleSelected: palette(colors.onPrimary, {
        backgroundColor: colors.primary,
      }),
      filled: palette(colors.onPrimary, { backgroundColor: colors.primary }),
      filledDisabled: palette(disabledContent, {
        backgroundColor: disabledContainer,
      }),
      filledToggle: palette(colors.onSurfaceVariant, {
        backgroundColor: colors.surfaceContainer,
      }),
      filledToggleSelected: palette(colors.onPrimary, {
        backgroundColor: colors.primary,
      }),
      outlined: palette(colors.onSurfaceVariant, {
        borderColor: colors.outlineVariant,
      }),
      outlinedDisabled: palette(disabledContent, {
        borderColor: disabledContainer,
      }),
      // The rule keeps its width, drawn transparent, so a toggle does not
      // change size as it is selected.
      outlinedToggleSelected: palette(colors.inverseOnSurface, {
        backgroundColor: colors.inverseSurface,
        borderColor: 'transparent',
      }),
      text: palette(colors.primary),
      textDisabled: palette(disabledContent),
      tonal: palette(colors.onSecondaryContainer, {
        backgroundColor: colors.secondaryContainer,
      }),
      tonalToggleSelected: palette(colors.onSecondary, {
        backgroundColor: colors.secondary,
      }),
    }
  },
)

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
  style,
  variant = 'filled',
  ...props
}: ButtonProps) {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const openLink = useOpenLink()
  const role = useTypeRole(ROLES[size])
  const [ownSelected, setOwnSelected] = useState(defaultSelected ?? false)
  const height = useSharedValue(0)

  // The three props that make this a toggle, read as web reads them. The
  // types keep them off a `text` button; the check here keeps a call site
  // that slipped past them a plain button.
  const isToggle =
    variant !== 'text' &&
    (defaultSelected !== undefined ||
      isSelected !== undefined ||
      onChange !== undefined)
  const selected = isToggle && (isSelected ?? ownSelected)
  const colors =
    palettesOf(theme)[
      isDisabled
        ? DISABLED[variant]
        : variant !== 'text' && isToggle
          ? TOGGLE_PALETTES[variant][selected ? 'selected' : 'unselected']
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

  const { motion, radii } = theme
  const resting =
    (shape === 'square') !== selected ? radii[SQUARE_CORNERS[size]] : radii.pill
  const radius = feedback.pressed ? radii[PRESSED_CORNERS[size]] : resting
  const timing = {
    duration: motion.durationShort2,
    easing: Easing.bezier(...motion.easingEmphasized),
  }
  const corner = useAnimatedStyle(() => {
    'worklet'
    const measured = height.get()
    const target = measured > 0 ? Math.min(radius, measured / 2) : radius

    return {
      borderRadius: reduceMotion ? target : withTiming(target, timing),
    }
  })

  // What a press does after the call site's own `onPress`: opens the link,
  // or changes the toggle's state.
  function follow() {
    if (href !== undefined) {
      openLink(href)
    } else if (isToggle) {
      setOwnSelected(!selected)
      onChange?.(!selected)
    }
  }

  return (
    <AnimatedPressable
      role={href === undefined ? 'button' : 'link'}
      {...(isToggle ? toggleState(selected) : undefined)}
      {...props}
      {...feedback.handlers}
      disabled={isDisabled}
      hitSlop={ownHitSlop ?? hitSlop(theme.sizing[HEIGHTS[size]])}
      onLayout={measureThen(height, onLayout)}
      onPress={pressThen(onPress, follow)}
      style={composeStyles<AnimatedStyle<ViewStyle>>(
        styles.base,
        sizesOf(theme)[size],
        variant === 'outlined' ? outlinedSizesOf(theme)[size] : undefined,
        colors.container,
        shadowOf(variant, feedback, isDisabled, theme),
        corner,
        feedback.ring,
        style,
      )}
    >
      <Animated.View
        style={composeStyles<AnimatedStyle<ViewStyle>>(styles.clip, corner)}
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

// Records the button's height for the corner, then calls the call site's own
// `onLayout`. Built by a call rather than declared in the component, which is
// what react-perf's jsx-no-new-function-as-prop is after; the React Compiler
// memoises the result on its inputs.
function measureThen(
  height: SharedValue<number>,
  onLayout: ButtonProps['onLayout'],
) {
  return (event: LayoutChangeEvent) => {
    height.set(event.nativeEvent.layout.height)
    onLayout?.(event)
  }
}

// The call site's own `onPress` first, then what the button does with the
// press, which is the order web reports them in. Built by a call for the
// reason `measureThen` is.
function pressThen(onPress: ButtonProps['onPress'], then: () => void) {
  return (event: GestureResponderEvent) => {
    onPress?.(event)
    then()
  }
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
