import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { Code } from '.'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'
import { Stack } from '../stack'
import { Text } from '../text'

const stylesOf = themedStyles(({ colors, spacing }) =>
  StyleSheet.create({
    // The container the long identifier has to fit, outlined so a capture
    // shows where it ends. The rule is the story's, not the component's.
    narrow: {
      alignSelf: 'flex-start',
      borderColor: colors.outline,
      borderStyle: 'dashed',
      borderWidth: 1,
      maxWidth: 220,
      padding: spacing.sm,
    },
  }),
)

function Narrow() {
  const own = stylesOf(useTheme())

  return (
    <Stack align="start" gap="xs">
      <View style={own.narrow}>
        <Text variant="bodyMedium">
          <Code>registry.example/first-second/a-long-unbroken-name</Code>
        </Text>
      </View>
      <Text tone="muted" variant="labelSmall">
        the dashed rule is the container, not the component
      </Text>
    </Stack>
  )
}

const meta = {
  args: {
    children: 'identifier',
  },
  component: Code,
  title: 'Components/Code',
} satisfies Meta<typeof Code>

type Story = StoryObj<typeof meta>

// Code takes its colour and its size from the text it interrupts, so it is
// shown inside a line of body text, the way a call site uses it.
const Default: Story = {
  render: (args) => (
    <Text variant="bodyLarge">
      A sentence naming <Code {...args} />
    </Text>
  ),
}

// Its own story because it takes a narrow container as well as a long value:
// a package path or a hash has few places to break, so rather than running
// past its container it breaks inside it.
const LongIdentifier: Story = {
  render: () => <Narrow />,
}

// Its own story because the point is the text around it: the same component
// serves a heading and a footnote, and a mono face reads larger than prose at
// the same nominal size, so the share is what keeps the two level.
const Scale: Story = {
  render: () => (
    <Stack align="start" gap="xs">
      <Text variant="headlineSmall">
        A heading naming <Code>identifier</Code>
      </Text>
      <Text tone="muted" variant="bodySmall">
        A footnote naming <Code>identifier</Code>
      </Text>
    </Stack>
  ),
}

export { Default, LongIdentifier, Scale }

export default meta
