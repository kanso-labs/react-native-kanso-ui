import type { ComponentRef, ReactNode, Ref } from 'react'
import type { StyleProp, TextStyle, ViewProps, ViewStyle } from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { RadioGroupState } from 'react-stately/useRadioGroupState'

import { createContext, use, useId, useMemo } from 'react'
import {
  Text as NativeText,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated'
import { useRadioGroupState } from 'react-stately/useRadioGroupState'

import type { ResolvedTheme } from '../../theme/scope'

import {
  ControlLabel,
  ControlMessage,
  describedBy,
  LAYER_SIZE,
  messageOf,
} from '../../control'
import { controlStylesOf } from '../../control/styles'
import { hitSlop, usePressFeedback } from '../../press'
import { withOpacity } from '../../theme/color'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// The radio button page, as kanso-ui's Radio draws it: a 20dp ring inside a
// 40dp state layer, with a 48dp target. Unselected, the ring is 2dp of on
// surface variant that turns on surface while hovered, pressed or focused;
// selected, the ring and the 10dp dot inside it are primary. Disabled is on
// surface at the disabled opacity for both. The state layer is on surface over
// an unselected button and primary over a selected one while hovered, and the
// two swap once pressed. The page draws no error state for the button itself:
// an invalid group says so through its label and message, and the buttons
// keep their colours.
//
// The ring eases between its colours over the motion tokens' short duration
// on the standard curve, as web's transition does, and at once for a reader
// who asks the device for reduced motion. The dot arrives with the selection,
// as web's does.
//
// Two components from one module, since neither means anything without the
// other: a radio button is a member of a group, and the group is what holds
// the value. The group hands its React Stately state to its buttons through
// context. Each button's row, label and the line under it are src/control's,
// as Checkbox's are.
//
// The group is a column: its label in label large, the buttons, and the line
// under them, 4dp apart, with the line a further 4dp down, as web's field
// chrome sets them out. The label is on surface variant, error while the
// group has one, and on surface at the disabled opacity while disabled.

type RadioGroupContextValue = {
  readonly horizontal: boolean
  readonly state: RadioGroupState
}

/** Which way a `RadioGroup` lays out its buttons. */
type RadioGroupOrientation = 'horizontal' | 'vertical'

type RadioGroupProps = Omit<ViewProps, 'children' | 'style'> & {
  /** The radio buttons, each with a `value` of its own. */
  readonly children?: ReactNode
  /** The value selected at first, when the group keeps its own state. */
  readonly defaultValue?: null | string
  /**
   * A hint under the group. Replaced by `error` when there is one, so the
   * two never stack.
   */
  readonly description?: string
  /**
   * The problem with the current selection, in words. Its presence is what
   * puts the group in its error state: the message and the label's colour
   * both follow from it.
   */
  readonly error?: string
  /**
   * Draws every button disabled, and takes no presses.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * Shows the selection without letting a press change it.
   * @default false
   */
  readonly isReadOnly?: boolean
  /**
   * What the group is for. Required rather than optional: a set of radio
   * buttons with no name is a set a screen reader cannot introduce.
   */
  readonly label: string
  /** Called with the newly selected value whenever a press changes it. */
  readonly onChange?: (value: string) => void
  /**
   * Lays the buttons one under another, or along a line that wraps.
   * @default 'vertical'
   */
  readonly orientation?: RadioGroupOrientation
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
  /**
   * The selected value, for a call site holding the state itself with
   * `onChange`. `null` selects nothing.
   */
  readonly value?: null | string
}

type RadioProps = Omit<ViewProps, 'children' | 'style'> & {
  /**
   * The label, beside the button. A button that a row labels some other way
   * leaves it out and passes `aria-label` instead.
   */
  readonly children?: ReactNode
  /** A hint under the label, read with the button. */
  readonly description?: string
  /**
   * Draws this button disabled, and takes no presses on it.
   * @default false
   */
  readonly isDisabled?: boolean
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
  /** The entry this button stands for, which the group reports when chosen. */
  readonly value: string
}

type Tone = 'selected' | 'unselected'

// The ring's side and rule, and the dot's side, from the page.
const RING_SIZE = 20
const RING_RULE = 2
const DOT_SIZE = 10

// The state layer's colour roles, hovered or focused and pressed. The two
// swap once pressed.
const LAYERS: Readonly<
  Record<
    Tone,
    {
      readonly hover: keyof ResolvedTheme['colors']
      readonly pressed: keyof ResolvedTheme['colors']
    }
  >
> = {
  selected: { hover: 'primary', pressed: 'onSurface' },
  unselected: { hover: 'onSurface', pressed: 'primary' },
}

const RadioGroupContext = createContext<null | RadioGroupContextValue>(null)

const styles = StyleSheet.create({
  dot: {
    height: DOT_SIZE,
    width: DOT_SIZE,
  },
  ring: {
    alignItems: 'center',
    borderWidth: RING_RULE,
    height: RING_SIZE,
    justifyContent: 'center',
    width: RING_SIZE,
  },
  // A button along a line gives up width before it widens the line, so a
  // label longer than the line breaks inside it.
  shrink: {
    flexShrink: 1,
  },
})

const groupStylesOf = themedStyles(
  ({ colors, radii, spacing, stateLayerOpacity }) =>
    StyleSheet.create({
      dot: {
        borderRadius: radii.circle,
      },
      // The group's buttons, one under another.
      items: {
        flexDirection: 'column',
      },
      // Along a line instead, 16dp apart, wrapping when the line runs out.
      itemsHorizontal: {
        columnGap: spacing.lg,
        flexDirection: 'row',
        flexWrap: 'wrap',
      },
      label: {
        color: colors.onSurfaceVariant,
      },
      labelDisabled: {
        color: withOpacity(colors.onSurface, stateLayerOpacity.disabledContent),
      },
      labelError: {
        color: colors.error,
      },
      message: {
        color: colors.onSurfaceVariant,
      },
      messageError: {
        color: colors.error,
      },
      messageLine: {
        marginTop: spacing.xs,
      },
      ring: {
        borderRadius: radii.circle,
      },
      root: {
        flexDirection: 'column',
        rowGap: spacing.xs,
      },
    }),
)

/**
 * The colour the ring and the dot are drawn in. Hover, press and focus darken
 * only an unselected ring, and only one a press can change.
 */
function colorOf(
  { colors, stateLayerOpacity }: ResolvedTheme,
  {
    active,
    isDisabled,
    isSelected,
  }: {
    readonly active: boolean
    readonly isDisabled: boolean
    readonly isSelected: boolean
  },
) {
  if (isDisabled) {
    return withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)
  }

  if (isSelected) {
    return colors.primary
  }

  return active ? colors.onSurface : colors.onSurfaceVariant
}

/**
 * How the group is described by the line under it. On the web it points at
 * the line with `aria-describedby`, as web's group does. iOS and Android
 * focus the buttons rather than the group, so there the line is left where a
 * screen reader reaches it in order, after the last button.
 */
function lineOf(id: string, message: string | undefined) {
  return Platform.OS === 'web' && message !== undefined
    ? { 'aria-describedby': id }
    : undefined
}

/**
 * One option of a `RadioGroup`, with its label and optionally a description
 * under it. It names the entry it stands for with `value`; the selection is
 * the group's, so a `Radio` is only ever drawn inside one.
 *
 * A screen reader hears it as a radio button named by its label, checked or
 * not, followed by the line under it. A press anywhere on the button or the
 * label selects it, and the row takes presses over the 48dp target the page
 * asks of the button. `style`, `ref` and `testID` land on the view holding
 * the row and the line under it, which is the element a layout positions.
 */
function Radio({
  'aria-label': ariaLabel,
  children,
  description,
  isDisabled: ownDisabled = false,
  style,
  value,
  ...props
}: RadioProps) {
  const theme = useTheme()
  const group = use(RadioGroupContext)
  const messageId = useId()

  if (group === null) {
    throw new Error(
      'A Radio is drawn inside a RadioGroup, which holds its selection.',
    )
  }

  const { colors, radii } = theme
  const { horizontal, state } = group
  const isDisabled = ownDisabled || state.isDisabled
  const isSelected = state.selectedValue === value
  const interactive = !isDisabled && !state.isReadOnly
  const tone: Tone = isSelected ? 'selected' : 'unselected'

  const feedback = usePressFeedback({
    color: colors[LAYERS[tone].hover],
    corners: { borderRadius: radii.circle },
    disabled: !interactive,
    disc: LAYER_SIZE,
    pressedColor: colors[LAYERS[tone].pressed],
  })
  const active =
    feedback.hovered || feedback.pressed || feedback.ring !== undefined
  const color = colorOf(theme, { active, isDisabled, isSelected })
  const ring = useRingColor(color)
  const own = groupStylesOf(theme)

  return (
    <View
      {...props}
      style={composeStyles<ViewStyle>(
        horizontal ? styles.shrink : undefined,
        style,
      )}
    >
      <Pressable
        aria-checked={isSelected}
        aria-label={ariaLabel}
        role="radio"
        {...describedBy(messageId, messageOf(description, undefined))}
        {...feedback.handlers}
        disabled={isDisabled}
        hitSlop={hitSlop(LAYER_SIZE, LAYER_SIZE)}
        onPress={selectOf(state, value)}
        style={controlStylesOf(theme).row}
      >
        <View
          style={composeStyles<ViewStyle>(
            controlStylesOf(theme).disc,
            feedback.ring,
          )}
        >
          {feedback.layer}
          <Animated.View
            style={composeStyles<AnimatedStyle<ViewStyle>>(
              styles.ring,
              own.ring,
              ring,
            )}
          >
            {isSelected ? (
              <View
                style={composeStyles<ViewStyle>(styles.dot, own.dot, {
                  backgroundColor: color,
                })}
              />
            ) : null}
          </Animated.View>
        </View>
        <ControlLabel isDisabled={isDisabled}>{children}</ControlLabel>
      </Pressable>
      <ControlMessage description={description} id={messageId} />
    </View>
  )
}

/**
 * A labelled set of radio buttons with one selected value between them. The
 * value is React Stately's, as web's is: pass `value` with `onChange` to
 * control it, or `defaultValue` to let the group keep its own, and each
 * `Radio` inside names the entry it stands for. Disabled, read-only and the
 * error state reach every button from here, and `orientation="horizontal"`
 * lays the buttons along a line.
 *
 * ```tsx
 * <RadioGroup defaultValue="first" label="Label">
 *   <Radio value="first">First item</Radio>
 *   <Radio value="second">Second item</Radio>
 * </RadioGroup>
 * ```
 *
 * A screen reader hears it as a radio group named by its label. On the web
 * the line under it describes the group, as web's does; on iOS and Android
 * it is read after the buttons, where it sits. `style`, `ref` and `testID`
 * land on the group as a whole, which is the element a layout positions.
 */
function RadioGroup({
  children,
  defaultValue,
  description,
  error,
  isDisabled = false,
  isReadOnly = false,
  label,
  onChange,
  orientation = 'vertical',
  style,
  value,
  ...props
}: RadioGroupProps) {
  const theme = useTheme()
  const state = useRadioGroupState({
    defaultValue,
    isDisabled,
    isReadOnly,
    onChange,
    orientation,
    value,
  })
  const labelId = useId()
  const messageId = useId()
  const labelRole = useTypeRole('labelLarge')
  const messageRole = useTypeRole('bodySmall')

  const own = groupStylesOf(theme)
  const horizontal = orientation === 'horizontal'
  const context = useMemo(() => ({ horizontal, state }), [horizontal, state])
  const invalid = error !== undefined
  const message = messageOf(description, error)

  return (
    <View
      {...props}
      aria-labelledby={labelId}
      role="radiogroup"
      {...lineOf(messageId, message)}
      style={composeStyles<ViewStyle>(own.root, style)}
    >
      <NativeText
        id={labelId}
        style={composeStyles<TextStyle>(
          labelRole,
          own.label,
          isDisabled ? own.labelDisabled : undefined,
          invalid ? own.labelError : undefined,
        )}
      >
        {label}
      </NativeText>
      <View
        style={composeStyles<ViewStyle>(
          own.items,
          horizontal ? own.itemsHorizontal : undefined,
        )}
      >
        <RadioGroupContext value={context}>{children}</RadioGroupContext>
      </View>
      {message === undefined ? null : (
        <View style={own.messageLine}>
          <NativeText
            id={messageId}
            style={composeStyles<TextStyle>(
              messageRole,
              own.message,
              invalid ? own.messageError : undefined,
            )}
          >
            {message}
          </NativeText>
        </View>
      )}
    </View>
  )
}

// A press's selection. Built by a call rather than declared in the
// component, which is what react-perf's jsx-no-new-function-as-prop is after;
// the React Compiler memoises the result on its inputs.
function selectOf(state: RadioGroupState, value: string) {
  return () => {
    state.setSelectedValue(value)
  }
}

// The ring's colour, eased to as the state changes.
function useRingColor(color: string) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const timing = {
    duration: motion.durationShort2,
    easing: Easing.bezier(...motion.easingStandard),
  }

  return useAnimatedStyle(() => {
    'worklet'
    return {
      borderColor: reduceMotion ? color : withTiming(color, timing),
    }
  })
}

export { Radio, RadioGroup }
export type { RadioGroupOrientation, RadioGroupProps, RadioProps }
