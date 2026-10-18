import type { DateDuration } from '@internationalized/date'
import type { ComponentRef, ReactNode, Ref } from 'react'
import type { HostInstance, StyleProp, View, ViewStyle } from 'react-native'
import type {
  DateValue,
  DatePickerStateOptions as StatelyDatePickerProps,
} from 'react-stately/useDatePickerState'

import { createCalendar } from '@internationalized/date'
import { useRef, useState } from 'react'
import { useDateFieldState } from 'react-stately/useDateFieldState'
import { useDatePickerState } from 'react-stately/useDatePickerState'

import type { FieldVariant } from '../../field'

import { messagesFor } from '../../i18n'
import { useLocaleOf } from '../../i18n/provider'
import { PickerPopup, PickerTrigger } from '../../picker'
import { SegmentedField } from '../../segments/field'
import { Calendar } from '../calendar'

// kanso-ui's DatePicker, the date pickers page's picker: the date field a
// date is typed into, with a calendar behind a button for picking it
// instead. Both halves already exist, the segments DateField's, from
// src/segments, and the calendar Calendar, so what this adds is the button
// between them and the surface the calendar opens on, both in src/picker,
// which DateRangePicker draws as well.
//
// The state is React Stately's `useDatePickerState`, which web's React Aria
// picker is built on: the field and the calendar both read and write its
// value, as React Aria wires them, so a date typed into the segments shows
// in the calendar and a date picked in the calendar fills the segments.
//
// Four things are this component's own, as on web.
//
// **The picker is one field, not a field beside a button.** The button sits
// in the box's trailing slot, so the box draws once around the segments and
// the button, and a reader moves through the segments and reaches the
// button at the end of them. It is named for opening the calendar and then
// by the field's label, "Calendar Label" in English, React Aria's words.
//
// **It is docked from the medium window size up and modal below it**, the
// pairing the page draws: in a compact window the calendar opens as a
// dialog, centred over a scrim, and from 600dp up it hangs under the field.
// The two are src/picker's, which says why.
//
// **Picking a date closes the calendar**, unless `shouldCloseOnSelect` says
// otherwise. A screen reader goes to the date held as the calendar opens,
// or to the one it opens on, and back to the button once it has gone, as
// web's focus does. A `granularity` with a time keeps the time the segments already
// hold, and fills a time not yet typed from `placeholderValue`.
//
// **The locale is the `I18nProvider`'s**, as web reads it from React Aria's,
// unless the `locale` prop names another, and the device's under neither.

type DatePickerProps<T extends DateValue = DateValue> = Pick<
  StatelyDatePickerProps<T>,
  | 'defaultOpen'
  | 'defaultValue'
  | 'firstDayOfWeek'
  | 'granularity'
  | 'hideTimeZone'
  | 'hourCycle'
  | 'isDateUnavailable'
  | 'isOpen'
  | 'maxValue'
  | 'minValue'
  | 'onChange'
  | 'onOpenChange'
  | 'placeholderValue'
  | 'shouldCloseOnSelect'
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
   * Draws the picker disabled: the field takes no input and the calendar
   * does not open.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * Shows the value and takes focus, but takes no input, and the calendar
   * does not open.
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
   * each segment's own. It names the calendar too, and the button opening
   * it after that button's own name.
   */
  readonly label: string
  /**
   * An icon at the start of the box, before the label and the segments: the
   * page's 24dp leading icon, in the muted role. The slot hands it that
   * colour and size through `useIconStyle()`.
   */
  readonly leadingIcon?: ReactNode
  /**
   * The BCP 47 locale the date is written and typed in, and the calendar
   * drawn in: the order of the segments, their placeholders, the month and
   * weekday names, the digits and the calendar system. Defaults to the
   * `I18nProvider`'s, or the device's outside one.
   */
  readonly locale?: string
  /**
   * The name the value is submitted under by the `Form` around the picker,
   * and the key its `validationErrors` reach it by. The form submits the
   * date written out as ISO 8601, such as `2026-09-15`, and `''` for an
   * empty picker.
   */
  readonly name?: string
  /** Called as focus leaves the field, once it has filled what it can. */
  readonly onBlur?: () => void
  /** Called as focus arrives in the field, at whichever segment. */
  readonly onFocus?: () => void
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * Whether the calendar's header draws the month and the year as menu
   * buttons, each opening a list of them in the grid's place, as the docked
   * date picker's header does: see `Calendar`.
   * @default false
   */
  readonly showMonthYearMenus?: boolean
  /** Positions and sizes the picker as a whole. */
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
  /**
   * What the button that opens the calendar is called, for a screen reader,
   * before the field's label. Left out, it is "Calendar" in the locale's
   * words, React Aria's.
   */
  readonly triggerLabel?: string
  /**
   * The filled box, or the outlined one, as the text fields page draws them.
   * @default 'filled'
   */
  readonly variant?: FieldVariant
  /**
   * How much of the calendar shows at once: `{ months: 2 }` draws two
   * months, side by side from the expanded window size up and one under the
   * other below it: see `Calendar`.
   * @default { months: 1 }
   */
  readonly visibleDuration?: DateDuration
}

/**
 * A date typed into a field, or picked from a calendar behind a button. The
 * value is an `@internationalized/date` value, as on web: pass `value` with
 * `onChange` to control it, or `defaultValue` to let it keep its own.
 *
 * ```tsx
 * import { CalendarDate } from '@internationalized/date'
 *
 * <DatePicker defaultValue={new CalendarDate(2026, 9, 15)} label="Label" />
 * ```
 *
 * The segments are DateField's and the calendar is Calendar, so
 * `granularity`, `minValue`, `maxValue` and `isDateUnavailable` behave as
 * they do there. From the medium window size up the calendar is docked to
 * the field; below it, it opens centred over a scrim, which is the page's
 * modal picker.
 *
 * `style`, `ref` and `testID` land on the picker as a whole.
 */
function DatePicker<T extends DateValue = DateValue>({
  defaultOpen,
  defaultValue,
  firstDayOfWeek,
  isDateUnavailable,
  isDisabled = false,
  isOpen,
  isReadOnly = false,
  isRequired = false,
  label,
  locale,
  maxValue,
  minValue,
  onChange,
  onOpenChange,
  placeholderValue,
  shouldCloseOnSelect,
  showMonthYearMenus = false,
  triggerLabel,
  validate,
  value,
  visibleDuration,
  ...props
}: DatePickerProps<T>) {
  const writtenIn = useLocaleOf(locale)
  const box = useRef<HostInstance>(null)
  const [trigger, setTrigger] = useState<HostInstance | null>(null)
  const state = useDatePickerState<T>({
    defaultOpen,
    defaultValue,
    granularity: props.granularity,
    isDateUnavailable,
    isDisabled,
    isOpen,
    isReadOnly,
    isRequired,
    maxValue,
    minValue,
    onChange,
    onOpenChange,
    placeholderValue,
    shouldCloseOnSelect,
    validate,
    value,
  })
  // oxlint-disable-next-line typescript/unbound-method -- React Stately's setters are callbacks, and read no `this`
  const { close, open, setDateValue, setValue } = state
  const field = useDateFieldState({
    ...props,
    createCalendar,
    isDateUnavailable,
    isDisabled,
    isReadOnly,
    isRequired,
    locale: writtenIn,
    maxValue,
    minValue,
    onChange: setValue,
    placeholderValue,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the picker's `validate` takes the value its own type maps to, which is the field's too
    validate: validate as StatelyDatePickerProps<DateValue>['validate'],
    value: state.value,
  })
  const name = `${triggerLabel ?? messagesFor(writtenIn).segments.calendar} ${label}`

  return (
    <>
      <SegmentedField
        {...props}
        box={box}
        isDisabled={isDisabled}
        isReadOnly={isReadOnly}
        isRequired={isRequired}
        label={label}
        locale={writtenIn}
        state={field}
        submitted={state.value?.toString() ?? ''}
        trailingIcon={triggerOf({
          isDisabled: isDisabled || isReadOnly,
          isOpen: state.isOpen,
          label: name,
          onPress: open,
          ref: setTrigger,
        })}
      />
      <PickerPopup
        anchor={box}
        close={close}
        isOpen={state.isOpen}
        label={name}
        trigger={trigger}
      >
        <Calendar
          aria-label={label}
          defaultFocusedValue={
            state.dateValue === null ? placeholderValue : undefined
          }
          firstDayOfWeek={firstDayOfWeek}
          isDateUnavailable={isDateUnavailable}
          isDisabled={isDisabled}
          isReadOnly={isReadOnly}
          locale={writtenIn}
          maxValue={maxValue}
          minValue={minValue}
          onChange={setDateValue}
          showMonthYearMenus={showMonthYearMenus}
          value={state.dateValue}
          visibleDuration={visibleDuration}
        />
      </PickerPopup>
    </>
  )
}

// The button for the box's trailing slot. A call rather than JSX written at
// the prop, which is what react-perf's jsx-no-jsx-as-prop is after.
function triggerOf(props: Parameters<typeof PickerTrigger>[0]) {
  return <PickerTrigger {...props} />
}

export type { DatePickerProps }

export { DatePicker }
