import type { ComponentRef, ReactNode, Ref } from 'react'
import type {
  BlurEvent,
  KeyboardTypeOptions,
  StyleProp,
  TextInput,
  TextInputProps,
  TextInputSubmitEditingEvent,
  ViewStyle,
} from 'react-native'
import type { Color, ColorChannel, ColorSpace } from 'react-stately'

import { useId, useImperativeHandle, useRef, useState } from 'react'
import { View } from 'react-native'
import { parseColor } from 'react-stately'
import { useColorFieldState } from 'react-stately/useColorFieldState'

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
import { keyboardFor } from '../../number/keyboard'
import { useNumberFieldState } from '../../number/state'
import { colorOf, usePickedColor } from '../../swatch'

// kanso-ui's ColorField: a colour typed rather than picked, in the text
// fields page's box with nothing added, drawn through the field chrome in
// src/field as TextField is. That is what makes a colour field on a form the
// same shape as the field beside it.
//
// **`channel` turns it from a colour into a number.** Without one the field
// holds the whole colour as hex, `#6750A4`, through React Stately's
// `useColorFieldState`, which web's reads through React Aria: a keystroke is
// kept only where the text could still be hex, and the text is read when the
// field loses focus or the return key is pressed, then written back as the
// colour's hex, or put back where it reads as no colour. With one it holds
// that channel alone, as React Stately's `useColorChannelFieldState` does: a
// number in the channel's own format, `256°` or `34%`, kept and read as
// NumberField's value is, in the `I18nProvider`'s locale, and clamped to the
// channel's range and snapped to its step. That is what a picker's boxes
// beside a plane are.
//
// **A swatch is the natural leading icon.** The field's value is a colour,
// and the chrome already has a slot for something at the box's leading end;
// a `ColorSwatch` there is what makes the field show the colour it holds. It
// is left to the call site rather than drawn here, since a field inside a
// picker sits beside a swatch already.
//
// The keyboard is the one that types what the field holds: the default one
// for hex, with no capitals, corrections or suggestions, and for a channel
// the number pad, or the decimal pad where the channel's format shows a
// fraction, since no channel reaches below zero.

type ColorFieldProps = Omit<
  TextInputProps,
  | 'accessibilityHint'
  | 'accessibilityLabel'
  | 'aria-disabled'
  | 'aria-label'
  | 'autoCapitalize'
  | 'autoComplete'
  | 'autoCorrect'
  | 'children'
  | 'cursorColor'
  | 'defaultValue'
  | 'editable'
  | 'inputMode'
  | 'keyboardType'
  | 'maxLength'
  | 'multiline'
  | 'numberOfLines'
  | 'onChange'
  | 'onChangeText'
  | 'placeholder'
  | 'placeholderTextColor'
  | 'readOnly'
  | 'selectionColor'
  | 'spellCheck'
  | 'style'
  | 'underlineColorAndroid'
  | 'value'
> & {
  /**
   * The one channel the field holds, as a number in that channel's format,
   * in place of the whole colour as hex.
   */
  readonly channel?: ColorChannel
  /**
   * The space `channel` is read in, the value converted into it first, as on
   * `ColorSlider`. Left out, `channel` is one of the value's own space.
   */
  readonly colorSpace?: ColorSpace
  /**
   * The colour the field opens with, when it keeps its own: a CSS colour
   * string, or a `Color` from `parseColor`, which this package re-exports.
   * `null` opens it empty.
   */
  readonly defaultValue?: Color | null | string
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
   * Required, since a field with no label is a box nobody can name.
   */
  readonly label: string
  /**
   * An icon at the start of the box, before the label and the value, in the
   * page's 24dp slot. A `ColorSwatch` there shows the value.
   */
  readonly leadingIcon?: ReactNode
  /**
   * The name the value is submitted under by the `Form` around the field,
   * and the key its `validationErrors` reach the field by. The form submits
   * what web's does: the hex the field shows, or the channel's number written
   * out, such as `0.6`, and `''` for an empty field.
   */
  readonly name?: string
  /**
   * Called with the colour once it is read from what was typed: for a
   * channel, the value with that channel changed. `null` is an empty field.
   */
  readonly onChange?: (value: Color | null) => void
  readonly ref?: Ref<ComponentRef<typeof View>>
  /** Positions and sizes the field as a whole. */
  readonly style?: StyleProp<ViewStyle>
  /**
   * An icon at the end of the box, after the value, in the page's 24dp slot:
   * the muted role, and the error role while the field has an error.
   */
  readonly trailingIcon?: ReactNode
  /**
   * Checks the colour, `null` for an empty field, and returns its problem in
   * words, or several, where there is one, and `true`, `null` or `undefined`
   * where there is none. Under the default `aria` validation the error shows
   * as the value changes; inside a `native` form it shows once a submission
   * is tried, or once the field loses focus after an edit, and holds the form
   * back.
   */
  readonly validate?: (value: Color | null) => ValidationResult
  /**
   * The colour, when the call site keeps it: a CSS colour string or a
   * `Color`. `null` is an empty field.
   */
  readonly value?: Color | null | string
  /**
   * The filled box, or the outlined one: no fill, an outline that thickens
   * and takes the primary role while focused, and the label cutting it once
   * it floats, the text fields page's two fields.
   * @default 'filled'
   */
  readonly variant?: FieldVariant
}

// What the box draws from either kind of field: the colour it is validated
// on, what it submits, and the text it holds and how that text is kept.
type FieldShellProps = Omit<
  ColorFieldProps,
  'channel' | 'colorSpace' | 'defaultValue' | 'onChange' | 'value'
> & {
  readonly color: Color | null
  readonly isEmpty: boolean
  readonly keyboardType: KeyboardTypeOptions
  readonly state: TextState
  readonly submitted: string
}

// The text a field holds, which React Stately's colour field state and
// src/number's number field state both keep.
type TextState = {
  /** Reads the text as the value and writes it back. */
  readonly commit: () => void
  readonly inputValue: string
  readonly setInputValue: (value: string) => void
  /** Whether the text could still become a value, as it is typed. */
  readonly validate: (value: string) => boolean
}

// What a channel field holds while it holds no colour: React Stately's.
const BLACK = parseColor('#000')

// The field's own blur handling, then the call site's.
function blurThen(
  onBlur: () => void,
  then: ((event: BlurEvent) => void) | undefined,
) {
  return (event: BlurEvent) => {
    onBlur()
    then?.(event)
  }
}

/**
 * One channel of a colour as a number: the value converted into
 * `colorSpace`, the channel read in its own format and range, and a
 * committed number written back into the colour. React Stately's
 * `useColorChannelFieldState`, over src/number's number field state.
 */
function ChannelField({
  channel,
  colorSpace,
  defaultValue,
  onChange,
  value,
  ...props
}: Omit<ColorFieldProps, 'channel'> & { readonly channel: ColorChannel }) {
  const locale = useLocaleOf(undefined)
  const [own, setOwn] = useState(() => colorOrNull(defaultValue))
  const controlled = value !== undefined
  const current = controlled ? colorOrNull(value) : own
  const color = inSpace(current ?? BLACK, colorSpace)
  const range = color.getChannelRange(channel)
  const formatOptions = color.getChannelFormatOptions(channel)
  // A percentage of a channel running to 100 is read as a fraction, so 34
  // is written 34%.
  const multiplier =
    formatOptions.style === 'percent' && range.maxValue === 100 ? 100 : 1
  const state = useNumberFieldState({
    formatOptions,
    locale,
    maxValue: range.maxValue / multiplier,
    minValue: range.minValue / multiplier,
    onChange: (next) => {
      const changed = Number.isNaN(next)
        ? null
        : color.withChannelValue(channel, next * multiplier)
      if (!controlled) {
        setOwn(changed)
      }
      onChange?.(changed)
    },
    step: range.step / multiplier,
    value:
      current === null
        ? Number.NaN
        : color.getChannelValue(channel) / multiplier,
  })
  const empty = Number.isNaN(state.numberValue)

  return (
    <FieldShell
      {...props}
      color={current}
      isEmpty={empty}
      keyboardType={keyboardFor(locale, formatOptions, range.minValue)}
      state={state}
      submitted={empty ? '' : String(state.numberValue)}
    />
  )
}

/**
 * A colour typed into a field, the text fields page's filled or outlined
 * field. Pass `value` with `onChange` to control it, or `defaultValue` to
 * let it keep its own, as a CSS colour string or a `Color` from
 * `parseColor`, which this package re-exports; `onChange` is handed the
 * `Color`, `null` for an empty field.
 *
 * ```tsx
 * <ColorField defaultValue="#6750A4" label="Label" />
 * ```
 *
 * Without `channel` the field holds the whole colour as hex and reads what
 * is typed once it loses focus; with one it holds that channel alone as a
 * number. `colorSpace` decides which space a channel belongs to, the same as
 * on `ColorSlider`.
 *
 * React Native's own `TextInput` props, the return key among them, reach the
 * control; `style` and `ref` are the field as a whole, and `inputRef` the
 * control.
 *
 * Inside a `ColorPicker` it takes the picker's colour where it is given no
 * `value`, and reports a change to the picker before its own `onChange`.
 */
function ColorField({ channel, onChange, value, ...props }: ColorFieldProps) {
  const picked = usePickedColor(value, onChange)

  return channel === undefined ? (
    <HexField {...props} onChange={picked.onChange} value={picked.value} />
  ) : (
    <ChannelField
      {...props}
      channel={channel}
      onChange={picked.onChange}
      value={picked.value}
    />
  )
}

function colorOrNull(color: Color | null | string | undefined) {
  return color === null || color === undefined ? null : colorOf(color)
}

// Reads the text as the field's value, then hands the event on.
function commitBefore<Event>(
  state: TextState,
  handler: ((event: Event) => void) | undefined,
) {
  return (event: Event) => {
    state.commit()
    handler?.(event)
  }
}

// The text typed, kept only where it could still become a value, and
// reported to the field's validation as an edit.
function editInto(state: TextState, onEdit: () => void) {
  return (text: string) => {
    if (state.validate(text)) {
      state.setInputValue(text)
      onEdit()
    }
  }
}

/**
 * The box either kind of field draws: the label, the control holding the
 * text, the icons at its ends and the line under it.
 */
function FieldShell({
  color,
  description,
  error,
  floatingLabel = true,
  inputRef,
  isDisabled = false,
  isEmpty,
  isReadOnly = false,
  isRequired = false,
  keyboardType,
  label,
  leadingIcon,
  name,
  onBlur,
  onFocus,
  onSubmitEditing,
  ref,
  returnKeyType = 'done',
  state,
  style,
  submitted,
  trailingIcon,
  validate,
  variant = 'filled',
  ...props
}: FieldShellProps) {
  const id = useId()
  const control = useRef<ComponentRef<typeof TextInput>>(null)
  const validation = useFieldValidation({
    control,
    error,
    isDisabled,
    isEmpty,
    isReadOnly,
    isRequired,
    name,
    submitted,
    validate,
    value: color,
  })
  const shownError = validation.error
  const focus = useFieldFocus({
    onBlur: commitBefore<BlurEvent>(state, blurThen(validation.onBlur, onBlur)),
    onFocus,
  })

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
        isPopulated={state.inputValue !== ''}
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
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          described={describedBy(id, { description, error: shownError })}
          editable={!isDisabled && !isReadOnly}
          keyboardType={keyboardType}
          onChangeText={editInto(state, validation.onEdit)}
          onSubmitEditing={commitBefore<TextInputSubmitEditingEvent>(
            state,
            onSubmitEditing,
          )}
          ref={control}
          returnKeyType={returnKeyType}
          spellCheck={false}
          value={state.inputValue}
        />
      </FieldBox>
      <FieldMessage description={description} error={shownError} id={id} />
    </View>
  )
}

/** The whole colour as hex, through React Stately's colour field state. */
function HexField({
  defaultValue,
  onChange,
  value,
  ...props
}: Omit<ColorFieldProps, 'channel'>) {
  const state = useColorFieldState({ defaultValue, onChange, value })

  return (
    <FieldShell
      {...props}
      color={state.colorValue}
      isEmpty={state.colorValue === null}
      keyboardType="default"
      state={state}
      submitted={state.inputValue}
    />
  )
}

function inSpace(color: Color, space: ColorSpace | undefined) {
  return space === undefined ? color : color.toFormat(space)
}

export { ColorField }
export type { ColorFieldProps }
