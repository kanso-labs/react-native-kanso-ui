import type { Decorator, Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import type { TagTone, TagVariant } from '.'

import { Tag } from '.'
import { ClockGlyph } from '../../glyphs'
import { Card } from '../card'
import { ListItem } from '../list-item'
import { Separator } from '../separator'
import { Stack } from '../stack'

const styles = StyleSheet.create({
  // A row fills the column it sits in, so it needs one to have a width.
  list: {
    width: 380,
  },
  start: {
    alignItems: 'flex-start',
  },
})

const TONES: readonly TagTone[] = ['primary', 'positive', 'negative', 'neutral']

const VARIANTS: readonly TagVariant[] = ['filled', 'outlined']

// Hoisted so each slot is one stable element per render, which is what
// react-perf's no-jsx-as-prop is after.
const FIRST = <Tag>01</Tag>
const SECOND = <Tag>02</Tag>
const THIRD = <Tag tone="positive">03</Tag>

// A tag in a column stretches across it, as any view does, so every story
// holds it at its own width from the start edge, which is where a call site
// placing one on its own puts it.
const AtOwnWidth: Decorator = (Story) => (
  <View style={styles.start}>
    <Story />
  </View>
)

const meta = {
  args: {
    children: 'Label',
  },
  component: Tag,
  decorators: [AtOwnWidth],
  title: 'Components/Tag',
} satisfies Meta<typeof Tag>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// The common home for a tag is a list row's trailing slot, so it is drawn
// there: figures sit on a fixed advance, which keeps a column of them lined up
// rather than wobbling from row to row.
const InListRow: Story = {
  render: () => (
    <View style={styles.list}>
      <Card padding="none" variant="outlined">
        <ListItem supporting="Supporting line" trailing={FIRST}>
          First item
        </ListItem>
        <Separator />
        <ListItem supporting="Supporting line" trailing={SECOND}>
          Second item
        </ListItem>
        <Separator />
        <ListItem supporting="Supporting line" trailing={THIRD}>
          Third item
        </ListItem>
      </Card>
    </View>
  ),
}

// Every tone in both variants, filled above outlined. The two rows line up
// tag for tag, since filled keeps its rule and makes it transparent.
const Tones: Story = {
  render: (args) => (
    <Stack gap="sm">
      {VARIANTS.map((variant) => (
        <Stack align="start" direction="row" gap="sm" key={variant}>
          {TONES.map((tone) => (
            <Tag {...args} key={tone} tone={tone} variant={variant} />
          ))}
        </Stack>
      ))}
    </Stack>
  ),
}

// An icon before the label takes the label's colour and is drawn at its line
// height, so the tag is no taller than one without.
const WithIcon: Story = {
  args: {
    children: [<ClockGlyph key="icon" />, 'Label'],
    tone: 'primary',
  },
}

export { Default, InListRow, Tones, WithIcon }

export default meta
