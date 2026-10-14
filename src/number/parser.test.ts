import type { NumberFormatOptions } from '@internationalized/number'

import { NumberParser as Reference } from '@internationalized/number'
import { describe, expect, it, jest } from '@jest/globals'

// What the tests read of a parser, this one's or React Stately's.
type ParserLike = {
  getNumberingSystem(value: string): string | undefined
  isValidPartialNumber(value: string, min?: number, max?: number): boolean
  parse(value: string): number
}

type Reading = readonly [
  parsed: number,
  valid: boolean,
  validAtZeroOrMore: boolean,
  validAtZeroOrLess: boolean,
  numberingSystem: string | undefined,
]

const LOCALES = [
  'ar-AE',
  'ar-EG',
  'bn-BD',
  'de-CH',
  'de-DE',
  'en-IN',
  'en-US',
  'es-ES',
  'fa-IR',
  'fr-FR',
  'hi-IN',
  'ja-JP',
  'my-MM',
  'sv-SE',
]

const FORMATS: readonly NumberFormatOptions[] = [
  {},
  { style: 'percent' },
  { currency: 'USD', style: 'currency' },
  { currency: 'EUR', style: 'currency' },
  { currency: 'JPY', style: 'currency' },
  { currency: 'EUR', currencyDisplay: 'name', style: 'currency' },
  { currency: 'USD', currencySign: 'accounting', style: 'currency' },
  { style: 'unit', unit: 'inch' },
  { style: 'unit', unit: 'day', unitDisplay: 'long' },
  { maximumFractionDigits: 0 },
  { useGrouping: false },
  { signDisplay: 'always' },
]

const VALUES = [12_345.67, -12_345.67, 0, 1, -1, 0.5, 1_000_000, 2, 0.1]

// What a person types on the way to a number, in several scripts and with
// several separators, and some that is no number at all.
const TYPED = [
  '',
  '-',
  '+',
  '1',
  '1,',
  '1.',
  '-1.5',
  '+5',
  'abc',
  '1.2.3',
  '1,234',
  '1.234',
  '1 234',
  "1'234",
  '1’234',
  '12.345,6',
  '12,345.6',
  '−5',
  '(5)',
  '$5',
  '5 €',
  '50%',
  '1 day',
  '2 days',
  '١٢٣',
  '٣٫٥',
  '٣,٥',
  '١٢٬٣٤٥',
  '۵۰',
  '१२३',
  '১২৩',
  '１２３',
]

const SYSTEMS_BY_ZERO = new Set([
  'arab',
  'arabext',
  'beng',
  'deva',
  'fullwide',
  'hanidec',
  'latn',
])

function readingOf(parser: ParserLike, text: string): Reading {
  return [
    parser.parse(text),
    parser.isValidPartialNumber(text),
    parser.isValidPartialNumber(text, 0),
    parser.isValidPartialNumber(text, -Infinity, 0),
    parser.getNumberingSystem(text),
  ]
}

let referenceRead: Map<string, Reading> | undefined

function keyOf(locale: string, format: NumberFormatOptions, text: string) {
  return `${locale} ${JSON.stringify(format)} ${JSON.stringify(text)}`
}

// Every value of the matrix as this parser reads it, on a runtime with no
// `formatToParts`, as Hermes is on iOS, and with no numbering system in the
// resolved options either, as Hermes is there too, when `hermes` says so.
async function readingsWithout(hermes: boolean) {
  let Parser:
    | (new (locale: string, options?: NumberFormatOptions) => ParserLike)
    | undefined
  // A module of its own, so no parser cached by an earlier test is reused.
  await jest.isolateModulesAsync(async () => {
    ;({ NumberParser: Parser } = await import('./parser'))
  })
  if (Parser === undefined) {
    throw new Error('The parser did not load.')
  }

  const prototype = Intl.NumberFormat.prototype
  const formatToParts = Object.getOwnPropertyDescriptor(
    prototype,
    'formatToParts',
  )
  const resolvedOptions = Object.getOwnPropertyDescriptor(
    prototype,
    'resolvedOptions',
  )
  // oxlint-disable-next-line typescript/unbound-method -- called on each formatter below
  const resolve = prototype.resolvedOptions
  const readings = new Map<string, Reading>()

  Reflect.deleteProperty(prototype, 'formatToParts')
  if (hermes) {
    Object.defineProperty(prototype, 'resolvedOptions', {
      configurable: true,
      value(this: Intl.NumberFormat) {
        const { numberingSystem: _named, ...options } = resolve.call(this)
        return options
      },
      writable: true,
    })
  }

  try {
    for (const locale of LOCALES) {
      for (const format of FORMATS) {
        const parser = new Parser(locale, format)
        for (const text of textsOf(locale, format)) {
          readings.set(keyOf(locale, format, text), readingOf(parser, text))
        }
      }
    }
  } finally {
    if (formatToParts !== undefined) {
      Object.defineProperty(prototype, 'formatToParts', formatToParts)
    }
    if (resolvedOptions !== undefined) {
      Object.defineProperty(prototype, 'resolvedOptions', resolvedOptions)
    }
  }

  return readings
}

// Every value of the matrix as React Stately's parser reads it, keyed by
// locale, format and text, read once for every test.
function referenceReadings() {
  if (referenceRead !== undefined) {
    return referenceRead
  }

  const readings = new Map<string, Reading>()

  for (const locale of LOCALES) {
    for (const format of FORMATS) {
      const parser = new Reference(locale, format)
      for (const text of textsOf(locale, format)) {
        readings.set(keyOf(locale, format, text), readingOf(parser, text))
      }
    }
  }

  referenceRead = readings
  return readings
}

// The values formatted in the locale and format, and what a person types.
// An accounting format's brackets are left out in a right-to-left locale:
// there ICU writes a direction mark against the bracket, and React
// Stately's parser takes the two as one piece of text, so it reads a
// typed "(5)" as no number where this one reads the brackets alone.
function textsOf(locale: string, format: NumberFormatOptions) {
  const formatter = new Intl.NumberFormat(locale, format)
  const rightToLeft = /^(?:ar|fa|he)-/u.test(locale)

  return [
    ...new Set([
      ...VALUES.map((value) => formatter.format(value)),
      ...TYPED.filter(
        (text) =>
          !(
            rightToLeft &&
            format.currencySign === 'accounting' &&
            text.startsWith('(')
          ),
      ),
    ]),
  ]
}

describe('NumberParser', () => {
  it('reads every value as React Stately’s parser does, with no formatToParts', async () => {
    const expected = referenceReadings()
    const actual = await readingsWithout(false)

    expect(Object.fromEntries(actual)).toEqual(Object.fromEntries(expected))
  }, 60_000)

  it('reads every value the same with no numbering system resolved, as on Hermes on iOS', async () => {
    const expected = referenceReadings()
    const actual = await readingsWithout(true)

    // A system named by its zero is named; any other is the locale's own,
    // which is left unnamed.
    const named = new Map(
      [...expected].map(([key, reading]) => {
        const [parsed, valid, atLeast, atMost, system] = reading
        const locale = key.slice(0, key.indexOf(' '))
        const own = new Intl.NumberFormat(locale).resolvedOptions()
          .numberingSystem
        const kept =
          system === undefined || SYSTEMS_BY_ZERO.has(system) || system !== own
            ? system
            : undefined
        return [key, [parsed, valid, atLeast, atMost, kept] as const]
      }),
    )

    expect(Object.fromEntries(actual)).toEqual(Object.fromEntries(named))
    // Burmese's own digits, which no zero names, and Arabic's typed into an
    // English field, which falls back to the system they are in.
    expect(
      actual.get(keyOf('my-MM', {}, new Intl.NumberFormat('my-MM').format(1))),
    ).toEqual([1, true, true, true, undefined])
    expect(actual.get(keyOf('en-US', {}, '١٢٣'))).toEqual([
      123,
      true,
      true,
      true,
      'arab',
    ])
  }, 60_000)
})
