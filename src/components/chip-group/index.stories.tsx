import type { Decorator, Meta, StoryObj } from '@storybook/react'
import type { ColorValue, ViewStyle } from 'react-native'

import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import type { Key } from '../..'

import { ChipGroup } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { Text } from '../text'

const SECOND = ['second']
const FIRST_AND_THIRD = ['first', 'third']
const LONG = ['long']

const CHIPS = (
  <>
    <ChipGroup.Chip id="first">First item</ChipGroup.Chip>
    <ChipGroup.Chip id="second">Second item</ChipGroup.Chip>
    <ChipGroup.Chip id="third">Third item</ChipGroup.Chip>
  </>
)

// An icon slot takes any node, and a plain dot keeps the sample generic: web's
// story draws a circle half the slot across, and this one is that circle as a
// view, in the colour and at the size the slot hands it through
// useIconStyle(), as an app's own icon reads them.
function Dot() {
  const { color, size } = useIconStyle()

  return <View style={dotOf(color, size)} />
}

// Hoisted so it is one stable element per render, which is what react-perf's
// no-jsx-as-prop is after.
const DOT = <Dot />

const ICON_CHIPS = (
  <>
    <ChipGroup.Chip icon={DOT} id="first">
      First item
    </ChipGroup.Chip>
    <ChipGroup.Chip icon={DOT} id="second">
      Second item
    </ChipGroup.Chip>
    <ChipGroup.Chip icon={DOT} id="third">
      Third item
    </ChipGroup.Chip>
  </>
)

// A group whose chips can actually be removed, since removal is the one thing
// a static story cannot show.
const ITEMS = [
  { id: 'first', label: 'First item' },
  { id: 'second', label: 'Second item' },
  { id: 'third', label: 'Third item' },
]

const styles = StyleSheet.create({
  // Narrower than the long label on one line.
  narrow: {
    maxWidth: 280,
  },
  // Wide enough for the three chips on one line, as web's story is, and never
  // wider than the screen.
  width: {
    maxWidth: '100%',
    width: 420,
  },
})

function dotOf(color: ColorValue | undefined, size: number): ViewStyle {
  return {
    backgroundColor: color,
    borderRadius: size / 4,
    height: size / 2,
    width: size / 2,
  }
}

function emptyState() {
  return (
    <Text tone="muted" variant="bodyMedium">
      Empty state
    </Text>
  )
}

// The `Removing` story shows the close target rather than what pressing it
// does, which `RemovableChips` covers instead.
function noop(_keys: Set<Key>) {}

function Removable() {
  const [items, setItems] = useState(ITEMS)

  return (
    <ChipGroup
      label="Removable"
      onRemove={removeFrom(setItems)}
      selectionMode="multiple"
    >
      {items.map((item) => (
        <ChipGroup.Chip id={item.id} key={item.id}>
          {item.label}
        </ChipGroup.Chip>
      ))}
    </ChipGroup>
  )
}

// Built by a call rather than written inline at the prop, which is what
// react-perf's jsx-no-new-function-as-prop is after; the React Compiler
// memoises the result on its inputs.
function removeFrom(
  setItems: (update: (current: typeof ITEMS) => typeof ITEMS) => void,
) {
  return (keys: Set<Key>) => {
    setItems((current) => current.filter((item) => !keys.has(item.id)))
  }
}

const Wide: Decorator = (Story) => (
  <View style={styles.width}>
    <Story />
  </View>
)

const meta = {
  args: {
    children: CHIPS,
    label: 'Label',
  },
  component: ChipGroup,
  decorators: [Wide],
  title: 'Components/ChipGroup',
} satisfies Meta<typeof ChipGroup<object>>

type Story = StoryObj<typeof meta>

const Default: Story = {}

const SingleSelection: Story = {
  args: { defaultSelectedKeys: SECOND, selectionMode: 'single' },
}

const MultipleSelection: Story = {
  args: {
    defaultSelectedKeys: FIRST_AND_THIRD,
    selectionMode: 'multiple',
  },
}

const Removing: Story = {
  args: { onRemove: noop, selectionMode: 'multiple' },
}

const WithDescription: Story = {
  args: { description: 'Supporting line' },
}

const Invalid: Story = {
  args: { error: 'Choose at least one' },
}

const Disabled: Story = {
  args: { disabledKeys: SECOND },
}

const WithIcons: Story = {
  args: {
    children: ICON_CHIPS,
    defaultSelectedKeys: SECOND,
    selectionMode: 'multiple',
  },
}

// Its own story because it takes a narrow row as well as a long label: a chip
// is never wider than its row, so a label with no room ends in an ellipsis
// rather than wrapping, and the check and close target stay inside the pill.
const LongLabel: Story = {
  render: () => (
    <View style={styles.narrow}>
      <ChipGroup
        defaultSelectedKeys={LONG}
        label="Label"
        onRemove={noop}
        selectionMode="multiple"
      >
        <ChipGroup.Chip id="long">
          A label long enough that it has nowhere left to go on one line
        </ChipGroup.Chip>
        <ChipGroup.Chip id="second">Second item</ChipGroup.Chip>
      </ChipGroup>
    </View>
  ),
}

// Its own story because removal is the one thing a static story cannot show:
// the group keeps its chips in state, and each close target removes one.
const RemovableChips: Story = {
  render: () => <Removable />,
}

// The group once its last chip is removed: the row keeps a chip's height, so
// nothing under it moves, and draws what `renderEmptyState` gives it.
const EmptyState: Story = {
  args: {
    children: [],
    onRemove: noop,
    renderEmptyState: emptyState,
  },
}

export {
  Default,
  Disabled,
  EmptyState,
  Invalid,
  LongLabel,
  MultipleSelection,
  RemovableChips,
  Removing,
  SingleSelection,
  WithDescription,
  WithIcons,
}

export default meta
