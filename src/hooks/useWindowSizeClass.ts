import { useWindowDimensions } from 'react-native'

import { breakpoints } from '../tokens/defaults'

/**
 * Material Design's window size classes, which kanso-ui's breakpoint tokens
 * bound: `compact` from 0, `medium` from 600dp, `expanded` from 840dp, `large`
 * from 1200dp and `extraLarge` from 1600dp.
 */
type WindowSizeClass = keyof typeof breakpoints

// Widest first, so the first class whose lower bound the window reaches is
// the one it is in. The bounds themselves are the tokens'.
const CLASSES: readonly WindowSizeClass[] = [
  'extraLarge',
  'large',
  'expanded',
  'medium',
  'compact',
]

/**
 * The window size class the app's window is in, by its width, as the library's
 * own components lay themselves out by it. It changes as the window does: on
 * rotation, in split screen, and when a foldable unfolds.
 *
 * ```tsx
 * const sizeClass = useWindowSizeClass()
 * const columns = sizeClass === 'compact' ? 1 : 2
 * ```
 *
 * The classes are at
 * https://m3.material.io/foundations/layout/applying-layout/window-size-classes.
 */
function useWindowSizeClass(): WindowSizeClass {
  const { width } = useWindowDimensions()

  return (
    CLASSES.find((sizeClass) => width >= breakpoints[sizeClass]) ?? 'compact'
  )
}

export { useWindowSizeClass }
export type { WindowSizeClass }
