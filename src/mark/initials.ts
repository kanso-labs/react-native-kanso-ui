// What an avatar shows while it has no photo: the initials of the person's
// name. Copied from kanso-ui's `src/mark/initials.ts` rather than shared
// through a package, so the two read a name the same way and each can be
// read without the other.
//
// It works in graphemes, what a reader sees as one character, in the
// device's locale. A code point drops an accent written as a combining mark,
// splits an Indic conjunct and cuts a flag or a joined emoji in half;
// upper-casing without the locale turns a Turkish "i" into "I" rather than
// "İ".
//
// Graphemes come from `Intl.Segmenter` where the engine has it, as browsers
// and Node do. Hermes's Intl has no Segmenter, only a collator and the date
// and number formats, so on a device `GRAPHEME` stands in: a
// character with the marks and emoji modifiers after it, a pair of regional
// indicators as one flag, a sequence joined by a zero-width joiner, and the
// consonants Unicode joins through a virama into one conjunct. It has no rule
// for the rest of Unicode's, so it splits a Hangul syllable written as
// separate jamo, which a name typed on a phone is not.

// What a word's initial can be: a letter, a number, or a picture — an emoji,
// or a flag, which is a pair of regional indicators. A word opening with
// anything else — a bracket, a quote, the @ of a handle, the # of a channel
// — is initialised by the first of these inside it.
const INITIAL = /^[\p{L}\p{N}\p{Extended_Pictographic}\p{Regional_Indicator}]/u

// The scripts whose letters join to the next one. Two initials in one of
// them, written side by side, shape into a single connected word rather than
// two letters, so a zero-width non-joiner goes between them.
const JOINING =
  /^[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Mongolian}\p{Script=Nko}\p{Script=Adlam}\p{Script=Mandaic}\p{Script=Manichaean}\p{Script=Psalter_Pahlavi}\p{Script=Hanifi_Rohingya}\p{Script=Sogdian}\p{Script=Old_Uyghur}]/u

const ZERO_WIDTH_NON_JOINER = '\u200C'

// A title before a name — "Dr.", "Mrs.", "Prof." — which is not one of its
// words. Two letters at least, so a first initial written "J." is kept.
const TITLE = /^\p{L}{2,4}\.$/u

// A generational suffix after a name — "Jr.", "Sr", "III", "3rd" — which is
// not its last word either. The numerals are the generational ones only, so
// a surname that reads as a numeral, "Xi" say, is kept.
const SUFFIX = /^(?:jr|sr|ii|iii|iv|\d+(?:st|nd|rd|th))\.?,?$/iu

// Something said about the name rather than part of it, in brackets at its
// end: "(she/her)", "[away]".
const TRAILING_ASIDE = /\s*[([{][^)\]}]*[)\]}]\s*$/u

// One grapheme, where the engine has no `Intl.Segmenter`: a flag, or a
// character followed by what attaches to it. The viramas are the six Unicode
// joins the next consonant through, in Devanagari, Bengali, Gujarati, Oriya,
// Telugu and Malayalam, and they are tried before the plain mark they also
// are, so the consonant after one stays in the grapheme.
const GRAPHEME =
  /\p{Regional_Indicator}{2}|\P{M}(?:[\u094D\u09CD\u0ACD\u0B4D\u0C4D\u0D4D]\u200D?\p{L}|[\p{M}\p{Emoji_Modifier}]|\u200D\P{M})*/gu

const segmenters = new Map<string, Intl.Segmenter>()

function graphemesOf(text: string, locale: string | undefined) {
  // Asked on every call rather than once, so a test can take it away.
  if (typeof Intl.Segmenter !== 'function') {
    return text.match(GRAPHEME) ?? []
  }

  const key = locale ?? ''
  let segmenter = segmenters.get(key)
  if (segmenter === undefined) {
    segmenter = new Intl.Segmenter(locale, { granularity: 'grapheme' })
    segmenters.set(key, segmenter)
  }
  return Array.from(segmenter.segment(text), ({ segment }) => segment)
}

/**
 * The character that stands for `word`: its first grapheme that is a letter,
 * a number or a picture, or its first grapheme where it has none of those,
 * so something always shows. Upper-cased in the locale, and then one
 * grapheme of that, since upper-casing can lengthen it: "ß" is "SS".
 */
function initialOf(word: string, locale: string | undefined) {
  const graphemes = graphemesOf(word, locale)
  const chosen =
    graphemes.find((grapheme) => INITIAL.test(grapheme)) ??
    graphemes.at(0) ??
    ''
  return graphemesOf(chosen.toLocaleUpperCase(locale), locale).at(0) ?? ''
}

/**
 * The initials of the first and the last word, which handles both "Ada" and
 * "Ada Lovelace" without a separate prop for how many to take. What a
 * display name carries around the name itself is left out first: a title
 * before it, a generational suffix after it, and an aside in brackets at its
 * end. A name written without spaces between its words — Japanese, Chinese —
 * is one word to this, and takes one initial.
 *
 * `locale` is the device's when left out, which is what an avatar passes.
 */
function initialsOfPerson(name: string, locale?: string) {
  let words = name.replace(TRAILING_ASIDE, '').split(/\s+/u).filter(Boolean)
  if (words.length > 1 && TITLE.test(words[0] ?? '')) {
    words = words.slice(1)
  }
  if (words.length > 1 && SUFFIX.test(words.at(-1) ?? '')) {
    words = words.slice(0, -1)
  }
  if (words.length === 0) {
    return ''
  }
  const first = initialOf(words[0] ?? '', locale)
  if (words.length === 1) {
    return first
  }
  const last = initialOf(words.at(-1) ?? '', locale)
  const between =
    JOINING.test(first) && JOINING.test(last) ? ZERO_WIDTH_NON_JOINER : ''
  return `${first}${between}${last}`
}

export { initialsOfPerson }
