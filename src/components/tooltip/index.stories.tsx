import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { Tooltip } from '.'
import { SearchGlyph } from '../../glyphs'
import { Button } from '../button'
import { IconButton } from '../icon-button'

// The library's own search glyph, hoisted so it is one stable element per
// render, which is what react-perf's no-jsx-as-prop is after.
const SEARCH = <SearchGlyph />

// The stories that open their tooltip as they render are drawn in a frame of
// their own on the Overview page, sized to hold it, rather than over the
// page.
const FRAMED = { docs: { story: { height: '200px', inline: false } } }

const styles = StyleSheet.create({
  // Room around the samples, so a tooltip opens on the side it is asked for
  // rather than flipping for want of space.
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 32,
    paddingVertical: 32,
  },
})

const meta = {
  args: {
    label: 'Supporting text',
  },
  component: Tooltip,
  title: 'Components/Tooltip',
} satisfies Meta<typeof Tooltip>

type Story = StoryObj<typeof meta>

// Open as it renders, below the button it describes, since a tooltip nothing
// is hovering or holding draws nothing to look at.
const Default: Story = {
  parameters: FRAMED,
  render: (args) => (
    <View style={styles.row}>
      <Tooltip {...args} defaultOpen side="bottom">
        <Button variant="outlined">Hover or press and hold</Button>
      </Tooltip>
    </View>
  ),
}

// The usual case: a button with no visible label, whose tooltip repeats the
// name its `aria-label` gives it.
const OnAnIconButton: Story = {
  args: {
    label: 'Search',
  },
  parameters: FRAMED,
  render: (args) => (
    <View style={styles.row}>
      <Tooltip {...args} defaultOpen side="bottom">
        <IconButton aria-label="Search">{SEARCH}</IconButton>
      </Tooltip>
    </View>
  ),
}

// Its own story because the cap is what a long label runs into: 320dp wide at
// most, with the label running on over as many lines as it needs.
const LongLabel: Story = {
  args: {
    label:
      'Supporting text long enough to pass the width the tooltip allows. It wraps onto further lines rather than running the width of the window.',
  },
  parameters: FRAMED,
  render: (args) => (
    <View style={styles.row}>
      <Tooltip {...args} defaultOpen side="bottom">
        <Button variant="outlined">Hover or press and hold</Button>
      </Tooltip>
    </View>
  ),
}

// Opens above by default and flips to the opposite side when there is no
// room; `side` and `align` place it and `sideOffset` sets the gap. Hover a
// button, or hold a press on it, to see each tooltip open.
const Sides: Story = {
  render: () => (
    <View style={styles.row}>
      <Tooltip label="Above" side="top">
        <Button variant="outlined">Top</Button>
      </Tooltip>
      <Tooltip label="Below" side="bottom">
        <Button variant="outlined">Bottom</Button>
      </Tooltip>
      <Tooltip label="Before" side="left">
        <Button variant="outlined">Left</Button>
      </Tooltip>
      <Tooltip label="After" side="right">
        <Button variant="outlined">Right</Button>
      </Tooltip>
    </View>
  ),
}

export { Default, LongLabel, OnAnIconButton, Sides }

export default meta
