import type { ReactNode } from 'react'

import { StyleSheet, View } from 'react-native'

import type { DemoThemeName } from './themes'

import { Text } from '../components/text'
import { useTheme } from '../theme/scope'
import { themedStyles } from '../theme/styles'
import { demoThemes } from './themes'

// The page every story under Theming renders, as on web. Those files hold a
// scheme and nothing else, so anything that differs between two of them on
// screen can only be a token one of the schemes moved, and a value written as
// a literal rather than read from the theme is the one thing that stays put.
//
// One section per component, named after the component and ordered by name,
// so the page is a list to look a component up in. A section is written as
// `Section`, which draws the rule above it along with its headline, and a new
// component is a new `Section` in its alphabetical place, with the sentence
// web's showcase gives it.

type SectionProps = {
  readonly children?: ReactNode
  readonly description: string
  readonly title: string
}

type ShowcaseProps = {
  /** The scheme the page names in its header: a demo scheme, or the library's dark. */
  readonly name: 'dark' | DemoThemeName
}

const LIBRARY_DARK = {
  description:
    "The library's own dark theme: the default tokens' dark half, with nothing overridden.",
  label: 'Dark',
}

const stylesOf = themedStyles(({ colors, spacing }) =>
  StyleSheet.create({
    intro: {
      gap: spacing.xxs,
    },
    page: {
      gap: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    // The hairline between two sections, in the role kanso-ui's showcase
    // draws its rule in.
    rule: {
      borderTopColor: colors.outlineVariant,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    section: {
      gap: spacing.lg,
    },
    stack: {
      gap: spacing.sm,
    },
  }),
)

// One component's entry. The rule is drawn here rather than between two
// sections at the call site, so a section is one element and the page is the
// list of them.
function Section({ children, description, title }: SectionProps) {
  const styles = stylesOf(useTheme())

  return (
    <View style={styles.section} testID="showcase-section">
      <View style={styles.rule} />
      <View style={styles.intro}>
        <Text role="heading" variant="titleLarge">
          {title}
        </Text>
        <Text tone="muted" variant="bodyMedium">
          {description}
        </Text>
      </View>
      {children}
    </View>
  )
}

/**
 * One page, rendered identically by every story under Theming. Only the theme
 * around it changes, so anything that differs between two of them is
 * something a token moved.
 */
function Showcase({ name }: ShowcaseProps) {
  const styles = stylesOf(useTheme())
  const { description, label } =
    name === 'dark' ? LIBRARY_DARK : demoThemes[name]

  return (
    <View style={styles.page}>
      <View style={styles.intro}>
        <Text role="heading" variant="headlineSmall">
          {label}
        </Text>
        <Text tone="muted" variant="bodyLarge">
          {description}
        </Text>
      </View>

      <Section
        description="The scale and the tones, which is where a scheme's typeface and its semantic colour roles are read straight off."
        title="Text"
      >
        <View style={styles.stack}>
          <Text variant="displaySmall">Headline</Text>
          <Text variant="headlineSmall">Headline</Text>
          <Text variant="titleLarge">Headline</Text>
          <Text variant="bodyLarge">Supporting line</Text>
          <Text variant="labelSmall">Label</Text>
        </View>
        <View style={styles.row}>
          <Text tone="primary">Primary</Text>
          <Text tone="muted">Muted</Text>
          <Text tone="positive">Positive</Text>
          <Text tone="negative">Negative</Text>
          <Text tone="error">Error</Text>
        </View>
      </Section>
    </View>
  )
}

export type { ShowcaseProps }

export default Showcase
