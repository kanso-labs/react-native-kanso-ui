import { StyleSheet } from 'react-native'

import { themedStyles } from '../theme/styles'

// The line the progress indicators page draws, and the label row above it,
// shared by the two components that draw one, as web's src/indicator is:
// ProgressIndicator, which adds the ring and the two indeterminate
// presentations on top, and Meter, which is this and nothing else.
//
// The page's anatomy names three parts, the active indicator, the track and
// the stop indicator at the end, at 4dp thick with 4dp between them. The row
// is a flex row and the two gaps are its `gap`. The active indicator takes the
// value's share of what the two gaps and the stop leave, and the track takes
// the rest, so the stop ends the row at every value.

/** The thickness of every part, and the room the page leaves between them. */
const THICKNESS = 4
const GAP = 4

/** What the two gaps and the stop indicator take from the row. */
const RESERVED = GAP * 2 + THICKNESS

/**
 * The curve a determinate value moves along, Material's own, over the motion
 * scale's `durationMedium1`.
 */
const DETERMINATE_EASING = [0.4, 0, 0.6, 1] as const

const styles = StyleSheet.create({
  // The active indicator. Its width is the value's, and is set where it
  // renders.
  active: {
    flexShrink: 0,
    height: THICKNESS,
  },
  // The label's own part of the row, which gives way to the value.
  label: {
    flexShrink: 1,
  },
  // The three parts, with the page's 4dp between them.
  line: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: GAP,
    height: THICKNESS,
  },
  stop: {
    flexShrink: 0,
    height: THICKNESS,
    width: THICKNESS,
  },
  // The track: whatever the active indicator and the gaps leave. Given
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
