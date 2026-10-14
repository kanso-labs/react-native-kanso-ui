import { StyleSheet } from 'react-native'

import { themedStyles } from '../theme/styles'

// The pill the chips page draws, shared by the two components that draw one:
// Chip, and ChipGroup's chip. See the header of `./index.tsx`.

// The page's icon size for a chip. A literal, as on web: the theme has no
// scale for icon sizes.
const GLYPH_SIZE = 18

// The rule every chip draws, transparent on a container of its own, so a chip
// is one size whichever container it is on.
const RULE_WIDTH = 1

const styles = StyleSheet.create({
  glyph: {
    alignItems: 'center',
    flexShrink: 0,
    height: GLYPH_SIZE,
    justifyContent: 'center',
    width: GLYPH_SIZE,
  },
  // The label gives way before anything else in the pill does, and `minWidth`
  // lets it narrow below its text, which React Native Web otherwise holds it
  // at, so the ellipsis has somewhere to fall.
  label: {
    flexShrink: 1,
    minWidth: 0,
  },
})

const stylesOf = themedStyles(({ radii, sizing, spacing }) =>
  StyleSheet.create({
    // The pill's inline padding is 8dp on the side the glyph is on, so the
    // slot gives back the difference rather than the pill padding each side
    // apart, as web's does.
    glyphStart: {
      marginStart: -spacing.sm,
    },
    // No block padding, as on web: the label's own line box is what keeps an
    // enlarged label off the pill's edge, and a padding off the spacing scale
    // would grow the pill past 32dp under a scheme with a roomier one.
    pill: {
      alignItems: 'center',
      borderRadius: radii.sm,
      borderWidth: RULE_WIDTH,
      flexDirection: 'row',
      gap: spacing.sm,
      maxWidth: '100%',
      minHeight: sizing.controlXs,
      paddingHorizontal: spacing.lg,
    },
  }),
)

const shadowsOf = themedStyles(({ shadows }) =>
  StyleSheet.create({
    elevation1: { boxShadow: shadows.elevation1 },
    elevation2: { boxShadow: shadows.elevation2 },
  }),
)

export { GLYPH_SIZE, RULE_WIDTH, shadowsOf, styles, stylesOf }
