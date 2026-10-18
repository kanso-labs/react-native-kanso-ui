import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { ColorSwatchPicker } from '.'

const PALETTE = ['#6750A4', '#625B71', '#7D5260', '#B3261E', '#386A20']
const WIDE = [
  '#6750A4',
  '#625B71',
  '#7D5260',
  '#B3261E',
  '#386A20',
  '#00658F',
  '#8C4A00',
  '#4A4458',
  '#1D1B20',
  '#FFFFFF',
]

const styles = StyleSheet.create({
  width: {
    maxWidth: 320,
  },
})

const meta = {
  args: {
    'aria-label': 'Label',
    children: PALETTE.map((color) => (
      <ColorSwatchPicker.Item color={color} key={color} />
    )),
    defaultValue: PALETTE[0],
  },
  component: ColorSwatchPicker,
  title: 'Components/ColorSwatchPicker',
} satisfies Meta<typeof ColorSwatchPicker>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// Its own story because `layout` is what it changes, and here a stack is one
// column rather than a set of keys to move along.
const Stack: Story = {
  args: {
    layout: 'stack',
  },
}

// Its own story because a ruled-out colour is a state a consumer looks at,
// and it is drawn on the item rather than on the picker.
const WithDisabled: Story = {
  args: {
    children: PALETTE.map((color, index) => (
      <ColorSwatchPicker.Item
        color={color}
        isDisabled={index === 2}
        key={color}
      />
    )),
  },
}

// Its own story because wrapping is what a palette longer than one row does,
// and the default one never reaches the edge.
const Wrapped: Story = {
  args: {
    children: WIDE.map((color) => (
      <ColorSwatchPicker.Item color={color} key={color} />
    )),
    defaultValue: WIDE[5],
  },
  render: (args) => (
    <View style={styles.width}>
      <ColorSwatchPicker {...args} />
    </View>
  ),
}

export { Default, Stack, WithDisabled, Wrapped }

export default meta
