import type { ReactNode } from 'react'

import { StyleSheet, View } from 'react-native'

import type { DemoThemeName } from './themes'

import { Button } from '../components/button'
import { IconButton } from '../components/icon-button'
import { Separator } from '../components/separator'
import { Stack } from '../components/stack'
import { Text } from '../components/text'
import { PlusGlyph } from '../glyphs'
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

type PlaceholderProps = {
  readonly children: string
}

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

// The icon the icon buttons hold, the library's own plus, which reads its
// colour and size from the button around it.
const PLUS = <PlusGlyph />

const stylesOf = themedStyles(({ colors, radii, spacing }) =>
  StyleSheet.create({
    intro: {
      gap: spacing.xxs,
    },
    // An outlined container and its rows, standing in for a card of list
    // items, so the separator section shows rules between real rows.
    item: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    outlined: {
      borderColor: colors.outlineVariant,
      borderRadius: radii.md,
      borderWidth: 1,
      overflow: 'hidden',
    },
    page: {
      gap: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    // A dashed box for the layouts, which paint nothing of their own, so
    // what a scheme reaches in them shows as the space between boxes.
    placeholder: {
      borderColor: colors.outlineVariant,
      borderRadius: radii.md,
      borderStyle: 'dashed',
      borderWidth: 1,
      padding: spacing.md,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    section: {
      gap: spacing.lg,
    },
  }),
)

function Item({ children }: PlaceholderProps) {
  const styles = stylesOf(useTheme())

  return (
    <View style={styles.item}>
      <Text variant="bodyLarge">{children}</Text>
    </View>
  )
}

function Placeholder({ children }: PlaceholderProps) {
  const styles = stylesOf(useTheme())

  return (
    <View style={styles.placeholder}>
      <Text tone="muted" variant="bodyMedium">
        {children}
      </Text>
    </View>
  )
}

// One component's entry. The rule is drawn here rather than between two
// sections at the call site, so a section is one element and the page is the
// list of them.
function Section({ children, description, title }: SectionProps) {
  const styles = stylesOf(useTheme())

  return (
    <View style={styles.section} testID="showcase-section">
      <Separator />
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
        description="Every variant reads its container off a colour role and its corner off the radius scale, a square button's and a selected toggle's among them, so a scheme moves all of them at once — the elevated button off its shadow scale as well."
        title="Button"
      >
        <View style={styles.row}>
          <Button>Label</Button>
          <Button variant="tonal">Label</Button>
          <Button variant="elevated">Label</Button>
          <Button variant="outlined">Label</Button>
          <Button variant="text">Label</Button>
          <Button shape="square" variant="tonal">
            Label
          </Button>
          <Button defaultSelected variant="outlined">
            Label
          </Button>
          <Button isDisabled>Label</Button>
        </View>
      </Section>

      <Section
        description="The button's variants again at the icon's own size. A chosen toggle takes a second pair of roles and rests at the squarer corner."
        title="IconButton"
      >
        <View style={styles.row}>
          <IconButton aria-label="Add">{PLUS}</IconButton>
          <IconButton aria-label="Add" variant="outlined">
            {PLUS}
          </IconButton>
          <IconButton aria-label="Add" variant="tonal">
            {PLUS}
          </IconButton>
          <IconButton aria-label="Add" variant="filled">
            {PLUS}
          </IconButton>
          <IconButton aria-label="Add" defaultSelected={false}>
            {PLUS}
          </IconButton>
          <IconButton aria-label="Add" defaultSelected variant="tonal">
            {PLUS}
          </IconButton>
        </View>
      </Section>

      <Section
        description="A rule is the same colour as a border, so it draws from the outline-variant role rather than one of its own. Full width, inset at the leading end, and inset at both."
        title="Separator"
      >
        <View style={styles.outlined}>
          <Item>First item</Item>
          <Separator />
          <Item>Second item</Item>
          <Separator inset="start" />
          <Item>Third item</Item>
          <Separator inset="both" />
          <Item>Fourth item</Item>
        </View>
      </Section>

      <Section
        description="One direction, one gap off the spacing scale, and nothing painted, so what a scheme reaches is the step between the boxes. The dashed outlines are the page's own."
        title="Stack"
      >
        <Stack direction="row" gap="md" wrap>
          <Placeholder>First item</Placeholder>
          <Placeholder>Second item</Placeholder>
          <Placeholder>Third item</Placeholder>
        </Stack>
      </Section>

      <Section
        description="The scale and the tones, which is where a scheme's typeface and its semantic colour roles are read straight off."
        title="Text"
      >
        <Stack gap="sm">
          <Text variant="displaySmall">Headline</Text>
          <Text variant="headlineSmall">Headline</Text>
          <Text variant="titleLarge">Headline</Text>
          <Text variant="bodyLarge">Supporting line</Text>
          <Text variant="labelSmall">Label</Text>
        </Stack>
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
