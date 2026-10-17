import type { Decorator, Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { DisclosureGroup } from '.'
import { Card } from '../card'
import { Disclosure } from '../disclosure'
import { Text } from '../text'

// Hoisted so the keys are not new arrays on every render, which is what
// react-perf's no-new-array-as-prop is after.
const FIRST = ['first']
const FIRST_AND_THIRD = ['first', 'third']

const styles = StyleSheet.create({
  // A group fills what it is given, so the samples need a width.
  width: {
    width: 360,
  },
})

function body(text: string) {
  return (
    <Text tone="muted" variant="bodyMedium">
      {text}
    </Text>
  )
}

const SECTIONS = (
  <>
    <Disclosure id="first">
      <Disclosure.Header>First item</Disclosure.Header>
      <Disclosure.Panel>
        {body('Supporting line for the first.')}
      </Disclosure.Panel>
    </Disclosure>
    <Disclosure id="second">
      <Disclosure.Header>Second item</Disclosure.Header>
      <Disclosure.Panel>
        {body('Supporting line for the second.')}
      </Disclosure.Panel>
    </Disclosure>
    <Disclosure id="third">
      <Disclosure.Header>Third item</Disclosure.Header>
      <Disclosure.Panel>
        {body('Supporting line for the third.')}
      </Disclosure.Panel>
    </Disclosure>
  </>
)

// A decorator rather than a `render`, which leaves the stories below nothing
// but `args`, and so every prop live in the Controls panel. The group draws
// no container of its own, so the card gives it a surface and a boundary.
const OnACard: Decorator = (Story) => (
  <View style={styles.width}>
    <Card padding="none" variant="outlined">
      <Story />
    </Card>
  </View>
)

const meta = {
  args: {
    children: SECTIONS,
    defaultExpandedKeys: FIRST,
  },
  component: DisclosureGroup,
  decorators: [OnACard],
  title: 'Components/DisclosureGroup',
} satisfies Meta<typeof DisclosureGroup>

type Story = StoryObj<typeof meta>

// One section open at a time: opening another closes the first.
const Default: Story = {}

const MultipleExpanded: Story = {
  args: {
    allowsMultipleExpanded: true,
    defaultExpandedKeys: FIRST_AND_THIRD,
  },
}

const Undivided: Story = {
  args: { divided: false },
}

// Every header fades and takes no press, and the sections stay as they are.
const Disabled: Story = {
  args: { isDisabled: true },
}

export { Default, Disabled, MultipleExpanded, Undivided }

export default meta
