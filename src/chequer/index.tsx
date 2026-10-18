import { useId } from 'react'
import { StyleSheet } from 'react-native'
import Svg, { Defs, Pattern, Rect } from 'react-native-svg'

import { HIDDEN } from '../glyphs/hidden'
import { useTheme } from '../theme/scope'

// The chequer a transparent colour is drawn against, as kanso-ui's
// src/styles/chequer.ts draws it, behind a swatch and behind a colour
// slider's alpha track. A half-transparent red over a light surface and an
// opaque pink are the same pixels; this is what tells them apart.
//
// Here rather than in either component, since both draw it and a second copy
// would be a second density to keep in step. It is built from two surface
// tokens, surface container highest squares on surface container lowest, so
// it follows the theme rather than being a fixed grey. The squares are 8dp,
// two to a 16dp tile on its diagonal, which reads as a chequer at a swatch's
// size without turning into a texture.
//
// It is an svg pattern rather than a grid of views, so a track of any length
// costs the same three rectangles. It fills the view it is placed in, behind
// whatever comes after it there, so a colour drawn over it shows it through
// as far as the colour is transparent. The view clips it to its own corners.

const TILE = 16
const HALF = TILE / 2

function Chequer() {
  const { colors } = useTheme()
  // A pattern is found by its id, which has to be unique in the page under
  // React Native Web. React's are, and from 19.2 on hold nothing a `url()`
  // reference cannot take.
  const id = `chequer${useId()}`

  return (
    <Svg {...HIDDEN} height="100%" style={StyleSheet.absoluteFill} width="100%">
      <Defs>
        <Pattern
          height={TILE}
          id={id}
          patternUnits="userSpaceOnUse"
          width={TILE}
        >
          <Rect
            fill={colors.surfaceContainerLowest}
            height={TILE}
            width={TILE}
          />
          <Rect
            fill={colors.surfaceContainerHighest}
            height={HALF}
            width={HALF}
          />
          <Rect
            fill={colors.surfaceContainerHighest}
            height={HALF}
            width={HALF}
            x={HALF}
            y={HALF}
          />
        </Pattern>
      </Defs>
      <Rect fill={`url(#${id})`} height="100%" width="100%" />
    </Svg>
  )
}

export { Chequer }
