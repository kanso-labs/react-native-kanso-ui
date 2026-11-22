import type { ReactNode } from 'react'

// Where a label can break: a run of spaces other than the no-break ones, a
// hyphen, which the platform breaks after, or a zero-width space.
const BREAKS = /[^\S\u00A0\u2007\u202F\uFEFF]+|[-\u2010\u200B]/u

/**
 * How many words a label that is a string holds: the most lines a wrapped
 * label takes, one a word. A label that is not a string has no words to
 * count.
 */
function wordsIn(children: ReactNode): number | undefined {
  if (typeof children !== 'string') {
    return undefined
  }
  const count = children.split(BREAKS).filter(Boolean).length
  return count === 0 ? undefined : count
}

export { wordsIn }
