import { processColor } from 'react-native'

/**
 * A colour at a fraction of its own opacity, for the roles Material Design
 * gives as a colour at an opacity: a disabled container is on-surface at the
 * `disabledContainer` opacity, and its label on-surface at `disabledContent`.
 * Web reaches those through `color-mix()`, which React Native has no
 * counterpart of, so the colour is read into its channels here and written
 * back as `rgba()` with the alpha scaled.
 *
 * Any colour React Native reads is taken, a hex, a function or a name, and
 * one with an alpha of its own keeps it, scaled. A colour React Native cannot
 * read is handed back as it was.
 */
function withOpacity(color: string, opacity: number): string {
  const processed = processColor(color)

  if (typeof processed !== 'number') {
    return color
  }

  // `processColor` hands back the channels as ARGB, unsigned on iOS and on
  // the web and signed on Android, which the shift makes unsigned.
  const argb = processed >>> 0
  const alpha = ((argb >>> 24) / 255) * opacity

  return `rgba(${String((argb >>> 16) & 255)}, ${String((argb >>> 8) & 255)}, ${String(argb & 255)}, ${String(Math.round(alpha * 1000) / 1000)})`
}

export { withOpacity }
