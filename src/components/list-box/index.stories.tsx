import type { Decorator, Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { ListBox } from '.'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'
import { Avatar } from '../avatar'
import { Text } from '../text'

// Hoisted so neither the keys nor the slots are new values on every render,
// which is what react-perf's array and JSX rules are after.
const ADA = <Avatar name="Ada Lovelace" size="sm" />
const COUNT_ONE = (
  <Text tone="muted" variant="labelMedium">
    01
  </Text>
)
const COUNT_TWO = (
  <Text tone="muted" variant="labelMedium">
    02
  </Text>
)
const FIRST_AND_THIRD = ['first', 'third']
const GRACE = <Avatar name="Grace Hopper" size="sm" />
const SECOND = ['second']
const THIRD = ['third']

// A list reads its parts straight off its children, so the options are an
// array of elements rather than a fragment, which it would not look inside.
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

const stylesOf = themedStyles(({ colors, radii, spacing }) =>
  StyleSheet.create({
    // What a list with nothing in it shows. `renderEmptyState` returns
    // whatever the call site draws, so the inset and the muted role are the
    // page's rather than the component's.
    empty: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    // A list takes whatever it sits on, so the samples need a width and
    // something to sit on: a surface with a corner, the shape a picker's
    // popover gives it.
    surface: {
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radii.md,
      maxWidth: '100%',
      overflow: 'hidden',
      width: 320,
    },
  }),
)

// A decorator rather than a `render`, which leaves most stories below
// nothing but `args`, and so every prop live in the Controls panel.
const OnASurface: Decorator = (Story) => (
  <View style={stylesOf(useTheme()).surface}>
    <Story />
  </View>
)

function EmptyState() {
  return (
    <View style={stylesOf(useTheme()).empty}>
      <Text tone="muted">Nothing to show</Text>
    </View>
  )
}

const meta = {
  args: {
    'aria-label': 'Label',
    children: OPTIONS,
    selectionMode: 'single',
  },
  component: ListBox,
  decorators: [OnASurface],
  // The device Storybook draws a story in a scroll view of its own, which a
  // list scrolling by itself must not sit inside, so these opt out of it.
  parameters: { scrolls: true },
  title: 'Components/ListBox',
} satisfies Meta<typeof ListBox<object>>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// The selected option on primary container, with no checkbox: the container
// is the whole of the selected state.
const Selected: Story = {
  args: { defaultSelectedKeys: SECOND },
}

// The three heights an option's lines give it.
const ThreeLine: Story = {
  args: {
    children: [
      <ListBox.Item
        id="first"
        key="first"
        overline="Overline"
        supporting="Supporting line"
      >
        First item
      </ListBox.Item>,
      <ListBox.Item id="second" key="second" overline="Overline">
        Second item
      </ListBox.Item>,
      <ListBox.Item id="third" key="third" supporting="Supporting line">
        Third item
      </ListBox.Item>,
    ],
  },
}

// An option is the row every list here draws, so it takes the same leading,
// supporting and trailing content a ListItem does. A disabled option cannot
// be selected.
const WithSlots: Story = {
  args: {
    children: [
      <ListBox.Item
        id="first"
        key="first"
        leading={ADA}
        supporting="Supporting line"
        trailing={COUNT_ONE}
      >
        Ada Lovelace
      </ListBox.Item>,
      <ListBox.Item
        id="second"
        key="second"
        leading={GRACE}
        supporting="Supporting line"
        trailing={COUNT_TWO}
      >
        Grace Hopper
      </ListBox.Item>,
      <ListBox.Item id="third" key="third" supporting="Supporting line">
        Third item
      </ListBox.Item>,
    ],
    disabledKeys: THIRD,
  },
}

const MultipleSelection: Story = {
  args: {
    defaultSelectedKeys: FIRST_AND_THIRD,
    selectionMode: 'multiple',
  },
}

const Disabled: Story = {
  args: { disabledKeys: SECOND },
}

// A heading per group, which scrolls with the options, since the list has
// no ground to cover them with.
const Sections: Story = {
  args: {
    children: [
      <ListBox.Section header="First group" id="first-group" key="first-group">
        <ListBox.Item id="first">First item</ListBox.Item>
        <ListBox.Item id="second">Second item</ListBox.Item>
      </ListBox.Section>,
      <ListBox.Section
        header="Second group"
        id="second-group"
        key="second-group"
      >
        <ListBox.Item id="third">Third item</ListBox.Item>
      </ListBox.Section>,
    ],
  },
}

// The ring in a row of its own after the options, while the next ones are on
// their way.
const Loading: Story = {
  args: {
    children: [
      <ListBox.Item id="first" key="first">
        First item
      </ListBox.Item>,
      <ListBox.Item id="second" key="second">
        Second item
      </ListBox.Item>,
      <ListBox.LoadMore isLoading key="loader" />,
    ],
  },
}

const Empty: Story = {
  args: {
    children: [],
    renderEmptyState: emptyState,
  },
}

// Built by a call rather than written inline at the prop, which is what
// react-perf's no-new-function-as-prop is after.
function emptyState() {
  return <EmptyState />
}

export {
  Default,
  Disabled,
  Empty,
  Loading,
  MultipleSelection,
  Sections,
  Selected,
  ThreeLine,
  WithSlots,
}

export default meta
