import type { Decorator, Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { Fab } from '.'
import { PlusGlyph } from '../../glyphs'
import { Stack } from '../stack'

const SIZES = ['md', 'lg', 'xl'] as const

const TONES = ['primary', 'secondary', 'tertiary'] as const

const styles = StyleSheet.create({
  // Holds each story's FABs at their own size rather than stretched across
  // the canvas, as a FAB floating over a screen is.
  hug: {
    alignItems: 'flex-start',
  },
})

// The library's own plus, which reads the colour and size the FAB hands it
// through useIconStyle(), as an app's own icon does. Hoisted so it is one
// stable element per render, which is what react-perf's no-jsx-as-prop is
// after.
const PLUS = <PlusGlyph />

const Hugged: Decorator = (Story) => (
  <View style={styles.hug}>
    <Story />
  </View>
)

const meta = {
  args: {
    'aria-label': 'Label',
    children: PLUS,
  },
  component: Fab,
  decorators: [Hugged],
  title: 'Components/Fab',
} satisfies Meta<typeof Fab>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// The FAB with a label after its icon.
const Extended: Story = {
  args: {
    'aria-label': undefined,
    label: 'Label',
  },
}

// The pages' FAB, medium FAB and large FAB, each alone and extended.
const Sizes: Story = {
  render: () => (
    <Stack gap="lg">
      <Stack align="center" direction="row" gap="md" wrap>
        {SIZES.map((size) => (
          <Fab aria-label="Label" key={size} size={size}>
            {PLUS}
          </Fab>
        ))}
      </Stack>
      <Stack align="center" direction="row" gap="md" wrap>
        {SIZES.map((size) => (
          <Fab key={size} label="Label" size={size}>
            {PLUS}
          </Fab>
        ))}
      </Stack>
    </Stack>
  ),
}

// Each tone on its container pair, then on the tone itself.
const Tones: Story = {
  render: () => (
    <Stack gap="lg">
      <Stack direction="row" gap="md" wrap>
        {TONES.map((tone) => (
          <Fab aria-label="Label" key={tone} tone={tone}>
            {PLUS}
          </Fab>
        ))}
      </Stack>
      <Stack direction="row" gap="md" wrap>
        {TONES.map((tone) => (
          <Fab aria-label="Label" key={tone} tone={tone} variant="filled">
            {PLUS}
          </Fab>
        ))}
      </Stack>
    </Stack>
  ),
}

// The container every disabled button takes, with no shadow.
const Disabled: Story = {
  args: { isDisabled: true },
}

export { Default, Disabled, Extended, Sizes, Tones }

export default meta
