import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { Select } from '.'
import { SearchGlyph } from '../../glyphs'
import { ListBox } from '../list-box'

// A select reads its options straight off `options`, so they are an array
// of elements rather than a fragment, which it would not look inside.
// Hoisted so neither they nor the icon are new values on every render, which
// is what react-perf's array and JSX rules are after.
const OPTIONS = [
  <ListBox.Item id="first" key="first">
    First item
  </ListBox.Item>,
  <ListBox.Item id="second" key="second">
    Second item
  </ListBox.Item>,
  <ListBox.Item id="third" key="third">
    Third item
  </ListBox.Item>,
]

const GROUPED = [
  <ListBox.Section header="First group" id="first-group" key="first-group">
    <ListBox.Item id="first">First item</ListBox.Item>
    <ListBox.Item id="second">Second item</ListBox.Item>
  </ListBox.Section>,
  <ListBox.Section header="Second group" id="second-group" key="second-group">
    <ListBox.Item id="third">Third item</ListBox.Item>
  </ListBox.Section>,
]

// The library's own glyphs stand in for an icon set, so the stories stay a
// demonstration of the field alone. It reads its colour and size from the
// slot it sits in.
const LEADING_ICON = <SearchGlyph />

// A story opening its list as it renders is drawn in a frame of its own on
// the Overview page, sized to hold the list, rather than over the page.
const FRAMED = { docs: { story: { height: '360px', inline: false } } }

const styles = StyleSheet.create({
  // A field fills its container, so the samples need a width to fill.
  width: {
    maxWidth: '100%',
    width: 320,
  },
})

const meta = {
  args: {
    label: 'Label',
    options: OPTIONS,
  },
  component: Select,
  title: 'Components/Select',
} satisfies Meta<typeof Select>

type Story = StoryObj<typeof meta>

const Default: Story = {
  render: (args) => (
    <View style={styles.width}>
      <Select {...args} />
    </View>
  ),
}

const Chosen: Story = {
  args: { defaultValue: 'second' },
  render: Default.render,
}

const Outlined: Story = {
  args: { variant: 'outlined' },
  render: Default.render,
}

const WithDescription: Story = {
  args: { description: 'Supporting line' },
  render: Default.render,
}

const Invalid: Story = {
  args: { error: 'Choose an item' },
  render: Default.render,
}

const Disabled: Story = {
  args: { isDisabled: true },
  render: Default.render,
}

// Open on load, scrolled to the chosen option, which is marked.
const Open: Story = {
  args: { defaultOpen: true, defaultValue: 'second' },
  parameters: FRAMED,
  render: Default.render,
}

const WithLeadingIcon: Story = {
  args: { leadingIcon: LEADING_ICON },
  render: Default.render,
}

// Its own story because the list is a ListBox, so it takes sections with
// headings as well as plain options. Open on load, since the groups cannot be
// seen until it is.
const Grouped: Story = {
  args: { defaultOpen: true, options: GROUPED },
  parameters: FRAMED,
  render: Default.render,
}

export {
  Chosen,
  Default,
  Disabled,
  Grouped,
  Invalid,
  Open,
  Outlined,
  WithDescription,
  WithLeadingIcon,
}

export default meta
