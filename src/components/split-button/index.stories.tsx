import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { SplitButton } from '.'
import { Menu } from '../menu'

const styles = StyleSheet.create({
  // Room under the pair for its menu to open into.
  open: {
    alignItems: 'flex-start',
    minHeight: 240,
  },
})

const HALVES = [
  <SplitButton.Action key="action">Label</SplitButton.Action>,
  <SplitButton.Menu aria-label="More options" key="menu">
    <Menu.Item id="first">First item</Menu.Item>
    <Menu.Item id="second">Second item</Menu.Item>
    <Menu.Item id="third">Third item</Menu.Item>
  </SplitButton.Menu>,
]

const OPEN_HALVES = [
  <SplitButton.Action key="action">Label</SplitButton.Action>,
  <SplitButton.Menu aria-label="More options" defaultOpen key="menu">
    <Menu.Item id="first">First item</Menu.Item>
    <Menu.Item id="second">Second item</Menu.Item>
    <Menu.Item id="third">Third item</Menu.Item>
  </SplitButton.Menu>,
]

const meta = {
  args: {
    children: HALVES,
  },
  component: SplitButton,
  title: 'Components/SplitButton',
} satisfies Meta<typeof SplitButton>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// The menu open: the chevron centred and the inner corner rounded off. It
// opens as it renders, so on the Overview page it is drawn in a frame of its
// own, sized to hold the menu, rather than over the page.
const Open: Story = {
  args: {
    children: OPEN_HALVES,
  },
  parameters: { docs: { story: { height: '320px', inline: false } } },
  render: (args) => (
    <View style={styles.open}>
      <SplitButton {...args} />
    </View>
  ),
}

export { Default, Open }

export default meta
