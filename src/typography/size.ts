import type { TextLayoutEvent } from 'react-native'

import { createContext, useContext } from 'react'

// The font size the Text around a caller draws in, once its role and its call
// site's style have both applied, and `undefined` outside one. A native Text
// nested in another takes the outer one's size without being able to read it,
// and Code and Keycap set a share of that size, which takes the number.
const TextSizeContext = createContext<number | undefined>(undefined)

/**
 * The line the library's Text around a caller sets its text on: its line
 * height, and how far its baseline sits above the bottom of a line once the
 * Text has been laid out and measured it, which it does only around a Keycap.
 * Each is `undefined` until there is one to give.
 */
type TextLine = {
  readonly descent: number | undefined
  readonly height: number | undefined
}

const TextLineContext = createContext<TextLine | undefined>(undefined)

/**
 * Keeps how far the first line of a laid out Text sits above the bottom of its
 * line, and hands the event on to the call site.
 */
function descentTo(
  set: (descent: number) => void,
  then?: (event: TextLayoutEvent) => void,
) {
  return (event: TextLayoutEvent) => {
    const first = event.nativeEvent.lines.at(0)
    if (first !== undefined) {
      set(first.descender)
    }
    then?.(event)
  }
}

/**
 * The line of the library's Text around the caller, or `undefined` when the
 * caller is not inside one.
 */
function useTextLine(): TextLine | undefined {
  return useContext(TextLineContext)
}

/**
 * The font size of the library's Text around the caller, or `undefined` when
 * the caller is not inside one.
 */
function useTextSize(): number | undefined {
  return useContext(TextSizeContext)
}

export type { TextLine }

export { descentTo, TextLineContext, TextSizeContext, useTextLine, useTextSize }
