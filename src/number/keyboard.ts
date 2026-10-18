import type { NumberFormatOptions } from '@internationalized/number'
import type { KeyboardTypeOptions } from 'react-native'

import { NumberFormatter } from '@internationalized/number'
import { Platform } from 'react-native'

// The keyboard that types what a field holding a number takes, NumberField's
// and a ColorField's holding a channel: React Aria's own choice of input
// mode, in React Native's keyboards. A minus where the range reaches below
// zero, and a decimal separator where the format shows a fraction. On iOS a
// minus is on the numbers and punctuation keyboard alone, so a field that
// takes one gets that.

/**
 * The keyboard for a number written in `locale` and `formatOptions`, from
 * `minValue` up: one with a minus where the range reaches below zero, and a
 * decimal separator where the format shows a fraction.
 */
function keyboardFor(
  locale: string,
  formatOptions: NumberFormatOptions | undefined,
  minValue: number | undefined,
): KeyboardTypeOptions {
  const hasNegative =
    minValue === undefined || Number.isNaN(minValue) || minValue < 0

  if (hasNegative) {
    return Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'
  }

  const hasDecimals =
    (new NumberFormatter(locale, formatOptions).resolvedOptions()
      .maximumFractionDigits ?? 0) > 0

  return hasDecimals ? 'decimal-pad' : 'number-pad'
}

export { keyboardFor }
