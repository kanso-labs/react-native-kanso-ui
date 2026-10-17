// The locale a component writes its numbers in, and src/i18n its words: the
// one given, where the runtime takes it as a locale at all, or the device's.
// Which one is given is `useLocaleOf`'s in src/i18n/provider.tsx, the
// component's own prop or the `I18nProvider`'s, as web reads the page's from
// React Aria's provider.

let deviceLocale: string | undefined

function localeOf(locale: string | undefined) {
  if (locale !== undefined) {
    try {
      Intl.NumberFormat.supportedLocalesOf(locale)
      return locale
    } catch {
      // A malformed tag, which falls back to the device's.
    }
  }

  deviceLocale ??= new Intl.NumberFormat().resolvedOptions().locale
  return deviceLocale
}

export { localeOf }
