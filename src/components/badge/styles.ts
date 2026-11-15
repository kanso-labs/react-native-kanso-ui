import { StyleSheet } from 'react-native'

import { themedStyles } from '../../theme/styles'

// How far back over what it is drawn on the large badge reaches, from its
// trailing edge, and how far above it the badge stands. The page's own
// figures: its bottom leading corner 14dp down and 12dp in from the icon's
// top trailing corner, on a 16dp badge.
const OVERLAP = 12
const RISE = 2

// How far down the icon the large badge's bottom edge sits: the 14dp the
// page gives, the 16dp badge less the 2dp it stands above.
const DROP = 14

// The small badge's side, and the large badge's least height and width.
const SMALL_SIZE = 6
const LARGE_SIZE = 16

const styles = StyleSheet.create({
  // A badge with nothing to be drawn on: the mark in the line, where what
  // comes before it puts it, so neither corner's placement applies.
  alone: {
    position: 'relative',
  },
  // What the badge is drawn on. It shrinks to what it holds along the row,
  // so its box is the icon's and the mark lands where the page puts it, and
  // lays a mark that joins the flow after the icon.
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
  // The large badge over the top trailing corner of what it is drawn on,
  // hung from its pin's leading edge, from which it runs toward the end
  // however long its count, and standing on the pin, so a badge taller than
  // 16dp, as a large OS text size makes it, rises above the icon rather than
  // growing down over it. It is out of the pin's flow so that Yoga
  // measures it at its count's own width: in the flow it was handed the
  // pin's width, which is none, and "999+" wrapped one character to a line,
  // measured on an iPhone.
  over: {
    bottom: 0,
    position: 'absolute',
    start: 0,
  },
  // Where the large badge's bottom leading corner goes: a pin of no size
  // 12dp inside the trailing edge and 14dp below the top, so the badge it
  // holds starts where web's `calc(100% - 12px)` places it, and ends where
  // the page puts its bottom edge. A percentage inset would do it
  // in one step on web, but React Native lays out with Yoga's errata, which
  // read a percentage on an absolute child against the room its parent was
  // offered rather than the parent's own box: `start: '100%'` put the badge
  // at the far edge of the row its icon sat in, measured on an iPhone.
  pin: {
    end: OVERLAP,
    height: 0,
    position: 'absolute',
    top: DROP,
    width: 0,
  },
  // The small badge's 6dp square.
  small: {
    height: SMALL_SIZE,
    width: SMALL_SIZE,
  },
  // The small badge on what it is drawn on, filling its top trailing 6dp
  // square.
  smallOver: {
    end: 0,
    position: 'absolute',
    top: 0,
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
