import type { ReactNode, Ref } from 'react'
import type {
  Insets,
  LayoutChangeEvent,
  PressableProps,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'

import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated'

import type { IconStyle } from '../../glyphs/icon-style'
import type { ResolvedTheme } from '../../theme/scope'

import { AnimatedPressable, toggleState, useButtonAction } from '../../button'
import { CheckGlyph } from '../../glyphs'
import { IconStyleContext } from '../../glyphs/icon-style'
import { TARGET_SIZE, usePressFeedback } from '../../press'
import { withOpacity } from '../../theme/color'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// Three of the chips page's four chips, as kanso-ui's Chip draws them: a 32dp
// pill with an 8dp corner, 16dp of inline padding and a 1dp rule, its label
// in label-large. `variant` picks the chip:
//
// - **A filter chip**, the default, is a toggle that reports its state as a
//   toggle Button does, and takes the secondary container pair and the check
//   once selected.
// - **An assist or suggestion chip** is an action, so nothing is reported as
//   selected and nothing ever is. The two differ in the label alone: on
//   surface on an assist chip, on surface variant on a suggestion chip as on
//   a filter one.
//
// An unselected chip is an outline-variant rule around nothing. **An elevated
// chip trades the outline for a container**, surface container low at the
// page's elevation 1, raised to 2 under a pointer; a selected one keeps the
// secondary container and takes the shadow with it. Its rule stays,
// transparent, so a chip is one size whichever container it is on.
//
// The check takes the icon's place rather than joining it, so a chip with an
// icon keeps its width when it is chosen, where one without grows by the
// slot. The check is what makes the selection legible without colour. An icon
// is in the primary role, and in the label's colour while disabled; the check
// is always in the label's. The slot is the page's 18dp, and a chip drawing
// one pads 8dp on that side rather than 16.
//
// **The label is one line, cut short with an ellipsis.** The chip is never
// wider than what holds it, which leaves the label a width to be cut at, and a
// screen reader still reads all of it. The height is a floor rather than a
// fixed size, so a label the device's text size enlarges grows the chip
// rather than running out of it.
//
// The fill, the rule and the label's colour ease over `durationShort2` on the
// standard curve, and change at once under reduced motion. The check appears
// at once, as on web, and the shadow moves at once, as a button's does.
//
// **Disabled is the page's colour at an opacity, translucent**, as a button's
// is: the label on-surface at `disabledContent`, a selected or elevated chip's
// container on-surface at `disabledContainer`, and an unselected one's rule at
// the same. A disabled chip casts no shadow.
//
// The state layers, the ripple and the focus ring are src/press's: on-surface
// over an unselected or elevated chip, on-secondary-container over a selected
// one.
//
// **The target departs from the page's 48dp, as web's does.** Across, it is
// the chip's width or 48dp, whichever is wider, centred on the chip. Up and
// down it reaches half the `spacing.sm` that chips wrap apart, not the 8dp a
// 48dp target would ask: a full reach would lay one row's target over the next
// one's, and a press just under one chip could go to the chip below it.
// Halfway, two rows' targets meet in the middle of the gap.

/** An assist or suggestion chip: an action, drawn as a plain button. */
type ChipActionProps = ChipBaseProps & {
  readonly defaultSelected?: never
  readonly isSelected?: never
  readonly onChange?: never
  /**
   * `assist` for an action the chip's context suggests, and `suggestion`
   * for one the product generates. Either is an action rather than a
   * selection, so neither is ever selected.
   */
  readonly variant: 'assist' | 'suggestion'
}

type ChipBaseProps = Omit<PressableProps, 'children' | 'disabled' | 'style'> & {
  /**
   * The chip's label. Required: the page draws no chip without one, and a
   * chip with none is an empty button to a screen reader.
   */
  readonly children: ReactNode
  /**
   * Raises the chip off the page on a container of its own, at the page's
   * elevation 1, in place of the outline. A selected filter chip keeps the
   * secondary container.
   * @default false
   */
  readonly elevated?: boolean
  /**
   * An icon before the label, in the page's 18dp slot and the primary role,
   * which the slot hands it through `useIconStyle()`. A filter chip's check
   * takes its place while the chip is selected, so the chip keeps its width.
   */
  readonly icon?: ReactNode
  /**
   * Draws the chip disabled, and takes no presses.
   * @default false
   */
  readonly isDisabled?: boolean
  readonly ref?: Ref<View>
  readonly style?: StyleProp<ViewStyle>
}

/** A filter chip: a two-state button, the default. */
type ChipFilterProps = ChipBaseProps & {
  /**
   * Whether the chip starts selected, when it keeps its own state.
   * @default false
   */
  readonly defaultSelected?: boolean
  /**
   * Whether the chip is selected, when the call site holds the state. Pass
   * it with `onChange`.
   */
  readonly isSelected?: boolean
  /** Called with the new state when the chip is pressed, after `onPress`. */
  readonly onChange?: (isSelected: boolean) => void
  /**
   * A filter chip, a two-state button.
   * @default 'filter'
   */
  readonly variant?: 'filter'
}

type ChipProps = ChipActionProps | ChipFilterProps

/** Which of the chips page's chips a Chip is. */
type ChipVariant = 'assist' | 'filter' | 'suggestion'

/** The colours a chip draws in one state. */
type Paint = {
  /** The label's colour. */
  readonly content: string
  readonly fill: string
  /**
   * The glyph's colour: the label's for the check, and for an icon the
   * primary role's, or the label's while the chip is disabled.
   */
  readonly glyph: string
  /** The state layer's and the ripple's colour. */
  readonly layer: string
  readonly rule: string
}

// The page's icon size for a chip. A literal, as on web: the theme has no
// scale for icon sizes.
const GLYPH_SIZE = 18

const CHECK = <CheckGlyph />

const styles = StyleSheet.create({
  glyph: {
    alignItems: 'center',
    flexShrink: 0,
    height: GLYPH_SIZE,
    justifyContent: 'center',
    width: GLYPH_SIZE,
  },
  // The label gives way before anything else in the pill does, and `minWidth`
  // lets it narrow below its text, which React Native Web otherwise holds it
  // at, so the ellipsis has somewhere to fall.
  label: {
    flexShrink: 1,
    minWidth: 0,
  },
})

const stylesOf = themedStyles(({ radii, sizing, spacing }) =>
  StyleSheet.create({
    // The pill's inline padding is 8dp on the side the glyph is on, so the
    // slot gives back the difference rather than the pill padding each side
    // apart, as web's does.
    glyphStart: {
      marginStart: -spacing.sm,
    },
    // No block padding, as on web: the label's own line box is what keeps an
    // enlarged label off the pill's edge, and a padding off the spacing scale
    // would grow the pill past 32dp under a scheme with a roomier one.
    pill: {
      alignItems: 'center',
      borderRadius: radii.sm,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      maxWidth: '100%',
      minHeight: sizing.controlXs,
      paddingHorizontal: spacing.lg,
    },
  }),
)

const shadowsOf = themedStyles(({ shadows }) =>
  StyleSheet.create({
    elevation1: { boxShadow: shadows.elevation1 },
    elevation2: { boxShadow: shadows.elevation2 },
  }),
)

/**
 * A chip. By default a filter chip, which is a two-state button reporting
 * its state as a toggle Button does: pass `isSelected` with `onChange` to
 * control it, or `defaultSelected` to let it keep its own state.
 *
 * ```tsx
 * <Chip defaultSelected>Label</Chip>
 * ```
 *
 * `variant="assist"` and `variant="suggestion"` draw the page's two action
 * chips instead: plain buttons, pressed with `onPress`, never selected.
 *
 * A column stretches a chip across it, as it does any view; a row of chips is
 * a row that wraps. `style`, `ref` and `testID` land on the `Pressable`.
 */
function Chip({
  children,
  defaultSelected,
  elevated = false,
  hitSlop,
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
  style,
  variant = 'filter',
  ...props
}: ChipProps) {
  const theme = useTheme()
  const role = useTypeRole('labelLarge')
  // Until the chip is measured it takes no reach across, rather than one
  // sized for a chip of no width.
  const [width, setWidth] = useState(TARGET_SIZE)

  const isToggle = variant === 'filter'
  const action = useButtonAction({
    defaultSelected,
    href: undefined,
    isSelected,
    isToggle,
    onChange,
    onPress,
  })
  const paint = paintOf(theme, {
    assist: variant === 'assist',
    disabled: isDisabled,
    elevated,
    selected: action.selected,
  })
  const eased = useEasedColors(paint)

  const feedback = usePressFeedback({
    color: paint.layer,
    corners: { borderRadius: theme.radii.sm },
    disabled: isDisabled,
    onBlur,
    onFocus,
    onHoverIn,
    onHoverOut,
    onPressIn,
    onPressOut,
  })

  const own = stylesOf(theme)
  const glyph = action.selected ? CHECK : icon

  return (
    <AnimatedPressable
      role="button"
      {...(isToggle ? toggleState(action.selected) : undefined)}
      {...props}
      {...feedback.handlers}
      disabled={isDisabled}
      hitSlop={hitSlop ?? targetOf(width, theme)}
      onLayout={measureThen(setWidth, onLayout)}
      onPress={action.onPress}
      style={composeStyles<AnimatedStyle<ViewStyle>>(
        own.pill,
        eased.container,
        elevated && !isDisabled
          ? shadowsOf(theme)[feedback.hovered ? 'elevation2' : 'elevation1']
          : undefined,
        feedback.ring,
        style,
      )}
    >
      {feedback.layer}
      {glyph === undefined || glyph === null ? null : (
        <IconStyleContext value={iconStyleOf(paint.glyph)}>
          <View style={composeStyles<ViewStyle>(styles.glyph, own.glyphStart)}>
            {glyph}
          </View>
        </IconStyleContext>
      )}
      <Animated.Text
        numberOfLines={1}
        style={composeStyles<AnimatedStyle<TextStyle>>(
          role,
          styles.label,
          eased.label,
        )}
      >
        {children}
      </Animated.Text>
    </AnimatedPressable>
  )
}

function iconStyleOf(color: string): IconStyle {
  return { color, size: GLYPH_SIZE }
}

// Records the chip's width for its target, then calls the call site's own
// `onLayout`. Built by a call rather than declared in the component, which is
// what react-perf's jsx-no-new-function-as-prop is after; the React Compiler
// memoises the result on its inputs.
function measureThen(
  setWidth: (width: number) => void,
  onLayout: PressableProps['onLayout'],
) {
  return (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width)
    onLayout?.(event)
  }
}

// The colours a chip draws, as the header sets them out. Transparent is
// written as the colour it eases to or from at no opacity, since Reanimated
// reads `transparent` as black at none and an ease from it would darken on
// the way: the fill as the secondary container a selected chip takes, and the
// rule as the outline it gives up.
function paintOf(
  { colors, stateLayerOpacity }: ResolvedTheme,
  {
    assist,
    disabled,
    elevated,
    selected,
  }: {
    readonly assist: boolean
    readonly disabled: boolean
    readonly elevated: boolean
    readonly selected: boolean
  },
): Paint {
  const clearFill = withOpacity(colors.secondaryContainer, 0)
  const clearRule = withOpacity(colors.outlineVariant, 0)
  const contained = selected || elevated

  if (disabled) {
    const content = withOpacity(
      colors.onSurface,
      stateLayerOpacity.disabledContent,
    )
    const container = withOpacity(
      colors.onSurface,
      stateLayerOpacity.disabledContainer,
    )

    return {
      content,
      fill: contained ? container : clearFill,
      glyph: content,
      layer: colors.onSurface,
      rule: contained ? clearRule : container,
    }
  }

  if (selected) {
    return {
      content: colors.onSecondaryContainer,
      fill: colors.secondaryContainer,
      glyph: colors.onSecondaryContainer,
      layer: colors.onSecondaryContainer,
      rule: clearRule,
    }
  }

  return {
    content: assist ? colors.onSurface : colors.onSurfaceVariant,
    fill: elevated ? colors.surfaceContainerLow : clearFill,
    glyph: colors.primary,
    layer: colors.onSurface,
    rule: elevated ? clearRule : colors.outlineVariant,
  }
}

// The target the header sets out: half the gap chips wrap apart above and
// below, and across, whatever brings the chip up to 48dp wide.
function targetOf(width: number, { spacing }: ResolvedTheme): Insets {
  const across = Math.max(0, (TARGET_SIZE - width) / 2)
  const reach = spacing.sm / 2

  return { bottom: reach, left: across, right: across, top: reach }
}

// The container's fill and rule and the label's colour, easing to the paint
// they are given, or there at once under reduced motion.
function useEasedColors({ content, fill, rule }: Paint) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const timing = {
    duration: motion.durationShort2,
    easing: Easing.bezier(...motion.easingStandard),
  }

  const container = useAnimatedStyle(() => {
    'worklet'
    return {
      backgroundColor: reduceMotion ? fill : withTiming(fill, timing),
      borderColor: reduceMotion ? rule : withTiming(rule, timing),
    }
  })
  const label = useAnimatedStyle(() => {
    'worklet'
    return { color: reduceMotion ? content : withTiming(content, timing) }
  })

  return { container, label }
}

export { Chip }
export type { ChipActionProps, ChipFilterProps, ChipProps, ChipVariant }
