import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { ColorWheel } from '.'
import { ColorArea } from '../color-area'

const BLUE = 'hsl(200, 100%, 50%)'

const styles = StyleSheet.create({
  // A plane small enough to clear the band on every side.
  area: {
    width: 100,
  },
  // What sits in the hole: centred on the wheel. It lets presses through to
  // the ring around the plane.
  inside: {
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
    ...StyleSheet.absoluteFill,
  },
  nest: {
    alignSelf: 'flex-start',
  },
})

const meta = {
  args: {
    defaultValue: BLUE,
  },
  component: ColorWheel,
  title: 'Components/ColorWheel',
} satisfies Meta<typeof ColorWheel>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// Its own story because a band this wide is what shows the inner radius
// following the thickness rather than being set beside it.
const Thick: Story = {
  args: {
    outerRadius: 70,
    thickness: 32,
  },
}

const Disabled: Story = {
  args: {
    isDisabled: true,
  },
}

// Its own story because nothing is drawn inside the band, so whatever the
// wheel sits over shows through: a colour area fits inside it, which is what
// a picker built from both looks like.
const WithColorArea: Story = {
  render: () => (
    <View style={styles.nest}>
      <ColorWheel defaultValue={BLUE} />
      <View style={styles.inside}>
        <ColorArea
          defaultValue={BLUE}
          style={styles.area}
          xChannel="saturation"
          yChannel="lightness"
        />
      </View>
    </View>
  ),
}

export { Default, Disabled, Thick, WithColorArea }

export default meta
