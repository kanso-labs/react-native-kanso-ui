import type { Meta, StoryObj } from '@storybook/react'

import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import type { Key } from '../..'

import { Breadcrumbs } from '.'
import { Stack } from '../stack'
import { Text } from '../text'

const TRAIL = (
  <>
    <Breadcrumbs.Item href="/first">First item</Breadcrumbs.Item>
    <Breadcrumbs.Item href="/second">Second item</Breadcrumbs.Item>
    <Breadcrumbs.Item>Third item</Breadcrumbs.Item>
  </>
)

const TWO_ITEMS = (
  <>
    <Breadcrumbs.Item href="/first">First item</Breadcrumbs.Item>
    <Breadcrumbs.Item>Second item</Breadcrumbs.Item>
  </>
)

const styles = StyleSheet.create({
  // A narrow column, as web's story is, so the long trail has something to
  // wrap inside.
  narrow: {
    maxWidth: '100%',
    width: 320,
  },
})

const meta = {
  args: {
    'aria-label': 'Label',
    children: TRAIL,
  },
  component: Breadcrumbs,
  title: 'Components/Breadcrumbs',
} satisfies Meta<typeof Breadcrumbs>

type Story = StoryObj<typeof meta>

// What the routed trail hands a key to. Built by a call rather than written
// inline at the prop, which is what react-perf's no-new-function-as-prop is
// after.
function reportTo(setPressed: (pressed: string) => void) {
  return (key: Key) => {
    setPressed(String(key))
  }
}

// A trail whose items report their key rather than navigating, which is what
// a screen routing on its own needs, with the key it last reported under it.
function Routed() {
  const [pressed, setPressed] = useState<string>('none')

  return (
    <Stack gap="xxs">
      <Breadcrumbs aria-label="Routed" onAction={reportTo(setPressed)}>
        <Breadcrumbs.Item id="first">First item</Breadcrumbs.Item>
        <Breadcrumbs.Item id="second">Second item</Breadcrumbs.Item>
        <Breadcrumbs.Item id="third">Third item</Breadcrumbs.Item>
      </Breadcrumbs>
      <Text tone="muted" variant="bodySmall">
        Last pressed: {pressed}
      </Text>
    </Stack>
  )
}

const Default: Story = {}

const TwoItems: Story = {
  args: { children: TWO_ITEMS },
}

const Disabled: Story = {
  args: { isDisabled: true },
}

// Its own story because it takes a deep trail and a column too narrow for it:
// the row wraps rather than scrolling or truncating, so nothing runs off the
// edge.
const LongTrail: Story = {
  render: () => (
    <View style={styles.narrow}>
      <Breadcrumbs aria-label="Long">
        <Breadcrumbs.Item href="/first">First item</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/second">Second item</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/third">Third item</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/fourth">Fourth item</Breadcrumbs.Item>
        <Breadcrumbs.Item>Fifth item</Breadcrumbs.Item>
      </Breadcrumbs>
    </View>
  ),
}

// Its own story because it has to be driven: a screen that routes on its own
// gives each item an id and the trail an `onAction`, which reports the key
// that was pressed. The items are still announced as links.
const RoutedTrail: Story = {
  render: () => <Routed />,
}

export { Default, Disabled, LongTrail, RoutedTrail, TwoItems }

export default meta
