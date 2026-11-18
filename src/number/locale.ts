// The locale a component writes its numbers in, and src/i18n its words: the
// one given, where the runtime takes it as a locale at all, or the device's.
// Which one is given is `useLocaleOf`'s in src/i18n/provider.tsx, the
// component's own prop or the `I18nProvider`'s, as web reads the page's from
// React Aria's provider.

let deviceLocale: string | undefined

// What each tag given resolved to, so a tag is checked once rather than on
// every call: a calendar's grid asks for its locale once a date.
const resolved = new Map<string, string>()

function localeOf(locale: string | undefined) {
  if (locale !== undefined) {
    const known = resolved.get(locale)

    if (known !== undefined) {
      return known
    }

    try {
      Intl.NumberFormat.supportedLocalesOf(locale)
      resolved.set(locale, locale)
      return locale
    } catch {
      // A malformed tag, which falls back to the device's.
    }
  }

  deviceLocale ??= new Intl.NumberFormat().resolvedOptions().locale

  if (locale !== undefined) {
    resolved.set(locale, deviceLocale)
  }
  return deviceLocale
}

export { localeOf }
