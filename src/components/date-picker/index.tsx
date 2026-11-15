import type { DateDuration } from '@internationalized/date'
import type { ComponentRef, ReactNode, Ref } from 'react'
import type { HostInstance, StyleProp, View, ViewStyle } from 'react-native'
import type {
  DateValue,
  DatePickerStateOptions as StatelyDatePickerProps,
} from 'react-stately/useDatePickerState'

import {
  createCalendar,
  DateFormatter,
  toCalendarDate,
} from '@internationalized/date'
import { useRef, useState } from 'react'
import { View as NativeView, StyleSheet } from 'react-native'
import { useDateFieldState } from 'react-stately/useDateFieldState'
import { useDatePickerState } from 'react-stately/useDatePickerState'

import type { FieldVariant } from '../../field'

import { useWindowSizeClass } from '../../hooks/useWindowSizeClass'
import { messagesFor } from '../../i18n'
import { useLocaleOf } from '../../i18n/provider'
import { PickerPopup, PickerTrigger } from '../../picker'
import { fieldClockOf } from '../../segments/clock'
import { SegmentedField } from '../../segments/field'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'
import { Button } from '../button'
import { Calendar } from '../calendar'
import { Text } from '../text'

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
// **The modal is the page's modal picker, not the docked calendar centred**,
// as on web. In a compact window the calendar opens under the modal's
// header, `Select date` in label large over the date held in headline large,
// both on surface variant, in a 120dp header padded 24dp at its start, 12dp
// at its end, 16dp above and 12dp below, with an outline variant divider
// under it, and over the Cancel and OK text buttons at the actions' end. A
// date picked there is a draft: it moves the headline and the selection and
// nothing else, OK writes it into the field, and Cancel, the back gesture or
// a press on the scrim close the modal with the field as it was. Docked, the
// header and the actions are not drawn and a pick is the answer. Two
// departures from the page's modal, web's: no button switching the modal to
// a text input, since the field under the scrim is that input, and with
// nothing yet picked an empty headline, the header keeping its height.
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
   * What the modal's dismissing action says. Left out, it is the word for
   * cancel in the locale.
   */
  readonly cancelLabel?: string
  /**
   * What the modal's confirming action says. Left out, it is the word for
   * OK in the locale.
   */
  readonly confirmLabel?: string
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
   * The modal's supporting text, above the date it holds. Left out, it is
   * the locale's, "Select date" in English.
   */
  readonly selectDateLabel?: string
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
 * the field; below it, it opens centred over a scrim as the page's modal
 * picker, under a headline holding the date picked, and only OK writes that
 * date into the field. `cancelLabel`, `confirmLabel` and `selectDateLabel`
 * name its two actions and its supporting text, as on web.
 *
 * `style`, `ref` and `testID` land on the picker as a whole.
 */
function DatePicker<T extends DateValue = DateValue>({
  cancelLabel,
  confirmLabel,
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
  selectDateLabel,
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
    ...fieldClockOf(writtenIn, props.hourCycle),
    maxValue,
    minValue,
    onChange: setValue,
    placeholderValue,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the picker's `validate` takes the value its own type maps to, which is the field's too
    validate: validate as StatelyDatePickerProps<DateValue>['validate'],
    value: state.value,
  })
  const messages = messagesFor(writtenIn)
  const name = `${triggerLabel ?? messages.segments.calendar} ${label}`

  return (
    <>
      <SegmentedField
        {...props}
        box={box}
        errors={field.realtimeValidation.validationErrors}
        isDisabled={isDisabled}
        isEmpty={field.value === null}
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
        <DatePickerSurface
          cancelLabel={cancelLabel ?? messages.cancel}
          close={close}
          commit={setDateValue}
          confirmLabel={confirmLabel ?? messages.confirm}
          locale={writtenIn}
          selectDateLabel={selectDateLabel ?? messages.selectDate}
          value={state.dateValue}
        >
          {(held, pick) => (
            <Calendar
              aria-label={label}
              defaultFocusedValue={held === null ? placeholderValue : undefined}
              firstDayOfWeek={firstDayOfWeek}
              isDateUnavailable={isDateUnavailable}
              isDisabled={isDisabled}
              isReadOnly={isReadOnly}
              locale={writtenIn}
              maxValue={maxValue}
              minValue={minValue}
              onChange={pick}
              showMonthYearMenus={showMonthYearMenus}
              value={held}
              visibleDuration={visibleDuration}
            />
          )}
        </DatePickerSurface>
      </PickerPopup>
    </>
  )
}

// The button for the box's trailing slot. A call rather than JSX written at
// the prop, which is what react-perf's jsx-no-jsx-as-prop is after.
function triggerOf(props: Parameters<typeof PickerTrigger>[0]) {
  return <PickerTrigger {...props} />
}

// The modal's measurements that are its own rather than the scale's: the
// header's height, the page's.
const HEADER_HEIGHT = 120

const surfaceStylesOf = themedStyles(({ colors, spacing }) =>
  StyleSheet.create({
    // Cancel and OK at the actions' end, 8dp apart, with the calendar's own
    // inline padding after them and 8dp under them.
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'flex-end',
      paddingBottom: spacing.sm,
      paddingEnd: spacing.md,
    },
    header: {
      borderBottomColor: colors.outlineVariant,
      borderBottomWidth: 1,
      height: HEADER_HEIGHT,
      justifyContent: 'space-between',
      paddingBottom: spacing.md,
      paddingEnd: spacing.md,
      paddingStart: spacing.xl,
      paddingTop: spacing.lg,
    },
  }),
)

// OK: writes the draft into the field, and closes the modal.
function confirmOf(
  draft: DateValue | null,
  commit: (date: DateValue) => void,
  close: () => void,
) {
  return () => {
    if (draft !== null) {
      commit(draft)
    }
    close()
  }
}

/**
 * What the calendar's surface holds, mounted each time it opens: in a compact
 * window the modal picker's header, the calendar and its actions, with the
 * date it was opened on as its draft, which a pick moves and OK writes into
 * the field; docked, the calendar alone, where a pick is the answer.
 */
function DatePickerSurface({
  cancelLabel,
  children,
  close,
  commit,
  confirmLabel,
  locale,
  selectDateLabel,
  value,
}: {
  readonly cancelLabel: string
  /** The calendar, given the date it holds and what a pick does. */
  readonly children: (
    held: DateValue | null,
    pick: (date: DateValue) => void,
  ) => ReactNode
  readonly close: () => void
  readonly commit: (date: DateValue) => void
  readonly confirmLabel: string
  readonly locale: string
  readonly selectDateLabel: string
  readonly value: DateValue | null
}): ReactNode {
  const own = surfaceStylesOf(useTheme())
  const modal = useWindowSizeClass() === 'compact'
  const [draft, setDraft] = useState(value)

  if (!modal) {
    return children(value, commit)
  }

  return (
    <>
      <NativeView style={own.header}>
        <Text tone="muted" variant="labelLarge">
          {selectDateLabel}
        </Text>
        <Text tone="muted" variant="headlineLarge">
          {draft === null ? '' : headlineOf(draft, locale)}
        </Text>
      </NativeView>
      {children(draft, setDraft)}
      <NativeView style={own.actions}>
        <Button onPress={close} variant="text">
          {cancelLabel}
        </Button>
        <Button onPress={confirmOf(draft, commit, close)} variant="text">
          {confirmLabel}
        </Button>
      </NativeView>
    </>
  )
}

// The date the modal holds, as web's headline writes it: "Tue, Sep 15" in
// English.
function headlineOf(date: DateValue, locale: string) {
  return new DateFormatter(locale, {
    calendar: date.calendar.identifier,
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    weekday: 'short',
  }).format(toCalendarDate(date).toDate('UTC'))
}

export type { DatePickerProps }

export { DatePicker }
