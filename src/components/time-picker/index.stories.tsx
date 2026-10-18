import type { Meta, StoryObj } from '@storybook/react'

import { Time } from '@internationalized/date'
import { StyleSheet, View } from 'react-native'

import { TimePicker } from '.'

// A fixed time, so every story reads the same whenever it is opened.
const TIME = new Time(9, 30)

// Every story pins its locale, as TimeField's do: without one the picker is
// written in whatever locale the device or the browser is set to, and which
// clock it shows with it.
const LOCALE = 'en-US'

// A story opening its modal as it renders is drawn in a frame of its own on
// the Overview page, sized to hold the modal, rather than over the page.
const FRAMED = { docs: { story: { height: '640px', inline: false } } }

const styles = StyleSheet.create({
  // A field fills its container, so the samples need a width to fill.
  width: {
    maxWidth: '100%',
    width: 240,
  },
})

const meta = {
  args: {
    defaultValue: TIME,
    label: 'Label',
    locale: LOCALE,
  },
  component: TimePicker,
  render: (args) => (
    <View style={styles.width}>
      <TimePicker {...args} />
    </View>
  ),
  title: 'Components/TimePicker',
} satisfies Meta<typeof TimePicker>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// Its own story because an empty picker is the one that shows the segment
// placeholders beside the button.
const Empty: Story = {
  args: {
    defaultValue: undefined,
  },
}

// The modal on its dial, the half a closed picker cannot show, with the hour
// box selected and the period selector beside the boxes.
const Open: Story = {
  args: {
    defaultOpen: true,
  },
  parameters: FRAMED,
}

// The modal's other variant: the boxes as text fields, each named under it,
// with no dial.
const OpenInput: Story = {
  args: {
    defaultMode: 'input',
    defaultOpen: true,
  },
  parameters: FRAMED,
}

const Outlined: Story = {
  args: {
    variant: 'outlined',
  },
}

// A twenty-four hour clock: the day's second half on the dial's inner ring,
// and no period selector.
const TwentyFourHours: Story = {
  args: {
    defaultOpen: true,
    defaultValue: new Time(21, 30),
    hourCycle: 24,
  },
  parameters: FRAMED,
}

const WithError: Story = {
  args: {
    error: 'Supporting line',
  },
}

export { Default, Empty, Open, OpenInput, Outlined, TwentyFourHours, WithError }

export default meta
