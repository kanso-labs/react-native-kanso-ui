import { createContext, use } from 'react'
import { useColorScheme } from 'react-native'

import type { KuiTheme } from '../tokens/defaults'
import type { Easing, ThemeProblem } from './resolve'

import { dark, light } from '../tokens/defaults'
import { resolveTheme } from './resolve'

// A property's name in camel case, as the resolver keys it:
// `body-large-size` is `bodyLargeSize`.
type CamelCase<Name extends string> = Name extends `${infer Head}-${infer Tail}`
  ? `${Head}${Capitalize<CamelCase<Tail>>}`
  : Name

// The keys a group takes: the rest of the name of every property that starts
// with the group's segment.
type KeysOf<
  Segment extends string,
  Property extends string = keyof KuiTheme,
> = Property extends `--kui-${Segment}-${infer Rest}` ? CamelCase<Rest> : never

/**
 * The tokens in the values React Native styles take, grouped and keyed as the
 * web library's StyleX token modules are: `var(--kui-color-primary)` on web is
 * `colors.primary` here, and `--kui-typography-body-large-size` is
 * `typography.bodyLargeSize`.
 *
 * Lengths are in dp and durations in milliseconds. An easing is the four
 * control points `Easing.bezier()` takes, a font family the list of families
 * to try in order, and a shadow the `boxShadow` value as CSS writes it.
 */
type ResolvedTheme = {
  readonly colors: { readonly [Key in KeysOf<'color'>]: string }
  readonly motion: {
    readonly [Key in KeysOf<'motion'>]: Key extends `easing${string}`
      ? Easing
      : number
  }
  readonly radii: { readonly [Key in KeysOf<'radius'>]: number }
  readonly shadows: { readonly [Key in KeysOf<'shadow'>]: string }
  readonly sizing: { readonly [Key in KeysOf<'sizing'>]: number }
  readonly spacing: { readonly [Key in KeysOf<'spacing'>]: number }
  readonly stateLayerOpacity: {
    readonly [Key in KeysOf<'state-layer-opacity'>]: number
  }
  readonly typography: {
    readonly [Key in KeysOf<'typography'>]: Key extends
      | `${string}Font`
      | `fontFamily${string}`
      ? readonly string[]
      : number
  }
}

type Scheme = 'dark' | 'light'

/** What a scope hands everything inside it. */
type Scope = {
  /** Every override this scope and the scopes around it declare, merged. */
  readonly overrides: KuiTheme
  readonly scheme: Scheme
  readonly theme: ResolvedTheme
}

const DEFAULTS: Readonly<Record<Scheme, KuiTheme>> = { dark, light }

// What a scope declaring no overrides of its own hands on, shared so that
// every such scope resolves to the same theme.
const NO_OVERRIDES: KuiTheme = {}

const ScopeContext = createContext<null | Scope>(null)

// Each map resolves once per scheme, keyed on the map itself. A map kept as a
// constant, or merged from constants, therefore never resolves twice, and every
// component reading it is handed the same object, which is what lets a
// component keep one stylesheet per theme.
const scopes = new WeakMap<KuiTheme, Partial<Record<Scheme, Scope>>>()

/** The overrides of a scope: its own map over those of the scopes around it. */
function merged(parent: KuiTheme, own: KuiTheme | undefined): KuiTheme {
  if (own === undefined || own === parent) {
    return parent
  }

  return parent === NO_OVERRIDES ? own : { ...parent, ...own }
}

// A value native cannot use keeps its property at the default, which a reader
// of the app would otherwise never learn, so it is named in development.
function report(problems: readonly ThemeProblem[]) {
  if (!__DEV__ || problems.length === 0) {
    return
  }

  console.warn(
    [
      'ThemeScope kept these properties at their defaults:',
      ...problems.map(
        ({ property, reason, value }) => `  ${property}: ${value} ${reason}`,
      ),
    ].join('\n'),
  )
}

function scopeFor(scheme: Scheme, overrides: KuiTheme): Scope {
  const known = scopes.get(overrides)
  const cached = known?.[scheme]

  if (cached !== undefined) {
    return cached
  }

  const { problems, theme } = resolveTheme(DEFAULTS[scheme], overrides)

  report(problems)

  const scope: Scope = {
    overrides,
    scheme,
    // The defaults declare every property and the resolver keeps a property
    // at its default when an override fails, so every key the type names is
    // there; src/tokens/defaults.test.ts pins that the defaults resolve whole.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    theme: theme as ResolvedTheme,
  }

  scopes.set(overrides, { ...known, [scheme]: scope })

  return scope
}

/**
 * The scope around the caller. Outside every `ThemeScope`, that is the
 * library's own tokens in the scheme the device's appearance asks for, as the
 * tokens on `:root` follow `prefers-color-scheme` on web.
 */
function useScope(): Scope {
  const parent = use(ScopeContext)
  const system = useColorScheme()

  return parent ?? scopeFor(system === 'dark' ? 'dark' : 'light', NO_OVERRIDES)
}

/**
 * The theme around the caller, resolved into the values React Native styles
 * take, with the keys of the web library's token modules.
 *
 * ```tsx
 * const { colors, spacing } = useTheme()
 *
 * <View style={{ backgroundColor: colors.surface, padding: spacing.md }} />
 * ```
 *
 * The same theme is the same object, so a stylesheet built from it can be
 * kept for as long as the theme is.
 */
function useTheme(): ResolvedTheme {
  return useScope().theme
}

export { merged, ScopeContext, scopeFor, useScope, useTheme }
export type { ResolvedTheme, Scheme, Scope }
