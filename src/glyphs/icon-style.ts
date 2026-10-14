import type { ColorValue } from 'react-native'

import { createContext, use } from 'react'

/** The colour and size a slot gives the icon drawn in it. */
type IconStyle = {
  /** The colour the icon fills with. */
  readonly color?: ColorValue
  /** The side of the icon's square, in dp. */
  readonly size: number
}

// Outside any slot an icon draws at 24dp, the grid Material Symbols are drawn
// on, in whatever colour its own drawing falls back to.
const IconStyleContext = createContext<IconStyle>({ size: 24 })

/**
 * The colour and size of the slot an icon sits in, as a slot that takes an
 * icon provides them. The library's own glyphs read it, and an icon of the
 * app's own reads it to match them.
 *
 * ```tsx
 * function StarIcon() {
 *   const { color, size } = useIconStyle()
 *   return <Star color={color} size={size} />
 * }
 * ```
 */
function useIconStyle(): IconStyle {
  return use(IconStyleContext)
}

export { IconStyleContext, useIconStyle }
export type { IconStyle }
