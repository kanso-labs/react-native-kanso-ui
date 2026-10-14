// The library's own dark theme, run through the accessibility check the
// Vitest run gives every story. Every other story renders in the light scheme
// the toolbar opens on, so without this a dark role pair below AA would pass
// every check. The showcase is the whole library at once, which makes it the
// page to check.
//
// A check rather than a page, so it is hidden from the sidebar (`!dev`): what
// the dark scheme looks like is every story's own under the toolbar's Dark.
// `globals` pins the scheme for the story whatever the toolbar says, as the
// demo schemes' files do.

import type { Meta, StoryObj } from '@storybook/react'

import Showcase from './showcase'

const meta = {
  args: { name: 'dark' },
  component: Showcase,
  globals: { theme: 'dark' },
  tags: ['!autodocs', '!dev'],
  title: 'Theming/Dark',
} satisfies Meta<typeof Showcase>

type Story = StoryObj<typeof meta>

// Named after the entry, as the schemes' own stories are.
const Dark: Story = {}

export { Dark }

export default meta
