import type { ComponentRef, Ref } from 'react'
import type { ViewProps } from 'react-native'

import { use } from 'react'
import { StyleSheet, View } from 'react-native'

import type { KuiTheme } from './tokens/defaults'

import { OverlayHost, OverlayHostContext } from './overlay/host'
import { merged, ScopeContext, scopeFor, useScope } from './theme/scope'
import { themedStyles } from './theme/styles'

// A pinned scheme paints the scope's own surface, as on web, so a dark scope
// on a light screen reads as dark rather than drawing dark-scheme text over a
// light background. Surface rather than background: the two hold the same
// colours in both of the library's schemes, and surface is the one Material
// Design draws content on. Text colour does not inherit in React Native, so
// on surface, the other half of what web paints, is what the library's text
// draws in by default rather than something the scope sets.
const stylesOf = themedStyles(({ colors }) =>
  StyleSheet.create({
    pinned: {
      backgroundColor: colors.surface,
    },
  }),
)

type ThemeScopeProps = ViewProps & {
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * Pins the scope to the library's light or dark scheme, whatever the
   * device's appearance asks for, and paints the scope's own surface in it.
   * Left unset, the scope paints nothing and keeps the scheme around it: the
   * one an enclosing scope pins, or the device's.
   */
  readonly scheme?: 'dark' | 'light' | undefined
  /**
   * `--kui-*` overrides for everything inside, as a map of the custom
   * properties kanso-ui's `tokens.css` lists to CSS values, the same map
   * web's `ThemeScope` takes. A nested scope's map applies over its parent's.
   *
   * The values hold for both schemes. To give light and dark a value each,
   * keep two maps and hand the scope the one for the scheme in use.
   *
   * A map is resolved once for each scheme it is used in, so keep one that
   * does not change as a constant rather than writing it inline.
   */
  readonly theme?: KuiTheme | undefined
}

/**
 * Themes what is inside it.
 *
 * Every component inside reads the scope's tokens: the library's defaults in
 * the scope's scheme, with the `--kui-*` overrides of this scope and every
 * scope around it applied over them. A value is read as a browser would read
 * it, `var()` references included, and one native cannot evaluate, such as a
 * `calc()`, keeps its property at the default and is named in a development
 * warning. Dialogs and sheets follow the scope they open in, since React
 * Native's `Modal` keeps React context.
 *
 * ```tsx
 * const accent: KuiTheme = { '--kui-color-primary': '#7d5260' }
 *
 * <ThemeScope scheme="dark" style={{ flex: 1 }} theme={accent}>
 *   <Stack />
 * </ThemeScope>
 * ```
 *
 * The scope is a `View`, so one wrapping a whole screen takes `flex: 1` to
 * fill it, as any view would.
 *
 * The outermost scope also hosts what the library draws above the screen,
 * over everything inside it, so it belongs at the root of the app and fills
 * it. What draws there follows the scope it was opened in, not the root's.
 */
function ThemeScope({
  children,
  scheme,
  style,
  theme,
  ...props
}: ThemeScopeProps) {
  const host = use(OverlayHostContext)
  const parent = useScope()
  const scope = scopeFor(
    scheme ?? parent.scheme,
    merged(parent.overrides, theme),
  )
  const styles = stylesOf(scope.theme)

  return (
    <ScopeContext value={scope}>
      <View
        {...props}
        style={StyleSheet.compose(
          scheme === undefined ? undefined : styles.pinned,
          style,
        )}
      >
        {host === null ? <OverlayHost>{children}</OverlayHost> : children}
      </View>
    </ScopeContext>
  )
}

export type { KuiTheme } from './tokens/defaults'
export type { ThemeScopeProps }

export { ThemeScope }
