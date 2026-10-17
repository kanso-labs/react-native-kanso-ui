import { createContext, useContext } from 'react'

// The font size the Text around a caller draws in, once its role and its call
// site's style have both applied, and `undefined` outside one. A native Text
// nested in another takes the outer one's size without being able to read it,
// and Code and Keycap set a share of that size, which takes the number.
const TextSizeContext = createContext<number | undefined>(undefined)

/**
 * The font size of the library's Text around the caller, or `undefined` when
 * the caller is not inside one.
 */
function useTextSize(): number | undefined {
  return useContext(TextSizeContext)
}

export { TextSizeContext, useTextSize }
