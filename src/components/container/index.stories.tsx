import type { Meta, StoryObj } from '@storybook/react'
import type { ReactNode } from 'react'

import { StyleSheet, View } from 'react-native'

import { Container } from '.'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'
import { Card } from '../card'
import { Stack } from '../stack'
import { Text } from '../text'

// A measure for prose: what makes a line hard to read is how many characters
// the eye has to track back across, which at body large is about 58.
const PROSE = 560

const stylesOf = themedStyles(({ colors, radii, spacing }) =>
  StyleSheet.create({
    // Paints the room the container was given, so the leftover space either
    // side of the measure is visible rather than being taken on trust.
    room: {
      backgroundColor: colors.surfaceContainerHighest,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
    },
    ruled: {
      backgroundColor: colors.surfaceContainerLow,
      borderColor: colors.outline,
      borderStyle: 'dashed',
      borderWidth: 1,
      paddingVertical: spacing.md,
    },
  }),
)

function Room({ children }: { readonly children: ReactNode }) {
  return <View style={stylesOf(useTheme()).room}>{children}</View>
}

function Ruled({ children }: { readonly children: ReactNode }) {
  return <View style={stylesOf(useTheme()).ruled}>{children}</View>
}

const meta = {
  args: {
    children: <Text>First item</Text>,
  },
  component: Container,
  title: 'Components/Container',
} satisfies Meta<typeof Container>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// Its own story because a container paints nothing, so its measure shows only
// against what does: the shaded band is the room it was given, and the box or
// Card inside is its content, held in from the measure's edge by the padding.
const Measure: Story = {
  render: () => (
    <Stack gap="lg">
      <Room>
        <Container maxInlineSize={420}>
          <Ruled>
            <Text>First item</Text>
          </Ruled>
        </Container>
      </Room>
      <Room>
        <Container maxInlineSize={420}>
          <Card variant="outlined">
            <Text>First item</Text>
          </Card>
        </Container>
      </Room>
    </Stack>
  ),
}

// The prose case gets its own entry because it is the one a reader is most
// likely to be looking for, and the default measure never reaches it.
const Prose: Story = {
  args: {
    children: (
      <Text variant="bodyLarge">
        A measure stops a line where the reader stops being able to follow it,
        rather than where the window happens to end. This paragraph runs to the
        container&apos;s measure and wraps there, however wide the window is.
      </Text>
    ),
    maxInlineSize: PROSE,
  },
}

export { Default, Measure, Prose }

export default meta
