import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet } from 'react-native'

import { Toolbar } from '.'
import { CheckGlyph, CloseGlyph, MinusGlyph, PlusGlyph } from '../../glyphs'
import { Button } from '../button'
import { IconButton } from '../icon-button'
import { Separator } from '../separator'
import { TextField } from '../text-field'

// The library's own glyphs, which read the colour and size the button hands
// them through useIconStyle(), so the stories stay a demonstration of the
// toolbar alone. Hoisted so each is one stable element per render, which is
// what react-perf's no-jsx-as-prop is after.
const FIRST = <PlusGlyph />
const SECOND = <MinusGlyph />
const THIRD = <CheckGlyph />
const FOURTH = <CloseGlyph />

const styles = StyleSheet.create({
  // Wide enough for a label and a value, as a field in a row has no width of
  // its own to take.
  field: {
    width: 200,
  },
})

const CONTROLS = (
  <>
    <IconButton aria-label="First item">{FIRST}</IconButton>
    <IconButton aria-label="Second item">{SECOND}</IconButton>
    <IconButton aria-label="Third item">{THIRD}</IconButton>
    <Separator />
    <IconButton aria-label="Fourth item">{FOURTH}</IconButton>
  </>
)

// A button and a field beside the icon buttons, which the bar holds as
// readily. The field's 56dp box and the bar's 8dp either side of it make the
// bar 72dp, past the 64dp it keeps for icon buttons alone.
const MIXED = (
  <>
    <IconButton aria-label="First item">{FIRST}</IconButton>
    <IconButton aria-label="Second item">{SECOND}</IconButton>
    <Separator />
    <TextField defaultValue="First item" label="Label" style={styles.field} />
    <Button variant="tonal">Label</Button>
  </>
)

const DISABLED = (
  <>
    <IconButton aria-label="First item">{FIRST}</IconButton>
    <IconButton aria-label="Second item" isDisabled>
      {SECOND}
    </IconButton>
    <Separator />
    <IconButton aria-label="Third item">{THIRD}</IconButton>
  </>
)

const meta = {
  args: {
    'aria-label': 'Label',
    children: CONTROLS,
  },
  component: Toolbar,
  title: 'Components/Toolbar',
} satisfies Meta<typeof Toolbar>

type Story = StoryObj<typeof meta>

const Default: Story = {}

const Vibrant: Story = {
  args: { tone: 'vibrant' },
}

const Vertical: Story = {
  args: { orientation: 'vertical' },
}

// Its own story because a field is what makes the bar grow past its 64dp,
// which a snapshot shows and the icon buttons never do.
const WithButtonAndField: Story = {
  args: { children: MIXED },
}

const Disabled: Story = {
  args: { children: DISABLED },
}

export { Default, Disabled, Vertical, Vibrant, WithButtonAndField }

export default meta
