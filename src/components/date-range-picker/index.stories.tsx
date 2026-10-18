import type { Meta, StoryObj } from '@storybook/react'

import { CalendarDate } from '@internationalized/date'
import { StyleSheet, View } from 'react-native'

import { DateRangePicker } from '.'

// A fixed range, so every story reads the same whenever it is opened.
const RANGE = {
  end: new CalendarDate(2026, 9, 20),
  start: new CalendarDate(2026, 9, 15),
}
const MIN = new CalendarDate(2026, 9, 8)

// A range in February 2026 for the two-month story, so the months it shows
// are fixed and long past: September 2026 and the month after it would put
// whichever day is today in October on the page. February is also the
// four-week month, which shows the room each month holds when they stack.
const FEBRUARY = {
  end: new CalendarDate(2026, 2, 17),
  start: new CalendarDate(2026, 2, 10),
}

// Every story pins its locale, as DatePicker's do: without one the picker is
// written in whatever locale the device or the browser is set to.
const LOCALE = 'en-US'

// A story opening its calendar as it renders is drawn in a frame of its own
// on the Overview page, sized to hold the field and the calendar under it,
// rather than over the page.
const FRAMED = { docs: { story: { height: '520px', inline: false } } }

const styles = StyleSheet.create({
  // A field fills its container, so the samples need a width to fill: room
  // for two dates and the button on one line.
  width: {
    maxWidth: '100%',
    width: 360,
  },
})

const meta = {
  args: {
    defaultValue: RANGE,
    label: 'Label',
    locale: LOCALE,
  },
  component: DateRangePicker,
  render: (args) => (
    <View style={styles.width}>
      <DateRangePicker {...args} />
    </View>
  ),
  title: 'Components/DateRangePicker',
} satisfies Meta<typeof DateRangePicker>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// Its own story because an empty range is the one that shows both sets of
// segment placeholders with the dash between them.
const Empty: Story = {
  args: {
    defaultValue: undefined,
  },
}

const Outlined: Story = {
  args: {
    variant: 'outlined',
  },
}

// Its own story because the band across the chosen days is the half a closed
// picker cannot show. Docked under the field from the medium window size up,
// and centred over a scrim below it, which the device Storybook shows on a
// phone.
const Open: Story = {
  args: {
    defaultOpen: true,
  },
  parameters: FRAMED,
}

// Two months, which is what a range is usually picked from: side by side
// from the expanded window size up, and one under the other below it.
const OpenTwoMonths: Story = {
  args: {
    defaultOpen: true,
    defaultValue: FEBRUARY,
    visibleDuration: { months: 2 },
  },
  parameters: { docs: { story: { height: '760px', inline: false } } },
}

const WithError: Story = {
  args: {
    error: 'Supporting line',
  },
}

// Its own story because a bound is a date rather than a toggle, so it needs a
// value of its own, and it reaches the calendar's days as well as the
// segments. Open, since the days before it are where the bound shows.
const WithMinValue: Story = {
  args: {
    defaultOpen: true,
    description: 'from the 8th',
    minValue: MIN,
  },
  parameters: FRAMED,
}

export {
  Default,
  Empty,
  Open,
  OpenTwoMonths,
  Outlined,
  WithError,
  WithMinValue,
}

export default meta
