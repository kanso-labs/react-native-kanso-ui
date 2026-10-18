import type { DateValue } from '@internationalized/date'
import type { Meta, StoryObj } from '@storybook/react'

import { CalendarDate, getDayOfWeek } from '@internationalized/date'

import { RangeCalendar } from '.'

// Fixed ranges, so every story reads the same whenever it is opened, in
// September 2026 as Calendar's stories are, before today so no outline moves
// into them. The second runs across a month's end, which is what two months
// at once are for.
const RANGE = {
  end: new CalendarDate(2026, 9, 15),
  start: new CalendarDate(2026, 9, 8),
}
const ACROSS = {
  end: new CalendarDate(2026, 10, 6),
  start: new CalendarDate(2026, 9, 24),
}
const MIN = new CalendarDate(2026, 9, 5)

// Every story pins its locale, as Calendar's do.
const LOCALE = 'en-US'

function isWeekend(date: DateValue) {
  const day = getDayOfWeek(date, LOCALE)
  return day === 0 || day === 6
}

const meta = {
  args: {
    'aria-label': 'Label',
    defaultValue: RANGE,
    locale: LOCALE,
  },
  component: RangeCalendar,
  title: 'Components/RangeCalendar',
} satisfies Meta<typeof RangeCalendar>

type Story = StoryObj<typeof meta>

// The band between the two ends in the secondary container, the ends in
// primary, each round on its outer side.
const Default: Story = {}

// Two months at once, for a range that runs across a month's end: side by
// side in an expanded window, one under the other below it.
const TwoMonths: Story = {
  args: {
    defaultValue: ACROSS,
    visibleDuration: { months: 2 },
  },
}

// Bounds, as Calendar's take them. A date before `minValue` fades and takes
// no press; the weekends `isDateUnavailable` rules out are struck through,
// and a range lets them in only with `allowsNonContiguousRanges`, as this
// one does, so the band gives way to them.
const Bounded: Story = {
  args: {
    allowsNonContiguousRanges: true,
    isDateUnavailable: isWeekend,
    minValue: MIN,
  },
}

// The docked date picker's header: the month and the year as menu buttons,
// each opening its list in the grid's place.
const MonthAndYearMenus: Story = {
  args: {
    showMonthYearMenus: true,
  },
}

export { Bounded, Default, MonthAndYearMenus, TwoMonths }

export default meta
