import type { Decorator, Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { Disclosure } from '.'
import { Avatar } from '../avatar'
import { Card } from '../card'
import { Text } from '../text'

const styles = StyleSheet.create({
  // A section fills what it is given, so the samples need a width.
  width: {
    width: 360,
  },
})

// Hoisted so the slot is one stable element per render, which is what
// react-perf's no-jsx-as-prop is after.
const ADA = <Avatar name="Ada Lovelace" size="sm" />

const BODY = (
  <Text tone="muted" variant="bodyMedium">
    Supporting line. The panel opens to whatever height its content reports, and
    closes back to nothing.
  </Text>
)

// A decorator rather than a `render`, which leaves the stories below nothing
// but `args`, and so every prop live in the Controls panel. The card gives
// the section a surface and a boundary to sit inside.
const OnACard: Decorator = (Story) => (
  <View style={styles.width}>
    <Card padding="none" variant="outlined">
      <Story />
    </Card>
  </View>
)

const meta = {
  args: {
    children: (
      <>
        <Disclosure.Header>Headline</Disclosure.Header>
        <Disclosure.Panel>{BODY}</Disclosure.Panel>
      </>
    ),
  },
  component: Disclosure,
  decorators: [OnACard],
  title: 'Components/Disclosure',
} satisfies Meta<typeof Disclosure>

type Story = StoryObj<typeof meta>

// Closed, as a section starts unless told otherwise. Press the header to
// open it.
const Default: Story = {}

const Expanded: Story = {
  args: { defaultExpanded: true },
}

// The header takes the row's leading slot and supporting line, which makes
// it the lists page's two-line item.
const WithSlots: Story = {
  args: {
    children: (
      <>
        <Disclosure.Header leading={ADA} supporting="Supporting line">
          Ada Lovelace
        </Disclosure.Header>
        <Disclosure.Panel>{BODY}</Disclosure.Panel>
      </>
    ),
    defaultExpanded: true,
  },
}

// The header fades and takes no press, and the section stays as it is.
const Disabled: Story = {
  args: { isDisabled: true },
}

export { Default, Disabled, Expanded, WithSlots }

export default meta
