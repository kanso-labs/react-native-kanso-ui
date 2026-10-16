import type { Ref } from 'react'

// Hands one node to several refs, for a part that keeps its node for itself
// and also lands a call site's `ref` on it. Internal: nothing here is
// exported from the package.

/**
 * A ref callback that hands its node to every ref given, a callback or an
 * object alike, in the order given.
 */
function refsOf<T>(...refs: readonly (Ref<T> | undefined)[]) {
  return (node: null | T) => {
    for (const ref of refs) {
      if (typeof ref === 'function') {
        ref(node)
      } else if (ref !== null && ref !== undefined) {
        ref.current = node
      }
    }
  }
}

export { refsOf }
