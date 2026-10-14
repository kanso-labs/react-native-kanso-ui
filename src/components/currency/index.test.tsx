import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle } from 'react-native'

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react-native'
import { createRef } from 'react'
import { StyleSheet, View } from 'react-native'

import type { CurrencyProps, CurrencySignDisplay } from '.'
import type { KuiTheme } from '../../tokens/defaults'

import { Currency } from '.'
import { ThemeScope } from '../../theme-scope'
import { scopeFor } from '../../theme/scope'
import { Text } from '../text'

// The families the app has registered with expo-font, which a case fills in.
const mockLoaded = new Set<string>()

jest.mock(
  'expo-font',
  () => ({ isLoaded: (family: string) => mockLoaded.has(family) }),
  { virtual: true },
)

const { theme } = scopeFor('light', {})
const { colors } = theme

// The characters a formatted amount holds that a literal in this file could
// not be told apart from another: the minus from the hyphen, the no-break
// space from a space, and the direction marks from nothing at all.
const MINUS = String.fromCodePoint(0x22_12)
const HYPHEN_MINUS = '-'
const NBSP = String.fromCodePoint(0xa0)
const ALM = String.fromCodePoint(0x6_1c)
const RLM = String.fromCodePoint(0x20_0f)

const CALL_SITE = { marginTop: 4 }

const MONO: KuiTheme = {
  '--kui-typography-font-family-mono': "'JetBrains Mono', monospace",
}

const SEMIBOLD: KuiTheme = { '--kui-typography-weight-medium': '600' }

// The runtime's own formatter, which the expected strings are read off and
// the stand-in below builds on.
const { NumberFormat } = Intl

let constructions = 0

// Intl.NumberFormat as Hermes has it on both of its platforms at once: no
// `formatToParts`, which it defines on Android and not on iOS, and no
// `signDisplay`, which iOS ignores and Android takes only `auto`, `never`,
// `always` and `exceptZero` of. Asking for either fails here, where on a
// device the first throws and the second can quietly print the wrong sign.
// Every case in this file runs against it, so a Currency reaching for more
// than `format` fails them all, while the expected strings are read off the
// runtime's own formatter, as web reads them.
const HermesNumberFormat = Object.assign(
  function HermesNumberFormat(
    locales?: string,
    options: Intl.NumberFormatOptions = {},
  ) {
    constructions++
    if (options.signDisplay !== undefined) {
      throw new RangeError('signDisplay is not supported')
    }
    const formatter = new NumberFormat(locales, options)
    return { format: (value: number) => formatter.format(value) }
  },
  {
    supportedLocalesOf: (locales: string) =>
      NumberFormat.supportedLocalesOf(locales),
  },
)

beforeAll(() => {
  Object.assign(Intl, { NumberFormat: HermesNumberFormat })
})

afterAll(() => {
  Object.assign(Intl, { NumberFormat })
})

afterEach(() => {
  mockLoaded.clear()
})

type Case = {
  readonly currency: string
  readonly sign: CurrencySignDisplay
  readonly value: number
}

// Locales whose amounts are written differently from one another: the sign
// after a symbol or a space, in place of a space, beside a direction mark, as
// U+2212 already, and in digits other than Latin ones.
const LOCALES = [
  'ar',
  'ar-EG',
  'bn',
  'de-CH',
  'de-DE',
  'en-IN',
  'en-US',
  'fa',
  'fr-FR',
  'he',
  'hi-IN',
  'ja-JP',
  'ko-KR',
  'nl-NL',
  'ps',
  'pt-BR',
  'sv-SE',
  'th-TH',
  'ur',
  'zh-CN',
] as const

const SIGNS: readonly CurrencySignDisplay[] = ['always', 'auto', 'never']

// Each sign of each currency at a few sizes, with the amounts either side of
// where a cent stops showing.
const CASES: readonly Case[] = ['EUR', 'JPY', 'USD'].flatMap((currency) =>
  SIGNS.flatMap((sign) =>
    [-1284.32, -12.5, -0.005, -0.004, -0, 0.004, 0.005, 42.5].map((value) => ({
      currency,
      sign,
      value,
    })),
  ),
)

// The amounts that print as zero, which carry no sign and read as settled.
const SHOWN_AS_ZERO = [
  { name: 'negative zero', value: -0 },
  { name: 'a debt under half a cent', value: -0.004 },
  { name: 'a credit under half a cent', value: 0.004 },
  { name: 'a vanishingly small debt', value: -1e-7 },
  { name: 'float residue', value: 0.1 + 0.2 - 0.3 },
] as const

const WEB_SIGN_DISPLAY = {
  always: 'exceptZero',
  auto: 'negative',
  never: 'never',
} as const

function currencyText() {
  return textOf(screen.getByTestId('currency'))
}

async function setup(props: Partial<CurrencyProps> = {}) {
  await render(
    <Currency locale="en-US" testID="currency" value={0} {...props} />,
  )
  return screen.getByTestId('currency')
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle> }
}): TextStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

// A Currency's text is one string, its only child.
function textOf(element: ReturnType<typeof screen.getByTestId>) {
  return element.children
    .map((child) => (typeof child === 'string' ? child : ''))
    .join('')
}

// What web's Currency writes, read off `formatToParts` as web reads it, with
// the `signDisplay` settings web asks for.
function webText(locale: string, { currency, sign, value }: Case) {
  return new NumberFormat(locale, {
    currency,
    signDisplay: WEB_SIGN_DISPLAY[sign],
    style: 'currency',
  })
    .formatToParts(value)
    .map((part) => (part.type === 'minusSign' ? MINUS : part.value))
    .join('')
}

describe('Currency', () => {
  describe('formatting', () => {
    it('formats as currency in the given locale', async () => {
      await setup({ value: 1284.32 })

      expect(currencyText()).toBe('$1,284.32')
    })

    it.each([
      {
        currency: 'EUR',
        expected: `1.284,32${NBSP}€`,
        locale: 'de-DE',
        value: 1284.32,
      },
      {
        currency: 'EUR',
        expected: `${MINUS}12,50${NBSP}€`,
        locale: 'de-DE',
        value: -12.5,
      },
      // No minor units, so no fraction.
      { currency: 'JPY', expected: '￥1,284', locale: 'ja-JP', value: 1284 },
      {
        currency: 'JPY',
        expected: `${MINUS}￥1,284`,
        locale: 'ja-JP',
        value: -1284,
      },
      // Arabic-Indic digits, and the direction marks either side of them kept.
      {
        currency: 'EGP',
        expected: `${RLM}١٬٢٨٤٫٣٢${NBSP}ج.م.${RLM}`,
        locale: 'ar-EG',
        value: 1284.32,
      },
      {
        currency: 'EGP',
        expected: `${ALM}${MINUS}${RLM}١٢٫٥٠${NBSP}ج.م.${RLM}`,
        locale: 'ar-EG',
        value: -12.5,
      },
    ])(
      'formats $value $currency in $locale',
      async ({ currency, expected, locale, value }) => {
        await setup({ currency, locale, value })

        expect(currencyText()).toBe(expected)
      },
    )

    it('formats in the device’s locale when given none', async () => {
      await setup({ locale: undefined, value: 1234.5 })

      expect(currencyText()).toBe(
        new NumberFormat(undefined, {
          currency: 'USD',
          style: 'currency',
        }).format(1234.5),
      )
    })

    // Web reads its text off formatToParts; this one off `format` alone, so
    // the two are compared wherever the runtime can do both, in every sign
    // and currency.
    it.each(LOCALES)('writes what web writes in %s', async (locale) => {
      await render(
        <View>
          {CASES.map((amount) => (
            <Currency
              key={`${amount.currency} ${amount.sign} ${String(amount.value)}`}
              locale={locale}
              testID={`${amount.currency} ${amount.sign} ${String(amount.value)}`}
              {...amount}
            />
          ))}
        </View>,
      )

      expect(
        CASES.map((amount) =>
          textOf(
            screen.getByTestId(
              `${amount.currency} ${amount.sign} ${String(amount.value)}`,
            ),
          ),
        ),
      ).toEqual(CASES.map((amount) => webText(locale, amount)))
    })
  })

  // An amount on its own must not take the screen down with it, and the
  // formatter throws for a malformed locale or a code that is not one.
  describe('input the runtime rejects', () => {
    it.each(['', 'xx_YY'])(
      'reads the locale %j as the device’s',
      async (locale) => {
        await setup({ locale: undefined, value: 1234.5 })
        const device = currencyText()

        await setup({ locale, value: 1234.5 })

        expect(currencyText()).toBe(device)
      },
    )

    // The number still reads, and the code beside it says what was wrong.
    it.each([
      { currency: '', expected: '1,234.50', name: 'an empty code' },
      {
        currency: 'US',
        expected: '1,234.50 US',
        name: 'a code that is not one',
      },
    ])('shows the number for $name', async ({ currency, expected }) => {
      await setup({ currency, value: 1234.5 })

      expect(currencyText()).toBe(expected)
    })

    it('signs the number it falls back to', async () => {
      await setup({ currency: 'US', value: -1234.5 })

      expect(currencyText()).toBe(`${MINUS}1,234.50 US`)
    })
  })

  describe('the minus sign', () => {
    // Intl writes U+002D HYPHEN-MINUS. The two are visually near-identical,
    // so this asserts the code point rather than comparing against a literal
    // that would look correct either way in the source.
    it('renders a true minus sign rather than a hyphen', async () => {
      await setup({ value: -12.5 })

      expect(currencyText().codePointAt(0)).toBe(0x22_12)
      expect(currencyText()).not.toContain(HYPHEN_MINUS)
    })

    it('leaves the rest of the formatted value alone', async () => {
      await setup({ value: -12.5 })

      expect(currencyText()).toBe(`${MINUS}$12.50`)
    })
  })

  describe('sign', () => {
    it.each([
      { expected: '$42.50', sign: 'auto', value: 42.5 },
      { expected: `${MINUS}$12.50`, sign: 'auto', value: -12.5 },
      { expected: '+$42.50', sign: 'always', value: 42.5 },
      { expected: `${MINUS}$12.50`, sign: 'always', value: -12.5 },
      { expected: '$42.50', sign: 'never', value: 42.5 },
      { expected: '$12.50', sign: 'never', value: -12.5 },
    ] as const)(
      'writes $value as $expected under $sign',
      async ({ expected, sign, value }) => {
        await setup({ sign, value })

        expect(currencyText()).toBe(expected)
      },
    )

    it('signs by default only what is owed', async () => {
      await setup({ value: 42.5 })
      expect(currencyText()).toBe('$42.50')

      await setup({ value: -12.5 })
      expect(currencyText()).toBe(`${MINUS}$12.50`)
    })

    // Swiss German writes a negative with its minus in place of the space
    // after the code, so the plus takes that place too.
    it.each([
      { expected: `CHF${NBSP}12.50`, sign: 'auto', value: 12.5 },
      { expected: `CHF${MINUS}12.50`, sign: 'auto', value: -12.5 },
      { expected: 'CHF+12.50', sign: 'always', value: 12.5 },
    ] as const)(
      'puts the sign where Swiss German does under $sign for $value',
      async ({ expected, sign, value }) => {
        await setup({ currency: 'CHF', locale: 'de-CH', sign, value })

        expect(currencyText()).toBe(expected)
      },
    )

    it('keeps the direction marks around a plus', async () => {
      await setup({
        currency: 'EGP',
        locale: 'ar-EG',
        sign: 'always',
        value: 12.5,
      })

      expect(currencyText()).toBe(`${ALM}+${RLM}١٢٫٥٠${NBSP}ج.م.${RLM}`)
    })
  })

  describe('tone', () => {
    // Guards the comparisons below: three roles that resolved to one colour
    // would make every assertion here pass without proving anything.
    it('reads three different roles', () => {
      expect(
        new Set([colors.negative, colors.onSurface, colors.positive]).size,
      ).toBe(3)
    })

    it.each([
      { expected: colors.positive, name: 'positive', value: 42.5 },
      { expected: colors.negative, name: 'negative', value: -12.5 },
      { expected: colors.onSurface, name: 'neutral', value: 0 },
    ])('reads $value in the $name role', async ({ expected, value }) => {
      const currency = await setup({ value })

      expect(styleOf(currency).color).toBe(expected)
    })

    it.each([
      { expected: colors.positive, tone: 'positive' },
      { expected: colors.negative, tone: 'negative' },
      { expected: colors.onSurface, tone: 'neutral' },
    ] as const)(
      'draws a debt in the $tone role when told to',
      async ({ expected, tone }) => {
        const currency = await setup({ tone, value: -12.5 })

        expect(styleOf(currency).color).toBe(expected)
      },
    )

    it('follows a dark scope', async () => {
      const dark = scopeFor('dark', {}).theme.colors
      await render(
        <ThemeScope scheme="dark">
          <Currency locale="en-US" testID="currency" value={-12.5} />
        </ThemeScope>,
      )

      expect(dark.negative).not.toBe(colors.negative)
      expect(styleOf(screen.getByTestId('currency')).color).toBe(dark.negative)
    })
  })

  // The text and the tone both come from the amount as printed, so a value
  // too small to reach a printed digit reads as settled in both: no sign, and
  // the neutral role. Float residue is the everyday source of one.
  describe('an amount shown as zero', () => {
    it.each(SHOWN_AS_ZERO)('prints $name without a sign', async ({ value }) => {
      await setup({ value })

      expect(currencyText()).toBe('$0.00')
    })

    it.each(SHOWN_AS_ZERO)(
      'renders $name in the neutral role',
      async ({ value }) => {
        const currency = await setup({ value })

        expect(styleOf(currency).color).toBe(colors.onSurface)
      },
    )

    // `always` signs every amount it prints except a zero, which is neither
    // a credit nor a debt.
    it.each([
      { expected: '$0.00', value: -0.004 },
      { expected: '$0.00', value: 0.004 },
      { expected: `${MINUS}$12.50`, value: -12.5 },
    ])(
      'signs $value as $expected when told to always show the sign',
      async ({ expected, value }) => {
        const currency = await setup({ sign: 'always', value })

        expect(currencyText()).toBe(expected)
        expect(styleOf(currency).color).toBe(
          value === -12.5 ? colors.negative : colors.onSurface,
        )
      },
    )

    // Half a cent rounds up to a cent, which is an amount: the boundary sits
    // where the printed digits stop being zeros, not at the raw value.
    it.each([
      { color: colors.positive, expected: '$0.01', value: 0.005 },
      { color: colors.negative, expected: `${MINUS}$0.01`, value: -0.005 },
    ])(
      'keeps the sign of $value, printed as $expected',
      async ({ color, expected, value }) => {
        const currency = await setup({ value })

        expect(currencyText()).toBe(expected)
        expect(styleOf(currency).color).toBe(color)
      },
    )

    // Where zero falls follows the currency's own minor units: a yen has
    // none, so 0.4 prints as zero and 0.6 as one.
    it.each([
      { color: colors.onSurface, expected: '￥0', value: 0.4 },
      { color: colors.positive, expected: '￥1', value: 0.6 },
    ])(
      'reads $value yen, printed as $expected',
      async ({ color, expected, value }) => {
        const currency = await setup({
          currency: 'JPY',
          locale: 'ja-JP',
          value,
        })

        expect(currencyText()).toBe(expected)
        expect(styleOf(currency).color).toBe(color)
      },
    )

    // Zero is read off the printed amount whatever digits it is printed in,
    // so a debt rounded away in Arabic-Indic digits is as settled as one in
    // Latin digits.
    it('reads an amount shown as zero in Arabic-Indic digits as settled', async () => {
      const currency = await setup({
        currency: 'EGP',
        locale: 'ar-EG',
        value: -0.004,
      })

      expect(currencyText()).toBe(`${RLM}٠٫٠٠${NBSP}ج.م.${RLM}`)
      expect(styleOf(currency).color).toBe(colors.onSurface)
    })
  })

  // The formatters are cached on the locale and the currency, so these cover
  // both halves of that: that the cache is reached at all, and that its key
  // does not collapse two pairs into one. Every case formats a pair no other
  // case in this file uses, since the cache is the module's and outlives each
  // case.
  describe('the formatter cache', () => {
    it('builds one formatter for a repeated locale and currency', async () => {
      const before = constructions

      await render(
        <View>
          <Currency currency="CAD" locale="en-CA" testID="1" value={1} />
          <Currency currency="CAD" locale="en-CA" testID="2" value={-2} />
          <Currency currency="CAD" locale="en-CA" testID="3" value={3} />
        </View>,
      )

      expect(constructions - before).toBe(1)
      expect(textOf(screen.getByTestId('2'))).toBe(`${MINUS}$2.00`)
    })

    // The locale and the currency are each their own part of the key, and
    // the sign is none of it, since every setting is drawn from the one
    // formatter.
    it('builds one per locale and currency, whatever the sign', async () => {
      const before = constructions

      await render(
        <View>
          <Currency currency="AUD" locale="en-AU" sign="auto" value={1} />
          <Currency currency="AUD" locale="de-AT" sign="auto" value={1} />
          <Currency currency="NZD" locale="en-AU" sign="auto" value={1} />
          <Currency currency="AUD" locale="en-AU" sign="always" value={1} />
          <Currency currency="AUD" locale="en-AU" sign="never" value={1} />
        </View>,
      )

      expect(constructions - before).toBe(3)
    })

    it('builds the fallback for a rejected code once', async () => {
      const before = constructions

      await render(
        <View>
          <Currency currency="Q1" locale="en-GB" value={1} />
          <Currency currency="Q1" locale="en-GB" value={2} />
        </View>,
      )

      // The construction that threw, and the decimal one after it.
      expect(constructions - before).toBe(2)
    })

    it.each([
      {
        after: { currency: 'GBP', locale: 'de-DE', sign: 'auto' },
        before: { currency: 'GBP', locale: 'en-GB', sign: 'auto' },
        name: 'the locale',
      },
      {
        after: { currency: 'SEK', locale: 'en-US', sign: 'auto' },
        before: { currency: 'CHF', locale: 'en-US', sign: 'auto' },
        name: 'the currency',
      },
      {
        after: { currency: 'NOK', locale: 'en-US', sign: 'always' },
        before: { currency: 'NOK', locale: 'en-US', sign: 'auto' },
        name: 'the sign',
      },
    ] as const)(
      'keeps formatting correctly when $name changes in place',
      async ({ after, before }) => {
        const { rerender } = await render(
          <Currency testID="currency" value={1284.32} {...before} />,
        )
        expect(currencyText()).toBe(
          webText(before.locale, { ...before, value: 1284.32 }),
        )

        await rerender(
          <Currency testID="currency" value={1284.32} {...after} />,
        )

        expect(currencyText()).toBe(
          webText(after.locale, { ...after, value: 1284.32 }),
        )
      },
    )
  })

  describe('typography', () => {
    it('draws tabular figures at the medium weight', async () => {
      const currency = await setup({ value: 42.5 })

      expect(styleOf(currency)).toMatchObject({
        fontVariant: ['tabular-nums'],
        fontWeight: theme.typography.weightMedium,
      })
    })

    it('reads its weight from the theme', async () => {
      await render(
        <ThemeScope theme={SEMIBOLD}>
          <Currency locale="en-US" testID="currency" value={42.5} />
        </ThemeScope>,
      )

      expect(styleOf(screen.getByTestId('currency')).fontWeight).toBe(600)
    })

    // Size is the decision of the Text around it, so the component must not
    // set one, or the same element could not serve a ledger row and a hero.
    it('takes its size from the Text around it', async () => {
      await render(
        <Text testID="text" variant="displaySmall">
          <Currency locale="en-US" testID="currency" value={42.5} />
        </Text>,
      )
      const own = styleOf(screen.getByTestId('currency'))

      expect(own.fontSize).toBeUndefined()
      expect(own.lineHeight).toBeUndefined()
      expect(own.letterSpacing).toBeUndefined()
      expect(styleOf(screen.getByTestId('text')).fontSize).toBe(
        theme.typography.displaySmallSize,
      )
    })

    it('draws in the mono family once the app has registered it', async () => {
      mockLoaded.add('Roboto Mono')
      const currency = await setup({ value: 42.5 })

      // expo-font is imported once the first text renders, and answers a
      // moment later.
      await waitFor(() => {
        expect(styleOf(currency).fontFamily).toBe('Roboto Mono')
      })
    })

    it('reaches the family a theme overrides the mono token with', async () => {
      mockLoaded.add('JetBrains Mono')
      await render(
        <ThemeScope theme={MONO}>
          <Currency locale="en-US" testID="currency" value={42.5} />
        </ThemeScope>,
      )

      await waitFor(() => {
        expect(styleOf(screen.getByTestId('currency')).fontFamily).toBe(
          'JetBrains Mono',
        )
      })
    })

    it('draws in the system font while the family is not registered', async () => {
      const currency = await setup({ value: 42.5 })

      await waitFor(() => {
        expect(styleOf(currency).fontFamily).toBe('System')
      })
    })
  })

  it('puts the style, ref and testID on its text, after its own', async () => {
    const ref = createRef<ComponentRef<typeof Text>>()
    const currency = await setup({
      ref,
      style: [CALL_SITE, { color: 'red' }],
      value: -12.5,
    })

    expect(styleOf(currency)).toMatchObject({ ...CALL_SITE, color: 'red' })
    expect(typeof ref.current?.measure).toBe('function')
  })

  it('hands the rest of its props to the text', async () => {
    const currency = await setup({ numberOfLines: 1, value: 42.5 })

    expect(currency.props.numberOfLines).toBe(1)
  })
})
