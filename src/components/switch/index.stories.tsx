import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { Switch } from '.'

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
  component: Switch,
  title: 'Components/Switch',
} satisfies Meta<typeof Switch>

type Story = StoryObj<typeof meta>

const Default: Story = {}

const On: Story = {
  args: {
    defaultSelected: true,
  },
}

const WithIcon: Story = {
  args: {
    defaultSelected: true,
    icon: true,
  },
}

const WithDescription: Story = {
  args: {
    description: 'Supporting line',
  },
}

const WithError: Story = {
  args: {
    description: 'Supporting line',
    error: 'Turn this on.',
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
      <Switch {...args} />
    </View>
  ),
}

export {
  Default,
  Disabled,
  LongLabel,
  On,
  WithDescription,
  WithError,
  WithIcon,
}

export default meta
