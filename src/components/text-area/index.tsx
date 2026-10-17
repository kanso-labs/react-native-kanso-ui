import type { ComponentRef, ReactNode, Ref } from 'react'
import type {
  StyleProp,
  TextInput,
  TextInputProps,
  ViewStyle,
} from 'react-native'

import { useId, useImperativeHandle, useRef, useState } from 'react'
import { View } from 'react-native'

import type { FieldVariant } from '../../field'
import type { ValidationResult } from '../../form'

import {
  describedBy,
  FieldBox,
  FieldInput,
  FieldMessage,
  useFieldFocus,
} from '../../field'
import { useFieldValidation } from '../../form'
import { useLocaleOf } from '../../i18n/provider'

// kanso-ui's TextArea, the text fields page's multi-line configuration of the
// field: the same box, floating label, icons, rule and supporting line as
// TextField, drawn through the field chrome in src/field, around a control
// that holds several lines. The page gives the box 56dp at the least, with
// 8dp above and below the text and the label resting on its first line; a box
// holding more grows a line at a time, which the chrome's height floor
// already does, and its icons stay centred in its height, as web's do. The
// page draws no resize handle, and React Native draws none.
//
// Its own component rather than a prop of TextField, as on web, so `rows` and
// `autosize` stay off TextField's type and `numeric`, `prefix` and `suffix`
// off this one.
//
// The value is the field's own or the call site's, as TextField's is, and
// `onChange` is handed the string. The error shown is `error`, or what the
// field's `validate` and the `Form` around it say, which src/form decides.

type TextAreaProps = Omit<
  TextInputProps,
  | 'accessibilityHint'
  | 'accessibilityLabel'
  | 'aria-disabled'
  | 'aria-label'
  | 'children'
  | 'cursorColor'
  | 'defaultValue'
  | 'editable'
  | 'multiline'
  | 'numberOfLines'
  | 'onChange'
  | 'onChangeText'
  | 'placeholder'
  | 'placeholderTextColor'
  | 'readOnly'
  | 'rows'
  | 'selectionColor'
  | 'style'
  | 'underlineColorAndroid'
  | 'value'
> & {
  /**
   * Whether the field grows with the text it holds, from `rows` up. `false`
   * keeps it at `rows` and scrolls the text inside.
   * @default true
   */
  readonly autosize?: boolean
  /**
   * Counts the characters the field holds at the end of the supporting line,
   * against `maxLength` where there is one, as the text fields page's
   * character counter does. The count is written in the digits of the
   * `I18nProvider`'s locale, or the device's outside one.
   * @default false
   */
  readonly characterCount?: boolean
  /**
   * How the limit is said to a screen reader, where there is a `maxLength`.
   * Read with the field rather than as the value changes, so it names the
   * limit and not what is left of it; the visible count is hidden from
   * screen readers, which is what this replaces. Left out, it is the
   * library's sentence in the `I18nProvider`'s locale, or the device's
   * outside one, in the plural form the limit takes there: "Up to 20
   * characters" in English, singular for a limit of one.
   */
  readonly characterLimitLabel?: string
  /** The value the field opens with, when it keeps its own. */
  readonly defaultValue?: string
  /**
   * A hint shown under the field. Replaced by `error` when there is one, so
   * the two never stack.
   */
  readonly description?: string
  /**
   * The problem with the current value, in words. Its presence is what puts
   * the field in its error state: the message, the error colours, and the
   * invalid state a screen reader reads all follow from it. The line under
   * the field arrives with the message, so the field grows when this does,
   * unless it is inside a `Form`, which keeps the line drawn. It wins over
   * what `validate` and the form say, and holds a `native` form back.
   */
  readonly error?: string
  /**
   * Whether the label sits in the empty box and floats to the top once the
   * field is focused or holds a value, as the text fields page draws it.
   * `false` keeps it small at the top in every state.
   * @default true
   */
  readonly floatingLabel?: boolean
  /**
   * A ref to the field's own `TextInput`, which is what a call site moves
   * focus to, after a server's error, say. `ref` is the field as a whole.
   */
  readonly inputRef?: Ref<ComponentRef<typeof TextInput>>
  /**
   * Draws the field disabled: it takes no focus and no input.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * Shows the value and takes focus, but takes no input.
   * @default false
   */
  readonly isReadOnly?: boolean
  /**
   * Marks the label with an asterisk, as the text fields page marks a field
   * that must be filled.
   * @default false
   */
  readonly isRequired?: boolean
  /**
   * What the field is for, and the name a screen reader reads for it.
   * Required, since a text area with no label is a box nobody can name.
   */
  readonly label: string
  /**
   * An icon at the start of the box, before the label and the text: the
   * page's 24dp leading icon, in the muted role. The slot hands it that
   * colour and size through `useIconStyle()`.
   */
  readonly leadingIcon?: ReactNode
  /**
   * The name the value is submitted under by the `Form` around the field,
   * and the key its `validationErrors` reach the field by.
   */
  readonly name?: string
  /** Called with the new value as it is edited. */
  readonly onChange?: (value: string) => void
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * How many lines of text the field shows: the least it shows while it
   * grows, or all it shows when it does not.
   * @default 3
   */
  readonly rows?: number
  /** Positions and sizes the field as a whole. */
  readonly style?: StyleProp<ViewStyle>
  /**
   * An icon at the end of the box, after the text: the page's 24dp trailing
   * icon, in the muted role and the error role while the field has an
   * error. The slot hands it that colour and size through `useIconStyle()`.
   */
  readonly trailingIcon?: ReactNode
  /**
   * Checks the value, and returns its problem in words, or several, where
   * there is one, and `true`, `null` or `undefined` where there is none.
   * Under the default `aria` validation the error shows as the value
   * changes; inside a `native` form it shows once a submission is tried, or
   * once the field loses focus after an edit, and holds the form back.
   */
  readonly validate?: (value: string) => ValidationResult
  /** The value, when the call site keeps it. */
  readonly value?: string
  /**
   * The filled box, or the outlined one: no fill, an outline that thickens
   * and takes the primary role while focused, and the label cutting it once
   * it floats, the text fields page's two fields.
   * @default 'filled'
   */
  readonly variant?: FieldVariant
}

// The field's own blur handling, then the call site's.
function blurThen(
  onBlur: () => void,
  then: TextInputProps['onBlur'],
): TextInputProps['onBlur'] {
  return (event) => {
    onBlur()
    then?.(event)
  }
}

// Keeps an edit as the field's own value and reports it, so a field the call
// site controls is told and one it does not still shows what was typed, and
// tells the field's validation it was edited.
function editInto(
  setOwn: (value: string) => void,
  onChange: ((value: string) => void) | undefined,
  onEdit: () => void,
) {
  return (text: string) => {
    setOwn(text)
    onEdit()
    onChange?.(text)
  }
}

/**
 * A labelled multi-line input, the text fields page's filled or outlined
 * field holding several lines. Pass `value` with `onChange` to control it, or
 * `defaultValue` to let it keep its own; `onChange` is handed the string.
 *
 * It shows `rows` lines at the least and grows with what it holds, or holds
 * at `rows` and scrolls with `autosize={false}`. The page's configurations
 * are props: `leadingIcon` and `trailingIcon` at the box's ends, and
 * `characterCount` opposite the supporting text, counting against
 * `maxLength`. React Native's own `TextInput` props reach the control;
 * `style` and `ref` are the field as a whole, and `inputRef` the control.
 *
 * ```tsx
 * <TextArea label="Label" description="Supporting line" />
 * ```
 */
function TextArea({
  autosize = true,
  characterCount = false,
  characterLimitLabel,
  defaultValue = '',
  description,
  error,
  floatingLabel = true,
  inputRef,
  isDisabled = false,
  isReadOnly = false,
  isRequired = false,
  label,
  leadingIcon,
  name,
  onBlur,
  onChange,
  onFocus,
  ref,
  rows = 3,
  style,
  trailingIcon,
  validate,
  value,
  variant = 'filled',
  ...props
}: TextAreaProps) {
  const id = useId()
  const control = useRef<ComponentRef<typeof TextInput>>(null)
  const [own, setOwn] = useState(defaultValue)
  const current = value ?? own
  const validation = useFieldValidation({
    control,
    error,
    isDisabled,
    isEmpty: current === '',
    isReadOnly,
    isRequired,
    name,
    submitted: current,
    validate,
    value: current,
  })
  const focus = useFieldFocus({
    onBlur: blurThen(validation.onBlur, onBlur),
    onFocus,
  })
  const shownError = validation.error
  const locale = useLocaleOf(undefined)

  useImperativeHandle<
    ComponentRef<typeof TextInput> | null,
    ComponentRef<typeof TextInput> | null
  >(inputRef, () => control.current, [])

  return (
    <View ref={ref} style={style}>
      <FieldBox
        control={control}
        floatingLabel={floatingLabel}
        isDisabled={isDisabled}
        isFocused={focus.focused}
        isInvalid={shownError !== undefined}
        isPopulated={current !== ''}
        isRequired={isRequired}
        label={label}
        leading={leadingIcon}
        trailing={trailingIcon}
        variant={variant}
      >
        <FieldInput
          {...props}
          {...focus.handlers}
          aria-label={label}
          autosize={autosize}
          described={describedBy(id, {
            characterLimitLabel,
            description,
            error: shownError,
            locale,
            maxLength: props.maxLength,
          })}
          editable={!isDisabled && !isReadOnly}
          multiline
          onChangeText={editInto(setOwn, onChange, validation.onEdit)}
          ref={control}
          rows={rows}
          value={current}
        />
      </FieldBox>
      <FieldMessage
        characterCount={characterCount}
        characterLimitLabel={characterLimitLabel}
        description={description}
        error={shownError}
        id={id}
        length={current.length}
        maxLength={props.maxLength}
      />
    </View>
  )
}

export { TextArea }
export type { TextAreaProps }
