import type { ReactNode } from 'react'
import type { Node } from 'react-stately'

import { useMemo, useState } from 'react'

import type { AutocompleteValue } from '../../autocomplete'

import { AutocompleteContext, containsIn } from '../../autocomplete'
import { useLocaleOf } from '../../i18n/provider'

// kanso-ui's Autocomplete, from the search page's search with suggestions: a
// SearchField over a List, where typing narrows the rows the list shows. It
// draws nothing of its own, as web's draws nothing: the bar is SearchField's,
// the rows are List's, and where the two sit is the page's business. So it
// takes no `style`, since there is nothing for one to land on.
//
// Three things are worth knowing, and the last two differ from web's.
//
// **Filtering is on by default,** as on web: `filter` falls back to a match
// anywhere in a row's text, compared by an `Intl.Collator` in the
// `I18nProvider`'s locale, or the device's outside one, at base sensitivity, so case and accents are ignored, which is what
// web's falls back to as well.
//
// **There is no virtual focus.** Web keeps the keyboard in the input while
// the arrow keys move through the list. A touch screen has no arrow keys, so
// the list's rows are pressed where they are, and a press on one selects it
// or runs its action, as it does in any List. A list inside an Autocomplete
// keeps the keyboard up through that press, with `keyboardShouldPersistTaps`
// at `handled`, so a row is reached on the first tap rather than the one
// that would otherwise only close the keyboard.
//
// **The count is announced.** Web says only that a search left nothing.
// Here the list says how many rows a search leaves each time the number
// changes, in React Aria's words for a ComboBox's count, and that it left
// none in the empty row's: through a polite live region on Android and
// under React Native Web, and `AccessibilityInfo` on iOS, which has no live
// regions. The list's empty row is drawn as ever when nothing matches.

/**
 * Whether a search keeps a row: handed the row's text, what has been typed
 * and the row's entry in the collection, as React Aria's is.
 */
type AutocompleteFilter<T extends object = object> = (
  textValue: string,
  inputValue: string,
  node: Node<T>,
) => boolean

type AutocompleteProps<T extends object = object> = {
  /**
   * The search field and the list it filters, in whatever the page puts
   * around them.
   */
  readonly children?: ReactNode
  /** What has been typed at first, when the autocomplete keeps its own. */
  readonly defaultInputValue?: string
  /**
   * Which rows a search keeps. Left out, a row is kept when its text
   * contains what has been typed anywhere in it, ignoring case and accents.
   */
  readonly filter?: AutocompleteFilter<T>
  /** What has been typed, when the call site holds it. */
  readonly inputValue?: string
  /** Called with what has been typed whenever an edit changes it. */
  readonly onInputChange?: (value: string) => void
}

/**
 * A search field that filters the list under it. What has been typed is the
 * autocomplete's: pass `inputValue` with `onInputChange` to control it, or
 * `defaultInputValue` to let it keep its own. The field inside shows it, and
 * its own `value` and `defaultValue` are not read there.
 *
 * ```tsx
 * <Autocomplete>
 *   <SearchField label="Search" placeholder="Search" />
 *   <List aria-label="Results" selectionMode="single">
 *     <List.Item id="first">First item</List.Item>
 *   </List>
 * </Autocomplete>
 * ```
 *
 * It renders nothing of its own, so the field and the list sit wherever the
 * page puts them, and the list says how many rows each search leaves to a
 * screen reader.
 */
function Autocomplete<T extends object = object>({
  children,
  defaultInputValue = '',
  filter,
  inputValue,
  onInputChange,
}: AutocompleteProps<T>) {
  const [own, setOwn] = useState(defaultInputValue)
  const current = inputValue ?? own
  const locale = useLocaleOf(undefined)
  const value = useMemo<AutocompleteValue>(
    () => ({
      inputValue: current,
      matches: matchesOf(filter ?? containsIn(locale), current),
      setInputValue: setterOf(setOwn, onInputChange),
    }),
    [current, filter, locale, onInputChange],
  )

  return <AutocompleteContext value={value}>{children}</AutocompleteContext>
}

// The filter with what has been typed already in it, which is all a list
// asks of a row.
function matchesOf<T extends object>(
  filter: AutocompleteFilter<T>,
  inputValue: string,
): AutocompleteValue['matches'] {
  return (textValue, node) =>
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the rows are the call site's, which typed the filter it wrote for them
    filter(textValue, inputValue, node as Node<T>)
}

// Keeps an edit as the autocomplete's own value and reports it, so one the
// call site controls is told and one it does not still filters.
function setterOf(
  setOwn: (value: string) => void,
  onInputChange: ((value: string) => void) | undefined,
) {
  return (value: string) => {
    setOwn(value)
    onInputChange?.(value)
  }
}

export { Autocomplete }
export type { AutocompleteFilter, AutocompleteProps }
