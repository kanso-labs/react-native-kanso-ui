import type { Meta, StoryObj } from '@storybook/react'
import type { Color } from 'react-stately'

import { useState } from 'react'
import { StyleSheet } from 'react-native'

import { ColorField } from '.'
import { ColorSwatch } from '../color-swatch'

const PURPLE = '#6750A4'

const styles = StyleSheet.create({
  // The leading icon's 24dp, which the text fields page gives the slot.
  swatch: {
    height: 24,
    width: 24,
  },
})

const meta = {
  args: {
    defaultValue: PURPLE,
    label: 'Label',
  },
  component: ColorField,
  title: 'Components/ColorField',
} satisfies Meta<typeof ColorField>

type Story = StoryObj<typeof meta>

// The swatch the field leads with, showing the colour it holds, or a
// transparent one while it holds none.
function swatchOf(color: Color | null | string) {
  return <ColorSwatch color={color ?? undefined} style={styles.swatch} />
}

const Default: Story = {}

// Its own story because a swatch beside the value is what makes the field
// show the colour, and it is the call site's to pass. The story holds the
// value and hands it to both, so the swatch follows the colour typed once the
// field reads it, on leaving the field or pressing return.
const WithSwatch: Story = {
  render: function Render({ defaultValue, ...args }) {
    const [value, setValue] = useState<Color | null | string>(
      defaultValue ?? null,
    )

    return (
      <ColorField
        {...args}
        leadingIcon={swatchOf(value)}
        onChange={setValue}
        value={value}
      />
    )
  },
}

const Outlined: Story = {
  args: {
    variant: 'outlined',
  },
}

// Its own story because a channel field holds a number rather than a colour,
// which is a different thing to look at.
const Channel: Story = {
  args: {
    channel: 'hue',
    colorSpace: 'hsl',
    label: 'Hue',
  },
}

const WithError: Story = {
  args: {
    error: 'Supporting line',
  },
}

export { Channel, Default, Outlined, WithError, WithSwatch }

export default meta
