import type { DateValue } from '@internationalized/date'
import type { Meta, StoryObj } from '@storybook/react'

import {
  CalendarDate,
  getDayOfWeek,
  getLocalTimeZone,
  today,
} from '@internationalized/date'
import { StyleSheet, View } from 'react-native'

import { Calendar } from '.'

// Fixed months, so every story reads the same whenever it is opened. The
// calendar outlines today wherever it falls in view, so a fixed view holds
// still only once the month lies before today: September 2026, as web's
// stories show. The `Today` story is the one that asks for the real date,
// since what it shows is the outline today carries.
const SEPTEMBER = new CalendarDate(2026, 9, 15)
const MAX = new CalendarDate(2026, 9, 24)
const MIN = new CalendarDate(2026, 9, 8)

// Every story pins its locale, as Currency's do: without one the calendar is
// written in whatever locale the device or the browser is set to.
const LOCALE = 'en-US'

const styles = StyleSheet.create({
  // A compact window's content: 360dp less its two 16dp margins.
  compact: {
    width: 328,
  },
  locales: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
})

function isWeekend(date: DateValue) {
  const day = getDayOfWeek(date, LOCALE)
  return day === 0 || day === 6
}

const meta = {
  args: {
    'aria-label': 'Label',
    defaultValue: SEPTEMBER,
    locale: LOCALE,
  },
  component: Calendar,
  title: 'Components/Calendar',
} satisfies Meta<typeof Calendar>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// Its own story because the outline today carries is the one state that
// cannot be pinned to a fixed month: it moves with the day the story is read
// on, which is the point of it.
const Today: Story = {
  args: {
    defaultFocusedValue: today(getLocalTimeZone()),
    defaultValue: undefined,
  },
}

// Bounds change what a date looks like rather than where it is. A date
// outside `minValue` and `maxValue` fades to 38% and takes no press; one
// `isDateUnavailable` rules out, weekends here, is struck through at full
// contrast instead, since a reader can still land on it and has to read it.
const Bounded: Story = {
  args: {
    isDateUnavailable: isWeekend,
    maxValue: MAX,
    minValue: MIN,
  },
}

// The docked date picker's header: the month and the year as menu buttons,
// each opening its list in the grid's place, for a date far from the one
// shown.
const MonthAndYearMenus: Story = {
  args: {
    showMonthYearMenus: true,
  },
}

// Two months at once, for a date that may fall in either: side by side in an
// expanded window, one under the other below it, and the header naming both.
const TwoMonths: Story = {
  args: {
    visibleDuration: { months: 2 },
  },
}

// In a compact window's 328dp, under the page's 360dp docked calendar. The
// columns share what is left, so the calendar fits rather than running past
// the window's edge.
const Compact: Story = {
  render: (args) => (
    <View style={styles.compact}>
      <Calendar {...args} />
    </View>
  ),
}

// The same month in three more locales: German starts its week on Monday,
// Japanese writes its weekdays in kanji, and Arabic as Egypt writes it starts
// on Saturday and draws Arabic-Indic digits.
const Locales: Story = {
  render: (args) => (
    <View style={styles.locales}>
      <Calendar {...args} locale="de-DE" />
      <Calendar {...args} locale="ja-JP" />
      <Calendar {...args} locale="ar-EG" />
    </View>
  ),
}

export {
  Bounded,
  Compact,
  Default,
  Locales,
  MonthAndYearMenus,
  Today,
  TwoMonths,
}

export default meta
