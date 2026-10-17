import type { ReactNode } from 'react'

import { createContext, use } from 'react'
import { I18nManager } from 'react-native'

import type { LibraryMessages } from '.'

import { messagesFor } from '.'
import { localeOf } from '../number/locale'

// The locale an app sets for everything inside it, as React Aria's
// `I18nProvider` does for kanso-ui on web. Undefined, outside any provider or
// inside one given no locale, is the device's.
const LocaleContext = createContext<string | undefined>(undefined)

type I18nProviderProps = {
  readonly children?: ReactNode
  /**
   * The BCP 47 locale the components inside write their words and numbers
   * in. Left unset, the device's, as React Aria's provider falls back to the
   * browser's, so a provider inside another given none does not inherit its
   * locale.
   */
  readonly locale?: string
}

/** The locale a `useLocale()` reads, and the direction the app lays out in. */
type Locale = {
  /**
   * The writing direction the app lays out in, `I18nManager`'s, which is
   * what React Native mirrors a layout by.
   */
  readonly direction: 'ltr' | 'rtl'
  /** The BCP 47 locale the components write in. */
  readonly locale: string
}

/**
 * Sets the locale every component inside writes in, as React Aria's
 * `I18nProvider` does for kanso-ui on web: the library's own words, such as a
 * pending ring's name or a list's empty row, and its numbers and dates, such
 * as a Currency's amount or a Calendar's month.
 *
 * ```tsx
 * <I18nProvider locale="pt-BR">
 *   <App />
 * </I18nProvider>
 * ```
 *
 * A component given a `locale` of its own writes in that one instead. A
 * locale the runtime cannot parse, here or on a component, gives way to the
 * device's. The provider sets no writing direction: React Native lays out by
 * `I18nManager`, which an app turns over with `forceRTL` and a reload.
 */
function I18nProvider({ children, locale }: I18nProviderProps) {
  return <LocaleContext value={locale}>{children}</LocaleContext>
}

/**
 * The locale the components around the call write in, and the direction the
 * app lays out in, as React Aria's `useLocale()` returns them on web.
 *
 * ```tsx
 * const { locale } = useLocale()
 * const date = new Intl.DateTimeFormat(locale).format(value)
 * ```
 */
function useLocale(): Locale {
  return {
    direction: I18nManager.isRTL ? 'rtl' : 'ltr',
    locale: useLocaleOf(undefined),
  }
}

/**
 * The locale a component writes in: its own `locale` prop where it has one,
 * then the provider's, then the device's. A malformed one gives way to the
 * device's rather than to the next in line.
 */
function useLocaleOf(own: string | undefined): string {
  const provided = use(LocaleContext)
  return localeOf(own ?? provided)
}

/** The library's words in the locale `useLocaleOf` resolves. */
function useMessages(own?: string): LibraryMessages {
  return messagesFor(useLocaleOf(own))
}

/**
 * The nearest provider's locale as given, undefined outside one, for an
 * overlay to hand on to what it draws in the host at the app's root, where
 * a provider inside the app would not otherwise reach.
 */
function useProvidedLocale(): string | undefined {
  return use(LocaleContext)
}

export { I18nProvider, useLocale, useLocaleOf, useMessages, useProvidedLocale }
export type { I18nProviderProps, Locale }
