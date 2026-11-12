import type { Decorator, Meta, StoryObj } from '@storybook/react'
import type { ReactNode } from 'react'

import { StyleSheet, View } from 'react-native'

import { List } from '.'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'
import { Avatar } from '../avatar'
import { Card } from '../card'
import { Currency } from '../currency'

const styles = StyleSheet.create({
  // A list that scrolls by itself needs a height it can be taller than,
  // which is what makes it draw only the rows in view.
  scroller: {
    height: 480,
  },
  // A list fills the column it sits in, so it needs one to have a width,
  // and no wider than the page, so a phone shows it whole.
  width: {
    maxWidth: '100%',
    width: 380,
  },
})

const stylesOf = themedStyles(({ colors }) =>
  StyleSheet.create({
    // The view `InAView` draws its second row inside, with a dashed border so
    // it shows. An app's own draws nothing: it is the view a screen
    // transition library measures.
    wrapper: {
      borderColor: colors.outline,
      borderStyle: 'dashed',
      borderWidth: 1,
    },
  }),
)

// Hoisted so neither the keys nor the slots are new values on every render,
// which is what react-perf's array and JSX rules are after.
const ADA = <Avatar name="Ada Lovelace" />
const AMOUNT_ONE = <Currency locale="en-US" value={1250} />
const AMOUNT_TWO = <Currency locale="en-US" value={480} />
const FIRST_AND_THIRD = ['first', 'third']
const GRACE = <Avatar name="Grace Hopper" tone="tertiary" />
const SECOND = ['second']

// A list reads its parts straight off its children, so the rows are an
// array of elements rather than a fragment, which it would not look inside.
const ROWS = [
  <List.Item id="first" key="first">
    First item
  </List.Item>,
  <List.Item id="second" key="second">
    Second item
  </List.Item>,
  <List.Item id="third" key="third">
    Third item
  </List.Item>,
]

// Enough rows that drawing every one would show, numbered in sequence,
// which carries no unit.
const MANY = Array.from({ length: 1000 }, (_unused, index) => ({
  id: `row${String(index)}`,
  name: `Item ${String(index + 1).padStart(4, '0')}`,
}))

// An outlined card with no padding, whose corner clips the rows, so each
// sample has an edge and a width. A decorator rather than a `render`, which
// leaves most stories below nothing but `args`, and so every prop live in
// the Controls panel.
const Framed: Decorator = (Story) => (
  <View style={styles.width}>
    <Card padding="none" variant="outlined">
      <Story />
    </Card>
  </View>
)

// A row's `render`: the row it is handed, inside a view of the story's own.
function inAView(row: ReactNode) {
  return <Wrapper>{row}</Wrapper>
}

function Wrapper({ children }: { readonly children: ReactNode }) {
  return <View style={stylesOf(useTheme()).wrapper}>{children}</View>
}

const meta = {
  args: {
    'aria-label': 'Label',
    children: ROWS,
    selectionMode: 'multiple',
  },
  component: List,
  decorators: [Framed],
  // The device Storybook draws a story in a scroll view of its own, which a
  // list scrolling by itself must not sit inside, so these opt out of it.
  parameters: { scrolls: true },
  title: 'Components/List',
} satisfies Meta<typeof List<object>>

type Story = StoryObj<typeof meta>

// A list that selects several rows, with a checkbox on every one.
const Default: Story = {}

// Each selected row on primary container with its box checked, so the
// selection reads without the box as well as with it.
const Selected: Story = {
  args: { defaultSelectedKeys: FIRST_AND_THIRD },
}

// One row at a time: selecting another moves the selection to it.
const SingleSelection: Story = {
  args: {
    defaultSelectedKeys: SECOND,
    selectionMode: 'single',
  },
}

// The row is ListItem's, so it takes the same leading, supporting and
// trailing content, each a node on the item, which the Controls panel cannot
// reach through `children`. A list that neither selects nor acts presents
// its rows.
const WithSlots: Story = {
  args: {
    children: [
      <List.Item
        id="first"
        key="first"
        leading={ADA}
        supporting="Supporting line"
        trailing={AMOUNT_ONE}
      >
        Ada Lovelace
      </List.Item>,
      <List.Item
        id="second"
        key="second"
        leading={GRACE}
        supporting="Supporting line"
        trailing={AMOUNT_TWO}
      >
        Grace Hopper
      </List.Item>,
    ],
    selectionMode: 'none',
  },
}

// The three heights a row's lines give it, the checkbox held at the top of
// the three-line row with the rest of its slots.
const ThreeLine: Story = {
  args: {
    children: [
      <List.Item
        id="first"
        key="first"
        overline="Overline"
        supporting="Supporting line"
      >
        First item
      </List.Item>,
      <List.Item id="second" key="second" overline="Overline">
        Second item
      </List.Item>,
      <List.Item id="third" key="third" supporting="Supporting line">
        Third item
      </List.Item>,
    ],
  },
}

const Disabled: Story = {
  args: { disabledKeys: SECOND },
}

// A heading per group, which stays at the top of the list while the group's
// rows scroll under it.
const Sections: Story = {
  args: {
    children: [
      <List.Section header="First group" id="first-group" key="first-group">
        <List.Item id="first">First item</List.Item>
        <List.Item id="second">Second item</List.Item>
      </List.Section>,
      <List.Section header="Second group" id="second-group" key="second-group">
        <List.Item id="third">Third item</List.Item>
      </List.Section>,
    ],
  },
}

// The ring in a row of its own after the rows, while the next ones are on
// their way.
const Loading: Story = {
  args: {
    children: [
      <List.Item id="first" key="first">
        First item
      </List.Item>,
      <List.Item id="second" key="second">
        Second item
      </List.Item>,
      <List.LoadMore isLoading key="loader" />,
    ],
  },
}

// The second row drawn inside a view of the story's own, through the row's
// `render`, which is where an app puts the view a screen transition library
// measures to open a page out of the row that was pressed. The row inside
// ripples and selects as the one above it does.
const InAView: Story = {
  args: {
    children: [
      <List.Item id="first" key="first">
        First item
      </List.Item>,
      <List.Item id="second" key="second" render={inAView}>
        Second item
      </List.Item>,
    ],
  },
}

// A thousand rows in a list a few hundred dp tall, of which only those in
// view and a few screens either side are drawn.
const Long: Story = {
  render: (args) => (
    <View style={styles.scroller}>
      <List {...args} items={MANY}>
        {(row) => (
          <List.Item id={row.id} supporting="Supporting line">
            {row.name}
          </List.Item>
        )}
      </List>
    </View>
  ),
}

export {
  Default,
  Disabled,
  InAView,
  Loading,
  Long,
  Sections,
  Selected,
  SingleSelection,
  ThreeLine,
  WithSlots,
}

export default meta
