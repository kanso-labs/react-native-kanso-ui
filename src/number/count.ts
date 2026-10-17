// One plain formatter per locale, for the counts a badge and a field's counter
// write, which change often enough that building a formatter on each would
// show. The keys are the locales an app renders in, so the map settles at that
// size.
const formats = new Map<string, Intl.NumberFormat>()

/** A count in `locale`'s digits and grouping. */
function formatCount(count: number, locale: string) {
  let format = formats.get(locale)

  if (format === undefined) {
    format = new Intl.NumberFormat(locale)
    formats.set(locale, format)
  }

  return format.format(count)
}

export { formatCount }
