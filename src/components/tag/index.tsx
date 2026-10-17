import type { ComponentRef, ReactNode, Ref } from 'react'
import type { StyleProp, TextStyle, ViewProps, ViewStyle } from 'react-native'

import { Children } from 'react'
import { Text as NativeText, StyleSheet, View } from 'react-native'

import type { IconStyle } from '../../glyphs/icon-style'

import { IconStyleContext } from '../../glyphs/icon-style'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// A tag states something about what it sits beside, such as a count, a status
// or a version, and is never itself the thing you press. That is the whole
// line between this and Chip: a chip is a two-state button, so reaching for
// one to draw a read-only label puts a control in the accessibility tree that
// nothing can operate. The view takes no press and no role.
//
// Both variants carry a 1dp border, and `filled` makes it transparent rather
// than dropping it, so a tag is the same size either way. Emphasising one tag
// in a row otherwise nudges its neighbours by a dp each side.
//
// Tabular figures are unconditional, for the same reason Currency sets them:
// what ends up in a tag is mostly numeric, such as counts, versions and ports,
// and a stack of them down a list wobbles on proportional digits. Text that
// carries no digits is unaffected.
//
// No Material Design page draws a tag, as on web. The badges page's large
// badge is the nearest, a label-small count on an 8dp corner, and that is the
// type and the corner here. A tag stands beside a word rather than on an icon,
// so it takes the padding and the 1dp rule above in place of the badge's 16dp
// box, and the container roles in place of the badge's error pair, since it
// names a state rather than flagging one.
//
// A tag labels something else, so it is never what makes a row wrap or
// shrink: `flexShrink: 0` holds its width, and its label stays on one line.
const styles = StyleSheet.create({
  label: {
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },
})

const stylesOf = themedStyles(({ radii, spacing }) =>
  StyleSheet.create({
    base: {
      alignItems: 'center',
      borderRadius: radii.sm,
      borderWidth: 1,
      flexDirection: 'row',
      flexShrink: 0,
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
    },
  }),
)

// `neutral` draws from the surface roles rather than a colour of its own,
// which is what lets it state something without ranking it. The other three
// name a direction, and are the same three Currency uses, plus primary for the
// notable-but-not-good-or-bad case.
//
// Outlined takes the tone at full strength for both the rule and the text,
// rather than the on-container pairing filled uses. There is no container
// there for an on-colour to be legible against, since the surface is the
// background, so the container roles would read as washed out.
const tonesOf = themedStyles(({ colors }) => ({
  filled: {
    negative: toneOf(
      colors.negativeContainer,
      'transparent',
      colors.onNegativeContainer,
    ),
    neutral: toneOf(
      colors.surfaceContainerHighest,
      'transparent',
      colors.onSurfaceVariant,
    ),
    positive: toneOf(
      colors.positiveContainer,
      'transparent',
      colors.onPositiveContainer,
    ),
    primary: toneOf(
      colors.primaryContainer,
      'transparent',
      colors.onPrimaryContainer,
    ),
  },
  outlined: {
    negative: toneOf('transparent', colors.negative, colors.negative),
    neutral: toneOf(
      'transparent',
      colors.outlineVariant,
      colors.onSurfaceVariant,
    ),
    positive: toneOf('transparent', colors.positive, colors.positive),
    primary: toneOf('transparent', colors.primary, colors.primary),
  },
}))

type TagProps = ViewProps & {
  /**
   * What the tag says. A string or a number is drawn as its label, and runs
   * of them as one label; anything else, such as an icon, is drawn as given,
   * handed the tag's colour and size through `useIconStyle()`.
   */
  readonly children?: ReactNode
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * Which colour role the tag carries. `neutral` states without ranking; the
   * other three read as good, bad, or worth noticing.
   *
   * Each is a container under its own on-colour, legible on the surface
   * family, which is what the library's own tokens and every demo scheme are
   * held to. Over a container of its own the pair is one colour family on top
   * of another and is not guaranteed, so a custom theme placing a tag there
   * has to check that pair itself.
   * @default 'neutral'
   */
  readonly tone?: TagTone
  /**
   * How much weight the tag pulls. `filled` sits on a container of its own;
   * `outlined` is a rule on the surface, for a tag that should not compete
   * with the thing it labels.
   * @default 'filled'
   */
  readonly variant?: TagVariant
}

type TagTone = 'negative' | 'neutral' | 'positive' | 'primary'

type TagVariant = 'filled' | 'outlined'

/**
 * The children in order, with each run of strings and numbers drawn as one
 * label, so `{count} items` is one Text rather than three. A React Native
 * string has to sit inside a Text, and anything else is drawn as given. A
 * label is keyed by where it falls among what is drawn, which a render of the
 * same children always repeats.
 */
function contentOf(
  children: ReactNode,
  label: StyleProp<TextStyle>,
): ReactNode[] {
  const content: ReactNode[] = []
  let text: string | undefined

  const flush = () => {
    if (text !== undefined) {
      content.push(
        <NativeText
          key={`label-${String(content.length)}`}
          numberOfLines={1}
          style={label}
        >
          {text}
        </NativeText>,
      )
      text = undefined
    }
  }

  for (const child of Children.toArray(children)) {
    if (
      typeof child === 'string' ||
      typeof child === 'number' ||
      typeof child === 'bigint'
    ) {
      text = (text ?? '') + String(child)
    } else {
      flush()
      content.push(child)
    }
  }
  flush()

  return content
}

/**
 * The colour and size the tag hands an icon beside its label. Built by a call
 * rather than written inline, which is what react-perf's
 * jsx-no-new-object-as-prop is after; the React Compiler memoises the result
 * on its inputs.
 */
function iconStyleOf(color: string, size: number): IconStyle {
  return { color, size }
}

/**
 * A short, read-only label attached to something else, such as a count or a
 * status beside a row's headline. It takes no press: for a label that can be
 * selected, reach for Chip.
 *
 * ```tsx
 * <ListItem trailing={<Tag tone="positive">Label</Tag>}>Headline</ListItem>
 * ```
 *
 * The label is set in label small with tabular figures, on one line. An icon
 * given beside it is drawn at the label's line height in the label's colour,
 * so a tag with an icon is the same height as one without. A screen reader
 * reads the label where the tag sits; the tag adds no role of its own.
 *
 * Like any view, a tag stretches across a column it sits in on its own, so a
 * call site placing one there sets `alignSelf`. A row slot, such as
 * ListItem's trailing one, already holds it at its own width.
 *
 * `style`, `ref` and `testID` land on the `View`, and a `style` there applies
 * over the tag's own.
 */
function Tag({
  children,
  style,
  tone = 'neutral',
  variant = 'filled',
  ...props
}: TagProps) {
  const theme = useTheme()
  const role = useTypeRole('labelSmall')
  const toned = tonesOf(theme)[variant][tone]

  return (
    <View
      {...props}
      style={composeStyles<ViewStyle>(
        stylesOf(theme).base,
        toned.container,
        style,
      )}
    >
      <IconStyleContext
        value={iconStyleOf(
          toned.content,
          theme.typography.labelSmallLineHeight,
        )}
      >
        {contentOf(
          children,
          composeStyles<TextStyle>(role, styles.label, toned.label),
        )}
      </IconStyleContext>
    </View>
  )
}

/**
 * One tone's styles: the container's fill and rule, the label's colour, and
 * that colour on its own for an icon beside the label.
 */
function toneOf(background: string, border: string, content: string) {
  return {
    content,
    ...StyleSheet.create({
      container: { backgroundColor: background, borderColor: border },
      label: { color: content },
    }),
  }
}

export type { TagProps, TagTone, TagVariant }

export { Tag }
