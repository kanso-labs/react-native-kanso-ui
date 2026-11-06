import type { ComponentRef, ReactNode, Ref } from 'react'
import type { TextStyle, ViewProps, ViewStyle } from 'react-native'

import { isValidElement, useState } from 'react'
import { Text as NativeText, Platform, StyleSheet, View } from 'react-native'

import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useFontFamily } from '../../typography/fonts'
import { familyStyle } from '../../typography/roles'
import { descentTo, useTextLine, useTextSize } from '../../typography/size'

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
// Neither platform lines an inline View up with the text around it by its
// baseline, as React Native Web does with the `inline-flex` box it lays one
// out as, so on native the cap is moved down onto the sentence's baseline,
// by what React Native's own source says of where it puts the View and what
// the two Texts measure of where their baselines are:
//
// - Android stands the View's bottom edge on the line's baseline, so the cap
//   moves down by how far its own baseline sits above its bottom: the 1dp
//   rule and the descent its Text measures, which takes in half the leading
//   the 1.4 line height adds.
// - iOS stands it 2.76pt above the bottom of the line, the descent of the
//   font of the character holding it, which has none of its own, so
//   TextKit's default of 12pt Helvetica: measured on an iPhone, the gap was
//   2.67pt at every size, on its 3x grid. So the cap moves down by that gap
//   and its own baseline's height, less how far the sentence's baseline sits
//   above the bottom of its line, which the library's Text measures around a
//   Keycap.
//
// Both measurements are of the faces actually drawn, so a mono family an app
// registers moves the cap with it. Until the two Texts have been laid out the
// cap is placed by the system font's figures, measured on an iPhone, which
// came within 0.6pt of the measured place there. The cap can stand a stroke
// past the first or last line, so the library's Text around it does not clip
// what it holds.
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

// The system font's descent and line against its size, SF Pro's and SF
// Mono's alike on an iPhone, for the place a cap takes before its Text and
// the one around it have been laid out.
const DESCENT = 0.2412
const NATURAL = 1.1934

// How far above the bottom of a line iOS stands the bottom edge of a View laid
// in it.
const IOS_GAP = 2.76

// The rule around the cap, web's `1px`.
const RULE = 1

// How far a line's baseline sits above its bottom in the system font: the
// descent and half the room a line taller than the font leaves, which React
// Native puts half above the glyphs and half below.
function descentOf(size: number, line: number) {
  return DESCENT * size + Math.max(line - NATURAL * size, 0) / 2
}

/**
 * How far a cap moves down to meet the sentence's baseline, from how far its
 * own baseline and the sentence's sit above the bottoms of their lines.
 */
function loweringOf(own: number, around: number) {
  return Platform.OS === 'ios' ? IOS_GAP + RULE + own - around : RULE + own
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
  const line = useTextLine()
  const mono = useFontFamily(theme.typography.fontFamilyMono)
  // How far the key's baseline sits above the bottom of its line, once its
  // Text has been laid out.
  const [descent, setDescent] = useState<number | undefined>(undefined)
  const size = (around ?? theme.typography.bodyMediumSize) * SHARE
  const inline = around !== undefined
  const native = Platform.OS !== 'web'
  const lowered: null | ViewStyle =
    inline && native
      ? {
          transform: [
            {
              translateY: loweringOf(
                descent ?? descentOf(size, size * LINE),
                line?.descent ??
                  descentOf(around, line?.height ?? around * NATURAL),
              ),
            },
          ],
        }
      : null

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
        onTextLayout={inline && native ? descentTo(setDescent) : undefined}
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

export { holdsKeycap, Keycap, sentenceLabel }
