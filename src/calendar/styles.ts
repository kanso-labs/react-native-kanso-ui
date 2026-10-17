import { StyleSheet } from 'react-native'

import { withOpacity } from '../theme/color'
import { themedStyles } from '../theme/styles'

// The values are the date pickers page's docked calendar, as kanso-ui's
// src/calendar/styles.ts draws it, and named in
// src/components/calendar/index.tsx along with the departures from it.

// The weeks the grid holds room for, which is the most any month occupies: a
// 31-day month beginning on the last day of a week runs one day, then four
// whole weeks, then two days. Holding six draws every month in the box the
// longest one fills, so the calendar keeps its height as the month moves.
const WEEKS_HELD = 6

// How far a month slides in from the side it comes from as it arrives,
// Material Design's shared axis distance.
const SLIDE_DISTANCE = 30

const styles = StyleSheet.create({
  // A column of the grid: a seventh of its width, the date's circle centred
  // in it.
  column: {
    alignItems: 'center',
    flexBasis: 0,
    flexGrow: 1,
    justifyContent: 'center',
  },
  // The chevron that goes back is the forward chevron turned around. It says
  // "back" rather than "to the left", so it turns with the writing direction
  // as the forward one does, which the glyph's own mirroring and this
  // together give.
  previousGlyph: {
    transform: [{ scaleX: -1 }],
  },
  previousGlyphRightToLeft: {
    transform: [{ scaleX: 1 }],
  },
  // A row of the grid: the weekday row, or a week.
  row: {
    flexDirection: 'row',
  },
})

const stylesOf = themedStyles(
  ({ colors, radii, sizing, spacing, stateLayerOpacity }) => {
    // One row of the grid, and the page's 48dp column, seven to a week.
    const row = sizing.controlMd
    // The date's state layer: the 40dp circle a selected date fills, inside
    // the 48dp row and column it sits in.
    const date = sizing.controlSm
    const disabled = withOpacity(
      colors.onSurface,
      stateLayerOpacity.disabledContent,
    )

    return StyleSheet.create({
      // The open month or year list's arrow, turned over while its list is
      // open, which says the next press closes it.
      arrowExpanded: {
        transform: [{ rotate: '180deg' }],
      },
      // The chevrons' 48dp column: the icon button's 40dp square with 4dp
      // either side.
      chevron: {
        marginHorizontal: spacing.xs,
      },
      // A chevron's room while a list is open, which the page draws without
      // them: as wide as the chevron, so the month's menu button stays where
      // it was.
      chevronRoom: {
        height: date,
        marginHorizontal: spacing.xs,
        width: date,
      },
      // The date itself: the page's 40dp state layer, which is the circle a
      // selected date fills and the shape a press tints, 4dp clear of the
      // row above and below. Across, the column centres it.
      date: {
        alignItems: 'center',
        borderRadius: radii.circle,
        height: date,
        justifyContent: 'center',
        marginVertical: (row - date) / 2,
        width: date,
      },
      // The date the calendar holds: a filled circle in the primary role.
      dateSelected: {
        backgroundColor: colors.primary,
      },
      // A date's number, in the type the page gives the dates.
      dateText: {
        color: colors.onSurface,
        textAlign: 'center',
      },
      // A date outside `minValue` and `maxValue`, in a month either side of
      // the one shown, or in a disabled calendar: the page's 38% on the
      // content role.
      dateTextDisabled: {
        color: disabled,
      },
      dateTextSelected: {
        color: colors.onPrimary,
      },
      dateTextToday: {
        color: colors.primary,
      },
      // A date ruled out one at a time by `isDateUnavailable`, struck
      // through at full contrast, since a reader can still land on it and
      // has to read it.
      dateTextUnavailable: {
        textDecorationLine: 'line-through',
      },
      // Today, when it is not the date held: the page's 1dp outline in the
      // primary role.
      dateToday: {
        borderColor: colors.primary,
        borderWidth: 1,
      },
      // The room the grid is held at: the weekday row and six weeks.
      grid: {
        height: row * (WEEKS_HELD + 1),
      },
      // The row the chevrons and the month sit in, at the page's 40dp
      // button height.
      header: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        justifyContent: 'space-between',
        minHeight: date,
      },
      // The month's menu button between the chevrons that step it.
      headerGroup: {
        alignItems: 'center',
        flexDirection: 'row',
      },
      // The month and year, between the two chevrons.
      heading: {
        color: colors.onSurfaceVariant,
        flexShrink: 1,
        textAlign: 'center',
      },
      // The open list, in the place the grid was. It takes the grid's
      // height, so opening it moves nothing under the calendar, and scrolls
      // inside it. The negative margin runs its rows to the container's
      // edges, as the page draws them, under the page's outline variant
      // divider.
      list: {
        borderTopColor: colors.outlineVariant,
        borderTopWidth: 1,
        flexGrow: 0,
        height: row * (WEEKS_HELD + 1),
        marginHorizontal: -spacing.md,
      },
      // The check before the entry the calendar shows, at the page's 24dp,
      // and the room it takes on every other row, so every label starts at
      // the same place.
      listCheck: {
        alignItems: 'center',
        height: 24,
        justifyContent: 'center',
        width: 24,
      },
      // An open list's row: the page's 48dp, its label 16dp in from the
      // container's edge with the check's column first.
      listRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.lg,
        height: row,
        paddingHorizontal: spacing.lg,
      },
      // The month or year the calendar shows, on the page's surface variant.
      listRowSelected: {
        backgroundColor: colors.surfaceVariant,
      },
      listText: {
        color: colors.onSurface,
        flexShrink: 1,
      },
      // A month the calendar's bounds leave no day of.
      listTextDisabled: {
        color: disabled,
      },
      // The page's menu button: a 40dp pill holding the month or the year in
      // label large, in on surface variant, with the arrow after it.
      menuButton: {
        alignItems: 'center',
        borderRadius: radii.pill,
        flexDirection: 'row',
        flexShrink: 0,
        gap: spacing.xs,
        height: date,
        paddingHorizontal: spacing.sm,
      },
      menuButtonText: {
        color: colors.onSurfaceVariant,
      },
      // The page's docked container: 360dp on the high surface container, or
      // the width of its container where that is narrower, the columns
      // sharing what is left.
      root: {
        backgroundColor: colors.surfaceContainerHigh,
        borderRadius: radii.lg,
        gap: spacing.md,
        maxWidth: '100%',
        padding: spacing.md,
        width: row * 7 + spacing.md * 2,
      },
      // A row of the grid, the page's 48dp.
      rowHeight: {
        height: row,
      },
      // The weekday row, in the full content role the page gives it.
      weekday: {
        color: colors.onSurface,
        textAlign: 'center',
      },
    })
  },
)

export { SLIDE_DISTANCE, styles, stylesOf, WEEKS_HELD }
