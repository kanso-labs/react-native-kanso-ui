import type { Meta, StoryObj } from '@storybook/react'
import type { ReactNode } from 'react'

import { StyleSheet, View } from 'react-native'

import { TextField } from '.'
import { CloseGlyph, SearchGlyph } from '../../glyphs'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'

// The library's own glyphs stand in for an icon set, so the stories stay a
// demonstration of the field alone. Each reads its colour and size from the
// slot it sits in. Hoisted so each is one stable element per render, which is
// what react-perf's no-jsx-as-prop is after.
const LEADING_ICON = <SearchGlyph />
const TRAILING_ICON = <CloseGlyph />

const LONG_LABEL =
  'A label long enough that it has nowhere left to go on one line'

const columnsOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    // A field fills its container, so the samples need a width to fill: as
    // many 260dp columns as the canvas holds, each too narrow for the label.
    column: {
      width: 260,
    },
    columns: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.lg,
    },
  }),
)

const meta = {
  args: {
    defaultValue: 'Value',
    label: 'Label',
  },
  component: TextField,
  title: 'Components/TextField',
} satisfies Meta<typeof TextField>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// The resting label, which no populated story can show.
const Empty: Story = {
  args: {
    defaultValue: '',
  },
}

// The label held small at the top whatever the field holds.
const FixedLabel: Story = {
  args: {
    defaultValue: '',
    floatingLabel: false,
  },
}

const WithDescription: Story = {
  args: {
    description: 'Supporting line',
  },
}

// Its own story because the error state is three changes at once: the
// indicator, the label, and the message that replaces the description.
const WithError: Story = {
  args: {
    defaultValue: '',
    description: 'Supporting line',
    error: 'Enter a value.',
  },
}

const Numeric: Story = {
  args: {
    defaultValue: '01234.56',
    numeric: true,
  },
}

const Outlined: Story = {
  args: {
    variant: 'outlined',
  },
}

const OutlinedEmpty: Story = {
  args: {
    defaultValue: '',
    variant: 'outlined',
  },
}

const WithIcons: Story = {
  args: {
    leadingIcon: LEADING_ICON,
    trailingIcon: TRAILING_ICON,
  },
}

const WithPrefixAndSuffix: Story = {
  args: {
    prefix: 'Prefix',
    suffix: 'Suffix',
  },
}

const WithCharacterCount: Story = {
  args: {
    characterCount: true,
    description: 'Supporting line',
    maxLength: 20,
  },
}

const Disabled: Story = {
  args: {
    isDisabled: true,
  },
}

function Column({ children }: { readonly children: ReactNode }) {
  const styles = columnsOf(useTheme())

  return <View style={styles.column}>{children}</View>
}

function Columns({ children }: { readonly children: ReactNode }) {
  const styles = columnsOf(useTheme())

  return <View style={styles.columns}>{children}</View>
}

// A label is one line of the box, as the value is. One with no room ends in an
// ellipsis where the column does, before a trailing icon when there is one, and
// an outlined box opens its notch only as far as the label goes.
const LongLabels: Story = {
  render: () => (
    <Columns>
      <Column>
        <TextField defaultValue="" label={LONG_LABEL} />
      </Column>
      <Column>
        <TextField
          defaultValue="Value"
          label={LONG_LABEL}
          trailingIcon={TRAILING_ICON}
        />
      </Column>
      <Column>
        <TextField defaultValue="" label={LONG_LABEL} variant="outlined" />
      </Column>
      <Column>
        <TextField
          defaultValue="Value"
          label={LONG_LABEL}
          trailingIcon={TRAILING_ICON}
          variant="outlined"
        />
      </Column>
    </Columns>
  ),
}

export {
  Default,
  Disabled,
  Empty,
  FixedLabel,
  LongLabels,
  Numeric,
  Outlined,
  OutlinedEmpty,
  WithCharacterCount,
  WithDescription,
  WithError,
  WithIcons,
  WithPrefixAndSuffix,
}

export default meta
