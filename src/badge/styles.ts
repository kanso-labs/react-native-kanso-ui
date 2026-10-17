import { StyleSheet } from 'react-native'

import { themedStyles } from '../theme/styles'

// The icon a badge is drawn on, which the large badge's corner is measured
// from: the 24dp every destination draws.
const ICON_SIZE = 24

// How far back over the icon the large badge reaches, from the icon's
// trailing edge, and how far above the icon it stands. The page's own
// figures: its bottom leading corner 14dp down and 12dp in from the icon's
// top trailing corner, on a 16dp badge.
const OVERLAP = 12
const RISE = 2

// The small badge's side, and the large badge's least height and width.
const SMALL_SIZE = 6
const LARGE_SIZE = 16

const styles = StyleSheet.create({
  // What the badge is drawn on. It shrinks to what it holds, so its box is
  // the icon's and the mark lands where the page puts it, and lays a mark
  // that joins the flow after the icon.
  anchor: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  // The large badge in the flow after the icon, 12dp back over it and 2dp
  // above it, which is where its own placement puts it, so what follows the
  // icon starts after the badge rather than under it.
  inFlow: {
    marginStart: -OVERLAP,
    position: 'relative',
    top: -RISE,
  },
  // The large badge over the icon's top trailing corner.
  over: {
    position: 'absolute',
    start: ICON_SIZE - OVERLAP,
    top: -RISE,
  },
  // The small badge, filling the icon's top trailing 6dp square.
  small: {
    end: 0,
    height: SMALL_SIZE,
    position: 'absolute',
    top: 0,
    width: SMALL_SIZE,
  },
  // The space before the count, out of the flow, so it sets the count apart
  // from the text before it without moving anything.
  space: {
    position: 'absolute',
  },
})

const stylesOf = themedStyles(({ colors, radii, spacing }) =>
  StyleSheet.create({
    // The count, in label small with tabular figures, so a count that
    // changes does not change the badge's width digit by digit.
    count: {
      color: colors.onError,
      fontVariant: ['tabular-nums'],
    },
    // The page's large badge: at least 16dp tall and as wide, 4dp either
    // side of its count. A minimum rather than a size, so a larger text size
    // the device asks for grows the badge rather than cutting the count.
    large: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: LARGE_SIZE,
      minWidth: LARGE_SIZE,
      paddingHorizontal: spacing.xs,
    },
    // The fill and corner both badges share. It takes no touches, so a press
    // on it lands on what it is drawn on.
    mark: {
      backgroundColor: colors.error,
      borderRadius: radii.pill,
      pointerEvents: 'none',
    },
  }),
)

export { styles, stylesOf }
