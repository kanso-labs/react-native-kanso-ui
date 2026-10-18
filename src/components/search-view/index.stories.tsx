import type { Meta, StoryObj } from '@storybook/react'

import { SearchView } from '.'
import { SearchGlyph } from '../../glyphs'
import { IconButton } from '../icon-button'
import { ListBox } from '../list-box'

// A list reads its parts straight off its children, so the results are an
// array of elements rather than a fragment, which it would not look inside.
const RESULTS = [
  <ListBox.Item id="first" key="first" supporting="Supporting line">
    First item
  </ListBox.Item>,
  <ListBox.Item id="second" key="second" supporting="Supporting line">
    Second item
  </ListBox.Item>,
  <ListBox.Item id="third" key="third" supporting="Supporting line">
    Third item
  </ListBox.Item>,
]

// Each story opens its view as it renders, so on the Overview page it is
// drawn in a frame of its own, sized to hold it, rather than over the page.
const FRAMED = { docs: { story: { height: '480px', inline: false } } }

// A phone held upright, where the view fills the window.
const COMPACT = { viewport: { isRotated: false, value: 'mobile1' } }

const meta = {
  component: SearchView,
  parameters: FRAMED,
  title: 'Components/SearchView',
} satisfies Meta<typeof SearchView>

type Story = StoryObj<typeof meta>

// The docked view, which a medium window and wider draws: under the button
// that opened it, as wide as the page allows, with the results under the
// header's divider. Typing into it narrows them.
const Default: Story = {
  render: () => (
    <SearchView defaultOpen>
      <IconButton aria-label="Search">
        <SearchGlyph />
      </IconButton>
      <SearchView.Content label="Search" placeholder="Supporting text">
        <ListBox aria-label="Results">{RESULTS}</ListBox>
      </SearchView.Content>
    </SearchView>
  ),
}

// The full-screen view, which a compact window draws: square, with its 72dp
// header and the results taking the rest of the window.
const Compact: Story = {
  globals: COMPACT,
  render: Default.render,
}

export default meta

export { Compact, Default }
