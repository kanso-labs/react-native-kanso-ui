import type { ReactNode } from 'react'

import { ScrollView, StyleSheet, useColorScheme } from 'react-native'

import { ThemeScope, useTheme } from '../../src'
import { themedStyles } from '../../src/theme/styles'

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

// The device's counterpart of the web Storybook's canvas. A device has no
// toolbar, so the scheme is the one its appearance asks for, and switching the
// device to dark is how a story is read in dark. It is pinned all the same,
// which is what paints the scope's surface behind the story.
function Canvas({ children }: { readonly children: ReactNode }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'

  return (
    <ThemeScope scheme={scheme} style={styles.fill}>
      <Gutter>{children}</Gutter>
    </ThemeScope>
  )
}

function Gutter({ children }: { readonly children: ReactNode }) {
  const { content } = stylesOf(useTheme())

  return <ScrollView contentContainerStyle={content}>{children}</ScrollView>
}

export default Canvas
