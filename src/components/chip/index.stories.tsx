import type { Decorator, Meta, StoryObj } from '@storybook/react'
import type { ColorValue, ViewStyle } from 'react-native'

import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Chip } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { Stack } from '../stack'

const FILTERS = ['First filter', 'Second filter', 'Third filter'] as const

const styles = StyleSheet.create({
  // Holds each story's chip at its own width rather than stretching it across
  // the canvas, as any view in a React Native column is.
  hug: {
    alignItems: 'flex-start',
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

// One chip of the set below, which reports its own label when chosen.
function FilterChip({
  label,
  onSelect,
  selected,
}: {
  readonly label: string
  readonly onSelect: (label: string) => void
  readonly selected: boolean
}) {
  return (
    <Chip isSelected={selected} onChange={selectThen(label, onSelect)}>
      {label}
    </Chip>
  )
}

// Built by a call rather than written inline at the prop, which is what
// react-perf's jsx-no-new-function-as-prop is after; the React Compiler
// memoises the result on its inputs.
function selectThen(label: string, onSelect: (label: string) => void) {
  return () => {
    onSelect(label)
  }
}

// Controlled: one selection at a time, which is a rule only the call site can
// enforce, since the chip itself has no notion of its neighbours.
function SingleSelect() {
  const [selected, setSelected] = useState<string>(FILTERS[0])

  return (
    <Stack align="center" direction="row" gap="sm" wrap>
      {FILTERS.map((label) => (
        <FilterChip
          key={label}
          label={label}
          onSelect={setSelected}
          selected={selected === label}
        />
      ))}
    </Stack>
  )
}

const Hugged: Decorator = (Story) => (
  <View style={styles.hug}>
    <Story />
  </View>
)

const meta = {
  args: {
    children: 'Label',
  },
  component: Chip,
  decorators: [Hugged],
  title: 'Components/Chip',
} satisfies Meta<typeof Chip>

type Story = StoryObj<typeof meta>

const Default: Story = {}

const WithIcon: Story = {
  args: { icon: DOT },
}

const Assist: Story = {
  args: { icon: DOT, variant: 'assist' },
}

const Suggestion: Story = {
  args: { variant: 'suggestion' },
}

// Its own story because the interaction is the point: a snapshot can only show
// which chip is selected at rest, and what matters is that picking one clears
// the last. Each state on its own is a prop away on Default.
const Controlled: Story = {
  render: () => <SingleSelect />,
}

export { Assist, Controlled, Default, Suggestion, WithIcon }

export default meta
