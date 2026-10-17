import type { ComponentRef, ReactNode, Ref } from 'react'
import type { StyleProp, TextStyle, ViewProps, ViewStyle } from 'react-native'
import type { CheckboxGroupState } from 'react-stately/useCheckboxGroupState'

import { useId, useState } from 'react'
import {
  Text as NativeText,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { useCheckboxGroupState } from 'react-stately/useCheckboxGroupState'

import type { CheckboxGroupContextValue } from '../../control/group'
import type { ValidationResult } from '../../form'

import { messageOf } from '../../control'
import { CheckboxGroupContext, createMembers } from '../../control/group'
import { useErrorAnnouncement } from '../../field'
import { useFieldValidation, useInsideForm } from '../../form'
import { withOpacity } from '../../theme/color'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// kanso-ui's CheckboxGroup: a labelled set of checkboxes sharing one value.
// The checkbox page draws the boxes; the group is what the pattern asks for
// around them, a group named by its label, described by the line under it
// and invalid as a whole, and its label and that line are the field chrome's,
// so a group reads like the fields beside it.
//
// The group is a column: its label in label large, the checkboxes, and the
// line under them, 4dp apart, with the line a further 4dp down, as web's
// field chrome sets them out and RadioGroup does here. The label is on
// surface variant, error while the group has one, and on surface at the
// disabled opacity while disabled, with the required mark a field's label
// carries. The line is not inset, since a group has no box to line it up
// with.
//
// The value is React Stately's, as web's is React Aria's, and the group hands
// it to its checkboxes through src/control/group, as RadioGroup hands its
// buttons theirs. Its validation is src/form's, as a field's is: `isRequired`,
// `validate`, and the form's errors under the group's `name`. A native Form
// holding it back focuses its first checkbox. A Form submits the selection
// under the group's `name` as a list, where a web form sends one entry per
// ticked box under it.
//
// Inside a Form the line is held from the start, as web's is, so an error
// arriving on submit moves nothing under the group. Outside one it takes
// space only while there is something in it, and stays mounted for the live
// region inside it, which has to be in place before the error it announces.

type CheckboxGroupProps = Omit<ViewProps, 'children' | 'style'> & {
  /** The checkboxes, each with a `value` of its own. */
  readonly children?: ReactNode
  /** The entries selected at first, when the group keeps its own value. */
  readonly defaultValue?: readonly string[]
  /**
   * A hint under the group. Replaced by `error` when there is one, so the
   * two never stack.
   */
  readonly description?: string
  /**
   * The problem with the current selection, in words. Its presence is what
   * puts the group in its error state: the message, the label's colour and
   * every box's error colours follow from it.
   *
   * Outside a `Form` the line under the group arrives with the message, so
   * the group grows when this does and moves what is under it. A `Form`
   * holds that space from the start; so does a permanent `description`.
   */
  readonly error?: string
  /**
   * Draws every checkbox disabled, and takes no presses.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * Shows the selection without letting a press change it.
   * @default false
   */
  readonly isReadOnly?: boolean
  /**
   * Marks the group's label, and has a `native` form hold submission back
   * while nothing is selected.
   * @default false
   */
  readonly isRequired?: boolean
  /**
   * What the group is for. Required rather than optional: a group of
   * checkboxes with no name is a set of boxes a screen reader cannot
   * introduce.
   */
  readonly label: string
  /**
   * The name the form around the group knows it by: its `onSubmit` is handed
   * the ticked entries' values as a list under it, an empty one while none
   * is ticked, and its `validationErrors` are keyed on it.
   */
  readonly name?: string
  /** Called with the newly selected entries whenever a press changes them. */
  readonly onChange?: (value: string[]) => void
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
  /**
   * Checks the selection, returning its problem in words, or `true`, `null`
   * or `undefined` when there is none. Shown as it changes, or under a
   * `native` form once a submission is tried.
   */
  readonly validate?: (value: readonly string[]) => ValidationResult
  /**
   * The selected entries, for a call site holding the value itself with
   * `onChange`.
   */
  readonly value?: readonly string[]
}

// What marks a required group's label, as a field's label marks one.
const REQUIRED_MARK = '*'

// What has a live region on the web read its whole content again whenever
// any of it changes, as the field's line does.
const ATOMIC = { 'aria-atomic': true } as const

const stylesOf = themedStyles(({ colors, spacing, stateLayerOpacity }) =>
  StyleSheet.create({
    // The group's checkboxes, one under another.
    items: {
      flexDirection: 'column',
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
    // The line with nothing to show: out of the flow, so the group ends at
    // its last checkbox, and still there for the live region inside it.
    messageLineCollapsed: {
      marginTop: 0,
      position: 'absolute',
    },
    // The live region with nothing in it, which takes no place in the line.
    outOfFlow: {
      position: 'absolute',
    },
    root: {
      flexDirection: 'column',
      rowGap: spacing.xs,
    },
  }),
)

/**
 * A labelled set of checkboxes with one value between them. The value is
 * React Stately's, as web's is React Aria's: pass `value` with `onChange` to
 * control it, or `defaultValue` to let the group keep its own, and each
 * `Checkbox` inside names the entry it stands for with `value`. Disabled,
 * read-only and the error state reach every checkbox from here.
 *
 * ```tsx
 * <CheckboxGroup defaultValue={['first']} label="Label">
 *   <Checkbox value="first">First item</Checkbox>
 *   <Checkbox value="second">Second item</Checkbox>
 * </CheckboxGroup>
 * ```
 *
 * A screen reader hears it as a group named by its label. On the web the
 * line under it describes the group, as web's does; on iOS and Android it is
 * read after the checkboxes, where it sits, and an error is announced as it
 * arrives. `style`, `ref` and `testID` land on the group as a whole, which is
 * the element a layout positions.
 */
function CheckboxGroup({
  children,
  defaultValue,
  description,
  error,
  isDisabled = false,
  isReadOnly = false,
  isRequired = false,
  label,
  name,
  onChange,
  style,
  validate,
  value,
  ...props
}: CheckboxGroupProps) {
  const theme = useTheme()
  const state = useCheckboxGroupState({
    defaultValue: copyOf(defaultValue),
    isDisabled,
    isReadOnly,
    onChange,
    value: copyOf(value),
  })
  const [members] = useState(createMembers)
  const validation = useFieldValidation({
    control: members,
    error,
    isDisabled,
    isEmpty: state.value.length === 0,
    isReadOnly,
    isRequired,
    name,
    submitted: state.value,
    validate,
    value: state.value,
  })
  const labelId = useId()
  const messageId = useId()
  const labelRole = useTypeRole('labelLarge')
  const messageRole = useTypeRole('bodySmall')
  const insideForm = useInsideForm()
  const { fontScale } = useWindowDimensions()

  const own = stylesOf(theme)
  const shown = validation.error
  const invalid = shown !== undefined
  const message = messageOf(description, shown)
  const holdsLine = insideForm || message !== undefined
  const context = contextOf(state, members, validation, invalid)
  const messageStyle = composeStyles<TextStyle>(
    messageRole,
    own.message,
    invalid ? own.messageError : undefined,
  )

  useErrorAnnouncement(shown)

  return (
    <View
      {...props}
      aria-labelledby={labelId}
      role="group"
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
        {isRequired ? REQUIRED_MARK : null}
      </NativeText>
      <View style={own.items}>
        <CheckboxGroupContext value={context}>{children}</CheckboxGroupContext>
      </View>
      <View
        style={composeStyles<ViewStyle>(
          own.messageLine,
          holdsLine
            ? minHeightOf(theme.typography.bodySmallLineHeight * fontScale)
            : own.messageLineCollapsed,
        )}
      >
        <View
          aria-live="polite"
          {...(Platform.OS === 'web' ? ATOMIC : undefined)}
          style={invalid && shown !== '' ? undefined : own.outOfFlow}
        >
          {invalid && shown !== '' ? (
            <NativeText id={messageId} style={messageStyle}>
              {shown}
            </NativeText>
          ) : null}
        </View>
        {invalid || description === undefined ? null : (
          <NativeText id={messageId} style={messageStyle}>
            {description}
          </NativeText>
        )}
      </View>
    </View>
  )
}

// What the group tells its checkboxes. A press selects or clears an entry
// and then counts as the edit and the commit both, since a checkbox changes
// the value at once rather than as a control loses focus, which is what a
// native form shows an error after.
function contextOf(
  state: CheckboxGroupState,
  members: CheckboxGroupContextValue['members'],
  {
    onBlur,
    onEdit,
  }: { readonly onBlur: () => void; readonly onEdit: () => void },
  isInvalid: boolean,
): CheckboxGroupContextValue {
  return {
    isDisabled: state.isDisabled,
    isInvalid,
    isReadOnly: state.isReadOnly,
    isSelected: (entry) => state.isSelected(entry),
    members,
    set: (entry, isSelected) => {
      if (isSelected) {
        state.addValue(entry)
      } else {
        state.removeValue(entry)
      }
      onEdit()
      onBlur()
    },
  }
}

// A list the call site may hold as read-only, as the mutable copy React
// Stately takes.
function copyOf(entries: readonly string[] | undefined) {
  return entries === undefined ? undefined : [...entries]
}

/**
 * How the group is described by the line under it. On the web it points at
 * the line with `aria-describedby`, as web's group does. iOS and Android
 * focus the checkboxes rather than the group, so there the line is left
 * where a screen reader reaches it in order, after the last checkbox.
 */
function lineOf(id: string, message: string | undefined) {
  return Platform.OS === 'web' && message !== undefined
    ? { 'aria-describedby': id }
    : undefined
}

function minHeightOf(minHeight: number): ViewStyle {
  return { minHeight }
}

export { CheckboxGroup }
export type { CheckboxGroupProps }
