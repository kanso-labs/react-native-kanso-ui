import type { ComponentRef, ReactNode } from 'react'

import {
  createContext,
  use,
  useId,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react'
import { Platform, StyleSheet, View } from 'react-native'

import { I18nProvider, useProvidedLocale } from '../i18n/provider'
import { ScopeContext, useScope } from '../theme/scope'

type Entry = readonly [key: string, content: ReactNode]

/** What an overlay reaches its host through. */
type OverlayStore = {
  /** Takes the layer the host draws its overlays in, as its ref. */
  readonly attach: (layer: ComponentRef<typeof View> | null) => void
  readonly entries: () => readonly Entry[]
  /**
   * How many of the overlays a screen reader is kept from, counted from the
   * first, or -1 while it reaches all of them and the screen.
   */
  readonly hiddenBelow: () => number
  /**
   * Hides from a screen reader what lies under the overlay `key`, the screen
   * and the overlays before it, until the returned function is called.
   */
  readonly hide: (key: string) => () => void
  /** The layer the host draws its overlays in, for placing one in it. */
  readonly layer: () => ComponentRef<typeof View> | null
  readonly remove: (key: string) => void
  readonly set: (key: string, content: ReactNode) => void
  readonly subscribe: (listener: () => void) => () => void
}

const OverlayHostContext = createContext<null | OverlayStore>(null)

// The key of the overlay a caller is drawn in, and `null` outside one.
const EntryContext = createContext<null | string>(null)

const styles = StyleSheet.create({
  // Each overlay fills the layer on a box of its own, so one laid out in the
  // flow, as a bar along an edge is, is laid out against the screen rather
  // than after the overlay before it.
  fill: {
    bottom: 0,
    left: 0,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  // The screen, in a view of its own that fills the host's, so a screen
  // reader can be kept from it as a whole while a panel is open. It is never
  // flattened away, or hiding it would make it a view of its own and remount
  // what it holds, losing a scroll offset or a field's focus.
  screen: {
    flexGrow: 1,
  },
})

// Hidden on iOS and Android alone: on the web an `aria-hidden` over a control
// that takes focus is an error of its own, and React Native Web's overlays
// are not where a browser's screen reader wanders.
function hiddenOf(hidden: boolean) {
  return hidden && Platform.OS !== 'web'
}

/**
 * Draws its content above the screen, in the overlay host of the app's
 * outermost `ThemeScope`, for as long as it is mounted. A later overlay draws
 * above an earlier one.
 *
 * The content reads the `ThemeScope` and the `I18nProvider` around the
 * `Overlay`, as anything else there would, so a dialog writes in the locale
 * of the screen that opened it, as web's portal does. Other context set
 * between the host and the `Overlay` does not reach it: an overlay is a
 * surface of its own, as web's `OverlayScope` makes one, so it starts from
 * what is around the app rather than from what is around the control that
 * opened it.
 */
function Overlay({ children }: { readonly children?: ReactNode }) {
  const store = use(OverlayHostContext)
  const scope = useScope()
  const locale = useProvidedLocale()
  const key = useId()

  if (store === null) {
    throw new Error(
      'An overlay draws in the host of the outermost ThemeScope, and there is no ThemeScope around this one. Wrap the app in a ThemeScope.',
    )
  }

  // Set before paint, so an overlay opening never draws a frame without it,
  // and replaced in place on an update, so it keeps its place in the stack.
  useLayoutEffect(() => {
    store.set(
      key,
      <ScopeContext value={scope}>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </ScopeContext>,
    )
  }, [children, key, locale, scope, store])

  useLayoutEffect(
    () => () => {
      store.remove(key)
    },
    [key, store],
  )

  return null
}

/**
 * Hosts the overlays drawn inside it: its children, in a view that fills the
 * view around the host, then a layer over them that fills it too. Mounting
 * or unmounting an overlay renders the layer alone, so the screen under it
 * keeps its state.
 *
 * While an overlay asks for it, through {@link useHiddenBelow}, the screen
 * and the overlays under that one are kept from a screen reader on iOS and
 * Android, as React Aria hides what lies outside an open menu on web. A
 * screen reader acts on what it reaches directly, so otherwise a swipe left
 * an open menu and a double tap worked a control under it.
 *
 * The outermost `ThemeScope` renders one, so an app has one at its root.
 */
function OverlayHost({ children }: { readonly children?: ReactNode }) {
  const [store] = useState(storeFor)
  const hiddenBelow = useSyncExternalStore(store.subscribe, store.hiddenBelow)

  return (
    <OverlayHostContext value={store}>
      <View
        aria-hidden={hiddenOf(hiddenBelow >= 0)}
        collapsable={false}
        style={styles.screen}
      >
        {children}
      </View>
      <OverlayLayer attach={store.attach} store={store} />
    </OverlayHostContext>
  )
}

// The layer passes a touch through to the screen wherever no overlay is
// drawn, so an open overlay leaves the screen around it usable. It takes its
// ref apart from the store, since the compiler reads an object a ref is taken
// from as a ref itself, and the store is read during render.
function OverlayLayer({
  attach,
  store,
}: {
  readonly attach: OverlayStore['attach']
  readonly store: OverlayStore
}) {
  const entries = useSyncExternalStore(store.subscribe, store.entries)
  const hiddenBelow = useSyncExternalStore(store.subscribe, store.hiddenBelow)

  return (
    <View ref={attach} style={styles.fill}>
      {entries.map(([key, content], index) => (
        <View
          aria-hidden={hiddenOf(index < hiddenBelow)}
          key={key}
          style={styles.fill}
        >
          <EntryContext value={key}>{content}</EntryContext>
        </View>
      ))}
    </View>
  )
}

function storeFor(): OverlayStore {
  const content = new Map<string, ReactNode>()
  const listeners = new Set<() => void>()
  const hiders = new Set<string>()
  let entries: readonly Entry[] = []
  let hiddenBelow = -1
  let layer: ComponentRef<typeof View> | null = null

  const changed = () => {
    entries = [...content]
    hiddenBelow = entries.findLastIndex(([key]) => hiders.has(key))
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    attach: (view) => {
      layer = view
    },
    entries: () => entries,
    hiddenBelow: () => hiddenBelow,
    hide: (key) => {
      hiders.add(key)
      changed()
      return () => {
        hiders.delete(key)
        changed()
      }
    },
    layer: () => layer,
    remove: (key) => {
      if (content.delete(key)) {
        changed()
      }
    },
    set: (key, node) => {
      content.set(key, node)
      changed()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export type { OverlayStore }

/**
 * Keeps a screen reader from what lies under the overlay the caller is drawn
 * in, the screen and the overlays before it, while `hides` holds. Outside an
 * overlay it does nothing.
 */
function useHiddenBelow(hides: boolean) {
  const store = use(OverlayHostContext)
  const key = use(EntryContext)

  useLayoutEffect(() => {
    if (!hides || store === null || key === null) {
      return undefined
    }
    return store.hide(key)
  }, [hides, key, store])
}

export { Overlay, OverlayHost, OverlayHostContext, useHiddenBelow }
