import type {
  CollectionLoadMoreProps,
  CollectionProps,
  CollectionRowProps,
  CollectionSectionProps,
} from '../../collection'

import { Collection, loaderNode, rowNode, sectionNode } from '../../collection'

// kanso-ui's List, from the lists page: a column of the rows ListItem draws,
// with selection, an action per row, sections and a row that loads more.
// What it draws, and how it differs from web's, is src/collection's, which
// ListBox draws too; what is List's own is the checkbox on a row that
// selects, the headers that stick, and the surface it is drawn on.

type ListLoadMoreProps = CollectionLoadMoreProps

type ListProps<T extends object = object> = CollectionProps<T>

// `Row` rather than `Item`, though the part is `List.Item`, for the reason
// web gives: `ListItemProps` is the standalone ListItem's, and both are
// exported from the package.
type ListRowProps = CollectionRowProps

type ListSectionProps = CollectionSectionProps

/**
 * A list of rows, one or more of which can be selected. Selection is React
 * Stately's, as web's is React Aria's: set `selectionMode` to `single` or
 * `multiple`, and pass `selectedKeys` with `onSelectionChange` to control
 * it or `defaultSelectedKeys` to let it keep its own. A list that selects
 * draws a checkbox on every row. A list whose rows do something takes
 * `onAction`, or an `onAction` on each row.
 *
 * ```tsx
 * <List aria-label="Label" selectionMode="multiple">
 *   <List.Item id="first" supporting="Supporting line">First item</List.Item>
 * </List>
 * ```
 *
 * ListItem is the row on its own; this is the collection that draws the
 * same row and adds selection, sections and a row that loads more. Composed
 * from parts, `List.Item`, `List.Section` and `List.LoadMore`, which the
 * list draws from their props, so none of them renders anything on its
 * own. Name the list with `aria-label`. It scrolls by itself, so it wants a
 * height to fill: a short list on a page that scrolls takes
 * `scrollEnabled={false}` and is laid out at its full length. It is drawn
 * on surface, and a section's header stays at the top while its rows scroll
 * under it. `style` and `ref` land on the `FlatList`.
 *
 * Inside an `Autocomplete`, the list shows the rows the search keeps and
 * says how many there are to a screen reader, and a tap on a row reaches it
 * while the keyboard is up.
 */
function List<T extends object = object>(props: ListProps<T>) {
  return <Collection {...props} kind="list" />
}

/**
 * The row shown while more items are being fetched. `onLoadMore` is called
 * as the reader nears the end of the list, and the ring is drawn only while
 * `isLoading`, in a live region, so a screen reader hears it arrive. It
 * goes last, after the rows it loads more of.
 */
function ListLoadMore(_props: ListLoadMoreProps): null {
  return null
}

ListLoadMore.getCollectionNode = loaderNode

/**
 * One row. Its slots are ListItem's: `leading`, the headline as children,
 * `overline` above it, `supporting` under it, and `trailing`. Give every
 * row an `id`, which is the key selection is reported by. A list that
 * selects draws a checkbox before whatever `leading` holds.
 *
 * The list draws it from its entry in the collection, so it renders nothing
 * on its own. `style`, `ref` and `testID` land on the row.
 */
function ListRow(_props: ListRowProps): null {
  return null
}

ListRow.getCollectionNode = rowNode

/**
 * A group of rows under a heading, which stays at the top of the list while
 * the group's rows scroll under it.
 */
function ListSection(_props: ListSectionProps): null {
  return null
}

ListSection.getCollectionNode = sectionNode

List.Item = ListRow
List.LoadMore = ListLoadMore
List.Section = ListSection

export { List, ListLoadMore, ListRow, ListSection }
export type { ListLoadMoreProps, ListProps, ListRowProps, ListSectionProps }
