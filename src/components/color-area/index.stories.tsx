import type { Meta, StoryObj } from '@storybook/react'
import type { Color } from 'react-stately'

import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { ColorArea } from '.'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'
import { ColorSlider } from '../color-slider'

const BLUE = 'hsl(200, 100%, 50%)'
const TRANSLUCENT = 'hsla(200, 100%, 50%, 0.6)'

const styles = StyleSheet.create({
  // A plane takes the width it is given and stays square, so the samples
  // give it web's.
  narrow: {
    width: 140,
  },
  wide: {
    width: 240,
  },
})

const stylesOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    // A picker is the plane with the channel it does not carry under it,
    // which is the arrangement ColorPicker composes.
    picker: {
      gap: spacing.md,
      width: 240,
    },
    row: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xl,
    },
  }),
)

const meta = {
  args: {
    defaultValue: BLUE,
    style: styles.wide,
    xChannel: 'saturation',
    yChannel: 'lightness',
  },
  component: ColorArea,
  title: 'Components/ColorArea',
} satisfies Meta<typeof ColorArea>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// A plane and an alpha slider holding one translucent value, which is how a
// colour with transparency is edited here: the plane carries two of the
// colour's own channels and the slider its alpha, as ColorPicker composes
// them. Alpha is not given to the plane, whose colours would then disagree
// with its own handle; see the component's header.
function TranslucentPicker() {
  const own = stylesOf(useTheme())
  const [value, setValue] = useState<Color | string>(TRANSLUCENT)

  return (
    <View style={own.picker}>
      <ColorArea
        onChange={setValue}
        value={value}
        xChannel="saturation"
        yChannel="lightness"
      />
      <ColorSlider
        channel="alpha"
        label="Alpha"
        onChange={setValue}
        value={value}
      />
    </View>
  )
}

// Its own story because alpha is the one channel a consumer is most likely
// to hand the plane, and the one that belongs beside it instead.
const Alpha: Story = {
  render: () => <TranslucentPicker />,
}

const Disabled: Story = {
  args: {
    isDisabled: true,
  },
}

// Its own story because the plane has to be seen beside a ColorSlider, whose
// handle it shares, and at another width: it takes the width it is given and
// stays square, since an oblong would give its two channels unequal travel.
const WithSlider: Story = {
  render: function Render() {
    const own = stylesOf(useTheme())

    return (
      <View style={own.row}>
        <View style={own.picker}>
          <ColorArea
            defaultValue={BLUE}
            xChannel="saturation"
            yChannel="lightness"
          />
          <ColorSlider channel="hue" defaultValue={BLUE} label="Hue" />
        </View>
        <ColorArea
          defaultValue={BLUE}
          style={styles.narrow}
          xChannel="saturation"
          yChannel="lightness"
        />
      </View>
    )
  },
}

export { Alpha, Default, Disabled, WithSlider }

export default meta
