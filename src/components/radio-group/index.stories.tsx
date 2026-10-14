import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { Radio, RadioGroup } from '.'

const styles = StyleSheet.create({
  // Narrower than the address, so it has to break.
  narrow: {
    width: 200,
  },
  // A group fills its container, so the samples need a width to fill.
  sample: {
    maxWidth: 420,
  },
})

// Pulled out because every story lists the same three options and only the
// group around them differs.
function Options() {
  return (
    <>
      <Radio value="first">First item</Radio>
      <Radio value="second">Second item</Radio>
      <Radio value="third">Third item</Radio>
    </>
  )
}

const meta = {
  args: {
    defaultValue: 'first',
    label: 'Label',
  },
  component: RadioGroup,
  title: 'Components/RadioGroup',
} satisfies Meta<typeof RadioGroup>

type Story = StoryObj<typeof meta>

const Default: Story = {
  render: (args) => (
    <View style={styles.sample}>
      <RadioGroup {...args}>
        <Options />
      </RadioGroup>
    </View>
  ),
}

const Horizontal: Story = {
  args: {
    orientation: 'horizontal',
  },
  render: (args) => (
    <RadioGroup {...args}>
      <Options />
    </RadioGroup>
  ),
}

// Its own story because an option's description is a prop of the option
// rather than of the group, so the Controls panel cannot reach it: it is read
// with the option, and the one under the group belongs to the group.
const WithDescriptions: Story = {
  args: {
    defaultValue: 'second',
    description: 'Supporting line',
  },
  render: (args) => (
    <View style={styles.sample}>
      <RadioGroup {...args}>
        <Radio description="Supporting line" value="first">
          First item
        </Radio>
        <Radio description="Supporting line" value="second">
          Second item
        </Radio>
        <Radio value="third">Third item</Radio>
      </RadioGroup>
    </View>
  ),
}

const WithError: Story = {
  args: {
    defaultValue: undefined,
    error: 'Choose one.',
  },
  render: (args) => (
    <View style={styles.sample}>
      <RadioGroup {...args}>
        <Options />
      </RadioGroup>
    </View>
  ),
}

// Its own story because a word with nowhere to break, an address or a long
// compound, breaks inside an option's label, the group's label and the lines
// under them rather than widening the screen.
const LongLabel: Story = {
  args: {
    description: 'firstname.lastname@organisation.example.com',
    label: 'Unterstützungszeilenüberschrift',
  },
  render: (args) => (
    <View style={styles.narrow}>
      <RadioGroup {...args}>
        <Radio
          description="firstname.lastname@organisation.example.com"
          value="first"
        >
          Unterstützungszeilenüberschrift
        </Radio>
        <Radio value="second">Second item</Radio>
      </RadioGroup>
    </View>
  ),
}

export { Default, Horizontal, LongLabel, WithDescriptions, WithError }

export default meta
