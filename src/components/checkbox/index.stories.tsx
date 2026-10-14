import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { Checkbox } from '.'

const styles = StyleSheet.create({
  // Narrower than the address, so it has to break.
  narrow: {
    width: 200,
  },
})

const meta = {
  args: {
    children: 'Label',
  },
  component: Checkbox,
  title: 'Components/Checkbox',
} satisfies Meta<typeof Checkbox>

type Story = StoryObj<typeof meta>

const Default: Story = {}

const Selected: Story = {
  args: {
    defaultSelected: true,
  },
}

const Indeterminate: Story = {
  args: {
    isIndeterminate: true,
  },
}

const WithDescription: Story = {
  args: {
    description: 'Supporting line',
  },
}

// Its own story because the error state is two changes at once: the box's
// colours, and the message that replaces the description.
const WithError: Story = {
  args: {
    description: 'Supporting line',
    error: 'Choose one.',
  },
}

const Disabled: Story = {
  args: {
    isDisabled: true,
  },
}

// Its own story because a word with nowhere to break, an address or a long
// compound, breaks inside the label and the line under it rather than
// widening the screen.
const LongLabel: Story = {
  args: {
    children: 'firstname.lastname@organisation.example.com',
    description: 'Unterstützungszeilenüberschrift',
  },
  render: (args) => (
    <View style={styles.narrow}>
      <Checkbox {...args} />
    </View>
  ),
}

export {
  Default,
  Disabled,
  Indeterminate,
  LongLabel,
  Selected,
  WithDescription,
  WithError,
}

export default meta
