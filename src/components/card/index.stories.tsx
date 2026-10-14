import type { Decorator, Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { Card } from '.'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'
import { Separator } from '../separator'
import { Stack } from '../stack'
import { Text } from '../text'

const ROWS = ['First item', 'Second item', 'Third item'] as const

const VARIANTS = ['elevated', 'filled', 'outlined'] as const

const listStylesOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    // The card sets no padding in this mode, so the rows carry their own and
    // the rules between them reach both edges.
    row: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
  }),
)

const styles = StyleSheet.create({
  // Wider than the other samples, because list rows need room to read as
  // rows.
  list: {
    width: 320,
  },
  // One card of a row, a fixed width each, which the row stretches to the
  // tallest, as a feed's row does.
  slot: {
    width: 160,
  },
  // A card fills the column it sits in, so every sample needs one narrower
  // than the canvas to read as a card rather than a band.
  wide: {
    width: 240,
  },
})

function Body() {
  return (
    <Stack gap="xs">
      <Text variant="titleMedium">Headline</Text>
      <Text tone="muted" variant="bodySmall">
        Supporting line
      </Text>
    </Stack>
  )
}

function List() {
  const listStyles = listStylesOf(useTheme())

  return (
    <>
      {ROWS.map((label, index) => (
        <View key={label}>
          {index === 0 ? null : <Separator />}
          <View style={listStyles.row}>
            <Text variant="bodyMedium">{label}</Text>
          </View>
        </View>
      ))}
    </>
  )
}

const Wide: Decorator = (Story) => (
  <View style={styles.wide}>
    <Story />
  </View>
)

// Hoisted so it is one stable element per render, which is what react-perf's
// no-jsx-as-prop is after.
const CONTENT = <Body />

const meta = {
  args: {
    children: CONTENT,
  },
  component: Card,
  title: 'Components/Card',
} satisfies Meta<typeof Card>

type Story = StoryObj<typeof meta>

// Its own story because it is a composition rather than a variant: an
// outlined card with no padding of its own, holding rows separated by rules,
// which is the design's bordered list container.
const BorderedList: Story = {
  render: () => (
    <View style={styles.list}>
      <Card padding="none" variant="outlined">
        <List />
      </Card>
    </View>
  ),
}

const Default: Story = {
  decorators: [Wide],
}

// Its own story because it is a different component, a Pressable announced
// as a button rather than a View with no role, with a ripple and a focus ring
// a snapshot cannot show.
const Interactive: Story = {
  args: {
    interactive: true,
  },
  decorators: [Wide],
}

// An interactive card that leads somewhere: announced as a link, and followed
// through the RouterProvider around it, or the platform, when pressed.
const Link: Story = {
  args: {
    href: '/first',
    interactive: true,
  },
  decorators: [Wide],
}

// A static card, an interactive one and a link card in one row, stretched to
// the tallest, which is the static card holding a longer supporting line.
// Each draws its content at the top, under its padding, whichever it is.
const Stretched: Story = {
  render: () => (
    <Stack direction="row" gap="md" wrap>
      <Card style={styles.slot}>
        <Stack gap="xs">
          <Text variant="titleMedium">Headline</Text>
          <Text tone="muted" variant="bodySmall">
            A supporting line long enough to take more lines than the others
          </Text>
        </Stack>
      </Card>
      <Card interactive style={styles.slot}>
        {CONTENT}
      </Card>
      <Card href="/first" interactive style={styles.slot}>
        {CONTENT}
      </Card>
    </Stack>
  ),
}

// The cards page's disabled state for each variant: the container at 38%, the
// outlined card's rule at 12%, the content faded with it, and the elevated
// card flat. Each takes no press.
const Disabled: Story = {
  render: () => (
    <Stack direction="row" gap="md" wrap>
      {VARIANTS.map((variant) => (
        <Card
          interactive
          isDisabled
          key={variant}
          style={styles.slot}
          variant={variant}
        >
          {CONTENT}
        </Card>
      ))}
    </Stack>
  ),
}

export { BorderedList, Default, Disabled, Interactive, Link, Stretched }

export default meta
