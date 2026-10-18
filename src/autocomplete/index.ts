import type { Node } from 'react-stately'

import { createContext } from 'react'

// What Autocomplete hands the search field and the list inside it. The field
// shows `inputValue` and reports each edit through `setInputValue`; the list
// keeps the rows `matches` keeps, which is the autocomplete's filter with
// what has been typed already in it. Neither part takes it as a prop, so a
// field and a list written out inside an Autocomplete are wired to it
// wherever the page puts them.

type AutocompleteValue = {
  /** What has been typed into the search field. */
  readonly inputValue: string
  /** Whether the list keeps a row, given its text and its entry. */
  readonly matches: (textValue: string, node: Node<unknown>) => boolean
  /** Called by the search field with each edit. */
  readonly setInputValue: (value: string) => void
}

const AutocompleteContext = createContext<AutocompleteValue | null>(null)

// One collator per locale an app searches in, made the first time a search
// asks for it.
const collators = new Map<string, Intl.Collator>()

// The collator a search in `locale` compares with, made once per locale.
function collatorIn(locale: string) {
  const made = collators.get(locale)

  if (made !== undefined) {
    return made
  }

  const collator = new Intl.Collator(locale, {
    sensitivity: 'base',
    usage: 'search',
  })
  collators.set(locale, collator)
  return collator
}

/**
 * A match anywhere in a row's text, as React Aria's `useFilter` makes it:
 * each slice of the text as long as the search is compared with it by an
 * `Intl.Collator` at base sensitivity, which tells letters apart and nothing
 * else, so case and accents are ignored. Both are normalised first, so an
 * accent typed as a combining mark matches one written as a single letter.
 * An empty search matches every row.
 */
function containsIn(locale: string) {
  const collator = collatorIn(locale)

  return (textValue: string, inputValue: string) => {
    if (inputValue.length === 0) {
      return true
    }

    const text = textValue.normalize('NFC')
    const search = inputValue.normalize('NFC')

    for (let start = 0; start + search.length <= text.length; start++) {
      const slice = text.slice(start, start + search.length)

      if (collator.compare(search, slice) === 0) {
        return true
      }
    }

    return false
  }
}

/**
 * A match at the start of a text, as React Aria's `useFilter` makes it:
 * compared as {@link containsIn} compares, so `a` starts `AM` and `ä` starts
 * `après`. An empty search starts every text.
 */
function startsWithIn(locale: string) {
  const collator = collatorIn(locale)

  return (text: string, search: string) => {
    if (search.length === 0) {
      return true
    }

    const normalized = search.normalize('NFC')
    const start = text.normalize('NFC').slice(0, normalized.length)

    return collator.compare(normalized, start) === 0
  }
}

export { AutocompleteContext, containsIn, startsWithIn }
export type { AutocompleteValue }
