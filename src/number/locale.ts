// The locale a component writes its numbers in: the one given, where the
// runtime takes it as a locale at all, or the device's. Web reads the page's
// from React Aria's `I18nProvider`; React Native has no such context, so a
// component that formats a number takes the locale as a prop and falls back
// to this.

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
