import type { ComponentRef, Ref } from 'react'
import type { TextProps as NativeTextProps, TextStyle } from 'react-native'

import { Text as NativeText, StyleSheet } from 'react-native'

import { useLocaleOf } from '../../i18n/provider'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useFontFamily } from '../../typography/fonts'
import { familyStyle, nativeWeight } from '../../typography/roles'

// Deliberately sets no font size or line height, as web's sets none. The same
// amount turns up at several sizes, inside a list row, as a heading-scale
// figure, as a total, differing in nothing else, so the size is the decision
// of the Text around it. What must never vary is here: the mono face, tabular
// figures so a column of them lines up on the decimal point, and the medium
// weight that separates a figure from the prose around it.
//
// No Material Design page draws an amount. It is type alone: the mono face
// and medium weight from the type tokens, tabular figures, and the on surface
// role for the neutral tone. Positive and negative are the library's own
// roles.
const stylesOf = themedStyles(({ colors, typography }) =>
  StyleSheet.create({
    base: {
      fontVariant: ['tabular-nums'],
      fontWeight: nativeWeight(typography.weightMedium),
    },
    negative: {
      color: colors.negative,
    },
    neutral: {
      color: colors.onSurface,
    },
    positive: {
      color: colors.positive,
    },
  }),
)

// U+2212 MINUS SIGN, not the U+002D hyphen Intl actually emits. The hyphen is
// a typographic stand-in: it is narrower than the plus it pairs with and does
// not sit on the same optical centre as the digits, which shows up as a
// wobbling column the moment amounts are stacked.
const MINUS_SIGN = '\u2212'

const PLUS_SIGN = '+'

// The minus a locale writes, which is the hyphen in most and U+2212 already in
// a few, such as Swedish and Persian.
const LOCALE_MINUS = /[-\u2212]/u

type CurrencyProps = Omit<NativeTextProps, 'children'> & {
  /**
   * ISO 4217 code for the currency to format in.
   * @default 'USD'
   */
  readonly currency?: string
  /**
   * BCP 47 locale to format for. Defaults to the `I18nProvider`'s, or the
   * device's outside one.
   */
  readonly locale?: string
  readonly ref?: Ref<ComponentRef<typeof NativeText>>
  /**
   * When to show the sign. `auto` shows one only on negatives, `always` also
   * prefixes positives with a plus, and `never` shows neither, which leaves
   * colour as the only thing separating a credit from a debt, so reach for it
   * only where the direction is already stated some other way.
   *
   * An amount that shows as zero carries no sign under any of them, since
   * there is nothing owed or owing: `-0.004` reads `$0.00`, not `−$0.00`.
   * @default 'auto'
   */
  readonly sign?: CurrencySignDisplay
  /**
   * Which colour role to render in. `auto` follows the sign of the amount as
   * it is shown, so one that rounds to zero, float residue or a fraction of a
   * cent, reads as neutral rather than as a gain or a debt.
   *
   * The positive and negative roles are guaranteed legible on the surface
   * family, which is what the library's own tokens and every demo scheme are
   * held to. Over a container of its own, such as a filled card, the pair is
   * one colour family on top of another and is not guaranteed, so a custom
   * theme placing one there has to check that pair itself.
   * @default 'auto'
   */
  readonly tone?: CurrencyTone
  /** The amount, in the currency's major units. */
  readonly value: number
}

type CurrencySignDisplay = 'always' | 'auto' | 'never'

type CurrencyTone = 'auto' | 'negative' | 'neutral' | 'positive'

/**
 * A formatter, how it writes zero, and the currency code written beside its
 * number when it is the decimal fallback for a code the runtime rejected.
 */
type ResolvedFormat = {
  readonly code: null | string
  readonly formatter: Intl.NumberFormat
  readonly zero: string
}

/**
 * An amount of money, formatted for the reader's locale in the mono face with
 * tabular figures, so a column of amounts lines up on the decimal point.
 * Negatives carry a true minus sign, and the tone follows the sign unless
 * `tone` names one.
 *
 * ```tsx
 * <Text variant="bodyLarge">
 *   <Currency currency="EUR" value={-42.5} />
 * </Text>
 * ```
 *
 * It sets no size of its own, so it takes the type of the Text around it:
 * put it in one, a heading-scale one for a larger figure. On its own it draws
 * at the platform's default size. The face is the mono family's first, once
 * the app has registered it with expo-font, and the system font until then,
 * with tabular figures either way.
 *
 * Web's `render` has no counterpart. `style`, `ref` and `testID` land on React
 * Native's own Text.
 */
function Currency({
  currency = 'USD',
  locale,
  sign = 'auto',
  style,
  tone = 'auto',
  value,
  ...props
}: CurrencyProps) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const family = familyStyle(useFontFamily(theme.typography.fontFamilyMono))

  const writtenIn = useLocaleOf(locale)
  const amount = formatCurrency(value, { currency, locale: writtenIn, sign })

  return (
    <NativeText
      {...props}
      style={composeStyles<TextStyle>(
        own.base,
        family,
        own[resolveTone(value, tone, amount.shownAsZero)],
        style,
      )}
    >
      {amount.text}
    </NativeText>
  )
}

// Constructing an Intl.NumberFormat resolves the locale, loads the currency's
// data and builds the pattern; formatting with one already built skips all
// three. An instance is stateless once constructed, so one can be shared
// across every component asking for the same locale and currency. The sign
// is no part of the key, since every setting is drawn from the one formatter.
//
// What this saves is a mount and a changing amount, not an idle re-render:
// the React Compiler already memoises the call below on the things it reads,
// so a component re-rendered with the same props never reaches here. That
// cache belongs to one component instance and counts `value` among its keys,
// which leaves two cases it cannot cover: a column of rows, where every
// instance has a cache of its own and each builds a formatter, and a single
// amount that ticks, where each new value misses.
//
// Unbounded on purpose. The keys are the pairs an app actually uses, its
// locales times its currencies, so the map settles at that size rather than
// growing with renders or with values.
//
// A request the runtime rejects is cached too, under its own key, as the
// fallback it resolved to, so a bad pair costs one failed construction rather
// than one a render.
const formatters = new Map<string, ResolvedFormat>()

// The amount is read off `format` alone, where web reads it off
// `formatToParts` with the `signDisplay` settings that leave a zero bare.
// Hermes has neither: it defines no `formatToParts` on iOS, ignores
// `signDisplay` there, and takes only `auto`, `never`, `always` and
// `exceptZero` on Android, so the `negative` web asks for throws. `format` is
// what every runtime React Native runs on has.
//
// So the magnitude is formatted on its own, and it shows as zero exactly when
// it reads as zero formatted by the same formatter, whatever digits the
// locale writes. A sign, where one is shown, goes where the locale puts its
// own minus. On a runtime with `formatToParts` the text this writes is the
// text web writes, which the tests compare across locales.
function formatCurrency(
  value: number,
  options: {
    currency: string
    locale: string | undefined
    sign: CurrencySignDisplay
  },
) {
  const { code, formatter, zero } = formatterFor(
    options.locale,
    options.currency,
  )
  const magnitude = formatter.format(Math.abs(value))
  // Whether every digit shown is a zero, which is what the tone reads rather
  // than the raw value: the two never saw the same number before.
  const shownAsZero = magnitude === zero
  const mark = signFor(value, options.sign, shownAsZero)
  const amount = mark === undefined ? magnitude : signed(formatter, value, mark)

  return {
    shownAsZero,
    text: code === null || code === '' ? amount : `${amount} ${code}`,
  }
}

// A component that only shows an amount must not take the screen down with
// it, and `new Intl.NumberFormat` throws for a malformed locale (`xx_YY`) and
// for a currency code that is not one (`xx`, `US`). Valid input takes exactly
// the path it always did; the rest falls back. A locale the runtime rejects,
// an empty one among them, which is what clearing a locale control leaves,
// gives way to the device's, and a currency code it rejects to the plain
// number in that locale with the code written after it, so the amount still
// reads and what was wrong with it stays visible.
//
// Nothing is logged: the library writes to the console nowhere, and a
// warning an app cannot turn off is not its to emit.
function formatterFor(locale: string | undefined, currency: string) {
  // Neither a BCP 47 locale nor an ISO 4217 code can contain a vertical bar,
  // so joining on one cannot make two different pairs share a key.
  const key = `${locale ?? ''}|${currency}`
  const cached = formatters.get(key)
  if (cached !== undefined) {
    return cached
  }

  const usable = locale !== undefined && isLocale(locale) ? locale : undefined
  let formatter: Intl.NumberFormat
  let code: null | string = null
  try {
    formatter = new Intl.NumberFormat(usable, { currency, style: 'currency' })
  } catch {
    formatter = new Intl.NumberFormat(usable, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })
    code = currency
  }

  const resolved = { code, formatter, zero: formatter.format(0) }
  formatters.set(key, resolved)
  return resolved
}

// Whether the runtime takes `tag` as a locale at all — one it parses, whether
// or not it has data for it, which it then fills in from the nearest it has.
function isLocale(tag: string) {
  try {
    return Intl.NumberFormat.supportedLocalesOf(tag).length >= 0
  } catch {
    return false
  }
}

// An amount shown as zero is neither owed nor owing, so it takes the neutral
// role whatever the raw value's sign: negative zero, a rounded-away debt and
// float residue all read as settled. Otherwise the sign decides.
function resolveTone(value: number, tone: CurrencyTone, shownAsZero: boolean) {
  if (tone !== 'auto') {
    return tone
  }
  if (shownAsZero) {
    return 'neutral'
  }
  if (value > 0) {
    return 'positive'
  }
  if (value < 0) {
    return 'negative'
  }
  return 'neutral'
}

// The amount with `mark` in place of the minus the locale writes on a
// negative, so the mark sits where the locale puts its own sign: before the
// symbol or after it, beside a direction mark in a right-to-left locale, or in
// place of a space, as Swiss German's `CHF-12.50` does beside `CHF 12.50`. A
// plus takes the same place, which is where Intl's own `exceptZero` puts it.
// Only the sign is replaced: nothing a locale writes ahead of it, a symbol, a
// code, a space or a direction mark, is a minus, so the first is the sign.
function signed(formatter: Intl.NumberFormat, value: number, mark: string) {
  return formatter.format(-Math.abs(value)).replace(LOCALE_MINUS, mark)
}

// The sign an amount carries, if any. One shown as zero carries none under
// any setting, since there is nothing owed or owing; otherwise a negative
// takes a minus unless told to show none, and a positive a plus only when
// told to always show one.
function signFor(
  value: number,
  sign: CurrencySignDisplay,
  shownAsZero: boolean,
) {
  if (shownAsZero || sign === 'never') {
    return undefined
  }
  if (value < 0) {
    return MINUS_SIGN
  }
  if (value > 0 && sign === 'always') {
    return PLUS_SIGN
  }
  return undefined
}

export type { CurrencyProps, CurrencySignDisplay, CurrencyTone }

export { Currency }
