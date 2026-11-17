import type { Meta, StoryObj } from '@storybook/react'

import { useState } from 'react'

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

// Built by a call rather than written inline at the prop, which is what
// react-perf's jsx-no-new-function-as-prop is after; the React Compiler
// memoises the result on its inputs.
function closeWith(setOpen: (isOpen: boolean) => void) {
  return () => {
    setOpen(false)
  }
}

// The view and what opens it, open from the start. A result is what a search
// is for, so picking one closes the view, as an app's does once it has gone
// where the result leads; that makes each result a button, where a ListBox
// that neither selects nor acts draws its rows as text. The story holds the
// open state for it, as an app would.
function Search() {
  const [isOpen, setOpen] = useState(true)

  return (
    <SearchView isOpen={isOpen} onOpenChange={setOpen}>
      <IconButton aria-label="Search">
        <SearchGlyph />
      </IconButton>
      <SearchView.Content label="Search" placeholder="Supporting text">
        <ListBox aria-label="Results" onAction={closeWith(setOpen)}>
          {RESULTS}
        </ListBox>
      </SearchView.Content>
    </SearchView>
  )
}

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
  render: () => <Search />,
}

// The full-screen view, which a compact window draws: square, with its 72dp
// header and the results taking the rest of the window.
const Compact: Story = {
  globals: COMPACT,
  render: Default.render,
}

export default meta

export { Compact, Default }
