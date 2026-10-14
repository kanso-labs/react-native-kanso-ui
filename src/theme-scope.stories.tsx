import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, Text, View } from 'react-native'

import { type KuiTheme, ThemeScope as Scope } from './theme-scope'
import { useTheme } from './theme/scope'
import { themedStyles } from './theme/styles'

// The two roles a filled container reads, moved to the dark scheme's tertiary
// pair, so the scope differs from the screen in more than its scheme. The same
// map kanso-ui's own Theme scope page hands its scope.
const ACCENT: KuiTheme = {
  '--kui-color-on-primary': '#492532',
  '--kui-color-primary': '#efb8c8',
}

// Set in each role's size, line height and tracking. Weight and family are
// left at the platform's defaults.
const stylesOf = themedStyles(({ colors, radii, spacing, typography }) =>
  StyleSheet.create({
    body: {
      color: colors.onSurfaceVariant,
      fontSize: typography.bodyMediumSize,
      letterSpacing: typography.bodyMediumTracking,
      lineHeight: typography.bodyMediumLineHeight,
    },
    // A column of the row. The scope is one, so it takes the panel's corners:
    // a pinned scope paints its own surface, which would otherwise show square
    // behind the panel's rounded ones.
    cell: {
      borderRadius: radii.lg,
      flexBasis: 280,
      flexGrow: 1,
    },
    columns: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xl,
    },
    headline: {
      color: colors.onSurface,
      fontSize: typography.displaySmallSize,
      letterSpacing: typography.displaySmallTracking,
      lineHeight: typography.displaySmallLineHeight,
    },
    page: {
      gap: spacing.xl,
    },
    // Painted from the theme of whichever scope draws it, so in the scope it
    // is the scope's container and on the screen the screen's.
    panel: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: radii.lg,
      flexGrow: 1,
      gap: spacing.md,
      padding: spacing.xl,
    },
    swatch: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
    },
    swatchLabel: {
      color: colors.onPrimary,
      fontSize: typography.labelLargeSize,
      letterSpacing: typography.labelLargeTracking,
      lineHeight: typography.labelLargeLineHeight,
    },
    title: {
      color: colors.onSurface,
      fontSize: typography.titleLargeSize,
      letterSpacing: typography.titleLargeTracking,
      lineHeight: typography.titleLargeLineHeight,
    },
  }),
)

function Panel({ title }: { readonly title: string }) {
  const styles = stylesOf(useTheme())

  return (
    <View style={styles.panel}>
      <Text role="heading" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.body}>Supporting line</Text>
      <View style={styles.swatch}>
        <Text style={styles.swatchLabel}>Label</Text>
      </View>
    </View>
  )
}

function ThemeScopePage() {
  const styles = stylesOf(useTheme())

  return (
    <View style={styles.page}>
      <Text role="heading" style={styles.headline}>
        Theme scope
      </Text>
      <Text style={styles.body}>
        The screen&apos;s tokens on the left. On the right, a scope pinned to
        the dark scheme, with two colour roles of its own declared on it.
      </Text>
      <View style={styles.columns}>
        <View style={styles.cell}>
          <Panel title="Screen" />
        </View>
        <Scope scheme="dark" style={styles.cell} testID="scope" theme={ACCENT}>
          <Panel title="Scope" />
        </Scope>
      </View>
    </View>
  )
}

const meta = {
  component: ThemeScopePage,
  tags: ['!autodocs'],
  title: 'Foundations/Theme scope',
} satisfies Meta<typeof ThemeScopePage>

type Story = StoryObj<typeof meta>

// Named after the title's last segment, because Storybook folds a component
// holding one story of the same name into a single sidebar leaf.
const ThemeScope: Story = {}

export { ThemeScope }

export default meta
