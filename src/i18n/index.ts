import type { LibraryMessages } from './messages'

import { localeOf } from '../number/locale'
import { MESSAGES } from './messages'

// The words the library writes itself, in the locale a component is given or
// the device's. Web reads them through React Aria's dictionary, in the
// I18nProvider's locale, and this falls back the way that dictionary does: the
// table's entry for the locale, then the first for its language, then English,
// so `fr-CA` reads French and a locale the table lacks reads English.

const TABLE = new Map(Object.entries(MESSAGES))

// One set per locale an app renders in, looked up the first time a component
// asks for it.
const cache = new Map<string, LibraryMessages>()

// A device's locale can carry a Unicode extension, `pt-PT-u-nu-latn`, which
// says how numbers are written rather than which words; it is set aside, or
// `pt-PT` would match no entry and read the first Portuguese one, Brazil's.
function lookUp(locale: string): LibraryMessages {
  const tag = locale.split('-u-')[0]
  const language = tag.split('-')[0]

  return (
    TABLE.get(tag) ??
    [...TABLE].find(([key]) => key.startsWith(`${language}-`))?.[1] ??
    MESSAGES['en-US']
  )
}

/** The library's words in `locale`, or in the device's when given none. */
function messagesFor(locale?: string): LibraryMessages {
  const resolved = localeOf(locale)
  const cached = cache.get(resolved)

  if (cached !== undefined) {
    return cached
  }

  const messages = lookUp(resolved)
  cache.set(resolved, messages)
  return messages
}

// The plural form a count takes in `locale`. Hermes has not always shipped
// `Intl.PluralRules`, and where it is missing a count of one takes the
// singular and any other the plural, which is English's rule.
function pluralOf(locale: string, count: number) {
  // oxlint-disable-next-line typescript/no-unnecessary-condition -- typed as always there, which a runtime without it is not
  if (Intl.PluralRules === undefined) {
    return count === 1 ? 'one' : 'other'
  }

  return new Intl.PluralRules(locale).select(count)
}

/**
 * How many rows a search leaves, in `locale` or the device's, for a screen
 * reader: the count in the locale's plural form, or the empty row's words
 * when it is none.
 */
function resultsFor(count: number, locale?: string): string {
  const resolved = localeOf(locale)
  const messages = messagesFor(resolved)

  if (count === 0) {
    return messages.noResults
  }

  const form =
    pluralOf(resolved, count) === 'one'
      ? messages.results.one
      : messages.results.other

  return form.replace('{count}', new Intl.NumberFormat(resolved).format(count))
}

export { messagesFor, resultsFor }
export type { LibraryMessages }
