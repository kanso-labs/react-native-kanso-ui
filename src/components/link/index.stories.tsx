import type { Meta, StoryObj } from '@storybook/react'

import { Link } from '.'
import { Stack } from '../stack'
import { Text } from '../text'

const FOOTER_LINKS = ['First item', 'Second item', 'Third item'] as const

const meta = {
  args: {
    children: 'Label',
    href: '/first',
  },
  component: Link,
  title: 'Components/Link',
} satisfies Meta<typeof Link>

type Story = StoryObj<typeof meta>

// In a Text, since a link sets no type of its own: on its own it would draw in
// the platform's default face rather than the theme's.
const Default: Story = {
  render: (args) => (
    <Text variant="bodyLarge">
      <Link {...args} />
    </Text>
  ),
}

// Its own story because a link takes the size and face of the sentence it
// sits in, and wraps with it. The rule under it is on by default: colour alone
// fails anyone who cannot separate the two hues.
const InProse: Story = {
  render: () => (
    <Text variant="bodyLarge">
      A paragraph of supporting copy with{' '}
      <Link href="/first">a link inside it</Link>, sized and faced by the
      sentence around it rather than by anything the link sets.
    </Text>
  ),
}

// Its own story because a row of links needs no colour to be read as links,
// so this pairs the inherit tone with a rule that waits for the pointer, and
// on a phone, which has none, draws none. Each link stands in a muted Text of
// its own, which is what the inherit tone takes its colour and face from.
const InFooter: Story = {
  render: () => (
    <Stack direction="row" gap="xl" role="navigation" wrap>
      {FOOTER_LINKS.map((label) => (
        <Text key={label} tone="muted" variant="bodyMedium">
          <Link href="/first" tone="inherit" underline="hover">
            {label}
          </Link>
        </Text>
      ))}
    </Stack>
  ),
}

export { Default, InFooter, InProse }

export default meta
