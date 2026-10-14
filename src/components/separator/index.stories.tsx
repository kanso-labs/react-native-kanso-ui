import type { Decorator, Meta, StoryObj } from '@storybook/react'
import type { ReactNode } from 'react'
import type { ViewProps } from 'react-native'

import { Platform, StyleSheet, View } from 'react-native'

import { Separator } from '.'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'
import { Stack } from '../stack'
import { Text } from '../text'

// A separator is a 1dp rule, so on its own there is nothing to judge it
// against. `BetweenRows` and `BetweenInlineItems` place it where it will be
// used, between stacked rows and between inline items, since what matters is
// whether it reads as a divider next to real content. The boxes take
// surfaceContainer so as to sit distinctly on the canvas's surface.
const stylesOf = themedStyles(({ colors, radii, spacing }) =>
  StyleSheet.create({
    // The frame the bare stories render in, with a height of its own so a
    // vertical rule has a row to span. It runs across the rule's orientation,
    // which is what a rule takes its length from.
    frame: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: radii.lg,
      height: 96,
      justifyContent: 'center',
      padding: spacing.lg,
      width: 280,
    },
    inline: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surfaceContainer,
      borderRadius: radii.lg,
      padding: spacing.lg,
    },
    row: {
      paddingVertical: spacing.md,
    },
    rows: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: radii.lg,
      padding: spacing.lg,
      width: 280,
    },
  }),
)

// A writing direction set on a view, which every view inside lays out by, as
// an app under I18nManager's right-to-left lays out everything. React Native
// reads a `direction` style, and React Native Web the `dir` attribute, which
// its View takes as a prop React Native's types do not name.
const RIGHT_TO_LEFT = Platform.select<ViewProps & { readonly dir?: 'rtl' }>({
  default: { style: { direction: 'rtl' } },
  web: { dir: 'rtl' },
})

function Frame({
  children,
  vertical,
}: {
  readonly children: ReactNode
  readonly vertical: boolean
}) {
  const { frame } = stylesOf(useTheme())

  return (
    <Stack direction={vertical ? 'row' : 'column'} gap="none" style={frame}>
      {children}
    </Stack>
  )
}

const Framed: Decorator = (Story, { args }) => (
  <Frame vertical={args.orientation === 'vertical'}>
    <Story />
  </Frame>
)

function InlineItems() {
  const { inline } = stylesOf(useTheme())

  return (
    <Stack align="center" direction="row" style={inline}>
      <Text variant="labelLarge">First</Text>
      <Separator orientation="vertical" />
      <Text variant="labelLarge">Second</Text>
      <Separator orientation="vertical" />
      <Text variant="labelLarge">Third</Text>
    </Stack>
  )
}

function Rows(props: { readonly inset?: 'both' | 'none' | 'start' }) {
  const { row, rows } = stylesOf(useTheme())

  return (
    <Stack gap="none" style={rows}>
      <View style={row}>
        <Text>First item</Text>
      </View>
      <Separator {...props} />
      <View style={row}>
        <Text>Second item</Text>
      </View>
      <Separator {...props} />
      <View style={row}>
        <Text>Third item</Text>
      </View>
    </Stack>
  )
}

const meta = {
  component: Separator,
  title: 'Components/Separator',
} satisfies Meta<typeof Separator>

type Story = StoryObj<typeof meta>

// Bare, in a frame that gives it something to span, so `orientation` is
// something the Controls panel can turn over.
const Default: Story = {
  decorators: [Framed],
}

const Inset: Story = {
  args: { inset: 'start' },
  decorators: [Framed],
}

const MiddleInset: Story = {
  args: { inset: 'both' },
  decorators: [Framed],
}

// Between stacked rows the rule spans whatever holds them, stopping at the
// padding. The rules take `args`, so `inset` can be tried between rows too.
const BetweenRows: Story = {
  render: (args) => <Rows inset={args.inset} />,
}

// A vertical rule has no length of its own: it takes the height of the row it
// sits in, so it is worth seeing beside content of a real height.
const BetweenInlineItems: Story = {
  render: () => <InlineItems />,
}

// The inset rows under a right-to-left writing direction, where the start of
// each rule is its right-hand end, because the inset is logical rather than a
// side.
const RightToLeft: Story = {
  render: () => (
    <View {...RIGHT_TO_LEFT}>
      <Rows inset="start" />
    </View>
  ),
}

export {
  BetweenInlineItems,
  BetweenRows,
  Default,
  Inset,
  MiddleInset,
  RightToLeft,
}

export default meta
