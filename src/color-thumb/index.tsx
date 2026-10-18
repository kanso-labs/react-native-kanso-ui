import type { ViewStyle } from 'react-native'
import type { Color } from 'react-stately'

import { StyleSheet, View } from 'react-native'

import { useTheme } from '../theme/scope'
import { composeStyles, themedStyles } from '../theme/styles'

// The handle a colour slider draws, as kanso-ui's src/styles/color.ts draws
// it: a 20dp circle filled with the colour at the point it sits on. The
// component places it; everything here is the ring around that fill.
//
// **It is ringed rather than filled, because its fill is the value.** The
// ring is what has to read, against every colour the track runs through, so
// it is 2dp of surface with a 1dp hairline in outline outside it, which works
// on a light ground and a dark one alike. Web draws the two as box shadows
// and gives a forced palette a border in their place; here they are borders
// from the start, which no platform mode drops. The fill is the inner view's
// background, inside the surface ring, so a translucent colour shows the
// track through it as web's does.
//
// While it is dragged it lifts to level 2, as web's does. That is decoration,
// and the rings are what keep it apart from the track either way.

const FILL = 20
const RING = 2
const HAIRLINE = 1

const stylesOf = themedStyles(({ colors, radii, shadows }) =>
  StyleSheet.create({
    // The hairline, outside the ring.
    edge: {
      borderColor: colors.outline,
      borderRadius: radii.circle,
      borderWidth: HAIRLINE,
      height: FILL + 2 * (RING + HAIRLINE),
      width: FILL + 2 * (RING + HAIRLINE),
    },
    lifted: {
      boxShadow: shadows.elevation2,
    },
    // The surface ring, with the colour inside it.
    ring: {
      borderColor: colors.surface,
      borderRadius: radii.circle,
      borderWidth: RING,
      flexGrow: 1,
    },
  }),
)

function ColorThumb({
  color,
  dragging,
}: {
  /** The colour at the point the handle sits on. */
  readonly color: Color
  /** Whether the handle is being dragged, which lifts it. */
  readonly dragging: boolean
}) {
  const own = stylesOf(useTheme())

  return (
    <View
      style={composeStyles<ViewStyle>(
        own.edge,
        dragging ? own.lifted : undefined,
      )}
    >
      <View
        style={composeStyles<ViewStyle>(own.ring, {
          backgroundColor: color.toString('css'),
        })}
      />
    </View>
  )
}

export { ColorThumb }
