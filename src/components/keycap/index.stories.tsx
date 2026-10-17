import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { Keycap } from '.'
import { Stack } from '../stack'
import { Text } from '../text'

const styles = StyleSheet.create({
  // A measure a paragraph would take, so the sentence wraps as one does.
  prose: {
    maxWidth: 480,
  },
})

const meta = {
  args: {
    children: 'Enter',
  },
  component: Keycap,
  title: 'Components/Keycap',
} satisfies Meta<typeof Keycap>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// Its own story because a keycap is named inside a sentence, where its rule
// alone carries the metaphor: there is no fill behind it, so one sits inside a
// Card or a Sheet without reading as a nested surface.
const InProse: Story = {
  render: () => (
    <View style={styles.prose}>
      <Text variant="bodyLarge">
        Press <Keycap>Esc</Keycap> to dismiss, or <Keycap>Enter</Keycap> to
        confirm the current selection.
      </Text>
    </View>
  ),
}

// Its own story because a keycap is one key: a chord is several of them
// combined at the call site, which is also how a menu path is written, and the
// separator between them is the sentence's rather than the component's.
const ChordsAndPaths: Story = {
  render: () => (
    <Stack align="start" gap="lg">
      <Stack align="start" gap="xs">
        <Text variant="bodyLarge">
          <Keycap>Ctrl</Keycap> + <Keycap>K</Keycap>
        </Text>
        <Text tone="muted" variant="labelSmall">
          a chord
        </Text>
      </Stack>
      <Stack align="start" gap="xs">
        <Text variant="bodyLarge">
          <Keycap>First</Keycap> → <Keycap>Second</Keycap> →{' '}
          <Keycap>Third</Keycap>
        </Text>
        <Text tone="muted" variant="labelSmall">
          a path through a menu
        </Text>
      </Stack>
    </Stack>
  ),
}

// Its own story because a keycap takes its size from the text around it, so a
// key named in a footnote and one named in a heading are the same component.
// The share is a little smaller than Code's, because the rule adds height the
// glyphs do not.
const Scale: Story = {
  render: () => (
    <Stack align="start" gap="xs">
      <Text variant="headlineSmall">
        Press <Keycap>Enter</Keycap>
      </Text>
      <Text tone="muted" variant="bodySmall">
        Press <Keycap>Enter</Keycap>
      </Text>
    </Stack>
  ),
}

export { ChordsAndPaths, Default, InProse, Scale }

export default meta
