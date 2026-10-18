import type { Meta, StoryObj } from '@storybook/react'

import { CalendarDate, CalendarDateTime } from '@internationalized/date'
import { StyleSheet, View } from 'react-native'

import { DateField } from '.'

// A fixed date, so every story reads the same whenever it is opened.
const DATE = new CalendarDate(2026, 9, 15)

// A granularity below a day needs a value carrying a time; React Stately
// rejects `minute` against a date-only value.
const DATE_TIME = new CalendarDateTime(2026, 9, 15, 9, 30)

// Every story pins its locale, as Calendar's do: without one the field is
// written in whatever locale the device or the browser is set to.
const LOCALE = 'en-US'

const styles = StyleSheet.create({
  locales: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  width: {
    width: 260,
  },
})

const meta = {
  args: {
    defaultValue: DATE,
    label: 'Label',
    locale: LOCALE,
  },
  component: DateField,
  title: 'Components/DateField',
} satisfies Meta<typeof DateField>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// Its own story because an empty field is the one that shows the segment
// placeholders, which are the thing a reader types over.
const Empty: Story = {
  args: {
    defaultValue: undefined,
  },
}

// Its own story because the outlined box is a different shape, not a
// different state.
const Outlined: Story = {
  args: {
    variant: 'outlined',
  },
}

// Its own story because time segments change how many segments the field
// has, which is what `granularity` is for.
const WithTime: Story = {
  args: {
    defaultValue: DATE_TIME,
    granularity: 'minute',
  },
}

const WithDescription: Story = {
  args: {
    description: 'Supporting line',
  },
}

const WithError: Story = {
  args: {
    error: 'Supporting line',
  },
}

const Disabled: Story = {
  args: {
    isDisabled: true,
  },
}

// Its own story because how many segments there are, and in what order, is
// the locale's: the same date reads month first under `en-US`, day first
// under `en-GB`, and year first under `ja-JP`.
const Locales: Story = {
  render: (args) => (
    <View style={styles.locales}>
      <View style={styles.width}>
        <DateField {...args} description="en-US" locale="en-US" />
      </View>
      <View style={styles.width}>
        <DateField {...args} description="en-GB" locale="en-GB" />
      </View>
      <View style={styles.width}>
        <DateField {...args} description="ja-JP" locale="ja-JP" />
      </View>
    </View>
  ),
}

export {
  Default,
  Disabled,
  Empty,
  Locales,
  Outlined,
  WithDescription,
  WithError,
  WithTime,
}

export default meta
