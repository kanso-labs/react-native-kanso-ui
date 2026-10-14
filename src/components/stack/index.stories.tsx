import type { Meta, StoryObj } from '@storybook/react'
import type { ViewProps } from 'react-native'

import { Platform, StyleSheet, View } from 'react-native'

import { Stack } from '.'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'
import { Text } from '../text'

const stylesOf = themedStyles(({ colors, radii, spacing }) =>
  StyleSheet.create({
    // A block with no width of its own, so what the stories show is the stack
    // deciding the width rather than the child asking for one.
    block: {
      backgroundColor: colors.primaryContainer,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    label: {
      color: colors.onPrimaryContainer,
    },
  }),
)

// A writing direction set on a view, which every view inside lays out by, as
// an app under I18nManager's right-to-left lays out everything. What sets one
// differs by renderer: React Native reads a `direction` style, and React
// Native Web the `dir` attribute, which its View takes as a prop React
// Native's types do not name.
const RIGHT_TO_LEFT = Platform.select<ViewProps & { readonly dir?: 'rtl' }>({
  default: { style: { direction: 'rtl' } },
  web: { dir: 'rtl' },
})

function Blocks() {
  const { block, label } = stylesOf(useTheme())

  return ['01', '02', '03'].map((number) => (
    <View key={number} style={block}>
      <Text style={label} variant="labelLarge">
        {number}
      </Text>
    </View>
  ))
}

const meta = {
  args: {
    children: <Blocks />,
  },
  component: Stack,
  title: 'Components/Stack',
} satisfies Meta<typeof Stack>

type Story = StoryObj<typeof meta>

const Default: Story = {}

const Row: Story = {
  args: {
    direction: 'row',
  },
}

// The same row under a right-to-left writing direction. It runs from the
// right edge, with 01 at the start, because `start` is logical rather than a
// side.
const RightToLeft: Story = {
  args: {
    direction: 'row',
  },
  render: (args) => (
    <View {...RIGHT_TO_LEFT}>
      <Stack {...args} />
    </View>
  ),
}

export { Default, RightToLeft, Row }

export default meta
