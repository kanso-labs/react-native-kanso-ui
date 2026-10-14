import { useSyncExternalStore } from 'react'
import { Platform } from 'react-native'

type FontRegistry = { readonly isLoaded: (family: string) => boolean }

// expo-font is an optional peer, so it is imported where its absence can be
// caught. Metro takes an import inside a `try` as optional and bundles the
// app without it, where an import at the top of the module would fail the
// bundle of every app that does not have it. Until the import settles the
// registry is `undefined`, and `null` once it has failed.
let registry: FontRegistry | null | undefined
let loading: Promise<void> | undefined
const listeners = new Set<() => void>()

async function load(): Promise<FontRegistry | null> {
  try {
    return await import(/* @vite-ignore */ 'expo-font')
  } catch {
    return null
  }
}

async function settle() {
  registry = await load()

  for (const listener of listeners) {
    listener()
  }
}

function snapshot() {
  start()
  return registry
}

function start() {
  loading ??= settle()
}

function subscribe(listener: () => void) {
  start()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// What a role draws in when its own family is not there: the platform's
// system font, named rather than left unset, so a role nested in another's
// text does not inherit the outer role's family.
const SYSTEM_FONT = Platform.select({
  android: 'sans-serif',
  default: undefined,
  ios: 'System',
})

/** A family list as CSS writes it, quoting the names with spaces in them. */
function cssStack(families: readonly string[]): string {
  return families
    .map((family) => (/\s/u.test(family) ? `'${family}'` : family))
    .join(', ')
}

/**
 * The family a type role draws in, from the token's list of families.
 *
 * On iOS and Android that is the list's first family when the app has
 * registered it with expo-font, under the name the token gives it, and the
 * system font otherwise. Neither package ships a font, and React Native names
 * one family rather than falling through a list, so the rest of the list is
 * the browser's alone. Under React Native Web the whole list goes to CSS, as
 * it does on kanso-ui.
 *
 * A family registered after its text has drawn takes effect when that text
 * next renders, which is what an app gating its first screen on `useFonts()`
 * already arranges.
 */
function useFontFamily(families: readonly string[]): string | undefined {
  const fonts = useSyncExternalStore(subscribe, snapshot)

  if (Platform.OS === 'web') {
    return cssStack(families)
  }

  const first = families.at(0)

  return first !== undefined && fonts?.isLoaded(first) === true
    ? first
    : SYSTEM_FONT
}

export { useFontFamily }
