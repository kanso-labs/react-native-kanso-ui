import type { Meta, StoryObj } from '@storybook/react'

import { Time } from '@internationalized/date'
import { StyleSheet, View } from 'react-native'

import { TimeField } from '.'
import { I18nProvider } from '../../i18n/provider'

// A fixed time, so every story reads the same whenever it is opened.
const TIME = new Time(9, 30)

// Every story pins its locale, as DateField's do: without one the field is
// written in whatever locale the device or the browser is set to, and which
// clock it shows with it.
const LOCALE = 'en-US'

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  width: {
    width: 240,
  },
})

const meta = {
  args: {
    defaultValue: TIME,
    label: 'Label',
    locale: LOCALE,
  },
  component: TimeField,
  title: 'Components/TimeField',
} satisfies Meta<typeof TimeField>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// Its own story because an empty field is the one that shows the segment
// placeholders, which are what a reader types over.
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

// Its own story because seconds change how many segments the field has.
const WithSeconds: Story = {
  args: {
    granularity: 'second',
  },
}

const WithError: Story = {
  args: {
    error: 'Supporting line',
  },
}

// Which clock a reader sees is their locale's, set here through the
// `I18nProvider` an app wraps itself in: `en-US` adds a day-period segment
// and `en-GB` does not. The two sit side by side, which no one locale can
// show.
const TwelveOrTwentyFourHours: Story = {
  render: () => (
    <View style={styles.row}>
      <I18nProvider locale="en-US">
        <View style={styles.width}>
          <TimeField defaultValue={TIME} description="en-US" label="Label" />
        </View>
      </I18nProvider>
      <I18nProvider locale="en-GB">
        <View style={styles.width}>
          <TimeField defaultValue={TIME} description="en-GB" label="Label" />
        </View>
      </I18nProvider>
    </View>
  ),
}

export {
  Default,
  Empty,
  Outlined,
  TwelveOrTwentyFourHours,
  WithError,
  WithSeconds,
}

export default meta
