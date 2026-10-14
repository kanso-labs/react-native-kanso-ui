import type { Meta, StoryObj } from '@storybook/react'
import type { ReactNode } from 'react'
import type { ViewProps } from 'react-native'

import { Platform, StyleSheet, View } from 'react-native'

import { CopyField } from '.'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'

const VALUE = 'first.second.third'
const LONG_VALUE = 'registry.example/first-second/a-long-unbroken-name'

// A writing direction set on a view, which every view inside lays out by, as
// an app under I18nManager's right-to-left lays out everything. React Native
// reads a `direction` style, and React Native Web the `dir` attribute, which
// its View takes as a prop React Native's types do not name.
const RIGHT_TO_LEFT = Platform.select<ViewProps & { readonly dir?: 'rtl' }>({
  default: { style: { direction: 'rtl' } },
  web: { dir: 'rtl' },
})

const stylesOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    // Narrower than the value, so the wrap is actually visible rather than
    // merely asserted.
    narrow: {
      maxWidth: 300,
    },
    // Fields stacked down a screen, as a settings screen lays them.
    stack: {
      gap: spacing.md,
    },
  }),
)

const meta = {
  args: {
    value: VALUE,
  },
  component: CopyField,
  title: 'Components/CopyField',
} satisfies Meta<typeof CopyField>

type Story = StoryObj<typeof meta>

function Narrow({ children }: { readonly children: ReactNode }) {
  return <View style={stylesOf(useTheme()).narrow}>{children}</View>
}

function Stacked({ children }: { readonly children: ReactNode }) {
  return <View style={stylesOf(useTheme()).stack}>{children}</View>
}

const Default: Story = {}

// Its own story because a value with nothing to break at wraps inside the
// field rather than pushing the button out of it, and it only does so where
// the field is narrower than the value.
const LongValue: Story = {
  args: {
    value: LONG_VALUE,
  },
  render: (args) => (
    <Narrow>
      <CopyField {...args} />
    </Narrow>
  ),
}

// Under a right-to-left layout, with a value whose ends are neutral
// characters. The value keeps its own left-to-right order, so the field shows
// the string it copies, and still sits at the row's start.
const RightToLeft: Story = {
  args: { value: '/usr/local/bin' },
  render: (args) => (
    <View {...RIGHT_TO_LEFT}>
      <CopyField {...args} />
    </View>
  ),
}

// Two fields on one screen, each named by its `label`: the label is not
// shown, but it names the field as a group and joins its button's name, so a
// screen reader tells "Copy Repository URL" from "Copy Access token".
const Labelled: Story = {
  render: () => (
    <Stacked>
      <CopyField label="Repository URL" value="https://example.com/first" />
      <CopyField label="Access token" value="first.second.third" />
    </Stacked>
  ),
}

// A value over several lines with runs of spaces in it, which the field shows
// as written, since that is what it copies.
const MultiLine: Story = {
  args: {
    value: 'npm install \\\n  --save-dev    first-package\nnpm run build',
  },
}

export { Default, Labelled, LongValue, MultiLine, RightToLeft }

export default meta
