import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { SupportingPane } from '.'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'
import { Card } from '../card'
import { Separator } from '../separator'
import { Stack } from '../stack'
import { Tag } from '../tag'
import { Text } from '../text'

const RELATED = ['First item', 'Second item', 'Third item']

const styles = StyleSheet.create({
  // The card fills the pane's width, as a card dropped into one on web does.
  fill: {
    alignSelf: 'stretch',
  },
})

const stylesOf = themedStyles(({ colors, radii, spacing }) =>
  StyleSheet.create({
    // A dashed outline on the main pane, so the panes are legible in a
    // capture. The component paints nothing itself; this is the story's.
    outline: {
      borderColor: colors.outlineVariant,
      borderRadius: radii.md,
      borderStyle: 'dashed',
      borderWidth: 1,
      padding: spacing.md,
    },
  }),
)

function MainPane() {
  const own = stylesOf(useTheme())

  return (
    <View style={own.outline}>
      <Stack gap="sm">
        <Text role="heading" variant="titleLarge">
          Headline
        </Text>
        <Text tone="muted" variant="bodyMedium">
          Supporting line
        </Text>
        <Separator />
        <Text tone="muted" variant="bodyMedium">
          The main pane takes whatever width the supporting pane leaves from the
          expanded window size up.
        </Text>
      </Stack>
    </View>
  )
}

function SupportingContent() {
  return (
    <Card style={styles.fill} variant="outlined">
      <Stack align="start" gap="sm">
        <Text tone="muted" variant="labelSmall">
          Section label
        </Text>
        {RELATED.map((label) => (
          <Text key={label} variant="bodyMedium">
            {label}
          </Text>
        ))}
        <Tag tone="neutral" variant="outlined">
          Label
        </Tag>
      </Stack>
    </Card>
  )
}

const meta = {
  args: {
    main: <MainPane />,
    supporting: <SupportingContent />,
  },
  component: SupportingPane,
  title: 'Components/SupportingPane',
} satisfies Meta<typeof SupportingPane>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// Its own story because which side the supporting pane takes only shows from
// the expanded window size up. Below it the layout stacks the same way either
// way, which is what the canonical layout page asks for.
const Leading: Story = {
  args: {
    placement: 'leading',
  },
}

export { Default, Leading }

export default meta
