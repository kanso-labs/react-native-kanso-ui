import type { Decorator, Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { SearchField } from '.'

const styles = StyleSheet.create({
  // A bar fills its container up to the page's 720dp, so the samples need a
  // width to fill.
  sample: {
    maxWidth: 420,
  },
})

const Sample: Decorator = (Story) => (
  <View style={styles.sample}>
    <Story />
  </View>
)

const meta = {
  args: {
    label: 'Label',
    placeholder: 'Supporting text',
  },
  component: SearchField,
  decorators: [Sample],
  title: 'Components/SearchField',
} satisfies Meta<typeof SearchField>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// The clear button, which shows only while the field holds something.
const WithValue: Story = {
  args: {
    defaultValue: 'Typed keyword',
  },
}

const WithError: Story = {
  args: {
    error: 'Enter a keyword.',
  },
}

const Disabled: Story = {
  args: {
    defaultValue: 'Typed keyword',
    isDisabled: true,
  },
}

export { Default, Disabled, WithError, WithValue }

export default meta
