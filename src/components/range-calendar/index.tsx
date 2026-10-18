import type { DateDuration } from '@internationalized/date'
import type { ComponentRef, Ref } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type {
  DateValue,
  RangeCalendarProps as StatelyRangeCalendarProps,
} from 'react-stately/useRangeCalendarState'

import { createCalendar } from '@internationalized/date'
import { View } from 'react-native'
import { useRangeCalendarState } from 'react-stately/useRangeCalendarState'

import { CalendarFrame, useRootStyle, visibleRangeOf } from '../../calendar'
import { useLocaleOf } from '../../i18n/provider'
import { composeStyles } from '../../theme/styles'

// kanso-ui's RangeCalendar: the date pickers page's calendar again, picking
// two dates rather than one. Every part it draws is Calendar's, from
// src/calendar, the container, the header, the month and year menus, the
// grid and the date cell, so the two cannot come apart.
//
// What a range adds is the band between its two ends. The docked token set
// stops at the selected date, so the band's colours are the modal date
// picker's range-selection tokens: the secondary container, one step down
// from the primary the two ends take, with its label in on secondary
// container and its state layers in on primary container. Two things follow
// from drawing a band across a grid whose dates are spaced apart, as on web.
//
// **The band is square and the ends are round.** A run of days reads as one
// shape rather than a row of circles, and the first and last day round only
// their outer side, which is what makes the band begin and end at a circle.
// The sides are logical, so a right-to-left layout turns the band over.
//
// **The band fills the whole of each day's column.** A day in the range
// drops the 4dp either side that every other date keeps and takes the full
// width of its column, so one day's band meets the next one's.
//
// The state is React Stately's `useRangeCalendarState`, which web's React
// Aria range calendar is built on. A first press starts the range and a
// second ends it, on either side of the first. While a range is started a
// pointer over a date draws the range as far as it, as web's does; a touch
// has no such preview, so on a phone the band shows once the second date is
// pressed. A date `isDateUnavailable` rules out is struck through, and once
// a range is started the dates past it are disabled, unless
// `allowsNonContiguousRanges` lets the range run over it.
//
// Each date's name is React Aria's: the two ends open with the whole range,
// a day inside it is said to be selected, and each date's hint says whether
// a press starts a range or ends the one started.

type RangeCalendarProps<T extends DateValue = DateValue> = Pick<
  StatelyRangeCalendarProps<T>,
  | 'allowsNonContiguousRanges'
  | 'defaultFocusedValue'
  | 'defaultValue'
  | 'firstDayOfWeek'
  | 'focusedValue'
  | 'isDateUnavailable'
  | 'isDisabled'
  | 'isReadOnly'
  | 'maxValue'
  | 'minValue'
  | 'onChange'
  | 'onFocusChange'
  | 'value'
> & {
  /**
   * The calendar's name. The month shown, or the months, is added to it, as
   * React Aria adds it on web.
   */
  readonly 'aria-label'?: string
  /**
   * The BCP 47 locale the calendar is written in: its month and weekday
   * names, its digits, its first day of the week and its calendar system.
   * Defaults to the `I18nProvider`'s, or the device's outside one.
   */
  readonly locale?: string
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * Whether the header draws the month and the year as menu buttons, each
   * opening a list of them in the grid's place, as `Calendar`'s does. The
   * year list runs a century either side of the year shown, or to
   * `minValue` and `maxValue` where they are closer.
   *
   * For one visible month. With `visibleDuration` of more than one, the
   * header is the plain one, whose heading names every month shown, since
   * the menus name only the first.
   * @default false
   */
  readonly showMonthYearMenus?: boolean
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
  /**
   * How many months the calendar shows at once, and moves by: side by side
   * from the expanded window size up, one under another below it. Only
   * `months` is read.
   * @default { months: 1 }
   */
  readonly visibleDuration?: DateDuration
}

/**
 * A calendar for picking a range of dates. The value is a `{ start, end }`
 * pair of `@internationalized/date` values, as on web: pass `value` with
 * `onChange` to control it, or `defaultValue` to let it keep its own.
 *
 * ```tsx
 * import { CalendarDate } from '@internationalized/date'
 *
 * <RangeCalendar
 *   aria-label="Label"
 *   defaultValue={{
 *     start: new CalendarDate(2026, 9, 8),
 *     end: new CalendarDate(2026, 9, 15),
 *   }}
 * />
 * ```
 *
 * The two ends take the circle a selected date takes in `Calendar`, and the
 * days between them a band in the secondary container. `minValue`,
 * `maxValue`, `isDateUnavailable` and `visibleDuration` are the props
 * `Calendar` takes, and `allowsNonContiguousRanges` lets a range run past
 * the dates ruled out inside it rather than stopping at the first.
 *
 * `style`, `ref` and `testID` land on the container.
 */
function RangeCalendar<T extends DateValue = DateValue>({
  'aria-label': ariaLabel,
  locale,
  ref,
  showMonthYearMenus = false,
  style,
  testID,
  visibleDuration,
  ...props
}: RangeCalendarProps<T>) {
  const writtenIn = useLocaleOf(locale)
  const months = Math.max(1, visibleDuration?.months ?? 1)
  const rootStyle = useRootStyle(months)
  const state = useRangeCalendarState<T>({
    ...props,
    createCalendar,
    locale: writtenIn,
    visibleDuration: { months },
  })
  const shown = visibleRangeOf(state, writtenIn, true)

  return (
    <View
      aria-label={ariaLabel === undefined ? shown : `${ariaLabel}, ${shown}`}
      ref={ref}
      role="group"
      style={composeStyles<ViewStyle>(rootStyle, style)}
      testID={testID}
    >
      <CalendarFrame
        firstDayOfWeek={props.firstDayOfWeek}
        locale={writtenIn}
        months={months}
        showMonthYearMenus={showMonthYearMenus}
        state={state}
      />
    </View>
  )
}

export type { RangeCalendarProps }

export { RangeCalendar }
