import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { Menu } from '.'
import { PersonGlyph, PlusGlyph } from '../../glyphs'
import { Button } from '../button'
import { Chip } from '../chip'

// Hoisted so neither the keys nor the slots are new values on every render,
// which is what react-perf's array and JSX rules are after.
const SECOND = ['second']
const FIRST_AND_THIRD = ['first', 'third']
const PERSON = <PersonGlyph />
const PLUS = <PlusGlyph />

// Each story opens its menu as it renders, so on the Overview page it is
// drawn in a frame of its own, sized to hold it, rather than over the page.
const FRAMED = { docs: { story: { height: '360px', inline: false } } }

const styles = StyleSheet.create({
  // Leaves the open menu room below and beside its trigger, so the story
  // frames both, a submenu's room included.
  frame: {
    alignItems: 'flex-start',
    padding: 64,
  },
})

const meta = {
  component: Menu,
  parameters: FRAMED,
  title: 'Components/Menu',
} satisfies Meta<typeof Menu>

type Story = StoryObj<typeof meta>

// An assist chip opening a menu of choices, as a chip that picks a value
// does: the chip says the menu is open, and the menu is placed below it,
// lined up with its start, with the current choice selected.
const ChipTrigger: Story = {
  render: (args) => (
    <View style={styles.frame}>
      <Menu {...args} defaultOpen>
        <Chip variant="assist">Label</Chip>
        <Menu.Content defaultSelectedKeys={SECOND} selectionMode="single">
          <Menu.Item id="first">First item</Menu.Item>
          <Menu.Item id="second">Second item</Menu.Item>
          <Menu.Item id="third">Third item</Menu.Item>
        </Menu.Content>
      </Menu>
    </View>
  ),
}

// Open on load, since a closed menu draws nothing but its trigger. Below the
// button that opened it, lined up with its start, with a rule between the
// items that belong apart and a disabled item at the end.
const Default: Story = {
  render: (args) => (
    <View style={styles.frame}>
      <Menu {...args} defaultOpen>
        <Button variant="outlined">Actions</Button>
        <Menu.Content>
          <Menu.Item id="cut">Cut</Menu.Item>
          <Menu.Item id="copy">Copy</Menu.Item>
          <Menu.Separator />
          <Menu.Item id="delete" isDisabled>
            Delete
          </Menu.Item>
        </Menu.Content>
      </Menu>
    </View>
  ),
}

// Content before each label, which takes the label's colour at the menus
// page's 24dp.
const Leading: Story = {
  render: (args) => (
    <View style={styles.frame}>
      <Menu {...args} defaultOpen>
        <Button variant="outlined">Label</Button>
        <Menu.Content>
          <Menu.Item id="first" leading={PERSON}>
            First item
          </Menu.Item>
          <Menu.Item id="second" leading={PLUS}>
            Second item
          </Menu.Item>
        </Menu.Content>
      </Menu>
    </View>
  ),
}

// The ring in a row of its own, an item's height, while more items are on
// their way.
const Loading: Story = {
  render: (args) => (
    <View style={styles.frame}>
      <Menu {...args} defaultOpen>
        <Button variant="outlined">Actions</Button>
        <Menu.Content>
          <Menu.Item id="first">First item</Menu.Item>
          <Menu.Item id="second">Second item</Menu.Item>
          <Menu.LoadMore isLoading />
        </Menu.Content>
      </Menu>
    </View>
  ),
}

// Any number chosen at once, each marked by the check at the end of its row
// as well as the container: the check is what carries the choice where the
// container is hard to tell from the surface. A press here toggles an item
// and leaves the menu open.
const MultipleSelection: Story = {
  render: (args) => (
    <View style={styles.frame}>
      <Menu {...args} defaultOpen>
        <Button variant="outlined">Label</Button>
        <Menu.Content
          defaultSelectedKeys={FIRST_AND_THIRD}
          selectionMode="multiple"
        >
          <Menu.Item id="first">First item</Menu.Item>
          <Menu.Item id="second">Second item</Menu.Item>
          <Menu.Item id="third">Third item</Menu.Item>
        </Menu.Content>
      </Menu>
    </View>
  ),
}

// Two named groups with one choice between them, the heading in title small
// above each.
const Sections: Story = {
  render: (args) => (
    <View style={styles.frame}>
      <Menu {...args} defaultOpen>
        <Button variant="outlined">Sort</Button>
        <Menu.Content defaultSelectedKeys={SECOND} selectionMode="single">
          <Menu.Section header="Order">
            <Menu.Item id="first">Ascending</Menu.Item>
            <Menu.Item id="second">Descending</Menu.Item>
          </Menu.Section>
          <Menu.Separator />
          <Menu.Section header="Field">
            <Menu.Item id="third">Name</Menu.Item>
          </Menu.Section>
        </Menu.Content>
      </Menu>
    </View>
  ),
}

// The item that opens a submenu draws the chevron, pointing at the inline
// end where the submenu opens, and mirrored under right-to-left. A press on
// it opens the submenu beside it.
const Submenu: Story = {
  render: (args) => (
    <View style={styles.frame}>
      <Menu {...args} defaultOpen>
        <Button variant="outlined">Share</Button>
        <Menu.Content>
          <Menu.Item id="link">Copy link</Menu.Item>
          <Menu.Submenu>
            <Menu.Item id="send">Send to</Menu.Item>
            <Menu.Content>
              <Menu.Item id="ada">Ada Lovelace</Menu.Item>
              <Menu.Item id="grace">Grace Hopper</Menu.Item>
            </Menu.Content>
          </Menu.Submenu>
        </Menu.Content>
      </Menu>
    </View>
  ),
}

// An item given an `href` follows it when chosen, through the app's router,
// drawn exactly as the items beside it are: a menu's items are all followed
// the same way, so none of them is set apart as a link.
const WithLink: Story = {
  render: (args) => (
    <View style={styles.frame}>
      <Menu {...args} defaultOpen>
        <Button variant="outlined">Label</Button>
        <Menu.Content>
          <Menu.Item id="first">First item</Menu.Item>
          <Menu.Item href="/second" id="second">
            Second item
          </Menu.Item>
          <Menu.Item id="third">Third item</Menu.Item>
        </Menu.Content>
      </Menu>
    </View>
  ),
}

export {
  ChipTrigger,
  Default,
  Leading,
  Loading,
  MultipleSelection,
  Sections,
  Submenu,
  WithLink,
}

export default meta
