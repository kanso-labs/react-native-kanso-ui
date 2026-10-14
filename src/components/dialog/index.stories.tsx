import type { Meta, StoryObj } from '@storybook/react'

import { Dialog } from '.'
import { CloseGlyph } from '../../glyphs'
import { Button } from '../button'
import { IconButton } from '../icon-button'
import { Text } from '../text'

// The library's own close glyph, hoisted so it is one stable element per
// render, which is what react-perf's no-jsx-as-prop is after.
const CLOSE = <CloseGlyph />

// Forty lines of body: more than the dialog has room for at any width, so
// the story shows what the body does when it runs out.
const LONG_BODY = Array.from({ length: 40 }, (_, index) => (
  <Text key={index} tone="muted" variant="bodyMedium">
    Supporting line
  </Text>
))

// Each story opens its dialog as it renders, so on the Overview page it is
// drawn in a frame of its own, sized to hold it, rather than over the page.
const FRAMED = { docs: { story: { height: '600px', inline: false } } }

// A phone held upright, where a dialog of the default role fills the window.
const COMPACT = { viewport: { isRotated: false, value: 'mobile1' } }

const meta = {
  component: Dialog,
  parameters: FRAMED,
  title: 'Components/Dialog',
} satisfies Meta<typeof Dialog>

type Story = StoryObj<typeof meta>

const Default: Story = {
  render: () => (
    <Dialog defaultOpen>
      <Button variant="outlined">Open dialog</Button>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Headline</Dialog.Title>
          <IconButton aria-label="Close" slot="close">
            {CLOSE}
          </IconButton>
        </Dialog.Header>
        <Dialog.Body>
          Supporting text explains what the dialog is asking, in as many lines
          as it needs.
        </Dialog.Body>
        <Dialog.Footer>
          <Button slot="close" variant="text">
            Cancel
          </Button>
          <Button slot="close" variant="text">
            Confirm
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  ),
}

// The same dialog in a compact window, where it fills the window as the
// page's full-screen dialog: square corners, the headline in title large on a
// header bar, and the actions on a bar along the bottom.
const FullScreen: Story = {
  globals: COMPACT,
  render: Default.render,
}

// A body longer than the room is the one part that scrolls: the header and
// the actions stay on screen, and the rest of the text is a scroll away
// rather than clipped past the container's edge.
const LongBody: Story = {
  render: () => (
    <Dialog defaultOpen>
      <Button variant="outlined">Open dialog</Button>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Headline</Dialog.Title>
          <IconButton aria-label="Close" slot="close">
            {CLOSE}
          </IconButton>
        </Dialog.Header>
        <Dialog.Body>{LONG_BODY}</Dialog.Body>
        <Dialog.Footer>
          <Button slot="close" variant="text">
            Cancel
          </Button>
          <Button slot="close" variant="text">
            Confirm
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  ),
}

// A question that has to be answered: neither the scrim nor the back gesture
// closes it, so one of its actions has to.
const AlertDialog: Story = {
  render: () => (
    <Dialog defaultOpen>
      <Button variant="outlined">Open alert</Button>
      <Dialog.Content
        isDismissable={false}
        isKeyboardDismissDisabled
        role="alertdialog"
      >
        <Dialog.Header>
          <Dialog.Title>Headline</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          Supporting text explains what happens either way.
        </Dialog.Body>
        <Dialog.Footer>
          <Button slot="close" variant="text">
            Cancel
          </Button>
          <Button slot="close" variant="text">
            Confirm
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  ),
}

// The same alert dialog in a compact window, where a dialog of the default
// role fills the window. An alert dialog stays the basic one there: rounded,
// centred over the scrim, and only as tall as its question.
const AlertDialogCompact: Story = {
  globals: COMPACT,
  render: AlertDialog.render,
}

// Three answers on a phone are more than one row holds, so the actions wrap
// onto a second row at the trailing edge rather than running the first of
// them past the container's start edge.
const ThreeActions: Story = {
  globals: COMPACT,
  render: () => (
    <Dialog defaultOpen>
      <Button variant="outlined">Open alert</Button>
      <Dialog.Content
        isDismissable={false}
        isKeyboardDismissDisabled
        role="alertdialog"
      >
        <Dialog.Header>
          <Dialog.Title>Headline</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          Supporting text explains what each answer does.
        </Dialog.Body>
        <Dialog.Footer>
          <Button slot="close" variant="text">
            First action
          </Button>
          <Button slot="close" variant="text">
            Second action
          </Button>
          <Button slot="close" variant="text">
            Third action
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  ),
}

export default meta
export {
  AlertDialog,
  AlertDialogCompact,
  Default,
  FullScreen,
  LongBody,
  ThreeActions,
}
