import type { ComponentRef, Ref } from 'react'
import type { ViewProps, ViewStyle } from 'react-native'

import { StyleSheet, View } from 'react-native'

import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// Short names rather than the flex values they map to, as on web, so a call
// site reads `align="start"` instead of `align="flex-start"`.
//
// No Material Design page draws a stack. Its gaps are the spacing tokens, the
// 4dp grid the layout pages space elements on, and `xl` is their 24dp spacer
// between panes.
//
// `start` and `end` are logical. React Native lays a row out from the start
// edge of the writing direction, so under right-to-left, whether the app's
// through `I18nManager` or a `direction` style on a view around it, a row runs
// from the right and `start` is the right-hand edge. Nothing here reverses a
// row to get that, which is what keeps it so.
const alignments = StyleSheet.create({
  baseline: { alignItems: 'baseline' },
  center: { alignItems: 'center' },
  end: { alignItems: 'flex-end' },
  start: { alignItems: 'flex-start' },
  stretch: { alignItems: 'stretch' },
})

const directions = StyleSheet.create({
  column: { flexDirection: 'column' },
  row: { flexDirection: 'row' },
})

const justifications = StyleSheet.create({
  around: { justifyContent: 'space-around' },
  between: { justifyContent: 'space-between' },
  center: { justifyContent: 'center' },
  end: { justifyContent: 'flex-end' },
  start: { justifyContent: 'flex-start' },
})

const styles = StyleSheet.create({
  wrap: { flexWrap: 'wrap' },
})

// One key per step of the spacing scale, named as the token group names it,
// so `gaps[gap]` indexes straight off the prop. `none` is the one key with no
// token behind it: zero is the absence of a spacing decision rather than a
// step of the scale.
const gapsOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    lg: { gap: spacing.lg },
    md: { gap: spacing.md },
    none: { gap: 0 },
    sm: { gap: spacing.sm },
    xl: { gap: spacing.xl },
    xs: { gap: spacing.xs },
    xxl: { gap: spacing.xxl },
    xxs: { gap: spacing.xxs },
    xxxl: { gap: spacing.xxxl },
  }),
)

type StackAlign = 'baseline' | 'center' | 'end' | 'start' | 'stretch'

type StackGap =
  | 'lg'
  | 'md'
  | 'none'
  | 'sm'
  | 'xl'
  | 'xs'
  | 'xxl'
  | 'xxs'
  | 'xxxl'

type StackJustify = 'around' | 'between' | 'center' | 'end' | 'start'

type StackProps = ViewProps & {
  /**
   * How the children line up across the stack: along the width of a column,
   * along the height of a row. Left unset, they stretch, which is what makes
   * every card in a column the same width.
   *
   * `start` is what a child sized to its content needs in a column, which
   * spans the whole width otherwise.
   */
  readonly align?: StackAlign
  /**
   * Which way the children run.
   * @default 'column'
   */
  readonly direction?: 'column' | 'row'
  /**
   * The space between children, as a step of the spacing scale. `none` closes
   * it entirely.
   *
   * Worth setting. The default is a middle step, and how much air a group of
   * things wants is the one thing a stack cannot work out for itself.
   * @default 'md'
   */
  readonly gap?: StackGap
  /**
   * How leftover space is distributed along the stack. Left unset, the
   * children sit at the start and the space collects after them.
   *
   * `between` is the one that puts a headline at one end of a row and its
   * actions at the other.
   */
  readonly justify?: StackJustify
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * Lets a row wrap onto further lines rather than overflowing. Has no effect
   * on a column, which has as many lines as it has children.
   * @default false
   */
  readonly wrap?: boolean
}

/**
 * A row or a column of children with one gap between them, taken from the
 * spacing scale.
 *
 * ```tsx
 * <Stack align="center" direction="row" gap="sm">
 *   <Text>Label</Text>
 *   <Text tone="muted">Supporting line</Text>
 * </Stack>
 * ```
 *
 * Layout only: it paints no surface and wraps no child, so each child is a
 * flex item exactly as it was written. It is the answer to spacing a group of
 * things, which is why no component here carries a margin of its own: the
 * space between two things belongs to whatever holds both of them.
 *
 * Web's `render` has no counterpart, since a native view is a `View` whatever
 * it holds. `style`, `ref` and `testID` land on that `View`, and a `style`
 * there applies over the stack's own.
 */
function Stack({
  align,
  direction = 'column',
  gap = 'md',
  justify,
  style,
  wrap = false,
  ...props
}: StackProps) {
  const gaps = gapsOf(useTheme())

  return (
    <View
      {...props}
      style={composeStyles<ViewStyle>(
        directions[direction],
        gaps[gap],
        align === undefined ? undefined : alignments[align],
        justify === undefined ? undefined : justifications[justify],
        wrap ? styles.wrap : undefined,
        style,
      )}
    />
  )
}

export type { StackAlign, StackGap, StackJustify, StackProps }

export { Stack }
