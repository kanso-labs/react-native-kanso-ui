import { useLayoutEffect, useState } from 'react'

// What a drag's gesture reads while it runs: the values of the latest render,
// from a gesture built once rather than on every move.
//
// A drag sets React state as it moves, so the component renders on every
// move, and a gesture built in render was a new one each time, which Gesture
// Handler's detector took as a new configuration and set up again. Memoised
// over what configures it instead, the gesture keeps the callbacks of the
// render it was built in, and those read that render's values: React
// Stately's slider state, for one, resets its values to the ones it was
// rendered with as a drag begins. So the callbacks read the latest values
// through this instead.
//
// A ref would be the usual holder, but the React Compiler refuses a ref read
// inside a gesture's callback, which it sees handed to a builder while
// rendering and cannot tell is not called there. This is a holder of the
// same kind it accepts: one object for the component's life, from
// `useState`, whose value is set in a `useLayoutEffect` after every commit,
// so a gesture event, which arrives after one, reads what was last drawn.

/** A value as of the latest commit, read with `get`. */
type Latest<T> = {
  readonly get: () => T
  readonly set: (next: T) => void
}

function latestOf<T>(first: T): Latest<T> {
  let held = first

  return {
    get: () => held,
    set: (next) => {
      held = next
    },
  }
}

/**
 * `value` as of the latest commit, for a gesture memoised across renders to
 * read while it runs. The object handed back is the same on every render, so
 * it can be among what the gesture is memoised over.
 */
function useLatest<T>(value: T): Latest<T> {
  const [latest] = useState(() => latestOf(value))

  useLayoutEffect(() => {
    latest.set(value)
  })

  return latest
}

export { useLatest }
export type { Latest }
