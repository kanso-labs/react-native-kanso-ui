import type { ReactNode } from 'react'
import type { ViewStyle } from 'react-native'

import { StyleSheet, useWindowDimensions, View } from 'react-native'

import { ThemeScope, useTheme } from '../../src'
import { themedStyles } from '../../src/theme/styles'

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
  readonly scheme: 'dark' | 'light'
}

// Every story renders inside a ThemeScope pinned to the toolbar's scheme, which
// paints the scope's surface, so a dark story is drawn on a dark canvas rather
// than on the white one the preview frame has of its own. Pinned in both
// directions: left unset, the scheme would follow the machine's appearance,
// and picking light on a dark machine would fall through to dark.
function Canvas({ children, fill, scheme }: CanvasProps) {
  return (
    <ThemeScope scheme={scheme} style={useFill(fill)}>
      <Gutter>{children}</Gutter>
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
