import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { ComboBox } from '.'
import { SearchGlyph } from '../../glyphs'
import { ListBox } from '../list-box'
import { Stack } from '../stack'

// A combo box reads its options straight off `options`, so they are an
// array of elements rather than a fragment, which it would not look inside.
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

const FIRST_AND_THIRD = ['first', 'third']

const PEOPLE = [
  <ListBox.Item id="ada" key="ada">
    Ada Lovelace
  </ListBox.Item>,
  <ListBox.Item id="grace" key="grace">
    Grace Hopper
  </ListBox.Item>,
  <ListBox.Item id="alan" key="alan">
    Alan Turing
  </ListBox.Item>,
]

// The library's own glyphs stand in for an icon set, so the stories stay a
// demonstration of the field alone. It reads its colour and size from the
// slot it sits in.
const LEADING_ICON = <SearchGlyph />

const styles = StyleSheet.create({
  // A field fills its container, so the samples need a width to fill.
  width: {
    maxWidth: '100%',
    width: 320,
  },
})

// A filter that matches from the start of the text rather than anywhere in
// it, to show that the predicate is the call site's.
function startsWith(textValue: string, inputValue: string) {
  return textValue.toLowerCase().startsWith(inputValue.toLowerCase())
}

const meta = {
  args: {
    label: 'Label',
    options: OPTIONS,
  },
  component: ComboBox,
  title: 'Components/ComboBox',
} satisfies Meta<typeof ComboBox>

type Story = StoryObj<typeof meta>

const Default: Story = {
  render: (args) => (
    <View style={styles.width}>
      <ComboBox {...args} />
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

const WithLeadingIcon: Story = {
  args: { leadingIcon: LEADING_ICON },
  render: Default.render,
}

// Two options chosen, which the field draws before its input.
const Multiple: Story = {
  render: () => (
    <View style={styles.width}>
      <ComboBox
        defaultValue={FIRST_AND_THIRD}
        label="Label"
        options={OPTIONS}
        selectionMode="multiple"
      />
    </View>
  ),
}

// Its own story because `defaultFilter` takes a function, which the Controls
// panel cannot supply, and a predicate reads only against the default it
// replaces: type the same text into both.
const CustomFilter: Story = {
  render: () => (
    <Stack gap="lg" style={styles.width}>
      <ComboBox label="Contains" options={PEOPLE} />
      <ComboBox
        defaultFilter={startsWith}
        label="Starts with"
        options={PEOPLE}
      />
    </Stack>
  ),
}

export {
  Chosen,
  CustomFilter,
  Default,
  Disabled,
  Invalid,
  Multiple,
  Outlined,
  WithDescription,
  WithLeadingIcon,
}

export default meta
