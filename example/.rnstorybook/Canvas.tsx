import type { ReactNode } from 'react'

import { ScrollView, StyleSheet, useColorScheme, View } from 'react-native'

import type { DemoTheme } from '../../src/theming/themes'

import { ThemeScope, useTheme } from '../../src'
import { themedStyles } from '../../src/theme/styles'
import { demoThemes } from '../../src/theming/themes'

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
})

const stylesOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    content: {
      padding: spacing.lg,
    },
  }),
)

type CanvasProps = {
  readonly children: ReactNode
  /** The `theme` global, which only a story that pins one sets on a device. */
  readonly name: unknown
  /**
   * Whether the story scrolls by itself, as a list does, from its `scrolls`
   * parameter. Such a story is drawn in a plain view rather than the scroll
   * view every other story is, since a list inside a scroll view going the
   * same way cannot tell which rows are in view, and says so.
   */
  readonly scrolls: boolean
}

// Keyed by plain string, so the global can be looked up as it arrives.
const DEMO_THEMES: Readonly<Partial<Record<string, DemoTheme>>> = demoThemes

// The device's counterpart of the web Storybook's canvas. A device has no
// toolbar, so a story is drawn in the scheme the device's appearance asks for,
// and switching the device to dark is how it is read in dark. A story that
// pins a theme through `globals`, as the Theming pages do, is drawn in that
// one instead. The scope is pinned either way, which is what paints its
// surface behind the story.
function Canvas({ children, name, scrolls }: CanvasProps) {
  const appearance = useColorScheme() === 'dark' ? 'dark' : 'light'
  const demo = typeof name === 'string' ? DEMO_THEMES[name] : undefined

  return (
    <ThemeScope
      scheme={schemeOf(name, demo, appearance)}
      style={styles.fill}
      theme={demo?.theme}
    >
      <Gutter scrolls={scrolls}>{children}</Gutter>
    </ThemeScope>
  )
}

function Gutter({
  children,
  scrolls,
}: {
  readonly children: ReactNode
  readonly scrolls: boolean
}) {
  const { content } = stylesOf(useTheme())

  return scrolls ? (
    <View style={content}>{children}</View>
  ) : (
    <ScrollView contentContainerStyle={content}>{children}</ScrollView>
  )
}

// A demo scheme states every colour, so the library scheme under it decides
// nothing a story draws, and light is pinned under it only to paint the
// surface.
function schemeOf(
  name: unknown,
  demo: DemoTheme | undefined,
  appearance: 'dark' | 'light',
): 'dark' | 'light' {
  if (demo !== undefined) {
    return 'light'
  }

  return name === 'dark' || name === 'light' ? name : appearance
}

export default Canvas
