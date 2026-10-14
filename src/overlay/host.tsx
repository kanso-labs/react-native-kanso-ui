import type { ComponentRef, ReactNode } from 'react'

import {
  createContext,
  use,
  useId,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react'
import { StyleSheet, View } from 'react-native'

import { ScopeContext, useScope } from '../theme/scope'

type Entry = readonly [key: string, content: ReactNode]

/** What an overlay reaches its host through. */
type OverlayStore = {
  /** Takes the layer the host draws its overlays in, as its ref. */
  readonly attach: (layer: ComponentRef<typeof View> | null) => void
  readonly entries: () => readonly Entry[]
  /** The layer the host draws its overlays in, for placing one in it. */
  readonly layer: () => ComponentRef<typeof View> | null
  readonly remove: (key: string) => void
  readonly set: (key: string, content: ReactNode) => void
  readonly subscribe: (listener: () => void) => () => void
}

const OverlayHostContext = createContext<null | OverlayStore>(null)

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
})

/**
 * Draws its content above the screen, in the overlay host of the app's
 * outermost `ThemeScope`, for as long as it is mounted. A later overlay draws
 * above an earlier one.
 *
 * The content reads the `ThemeScope` around the `Overlay`, as anything else
 * there would. Other context set between the host and the `Overlay` does not
 * reach it: an overlay is a surface of its own, as web's `OverlayScope` makes
 * one, so it starts from what is around the app rather than from what is
 * around the control that opened it.
 */
function Overlay({ children }: { readonly children?: ReactNode }) {
  const store = use(OverlayHostContext)
  const scope = useScope()
  const key = useId()

  if (store === null) {
    throw new Error(
      'An overlay draws in the host of the outermost ThemeScope, and there is no ThemeScope around this one. Wrap the app in a ThemeScope.',
    )
  }

  // Set before paint, so an overlay opening never draws a frame without it,
  // and replaced in place on an update, so it keeps its place in the stack.
  useLayoutEffect(() => {
    store.set(key, <ScopeContext value={scope}>{children}</ScopeContext>)
  }, [children, key, scope, store])

  useLayoutEffect(
    () => () => {
      store.remove(key)
    },
    [key, store],
  )

  return null
}

/**
 * Hosts the overlays drawn inside it: its children, then a layer over them
 * that fills the view around the host. Mounting or unmounting an overlay
 * renders the layer alone, so the screen under it keeps its state.
 *
 * The outermost `ThemeScope` renders one, so an app has one at its root.
 */
function OverlayHost({ children }: { readonly children?: ReactNode }) {
  const [store] = useState(storeFor)

  return (
    <OverlayHostContext value={store}>
      {children}
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

  return (
    <View ref={attach} style={styles.fill}>
      {entries.map(([key, content]) => (
        <View key={key} style={styles.fill}>
          {content}
        </View>
      ))}
    </View>
  )
}

function storeFor(): OverlayStore {
  const content = new Map<string, ReactNode>()
  const listeners = new Set<() => void>()
  let entries: readonly Entry[] = []
  let layer: ComponentRef<typeof View> | null = null

  const changed = () => {
    entries = [...content]
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    attach: (view) => {
      layer = view
    },
    entries: () => entries,
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

export { Overlay, OverlayHost, OverlayHostContext }
