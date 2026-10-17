import type { ComponentRef, ReactNode, Ref } from 'react'
import type { TextStyle, ViewProps, ViewStyle } from 'react-native'

import { isValidElement } from 'react'
import { Text as NativeText, Platform, StyleSheet, View } from 'react-native'

import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useFontFamily } from '../../typography/fonts'
import { familyStyle } from '../../typography/roles'
import { useTextSize } from '../../typography/size'

// kanso-ui's Keycap: one key on a keyboard, as an instruction names it, drawn
// as a small outlined cap in the line of text around it. A chord or a path
// through a menu is several of them, with the sentence's own words between.
//
// No Material Design page draws a key, so it keeps web's reading of the chips
// spec page: the assist chip's 1dp rule in the outline role, and the
// extra-small corner rather than the chip's small one, since a box the height
// of a line has no room for 8dp. No fill, so a keycap inside a Card or a Sheet
// does not read as a nested surface. The text is on surface in the mono face,
// at 0.8125 of the size around it on a 1.4 line height, a share smaller than
// Code's because the rule adds height the glyphs do not, and on one line,
// since 'Enter' broken across two stops reading as one key.
//
// A Text nested in another draws no border on iOS or Android, so the cap is a
// View laid inline in the Text around it, which both platforms place on the
// line, holding a Text of its own. Its size is the share of the one the
// library's Text provides, as Code's is, and body medium's outside a Text.
//
// **iOS and Android stand an inline View on the baseline by its bottom edge**,
// where React Native Web lays one out as an `inline-flex` box, which shares
// its text's baseline with the line. So on native the cap is moved down by
// how far its own baseline sits above its bottom edge: the 1dp rule, half the
// leading the 1.4 line height adds, and the face's descent. The figures are
// Roboto Mono's, the mono token's first family, measured in Chromium from the
// face kanso-ui ships: 1.048em of ascent and 0.271em of descent, so 1.319em of
// glyph box in a 1.4em line, and the baseline 0.3115em above the line box's
// bottom. Neither platform's own placement has been measured on a device yet.
//
// A screen reader on iOS or Android reads the Text around the cap as one
// element whose words leave the cap out, since an inline View is not text. So
// the cap is hidden from it there, and the library's Text, when a Keycap is
// among its children, speaks the sentence with the key's name in its place,
// through `sentenceLabel` below. React Native Web reads the cap in its place
// in the sentence as it is.

// The size against the text around it, web's `0.8125em`.
const SHARE = 0.8125

// The line height against the cap's own size, web's `1.4`.
const LINE = 1.4

// Roboto Mono's ascent and descent against its size.
const ASCENT = 1.048
const DESCENT = 0.271

// The rule around the cap, web's `1px`.
const RULE = 1

// How far the cap's baseline sits above its bottom edge at a size: the rule,
// half the leading and the descent.
function baselineOf(size: number) {
  return RULE + ((LINE - ASCENT - DESCENT) / 2 + DESCENT) * size
}

const styles = StyleSheet.create({
  // A cap standing on its own shrinks to its key rather than stretching
  // across the column it sits in.
  alone: {
    alignSelf: 'flex-start',
  },
})

// Kept from a screen reader on iOS and Android, where the Text around the cap
// speaks its key instead.
const HIDDEN: ViewProps = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
}

const stylesOf = themedStyles(({ colors, radii, spacing }) =>
  StyleSheet.create({
    cap: {
      borderColor: colors.outline,
      borderRadius: radii.xs,
      borderWidth: RULE,
      paddingHorizontal: spacing.xxs,
    },
    text: {
      color: colors.onSurface,
    },
  }),
)

type KeycapProps = Omit<ViewProps, 'children'> & {
  /** The key's name, as the instruction writes it, such as `Enter` or `Esc`. */
  readonly children?: ReactNode
  readonly ref?: Ref<ComponentRef<typeof View>>
}

// Whether a Keycap is among the nodes, at any depth.
function holdsKeycap(node: ReactNode): boolean {
  if (Array.isArray(node)) {
    return node.some((part: ReactNode) => holdsKeycap(part))
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return false
  }
  return node.type === Keycap || holdsKeycap(node.props.children)
}

/**
 * A single key on a keyboard, as an instruction names it: `Enter`, `Esc`,
 * `Ctrl`. A chord is several of these, combined at the call site.
 *
 * ```tsx
 * <Text variant="bodyLarge">
 *   Press <Keycap>Esc</Keycap> to dismiss
 * </Text>
 * ```
 *
 * It takes its size from the Text around it, so a key named in a heading and
 * one named in a footnote are the same component, and stays part of that
 * Text's sentence to a screen reader. `style`, `ref` and `testID` land on the
 * cap's `View`, and a `style` there applies over its own.
 */
function Keycap({ children, style, ...props }: KeycapProps) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const around = useTextSize()
  const mono = useFontFamily(theme.typography.fontFamilyMono)
  const size = (around ?? theme.typography.bodyMediumSize) * SHARE
  const inline = around !== undefined
  const native = Platform.OS !== 'web'
  const lowered: null | ViewStyle =
    inline && native ? { transform: [{ translateY: baselineOf(size) }] } : null

  return (
    <View
      {...(inline && native ? HIDDEN : null)}
      {...props}
      style={composeStyles<ViewStyle>(
        own.cap,
        inline ? null : styles.alone,
        lowered,
        style,
      )}
    >
      <NativeText
        numberOfLines={1}
        style={composeStyles<TextStyle>(own.text, familyStyle(mono), {
          fontSize: size,
          lineHeight: size * LINE,
        })}
      >
        {children}
      </NativeText>
    </View>
  )
}

/**
 * The words a Text holding a Keycap says to a screen reader on iOS and
 * Android, with each key's name in its place, or `undefined` for one holding
 * no Keycap, or anything whose words cannot be read off its children.
 */
function sentenceLabel(children: ReactNode): string | undefined {
  if (Platform.OS === 'web' || !holdsKeycap(children)) {
    return undefined
  }
  return spoken(children) ?? undefined
}

// What a node says in a sentence, with each Keycap's name in its place, or
// `null` where it holds something whose words cannot be read off its
// children, such as a component that draws its own text or one that presses,
// which the Text around it then leaves to the platform.
function spoken(node: ReactNode): null | string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return ''
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    const parts = node.map((part: ReactNode) => spoken(part))
    return parts.includes(null) ? null : parts.join('')
  }
  if (!isValidElement<{ children?: ReactNode; onPress?: unknown }>(node)) {
    return null
  }
  if (node.props.onPress !== undefined || node.props.children === undefined) {
    return null
  }
  return spoken(node.props.children)
}

export type { KeycapProps }

export { Keycap, sentenceLabel }
