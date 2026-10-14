import type { Meta, StoryObj } from '@storybook/react'
import type { ColorValue, ViewStyle } from 'react-native'

import { StyleSheet, View } from 'react-native'

import { SegmentedButton } from '.'
import { useIconStyle } from '../../glyphs/icon-style'

// Hoisted so the keys are not new arrays on every render, which is what
// react-perf's no-new-array-as-prop is after.
const FIRST = ['first']
const FIRST_AND_THIRD = ['first', 'third']
const NONE: string[] = []

const styles = StyleSheet.create({
  // A phone's 360dp less the 16dp margins either side.
  narrow: {
    width: 328,
  },
})

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

function dotOf(color: ColorValue | undefined, size: number): ViewStyle {
  return {
    backgroundColor: color,
    borderRadius: size / 4,
    height: size / 2,
    width: size / 2,
  }
}

const SEGMENTS = (
  <>
    <SegmentedButton.Segment id="first">First item</SegmentedButton.Segment>
    <SegmentedButton.Segment id="second">Second item</SegmentedButton.Segment>
    <SegmentedButton.Segment id="third">Third item</SegmentedButton.Segment>
  </>
)

const meta = {
  args: {
    'aria-label': 'Label',
    children: SEGMENTS,
    defaultSelectedKeys: FIRST,
  },
  component: SegmentedButton,
  title: 'Components/SegmentedButton',
} satisfies Meta<typeof SegmentedButton>

type Story = StoryObj<typeof meta>

const Default: Story = {}

const MultipleSelection: Story = {
  args: {
    defaultSelectedKeys: FIRST_AND_THIRD,
    selectionMode: 'multiple',
  },
}

const WithIcons: Story = {
  args: {
    children: (
      <>
        <SegmentedButton.Segment icon={DOT} id="first">
          First item
        </SegmentedButton.Segment>
        <SegmentedButton.Segment icon={DOT} id="second">
          Second item
        </SegmentedButton.Segment>
        <SegmentedButton.Segment icon={DOT} id="third">
          Third item
        </SegmentedButton.Segment>
      </>
    ),
  },
}

// An icon and an `aria-label` with no label: the icon is centred in its
// segment and kept while chosen, on the stronger container a set without a
// check draws, since a check in its place would hide which one is chosen.
const IconOnly: Story = {
  args: {
    children: (
      <>
        <SegmentedButton.Segment
          aria-label="First item"
          icon={DOT}
          id="first"
        />
        <SegmentedButton.Segment
          aria-label="Second item"
          icon={DOT}
          id="second"
        />
        <SegmentedButton.Segment
          aria-label="Third item"
          icon={DOT}
          id="third"
        />
      </>
    ),
  },
}

// The set on a phone-width container, narrower than the track asks for. The
// room a check needs is given back from the segments not drawing one before
// any label is cut.
const Narrow: Story = {
  render: (args) => (
    <View style={styles.narrow}>
      <SegmentedButton {...args} />
    </View>
  ),
}

const WithoutSelectedIcon: Story = {
  args: { showSelectedIcon: false },
}

const TwoSegments: Story = {
  args: {
    children: (
      <>
        <SegmentedButton.Segment id="first">First item</SegmentedButton.Segment>
        <SegmentedButton.Segment id="second">
          Second item
        </SegmentedButton.Segment>
      </>
    ),
  },
}

const Disabled: Story = {
  args: { isDisabled: true },
}

// What `disallowEmptySelection={false}` gives back: pressing the chosen
// segment clears it, leaving nothing chosen, which a single-select set
// otherwise never allows. Web's story presses it as it opens; this one opens
// with nothing chosen, which is the state that press ends in.
const EmptySelectionAllowed: Story = {
  args: { defaultSelectedKeys: NONE, disallowEmptySelection: false },
}

// Its own story because a single segment can be turned off without the set,
// which is a prop of the segment that the Controls panel cannot reach.
const DisabledSegment: Story = {
  args: {
    children: (
      <>
        <SegmentedButton.Segment id="first">First item</SegmentedButton.Segment>
        <SegmentedButton.Segment id="second" isDisabled>
          Second item
        </SegmentedButton.Segment>
        <SegmentedButton.Segment id="third">Third item</SegmentedButton.Segment>
      </>
    ),
  },
}

export {
  Default,
  Disabled,
  DisabledSegment,
  EmptySelectionAllowed,
  IconOnly,
  MultipleSelection,
  Narrow,
  TwoSegments,
  WithIcons,
  WithoutSelectedIcon,
}

export default meta
