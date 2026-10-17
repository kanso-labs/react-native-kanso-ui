import { StyleSheet } from 'react-native'

import { themedStyles } from '../theme/styles'

// The page's active indicator in a vertical destination: 56dp by 32dp, the
// icon centred in it.
const INDICATOR = { height: 32, width: 56 } as const

// A horizontal destination's pill, the page's 40dp, which its press reaches
// past to the 48dp target, and an expanded rail's, the rail page's 56dp.
const PILL_HEIGHT = 40
const EXPANDED_PILL_HEIGHT = 56

// A vertical destination's padding above the indicator and below the label,
// which puts the two in the bar's 64dp: 6, 32, 4 and 16, then 6.
const VERTICAL_PADDING = 6

const styles = StyleSheet.create({
  // The active indicator's fill, behind the icon in a vertical or collapsed
  // destination and behind the whole pill in a horizontal or expanded one.
  fill: {
    bottom: 0,
    end: 0,
    position: 'absolute',
    start: 0,
    top: 0,
  },
  // An icon, and the badge on it, never squeezed by a long label.
  icon: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
  },
  // The label never wraps: a destination's name is a word or two, and one
  // broken over two lines would push its neighbours apart. Cut short with an
  // ellipsis where the destination is narrower than it.
  label: {
    flexShrink: 1,
    maxWidth: '100%',
  },
})

const stylesOf = themedStyles(({ radii, spacing }) =>
  StyleSheet.create({
    // A collapsed rail's destination: the indicator with the label 4dp under
    // it, as wide as the rail and 4dp in from either edge, which leaves a
    // label 88dp of the rail's 96. It keeps its 64dp in a rail too short for
    // every destination, which scrolls them instead. Reversed, since the
    // label comes first in the tree.
    collapsed: {
      alignItems: 'center',
      alignSelf: 'stretch',
      flexDirection: 'column-reverse',
      flexShrink: 0,
      gap: spacing.xs,
      justifyContent: 'center',
      paddingHorizontal: spacing.xs,
      paddingVertical: VERTICAL_PADDING,
    },
    // An expanded rail's destination: the rail page's 56dp pill, holding the
    // icon and the label side by side, 16dp in at either end and 8dp between
    // the two, as wide as what it holds and no wider than the rail. A height
    // that is a minimum, so a larger text size grows the pill rather than
    // cutting its label. Reversed, since the label comes first in the tree.
    expanded: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: radii.pill,
      flexDirection: 'row-reverse',
      flexShrink: 0,
      gap: spacing.sm,
      maxWidth: '100%',
      minHeight: EXPANDED_PILL_HEIGHT,
      paddingHorizontal: spacing.lg,
    },
    // A horizontal destination: the pill, holding the icon and the label side
    // by side, 16dp in at either end and 4dp between the two, as wide as what
    // it holds. Reversed, since the label comes first in the tree.
    horizontal: {
      alignItems: 'center',
      borderRadius: radii.pill,
      flexDirection: 'row-reverse',
      flexShrink: 0,
      gap: spacing.xs,
      justifyContent: 'center',
      minHeight: PILL_HEIGHT,
      paddingHorizontal: spacing.lg,
    },
    // The active indicator of a vertical destination, which draws the layers
    // and the ring as well as the fill.
    indicator: {
      alignItems: 'center',
      borderRadius: radii.pill,
      flexShrink: 0,
      height: INDICATOR.height,
      justifyContent: 'center',
      width: INDICATOR.width,
    },
    // The fill's corners, the pill's.
    pill: {
      borderRadius: radii.pill,
    },
    // A vertical destination: the indicator with the label 4dp under it,
    // sharing the bar's width with the others. Its press is the whole of
    // that share, so it needs no reach of its own. Reversed, since the label
    // comes first in the tree.
    vertical: {
      alignItems: 'center',
      flexBasis: 0,
      flexDirection: 'column-reverse',
      flexGrow: 1,
      gap: spacing.xs,
      justifyContent: 'center',
      minWidth: 0,
      paddingVertical: VERTICAL_PADDING,
    },
  }),
)

export { INDICATOR, PILL_HEIGHT, styles, stylesOf }
