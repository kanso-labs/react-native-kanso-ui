import type { Meta, StoryObj } from '@storybook/react'

import { Avatar } from '.'
import { Stack } from '../stack'
import { Text } from '../text'

// The web stories' gradient and silhouette, drawn to a PNG and inline rather
// than hosted: a story that reaches the network would depend on someone
// else's uptime, and the point here is only that a photo fills the circle and
// crops to it. A PNG rather than web's SVG, since React Native's `Image` draws
// no SVG.
const PHOTO =
  'data:image/png;base64,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'

const meta = {
  args: {
    name: 'Ada Lovelace',
  },
  component: Avatar,
  title: 'Components/Avatar',
} satisfies Meta<typeof Avatar>

type Story = StoryObj<typeof meta>

// A blank name has no initials to take, so the avatar draws Material
// Design's anonymous person in its tone's on-container colour: a name still
// loading, or a person with none on record.
const Anonymous: Story = {
  args: { name: '' },
}

// An avatar beside the person's name, as a byline or a list row draws one.
// The name is written next to it, so the avatar is decorative: a screen
// reader reads the name once, from the text, rather than from the avatar and
// then again from the text.
const BesideAName: Story = {
  render: () => (
    <Stack align="center" direction="row" gap="md">
      <Avatar decorative name="Ada Lovelace" />
      <Text variant="bodyLarge">Ada Lovelace</Text>
    </Stack>
  ),
}

const Default: Story = {}

// Its own story because the fallback is a behaviour rather than a variant:
// clearing `src` in the Controls panel is what shows the initials taking over.
const WithPhoto: Story = {
  args: {
    size: 'lg',
    src: PHOTO,
  },
}

export { Anonymous, BesideAName, Default, WithPhoto }

export default meta
