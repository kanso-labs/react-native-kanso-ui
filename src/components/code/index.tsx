import type { ComponentRef, Ref } from 'react'
import type { TextProps as NativeTextProps, TextStyle } from 'react-native'

import { Text as NativeText, StyleSheet } from 'react-native'

import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useFontFamily } from '../../typography/fonts'
import { familyStyle, useTypeRole } from '../../typography/roles'
import { TextSizeContext, useTextSize } from '../../typography/size'

// kanso-ui's Code. No Material Design page draws inline code, so it follows
// web's reading, which follows the type it interrupts: the role and the colour
// of the text around it, in the mono face the type tokens carry, at 0.875 of
// its size. A mono face at the same nominal size as the prose around it reads
// a little larger, its glyphs being wider and its x-height taller, so the
// ratio is what makes the two look level rather than what makes them measure
// the same.
//
// No background, as on web. The mono face against the faces the rest of the
// system uses is already the signal, and a tint would put a second surface
// inside a Card or a Sheet. A call site wanting one can wrap this.
//
// It is a native Text nested in the one it interrupts, which hands it the
// colour, the weight, the line height and the tracking with nothing set here.
// The size is the one it cannot take as it stands, since 0.875 of a size needs
// the number and a nested Text cannot read its parent's, so the library's Text
// provides the size it ends up at and this sets the share of it. Outside a
// Text there is no text around to take anything from, so it draws as a Text
// of the default role and tone would, in body medium on surface, at the same
// share of body medium's size. Inside some other component's text, which
// provides no size, it does the same, so nest it in a Text.
//
// React Native has no `overflow-wrap: anywhere`. iOS and Android break a word
// wider than its line between characters rather than letting it run past the
// edge, and React Native Web's Text sets `overflow-wrap: break-word`, so a
// package path or a hash still stays inside its container, breaking at the
// hyphens and slashes in it where a line allows. The LongIdentifier story
// shows it.

// The size against the text around it, web's `0.875em`.
const SHARE = 0.875

const stylesOf = themedStyles(({ colors }) =>
  StyleSheet.create({
    // The colour of a Text's default tone, for a Code with no text around it.
    outside: {
      color: colors.onSurface,
    },
  }),
)

type CodeProps = NativeTextProps & {
  readonly ref?: Ref<ComponentRef<typeof NativeText>>
}

/**
 * A fragment of code, a path or an identifier set in the mono face, inside a
 * run of text.
 *
 * ```tsx
 * <Text variant="bodyLarge">
 *   A sentence naming <Code>identifier</Code>
 * </Text>
 * ```
 *
 * It takes its colour from the Text around it and 0.875 of its size, so the
 * same Code serves a heading and a footnote. `style`, `ref` and `testID` land
 * on React Native's own Text, and a `style` there applies over the face and
 * the size.
 */
function Code({ children, style, ...props }: CodeProps) {
  const theme = useTheme()
  const around = useTextSize()
  const body = useTypeRole('bodyMedium')
  const mono = useFontFamily(theme.typography.fontFamilyMono)
  const outside = around === undefined
  const size = (around ?? theme.typography.bodyMediumSize) * SHARE

  return (
    <NativeText
      {...props}
      style={composeStyles<TextStyle>(
        outside ? body : null,
        outside ? stylesOf(theme).outside : null,
        familyStyle(mono),
        { fontSize: size },
        style,
      )}
    >
      <TextSizeContext value={size}>{children}</TextSizeContext>
    </NativeText>
  )
}

export type { CodeProps }

export { Code }
