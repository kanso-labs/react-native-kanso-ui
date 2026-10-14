// One scheme per sidebar entry, which is what makes Theming a section rather
// than a page with a story per scheme under it. The whole file is the scheme:
// the page itself is `showcase.tsx`, shared verbatim by all of them.
//
// `globals` pins the toolbar's Theme control for the story, and it beats the
// toolbar, so the page renders in this scheme whatever is asked of it. `args`
// names the same scheme again, for the header the page draws from it.

import type { Meta, StoryObj } from '@storybook/react'

import Showcase from './showcase'

const meta = {
  args: { name: 'terminal' },
  component: Showcase,
  globals: { theme: 'terminal' },
  tags: ['!autodocs'],
  title: 'Theming/Terminal',
} satisfies Meta<typeof Showcase>

type Story = StoryObj<typeof meta>

// Named after the entry: Storybook folds a component holding a single story
// of the same name into one sidebar leaf, so this is a scheme in the list
// rather than a disclosure triangle with one child.
const Terminal: Story = {}

export { Terminal }

export default meta
