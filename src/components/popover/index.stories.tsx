import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { Popover } from '.'
import { PersonGlyph } from '../../glyphs'
import { Button } from '../button'
import { IconButton } from '../icon-button'
import { Stack } from '../stack'

// The library's own person glyph, hoisted so it is one stable element per
// render, which is what react-perf's no-jsx-as-prop is after.
const PERSON = <PersonGlyph />

// Laid out two by two, so each panel has room on the side it asks for: `top`
// beside the edge of the frame would flip to `bottom` instead.
const SIDES = ['top', 'right', 'left', 'bottom'] as const

// Each story opens its popover as it renders, so on the Overview page it is
// drawn in a frame of its own, sized to hold it, rather than over the page.
const FRAMED = { docs: { story: { height: '400px', inline: false } } }

const styles = StyleSheet.create({
  // Centres the trigger and leaves the open panel room below it, so the
  // story frames both.
  frame: {
    alignItems: 'center',
    padding: 64,
  },
  // Every open panel needs room on the side it asks for, or it flips and the
  // story shows the flip rather than the placement. A panel holding a title
  // alone is around 44dp tall, so the gutters are frame measurements wider
  // than the spacing scale goes.
  sides: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 96,
    padding: 96,
    width: 520,
  },
})

const meta = {
  args: { size: 'md' },
  component: Popover,
  parameters: FRAMED,
  title: 'Components/Popover',
} satisfies Meta<typeof Popover>

type Story = StoryObj<typeof meta>

// What most of the stories draw in the panel; only the popover around it
// differs.
function PanelContents() {
  return (
    <>
      <Popover.Title>Headline</Popover.Title>
      <Popover.Description>
        Supporting line describing what the popover is for.
      </Popover.Description>
      <Stack direction="row" gap="sm" justify="end">
        <Button slot="close" variant="text">
          Dismiss
        </Button>
      </Stack>
    </>
  )
}

// A popover below the button that opened it, centred on it. A press outside
// the panel, on the trigger, or on the button given `slot="close"` closes it.
const Default: Story = {
  render: (args) => (
    <View style={styles.frame}>
      <Popover {...args} defaultOpen>
        <Button>Open</Button>
        <Popover.Content>
          <PanelContents />
        </Popover.Content>
      </Popover>
    </View>
  ),
}

// A pointer resting on the trigger opens it, and on touch a press held on it
// does. Open as it renders, since a hovered popover nothing is hovering
// draws nothing to look at.
const HoverTrigger: Story = {
  args: { trigger: 'hover' },
  render: (args) => (
    <View style={styles.frame}>
      <Popover {...args} defaultOpen>
        <Button variant="outlined">Hover or press and hold</Button>
        <Popover.Content>
          <PanelContents />
        </Popover.Content>
      </Popover>
    </View>
  ),
}

// A modal popover keeps a screen reader inside the panel until it closes, as
// a dialog does, and draws no scrim.
const Modal: Story = {
  args: { modal: true },
  render: (args) => (
    <View style={styles.frame}>
      <Popover {...args} defaultOpen>
        <Button>Open</Button>
        <Popover.Content>
          <PanelContents />
        </Popover.Content>
      </Popover>
    </View>
  ),
}

// An IconButton opens a popover the way a Button does, with no visible label,
// so its `aria-label` names it.
const OnAnIconButton: Story = {
  render: (args) => (
    <View style={styles.frame}>
      <Popover {...args} defaultOpen>
        <IconButton aria-label="Label" variant="tonal">
          {PERSON}
        </IconButton>
        <Popover.Content>
          <PanelContents />
        </Popover.Content>
      </Popover>
    </View>
  ),
}

// All four sides at once: `side` names a preference, and what the panel does
// with it depends on the room around the trigger. Each panel carries a title,
// which is what names it.
const Sides: Story = {
  render: (args) => (
    <View style={styles.sides}>
      {SIDES.map((side) => (
        <Popover {...args} defaultOpen key={side}>
          <Button variant="outlined">{side}</Button>
          <Popover.Content side={side}>
            <Popover.Title>{side}</Popover.Title>
          </Popover.Content>
        </Popover>
      ))}
    </View>
  ),
}

// The narrower panel, which wraps the same supporting line sooner.
const Small: Story = {
  args: { size: 'sm' },
  render: Default.render,
}

export default meta
export { Default, HoverTrigger, Modal, OnAnIconButton, Sides, Small }
