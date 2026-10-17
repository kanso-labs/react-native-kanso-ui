import type { ComponentRef, ReactNode, Ref } from 'react'
import type { ViewProps, ViewStyle } from 'react-native'

import { StyleSheet, View } from 'react-native'

import type { WindowSizeClass } from '../../hooks/useWindowSizeClass'

import { useWindowSizeClass } from '../../hooks/useWindowSizeClass'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// kanso-ui's SupportingPane, Material Design's supporting pane canonical
// layout. The supporting pane holds content that only means anything next to
// the main pane, such as comments, related items or a tool panel, which is
// what separates it from list-detail, where the second pane stands on its own.
//
// The page gives the layout two shapes. Below the expanded window size the
// supporting pane is stacked under the main one, which is Material Design's
// reflow strategy; the page's other compact option, a bottom sheet, is
// Sheet's job at the call site. From expanded up, 840dp, the supporting pane
// stands beside the main one at a fixed 360dp and the main pane takes the
// rest. Native has no media queries, so the shape follows
// `useWindowSizeClass()`, as ListDetail's does.
//
// **Which side the supporting pane takes is a choice of the side-by-side
// shape alone.** The page puts it below the focus pane in medium windows and
// under, and "on the leading or trailing side of the focus pane" from
// expanded up, so `placement` moves the pane beside the main one and leaves
// the stacked shape alone.
//
// **The main pane is first in the tree in both shapes, and a leading pane is
// drawn before it by reversing the row.** That is web's departure too, for
// web's reason: the page asks that the reading order match the arrangement
// on screen, and no one order of the panes satisfies both of its rules. A
// supporting pane written first would read before the main one when the
// layout stacks, which is the one arrangement the page rules out, so the
// break lands side by side instead, where a screen reader reaches the main
// pane before the leading one drawn at its start.
//
// Both panes stay mounted in the same places in the tree in both shapes, so
// a rotation or an unfolding keeps what either holds. A row runs from the
// start edge, so under a right-to-left layout leading is the right-hand side,
// with nothing here turning it over.

// Material Design's width for the supporting pane, beside the main one.
const SUPPORTING_PANE = 360

// The window sizes with room for both panes side by side.
const BESIDE: ReadonlySet<WindowSizeClass> = new Set([
  'expanded',
  'extraLarge',
  'large',
])

const styles = StyleSheet.create({
  leading: {
    flexDirection: 'row-reverse',
  },
  // The main pane beside the supporting one: whatever the fixed pane leaves,
  // which a long unbroken line inside cannot widen past its share.
  main: {
    flex: 1,
    minWidth: 0,
  },
  supporting: {
    width: SUPPORTING_PANE,
  },
  trailing: {
    flexDirection: 'row',
  },
})

// The 24dp between the panes, web's `spacing.xl`, in either shape.
const stylesOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    root: {
      gap: spacing.xl,
    },
  }),
)

type SupportingPaneProps = Omit<ViewProps, 'children'> & {
  /**
   * The primary content. Takes whatever width the supporting pane leaves from
   * the expanded window size up.
   */
  readonly main?: ReactNode
  /**
   * Which side of the main pane the supporting one takes from the expanded
   * window size up. Below it the layout stacks either way, with the
   * supporting pane under the main one.
   * @default 'trailing'
   */
  readonly placement?: 'leading' | 'trailing'
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * Content that only means something beside `main`. Sits below it in a
   * compact or medium window, and beside it at a fixed 360dp from the
   * expanded window size up.
   */
  readonly supporting?: ReactNode
}

/**
 * Material Design's supporting pane layout: a main pane and a companion that
 * reflows underneath it when there is no room beside it.
 *
 * ```tsx
 * <SupportingPane main={<Article />} supporting={<Related />} />
 * ```
 *
 * Layout only: neither pane paints a surface or a border of its own, so what
 * goes in them is composed at the call site out of Cards, lists or plain
 * content. The main pane comes first in the tree in both shapes, so a screen
 * reader reaches it before the content that supports it.
 *
 * `style`, `ref` and `testID` land on the outer `View`, and a `style` there
 * applies over the layout's own.
 */
function SupportingPane({
  main,
  placement = 'trailing',
  style,
  supporting,
  ...props
}: SupportingPaneProps) {
  const own = stylesOf(useTheme())
  const beside = BESIDE.has(useWindowSizeClass())
  const row = placement === 'leading' ? styles.leading : styles.trailing

  return (
    <View
      {...props}
      style={composeStyles<ViewStyle>(own.root, beside ? row : null, style)}
    >
      <View style={beside ? styles.main : null}>{main}</View>
      <View style={beside ? styles.supporting : null}>{supporting}</View>
    </View>
  )
}

export type { SupportingPaneProps }

export { SupportingPane }
