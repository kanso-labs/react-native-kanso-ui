import type { ComponentRef, ReactNode, Ref } from 'react'
import type { ViewProps, ViewStyle } from 'react-native'

import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { WindowSizeClass } from '../../hooks/useWindowSizeClass'

import { useWindowSizeClass } from '../../hooks/useWindowSizeClass'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// kanso-ui's ListDetail, Material Design's list-detail canonical layout. The
// list is the fixed pane, which Material Design points at lists with light
// information density, and the detail the flexible one that takes whatever
// is left, so the layout carries the one flexible pane the page asks every
// layout for. Web's shape differs in two ways, on purpose.
//
// **The window decides.** Native has no container queries, so the form
// follows `useWindowSizeClass()`: both panes from the expanded window size,
// 840dp, which a tablet held either way and an unfolded foldable reach, and
// below it the one pane `showing` names. Both panes stay mounted in both
// forms, in the same places in the tree, so a rotation or an unfolding moves
// between the two without losing anything inside either, the selected item
// and a scroll position among them.
//
// **The layout is a screen's.** On a phone the two panes are two steps of
// the app's navigation, so the router owns the step back, and Android's back
// gesture and iOS's swipe go through it rather than through anything here.
// The layout grows to fill the screen it is given, and each pane is a
// `SafeAreaView`, which pads by the system bars, the notch and the rounded
// corners only where that pane meets them. That is measured where the pane
// is rather than read from the window: under an app bar a pane takes no top
// inset, and beside its neighbour none at that edge.
//
// A row runs from the start edge, so under a right-to-left layout the list is
// on the right and the detail on the left, with nothing here turning it over.

// Material Design's widths for a fixed pane, the wider from the extra-large
// window size up.
const LIST_PANE = 360
const LIST_PANE_EXTRA_LARGE = 412

// The window sizes with room for both panes.
const BOTH: ReadonlySet<WindowSizeClass> = new Set([
  'expanded',
  'extraLarge',
  'large',
])

const styles = StyleSheet.create({
  // The flexible pane, which a long unbroken line inside cannot widen past
  // its share.
  flexible: {
    flex: 1,
    minWidth: 0,
  },
  // Out of the layout and, with `aria-hidden` beside it, out of what a
  // screen reader reaches, while staying mounted.
  hidden: {
    display: 'none',
  },
  list: {
    width: LIST_PANE,
  },
  listExtraLarge: {
    width: LIST_PANE_EXTRA_LARGE,
  },
  safeArea: {
    flexGrow: 1,
  },
})

// The 24dp Material Design puts between the panes. The layout grows rather
// than taking `flex: 1`, so it fills a screen and is as tall as its panes
// anywhere with no height to fill.
const stylesOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    root: {
      flexDirection: 'row',
      flexGrow: 1,
      gap: spacing.xl,
    },
  }),
)

type ListDetailProps = Omit<ViewProps, 'children'> & {
  /**
   * The selected item's content. It stands on its own, and takes the
   * flexible pane.
   */
  readonly detail?: ReactNode
  /**
   * The items to choose between. It takes the fixed pane, 360dp wide, and
   * 412dp from the extra-large window size up.
   */
  readonly list?: ReactNode
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * Which pane shows while only one fits, below the expanded window size.
   * Both show from expanded up, where this is not read.
   *
   * Controlled, with no fallback of its own: the layout cannot know that an
   * item was chosen or that the reader went back, which is the router's to
   * say. **Moving a screen reader into the pane this reveals comes with
   * setting it**, since the pane being left is hidden from it and only the
   * call site knows what inside the new one to send it to.
   * @default 'list'
   */
  readonly showing?: 'detail' | 'list'
}

type PaneProps = {
  readonly children: ReactNode
  readonly hidden: boolean
  readonly style: ViewStyle
}

/**
 * Material Design's list-detail layout: a fixed list pane beside a flexible
 * detail pane from the expanded window size up, and the one pane `showing`
 * names below it.
 *
 * ```tsx
 * <ListDetail
 *   detail={<Detail id={id} />}
 *   list={<List aria-label="Label" onAction={open}>{rows}</List>}
 *   showing={id === undefined ? 'list' : 'detail'}
 * />
 * ```
 *
 * Layout only: neither pane paints a surface of its own, so what goes in
 * them is the call site's. It grows to fill the screen it is in, and each
 * pane pads itself by the safe area where it meets the screen's edge.
 *
 * On a phone the panes are two steps of the app's navigation. Choosing an
 * item puts its id in the route, which sets `showing` to `detail`, and the
 * back gesture or swipe takes it out again, so the router owns the step back
 * and the layout has no back button or history of its own. Both panes stay
 * mounted, so a rotation or a foldable unfolding keeps what either holds.
 * The stories show the wiring with Expo Router and React Navigation.
 */
function ListDetail({
  detail,
  list,
  showing = 'list',
  style,
  ...props
}: ListDetailProps) {
  const own = stylesOf(useTheme())
  const sizeClass = useWindowSizeClass()
  const both = BOTH.has(sizeClass)
  const fixed = sizeClass === 'extraLarge' ? styles.listExtraLarge : styles.list

  return (
    <View {...props} style={composeStyles<ViewStyle>(own.root, style)}>
      <Pane
        hidden={!both && showing === 'detail'}
        style={both ? fixed : styles.flexible}
      >
        {list}
      </Pane>
      <Pane hidden={!both && showing === 'list'} style={styles.flexible}>
        {detail}
      </Pane>
    </View>
  )
}

// A pane is hidden on the outside and padded on the inside. React Native's
// own `View` is what turns `aria-hidden` into iOS's hidden elements and
// Android's hidden descendants, and the safe area's view is a native one of
// its own that goes round it.
function Pane({ children, hidden, style }: PaneProps) {
  return (
    <View
      aria-hidden={hidden}
      style={composeStyles<ViewStyle>(style, hidden ? styles.hidden : null)}
    >
      <SafeAreaView style={styles.safeArea}>{children}</SafeAreaView>
    </View>
  )
}

export { ListDetail }
export type { ListDetailProps }
