import type { ComponentRef, ReactNode, Ref } from 'react'
import type { PressableProps, StyleProp, View, ViewStyle } from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'

import { useState } from 'react'

import { AnimatedPressable, toggleState, useButtonAction } from '../../button'
import {
  ChipGlyph,
  ChipLabel,
  measureThen,
  paintOf,
  targetOf,
  useEasedColors,
} from '../../chip'
import { shadowsOf, stylesOf } from '../../chip/styles'
import { TARGET_SIZE, usePressFeedback } from '../../press'
import { useTheme } from '../../theme/scope'
import { composeStyles } from '../../theme/styles'

// Three of the chips page's four chips, as kanso-ui's Chip draws them. The
// pill is src/chip's, shared with ChipGroup's chip as on web, which sets out
// its measurements, colours, motion and target. `variant` picks the chip:
//
// - **A filter chip**, the default, is a toggle that reports its state as a
//   toggle Button does, and takes the secondary container pair and the check
//   once selected.
// - **An assist or suggestion chip** is an action, so nothing is reported as
//   selected and nothing ever is. The two differ in the label alone: on
//   surface on an assist chip, on surface variant on a suggestion chip as on
//   a filter one.

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
  readonly ref?: Ref<ComponentRef<typeof View>>
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
    type: undefined,
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
        stylesOf(theme).pill,
        eased.container,
        elevated && !isDisabled
          ? shadowsOf(theme)[feedback.hovered ? 'elevation2' : 'elevation1']
          : undefined,
        feedback.ring,
        style,
      )}
    >
      {feedback.layer}
      <ChipGlyph color={paint.glyph} icon={icon} selected={action.selected} />
      <ChipLabel color={eased.label}>{children}</ChipLabel>
    </AnimatedPressable>
  )
}

export { Chip }
export type { ChipActionProps, ChipFilterProps, ChipProps, ChipVariant }
