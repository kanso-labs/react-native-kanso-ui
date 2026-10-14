import { StyleSheet } from 'react-native'

import { themedStyles } from '../theme/styles'

// The ring is web's `focus.ring`: 2dp wide, 2dp outside the control, in
// primary. An outline rather than a border, so showing it moves nothing, and
// rather than a shadow, which a high-contrast mode drops.
const stylesOf = themedStyles(({ colors }) =>
  StyleSheet.create({
    ring: {
      outlineColor: colors.primary,
      outlineOffset: 2,
      outlineStyle: 'solid',
      outlineWidth: 2,
    },
  }),
)

const styles = StyleSheet.create({
  // The state layer fills the surface. Its colour and opacity are the
  // control's and the state's, so they are set where it renders.
  layer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  // Fills the control, clips to the corners it is given, and takes no
  // touches, so a press lands on the control under it.
  surface: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
  },
})

export { styles, stylesOf }
