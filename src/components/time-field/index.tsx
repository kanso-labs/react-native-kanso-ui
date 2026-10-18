import type {
  TimeFieldStateOptions,
  TimeValue,
} from 'react-stately/useTimeFieldState'

import { useTimeFieldState } from 'react-stately/useTimeFieldState'

import type { DateFieldProps } from '../date-field'

import { useLocaleOf } from '../../i18n/provider'
import { SegmentedField } from '../../segments/field'

// kanso-ui's TimeField: a time typed a segment at a time. Every part of it is
// DateField's, from src/segments, the segments, the muted placeholders, the
// filled focus and the punctuation between them, and the box around them, so
// a time on a form and a date on the same form cannot come apart.
//
// What differs is the value it holds and nothing else. The time pickers page
// gives its input the text field's own box, which is what the shared field
// chrome already draws, so there is no measurement here that DateField's
// comment does not already name.
//
// **Twelve or twenty-four hours is the locale's.** React Stately decides from
// the locale whether there is a day-period segment at all, so a field under
// `en-GB` shows a 24-hour clock and the same field under `en-US` shows AM and
// PM, in the locale's own words for the two. `hourCycle` is React Stately's
// own, for a screen that has to set the clock whatever the locale.

type TimeFieldProps<T extends TimeValue = TimeValue> = Omit<
  DateFieldProps,
  | 'defaultValue'
  | 'granularity'
  | 'hideTimeZone'
  | 'hourCycle'
  | 'isDateUnavailable'
  | 'locale'
  | 'maxValue'
  | 'minValue'
  | 'name'
  | 'onChange'
  | 'placeholderValue'
  | 'shouldForceLeadingZeros'
  | 'validate'
  | 'value'
> &
  Pick<
    TimeFieldStateOptions<T>,
    | 'defaultValue'
    | 'granularity'
    | 'hideTimeZone'
    | 'hourCycle'
    | 'maxValue'
    | 'minValue'
    | 'onChange'
    | 'placeholderValue'
    | 'shouldForceLeadingZeros'
    | 'validate'
    | 'value'
  > & {
    /**
     * The BCP 47 locale the time is written and typed in: whether it has a
     * day period and what that is called, its placeholders and its digits.
     * Defaults to the `I18nProvider`'s, or the device's outside one.
     */
    readonly locale?: string
    /**
     * The name the value is submitted under by the `Form` around the field,
     * and the key its `validationErrors` reach the field by. The form submits
     * the time written out as ISO 8601, such as `09:30:00`, and `''` for an
     * empty field.
     */
    readonly name?: string
  }

/**
 * A time typed rather than picked: one segment per part, typed into a digit
 * at a time. The value is an `@internationalized/date` `Time`, as on web:
 * pass `value` with `onChange` to control it, or `defaultValue` to let it
 * keep its own.
 *
 * ```tsx
 * import { Time } from '@internationalized/date'
 *
 * <TimeField defaultValue={new Time(9, 30)} label="Label" />
 * ```
 *
 * Whether it shows a twelve or twenty-four hour clock is the locale's,
 * through the `I18nProvider`. `granularity` takes it down to seconds or up
 * to hours, and `minValue` and `maxValue` bound what may be typed, an error
 * under the field saying so in React Aria's words where a time is outside
 * them.
 *
 * The segments, the box, the label and the message are DateField's.
 * `style`, `ref` and `testID` land on the field as a whole.
 */
function TimeField<T extends TimeValue = TimeValue>({
  isDisabled = false,
  isReadOnly = false,
  isRequired = false,
  locale,
  ...props
}: TimeFieldProps<T>) {
  const writtenIn = useLocaleOf(locale)
  const state = useTimeFieldState<T>({
    ...props,
    isDisabled,
    isReadOnly,
    isRequired,
    locale: writtenIn,
  })

  return (
    <SegmentedField
      {...props}
      errors={state.realtimeValidation.validationErrors}
      isDisabled={isDisabled}
      isEmpty={state.value === null}
      isReadOnly={isReadOnly}
      isRequired={isRequired}
      locale={writtenIn}
      state={state}
      // The time alone, as web's field submits it, rather than the date and
      // time React Stately keeps it as underneath.
      submitted={state.value === null ? '' : state.timeValue.toString()}
    />
  )
}

export type { TimeFieldProps }

export { TimeField }
