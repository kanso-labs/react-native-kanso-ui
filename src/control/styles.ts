import { StyleSheet } from 'react-native'

import { withOpacity } from '../theme/color'
import { themedStyles } from '../theme/styles'

// The row a selection control draws, as web's src/control draws it for
// Checkbox, Radio and Switch alike: the control's 40dp state layer, the
// body-large label beside it, and the description or error under the label
// rather than under the control.
//
// The pages give two sizes, a 40dp state layer and a 48dp target. The layer
// is drawn; the target is the `hitSlop` the control takes, which reaches the
// 4dp past the layer each way without moving anything. Literals, as on web:
// they are one page's layer and one page's target rather than steps of the
// control scale, and a theme resizing its buttons should move neither.
const LAYER_SIZE = 40

const controlStylesOf = themedStyles(
  ({ colors, radii, spacing, stateLayerOpacity, typography }) =>
    StyleSheet.create({
      // The 40dp state layer, which centres what the control draws in it.
      disc: {
        alignItems: 'center',
        borderRadius: radii.circle,
        flexShrink: 0,
        height: LAYER_SIZE,
        justifyContent: 'center',
        width: LAYER_SIZE,
      },
      // Centres the label's first line on the layer, whether the label is
      // one line or wraps to several: half of what the layer has spare over
      // one body-large line, rather than a step of the spacing scale, which
      // is that half only under the default tokens. A line taller than the
      // layer has no room to centre in, and the padding falls to nothing.
      //
      // `minWidth: 0` is for React Native Web, where a text in a row keeps
      // CSS's automatic minimum, the width of its longest word, so a label
      // with nowhere to break ran past the row rather than breaking inside
      // it. Yoga has no such minimum, so on a device it changes nothing.
      label: {
        color: colors.onSurface,
        flexShrink: 1,
        minWidth: 0,
        paddingVertical: Math.max(
          0,
          (LAYER_SIZE - typography.bodyLargeLineHeight) / 2,
        ),
      },
      labelDisabled: {
        color: withOpacity(colors.onSurface, stateLayerOpacity.disabledContent),
      },
      message: {
        color: colors.onSurfaceVariant,
      },
      messageError: {
        color: colors.error,
      },
      // Under the label rather than under the control, so it starts where
      // the label's text does, on whichever side the layout starts from.
      messages: {
        marginStart: LAYER_SIZE + spacing.sm,
        marginTop: spacing.xs,
      },
      // The control, then the label. The row is at least the layer's
      // height and grows with a label that wraps or a larger text size.
      row: {
        alignItems: 'flex-start',
        columnGap: spacing.sm,
        flexDirection: 'row',
        minHeight: LAYER_SIZE,
      },
    }),
)

export { controlStylesOf, LAYER_SIZE }
