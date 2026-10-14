/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 *
 * Modified by Kanso Labs: ported from @internationalized/number's NumberParser
 * to find the locale's symbols with `format` rather than `formatToParts`.
 */

import type { NumberFormatOptions } from '@internationalized/number'

// Reading back a number a person typed, in the locale and the format the
// field shows it in: the parser web's NumberField reads its value with,
// through React Stately, which is @internationalized/number's NumberParser.
//
// **It finds the locale's symbols with `format` alone.** The parser it ports
// asks `formatToParts` for them, the minus sign, the decimal and group
// separators, and the currency, percent and unit text around the digits, and
// Hermes defines no `formatToParts` for `Intl.NumberFormat` on iOS, so it
// throws on the first character typed there. `format` is what every runtime
// React Native runs on has. So a known number is formatted, its digits found
// by the locale's own numerals, and each symbol read off where it falls: the
// group separator between the second and third digits of 12,345.67, the
// decimal between the fifth and sixth, the minus where the negative differs
// from the positive, and the rest of the text around the digits as what the
// parser strips. Everything after that is the parser it ports, line for
// line, and the tests compare the two across locales and formats on a
// runtime that has both.

type NoNumeralUnit = {
  readonly unit: string
  readonly value: number
}

// Where a formatted number's digits fall: the digits themselves, as ASCII, the
// text between each and the next, and the text before and after them.
type Spans = {
  readonly digits: string
  readonly gaps: readonly string[]
  readonly prefix: string
  readonly suffix: string
}

type Symbols = {
  readonly decimal: string | undefined
  readonly group: string | undefined
  readonly index: (numeral: string) => string
  readonly literals: RegExp
  readonly minusSign: string
  readonly noNumeralUnits: readonly NoNumeralUnit[]
  readonly numeral: RegExp
  readonly numerals: readonly string[]
  readonly plusSign: string | undefined
}

const CURRENCY_SIGN_REGEX = /^.*\(.*\).*$/u

// The numbering systems a value is tried in when it does not read in the
// locale's own, as the parser it ports tries them.
const NUMBERING_SYSTEMS = [
  'latn',
  'arab',
  'hanidec',
  'deva',
  'beng',
  'fullwide',
]

// Every number whose plural form a unit or a currency name can take in some
// locale, from the parser it ports.
const PLURAL_NUMBERS = [0, 4, 2, 1, 11, 20, 3, 7, 100, 21, 0.1, 1.1]

// 12,345.67: a group separator after its second digit in every locale that
// groups, and the decimal separator after its fifth.
const PROBE = 12_345.67
const PROBE_DIGITS = '1234567'

// White space and the formatting characters, Unicode's `White_Space` and
// `Cf`, which the parser it ports strips as `\p{White_Space}|\p{Cf}`. Spelled
// out rather than as property escapes, so the expression means the same
// wherever it is compiled. These are the characters in the Basic
// Multilingual Plane, which is every one a number format writes.
const SPACING =
  '\\s\\u0085\\u00ad\\u0600-\\u0605\\u061c\\u06dd\\u070f\\u0890\\u0891\\u08e2\\u180e\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u2064\\u2066-\\u206f\\ufeff\\ufff9-\\ufffb'
const SPACING_RUN = new RegExp(`[${SPACING}]+`, 'u')
const SPACING_ANY = new RegExp(`[${SPACING}]`, 'gu')

// The numbering system a locale's zero belongs to, for a runtime whose
// resolved options do not name one: Hermes on iOS names none. These are the
// systems a value is tried in, and Persian's. A locale writing any other is
// left unnamed, which a formatter reads as the locale's own system, and
// that is the one it writes.
const SYSTEMS_BY_ZERO = new Map([
  ['0', 'latn'],
  ['٠', 'arab'],
  ['۰', 'arabext'],
  ['〇', 'hanidec'],
  ['०', 'deva'],
  ['০', 'beng'],
  ['０', 'fullwide'],
])

const parserCache = new Map<string, NumberParserImpl>()

/**
 * Parses a number in a locale and a format, as @internationalized/number's
 * `NumberParser` does, without `formatToParts`.
 */
class NumberParser {
  private readonly locale: string
  private readonly options: NumberFormatOptions

  constructor(locale: string, options: NumberFormatOptions = {}) {
    this.locale = locale
    this.options = options
  }

  /**
   * The numbering system the value reads in, in the locale, or the locale's
   * own when none matches. `undefined` is the locale's own, on a runtime
   * that does not name it.
   */
  getNumberingSystem(value: string): string | undefined {
    return numberParserFor(this.locale, this.options, value).numberingSystem
  }

  /**
   * Whether the value could be the start of a number, which is how input is
   * checked as it is typed. A minus sign counts only where `minValue` is
   * below zero, and a plus sign only where `maxValue` is above it.
   */
  isValidPartialNumber(
    value: string,
    minValue?: number,
    maxValue?: number,
  ): boolean {
    return numberParserFor(
      this.locale,
      this.options,
      value,
    ).isValidPartialNumber(value, minValue, maxValue)
  }

  /** The number the value reads as, or `NaN` when it reads as none. */
  parse(value: string): number {
    return numberParserFor(this.locale, this.options, value).parse(value)
  }
}

class NumberParserImpl {
  readonly numberingSystem: string | undefined
  private readonly formatter: Intl.NumberFormat
  private readonly locale: string
  private readonly options: Intl.ResolvedNumberFormatOptions
  private readonly symbols: Symbols

  constructor(locale: string, given: NumberFormatOptions = {}) {
    this.locale = locale
    const options = withRoundingIncrement(given)
    this.formatter = new Intl.NumberFormat(locale, options)
    this.options = this.formatter.resolvedOptions()
    this.symbols = symbolsOf(locale, this.options, options)
    this.numberingSystem =
      optionalString(this.options.numberingSystem) ??
      SYSTEMS_BY_ZERO.get(this.symbols.numerals[0] ?? '')
  }

  isValidPartialNumber(
    value: string,
    minValue = -Infinity,
    maxValue = Infinity,
  ) {
    const groupAllowed = Boolean(this.formatter.resolvedOptions().useGrouping)
    const { decimal, group, minusSign, numeral, plusSign } = this.symbols
    let rest = this.sanitize(value)

    // A sign comes first.
    if (minusSign !== '' && rest.startsWith(minusSign) && minValue < 0) {
      rest = rest.slice(minusSign.length)
    } else if (
      plusSign !== undefined &&
      rest.startsWith(plusSign) &&
      maxValue > 0
    ) {
      rest = rest.slice(plusSign.length)
    }

    // A format with no fraction takes no decimal separator.
    if (
      decimal !== undefined &&
      rest.includes(decimal) &&
      this.options.maximumFractionDigits === 0
    ) {
      return false
    }

    if (group !== undefined && groupAllowed) {
      rest = rest.replaceAll(group, '')
    }
    rest = rest.replace(numeral, '')
    if (decimal !== undefined) {
      rest = rest.replace(decimal, '')
    }

    return rest.length === 0
  }

  parse(value: string): number {
    const groupAllowed = Boolean(this.formatter.resolvedOptions().useGrouping)
    const { decimal, group, index, minusSign, numeral } = this.symbols
    let plain = this.sanitize(value)

    if (!groupAllowed && group !== undefined && plain.includes(group)) {
      return Number.NaN
    } else if (group !== undefined) {
      plain = plain.replaceAll(group, '')
    }
    if (decimal !== undefined) {
      plain = plain.replace(decimal, '.')
    }
    plain = plain.replace(minusSign, '-')
    plain = plain.replace(numeral, index)

    if (this.options.style === 'percent') {
      plain = percentOf(plain)
    }

    const parsed = plain === '' ? Number.NaN : Number(plain)
    if (Number.isNaN(parsed)) {
      return Number.NaN
    }

    if (this.options.style === 'percent') {
      // Rounded as the field's formatter would show it.
      const options = {
        ...this.options,
        maximumFractionDigits: Math.min(
          (this.options.maximumFractionDigits ?? 0) + 2,
          20,
        ),
        minimumFractionDigits: Math.min(
          (this.options.minimumFractionDigits ?? 0) + 2,
          20,
        ),
        style: 'decimal',
      } satisfies NumberFormatOptions
      return new NumberParser(this.locale, options).parse(
        new Intl.NumberFormat(this.locale, options).format(parsed),
      )
    }

    // An accounting format writes a negative in brackets, which the literals
    // have already stripped.
    if (
      this.options.currencySign === 'accounting' &&
      CURRENCY_SIGN_REGEX.test(value)
    ) {
      return -1 * parsed
    }

    return parsed
  }

  private sanitize(value: string) {
    const groupAllowed = Boolean(this.formatter.resolvedOptions().useGrouping)
    const { decimal, group, literals, minusSign, noNumeralUnits } = this.symbols

    // A unit some plural forms write with no numeral, such as a day spelled
    // out, stands for its number.
    const spelled = noNumeralUnits.find((entry) => entry.unit === value)
    if (spelled !== undefined) {
      return String(spelled.value)
    }

    let rest = value.replace(literals, '')

    // The ASCII hyphen stands for the locale's minus, which a keyboard may
    // not have.
    rest = rest.replace('-', minusSign)

    // Arabic's decimal separator is on few keyboards, which type a comma or
    // the Arabic comma instead, and a full stop for its group separator.
    if (this.numberingSystem === 'arab') {
      if (decimal !== undefined) {
        rest = rest.replaceAll(',', decimal)
        rest = rest.replaceAll('،', decimal)
      }
      if (group !== undefined && groupAllowed) {
        rest = rest.replaceAll('.', group)
      }
    }

    // A right single quotation mark groups digits in some formats, Swiss
    // currency among them, where a keyboard types an apostrophe, and newer
    // data writes the apostrophe where older wrote the quotation mark.
    if (group === '’' && rest.includes("'") && groupAllowed) {
      rest = rest.replaceAll("'", group)
    }
    if (group === "'" && rest.includes('’') && groupAllowed) {
      rest = rest.replaceAll('’', group)
    }

    // French groups with a narrow no-break space, which no French keyboard
    // has, so a space and a no-break space group too.
    if (
      this.options.locale === 'fr-FR' &&
      group !== undefined &&
      groupAllowed
    ) {
      rest = rest.replaceAll(' ', group)
      rest = rest.replaceAll(' ', group)
    }

    return rest
  }
}

// What `from` became in `to`: the text `to` has between the start and the end
// the two share, and `to` with a space in its place.
function differenceOf(from: string, to: string) {
  const fromChars = Array.from(from)
  const toChars = Array.from(to)
  let start = 0
  while (
    start < fromChars.length &&
    start < toChars.length &&
    fromChars[start] === toChars[start]
  ) {
    start += 1
  }
  let end = 0
  while (
    end < fromChars.length - start &&
    end < toChars.length - start &&
    fromChars[fromChars.length - 1 - end] === toChars[toChars.length - 1 - end]
  ) {
    end += 1
  }

  return {
    added: toChars.slice(start, toChars.length - end).join(''),
    rest: `${toChars.slice(0, start).join('')} ${toChars.slice(toChars.length - end).join('')}`,
  }
}

function escapeRegex(text: string) {
  return text.replaceAll(/[$()*+.?[\\\]^{|}]/gu, '\\$&')
}

// The parser for a value: the locale's own numbering system, or the first of
// the others the value reads in, unless the locale names one.
function numberParserFor(
  locale: string,
  options: NumberFormatOptions,
  value: string,
) {
  const parser = parserOf(locale, options)

  if (!locale.includes('-nu-') && !parser.isValidPartialNumber(value)) {
    for (const system of NUMBERING_SYSTEMS) {
      if (system !== parser.numberingSystem) {
        const other = parserOf(
          `${locale}${locale.includes('-u-') ? '-nu-' : '-u-nu-'}${system}`,
          options,
        )
        if (other.isValidPartialNumber(value)) {
          return other
        }
      }
    }
  }

  return parser
}

// The numerals a locale writes, zero first.
function numeralsOf(locale: string, numberingSystem: string | undefined) {
  return Array.from(
    new Intl.NumberFormat(locale, {
      numberingSystem,
      useGrouping: false,
    }).format(9_876_543_210),
  ).toReversed()
}

function optionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function parserOf(locale: string, options: NumberFormatOptions) {
  const key =
    locale +
    Object.entries(options)
      .toSorted(([a], [b]) => (a < b ? -1 : 1))
      .join()
  const cached = parserCache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const parser = new NumberParserImpl(locale, options)
  parserCache.set(key, parser)
  return parser
}

// A percent's digits moved two places left on the string rather than divided
// by 100, which keeps the figures it was written with.
function percentOf(plain: string) {
  const negative = plain.includes('-')
  let digits = plain.replace('-', '').replace('+', '')
  let point = digits.indexOf('.')
  if (point === -1) {
    point = digits.length
  }
  digits = digits.replace('.', '')

  const moved =
    point - 2 === 0
      ? `0.${digits}`
      : point - 2 === -1
        ? `0.0${digits}`
        : point - 2 === -2
          ? '0.00'
          : `${digits.slice(0, point - 2)}.${digits.slice(point - 2)}`

  return negative ? `-${moved}` : moved
}

// The options a symbol is read with: the format's own, so its currency,
// percent or unit text is the text read, at the fraction digits given,
// grouped, and with the rounding, the notation and the sign at their
// defaults, so the digits come out whole.
function probeOptionsOf(
  resolved: Intl.ResolvedNumberFormatOptions,
  extra: NumberFormatOptions,
): NumberFormatOptions {
  return {
    ...resolved,
    maximumSignificantDigits: undefined,
    minimumSignificantDigits: undefined,
    notation: 'standard',
    roundingIncrement: 1,
    roundingMode: 'halfExpand',
    roundingPriority: 'auto',
    signDisplay: 'auto',
    trailingZeroDisplay: 'auto',
    useGrouping: true,
    ...extra,
  }
}

// The text a number's sign is, with the white space and direction marks
// around it left out, as `formatToParts` leaves them out of its sign.
function signOf(text: string) {
  return text.replace(SPACING_ANY, '')
}

// Where a formatted number's digits fall, read by the numerals given.
function spansOf(text: string, digitOf: ReadonlyMap<string, number>): Spans {
  const chars = Array.from(text)
  let digits = ''
  const gaps: string[] = []
  let prefix = ''
  let gap = ''

  for (const char of chars) {
    const digit = digitOf.get(char)
    if (digit === undefined) {
      gap += char
    } else {
      if (digits === '') {
        prefix = gap
      } else {
        gaps.push(gap)
      }
      gap = ''
      digits += String(digit)
    }
  }

  return { digits, gaps, prefix, suffix: digits === '' ? '' : gap }
}

// The symbols of a locale's format, found with `format` alone.
function symbolsOf(
  locale: string,
  resolved: Intl.ResolvedNumberFormatOptions,
  options: NumberFormatOptions,
): Symbols {
  const numberingSystem = optionalString(resolved.numberingSystem)
  const numerals = numeralsOf(resolved.locale, numberingSystem)
  const digitOf = new Map(numerals.map((numeral, digit) => [numeral, digit]))
  const scale = resolved.style === 'percent' ? 100 : 1

  // 12,345.67 and its negative, in the format's style.
  const probe = new Intl.NumberFormat(
    locale,
    probeOptionsOf(resolved, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }),
  )
  const positive = spansOf(probe.format(PROBE / scale), digitOf)
  const negative = spansOf(probe.format(-PROBE / scale), digitOf)
  const read = positive.digits === PROBE_DIGITS ? positive : undefined
  const decimal = read?.gaps[4] === '' ? undefined : read?.gaps[4]
  const group = read?.gaps[1] === '' ? undefined : read?.gaps[1]

  // The sign is what the negative adds on one side of the digits. Added on
  // both, it is an accounting format's brackets, which are text around the
  // number rather than a sign.
  const before = differenceOf(positive.prefix, negative.prefix)
  const after = differenceOf(positive.suffix, negative.suffix)
  const signedBefore = before.added !== '' && after.added === ''
  const signedAfter = after.added !== '' && before.added === ''
  const minusSign =
    signOf(signedBefore ? before.added : signedAfter ? after.added : '') || '-'

  // A plus sign, where the format writes one.
  let plusSign: string | undefined
  if (
    options.signDisplay === 'always' ||
    options.signDisplay === 'exceptZero'
  ) {
    const signed = spansOf(
      new Intl.NumberFormat(
        locale,
        probeOptionsOf(resolved, {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
          signDisplay: 'always',
        }),
      ).format(PROBE / scale),
      digitOf,
    )
    const plusBefore = differenceOf(positive.prefix, signed.prefix).added
    const plusAfter = differenceOf(positive.suffix, signed.suffix).added
    plusSign = signOf(plusBefore === '' ? plusAfter : plusBefore) || '+'
  }

  // The plural forms of the format, whose text can differ from one number to
  // the next: "1 day" and "2 days".
  const plurals = new Intl.NumberFormat(
    locale,
    probeOptionsOf(resolved, {
      maximumFractionDigits: 3,
      minimumFractionDigits: 0,
    }),
  )
  const pluralTexts = PLURAL_NUMBERS.map((value) => plurals.format(value))
  const noNumeralUnits = pluralTexts
    .map((text, at) => ({ text: text.trim(), value: PLURAL_NUMBERS[at] ?? 0 }))
    .filter(({ text }) => !Array.from(text).some((char) => digitOf.has(char)))
    .map(({ text, value }) => ({ unit: text, value }))

  // Everything around the digits that is not a sign, in pieces between white
  // space, as `formatToParts` hands it over in parts. An accounting format's
  // brackets are pieces of their own, apart from the currency beside them.
  const around = [
    positive.prefix,
    positive.suffix,
    before.rest,
    after.rest,
    ...(signedBefore || signedAfter ? [] : [before.added, after.added]),
    ...pluralTexts.flatMap((text) => {
      const spans = spansOf(text, digitOf)
      return spans.digits === '' ? [] : [spans.prefix, spans.suffix]
    }),
  ]
  const pieces = [
    ...new Set(
      around
        .flatMap((text) => text.split(SPACING_RUN))
        .filter((piece) => piece !== '' && piece !== minusSign)
        .map(escapeRegex),
    ),
  ].toSorted((a, b) => b.length - a.length)
  const literals = new RegExp([...pieces, `[${SPACING}]`].join('|'), 'gu')

  const indexes = new Map(numerals.map((numeral, digit) => [numeral, digit]))

  return {
    decimal,
    group,
    index: (numeral) => String(indexes.get(numeral)),
    literals,
    minusSign,
    noNumeralUnits,
    numeral: new RegExp(`[${numerals.join('')}]`, 'gu'),
    numerals,
    plusSign,
  }
}

// A rounding increment needs the fraction digits it rounds to on both
// sides, which the parser it ports fills in where they are left out.
function withRoundingIncrement(
  given: NumberFormatOptions,
): NumberFormatOptions {
  const options = { ...given }
  if (options.roundingIncrement !== 1 && options.roundingIncrement != null) {
    if (
      options.maximumFractionDigits == null &&
      options.minimumFractionDigits == null
    ) {
      options.maximumFractionDigits = 0
      options.minimumFractionDigits = 0
    } else {
      options.maximumFractionDigits ??= options.minimumFractionDigits
      options.minimumFractionDigits ??= options.maximumFractionDigits
    }
  }
  return options
}

export { NumberParser }
