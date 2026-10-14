import type { ComponentRef, Ref } from 'react'
import type { ViewProps, ViewStyle } from 'react-native'

import { StyleSheet, View } from 'react-native'

import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// A divider is the same colour as a border, so it draws from outlineVariant
// rather than a role of its own, as on web: the design system treats the two
// as one decision.
//
// Drawn as a filled 1dp view rather than as a border, so the rule is the view
// itself, which flex `gap` and anything measuring it can see.
//
// A rule has no length of its own. `alignSelf: 'stretch'` takes it from the
// parent's cross axis: a horizontal rule spans a column, which is what a
// `View` is by default, and a vertical one spans a row. A rule between two
// rows should match whatever they turn out to be rather than being told a
// length at the call site, and in a parent running the same way as the rule
// it has none, which is the documented cost.
//
// The divider page gives three forms and this draws all three: full width,
// inset by 16dp at the leading end, and middle-inset by 16dp at both. The page
// names them "inset" and "middle-inset"; the prop says `start` and `both`, as
// on web, since the two words say which ends move. The inset is a margin on
// the axis the rule runs along, which shortens a stretched rule rather than
// pushing it out of its parent. A horizontal rule's is `marginStart`, which
// React Native puts on the right under right-to-left.
const styles = StyleSheet.create({
  horizontal: {
    alignSelf: 'stretch',
    flexShrink: 0,
    height: 1,
  },
  vertical: {
    alignSelf: 'stretch',
    flexShrink: 0,
    width: 1,
  },
})

const fillOf = themedStyles(({ colors }) =>
  StyleSheet.create({
    rule: { backgroundColor: colors.outlineVariant },
  }),
)

// The page's 16dp, on the axis the rule runs along.
const insetsOf = themedStyles(({ spacing }) => ({
  horizontal: StyleSheet.create({
    both: { marginEnd: spacing.lg, marginStart: spacing.lg },
    none: {},
    start: { marginStart: spacing.lg },
  }),
  vertical: StyleSheet.create({
    both: { marginBottom: spacing.lg, marginTop: spacing.lg },
    none: {},
    start: { marginTop: spacing.lg },
  }),
}))

// React Native Web writes `aria-orientation` onto the element, which React
// Native's types do not name. A horizontal rule needs none, since that is the
// separator role's own default.
const VERTICAL: { readonly 'aria-orientation': 'vertical' } = {
  'aria-orientation': 'vertical',
}

type SeparatorInset = 'both' | 'none' | 'start'

type SeparatorProps = ViewProps & {
  /**
   * How far the rule is held off the ends it runs between. `start` holds it
   * 16dp off the leading end, which is the page's inset divider; `both` holds
   * it off each end, which is its middle-inset one. The inset follows the
   * writing direction rather than a fixed side.
   * @default 'none'
   */
  readonly inset?: SeparatorInset
  /**
   * Which way the rule runs. A rule takes its length from its parent: a
   * horizontal one spans a column, and a vertical one a row.
   * @default 'horizontal'
   */
  readonly orientation?: 'horizontal' | 'vertical'
  readonly ref?: Ref<ComponentRef<typeof View>>
}

/**
 * A 1dp rule between items, in the outline-variant colour, carrying the
 * separator role.
 *
 * ```tsx
 * <Stack gap="none">
 *   <Text>First item</Text>
 *   <Separator inset="start" />
 *   <Text>Second item</Text>
 * </Stack>
 * ```
 *
 * `inset` holds the rule off the ends it runs between, `start` off the
 * leading one and `both` off each, which is what a rule between list rows
 * takes so it lines up with their text rather than the container's edge.
 *
 * Web draws the rule again as a border under forced colours, which neither
 * iOS nor Android has. `style`, `ref` and `testID` land on the `View`, and a
 * `style` there applies over the rule's own.
 */
function Separator({
  inset = 'none',
  orientation = 'horizontal',
  style,
  ...props
}: SeparatorProps) {
  const theme = useTheme()

  return (
    <View
      role="separator"
      {...(orientation === 'vertical' ? VERTICAL : undefined)}
      {...props}
      style={composeStyles<ViewStyle>(
        styles[orientation],
        fillOf(theme).rule,
        insetsOf(theme)[orientation][inset],
        style,
      )}
    />
  )
}

export type { SeparatorInset, SeparatorProps }

export { Separator }
