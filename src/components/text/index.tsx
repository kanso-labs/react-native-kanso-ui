import type { ComponentRef, Ref } from 'react'
import type { TextProps as NativeTextProps, TextStyle } from 'react-native'

import { useMemo, useState } from 'react'
import { Text as NativeText, Platform, StyleSheet } from 'react-native'

import type { TypeRole } from '../../typography/roles'

import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'
import {
  descentTo,
  TextLineContext,
  TextSizeContext,
} from '../../typography/size'
import { holdsKeycap, sentenceLabel } from '../keycap'

// Tone is a separate axis from variant so the two compose freely: any of the
// fifteen roles in any of these colours, the same set web's Text takes.
// `inherit` sets no colour, so a Text inside another takes the outer one's.
const stylesOf = themedStyles(({ colors }) =>
  StyleSheet.create({
    error: { color: colors.error },
    inherit: {},
    muted: { color: colors.onSurfaceVariant },
    negative: { color: colors.negative },
    neutral: { color: colors.onSurface },
    positive: { color: colors.positive },
    primary: { color: colors.primary },
  }),
)

const styles = StyleSheet.create({
  // A native Text clips what it holds to its own box, and a Keycap on its
  // first or last line can stand a stroke past it.
  unclipped: {
    overflow: 'visible',
  },
})

type TextProps = NativeTextProps & {
  readonly ref?: Ref<ComponentRef<typeof NativeText>>
  /**
   * The colour role to draw in. `neutral` is the on-surface role, as it is on
   * web; `inherit` takes the colour of the Text around it instead of setting
   * one.
   * @default 'neutral'
   */
  readonly tone?:
    | 'error'
    | 'inherit'
    | 'muted'
    | 'negative'
    | 'neutral'
    | 'positive'
    | 'primary'
  /**
   * Which role of the type scale to draw in.
   * @default 'bodyMedium'
   */
  readonly variant?: TypeRole
}

/**
 * A run of text in one role of Material Design's type scale and one colour
 * role, with web's props and values.
 *
 * ```tsx
 * <Text accessibilityRole="header" variant="titleLarge">
 *   Headline
 * </Text>
 * ```
 *
 * Each role reads its family, size, line height, weight and tracking from the
 * theme, so an override of the plain or brand family reaches every role drawn
 * in it. The family is the token's first when the app has registered it with
 * expo-font, and the system font otherwise. The OS text size scales every
 * role, as `allowFontScaling` leaves it.
 *
 * Web's `render` and `block` have no counterpart: a native Text is a block
 * unless it sits inside another, and a heading is an `accessibilityRole`
 * rather than an element. `style`, `ref` and `testID` land on React Native's
 * own Text.
 */
function Text({
  children,
  onTextLayout,
  style,
  tone = 'neutral',
  variant = 'bodyMedium',
  ...props
}: TextProps) {
  const role = useTypeRole(variant)
  const tones = stylesOf(useTheme())
  const [descent, setDescent] = useState<number | undefined>(undefined)
  const plain = typeof children === 'string' || typeof children === 'number'
  // A Keycap on iOS and Android is a view laid in the line, which lowers
  // itself onto the line's baseline, so a Text holding one measures where
  // that is and lets it stand past its own box.
  const keyed = !plain && Platform.OS !== 'web' && holdsKeycap(children)
  const composed = composeStyles<TextStyle>(
    role,
    tones[tone],
    keyed ? styles.unclipped : null,
    style,
  )
  // The size the text ends up at, the call site's over the role's, which a
  // Code or a Keycap inside it sets a share of, and the line height it is
  // set on. Plain text holds neither, so it goes in as it is, and a host
  // Text's children stay the string a call site wrote.
  const flat = StyleSheet.flatten(composed)
  const size = flat?.fontSize
  const height = flat?.lineHeight
  const line = useMemo(() => ({ descent, height }), [descent, height])
  // A Keycap is an inline View, whose name a native screen reader leaves out
  // of the sentence, so a Text holding one says the sentence itself unless
  // the call site has labelled it.
  const label =
    props.accessibilityLabel ??
    (props['aria-label'] === undefined ? sentenceLabel(children) : undefined)

  return (
    <NativeText
      {...props}
      accessibilityLabel={label}
      onTextLayout={keyed ? descentTo(setDescent, onTextLayout) : onTextLayout}
      style={composed}
    >
      {plain ? (
        children
      ) : (
        <TextSizeContext value={size}>
          <TextLineContext value={line}>{children}</TextLineContext>
        </TextSizeContext>
      )}
    </NativeText>
  )
}

export type { TextProps }

export { Text }
