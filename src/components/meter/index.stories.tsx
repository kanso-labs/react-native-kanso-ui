import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { Meter } from '.'

const styles = StyleSheet.create({
  // Narrower than the label's one word, so it has to break.
  narrow: {
    width: 200,
  },
})

const BYTES = {
  notation: 'compact',
  style: 'unit',
  unit: 'gigabyte',
} as const

const meta = {
  args: {
    label: 'Label',
    value: 40,
  },
  component: Meter,
  title: 'Components/Meter',
} satisfies Meta<typeof Meter>

type Story = StoryObj<typeof meta>

const Default: Story = {}

const WithoutValue: Story = {
  args: {
    showValue: false,
  },
}

const Positive: Story = {
  args: {
    tone: 'positive',
  },
}

const Negative: Story = {
  args: {
    tone: 'negative',
    value: 94,
  },
}

const OnItsOwnScale: Story = {
  args: {
    formatOptions: BYTES,
    maxValue: 512,
    value: 318,
  },
}

// Its own story because a label with nowhere to break, a file name or a long
// compound, breaks inside itself, and the value keeps its place at the end of
// the row rather than being pushed out of it.
const LongLabel: Story = {
  args: {
    label: 'Unterstützungszeilenüberschrift',
  },
  render: function Render(args) {
    return (
      <View style={styles.narrow}>
        <Meter {...args} />
      </View>
    )
  },
}

export { Default, LongLabel, Negative, OnItsOwnScale, Positive, WithoutValue }

export default meta
