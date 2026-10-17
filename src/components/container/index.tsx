import type { ComponentRef, Ref } from 'react'
import type { ViewProps, ViewStyle } from 'react-native'

import { StyleSheet, View } from 'react-native'

import { useWindowSizeClass } from '../../hooks/useWindowSizeClass'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// The measure kanso-ui's Container takes by default, the width its own story
// files centre their page on. A measure is a property of the content: 960dp
// suits a page of mixed components, and prose wants something narrower. Say
// which one you mean rather than taking this.
const DEFAULT_MAX_INLINE_SIZE = 960

// No Material Design page draws a page container; the layout pages give the
// margins one keeps. The gutter is the margin those pages give a window of
// each size, 16dp while the window is compact and 24dp from medium up, read
// off the window's size class as web reads it off a media query. The measure
// is the call site's, since the pages leave a pane's width to its content.
//
// The container fills the width it is given up to its measure and stands in
// the middle of what is left, `alignSelf` doing what web's `marginInline:
// auto` does, so it centres in a column whatever the column aligns its other
// children to.
const styles = StyleSheet.create({
  root: {
    alignSelf: 'center',
    width: '100%',
  },
})

const stylesOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    compact: {
      paddingHorizontal: spacing.lg,
    },
    none: {
      paddingHorizontal: 0,
    },
    wider: {
      paddingHorizontal: spacing.xl,
    },
  }),
)

type ContainerPadding = 'default' | 'none'

type ContainerProps = ViewProps & {
  /**
   * How wide the content may run before it stops growing, in dp or as a
   * share of the width it is given. The container stands in the middle of
   * whatever is left over.
   *
   * Worth setting. The default suits a page of mixed components; prose wants
   * a narrower measure, since what makes a line hard to read is how many
   * characters it holds.
   * @default 960
   */
  readonly maxInlineSize?: `${number}%` | number
  /**
   * Horizontal padding, which is what keeps the content off the edge of the
   * window once it is narrower than the measure: 16dp in a compact window and
   * 24dp from medium up. `none` is for a container nested inside one that
   * already has it.
   * @default 'default'
   */
  readonly padding?: ContainerPadding
  readonly ref?: Ref<ComponentRef<typeof View>>
}

/**
 * A centred measure for a screen or a section of one: content grows to a
 * width and stops, with the leftover space split evenly either side.
 *
 * ```tsx
 * <Container maxInlineSize={600}>
 *   <Text>Supporting line</Text>
 * </Container>
 * ```
 *
 * Layout only: it paints no surface and gives its children no container of
 * their own, which is what separates it from Card. It sets no gaps either, so
 * reach for Stack inside it for the rhythm between sections.
 *
 * `style`, `ref` and `testID` land on the `View`, and a `style` there applies
 * over the container's own.
 */
function Container({
  maxInlineSize = DEFAULT_MAX_INLINE_SIZE,
  padding = 'default',
  style,
  ...props
}: ContainerProps) {
  const own = stylesOf(useTheme())
  const sizeClass = useWindowSizeClass()
  const padded =
    padding === 'none'
      ? own.none
      : sizeClass === 'compact'
        ? own.compact
        : own.wider

  return (
    <View
      {...props}
      style={composeStyles<ViewStyle>(
        styles.root,
        measureOf(maxInlineSize),
        padded,
        style,
      )}
    />
  )
}

/**
 * The measure as a style. Built by a call rather than written inline, which
 * is what react-perf's jsx-no-new-object-as-prop is after; the React Compiler
 * memoises the result on its input.
 */
function measureOf(maxWidth: ContainerProps['maxInlineSize']): ViewStyle {
  return { maxWidth }
}

export type { ContainerPadding, ContainerProps }

export { Container }
