import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { ProgressIndicator } from '.'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'
import { Button } from '../button'

const stylesOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
  }),
)

// A ring sized for a button's icon slot, working and part of the way.
const WORKING = (
  <ProgressIndicator
    aria-label="Working"
    diameter="20px"
    isIndeterminate
    tone="inherit"
    variant="circular"
  />
)
const QUARTER = (
  <ProgressIndicator
    aria-label="Quarter"
    diameter="20px"
    tone="inherit"
    value={25}
    variant="circular"
  />
)

const meta = {
  args: {
    label: 'Label',
    value: 40,
  },
  component: ProgressIndicator,
  title: 'Components/ProgressIndicator',
} satisfies Meta<typeof ProgressIndicator>

type Story = StoryObj<typeof meta>

const Default: Story = {}

const WithValue: Story = {
  args: {
    showValue: true,
  },
}

const Indeterminate: Story = {
  args: {
    isIndeterminate: true,
    value: undefined,
  },
}

const WithBuffer: Story = {
  args: {
    buffer: 70,
    value: 30,
  },
}

const Circular: Story = {
  args: {
    variant: 'circular',
  },
}

const CircularIndeterminate: Story = {
  args: {
    isIndeterminate: true,
    value: undefined,
    variant: 'circular',
  },
}

const Wavy: Story = {
  args: {
    shape: 'wavy',
  },
}

const WavyCircular: Story = {
  args: {
    shape: 'wavy',
    variant: 'circular',
  },
}

// Its own story because `inherit` is for a slot with a colour of its own: a
// ring in a button's icon slot takes the button's content colour, and its
// track a quarter of that, where the page's own pair would vanish into a
// filled button's primary.
const InheritedTone: Story = {
  render: function Render() {
    return (
      <View style={stylesOf(useTheme()).row}>
        <Button icon={WORKING}>Label</Button>
        <Button icon={QUARTER} variant="tonal">
          Label
        </Button>
      </View>
    )
  },
}

export {
  Circular,
  CircularIndeterminate,
  Default,
  Indeterminate,
  InheritedTone,
  Wavy,
  WavyCircular,
  WithBuffer,
  WithValue,
}

export default meta
