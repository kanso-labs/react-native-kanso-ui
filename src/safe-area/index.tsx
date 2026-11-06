import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { Edge } from 'react-native-safe-area-context'

import { StyleSheet } from 'react-native'
import { SafeAreaListener, SafeAreaView } from 'react-native-safe-area-context'

import { composeStyles } from '../theme/styles'

// Padding by the system bars where a view meets them, and by nothing where it
// does not.
//
// safe-area-context's `SafeAreaView` pads by the insets of the nearest
// provider above it, not by its own overlap with the system bars: on iOS and
// Android alike it reads the provider's native view. With one provider at
// the root, as an app has, every view took the whole screen's inset wherever
// it sat. On an iPhone simulator an app bar drawn below another view took the
// status bar's 62pt, and a navigation bar above the screen's foot took the
// home indicator's 34pt.
//
// A provider's own insets are its overlap, though: iOS gives every view its
// share of the window's safe area, and Android measures the provider's box
// against the window's insets. So the view is held in a provider of its own,
// the listener, which keeps the insets out of context and so renders at
// once, and the view reads where it is. React Native Web reads the insets
// from context, unchanged by the listener.

const styles = StyleSheet.create({
  // The view fills the listener, which holds the place the view held.
  fill: {
    flexGrow: 1,
    flexShrink: 1,
  },
  // The listener's own `flex: 1` undone, so at rest it is as large as what it
  // holds. `flex` itself has to be undone: Yoga reads a positive `flex` as a
  // zero basis whatever `flexGrow` says.
  inflexible: {
    flex: 0,
  },
})

type SafeAreaProps = {
  readonly children?: ReactNode
  /** The view's own style: how it lays out what it holds. */
  readonly contentStyle?: StyleProp<ViewStyle>
  /** The edges padded where the view meets them. Every edge, left out. */
  readonly edges?: readonly Edge[]
  /** Its place in its parent, which takes no size of its own at rest. */
  readonly style?: StyleProp<ViewStyle>
}

// The listener reports to nothing: what it is for is being the provider the
// view finds.
function ignore() {
  // Nothing to report.
}

/**
 * A `SafeAreaView` padded by the system bars, the notch and a rounded corner
 * only where its own box meets them.
 */
function SafeArea({ children, contentStyle, edges, style }: SafeAreaProps) {
  return (
    <SafeAreaListener
      onChange={ignore}
      style={composeStyles<ViewStyle>(styles.inflexible, style)}
    >
      <SafeAreaView
        edges={edges}
        style={composeStyles<ViewStyle>(styles.fill, contentStyle)}
      >
        {children}
      </SafeAreaView>
    </SafeAreaListener>
  )
}

export { SafeArea }
