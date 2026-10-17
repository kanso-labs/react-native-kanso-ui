import type { Decorator, Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { Badge } from '.'
import { PersonGlyph } from '../../glyphs'
import { IconButton } from '../icon-button'
import { Stack } from '../stack'
import { Text } from '../text'

// One of the library's own glyphs rather than an icon set, so the stories show
// the badge alone, at the 24dp the page measures it against. Hoisted so it is
// one stable element per render, which is what react-perf's no-jsx-as-prop is
// after.
const ICON = <PersonGlyph />

const styles = StyleSheet.create({
  start: {
    alignItems: 'flex-start',
  },
})

// A badge in a column stretches across it, as any view does, which moves its
// mark to the column's far edge, so every story holds it at its own width
// from the start edge, which is where a call site placing one puts it.
const AtOwnWidth: Decorator = (Story) => (
  <View style={styles.start}>
    <Story />
  </View>
)

const meta = {
  args: {
    children: ICON,
  },
  component: Badge,
  decorators: [AtOwnWidth],
  title: 'Components/Badge',
} satisfies Meta<typeof Badge>

type Story = StoryObj<typeof meta>

// A count past `max`, which the badge caps with a plus.
const Capped: Story = {
  args: {
    count: 1200,
  },
}

// The large badge, holding a count.
const Count: Story = {
  args: {
    count: 3,
  },
}

const Default: Story = {}

// Its own story because it is the badge's setting that changes, not a prop:
// with nothing to wrap it is the mark alone and stands in the line after a
// label, which is how a tab draws one.
const InLine: Story = {
  render: () => (
    <Stack align="center" direction="row" gap="xl">
      <Stack align="center" direction="row" gap="xs">
        <Text variant="titleSmall">Label</Text>
        <Badge />
      </Stack>
      <Stack align="center" direction="row" gap="xs">
        <Text variant="titleSmall">Label</Text>
        <Badge count={3} />
      </Stack>
    </Stack>
  ),
}

// On an icon button, whose name carries what the hidden mark says.
const OnControl: Story = {
  render: () => (
    <IconButton aria-label="Label, 3 new">
      <Badge count={3}>{ICON}</Badge>
    </IconButton>
  ),
}

export { Capped, Count, Default, InLine, OnControl }

export default meta
