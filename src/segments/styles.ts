import { Platform, StyleSheet } from 'react-native'

import { withOpacity } from '../theme/color'
import { themedStyles } from '../theme/styles'

// The segments a date or a time is typed into, apart from the fields drawing
// them so the two cannot drift, as web keeps them in its own src/segments.

const segmentStylesOf = themedStyles(
  ({ colors, radii, spacing, stateLayerOpacity }) =>
    StyleSheet.create({
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
