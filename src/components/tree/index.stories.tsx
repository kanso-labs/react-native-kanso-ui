import type { Decorator, Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { Tree } from '.'
import { Card } from '../card'

const styles = StyleSheet.create({
  // A tree fills the column it sits in, so it needs one to have a width.
  width: {
    width: 380,
  },
})

// Hoisted so the keys are not a new value on every render, which is what
// react-perf's array rule is after.
const OPEN = ['first', 'second']

// A tree reads its parts straight off its children, so the rows are an array
// of elements rather than a fragment, which it would not look inside: a row
// with a row under it, which has one of its own, and a row on its own.
const ROWS = [
  <Tree.Item headline="First item" id="first" key="first">
    <Tree.Item headline="Second item" id="second">
      <Tree.Item headline="Third item" id="third" />
    </Tree.Item>
    <Tree.Item headline="Fourth item" id="fourth" />
  </Tree.Item>,
  <Tree.Item headline="Fifth item" id="fifth" key="fifth" />,
]

// An outlined card with no padding, whose corner clips the rows, so each
// sample has an edge and a width. A decorator rather than a `render`, which
// leaves the stories below nothing but `args`, and so every prop live in the
// Controls panel.
const Framed: Decorator = (Story) => (
  <View style={styles.width}>
    <Card padding="none" variant="outlined">
      <Story />
    </Card>
  </View>
)

const meta = {
  args: {
    'aria-label': 'Label',
    children: ROWS,
    defaultExpandedKeys: OPEN,
  },
  component: Tree,
  decorators: [Framed],
  // The device Storybook draws a story in a scroll view of its own, which a
  // tree scrolling by itself must not sit inside, so these opt out of it.
  parameters: { scrolls: true },
  title: 'Components/Tree',
} satisfies Meta<typeof Tree<object>>

type Story = StoryObj<typeof meta>

// Two levels open, each set in by its chevron's width, with a chevron on
// each row that opens and its space on each row that does not.
const Default: Story = {}

// Its own story because the checkbox column changes the row's leading edge,
// which a snapshot shows and a description cannot.
const Selectable: Story = {
  args: {
    defaultSelectedKeys: OPEN,
    selectionMode: 'multiple',
  },
}

// Two groups under their headings, the first holding a row that opens.
const Sections: Story = {
  args: {
    children: [
      <Tree.Section header="First group" id="first-group" key="first-group">
        <Tree.Item headline="First item" id="first">
          <Tree.Item headline="Second item" id="second" />
        </Tree.Item>
        <Tree.Item headline="Third item" id="third" />
      </Tree.Section>,
      <Tree.Section header="Second group" id="second-group" key="second-group">
        <Tree.Item headline="Fourth item" id="fourth" />
      </Tree.Section>,
    ],
  },
}

// Its own story because the ring is the one part of the tree that is drawn
// only while something is in flight.
const Loading: Story = {
  args: {
    children: [
      <Tree.Item headline="First item" id="first" key="first">
        <Tree.Item headline="Second item" id="second" />
      </Tree.Item>,
      <Tree.Item headline="Third item" id="third" key="third" />,
      <Tree.LoadMore isLoading key="loader" />,
    ],
  },
}

// The supporting line is a prop of the row, so no control on the tree
// reaches it. It grows the row past its 56dp floor exactly as it does in a
// list, and the chevron stays centred against the pair.
const TwoLine: Story = {
  args: {
    children: [
      <Tree.Item
        headline="First item"
        id="first"
        key="first"
        supporting="Supporting line"
      >
        <Tree.Item
          headline="Second item"
          id="second"
          supporting="Supporting line"
        >
          <Tree.Item headline="Third item" id="third" />
        </Tree.Item>
        <Tree.Item headline="Fourth item" id="fourth" />
      </Tree.Item>,
      <Tree.Item headline="Fifth item" id="fifth" key="fifth" />,
    ],
  },
}

export { Default, Loading, Sections, Selectable, TwoLine }

export default meta
