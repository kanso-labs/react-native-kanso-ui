import type { Meta, StoryObj } from '@storybook/react'

import { CalendarDate } from '@internationalized/date'
import { StyleSheet, View } from 'react-native'

import { DatePicker } from '.'

// A fixed date, so every story reads the same whenever it is opened.
const DATE = new CalendarDate(2026, 9, 15)
const MIN = new CalendarDate(2026, 9, 8)

// Every story pins its locale, as DateField's do: without one the picker is
// written in whatever locale the device or the browser is set to.
const LOCALE = 'en-US'

// A story opening its calendar as it renders is drawn in a frame of its own
// on the Overview page, sized to hold the field and the calendar under it,
// rather than over the page.
const FRAMED = { docs: { story: { height: '520px', inline: false } } }

const styles = StyleSheet.create({
  // A field fills its container, so the samples need a width to fill.
  width: {
    maxWidth: '100%',
    width: 320,
  },
})

const meta = {
  args: {
    defaultValue: DATE,
    label: 'Label',
    locale: LOCALE,
  },
  component: DatePicker,
  render: (args) => (
    <View style={styles.width}>
      <DatePicker {...args} />
    </View>
  ),
  title: 'Components/DatePicker',
} satisfies Meta<typeof DatePicker>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// Its own story because an empty picker is the one that shows the segment
// placeholders beside the button.
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

// Its own story because the open calendar is the half a closed picker cannot
// show. Docked under the field from the medium window size up, and centred
// over a scrim below it, which the device Storybook shows on a phone.
const Open: Story = {
  args: {
    defaultOpen: true,
  },
  parameters: FRAMED,
}

// The docked picker the page draws: open, with the month and the year as
// menu buttons in the calendar's header.
const OpenWithMenus: Story = {
  args: {
    defaultOpen: true,
    showMonthYearMenus: true,
  },
  parameters: FRAMED,
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
  OpenWithMenus,
  Outlined,
  WithError,
  WithMinValue,
}

export default meta
