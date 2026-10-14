import type { Decorator, Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { IconButton } from '.'
import { PlusGlyph } from '../../glyphs'
import { Button } from '../button'
import { Stack } from '../stack'

const SIZES = ['xs', 'md', 'lg', 'xl', 'xxl'] as const

const VARIANTS = ['standard', 'outlined', 'tonal', 'filled'] as const

const styles = StyleSheet.create({
  // Holds each story's buttons at their own size rather than in a stretched
  // row, as the button stories do.
  hug: {
    alignItems: 'flex-start',
  },
})

// The library's own plus, which reads the colour and size the button hands it
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
    'aria-label': 'Add',
    children: PLUS,
  },
  component: IconButton,
  decorators: [Hugged],
  title: 'Components/IconButton',
} satisfies Meta<typeof IconButton>

type Story = StoryObj<typeof meta>

const Default: Story = {}

const Outlined: Story = {
  args: { variant: 'outlined' },
}

// A filled toggle, unselected: surface container with the muted icon, rather
// than the plain filled button's primary.
const Toggle: Story = {
  args: { defaultSelected: false, variant: 'filled' },
}

// The same toggle selected, on primary and at the squarer corner.
const ToggleSelected: Story = {
  args: { defaultSelected: true, variant: 'filled' },
}

// The four variants, then each as a toggle selected, then each disabled.
const Variants: Story = {
  render: () => (
    <Stack gap="lg">
      <Stack direction="row" gap="md" wrap>
        {VARIANTS.map((variant) => (
          <IconButton aria-label="Add" key={variant} variant={variant}>
            {PLUS}
          </IconButton>
        ))}
      </Stack>
      <Stack direction="row" gap="md" wrap>
        {VARIANTS.map((variant) => (
          <IconButton
            aria-label="Add"
            defaultSelected
            key={variant}
            variant={variant}
          >
            {PLUS}
          </IconButton>
        ))}
      </Stack>
      <Stack direction="row" gap="md" wrap>
        {VARIANTS.map((variant) => (
          <IconButton
            aria-label="Add"
            isDisabled
            key={variant}
            variant={variant}
          >
            {PLUS}
          </IconButton>
        ))}
      </Stack>
    </Stack>
  ),
}

// Each size beside a button of the same size, which the two share their
// heights for, so a row mixing them lines up.
const BesideButton: Story = {
  render: () => (
    <Stack gap="lg">
      {SIZES.map((size) => (
        <Stack align="center" direction="row" gap="md" key={size}>
          <IconButton aria-label="Add" size={size} variant="tonal">
            {PLUS}
          </IconButton>
          <Button icon={PLUS} size={size} variant="tonal">
            Label
          </Button>
        </Stack>
      ))}
    </Stack>
  ),
}

export { BesideButton, Default, Outlined, Toggle, ToggleSelected, Variants }

export default meta
