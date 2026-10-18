import type { DateDuration } from '@internationalized/date'
import type { ComponentRef, ReactNode, Ref } from 'react'
import type { HostInstance, StyleProp, View, ViewStyle } from 'react-native'
import type { DateFieldStateOptions } from 'react-stately/useDateFieldState'
import type {
  DateRange,
  DateRangePickerState,
  DateValue,
  DateRangePickerStateOptions as StatelyDateRangePickerProps,
} from 'react-stately/useDateRangePickerState'

import { createCalendar } from '@internationalized/date'
import { useRef, useState } from 'react'
import { useDateFieldState } from 'react-stately/useDateFieldState'
import { useDateRangePickerState } from 'react-stately/useDateRangePickerState'

import type { FieldVariant } from '../../field'

import { messagesFor } from '../../i18n'
import { useLocaleOf } from '../../i18n/provider'
import { PickerPopup, PickerTrigger } from '../../picker'
import { SegmentedField } from '../../segments/field'
import { RangeCalendar } from '../range-calendar'

// kanso-ui's DateRangePicker: DatePicker picking two dates rather than one.
// Every part it draws is already here, the segments from src/segments, the
// button and the surface from src/picker and the calendar RangeCalendar, so
// the two pickers cannot come apart. What a range adds is a second date's
// segments and the dash between the two.
//
// The date pickers page draws a range only as the modal picker, and carries
// no docked range picker and no token of its own for one. So the docked
// shape here follows the docked single picker, as web's does and as
// RangeCalendar does for the band it draws: docked under the field from the
// medium window size up, and modal in a compact window.
//
// The state is React Stately's `useDateRangePickerState`, which web's React
// Aria picker is built on, with a date field's state for each end that reads
// and writes its half of the range, as React Aria wires its two fields.
//
// Three things are this component's own, as on web.
//
// **The dash is decoration, not content.** It reads as a range to someone
// looking, and every segment is already named for its date, "Start Date" or
// "End Date" before the label in React Aria's words, so a screen reader
// hearing the dash as well would be told a third time. It is hidden from
// one, in the segments' muted role.
//
// **Both dates and the button are one field.** The box draws once around
// all three, focus runs on from the start's last segment to the end's
// first, and focus moving between the two is not focus leaving the field.
// Each date's first segment reads the whole range after its name, "Selected
// Range" in React Aria's words, once both dates are filled.
//
// **The range is picked in the calendar with two presses**, one on each
// end, and picking it closes the calendar, unless `shouldCloseOnSelect`
// says otherwise. A screen reader goes to the range's start as the calendar
// opens, or to the date it opens on, and back to the button once it has
// gone.

type DateRangePickerProps<T extends DateValue = DateValue> = Pick<
  StatelyDateRangePickerProps<T>,
  | 'allowsNonContiguousRanges'
  | 'defaultOpen'
  | 'defaultValue'
  | 'endName'
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
  | 'startName'
  | 'validate'
  | 'value'
> & {
  /**
   * A hint shown under the field. Replaced by `error` when there is one, so
   * the two never stack.
   */
  readonly description?: string
  /**
   * The problem with the current range, in words. Its presence is what puts
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
   * Draws the picker disabled: neither date takes input and the calendar
   * does not open.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * Shows the range and takes focus, but takes no input, and the calendar
   * does not open.
   * @default false
   */
  readonly isReadOnly?: boolean
  /**
   * Marks the label with an asterisk, as the text fields page marks a field
   * that must be filled. Inside a `Form` that validates natively, both dates
   * must be.
   * @default false
   */
  readonly isRequired?: boolean
  /**
   * What the field is for, and the name a screen reader reads for it, after
   * each segment's own and its date's. It names the calendar too, and the
   * button opening it after that button's own name.
   */
  readonly label: string
  /**
   * An icon at the start of the box, before the label and the segments: the
   * page's 24dp leading icon, in the muted role. The slot hands it that
   * colour and size through `useIconStyle()`.
   */
  readonly leadingIcon?: ReactNode
  /**
   * The BCP 47 locale the dates are written and typed in, and the calendar
   * drawn in: the order of the segments, their placeholders, the month and
   * weekday names, the digits and the calendar system. Defaults to the
   * `I18nProvider`'s, or the device's outside one.
   */
  readonly locale?: string
  /** Called as focus leaves the field, once it has filled what it can. */
  readonly onBlur?: () => void
  /** Called as focus arrives in the field, at whichever segment. */
  readonly onFocus?: () => void
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * What is drawn between the two dates. Decoration: a screen reader hears
   * which date each segment is part of instead.
   * @default '–'
   */
  readonly separator?: string
  /**
   * Whether the calendar's header draws the month and the year as menu
   * buttons, each opening a list of them in the grid's place, as the docked
   * date picker's header does: see `RangeCalendar`.
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
   * other below it, which is what a range is usually picked from: see
   * `RangeCalendar`.
   * @default { months: 1 }
   */
  readonly visibleDuration?: DateDuration
}

// What each end's field shares with the other, as React Aria hands both of
// its fields the same props.
type EndOptions = Pick<
  DateFieldStateOptions,
  | 'granularity'
  | 'hideTimeZone'
  | 'hourCycle'
  | 'isDisabled'
  | 'isReadOnly'
  | 'isRequired'
  | 'locale'
  | 'placeholderValue'
  | 'shouldForceLeadingZeros'
>

// The range the calendar holds: the one the picker has chosen, which React
// Stately keeps whole or not at all, though its type leaves either end open.
function chosenOf(state: DateRangePickerState): DateRange | null {
  const { dateRange } = state

  return dateRange?.start == null || dateRange.end == null
    ? null
    : { end: dateRange.end, start: dateRange.start }
}

/**
 * A date range typed into a field, or picked from a calendar behind a
 * button. The value is a `{ start, end }` pair of `@internationalized/date`
 * values, as on web: pass `value` with `onChange` to control it, or
 * `defaultValue` to let it keep its own. `onChange` is called once both
 * dates are filled.
 *
 * ```tsx
 * import { CalendarDate } from '@internationalized/date'
 *
 * <DateRangePicker
 *   defaultValue={{
 *     end: new CalendarDate(2026, 9, 20),
 *     start: new CalendarDate(2026, 9, 15),
 *   }}
 *   label="Label"
 * />
 * ```
 *
 * The segments are DateField's and the calendar is RangeCalendar, so
 * `granularity`, `minValue`, `maxValue` and `isDateUnavailable` behave as
 * they do there. From the medium window size up the calendar is docked to
 * the field; below it, it opens centred over a scrim, the same swap
 * DatePicker makes.
 *
 * `style`, `ref` and `testID` land on the picker as a whole.
 */
function DateRangePicker<T extends DateValue = DateValue>({
  allowsNonContiguousRanges,
  defaultOpen,
  defaultValue,
  endName,
  firstDayOfWeek,
  granularity,
  hideTimeZone,
  hourCycle,
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
  separator = '–',
  shouldCloseOnSelect,
  shouldForceLeadingZeros,
  showMonthYearMenus = false,
  startName,
  triggerLabel,
  validate,
  value,
  visibleDuration,
  ...props
}: DateRangePickerProps<T>) {
  const writtenIn = useLocaleOf(locale)
  const words = messagesFor(writtenIn).segments
  const box = useRef<HostInstance>(null)
  const [trigger, setTrigger] = useState<HostInstance | null>(null)
  const state = useDateRangePickerState<T>({
    allowsNonContiguousRanges,
    defaultOpen,
    defaultValue,
    granularity,
    hideTimeZone,
    hourCycle,
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
    shouldForceLeadingZeros,
    validate,
    value,
  })
  // oxlint-disable-next-line typescript/unbound-method -- React Stately's setters are callbacks, and read no `this`
  const { close, open, setDateRange } = state
  const ends: EndOptions = {
    granularity,
    hideTimeZone,
    hourCycle,
    isDisabled,
    isReadOnly,
    isRequired,
    locale: writtenIn,
    placeholderValue,
    shouldForceLeadingZeros,
  }
  const start = useDateFieldState({
    ...ends,
    createCalendar,
    onChange: (date) => {
      state.setDateTime('start', date)
    },
    value: state.value.start,
  })
  const end = useDateFieldState({
    ...ends,
    createCalendar,
    onChange: (date) => {
      state.setDateTime('end', date)
    },
    value: state.value.end,
  })
  const range = state.formatValue(writtenIn, { month: 'long' })
  const name = `${triggerLabel ?? words.calendar} ${label}`

  return (
    <>
      <SegmentedField
        {...props}
        box={box}
        end={end}
        endName={endName}
        endSubmitted={state.value.end?.toString() ?? ''}
        errors={state.realtimeValidation.validationErrors}
        holding={
          range === null
            ? ''
            : words.selectedRange
                .replace('{startDate}', range.start)
                .replace('{endDate}', range.end)
        }
        isDisabled={isDisabled}
        isEmpty={state.value.start === null || state.value.end === null}
        isReadOnly={isReadOnly}
        isRequired={isRequired}
        label={label}
        locale={writtenIn}
        name={startName}
        separator={separator}
        state={start}
        submitted={state.value.start?.toString() ?? ''}
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
        <RangeCalendar
          allowsNonContiguousRanges={allowsNonContiguousRanges}
          aria-label={label}
          defaultFocusedValue={
            state.dateRange === null ? placeholderValue : undefined
          }
          firstDayOfWeek={firstDayOfWeek}
          isDateUnavailable={isDateUnavailable}
          isDisabled={isDisabled}
          isReadOnly={isReadOnly}
          locale={writtenIn}
          maxValue={maxValue}
          minValue={minValue}
          onChange={setDateRange}
          showMonthYearMenus={showMonthYearMenus}
          value={chosenOf(state)}
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

export type { DateRangePickerProps }

export { DateRangePicker }
