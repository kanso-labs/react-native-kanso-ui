import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'
import { parseColor } from 'react-stately'

import { ColorSwatch } from '.'

const TRANSPARENT = parseColor('hsla(200, 100%, 50%, 0.4)')

const styles = StyleSheet.create({
  large: {
    height: 72,
    width: 72,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
})

const meta = {
  args: {
    color: '#6750A4',
  },
  component: ColorSwatch,
  title: 'Components/ColorSwatch',
} satisfies Meta<typeof ColorSwatch>

type Story = StoryObj<typeof meta>

// Its own story because the size comes from the call site: its style lands on
// the square, and the colour fills whatever square it is given. The default
// one stands beside it for scale.
const CustomSize: Story = {
  render: () => (
    <View style={styles.row}>
      <ColorSwatch color="#6750A4" />
      <ColorSwatch color={TRANSPARENT} style={styles.large} />
    </View>
  ),
}

const Default: Story = {}

// Its own story because the chequer is the component's one drawing decision,
// and an opaque swatch never shows it.
const Transparent: Story = {
  args: {
    color: TRANSPARENT,
  },
}

export { CustomSize, Default, Transparent }

export default meta
