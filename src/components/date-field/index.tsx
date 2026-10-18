import type { ComponentRef, ReactNode, Ref } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type {
  DateFieldStateOptions,
  DateValue,
} from 'react-stately/useDateFieldState'

import { createCalendar } from '@internationalized/date'
import { useId, useRef, useState } from 'react'
import { View } from 'react-native'
import { useDateFieldState } from 'react-stately/useDateFieldState'

import type { FieldVariant } from '../../field'
import type { Focusable } from '../../form'

import { describedBy, FieldBox, FieldMessage } from '../../field'
import { useFieldValidation } from '../../form'
import { useLocaleOf } from '../../i18n/provider'
import { DateSegments } from '../../segments'

// kanso-ui's DateField: a date typed a segment at a time rather than picked
// from a calendar, which is what the date pickers page means by a date in a
// text field. The box, the label and the line under it are the field chrome
// in src/field, shared with every other field, so a date field on a form is
// the same box as the text field beside it. The segments are src/segments,
// which a time field and a picker's field draw as well.
//
// The value is React Stately's `useDateFieldState`, which web's React Aria
// field is built on, over `@internationalized/date`, so the segments, their
// order, the bounds and the calendar a locale counts in are web's.
//
// Three things are this component's own, as on web.
//
// **How many segments there are, and in what order, is the locale's.** A
// field under a British locale puts the day before the month, and a
// `granularity` of `minute` adds two more, so the segments are drawn from
// the state, never written out.
//
// **A segment not yet filled is muted, and the label floats from the start.**
// Each segment shows its own placeholder, `mm`, `dd` and `yyyy` in English,
// in the muted role, so a half-typed date reads as half-typed, and the label
// sits above them even while the field is empty rather than over them.
//
// **A focused segment is a filled shape rather than a caret**, in primary,
// since nothing else says which of the segments is being typed.
//
// **The locale is the `I18nProvider`'s**, as web reads it from React Aria's,
// unless the `locale` prop names another, and the device's under neither.

type DateFieldProps<T extends DateValue = DateValue> = Pick<
  DateFieldStateOptions<T>,
  | 'defaultValue'
  | 'granularity'
  | 'hideTimeZone'
  | 'hourCycle'
  | 'isDateUnavailable'
  | 'maxValue'
  | 'minValue'
  | 'onChange'
  | 'placeholderValue'
  | 'shouldForceLeadingZeros'
  | 'validate'
  | 'value'
> & {
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
   * what `validate`, the bounds and the form say.
   */
  readonly error?: string
  /**
   * Whether the label floats into the box's top, as the text fields page
   * draws a field holding a value. The segments always show, their
   * placeholders while empty, so it floats from the start. `false` keeps it
   * small at the top.
   * @default true
   */
  readonly floatingLabel?: boolean
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
   * What the field is for, and the name a screen reader reads for it, after
   * each segment's own. Required, since a field with no label is a box
   * nobody can name.
   */
  readonly label: string
  /**
   * An icon at the start of the box, before the label and the segments: the
   * page's 24dp leading icon, in the muted role. The slot hands it that
   * colour and size through `useIconStyle()`.
   */
  readonly leadingIcon?: ReactNode
  /**
   * The BCP 47 locale the date is written and typed in: the order of its
   * segments, their placeholders, its digits and its calendar system.
   * Defaults to the `I18nProvider`'s, or the device's outside one.
   */
  readonly locale?: string
  /**
   * The name the value is submitted under by the `Form` around the field,
   * and the key its `validationErrors` reach the field by. The form submits
   * the date written out as ISO 8601, such as `2026-09-15`, and `''` for an
   * empty field.
   */
  readonly name?: string
  /** Called as focus leaves the field, once it has filled what it can. */
  readonly onBlur?: () => void
  /** Called as focus arrives in the field, at whichever segment. */
  readonly onFocus?: () => void
  readonly ref?: Ref<ComponentRef<typeof View>>
  /** Positions and sizes the field as a whole. */
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
  /**
   * An icon at the end of the box, after the segments: the page's 24dp
   * trailing icon, in the muted role and the error role while the field has
   * an error. The slot hands it that colour and size through
   * `useIconStyle()`.
   */
  readonly trailingIcon?: ReactNode
  /**
   * The filled box, or the outlined one: no fill, an outline that thickens
   * and takes the primary role while focused, and the label cutting it, the
   * text fields page's two fields.
   * @default 'filled'
   */
  readonly variant?: FieldVariant
}

// The field's own blur handling, then the call site's.
function blurThen(
  onBlur: () => void,
  setFocused: (focused: boolean) => void,
  then: (() => void) | undefined,
) {
  return () => {
    setFocused(false)
    onBlur()
    then?.()
  }
}

/**
 * A date typed rather than picked: one segment per part, typed into a digit
 * at a time. The value is an `@internationalized/date` value, as on web:
 * pass `value` with `onChange` to control it, or `defaultValue` to let it
 * keep its own.
 *
 * ```tsx
 * import { CalendarDate } from '@internationalized/date'
 *
 * <DateField defaultValue={new CalendarDate(2026, 9, 15)} label="Label" />
 * ```
 *
 * How many segments there are and in what order is the locale's, through
 * the `I18nProvider`: `granularity` adds the time's segments, and `minValue`,
 * `maxValue` and `isDateUnavailable` say which dates are right, an error
 * under the field saying so in React Aria's words where they are not. On iOS
 * and Android a press on a segment raises the keyboard, and VoiceOver and
 * TalkBack step each segment with a swipe; under React Native Web each
 * segment is a spin button with React Aria's keys.
 *
 * The box, label and message are the field chrome in src/field, shared with
 * every other field. `style`, `ref` and `testID` land on the field as a
 * whole.
 */
function DateField<T extends DateValue = DateValue>({
  description,
  error,
  floatingLabel = true,
  isDisabled = false,
  isReadOnly = false,
  isRequired = false,
  label,
  leadingIcon,
  locale,
  name,
  onBlur,
  onFocus,
  ref,
  style,
  testID,
  trailingIcon,
  variant = 'filled',
  ...props
}: DateFieldProps<T>) {
  const id = useId()
  const control = useRef<Focusable>(null)
  const writtenIn = useLocaleOf(locale)
  const [focused, setFocused] = useState(false)
  const state = useDateFieldState<T>({
    ...props,
    createCalendar,
    isDisabled,
    isReadOnly,
    isRequired,
    locale: writtenIn,
  })
  // What `validate` says, and failing that what the bounds and
  // `isDateUnavailable` say, in React Stately's order and its words.
  const { validationErrors } = state.realtimeValidation
  const validation = useFieldValidation({
    control,
    error,
    isDisabled,
    isEmpty: state.value === null,
    isReadOnly,
    isRequired,
    name,
    submitted: state.value?.toString() ?? '',
    validate: () => validationErrors,
    value: state.value,
  })
  const shownError = validation.error

  return (
    <View
      aria-label={label}
      ref={ref}
      role="group"
      style={style}
      testID={testID}
    >
      <FieldBox
        control={control}
        floatingLabel={floatingLabel}
        isDisabled={isDisabled}
        isFocused={focused}
        isInvalid={shownError !== undefined}
        isPopulated
        isRequired={isRequired}
        label={label}
        leading={leadingIcon}
        trailing={trailingIcon}
        variant={variant}
      >
        <DateSegments
          described={describedBy(id, { description, error: shownError })}
          isInvalid={shownError !== undefined}
          label={label}
          locale={writtenIn}
          onBlur={blurThen(validation.onBlur, setFocused, onBlur)}
          onEdit={validation.onEdit}
          onFocus={focusThen(setFocused, onFocus)}
          ref={control}
          state={state}
        />
      </FieldBox>
      <FieldMessage description={description} error={shownError} id={id} />
    </View>
  )
}

// Draws the box focused, then tells the call site.
function focusThen(
  setFocused: (focused: boolean) => void,
  then: (() => void) | undefined,
) {
  return () => {
    setFocused(true)
    then?.()
  }
}

export type { DateFieldProps }

export { DateField }
