import { DateFormatter } from '@internationalized/date'

// **A twenty-four hour clock reaches React Stately as `h23` wherever the
// runtime would resolve it to `h24`.** React Stately's field state reads its
// hour cycle off the formatter `hour12: false` builds, and keeps an hour on
// an `h24` cycle as one more than the hour of the day, every hour of it. The
// formatter `@internationalized/date` builds asks Chrome and Node for `h23`,
// where they would answer `h24`, since they write midnight as 24. Hermes on
// Android answers `h24` for a locale whose own clock has twelve hours, such
// as en-US, and writes midnight as 0, so that workaround is not taken, and
// the field wrote 22:30 for 21:30. There the state is handed the locale
// asking for `h23` itself, through its `hc` extension, and no `hourCycle`,
// since `hour12` would overrule the extension. Anywhere else it is handed
// what it was given.

// The extension's key and value in a locale, `-hc-h23` in `en-US-u-hc-h23`.
const HOUR_CYCLE_KEY = /-hc-h(?:11|12|23|24)/u

/**
 * The locale and hour cycle a date or time field's React Stately state is
 * handed, for a field written in `locale` on the clock `hourCycle` asks for.
 */
function fieldClockOf(
  locale: string,
  hourCycle: 12 | 24 | undefined,
): { hourCycle: 12 | 24 | undefined; locale: string } {
  if (hourCycle !== 24 || resolvedCycleOf(locale) !== 'h24') {
    return { hourCycle, locale }
  }

  const bare = locale.replace(HOUR_CYCLE_KEY, '')

  return {
    hourCycle: undefined,
    locale: bare.includes('-u-')
      ? bare.replace('-u-', '-u-hc-h23-')
      : `${bare}-u-hc-h23`,
  }
}

// The hour cycle React Stately resolves for a twenty-four hour clock in a
// locale, from the formatter it builds to read it.
function resolvedCycleOf(locale: string) {
  return new DateFormatter(locale, {
    dateStyle: 'short',
    hour12: false,
    timeStyle: 'short',
  }).resolvedOptions().hourCycle
}

export { fieldClockOf }
