import type { StyleProp, TextStyle } from 'react-native'

import { StyleSheet } from 'react-native'

import type { ResolvedTheme } from '../theme/scope'

import { useTheme } from '../theme/scope'
import { composeStyles, themedStyles } from '../theme/styles'
import { useFontFamily } from './fonts'

/**
 * The type scale on Material Design's typography pages: the display, headline,
 * title, body and label roles at large, medium and small.
 */
type TypeRole =
  | 'bodyLarge'
  | 'bodyMedium'
  | 'bodySmall'
  | 'displayLarge'
  | 'displayMedium'
  | 'displaySmall'
  | 'headlineLarge'
  | 'headlineMedium'
  | 'headlineSmall'
  | 'labelLarge'
  | 'labelMedium'
  | 'labelSmall'
  | 'titleLarge'
  | 'titleMedium'
  | 'titleSmall'

// The weights React Native names. A variable font on web takes any weight from
// 1 to 1000, and native takes the nearest of these.
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const

const familyStyles = new Map<string, TextStyle>()

function familyStyle(family: string | undefined): TextStyle | undefined {
  if (family === undefined) {
    return undefined
  }

  const known = familyStyles.get(family)

  if (known !== undefined) {
    return known
  }

  const style = { fontFamily: family }

  familyStyles.set(family, style)

  return style
}

function nativeWeight(weight: number) {
  return WEIGHTS[Math.min(Math.max(Math.round(weight / 100), 1), 9) - 1]
}

// Every role sets all four of its measures rather than inheriting any, so a
// role nested in another's text keeps its own line height and tracking, as on
// web. The family is the fifth, and is chosen at render by useFontFamily.
function roleStyle(
  typography: ResolvedTheme['typography'],
  role: TypeRole,
): TextStyle {
  return {
    fontSize: typography[`${role}Size`],
    fontWeight: nativeWeight(typography[`${role}Weight`]),
    letterSpacing: typography[`${role}Tracking`],
    lineHeight: typography[`${role}LineHeight`],
  }
}

const stylesOf = themedStyles(({ typography }) =>
  StyleSheet.create({
    bodyLarge: roleStyle(typography, 'bodyLarge'),
    bodyMedium: roleStyle(typography, 'bodyMedium'),
    bodySmall: roleStyle(typography, 'bodySmall'),
    displayLarge: roleStyle(typography, 'displayLarge'),
    displayMedium: roleStyle(typography, 'displayMedium'),
    displaySmall: roleStyle(typography, 'displaySmall'),
    headlineLarge: roleStyle(typography, 'headlineLarge'),
    headlineMedium: roleStyle(typography, 'headlineMedium'),
    headlineSmall: roleStyle(typography, 'headlineSmall'),
    labelLarge: roleStyle(typography, 'labelLarge'),
    labelMedium: roleStyle(typography, 'labelMedium'),
    labelSmall: roleStyle(typography, 'labelSmall'),
    titleLarge: roleStyle(typography, 'titleLarge'),
    titleMedium: roleStyle(typography, 'titleMedium'),
    titleSmall: roleStyle(typography, 'titleSmall'),
  }),
)

/**
 * The style a type role draws in under the theme around the caller: its size,
 * line height, weight and tracking from the role's tokens, and its family.
 * Every component that sets text in a role draws it through this.
 */
function useTypeRole(role: TypeRole): StyleProp<TextStyle> {
  const theme = useTheme()
  const family = useFontFamily(theme.typography[`${role}Font`])

  return composeStyles(stylesOf(theme)[role], familyStyle(family))
}

export { useTypeRole }
export type { TypeRole }
