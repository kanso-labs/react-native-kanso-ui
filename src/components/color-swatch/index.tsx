import type { ComponentRef, Ref } from 'react'
import type { StyleProp, ViewProps, ViewStyle } from 'react-native'
import type { Color } from 'react-stately'

import { use } from 'react'
import { StyleSheet, View } from 'react-native'

import { Chequer } from '../../chequer'
import { useLocaleOf, useMessages } from '../../i18n/provider'
import { colorNameOf, colorOf, SwatchColorContext } from '../../swatch'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// A single colour, drawn as a square, as kanso-ui's ColorSwatch draws it.
// Material Design carries no page for this: its colour guidance is about the
// roles a component takes, not about showing a colour as a value. So the
// shape is the library's own, built from what the rest of it already uses: a
// 40dp square on the extra-small corner.
//
// Three things follow from that, and each is a choice rather than a reading.
//
// **A swatch is outlined.** Its own colour is the content, so it cannot carry
// a contrasting one, and a white swatch on a light surface, or a near-black
// one in dark mode, would otherwise have no edge at all. The outline is the
// 1dp outline variant hairline a field's box takes, drawn as the border of a
// view laid over the colour, so it sits on the colour's edge rather than
// around it.
//
// **Transparency is drawn against a chequer rather than against the page.**
// The chequer is src/chequer's, which follows the theme. It is drawn only
// behind a colour with some transparency, since an opaque one would cover it
// whole.
//
// **The swatch names itself from the colour.** React Stately's `Color` gives
// the name, "light vibrant cyan blue, 60% transparent", in the
// `I18nProvider`'s locale, as React Aria's swatch does on web, and a screen
// reader hears the swatch as an image by that name. A colour with no alpha
// left is called transparent, in the library's own words, since there is no
// colour left to name.

const SIZE = 40

const stylesOf = themedStyles(({ colors, radii }) =>
  StyleSheet.create({
    ground: {
      borderRadius: radii.xs,
      height: SIZE,
      overflow: 'hidden',
      width: SIZE,
    },
    hairline: {
      ...StyleSheet.absoluteFill,
      borderColor: colors.outlineVariant,
      borderRadius: radii.xs,
      borderWidth: 1,
    },
  }),
)

type ColorSwatchProps = Omit<ViewProps, 'children' | 'style'> & {
  /**
   * The colour to show: a CSS colour string, or a `Color` from `parseColor`,
   * which this package re-exports. Left out, the swatch draws the colour of
   * the `ColorSwatchPicker.Item` it is drawn in.
   * @default the item's colour, else '#fff0'
   */
  readonly color?: Color | string
  /**
   * What the swatch is called, in place of the name the colour gives itself.
   * A call site's `aria-label` follows either, after a comma.
   */
  readonly colorName?: string
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
}

/**
 * A colour shown as a value: a square of it, with a chequer behind so
 * transparency reads as transparency. The colour is a CSS string, or a
 * `Color` from `parseColor`, which this package re-exports.
 *
 * ```tsx
 * import { ColorSwatch, parseColor } from '@kanso-labs/react-native-kanso-ui'
 *
 * <ColorSwatch color={parseColor('hsla(200, 100%, 50%, 0.4)')} />
 * ```
 *
 * It names itself from the colour, "light vibrant cyan blue, 60%
 * transparent", in the `I18nProvider`'s locale, or the device's outside one,
 * so it needs no label. Pass `colorName` to say something else instead.
 *
 * `style`, `ref` and `testID` land on the square, and a `style` there applies
 * over the swatch's own, so a call site sets another size with `width` and
 * `height`. The colour fills whatever square it is given.
 */
function ColorSwatch({
  'aria-label': label,
  color,
  colorName,
  style,
  ...props
}: ColorSwatchProps) {
  const styles = stylesOf(useTheme())
  const locale = useLocaleOf(undefined)
  const messages = useMessages()
  const itemColor = use(SwatchColorContext)
  const value = colorOf(color ?? itemColor ?? '#fff0')
  const alpha = value.getChannelValue('alpha')
  const name = colorName ?? colorNameOf(value, locale, messages.transparent)

  return (
    <View
      accessible
      role="img"
      {...props}
      aria-label={[name, label].filter(Boolean).join(', ')}
      style={composeStyles<ViewStyle>(styles.ground, style)}
    >
      {alpha < 1 ? <Chequer /> : null}
      <View
        style={composeStyles<ViewStyle>(StyleSheet.absoluteFill, {
          backgroundColor: value.toString('css'),
        })}
      />
      <View style={styles.hairline} />
    </View>
  )
}

export { ColorSwatch }
export type { ColorSwatchProps }
