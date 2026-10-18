import type { ReactNode } from 'react'
import type { Key } from 'react-stately'
import type { TreeProps as StatelyTreeProps } from 'react-stately/useTreeState'

import { useTreeState } from 'react-stately/useTreeState'

import type {
  CollectionLoadMoreProps,
  CollectionProps,
  CollectionRowProps,
  CollectionSectionProps,
} from '../../collection'

import {
  childElementsOf,
  CollectionView,
  loaderNode,
  sectionNode,
} from '../../collection'

// kanso-ui's Tree: a list whose rows nest. Each row is the row every list
// here draws, src/row's, drawn by src/collection as a List draws it, so its
// 56dp floor, body-large headline, body-medium supporting line, state layers,
// selection colours and checkbox are that module's, and a tree beside a list
// cannot drift from it.
//
// The lists page gives no nesting, so the two things a tree adds are web's
// own, and src/collection draws both: a level is set in by 24dp, the width
// of the menus page's chevron, which makes a level of nesting exactly as wide
// as the caret that opens it; and a row with rows under it starts with that
// chevron, which turns a quarter as it opens and mirrors under right-to-left,
// while a row with none starts with the chevron's space, so its headline
// lines up with a sibling's that opens.
//
// Three things differ from web's, each because a screen reader or a touch on
// a phone works differently from a keyboard in a browser, and each the same
// as List's.
//
// **A row is one element to a screen reader.** Web's row is a tree grid row
// whose chevron and checkbox are buttons a keyboard reaches on their own.
// VoiceOver and TalkBack read a pressable row as one element and reach
// nothing inside it, so a row reports whether it is open and whether it is
// selected, and opening, closing and selecting it are accessibility actions,
// named from src/i18n as React Aria names web's chevron. Arrow keys, which
// open and close a row on web, have nothing to reach on a phone and are
// dropped.
//
// **A press does what React Aria's touch press does.** The chevron opens and
// closes its row. A press on the row runs its action while nothing is
// selected and selects once something is, a long press selects, and in a
// tree that neither selects nor acts a press opens or closes the row, as
// React Aria's does.
//
// **The tree is one `FlatList`.** The rows of an open row follow it in the
// same column, and a section is its header and then its rows, so a large
// tree draws only the rows in view, and a section's header stays at the top
// while its rows scroll under it.

type TreeItemProps = Omit<
  CollectionRowProps,
  'children' | 'overline' | 'textValue'
> &
  TreeItemText & {
    /** The rows nested under this one, as further `Tree.Item` parts. */
    readonly children?: ReactNode
  }

// What the row is worth as text, which the collection keeps beside the row
// as web's does: a string headline is taken as the value, and anything else
// has to say what it is worth, so the compiler asks for it where web's types
// do.
type TreeItemText =
  | {
      /** The row's headline, as something other than a plain string. */
      readonly headline?: ReactNode
      /** The row's text, which a headline that is not a string cannot give. */
      readonly textValue: string
    }
  | {
      /** The row's headline, the one thing it is mostly about. */
      readonly headline: string
      /** The row's text. Defaults to the headline. */
      readonly textValue?: string
    }

type TreeLoadMoreProps = CollectionLoadMoreProps

type TreeProps<T extends object = object> = CollectionProps<T> & {
  /** The keys of the rows open at first, when the tree keeps its own. */
  readonly defaultExpandedKeys?: Iterable<Key>
  /**
   * The keys of the open rows, for a call site holding them itself with
   * `onExpandedChange`.
   */
  readonly expandedKeys?: Iterable<Key>
  /** Called with the keys of the open rows whenever a row opens or closes. */
  readonly onExpandedChange?: (keys: Set<Key>) => void
}

type TreeSectionProps = CollectionSectionProps

/**
 * A list whose rows nest. Which rows are open is React Stately's, as web's
 * is React Aria's: pass `expandedKeys` with `onExpandedChange` to control
 * it, or `defaultExpandedKeys` to let it keep its own. Selection is React
 * Stately's too: set `selectionMode` to `single` or `multiple`, and a tree
 * that selects draws a checkbox on every row.
 *
 * ```tsx
 * <Tree aria-label="Label">
 *   <Tree.Item headline="First item" id="first">
 *     <Tree.Item headline="Second item" id="second" />
 *   </Tree.Item>
 * </Tree>
 * ```
 *
 * Each row is the row every list here draws, indented by its depth, with a
 * chevron on the rows that have rows under them. Composed from parts,
 * `Tree.Item`, `Tree.Section` and `Tree.LoadMore`, which the tree draws from
 * their props, so none of them renders anything on its own. Name the tree
 * with `aria-label`. It scrolls by itself, so it wants a height to fill: a
 * short tree on a page that scrolls takes `scrollEnabled={false}` and is
 * laid out at its full length. It is drawn on surface, and `style` and `ref`
 * land on the `FlatList`.
 */
function Tree<T extends object = object>({
  children,
  defaultExpandedKeys,
  defaultSelectedKeys,
  disabledKeys,
  disallowEmptySelection,
  expandedKeys,
  items,
  onExpandedChange,
  onSelectionChange,
  selectedKeys,
  selectionMode = 'none',
  ...props
}: TreeProps<T>) {
  const state = useTreeState<T>({
    // Each part builds its own entry in the collection; see `treeItemNode`
    // and the two src/collection gives. The collection skips what is not an
    // element, as a ReactNode may be, and asks any element for its entry.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    children: children as StatelyTreeProps<T>['children'],
    defaultExpandedKeys,
    defaultSelectedKeys,
    disabledKeys,
    disallowEmptySelection,
    expandedKeys,
    items,
    onExpandedChange,
    onSelectionChange,
    selectedKeys,
    selectionMode,
  })

  return <CollectionView<T> {...props} kind="list" state={state} />
}

/**
 * One row, and the rows under it. Its slots are ListItem's: `leading`, the
 * `headline`, `supporting` under it, and `trailing`. Give every row an `id`,
 * which is the key selection and opening are reported by.
 *
 * Rows nested as `children` are what make it open: a row with none draws no
 * chevron. The tree draws it from its entry in the collection, so it renders
 * nothing on its own. `style`, `ref` and `testID` land on the row.
 */
function TreeItem(_props: TreeItemProps): null {
  return null
}

TreeItem.getCollectionNode = treeItemNode

/**
 * The row shown while more rows are being fetched. `onLoadMore` is called
 * as the reader nears the end of the tree, and the ring is drawn only while
 * `isLoading`, in a live region, so a screen reader hears it arrive. It goes
 * last, after the rows it loads more of.
 */
function TreeLoadMore(_props: TreeLoadMoreProps): null {
  return null
}

TreeLoadMore.getCollectionNode = loaderNode

/**
 * A group of rows under a heading, which stays at the top of the tree while
 * the group's rows scroll under it.
 */
function TreeSection(_props: TreeSectionProps): null {
  return null
}

TreeSection.getCollectionNode = sectionNode

// The entry the collection holds for an `Item` part: keyed by the row's
// `id`, carrying the props it is drawn from, and holding the rows nested in
// it, which the collection reads only while the row is open.
function* treeItemNode(props: TreeItemProps) {
  const children = childElementsOf(props.children)

  yield {
    'aria-label': props['aria-label'],
    *childNodes() {
      for (const element of children) {
        yield { element }
      }
    },
    hasChildNodes: children.length > 0,
    key: props.id,
    props,
    rendered: props.headline,
    textValue:
      props.textValue ??
      (typeof props.headline === 'string' ? props.headline : ''),
    type: 'item',
  }
}

Tree.Item = TreeItem
Tree.LoadMore = TreeLoadMore
Tree.Section = TreeSection

export { Tree, TreeItem, TreeLoadMore, TreeSection }
export type { TreeItemProps, TreeLoadMoreProps, TreeProps, TreeSectionProps }
