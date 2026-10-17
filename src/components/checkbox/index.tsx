import type { ComponentRef, ReactNode, Ref } from 'react'
import type { StyleProp, ViewProps, ViewStyle } from 'react-native'
import type {
  ToggleState,
  ToggleStateOptions,
} from 'react-stately/useToggleState'

import { use, useEffect, useId, useRef } from 'react'
import { Pressable, View } from 'react-native'
import { useToggleState } from 'react-stately/useToggleState'

import type { CheckboxTone } from '../../control/checkbox-box'
import type { CheckboxGroupContextValue } from '../../control/group'
import type { ResolvedTheme } from '../../theme/scope'

import {
  ControlLabel,
  ControlMessage,
  describedBy,
  LAYER_SIZE,
  messageOf,
} from '../../control'
import { CheckboxBox } from '../../control/checkbox-box'
import { CheckboxGroupContext } from '../../control/group'
import { controlStylesOf } from '../../control/styles'
import { hitSlop, usePressFeedback } from '../../press'
import { useTheme } from '../../theme/scope'
import { composeStyles } from '../../theme/styles'

// The checkbox page, as kanso-ui's Checkbox draws it: an 18dp box with a 2dp
// corner and an 18dp glyph, inside a 40dp state layer, with a 48dp target.
// Unselected, the box is a 2dp rule in on surface variant that turns on
// surface while hovered, pressed or focused; selected or indeterminate, it
// fills with primary and the glyph takes on primary. The error pair is error
// and on error, and disabled is on surface at the disabled opacity for the
// rule or the fill, with the glyph in surface. The state layer is on surface
// over an unselected box and primary over a selected one while hovered, and
// the two swap once pressed.
//
// The box eases between its colours over the motion tokens' short duration
// on the standard curve, as web's transition does, and at once for a reader
// who asks the device for reduced motion. The glyph arrives with the fill.
//
// The row, the label and the line under it are src/control's, which Radio
// and Switch draw through as well. The whole row is the `Pressable`, so a
// press on the label toggles the box, as a press on web's label does. The
// line under it is outside the row, as web's is outside its label.
//
// Inside a CheckboxGroup the selection is the group's, as web's Checkbox
// reads React Aria's group state: the box stands for the entry its `value`
// names, a press selects or clears that entry, and the group's disabled,
// read-only and error states reach the box as its own would.
//
// The corner is a literal: the page's 2dp is a step the shape scale does not
// carry.

type CheckboxProps = Omit<ViewProps, 'children' | 'style'> & {
  /**
   * The label, beside the box. A checkbox that a row labels some other way
   * leaves it out and passes `aria-label` instead.
   */
  readonly children?: ReactNode
  /**
   * Whether the checkbox starts selected, when it keeps its own state.
   * @default false
   */
  readonly defaultSelected?: boolean
  /**
   * A hint under the label. Replaced by `error` when there is one, so the
   * two never stack.
   */
  readonly description?: string
  /**
   * The problem with the current value, in words. Its presence is what puts
   * the checkbox in its error state: the message and the error colours both
   * follow from it.
   */
  readonly error?: string
  /**
   * Draws the checkbox disabled, and takes no presses.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * Draws the dash for a box that stands for a partly selected set, and
   * reports the box as mixed to a screen reader. It is the call site's to
   * clear: a press still changes `isSelected` underneath.
   * @default false
   */
  readonly isIndeterminate?: boolean
  /**
   * Shows the state without letting a press change it.
   * @default false
   */
  readonly isReadOnly?: boolean
  /**
   * Whether the checkbox is selected, for a call site holding the state
   * itself with `onChange`.
   */
  readonly isSelected?: boolean
  /** Called with the new state whenever a press changes it. */
  readonly onChange?: (isSelected: boolean) => void
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
  /**
   * The entry this checkbox stands for inside a `CheckboxGroup`, which the
   * group's value holds while it is selected. Required there, and unused
   * outside one.
   */
  readonly value?: string
}

// The state layer's colour roles, hovered or focused and pressed. Error is
// error throughout; otherwise the two swap once pressed.
const LAYERS: Readonly<
  Record<
    CheckboxTone,
    {
      readonly hover: keyof ResolvedTheme['colors']
      readonly pressed: keyof ResolvedTheme['colors']
    }
  >
> = {
  error: { hover: 'error', pressed: 'error' },
  marked: { hover: 'primary', pressed: 'onSurface' },
  unmarked: { hover: 'onSurface', pressed: 'primary' },
}

/**
 * A checkbox with its label, and optionally a description or an error under
 * it. Its state is React Stately's, as web's is: pass `isSelected` with
 * `onChange` to control it, or `defaultSelected` to let it keep its own.
 * `isIndeterminate` draws the dash for a box that stands for a partly
 * selected set.
 *
 * ```tsx
 * <Checkbox defaultSelected description="Supporting line">
 *   Label
 * </Checkbox>
 * ```
 *
 * A screen reader hears it as a checkbox named by its label, checked,
 * unchecked or mixed, followed by the line under it. A press anywhere on the
 * box or the label toggles it, and the row takes presses over the 48dp target
 * the page asks of the box. `style`, `ref` and `testID` land on the view
 * holding the row and the line under it, which is the element a layout
 * positions.
 */
function Checkbox({
  'aria-label': ariaLabel,
  children,
  defaultSelected,
  description,
  error,
  isDisabled: ownDisabled = false,
  isIndeterminate = false,
  isReadOnly: ownReadOnly = false,
  isSelected,
  onChange,
  style,
  value,
  ...props
}: CheckboxProps) {
  const theme = useTheme()
  const group = use(CheckboxGroupContext)
  const messageId = useId()
  const control = useRef<ComponentRef<typeof Pressable>>(null)
  const members = group?.members

  if (group !== null && value === undefined) {
    throw new Error(
      'A Checkbox inside a CheckboxGroup names the entry it stands for with `value`.',
    )
  }

  const isDisabled = ownDisabled || (group?.isDisabled ?? false)
  const isReadOnly = ownReadOnly || (group?.isReadOnly ?? false)
  const state = useToggleState(
    group === null || value === undefined
      ? { defaultSelected, isReadOnly, isSelected, onChange }
      : memberOf(group, value, { isReadOnly, onChange }),
  )

  // Joins the group's list of checkboxes once, in the order the tree mounts
  // them, so a native form holding the group back focuses the first.
  useEffect(() => {
    members?.add(messageId, control)
    return () => {
      members?.remove(messageId)
    }
  }, [members, messageId])

  const { colors, radii } = theme
  const marked = state.isSelected || isIndeterminate
  const interactive = !isDisabled && !isReadOnly
  const invalid = error !== undefined || (group?.isInvalid ?? false)
  const tone: CheckboxTone = invalid ? 'error' : marked ? 'marked' : 'unmarked'

  const feedback = usePressFeedback({
    color: colors[LAYERS[tone].hover],
    corners: { borderRadius: radii.circle },
    disabled: !interactive,
    disc: LAYER_SIZE,
    pressedColor: colors[LAYERS[tone].pressed],
  })
  const active =
    feedback.hovered || feedback.pressed || feedback.ring !== undefined

  return (
    <View {...props} style={style}>
      <Pressable
        aria-checked={isIndeterminate ? 'mixed' : state.isSelected}
        aria-label={ariaLabel}
        role="checkbox"
        {...describedBy(messageId, messageOf(description, error))}
        {...feedback.handlers}
        disabled={isDisabled}
        hitSlop={hitSlop(LAYER_SIZE, LAYER_SIZE)}
        onPress={toggleOf(state)}
        ref={control}
        style={controlStylesOf(theme).row}
      >
        <View
          style={composeStyles<ViewStyle>(
            controlStylesOf(theme).disc,
            feedback.ring,
          )}
        >
          {feedback.layer}
          <CheckboxBox
            active={active}
            isDisabled={isDisabled}
            isIndeterminate={isIndeterminate}
            isSelected={state.isSelected}
            tone={tone}
            within={LAYER_SIZE}
          />
        </View>
        <ControlLabel isDisabled={isDisabled}>{children}</ControlLabel>
      </Pressable>
      <ControlMessage description={description} error={error} id={messageId} />
    </View>
  )
}

// The toggle state of a checkbox in a group: selected while the group's
// value holds its entry, and a change made to the group's value, reported to
// the checkbox's own `onChange` as well, as React Aria's group item does.
function memberOf(
  group: CheckboxGroupContextValue,
  value: string,
  {
    isReadOnly,
    onChange,
  }: Pick<ToggleStateOptions, 'onChange'> & { readonly isReadOnly: boolean },
): ToggleStateOptions {
  return {
    isReadOnly,
    isSelected: group.isSelected(value),
    onChange: (isSelected) => {
      group.set(value, isSelected)
      onChange?.(isSelected)
    },
  }
}

// A press's toggle. Built by a call rather than declared in the component,
// which is what react-perf's jsx-no-new-function-as-prop is after; the React
// Compiler memoises the result on its input.
function toggleOf(state: ToggleState) {
  return () => {
    state.toggle()
  }
}

export { Checkbox }
export type { CheckboxProps }
