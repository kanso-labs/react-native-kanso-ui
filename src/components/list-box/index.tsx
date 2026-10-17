import type {
  CollectionLoadMoreProps,
  CollectionProps,
  CollectionRowProps,
  CollectionSectionProps,
} from '../../collection'

import { Collection, loaderNode, rowNode, sectionNode } from '../../collection'

// kanso-ui's ListBox, from the lists page: the selectable list Select and
// ComboBox put in an overlay. Its options are the rows every list here
// draws, through src/collection, which List draws too, so the 56dp floor,
// the lines, the state layers and the disabled treatment are that module's.
// What is ListBox's own is what web's is: a selected option is marked by its
// container alone, primary container and on primary container, with no
// checkbox drawn, and the list has no ground of its own, which is what lets
// the same one sit on a page and inside a popover. A list that selects more
// than one and wants a checkbox puts one in an option's trailing slot, as on
// web, since which of the two affordances a list wants is the list's
// decision.
//
// Its section headers scroll with the options rather than sticking, as
// web's do: a header that sticks covers the rows under it, and with no
// ground there is nothing to cover them with.

type ListBoxItemProps = CollectionRowProps

type ListBoxLoadMoreProps = CollectionLoadMoreProps

type ListBoxProps<T extends object = object> = CollectionProps<T>

type ListBoxSectionProps = CollectionSectionProps

/**
 * A list of options one or more of which can be selected. Selection is React
 * Stately's, as web's is React Aria's: set `selectionMode` to `single` or
 * `multiple`, and pass `selectedKeys` with `onSelectionChange` to control
 * it or `defaultSelectedKeys` to let it keep its own. A selected option is
 * drawn on primary container. A list that only responds to a press takes
 * `onAction`, or an `onAction` on each option.
 *
 * ```tsx
 * <ListBox aria-label="Label" selectionMode="single">
 *   <ListBox.Item id="first">First item</ListBox.Item>
 *   <ListBox.Item id="second">Second item</ListBox.Item>
 * </ListBox>
 * ```
 *
 * Composed from parts, `ListBox.Item`, `ListBox.Section` and
 * `ListBox.LoadMore`, which the list draws from their props, so none of
 * them renders anything on its own. Name the list with `aria-label`. It has
 * no background of its own, so it takes whatever it sits on. It scrolls by
 * itself, so it wants a height to fill: a short list on a page that scrolls
 * takes `scrollEnabled={false}` and is laid out at its full length. `style`
 * and `ref` land on the `FlatList`.
 *
 * A list with nothing in it shows a muted "No results" row in place of its
 * options; pass `renderEmptyState` to draw something else. Inside an
 * `Autocomplete`, it shows the options the search keeps and says how many
 * there are to a screen reader.
 */
function ListBox<T extends object = object>(props: ListBoxProps<T>) {
  return <Collection {...props} kind="listbox" />
}

/**
 * One option. Its slots are ListItem's: `leading`, the headline as children,
 * `overline` above it, `supporting` under it, and `trailing`. Give every
 * option an `id`, which is the key selection is reported by.
 *
 * The list draws it from its entry in the collection, so it renders nothing
 * on its own. `style`, `ref` and `testID` land on the option.
 */
function ListBoxItem(_props: ListBoxItemProps): null {
  return null
}

ListBoxItem.getCollectionNode = rowNode

/**
 * The row shown while more options are being fetched. `onLoadMore` is
 * called as the reader nears the end of the list, and the ring is drawn
 * only while `isLoading`, in a live region, so a screen reader hears it
 * arrive. It goes last, after the options it loads more of.
 */
function ListBoxLoadMore(_props: ListBoxLoadMoreProps): null {
  return null
}

ListBoxLoadMore.getCollectionNode = loaderNode

/**
 * A group of options under a heading, which a screen reader reads before the
 * options in it.
 */
function ListBoxSection(_props: ListBoxSectionProps): null {
  return null
}

ListBoxSection.getCollectionNode = sectionNode

ListBox.Item = ListBoxItem
ListBox.LoadMore = ListBoxLoadMore
ListBox.Section = ListBoxSection

export { ListBox, ListBoxItem, ListBoxLoadMore, ListBoxSection }
export type {
  ListBoxItemProps,
  ListBoxLoadMoreProps,
  ListBoxProps,
  ListBoxSectionProps,
}
