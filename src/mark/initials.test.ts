import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'

import { initialsOfPerson } from './initials'

type Name = {
  readonly initials: string
  readonly locale?: string
  readonly name: string
}

// Each name with its initials, and the locale they are taken in where it
// matters. Run twice: once through `Intl.Segmenter`, as the web Storybook and
// this suite have it, and once through the pattern that stands in for it on
// Hermes, which has none.
const NAMES: readonly Name[] = [
  { initials: 'AL', name: 'Ada Lovelace' },
  { initials: 'A', name: 'Ada' },
  { initials: 'AL', name: 'Ada  King   Lovelace' },
  { initials: '', name: '   ' },
  { initials: '', name: '' },
  // Indexing a string with [0] would split the surrogate pair and draw a
  // replacement character.
  { initials: '𝒜𝓁', name: '𝒜da 𝓁ovelace' },
  { initials: 'AL', name: 'ada lovelace' },
  // Several code points drawn as one: an accent written as a combining mark,
  // a joined emoji, a flag, an emoji with a skin tone, and an Indic conjunct.
  { initials: 'A\u0301L', name: 'A\u0301da Lovelace' },
  {
    initials: '\u{1F469}\u200D\u{1F4BB}L',
    name: '\u{1F469}\u200D\u{1F4BB} Lovelace',
  },
  { initials: '\u{1F1EC}\u{1F1E7}L', name: '\u{1F1EC}\u{1F1E7} Lovelace' },
  { initials: '\u{1F44B}\u{1F3FD}L', name: '\u{1F44B}\u{1F3FD} Lovelace' },
  {
    initials: '\u0915\u094D\u0937\u0936',
    name: '\u0915\u094D\u0937\u092E\u093E \u0936\u0930\u094D\u092E\u093E',
  },
  // What a display name carries beside the name: a title before it, a suffix
  // after it, an aside in brackets, punctuation around a word.
  { initials: 'AL', name: 'Ada Lovelace (she/her)' },
  { initials: 'AL', name: '(Ada) Lovelace' },
  { initials: 'AL', name: '"Ada" Lovelace' },
  { initials: 'AL', name: 'Dr. Ada Lovelace' },
  { initials: 'AL', name: 'Ada Lovelace Jr.' },
  { initials: 'AL', name: 'Ada Lovelace, Jr.' },
  { initials: 'AL', name: 'Ada Lovelace III' },
  { initials: 'AL', name: 'Ada Lovelace 3rd' },
  { initials: 'AL', name: 'A. B. Lovelace' },
  // Upper-casing can lengthen a letter, "ß" being "SS", and two initials stay
  // two.
  { initials: 'SM', name: 'ßen Müller' },
  // Arabic letters join to the next, so a zero-width non-joiner keeps two
  // initials two letters.
  {
    initials: '\u0645\u200C\u0639',
    locale: 'ar-EG',
    name: '\u0645\u062D\u0645\u062F \u0639\u0644\u064A',
  },
  // Turkish upper-cases a dotted "i" to "İ", where English gives "I".
  { initials: 'İS', locale: 'tr-TR', name: 'ilk son' },
  { initials: 'IS', locale: 'en-US', name: 'ilk son' },
]

const { Segmenter } = Intl

afterEach(() => {
  Object.assign(Intl, { Segmenter })
})

describe('initialsOfPerson through Intl.Segmenter', () => {
  it('has a segmenter to read through', () => {
    expect(typeof Intl.Segmenter).toBe('function')
  })

  it.each(NAMES)(
    'initialises $name as $initials',
    ({ initials, locale, name }) => {
      expect(initialsOfPerson(name, locale)).toBe(initials)
    },
  )

  // A Hangul syllable written as its separate jamo, which only the segmenter
  // knows to keep together.
  it('keeps a syllable written in jamo whole', () => {
    expect(initialsOfPerson('\u1100\u1161\u11A8')).toBe('\u1100\u1161\u11A8')
  })
})

describe('initialsOfPerson on an engine with no Intl.Segmenter', () => {
  beforeEach(() => {
    Object.assign(Intl, { Segmenter: undefined })
  })

  it('reads through the pattern', () => {
    expect(Intl.Segmenter).toBeUndefined()
    expect(initialsOfPerson('Ada Lovelace')).toBe('AL')
  })

  it.each(NAMES)(
    'initialises $name as $initials',
    ({ initials, locale, name }) => {
      expect(initialsOfPerson(name, locale)).toBe(initials)
    },
  )

  // The pattern has no rule for jamo, so it takes the leading consonant
  // alone, as its header says. A name typed on a phone is written in
  // syllables, which it keeps whole.
  it('splits a syllable written in jamo, and keeps one written whole', () => {
    expect(initialsOfPerson('\u1100\u1161\u11A8')).toBe('\u1100')
    expect(initialsOfPerson('\uAC01')).toBe('\uAC01')
  })

  // A virama joins the next consonant into the same grapheme, and is a mark
  // itself, so it is tried first: in Telugu as in Devanagari.
  it('keeps a conjunct whole in each script whose virama joins', () => {
    expect(initialsOfPerson('\u0C15\u0C4D\u0C37\u0C2E')).toBe(
      '\u0C15\u0C4D\u0C37',
    )
    expect(initialsOfPerson('\u0995\u09CD\u09B7\u09AE')).toBe(
      '\u0995\u09CD\u09B7',
    )
  })
})
