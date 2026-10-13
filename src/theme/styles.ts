import type { StyleProp } from 'react-native'

import type { ResolvedTheme } from './scope'

/**
 * Styles in the order they apply, each over the ones before it, as React
 * Native's array form takes them. A call site's own `style` goes last.
 */
function composeStyles<Style>(...styles: StyleProp<Style>[]): StyleProp<Style> {
  return styles
}

/**
 * A stylesheet built from the theme, created once for each theme it is asked
 * for. The same theme is the same object, so a component re-rendering under
 * an unchanged scope is handed the stylesheet it already had, and one under
 * another scope or scheme is handed that scope's.
 *
 * ```tsx
 * const stylesOf = themedStyles(({ colors, spacing }) =>
 *   StyleSheet.create({ box: { backgroundColor: colors.surface, padding: spacing.md } }),
 * )
 *
 * function Box() {
 *   const styles = stylesOf(useTheme())
 *   return <View style={styles.box} />
 * }
 * ```
 */
function themedStyles<Styles>(
  create: (theme: ResolvedTheme) => Styles,
): (theme: ResolvedTheme) => Styles {
  const sheets = new WeakMap<ResolvedTheme, Styles>()

  return (theme) => {
    const known = sheets.get(theme)

    if (known !== undefined) {
      return known
    }

    const sheet = create(theme)

    sheets.set(theme, sheet)

    return sheet
  }
}

export { composeStyles, themedStyles }
