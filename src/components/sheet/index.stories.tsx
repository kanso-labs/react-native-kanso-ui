import type { Meta, StoryObj } from '@storybook/react'

import { Sheet } from '.'
import { CloseGlyph } from '../../glyphs'
import { Button } from '../button'
import { IconButton } from '../icon-button'
import { Text } from '../text'

// The library's own close glyph, hoisted so it is one stable element per
// render, which is what react-perf's no-jsx-as-prop is after.
const CLOSE = <CloseGlyph />

// Forty lines of body: more than the bottom sheet has room for, so the story
// shows what the body does when it runs out.
const LONG_BODY = Array.from({ length: 40 }, (_, index) => (
  <Text key={index} tone="muted" variant="bodyMedium">
    Supporting line
  </Text>
))

// Each story opens its sheet as it renders, so on the Overview page it is
// drawn in a frame of its own, sized to hold it, rather than over the page.
const FRAMED = { docs: { story: { height: '600px', inline: false } } }

// A phone held upright, where the sheet is a bottom sheet.
const COMPACT = { viewport: { isRotated: false, value: 'mobile1' } }

const meta = {
  component: Sheet,
  parameters: FRAMED,
  title: 'Components/Sheet',
} satisfies Meta<typeof Sheet>

type Story = StoryObj<typeof meta>

// What four of the stories draw in the sheet; only the window around it
// differs.
function PanelContents() {
  return (
    <>
      <Sheet.Handle />
      <Sheet.Header>
        <Sheet.Title>Headline</Sheet.Title>
        <IconButton aria-label="Close" slot="close">
          {CLOSE}
        </IconButton>
      </Sheet.Header>
      <Sheet.Body>
        <Text tone="muted" variant="bodyMedium">
          Supporting line describing what the sheet is for.
        </Text>
        <Text tone="muted" variant="bodyMedium">
          The body is the only part that scrolls, so the header and footer keep
          their place however much content sits between them.
        </Text>
      </Sheet.Body>
      <Sheet.Footer>
        <Button slot="close">Confirm</Button>
        <Button slot="close" variant="outlined">
          Cancel
        </Button>
      </Sheet.Footer>
    </>
  )
}

// A side sheet, along the end edge of a medium window or wider, rounded on
// the corners facing the screen it covers.
const Default: Story = {
  render: () => (
    <Sheet defaultOpen>
      <Button variant="outlined">Open sheet</Button>
      <Sheet.Content>
        <PanelContents />
      </Sheet.Content>
    </Sheet>
  ),
}

// The same sheet in a compact window, where it is a bottom sheet: the
// window's width, only as tall as its content, rounded along the top, with
// the handle it is dragged by.
const BottomSheet: Story = {
  globals: COMPACT,
  render: Default.render,
}

// A bottom sheet taller than half the window opens at half its height, with
// its actions below the fold, and is dragged, or raised from its handle, to
// the whole of it, where the body scrolls.
const LongBody: Story = {
  globals: COMPACT,
  render: () => (
    <Sheet defaultOpen>
      <Button variant="outlined">Open sheet</Button>
      <Sheet.Content>
        <Sheet.Handle />
        <Sheet.Header>
          <Sheet.Title>Headline</Sheet.Title>
          <IconButton aria-label="Close" slot="close">
            {CLOSE}
          </IconButton>
        </Sheet.Header>
        <Sheet.Body>{LONG_BODY}</Sheet.Body>
        <Sheet.Footer>
          <Button slot="close">Confirm</Button>
          <Button slot="close" variant="outlined">
            Cancel
          </Button>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet>
  ),
}

// A headline of one word longer than a phone-width header holds, and two
// actions too long to share a row. The headline breaks inside the word and the
// close button keeps its place; the actions wrap onto a row each.
const LongHeadlineAndActions: Story = {
  globals: COMPACT,
  render: () => (
    <Sheet defaultOpen>
      <Button variant="outlined">Open sheet</Button>
      <Sheet.Content>
        <Sheet.Handle />
        <Sheet.Header>
          <Sheet.Title>{'Headline'.repeat(4)}</Sheet.Title>
          <IconButton aria-label="Close" slot="close">
            {CLOSE}
          </IconButton>
        </Sheet.Header>
        <Sheet.Body>
          <Text tone="muted" variant="bodyMedium">
            Supporting line describing what the sheet is for.
          </Text>
        </Sheet.Body>
        <Sheet.Footer>
          <Button slot="close">First long action label</Button>
          <Button slot="close" variant="outlined">
            Second long action label
          </Button>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet>
  ),
}

export default meta
export { BottomSheet, Default, LongBody, LongHeadlineAndActions }
