import type { Color } from 'react-stately'

import { createContext } from 'react'
import { parseColor } from 'react-stately'

// What a ColorSwatch and a ColorSwatchPicker's item share: the colour an item
// hands the swatch inside it, how either reads a colour it is given as a
// string, and what either is called.

/**
 * The colour of the ColorSwatchPicker item a swatch is drawn in, which the
 * swatch draws when it is given no `color` of its own, as React Aria's swatch
 * reads its item's colour on web.
 */
const SwatchColorContext = createContext<Color | undefined>(undefined)

/**
 * What a colour is called in the locale, "light vibrant cyan blue, 60%
 * transparent", or `transparent`, the library's word for it, when it has no
 * alpha left, since there is then no colour left to name.
 */
function colorNameOf(color: Color, locale: string, transparent: string) {
  return color.getChannelValue('alpha') === 0
    ? transparent
    : color.getColorName(locale)
}

/** A colour as React Stately's `Color`, parsed when it is a CSS string. */
function colorOf(color: Color | string): Color {
  return typeof color === 'string' ? parseColor(color) : color
}

export { colorNameOf, colorOf, SwatchColorContext }
