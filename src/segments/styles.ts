import { Platform, StyleSheet } from 'react-native'

import { withOpacity } from '../theme/color'
import { themedStyles } from '../theme/styles'

// The segments a date or a time is typed into, apart from the fields drawing
// them so the two cannot drift, as web keeps them in its own src/segments.

const segmentStylesOf = themedStyles(
  ({ colors, radii, spacing, stateLayerOpacity }) =>
    StyleSheet.create({
      // The room either side of a literal between two segments under React
      // Native Web, the slash of 9/8/2026 and the colon of 9:30, as web's
      // segments space their literals. A single digit is narrower than the
      // 24 by 24 WCAG asks of a target, which lets one that size pass only
      // where a 24px circle centred on it reaches neither the next segment
      // nor that one's circle, and with the literal drawn tight the 9 and
      // the 30 of 9:30 sat 19px apart, centre to centre. Spaced rather than
      // widened, since a segment held at 24 leaves a short value floating in
      // it. iOS and Android reach each segment up to the field line by
      // `hitSlop` instead, which the web ignores.
      literalRoom: {
        paddingHorizontal: spacing.xs,
      },
      // A literal that ends in its own space, the comma between a date and
      // its time, hangs off the segment before it, as the same comma does in
      // prose, and takes its room on the far side alone, as on web.
      literalRoomHanging: {
        paddingEnd: spacing.xs,
      },
      // One segment, its own place to type. The filled shape below is its
      // focus, so a browser's own ring would be a second treatment for one
      // focus: solid and no width, as a field's control draws it.
      segment: {
        borderRadius: radii.xs,
        paddingHorizontal: spacing.xxs,
        ...(Platform.OS === 'web'
          ? { outlineStyle: 'solid', outlineWidth: 0 }
          : undefined),
      },
      // The one being typed. The caret is hidden, so the segment is what says
      // which of them has focus, and it says so the way a selected row does.
      segmentFocused: {
        backgroundColor: colors.primary,
      },
      // The dash between a range's two dates, with the gap web's picker
      // keeps either side of it.
      separator: {
        marginHorizontal: spacing.sm,
      },
      // A segment holding a value, and the time zone a field shows after its
      // time, which is part of the value rather than punctuation.
      text: {
        color: colors.onSurface,
      },
      // Faded with the rest of the field, literals included, at the opacity
      // every disabled control here takes.
      textDisabled: {
        color: withOpacity(colors.onSurface, stateLayerOpacity.disabledContent),
      },
      textFocused: {
        color: colors.onPrimary,
      },
      // A segment with nothing in it yet, showing its own placeholder, and a
      // literal, the slash or the colon the locale puts between two segments,
      // both of which a half-typed date reads past.
      textMuted: {
        color: colors.onSurfaceVariant,
      },
    }),
)

export { segmentStylesOf }
