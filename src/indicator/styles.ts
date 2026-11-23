import { StyleSheet } from 'react-native'

import { themedStyles } from '../theme/styles'

// The line the progress indicators page draws, and the label row above it,
// shared by the two components that draw one, as web's src/indicator is:
// ProgressIndicator, which adds the ring and the two indeterminate
// presentations on top, and Meter, which is this and nothing else.
//
// The page's anatomy names three parts, the active indicator, the track and
// the stop indicator at the end, at 4dp thick with 4dp between them. The row
// is a flex row. The active indicator takes the value's share of the row less
// the stop and the gap before it, and the track takes the rest, so the stop
// ends the row at every value.
//
// The gap between the active indicator and the track is never wider than
// either of them, which is Compose's rule and web's: it grows from nothing at
// 0, so an empty line is the whole track from the row's start, and it closes
// again over the last 4dp, where the track has no room left, so a full line
// ends 4dp before the stop. A gap kept beside a part with no width is a space
// with nothing on one side of it. So the gaps are margins rather than the
// row's `gap`: the stop's is fixed, and the active indicator's is set where it
// renders — see `gapAfterActive` in ./index.tsx.

/** The thickness of every part, and the room the page leaves between them. */
const THICKNESS = 4
const GAP = 4

/** What the stop indicator and the gap before it take from the row. */
const RESERVED = GAP + THICKNESS

/**
 * The curve a determinate value moves along, Material's own, over the motion
 * scale's `durationMedium1`.
 */
const DETERMINATE_EASING = [0.4, 0, 0.6, 1] as const

const styles = StyleSheet.create({
  // The active indicator. Its width is the value's, and the gap after it the
  // value's too, both set where it renders.
  active: {
    flexShrink: 0,
    height: THICKNESS,
  },
  // The label's own part of the row. It gives way to the value, and breaks a
  // word wider than the room rather than widening the row: a file name or a
  // compound otherwise pushed the value off the end. The browser keeps a flex
  // item as wide as its longest word unless told it may be narrower.
  label: {
    flexShrink: 1,
    minWidth: 0,
  },
  // The three parts. The page's 4dp between them is a margin after the
  // active indicator and another before the stop rather than the row's
  // `gap`, since the first narrows at either end of the range.
  line: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    height: THICKNESS,
  },
  // The stop indicator, with the page's 4dp before it at every value.
  stop: {
    flexShrink: 0,
    height: THICKNESS,
    marginStart: GAP,
    width: THICKNESS,
  },
  // The track: whatever the active indicator and the gaps either side leave. Given
  // something to hold it becomes a row of its own, clipped to its corners.
  track: {
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    height: THICKNESS,
    minWidth: 0,
    overflow: 'hidden',
  },
  // The value: whole, on one line, and at the end of the row whether or not a
  // label is beside it.
  value: {
    flexShrink: 0,
    marginStart: 'auto',
  },
})

const stylesOf = themedStyles(({ radii, spacing }) =>
  StyleSheet.create({
    // The active indicator and the track are pills, and the stop a dot.
    active: { borderRadius: radii.pill },
    // The label and the value either end of a row above the indicator.
    labels: {
      alignItems: 'baseline',
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'space-between',
    },
    // The label row and the line, stacked.
    root: { gap: spacing.xs },
    stop: { borderRadius: radii.circle },
    track: { borderRadius: radii.pill },
  }),
)

export { DETERMINATE_EASING, GAP, RESERVED, styles, stylesOf, THICKNESS }
