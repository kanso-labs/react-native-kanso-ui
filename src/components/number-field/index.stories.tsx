import type { Meta, StoryObj } from '@storybook/react'
import type { ReactNode } from 'react'

import { StyleSheet, View } from 'react-native'

import { NumberField } from '.'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'

// Hoisted so it is one stable object per render rather than a fresh one,
// which is what react-perf's no-new-object-as-prop is after.
const EURO = { currency: 'EUR', style: 'currency' } as const

const LONG_LABEL = 'A label that runs on past the width of its box'

const columnOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    // Narrower than the long label, so the label is cut short and where it
    // stops shows against the steppers.
    narrow: {
      gap: spacing.lg,
      maxWidth: 320,
    },
  }),
)

const meta = {
  args: {
    defaultValue: 1234.5,
    label: 'Label',
  },
  component: NumberField,
  title: 'Components/NumberField',
} satisfies Meta<typeof NumberField>

type Story = StoryObj<typeof meta>

const Default: Story = {}

const Currency: Story = {
  args: {
    formatOptions: EURO,
  },
}

const HorizontalSteppers: Story = {
  args: {
    steppers: 'horizontal',
  },
}

const Outlined: Story = {
  args: {
    variant: 'outlined',
  },
}

// The value and the side-by-side steppers on the outlined box's centre line,
// as the stacked pair and a text field's value are.
const OutlinedHorizontalSteppers: Story = {
  args: {
    steppers: 'horizontal',
    variant: 'outlined',
  },
}

function Narrow({ children }: { readonly children: ReactNode }) {
  const styles = columnOf(useTheme())

  return <View style={styles.narrow}>{children}</View>
}

// A label longer than the box, in each layout: it is cut short where the
// value ends, clear of the steppers rather than under them.
const LongLabel: Story = {
  render: () => (
    <Narrow>
      <NumberField label={LONG_LABEL} />
      <NumberField label={LONG_LABEL} steppers="horizontal" />
      <NumberField
        defaultValue={1234.5}
        label={LONG_LABEL}
        steppers="horizontal"
        variant="outlined"
      />
    </Narrow>
  ),
}

const WithDescription: Story = {
  args: {
    description: 'Supporting line',
  },
}

const WithError: Story = {
  args: {
    defaultValue: undefined,
    error: 'Enter a number.',
  },
}

const Disabled: Story = {
  args: {
    isDisabled: true,
  },
}

export {
  Currency,
  Default,
  Disabled,
  HorizontalSteppers,
  LongLabel,
  Outlined,
  OutlinedHorizontalSteppers,
  WithDescription,
  WithError,
}

export default meta
