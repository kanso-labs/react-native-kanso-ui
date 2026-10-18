import type { Decorator, Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { ColorSlider } from '.'

const BLUE = 'hsl(200, 100%, 50%)'
const TRANSLUCENT = 'hsla(200, 100%, 50%, 0.6)'

const styles = StyleSheet.create({
  // A colour slider fills its container, so the samples need a width to
  // fill: a phone's.
  phone: {
    maxWidth: '100%',
    width: 360,
  },
})

// A decorator rather than a wrapper in each `render`, so every story takes
// the phone's width.
const OnAPhone: Decorator = (Story) => (
  <View style={styles.phone}>
    <Story />
  </View>
)

const meta = {
  args: {
    channel: 'hue',
    defaultValue: BLUE,
    label: 'Label',
  },
  component: ColorSlider,
  decorators: [OnAPhone],
  title: 'Components/ColorSlider',
} satisfies Meta<typeof ColorSlider>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// Its own story because the chequer is only visible under a channel that
// fades out, and no other channel does.
const Alpha: Story = {
  args: {
    channel: 'alpha',
    defaultValue: TRANSLUCENT,
  },
}

const Disabled: Story = {
  args: {
    isDisabled: true,
  },
}

const Vertical: Story = {
  args: {
    orientation: 'vertical',
  },
}

export { Alpha, Default, Disabled, Vertical }

export default meta
