import type { ReactNode } from 'react'
import type { Key } from 'react-stately'
import type { TreeProps as StatelyTreeProps } from 'react-stately/useTreeState'

import { useTreeState } from 'react-stately/useTreeState'

import type {
  CollectionProps,
  CollectionRowProps,
  CollectionSectionProps,
} from '../../collection'

import { CollectionView, nestedRowNode, sectionNode } from '../../collection'

// kanso-ui's NavigationTree: the navigation drawer page's contents, a nested
// set of links with the current one marked. It is Tree's shape, drawn by
// src/collection as a Tree is, so its chevron, its 24dp a level and its
// opening and closing are Tree's, and the row is src/row's under that
// module's `drawer` variant: the drawer page's 56dp row with a label-large
// label, held 12dp off each edge, on a secondary-container pill while it is
// the current one.
//
// A tree selects, and a navigation tree navigates, so this takes
// `selectedRoute` where Tree takes `selectedKeys`, and has no selection at
// all, as React Aria's has none. The row whose `href` is the route is the
// current one, and each row it sits under is drawn with a bold label, found
// through every row, open or not, so a current row closed out of sight
// still shows where it is.
//
// Three things differ from web's, each because a screen reader or a touch on
// a phone works differently from a keyboard in a browser.
//
// **A row is one element to a screen reader**, a link, as Tree's row is one
// element. It reports whether it is open, and opening and closing it are
// accessibility actions, named from src/i18n as Tree's are. The current row
// says so through `aria-current` on the web, as web's does, and reports
// itself selected on native, which has no counterpart to it, as
// NavigationBar's current destination does.
//
// **A press goes where the row leads**, through src/router, so under a
// `RouterProvider` it moves between the app's screens and without one it asks
// the platform to open the `href`. The chevron is what opens and closes a row
// that has rows under it, and a row with no `href` opens and closes on a press
// instead, as React Aria's does.
//
// **The tree is one `FlatList`**, as Tree is, so a long drawer draws only the
// rows in view. A section's heading scrolls with its rows, as web's does,
// since a drawer's headings are no list's subheads.

type NavigationTreeItemProps = NavigationTreeItemText &
  Omit<
    CollectionRowProps,
    'children' | 'onAction' | 'overline' | 'textValue'
  > & {
    /**
     * The rows nested under this one, as further `NavigationTree.Item`
     * parts.
     */
    readonly children?: ReactNode
    /**
     * Where the row leads, which a press opens and `selectedRoute` is matched
     * against.
     */
    readonly href?: string
  }

// What the row is worth as text, which the collection keeps beside the row
// as web's does: a string label is taken as the value, and anything else has
// to say what it is worth, so the compiler asks for it where web's types do.
type NavigationTreeItemText =
  | {
      /** The row's label, as something other than a plain string. */
      readonly label?: ReactNode
      /** The row's text, which a label that is not a string cannot give. */
      readonly textValue: string
    }
  | {
      /** The row's label: where it goes. */
      readonly label: string
      /** The row's text. Defaults to the label. */
      readonly textValue?: string
    }

type NavigationTreeProps<T extends object = object> = Omit<
  CollectionProps<T>,
  | 'defaultSelectedKeys'
  | 'disallowEmptySelection'
  | 'onAction'
  | 'onSelectionChange'
  | 'renderEmptyState'
  | 'selectedKeys'
  | 'selectionMode'
  | 'selectLabel'
> & {
  /** The keys of the rows open at first, when the tree keeps its own. */
  readonly defaultExpandedKeys?: Iterable<Key>
  /**
   * The keys of the open rows, for a call site holding them itself with
   * `onExpandedChange`.
   */
  readonly expandedKeys?: Iterable<Key>
  /** Called with the keys of the open rows whenever a row opens or closes. */
  readonly onExpandedChange?: (keys: Set<Key>) => void
  /**
   * The route the app is on, matched against each row's `href`: the row it
   * matches is the current one, and the rows above it are its trail.
   */
  readonly selectedRoute?: null | string
}

type NavigationTreeSectionProps = CollectionSectionProps

/**
 * A nested set of links, with the current one marked. Give the tree a
 * `selectedRoute` and each row an `href`, and the row whose `href` matches is
 * the current one, drawn on the drawer's pill, while each row it sits under
 * is drawn with a bold label, so a closed trail still shows where you are.
 * Which rows are open is React Stately's, as web's is React Aria's: pass
 * `expandedKeys` with `onExpandedChange` to control it, or
 * `defaultExpandedKeys` to let it keep its own.
 *
 * ```tsx
 * <NavigationTree aria-label="Label" selectedRoute="/second">
 *   <NavigationTree.Item href="/first" id="first" label="First item">
 *     <NavigationTree.Item href="/second" id="second" label="Second item" />
 *   </NavigationTree.Item>
 * </NavigationTree>
 * ```
 *
 * There is no selection here, as there is none in React Aria's: what is
 * current comes from the route rather than from anything the reader picked,
 * and `Tree` is the one that selects. A press opens a row's `href` through
 * the `RouterProvider` around it. Composed from parts, `NavigationTree.Item`
 * and `NavigationTree.Section`, which the tree draws from their props, so
 * neither renders anything on its own. Name the tree with `aria-label`. It
 * scrolls by itself, so it wants a height to fill: a short tree on a page
 * that scrolls takes `scrollEnabled={false}` and is laid out at its full
 * length. It has no ground of its own, so it takes the drawer's, and `style`
 * and `ref` land on the `FlatList`.
 */
function NavigationTree<T extends object = object>({
  children,
  defaultExpandedKeys,
  disabledKeys,
  expandedKeys,
  items,
  onExpandedChange,
  selectedRoute,
  ...props
}: NavigationTreeProps<T>) {
  const state = useTreeState<T>({
    // Each part builds its own entry in the collection; see
    // `navigationItemNode` and the one src/collection gives. The collection
    // skips what is not an element, as a ReactNode may be, and asks any
    // element for its entry.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    children: children as StatelyTreeProps<T>['children'],
    defaultExpandedKeys,
    disabledKeys,
    expandedKeys,
    items,
    onExpandedChange,
    selectionMode: 'none',
  })

  return (
    <CollectionView<T>
      {...props}
      kind="drawer"
      renderEmptyState={nothing}
      selectedRoute={selectedRoute ?? undefined}
      state={state}
    />
  )
}

/**
 * One row, and the rows under it. Its slots are ListItem's, with a `label`
 * where ListItem has a headline and no overline, since the drawer page gives
 * one line of label: `leading`, the `label`, `supporting` under it, and
 * `trailing`, such as a count. Give it an `href`, which is what a press
 * opens and what `selectedRoute` is matched against, and an `id`, which is
 * the key opening is reported by.
 *
 * Rows nested as `children` are what make it open: a row with none draws no
 * chevron. The tree draws it from its entry in the collection, so it renders
 * nothing on its own. `style`, `ref` and `testID` land on the row.
 */
function NavigationTreeItem(_props: NavigationTreeItemProps): null {
  return null
}

NavigationTreeItem.getCollectionNode = navigationItemNode

/** A named group of rows, with its heading above them. */
function NavigationTreeSection(_props: NavigationTreeSectionProps): null {
  return null
}

NavigationTreeSection.getCollectionNode = sectionNode

// The entry the collection holds for an `Item` part, whose first line is its
// label.
function navigationItemNode(props: NavigationTreeItemProps) {
  return nestedRowNode(
    props,
    props.label,
    props.textValue ?? (typeof props.label === 'string' ? props.label : ''),
  )
}

// What a drawer with no rows draws, which is nothing: React Aria's takes no
// empty state, since a set of links has no search to have found none.
function nothing() {
  return null
}

NavigationTree.Item = NavigationTreeItem
NavigationTree.Section = NavigationTreeSection

export { NavigationTree, NavigationTreeItem, NavigationTreeSection }
export type {
  NavigationTreeItemProps,
  NavigationTreeProps,
  NavigationTreeSectionProps,
}
