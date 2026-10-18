import { StyleSheet } from 'react-native'

import { withOpacity } from '../theme/color'
import { themedStyles } from '../theme/styles'

// The chrome's styles, apart from ./index.tsx so that file holds components
// alone. What follows the device's text size, the box's height and the
// label's places, is worked out where it renders, since a stylesheet is built
// once per theme and the text size can change under it.
//
// The box is a row: an icon slot at either end, if the field has one, with the
// label and the control in a column between them. The page gives the icons
// 24dp, 12dp from the box's edge and 16dp from the text, centred in the box's
// height, which the slot is with the box's padding the same above and below.

/**
 * How far an outline piece's own box reaches past the piece that clips it, so
 * the borders and corners on that side fall outside it. A corner's radius and
 * the thickest border are enough; this is that, with room to spare.
 */
const OUTLINE_REACH = 8

const fieldStylesOf = themedStyles(
  ({ colors, radii, spacing, stateLayerOpacity }) =>
    StyleSheet.create({
      // The control's line, holding the affixes beside it. The 2dp is
      // Compose's padding between the two, since the page gives none.
      affixLine: {
        alignItems: 'baseline',
        flexDirection: 'row',
        flexGrow: 1,
        gap: spacing.xxs,
      },
      // The filled box: surface container highest, the page's 4dp corners at
      // the top and square at the bottom, where the indicator runs the full
      // width. 8dp above the label and below the value, and 16dp at either
      // end, or 12dp beside an icon.
      box: {
        backgroundColor: colors.surfaceContainerHighest,
        borderTopEndRadius: radii.xs,
        borderTopStartRadius: radii.xs,
        flexDirection: 'row',
        gap: spacing.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
      },
      boxDisabled: {
        backgroundColor: withOpacity(
          colors.onSurface,
          stateLayerOpacity.disabledContainer,
        ),
      },
      boxLeading: {
        paddingStart: spacing.md,
      },
      // The outlined box: no fill, and 16dp above and below the value, which
      // centres it, since the label sits on the outline rather than over it.
      boxOutlined: {
        backgroundColor: 'transparent',
        paddingVertical: spacing.lg,
      },
      boxTrailing: {
        paddingEnd: spacing.md,
      },
      // A box that is itself the control draws its focus with its indicator,
      // as a box around a control does, so a browser's own ring would be a
      // second treatment for one focus: solid and no width, as the control's.
      boxTrigger: {
        outlineStyle: 'solid',
        outlineWidth: 0,
      },
      // The label and the control's column, which the label is placed
      // against, so it moves past a leading icon with the text.
      column: {
        flexGrow: 1,
        flexShrink: 1,
        justifyContent: 'flex-start',
        minWidth: 0,
      },
      // A multi-line control growing under React Native Web, over the copy
      // of its text that gives it its height.
      copied: {
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
      },
      // The copy: the control's type and wrapping, drawn in nothing.
      copy: {
        opacity: 0,
        pointerEvents: 'none',
      },
      // The count of characters, at the end of the message line in tabular
      // figures so it does not jitter as it counts.
      counter: {
        flexShrink: 0,
        fontVariant: ['tabular-nums'],
        marginStart: 'auto',
      },
      // An icon slot, centred in the box's height whatever it holds: the
      // page's 24dp icon, or an icon button around one.
      icon: {
        alignItems: 'center',
        alignSelf: 'center',
        justifyContent: 'center',
      },
      // The filled box's active indicator: a rule across the bottom, laid
      // over the box so it thickening on focus moves nothing. A border
      // rather than a fill, since a forced palette on the web keeps a
      // border and paints over a background.
      indicator: {
        bottom: 0,
        end: 0,
        position: 'absolute',
        start: 0,
      },
      input: {
        flexGrow: 1,
        flexShrink: 1,
        margin: 0,
        minWidth: 0,
        // The box draws the focus, so a ring around the control inside it
        // would be two treatments for one focus. Solid as well as no width:
        // a browser's own ring is the `auto` style, which ignores the width.
        outlineStyle: 'solid',
        outlineWidth: 0,
        padding: 0,
      },
      // A text area's text starts at the top of its lines, where Android
      // would centre it in them.
      inputMultiline: {
        textAlignVertical: 'top',
      },
      // The growing control, laid over the copy that sizes it.
      inputOverCopy: {
        bottom: 0,
        end: 0,
        overflow: 'hidden',
        position: 'absolute',
        start: 0,
        top: 0,
      },
      // The label's place: the column's width at its top, the label at its
      // start as wide as its text, so it sits at the right end of a
      // right-to-left field whatever script it is in. One line, cut short
      // with an ellipsis where the column ends, which is before an icon at
      // either end. It takes no touches, so a press on it lands on the
      // control or the box under it.
      label: {
        alignItems: 'flex-start',
        end: 0,
        pointerEvents: 'none',
        position: 'absolute',
        start: 0,
        top: 0,
      },
      // Outlined, the label has the page's 4dp either side, which the notch
      // has too, so the two line up and the label's text starts where the
      // value does.
      labelOutlined: {
        end: -spacing.xs,
        start: -spacing.xs,
      },
      labelTextOutlined: {
        paddingHorizontal: spacing.xs,
      },
      // The line under the box: the message at the start, the counter at the
      // end, the page's 4dp under the box and 16dp between the two, indented
      // to the box's own padding so the message starts where the value does.
      messageLine: {
        flexDirection: 'row',
        gap: spacing.lg,
        marginTop: spacing.xs,
        paddingHorizontal: spacing.lg,
      },
      // The line with nothing to show: out of the flow, so the field ends at
      // its box, and still there for the live region inside it, which has to
      // be in place before the error it announces arrives.
      messageLineCollapsed: {
        marginTop: 0,
        position: 'absolute',
      },
      // The label's text in its floated type, out of sight, which is what
      // the notch takes its width from. In the outlined label's own place, so
      // a label with no room is cut short where the label is.
      notchMeasure: {
        opacity: 0,
      },
      // The outline: three pieces in a row over the whole box, the stretch
      // before the label, the notch under it and the stretch after it. Each
      // piece clips a whole outlined box of its own to the part of the
      // outline it draws, so the width and the colour are one shorthand
      // that eases, and the corners turn over with the row in a
      // right-to-left layout.
      outline: {
        bottom: 0,
        flexDirection: 'row',
        left: 0,
        pointerEvents: 'none',
        position: 'absolute',
        right: 0,
        top: 0,
      },
      outlineEnd: {
        flexGrow: 1,
        overflow: 'hidden',
      },
      outlineEndBox: {
        borderRadius: radii.xs,
        bottom: 0,
        end: 0,
        position: 'absolute',
        start: -OUTLINE_REACH,
        top: 0,
      },
      // The notch draws only the bottom of the outline, its box reaching past
      // the top and both sides.
      outlineNotch: {
        flexShrink: 1,
        overflow: 'hidden',
      },
      outlineNotchBox: {
        bottom: 0,
        end: -OUTLINE_REACH,
        position: 'absolute',
        start: -OUTLINE_REACH,
        top: -OUTLINE_REACH,
      },
      outlineStart: {
        flexShrink: 0,
        overflow: 'hidden',
      },
      outlineStartBox: {
        borderRadius: radii.xs,
        bottom: 0,
        end: -OUTLINE_REACH,
        position: 'absolute',
        start: 0,
        top: 0,
      },
      // A date or a time's segments on the value's line, in a row. Clipped
      // at the box rather than wrapped, since every segment on the line is
      // somewhere to type, so none of it can be drawn as though it were not
      // there.
      segments: {
        alignItems: 'center',
        flexDirection: 'row',
        overflow: 'hidden',
      },
    }),
)

export { fieldStylesOf, OUTLINE_REACH }
