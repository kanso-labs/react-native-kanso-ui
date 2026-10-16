import type { Decorator, Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { ListItem } from '.'
import { ChevronEndGlyph, PersonGlyph } from '../../glyphs'
import { Avatar } from '../avatar'
import { Card } from '../card'
import { Separator } from '../separator'
import { Text } from '../text'

const styles = StyleSheet.create({
  // A row fills the column it sits in, so it needs one to have a width.
  width: {
    width: 380,
  },
})

// Hoisted so each slot is one stable element per render, which is what
// react-perf's no-jsx-as-prop is after.
const ADA = <Avatar name="Ada Lovelace" />
const CHEVRON = <ChevronEndGlyph />
const GRACE = <Avatar name="Grace Hopper" tone="tertiary" />
const LABEL = (
  <Text tone="muted" variant="labelSmall">
    Label
  </Text>
)
const PERSON = <PersonGlyph />
const VALUE = <Text variant="labelLarge">01</Text>

// Each row's headline and the sequence number at its end, which carries no
// unit.
const ROWS = [
  { label: 'First item', value: <Text variant="labelLarge">01</Text> },
  { label: 'Second item', value: <Text variant="labelLarge">02</Text> },
  { label: 'Third item', value: <Text variant="labelLarge">03</Text> },
] as const

// A decorator rather than a `render`, which leaves the stories below nothing
// but `args`, and so every prop live in the Controls panel.
const Constrained: Decorator = (Story) => (
  <View style={styles.width}>
    <Story />
  </View>
)

const meta = {
  args: {
    children: 'Headline',
    supporting: 'Supporting line',
  },
  component: ListItem,
  decorators: [Constrained],
  title: 'Components/ListItem',
} satisfies Meta<typeof ListItem>

type Story = StoryObj<typeof meta>

// The two-line item: a headline and the supporting line under it.
const Default: Story = {}

// Interactive, since a disabled row is most often an action that is not
// available yet. A row that only presents is drawn the same way.
const Disabled: Story = {
  args: {
    interactive: true,
    isDisabled: true,
    leading: PERSON,
  },
}

// A `Pressable` announced as a button, with the state layers, the ripple and
// the focus ring.
const Interactive: Story = {
  args: {
    interactive: true,
    leading: PERSON,
    trailing: CHEVRON,
  },
}

// The composition the row is for: an outlined card with no padding, a rule
// between the rows, and a row per entry, each one pressable.
const InAList: Story = {
  render: () => (
    <Card padding="none" variant="outlined">
      {ROWS.map(({ label, value }, index) => (
        <View key={label}>
          {index === 0 ? null : <Separator />}
          <ListItem
            interactive
            leading={PERSON}
            supporting="Supporting line"
            trailing={value}
          >
            {label}
          </ListItem>
        </View>
      ))}
    </Card>
  ),
}

// Nothing truncates: a headline that needs two lines takes them and the row
// grows, and the middle gives way rather than pushing the trailing slot off
// the end.
const LongContent: Story = {
  args: {
    children:
      'A headline long enough that it has nowhere left to go on one line',
    leading: GRACE,
    supporting:
      'Supporting line, long enough that it keeps going onto another line',
    trailing: LABEL,
  },
}

// The one-line item, at the lists page's 56dp.
const OneLine: Story = {
  args: {
    leading: PERSON,
    supporting: undefined,
  },
}

// A different layout rather than another line: with the overline, the
// slots move to the top of the row.
const ThreeLine: Story = {
  args: {
    leading: ADA,
    overline: 'Overline',
    trailing: VALUE,
  },
}

export {
  Default,
  Disabled,
  InAList,
  Interactive,
  LongContent,
  OneLine,
  ThreeLine,
}

export default meta
