import type { ReactNode } from 'react'
import type { ViewStyle } from 'react-native'
import type { Metrics } from 'react-native-safe-area-context'

import { Dimensions, StyleSheet, useWindowDimensions, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import type { DemoTheme } from '../../src/theming/themes'

import { ThemeScope, useTheme } from '../../src'
import { themedStyles } from '../../src/theme/styles'
import { demoThemes } from '../../src/theming/themes'

const stylesOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    // The gutter Storybook's own padded layout would give, in a token, and
    // inside the scope so the surface reaches the edge of the frame. The
    // preview sets the fullscreen layout to take Storybook's away.
    gutter: {
      padding: spacing.lg,
    },
  }),
)

type CanvasProps = {
  readonly children: ReactNode
  /**
   * Grow to the window's height. False for a story drawn on an Overview page,
   * where the window is the whole page and filling it would give every story
   * on the page a screen of its own.
   */
  readonly fill: boolean
  /** 'light', 'dark', or a key of `demoThemes`: whatever the `theme` global says. */
  readonly name: string
}

// A browser has no system bars, so the insets start at none, and the
// provider draws the story at once rather than once it has measured them.
const METRICS: Metrics = {
  frame: {
    height: Dimensions.get('window').height,
    width: Dimensions.get('window').width,
    x: 0,
    y: 0,
  },
  insets: { bottom: 0, left: 0, right: 0, top: 0 },
}

// Keyed by plain string rather than by the names it holds, so the `theme`
// global, an arbitrary string as far as this file knows, can be looked up
// without an assertion narrowing it back down.
const DEMO_THEMES: Readonly<Partial<Record<string, DemoTheme>>> = demoThemes

// Every story renders inside a ThemeScope pinned to the toolbar's choice,
// which paints the scope's surface, so a dark story is drawn on a dark canvas
// rather than on the white one the preview frame has of its own. Pinned in
// both directions: left unset, the scheme would follow the machine's
// appearance, and picking light on a dark machine would fall through to dark.
//
// A demo scheme states every colour, so the library scheme under it decides
// nothing a story draws, and light is pinned under it only to paint the
// surface.
//
// The safe area's provider is there for the web: its `SafeAreaView`, which
// ListDetail's panes are, reads the insets from one and throws without it,
// where the native view measures its own.
function Canvas({ children, fill, name }: CanvasProps) {
  return (
    <ThemeScope
      scheme={name === 'dark' ? 'dark' : 'light'}
      style={useFill(fill)}
      theme={DEMO_THEMES[name]?.theme}
    >
      <SafeAreaProvider initialMetrics={METRICS}>
        <Gutter>{children}</Gutter>
      </SafeAreaProvider>
    </ThemeScope>
  )
}

function Gutter({ children }: { readonly children: ReactNode }) {
  const styles = stylesOf(useTheme())

  return <View style={styles.gutter}>{children}</View>
}

// The window's height as the canvas's least, so the scope's surface reaches
// the bottom of the frame however short the story is.
function useFill(fill: boolean): undefined | ViewStyle {
  const { height } = useWindowDimensions()

  return fill ? { minHeight: height } : undefined
}

export default Canvas
