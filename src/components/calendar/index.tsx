import type { ComponentRef, Ref } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type {
  DateValue,
  CalendarProps as StatelyCalendarProps,
} from 'react-stately/useCalendarState'

import { createCalendar } from '@internationalized/date'
import { View } from 'react-native'
import { useCalendarState } from 'react-stately/useCalendarState'

import { CalendarFrame, visibleMonthOf } from '../../calendar'
import { stylesOf } from '../../calendar/styles'
import { localeOf } from '../../number/locale'
import { useTheme } from '../../theme/scope'
import { composeStyles } from '../../theme/styles'

// kanso-ui's Calendar, the date pickers page's docked calendar: a month grid
// with a circle on the selected date and an outline on today. Its values are
// that page's: a 360dp container on the high surface container, 48dp date
// cells with a 40dp state layer inside them, body large for both the weekday
// row and the dates, and primary for the selected circle and for today's
// outline. The parts are in src/calendar.
//
// The state is React Stately's `useCalendarState`, which web's React Aria
// calendar is built on, over `@internationalized/date`, so the selection,
// the bounds and the locale's calendar, first day of the week and digits
// behave as they do on web.
//
// The page's container is 456dp tall, which this does not take: that height
// is a picker's, counting a headline and an action row the calendar itself
// does not draw. What is held instead is the grid, at six weeks, the most any
// month occupies, so the calendar keeps its height as the month moves and a
// shorter month leaves its last rows empty.
//
// `showMonthYearMenus` draws the page's docked header instead of one heading:
// the month's menu button between the chevrons that step it and the year's
// after them, each opening its list where the grid was, as web's does. The
// page draws the lists there, and a calendar inside a picker is already in
// a panel, so a menu over it would be a panel over a panel.
//
// Five things are this component's own, as on web.
//
// **The year menu has no chevrons of its own.** The page draws a pair either
// side of it that step a year; the year list reaches any year within a
// century of the one shown in one press, or any the bounds allow where they
// are closer.
//
// **The cell is a circle in a square.** The page gives the date a 48dp
// container and a 40dp state layer, which is a 40dp circle with 4dp of room
// around it. The circle is the pressable, centred in a 48dp column and a 48dp
// row, and its `hitSlop` reaches the 4dp past it on every side, so the whole
// square takes the press. The chevrons and the menu buttons reach a 48dp
// target the same way.
//
// **It narrows to its container.** The page's docked calendar is 360dp, and
// a compact window leaves 328dp between its margins, so the calendar is 360
// at most and the columns share whatever is left below that.
//
// **A date from the month either side is faded because it is disabled**, as
// React Aria disables those dates: the page's 38% either way. A date
// `isDateUnavailable` rules out is struck through at full contrast instead,
// since a reader can still land on it and has to read it.
//
// **Today reads as today whether or not it is selected.** The page gives it
// an outline and the primary label; selected gives it a filled circle and
// the on-primary label. A selected today takes the fill.
//
// Web's month changes at once. Here **the weeks slide in** from the side the
// new month comes from, Material Design's shared axis transition, and change
// at once under reduced motion.
//
// **The locale is a prop**, defaulting to the device's, where web reads it
// from React Aria's `I18nProvider`. The words the calendar writes, its
// chevrons' names and its dates', are React Aria's in that locale.

type CalendarProps<T extends DateValue = DateValue> = Pick<
  StatelyCalendarProps<T>,
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
   * The calendar's name. The month shown is added to it, as React Aria adds
   * it on web.
   */
  readonly 'aria-label'?: string
  /**
   * The BCP 47 locale the calendar is written in: its month and weekday
   * names, its digits, its first day of the week and its calendar system.
   * Defaults to the device's.
   */
  readonly locale?: string
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * Whether the header draws the month and the year as menu buttons, each
   * opening a list of them in the grid's place, as the docked date picker's
   * header does, rather than one heading between the chevrons. For a date
   * far from the one shown, such as a date of birth: the year list runs a
   * century either side of the year shown, or to `minValue` and `maxValue`
   * where they are closer.
   * @default false
   */
  readonly showMonthYearMenus?: boolean
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

/**
 * A month calendar for picking a date. The value is an
 * `@internationalized/date` value, as on web: pass `value` with `onChange` to
 * control it, or `defaultValue` to let it keep its own.
 *
 * ```tsx
 * import { getLocalTimeZone, today } from '@internationalized/date'
 *
 * <Calendar aria-label="Label" defaultValue={today(getLocalTimeZone())} />
 * ```
 *
 * `minValue` and `maxValue` bound it, and `isDateUnavailable` rules
 * individual dates out. Name it with `aria-label`; the month shown is added
 * to the name.
 *
 * `style`, `ref` and `testID` land on the container.
 */
function Calendar<T extends DateValue = DateValue>({
  'aria-label': ariaLabel,
  locale,
  ref,
  showMonthYearMenus = false,
  style,
  testID,
  ...props
}: CalendarProps<T>) {
  const writtenIn = localeOf(locale)
  const own = stylesOf(useTheme())
  const state = useCalendarState<T>({
    ...props,
    createCalendar,
    locale: writtenIn,
  })
  const month = visibleMonthOf(state, writtenIn)

  return (
    <View
      aria-label={ariaLabel === undefined ? month : `${ariaLabel}, ${month}`}
      ref={ref}
      role="group"
      style={composeStyles<ViewStyle>(own.root, style)}
      testID={testID}
    >
      <CalendarFrame
        firstDayOfWeek={props.firstDayOfWeek}
        locale={writtenIn}
        showMonthYearMenus={showMonthYearMenus}
        state={state}
      />
    </View>
  )
}

export type { CalendarProps }

export { Calendar }
