import type { Color } from 'react-stately'

import { createContext, use } from 'react'
import { parseColor } from 'react-stately'

// What the colour components share: the colour a ColorSwatchPicker item hands
// the swatch inside it, the colour a ColorPicker hands every control on its
// surface, how a colour given as a string is read, and what a colour is
// called.

/**
 * The colour a ColorPicker holds, and what a control on its surface reports a
 * change through, as React Aria's picker hands its value to the context of
 * each colour control on web. A change to `null`, an emptied field's, keeps
 * the colour, as React Stately's picker state does.
 */
type PickedColor = {
  readonly onChange: (color: Color | null) => void
  readonly value: Color
}

/**
 * The colour of the ColorPicker around a control, which ColorArea,
 * ColorField, ColorSlider, ColorSwatch, ColorSwatchPicker and ColorWheel take
 * where they are given no value of their own.
 */
const PickedColorContext = createContext<null | PickedColor>(null)

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

/**
 * A control's value and change handler inside the ColorPicker around it, as
 * React Aria merges a control's props over its context: the control's own
 * `value` where it is given one, else the picker's, and the picker's handler
 * called ahead of the control's own. Outside a picker, the control's own two.
 */
function usePickedColor<Value, Changed extends Color | null>(
  value: undefined | Value,
  onChange: ((color: Changed) => void) | undefined,
) {
  const picker = use(PickedColorContext)

  if (picker === null) {
    return { onChange, value }
  }

  const chained = (color: Changed) => {
    picker.onChange(color)
    onChange?.(color)
  }

  // Kept where it is null, a field emptied on purpose, as React Aria keeps
  // any value but a missing one.
  if (value !== undefined) {
    return { onChange: chained, value }
  }
  return { onChange: chained, value: picker.value }
}

export {
  colorNameOf,
  colorOf,
  PickedColorContext,
  SwatchColorContext,
  usePickedColor,
}
export type { PickedColor }
