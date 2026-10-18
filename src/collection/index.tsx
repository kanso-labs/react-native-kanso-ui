import type { ReactElement, ReactNode, Ref } from 'react'
import type {
  AccessibilityActionEvent,
  ColorValue,
  GestureResponderEvent,
  HostInstance,
  LayoutChangeEvent,
  ListRenderItemInfo,
  PressableProps,
  ScrollViewProps,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
import type { Key, Node, Selection, SelectionMode } from 'react-stately'
import type {
  ListState,
  ListProps as StatelyListProps,
} from 'react-stately/useListState'
import type { TreeState } from 'react-stately/useTreeState'

import {
  Children,
  createContext,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AccessibilityInfo,
  FlatList,
  Text as NativeText,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { useListState } from 'react-stately/useListState'

import type { AutocompleteValue } from '../autocomplete'
import type { ResolvedTheme } from '../theme/scope'

import { AutocompleteContext } from '../autocomplete'
import { toggleState } from '../button'
import { ProgressIndicator } from '../components/progress-indicator'
import { CheckboxBox } from '../control/checkbox-box'
import { ExpandChevron } from '../disclosure/chevron'
import { resultsFor } from '../i18n'
import { useLocaleOf, useMessages } from '../i18n/provider'
import { hitSlop, usePressFeedback } from '../press'
import { refsOf } from '../ref'
import { useOpenLink } from '../router'
import {
  hasContent,
  RowContent,
  rowContentColor,
  rowStyleOf,
  rowStyles,
} from '../row'
import { useTheme } from '../theme/scope'
import { composeStyles, themedStyles } from '../theme/styles'
import { useTypeRole } from '../typography/roles'

// The collection kanso-ui's List and ListBox both draw, from the lists page:
// a column of the rows ListItem draws, shared through src/row, with
// selection, an action per row, sections and a row that loads more. It is a
// `FlatList`, so a long collection draws the rows in view and a few screens
// either side rather than every row it holds. List and ListBox are each this
// with a `kind`, and differ where their web counterparts do: a List draws a
// checkbox on a row that selects and paints a ground of its own, while a
// ListBox marks a selected option with its container alone and is
// transparent, so the same one sits on a page and inside a popover. A Tree
// is a List whose state is a tree's, drawn from React Stately's tree state
// rather than its list state: its rows nest, a row with rows under it opens
// and closes, and the rows of an open one follow it in the same column. A
// NavigationTree is a Tree drawn as a navigation drawer: its rows are links,
// the one whose `href` is the route is marked with the drawer's pill, and
// the rows it sits under with a bold label.
//
// Four things differ from web's, each because a screen reader or a touch on
// a phone works differently from a keyboard in a browser.
//
// **A row is one element to a screen reader.** Web's List row is a grid row
// whose checkbox is a cell a keyboard reaches on its own, and web's ListBox
// option is an option in a listbox. VoiceOver and TalkBack read a pressable
// row as one element and reach nothing inside it, and announce neither a
// listbox nor an option, so a row is a button that reports whether it is
// selected, and selecting it from a screen reader is an accessibility action
// named by `selectLabel`. A List offers that action on every row that
// selects, as web's checkbox is there on every one; a ListBox offers it on
// an option whose press runs an action, the one case where a press may not
// select. Under React Native Web a row reports itself pressed, as a toggle
// button does, since a button cannot be selected there.
//
// **A press does what React Aria's touch press does.** On a row that selects
// and has no action, a press selects it. On one with an action, a press runs
// the action while nothing is selected and selects once something is, and a
// long press selects; a press on a List's checkbox selects either way.
//
// **Sections are flattened, and so is a tree.** A `FlatList` holds one
// column of cells, so a section is its header and then its rows, and the
// header is a heading to a screen reader rather than the name of a group.
// An open row of a tree is followed by the rows under it, each indented a
// chevron's width further, so a large tree draws only what is in view. A
// List's headers stay at the top while their rows scroll under them. A
// ListBox's scroll with the rows, since it has no ground to cover them with.
//
// **A List is drawn on surface,** the lists page's container colour, which
// web leaves to the page. A sticky header needs a ground to cover the rows
// scrolling under it, and it takes the list's, so a `style` giving the list
// another background gives its headers the same one.

// A checkbox drawn in a row sits in a slot an icon's size, the lists page's
// 24dp, rather than in the 40dp state layer Checkbox draws it in.
const BOX_SLOT = 24

// The ring the loading row draws, a row's icon across.
const LOADING_DIAMETER = '24px'

// How far past the visible end of the list `onLoadMore` is called, as a
// share of the list's visible height, as web's `scrollOffset` defaults.
const LOAD_OFFSET = 1

// The rows a `FlatList` draws at first, its own default, which a list grows
// to reach the row it opens on.
const INITIAL_ROWS = 10

// What the loading row reads when the collection has no `LoadMore` part,
// which leaves it nothing to draw.
const IDLE: CollectionLoadMoreProps = {}

// What marks a drawer's current row on the web, where a screen reader reads
// it, as web's does.
const CURRENT_PAGE = { 'aria-current': 'page' } as const

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    height: BOX_SLOT,
    justifyContent: 'center',
    width: BOX_SLOT,
  },
  // What the `LoadMore` part leaves while nothing is loading: the live
  // region, with nothing in it and no height.
  idle: {
    height: 0,
  },
  // The count a search leaves, which a screen reader hears and no one sees:
  // out of the flow, and a point across, as web's visually hidden status is.
  status: {
    height: 1,
    overflow: 'hidden',
    pointerEvents: 'none',
    position: 'absolute',
    width: 1,
  },
})

const stylesOf = themedStyles(
  ({ colors, radii, sizing, spacing }: ResolvedTheme) =>
    StyleSheet.create({
      // The 8dp above the first row and below the last, as web's container
      // draws them.
      content: {
        paddingVertical: spacing.sm,
      },
      // The navigation drawer page's section heading, in on surface variant,
      // held 12dp further in than a list's, which lines it up with the labels
      // inside the rows' pills.
      drawerHeader: {
        color: colors.onSurfaceVariant,
        paddingBottom: spacing.xxs,
        paddingHorizontal: spacing.lg + spacing.md,
        paddingTop: spacing.lg,
      },
      empty: {
        color: colors.onSurfaceVariant,
      },
      // The lists page's subhead: title small in on surface variant, at the
      // row's inline padding so it lines up with the headlines under it, with
      // more room above than below so it reads as belonging to what follows.
      header: {
        color: colors.onSurfaceVariant,
        paddingBottom: spacing.xxs,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
      },
      // The checkbox beside whatever the row's leading slot was given, a
      // row's own gap apart.
      lead: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.lg,
      },
      list: {
        backgroundColor: colors.surface,
      },
      // A row's height for the ring, so the list does not jump when the next
      // items land.
      loading: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: sizing.rowSm,
      },
      // The corners a drawer's row clips its state layer and ripple to.
      pill: {
        borderRadius: radii.pill,
      },
      // Never seen, but in a pair that reads, for a checker that looks.
      status: {
        color: colors.onSurface,
      },
    }),
)

/**
 * Which component draws the collection: a List, whose rows that select carry
 * a checkbox and whose ground is surface, a ListBox, whose options carry
 * none and which has no ground, or a NavigationTree's drawer, whose rows are
 * links, with the current one marked, and which has no ground either.
 */
type CollectionKind = 'drawer' | 'list' | 'listbox'

type CollectionLoadMoreProps = {
  /**
   * Draws the ring in a row of its own while more items are being fetched.
   * @default false
   */
  readonly isLoading?: boolean
  /**
   * What a screen reader calls the ring, and hears as it appears. Left out,
   * it is the word for it in the `I18nProvider`'s language, or the device's
   * outside one, "Loading more" in English.
   */
  readonly label?: string
  /**
   * Called when the end of the list comes within `scrollOffset` of its
   * visible end, while nothing is loading. Called once for each length the
   * list reaches, so a load that adds nothing does not start another.
   */
  readonly onLoadMore?: () => void
  /**
   * How far past the visible end of the list the next items are asked for,
   * as a share of the list's visible height.
   * @default 1
   */
  readonly scrollOffset?: number
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

type CollectionProps<T extends object = object> = Omit<
  ScrollViewProps,
  'children' | 'role' | 'stickyHeaderIndices' | 'style'
> & {
  /**
   * The rows, each an `Item`, `Section` or `LoadMore` part. With `items`, a
   * function from an item to its part, called for each item in turn.
   */
  readonly children?: ((item: T) => ReactElement) | ReactNode
  /** The keys selected at first, when the list keeps its own selection. */
  readonly defaultSelectedKeys?: 'all' | Iterable<Key>
  /** The keys of the rows drawn disabled, which take no presses. */
  readonly disabledKeys?: Iterable<Key>
  /**
   * Keeps the last selected row selected, so a press on it changes nothing.
   * @default false
   */
  readonly disallowEmptySelection?: boolean
  /** The entries `children` draws a part for, when it is a function. */
  readonly items?: Iterable<T>
  /**
   * Called with a row's key when a press runs its action. A row's own
   * `onAction` takes its place for that row.
   */
  readonly onAction?: (key: Key) => void
  /** Called with the selected keys whenever a press changes them. */
  readonly onSelectionChange?: (keys: Selection) => void
  readonly ref?: Ref<FlatList>
  /**
   * What the list shows when it has no rows and nothing is loading. Left
   * out, it is a muted row saying "No results" in the `I18nProvider`'s
   * language, or the device's outside one, so the list keeps a row's height.
   */
  readonly renderEmptyState?: () => ReactNode
  /**
   * The selected keys, for a call site holding the selection itself with
   * `onSelectionChange`.
   */
  readonly selectedKeys?: 'all' | Iterable<Key>
  /**
   * Whether rows can be selected: one at a time, several, or none.
   * @default 'none'
   */
  readonly selectionMode?: SelectionMode
  /**
   * What selecting a row is called, for a screen reader: the accessibility
   * action that selects a row whose press may do something else. The row's
   * own text is what names the row. Left out, it is the word for it in the
   * `I18nProvider`'s language, or the device's outside one, "Select" in
   * English.
   */
  readonly selectLabel?: string
  readonly style?: StyleProp<ViewStyle>
}

type CollectionRowProps = Omit<
  PressableProps,
  'children' | 'disabled' | 'id' | 'role' | 'style'
> & {
  /** The row's headline, the one thing it is mostly about. */
  readonly children?: ReactNode
  /** The key the row is selected and reported by. Give one to every row. */
  readonly id?: Key
  /**
   * Draws the row disabled, and takes no presses on it, as a key in the
   * list's `disabledKeys` does.
   * @default false
   */
  readonly isDisabled?: boolean
  /** Content before the headline: an avatar, an icon. */
  readonly leading?: ReactNode
  /**
   * Called when a press runs the row's action, in place of the list's
   * `onAction` for this row.
   */
  readonly onAction?: () => void
  /**
   * A line above the headline, in label small and the muted role. Given
   * beside `supporting`, it makes the row the three-line item.
   */
  readonly overline?: ReactNode
  readonly ref?: Ref<HostInstance>
  readonly style?: StyleProp<ViewStyle>
  /** A second line under the headline, in body medium and the muted role. */
  readonly supporting?: ReactNode
  /**
   * The row's text, read off `children` when they are a plain string, so a
   * row whose headline is an element passes it.
   */
  readonly textValue?: string
  /** Content after the headline, such as an amount or a control. */
  readonly trailing?: ReactNode
}

type CollectionSectionProps = {
  /** The rows in the section. */
  readonly children?: ReactNode
  /**
   * The section's heading, a heading to a screen reader. A section without
   * one is its rows alone.
   */
  readonly header?: ReactNode
  readonly id?: Key
}

/**
 * The state a collection is drawn from: a list's, or a tree's, which holds
 * which rows are open beside what a list's holds.
 */
type CollectionState<T> = ListState<T> | TreeState<T>

// What the cells of the `FlatList` read from the collection they are drawn
// in.
type CollectionValue = {
  /** The row whose node goes to `onFocusTarget`. */
  readonly focusKey: Key | null
  /**
   * The ground a List's sticky header covers the rows under it with, and
   * none for a ListBox, whose headers do not stick.
   */
  readonly ground: ColorValue | undefined
  readonly kind: CollectionKind
  /** The `LoadMore` part the collection ends in, if it has one. */
  readonly loadMore: CollectionLoadMoreProps | undefined
  readonly onAction: ((key: Key) => void) | undefined
  readonly onFocusTarget: ((node: HostInstance | null) => void) | undefined
  readonly renderEmptyState: () => ReactNode
  /** Where a drawer's route is among its rows, and nothing for the others. */
  readonly route: RouteMark | undefined
  readonly selectLabel: string
  readonly state: CollectionState<unknown>
}

type CollectionViewProps<T extends object = object> = Omit<
  CollectionProps<T>,
  | 'children'
  | 'defaultSelectedKeys'
  | 'disabledKeys'
  | 'disallowEmptySelection'
  | 'items'
  | 'onSelectionChange'
  | 'selectedKeys'
  | 'selectionMode'
> & {
  /** The row whose node is handed to `onFocusTarget`, if any. */
  readonly focusKey?: Key | null
  readonly kind: CollectionKind
  /** Handed the node of the row `focusKey` names, as it mounts and goes. */
  readonly onFocusTarget?: (node: HostInstance | null) => void
  /**
   * Scrolls the row `focusKey` names into view, once, the first time the
   * list is laid out while this holds: a panel passes it once it has been
   * placed, and so has the height it scrolls in.
   * @default false
   */
  readonly revealFocus?: boolean
  /**
   * A drawer's current route, matched against each row's `href`: the row it
   * matches is the current one, and the rows above it are its trail.
   */
  readonly selectedRoute?: string | undefined
  /**
   * The list state the rows are drawn from, and select through, or a tree
   * state, which opens and closes them too.
   */
  readonly state: CollectionState<T>
}

/** One cell of the `FlatList`: a section's header, or a row. */
type Entry = {
  readonly kind: 'header' | 'item'
  readonly node: Node<unknown>
}

/**
 * The row of a drawer whose `href` is the route, and the rows it sits
 * under, at every depth.
 */
type RouteMark = {
  readonly current: Key | null
  readonly trail: ReadonlySet<Key>
}

/** What a `FlatList` reports when it cannot scroll to a row. */
type ScrollFailure = {
  readonly averageItemLength: number
  readonly index: number
}

const CollectionContext = createContext<CollectionValue | null>(null)

// Runs what a screen reader asks of a row: selecting it, or opening or
// closing a tree's row, each where the row offers it.
function accessibilityActionOf(actions: {
  readonly collapse: (() => void) | undefined
  readonly expand: (() => void) | undefined
  readonly select: (() => void) | undefined
}) {
  return (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case 'collapse': {
        actions.collapse?.()
        break
      }
      case 'expand': {
        actions.expand?.()
        break
      }
      case 'select': {
        actions.select?.()
        break
      }
    }
  }
}

/**
 * The parts nested in a part, a Section's rows or a Tree row's, walked as
 * React Stately's own Section walks them, which leaves each child its own
 * key rather than the one `Children.toArray` gives it. A condition left
 * false is no part: React hands a boolean or an undefined child over as
 * null.
 */
function childElementsOf(children: ReactNode): ReactNode[] {
  const elements: ReactNode[] = []

  Children.forEach(children, (child) => {
    if (child !== null) {
      elements.push(child)
    }
  })

  return elements
}

/**
 * The `FlatList` List and ListBox draw, from parts read off its children by
 * React Stately's list state. Inside an `Autocomplete`, it shows the rows the
 * search keeps and says how many there are to a screen reader, and a tap on
 * a row reaches it while the keyboard is up.
 */
function Collection<T extends object = object>({
  children,
  defaultSelectedKeys,
  disabledKeys,
  disallowEmptySelection,
  items,
  onSelectionChange,
  selectedKeys,
  selectionMode = 'none',
  ...props
}: CollectionProps<T> & { readonly kind: CollectionKind }) {
  const autocomplete = use(AutocompleteContext)
  const matches = autocomplete?.matches
  const filter = useMemo(
    () => (matches === undefined ? undefined : filterOf<T>(matches)),
    [matches],
  )
  const state = useListState<T>({
    // Each part builds its own entry in the collection; see `rowNode` and
    // the two beside it. The collection skips what is not an element, as a
    // ReactNode may be, and asks any element for its entry.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    children: children as StatelyListProps<T>['children'],
    defaultSelectedKeys,
    disabledKeys,
    disallowEmptySelection,
    filter,
    items,
    onSelectionChange,
    selectedKeys,
    selectionMode,
  })

  return <CollectionView<T> {...props} state={state} />
}

/**
 * The `FlatList` itself, drawn from a list state built elsewhere: by
 * `Collection` from its own props, or by a component whose state holds more
 * than a list's, as a Select's holds whether it is open and a Tree's which
 * rows are. `focusKey` names the
 * row whose node is handed to `onFocusTarget`, for a panel that sends a
 * screen reader to it as it opens.
 */
function CollectionView<T extends object = object>({
  contentContainerStyle,
  focusKey = null,
  keyboardShouldPersistTaps,
  kind,
  onAction,
  onFocusTarget,
  onLayout,
  ref,
  renderEmptyState = emptyState,
  revealFocus = false,
  selectedRoute,
  selectLabel,
  state,
  style,
  ...props
}: CollectionViewProps<T>) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const autocomplete = use(AutocompleteContext)
  const { entries, loader, rows, sticky } = useMemo(
    () => entriesOf(state),
    [state],
  )
  const route = useMemo(
    () =>
      kind === 'drawer'
        ? routeMarkOf(state.collection, selectedRoute)
        : undefined,
    [kind, selectedRoute, state.collection],
  )
  const [list, setList] = useState<FlatList | null>(null)
  const [revealed, setRevealed] = useState(false)
  const focusIndex =
    focusKey === null
      ? -1
      : entries.findIndex(
          (entry) => entry.kind === 'item' && entry.node.key === focusKey,
        )
  const isList = kind === 'list'
  const listStyle = composeStyles<ViewStyle>(
    isList ? own.list : undefined,
    style,
  )
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- a node carries the props its part was written with, which React Stately types as `any`
  const loadMore: CollectionLoadMoreProps | undefined = loader?.props
  const isLoading = loadMore?.isLoading ?? false
  const messages = useMessages()
  // A List's own ground unless `style` gives it another.
  const ground = isList
    ? (StyleSheet.flatten(style)?.backgroundColor ?? theme.colors.surface)
    : undefined
  const value = useMemo<CollectionValue>(
    () => ({
      focusKey,
      ground,
      kind,
      loadMore,
      onAction,
      onFocusTarget,
      renderEmptyState,
      route,
      selectLabel: selectLabel ?? messages.select,
      state,
    }),
    [
      focusKey,
      ground,
      kind,
      loadMore,
      messages,
      onAction,
      onFocusTarget,
      renderEmptyState,
      route,
      selectLabel,
      state,
    ],
  )

  return (
    <CollectionContext value={value}>
      <FlatList
        {...props}
        contentContainerStyle={composeStyles<ViewStyle>(
          own.content,
          contentContainerStyle,
        )}
        data={entries}
        // Enough rows drawn at first to hold the one a screen reader is sent
        // to, which has to be there to be sent to.
        initialNumToRender={Math.max(INITIAL_ROWS, focusIndex + 1)}
        keyboardShouldPersistTaps={
          keyboardShouldPersistTaps ??
          (autocomplete === null ? undefined : 'handled')
        }
        keyExtractor={keyOf}
        ListEmptyComponent={isLoading ? undefined : EmptyState}
        ListFooterComponent={loadMore === undefined ? undefined : LoaderRow}
        onEndReached={loadMore === undefined ? undefined : loadMoreOf(loadMore)}
        onEndReachedThreshold={loadMore?.scrollOffset ?? LOAD_OFFSET}
        onLayout={revealOnLayout(onLayout, {
          index: revealFocus && !revealed ? focusIndex : -1,
          list,
          setRevealed,
        })}
        onScrollToIndexFailed={scrollNear(list)}
        ref={refsOf(setList, ref)}
        renderItem={renderEntry}
        stickyHeaderIndices={isList ? sticky : undefined}
        style={listStyle}
      />
      {autocomplete === null ? null : <ResultsStatus count={rows} />}
    </CollectionContext>
  )
}

// What a drawer's row reports of being the current one. Native has no
// counterpart to `aria-current`, so there the current row reports itself
// selected, as NavigationBar's current destination does, which VoiceOver and
// TalkBack both read out. Read as the row draws, as Breadcrumbs reads it.
function currentState(current: boolean) {
  if (Platform.OS !== 'web') {
    return { 'aria-selected': current }
  }
  return current ? CURRENT_PAGE : undefined
}

/**
 * The muted row a list shows when nothing is in it: a row's box and
 * headline in on surface variant, with no press of its own.
 */
function EmptyRow() {
  const theme = useTheme()
  const own = stylesOf(theme)
  const headline = useTypeRole('bodyLarge')
  const messages = useMessages()

  return (
    <View style={rowStyleOf(theme, {})}>
      <NativeText style={composeStyles<TextStyle>(headline, own.empty)}>
        {messages.noResults}
      </NativeText>
    </View>
  )
}

// What the list shows when nothing is in it.
function emptyState() {
  return <EmptyRow />
}

// The list's empty state, as the component `ListEmptyComponent` takes.
function EmptyState() {
  return <>{useCollection().renderEmptyState()}</>
}

/**
 * The cells the `FlatList` draws, in order, where the headers among them
 * are, and how many rows there are: the rows outside any section, and each
 * section's header followed by its rows, with the rows under each open row
 * of a tree after it. The row that loads more is drawn after them all.
 */
function entriesOf<T>(state: CollectionState<T>) {
  const entries: Entry[] = []
  const sticky: number[] = []
  const open = expansionOf(state)?.expandedKeys
  let loader: Node<T> | undefined
  let rows = 0

  const addRow = (row: Node<T>) => {
    entries.push({ kind: 'item', node: row })
    rows++
    if (open?.has(row.key) === true) {
      // oxlint-disable-next-line typescript/no-deprecated -- a tree's collection has no getChildren, and this is the field it reads a row's rows from itself
      for (const child of row.childNodes) {
        if (child.type === 'item') {
          addRow(child)
        }
      }
    }
  }

  for (const node of state.collection) {
    if (node.type === 'loader') {
      loader = node
    } else if (node.type === 'section') {
      if (hasContent(node.rendered)) {
        sticky.push(entries.length)
        entries.push({ kind: 'header', node })
      }
      const children =
        state.collection.getChildren?.(node.key) ??
        // oxlint-disable-next-line typescript/no-deprecated -- a fallback for a collection without getChildren
        node.childNodes
      for (const row of children) {
        addRow(row)
      }
    } else {
      addRow(node)
    }
  }

  return { entries, loader, rows, sticky }
}

/**
 * The tree state a collection is drawn from, which says which rows are open
 * and opens and closes them, or null for a list's, as React Aria tells the
 * two apart.
 */
function expansionOf<T>(state: CollectionState<T>): null | TreeState<T> {
  return 'expandedKeys' in state ? state : null
}

/**
 * What a list inside an Autocomplete builds its collection from: the rows
 * the search keeps, each section with a row left in it, and the row that
 * loads more. Each node is copied rather than handed on, as React Stately's
 * ComboBox copies its own, since a collection numbers the nodes it holds.
 */
function filterOf<T>(matches: AutocompleteValue['matches']) {
  return (nodes: Iterable<Node<T>>) => keptOf(nodes, matches)
}

/**
 * The row a screen reader is sent to as a panel holding the list opens: the
 * first one chosen, or the first that takes a press where none is.
 */
function focusKeyOf<T>(state: ListState<T>): Key | null {
  const chosen = state.selectionManager.firstSelectedKey

  if (chosen !== null) {
    return chosen
  }

  for (const node of state.collection) {
    if (node.type === 'item' && !state.disabledKeys.has(node.key)) {
      return node.key
    }

    if (node.type === 'section') {
      for (const row of state.collection.getChildren?.(node.key) ?? []) {
        if (!state.disabledKeys.has(row.key)) {
          return row.key
        }
      }
    }
  }

  return null
}

// The `href` a drawer's row was written with.
function hrefOf(node: Node<unknown>): string | undefined {
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- a node carries the props its row was written with, which React Stately types as `any`
  const { href }: { readonly href?: string } = node.props
  return href
}

function keptOf<T>(
  nodes: Iterable<Node<T>>,
  matches: AutocompleteValue['matches'],
): Node<T>[] {
  const kept: Node<T>[] = []

  for (const node of nodes) {
    if (node.type === 'section') {
      // oxlint-disable-next-line typescript/no-deprecated -- a filter is handed the nodes before a collection holds them, so there is none to ask
      const rows = keptOf(node.childNodes, matches)

      if (rows.some((row) => row.type === 'item')) {
        // oxlint-disable-next-line typescript/no-deprecated -- the field the collection reads a section's rows from
        kept.push({ ...node, childNodes: rows })
      }
    } else if (node.type !== 'item' || matches(node.textValue, node)) {
      kept.push({ ...node })
    }
  }

  return kept
}

// A cell's key in the `FlatList`: a header's and a row's apart, since a
// section's header carries the section's key.
function keyOf({ kind, node }: Entry) {
  return `${kind}:${String(node.key)}`
}

// The entry the collection holds for a `LoadMore` part.
function* loaderNode(props: CollectionLoadMoreProps) {
  yield { hasChildNodes: false, props, rendered: null, type: 'loader' }
}

/**
 * The row the `LoadMore` part draws: a live region, empty while idle and
 * holding the ring while loading. Android and React Native Web say what
 * arrives in it; iOS has no live regions, so the ring's name is said there
 * as it appears.
 */
function LoaderRow() {
  const own = stylesOf(useTheme())
  const {
    isLoading = false,
    label,
    style,
    testID,
  } = useCollection().loadMore ?? IDLE
  const messages = useMessages()
  const name = label ?? messages.loadingMore

  useLoadingAnnouncement(isLoading, name)

  return (
    <View
      aria-live="polite"
      style={composeStyles<ViewStyle>(
        isLoading ? own.loading : styles.idle,
        style,
      )}
      testID={testID}
    >
      {isLoading ? (
        <ProgressIndicator
          aria-label={name}
          diameter={LOADING_DIAMETER}
          isIndeterminate
          variant="circular"
        />
      ) : null}
    </View>
  )
}

// Asks for more as the reader nears the end, unless a load is under way.
function loadMoreOf({
  isLoading = false,
  onLoadMore,
}: CollectionLoadMoreProps) {
  return () => {
    if (!isLoading) {
      onLoadMore?.()
    }
  }
}

// The entry the collection holds for a tree's `Item` part: keyed by the
// row's `id`, carrying the props it is drawn from, and holding the rows
// nested in it, which the collection reads only while the row is open. What
// the row draws as its first line and what that is worth as text are the
// part's own, a Tree's headline and a NavigationTree's label.
function* nestedRowNode(
  props: {
    readonly 'aria-label'?: string
    readonly children?: ReactNode
    readonly id?: Key
  },
  rendered: ReactNode,
  textValue: string,
) {
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
    rendered,
    textValue,
    type: 'item',
  }
}

function noop() {
  // A press on a row with nothing to do runs the call site's `onPress` alone.
}

/**
 * The press handler of a row: the call site's own handler, then the row's.
 * Built by a call rather than written inline at the prop, which is what
 * react-perf's no-new-function-as-prop is after.
 */
function pressThen(
  onPress: PressableProps['onPress'],
  then: (() => void) | undefined,
) {
  return (event: GestureResponderEvent) => {
    onPress?.(event)
    then?.()
  }
}

// One cell, drawn as the part it came from.
function renderEntry({ item }: ListRenderItemInfo<Entry>) {
  return item.kind === 'header' ? (
    <SectionHeader node={item.node} />
  ) : (
    <RowNode node={item.node} />
  )
}

/**
 * How many rows a search leaves, said to a screen reader as it changes and
 * never drawn: in a polite live region on Android and under React Native
 * Web, and through `AccessibilityInfo` on iOS, which has no live regions,
 * so nothing is drawn there at all. A `count` of `null` says nothing, for a
 * list that is closed, so the count is said again as it opens.
 */
function ResultsStatus({ count }: { readonly count: null | number }) {
  const own = stylesOf(useTheme())
  const locale = useLocaleOf(undefined)
  const message = count === null ? '' : resultsFor(count, locale)

  useResultsAnnouncement(message)

  if (Platform.OS === 'ios') {
    return null
  }

  return (
    <View aria-live="polite" style={styles.status}>
      <NativeText style={own.status}>{message}</NativeText>
    </View>
  )
}

/**
 * The list's layout handler: the call site's own, then a scroll that brings
 * the row at `index` into view, once, where there is one to reveal. The row
 * goes to the bottom of the list where it was below the fold, and a row
 * already in view stays where it is: scrolled to put a row at the bottom, a
 * list never scrolls past its end, and one that would have to scroll back
 * above its start stays at the top.
 */
function revealOnLayout(
  onLayout: ((event: LayoutChangeEvent) => void) | undefined,
  {
    index,
    list,
    setRevealed,
  }: {
    readonly index: number
    readonly list: FlatList | null
    readonly setRevealed: (revealed: boolean) => void
  },
) {
  return (event: LayoutChangeEvent) => {
    onLayout?.(event)
    if (index > 0 && list !== null) {
      setRevealed(true)
      list.scrollToIndex({ animated: false, index, viewPosition: 1 })
    }
  }
}

// The route's row among a drawer's rows, found through every row, open or
// not, since a current row closed out of sight still marks its trail.
function routeMarkOf<T>(
  nodes: Iterable<Node<T>>,
  selectedRoute: string | undefined,
): RouteMark {
  const trail: Key[] = []
  const find = (level: Iterable<Node<T>>): Key | null => {
    for (const node of level) {
      if (node.type === 'item' && hrefOf(node) === selectedRoute) {
        return node.key
      }
      if (node.type === 'item') {
        trail.push(node.key)
      }
      // oxlint-disable-next-line typescript/no-deprecated -- a tree's collection holds only the rows on show, and the route may be under a closed one
      const found = find(node.childNodes)

      if (found !== null) {
        return found
      }
      if (node.type === 'item') {
        trail.pop()
      }
    }
    return null
  }
  const current = selectedRoute === undefined ? null : find(nodes)

  return { current, trail: new Set(current === null ? [] : trail) }
}

// How many rows the list holds, the ones inside sections among them.
function rowCountOf<T>(state: ListState<T>) {
  return entriesOf(state).rows
}

// The entry the collection holds for an `Item` part, as React Stately's own
// `Item` gives one: keyed by the row's `id`, and carrying the props it is
// drawn from.
function* rowNode(props: CollectionRowProps) {
  yield {
    'aria-label': props['aria-label'],
    hasChildNodes: false,
    key: props.id,
    props,
    rendered: props.children,
    textValue:
      props.textValue ??
      (typeof props.children === 'string' ? props.children : ''),
    type: 'item',
  }
}

/**
 * A row: the state layer, the ripple and the focus ring over the leading
 * slot, the lines and the trailing slot, on primary container while
 * selected, with a List's checkbox before them on a row that selects. A
 * Tree's row is indented by its depth and starts with its chevron, or a
 * chevron's space on a row with nothing under it. A row with nothing to do
 * on a press, in a collection that neither selects nor acts, is a `View`
 * that only presents.
 */
function RowNode({ node }: { readonly node: Node<unknown> }) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const collection = useCollection()
  const messages = useMessages()

  // oxlint-disable-next-line typescript/no-unsafe-assignment -- a node carries the props its row was written with, which React Stately types as `any`
  const {
    children: _children,
    headline: _headline,
    href,
    id: _id,
    isDisabled: _isDisabled,
    label: _label,
    leading,
    onAction,
    onBlur,
    onFocus,
    onHoverIn,
    onHoverOut,
    onLongPress,
    onPress,
    onPressIn,
    onPressOut,
    overline,
    ref,
    style,
    supporting,
    textValue: _textValue,
    trailing,
    ...props
  }: CollectionRowProps & {
    readonly headline?: ReactNode
    readonly href?: string
    readonly label?: ReactNode
  } = node.props
  const isList = collection.kind === 'list'
  const { route } = collection
  const openLink = useOpenLink()
  const { selectionManager } = collection.state
  const tree = expansionOf(collection.state)
  const { key } = node
  const rowRef =
    key === collection.focusKey ? refsOf(collection.onFocusTarget, ref) : ref
  // The selection manager reads a row's own `isDisabled` off its entry,
  // beside the list's `disabledKeys`, so it answers for both.
  const disabled = selectionManager.isDisabled(key)
  const checks = selectionManager.selectionMode !== 'none'
  const selectable = selectionManager.canSelectItem(key)
  const selected = checks && selectionManager.isSelected(key)
  // A drawer's row whose `href` is the route, drawn as a selected row is,
  // and the rows it sits under, whose labels are drawn bold.
  const current = route?.current === key
  const onTrail = route?.trail.has(key) === true
  const marked = selected || current
  const variant = route === undefined ? undefined : 'drawer'
  // A tree's row with rows under it, which opens and closes.
  const branch = tree !== null && node.hasChildNodes
  const expanded = branch && tree.expandedKeys.has(key)
  const toggle = toggleOf(tree, key)
  const listAction = collection.onAction
  // A row with an `href` goes there. Otherwise, React Aria's rule for a tree
  // that neither selects nor acts: a press on a row with rows under it opens
  // or closes it.
  const action =
    onAction ??
    (href === undefined
      ? listAction === undefined
        ? branch && !checks
          ? toggle
          : undefined
        : () => {
            listAction(key)
          }
      : () => {
          openLink(href)
        })
  // React Aria's rule for a touch press on a row that selects: the action
  // while nothing is selected, the selection after.
  const acts = action !== undefined && (!selectable || selectionManager.isEmpty)
  // A List's row offers the select action wherever its checkbox does; a
  // ListBox's option only where a press may run its action instead.
  const offersSelect = selectable && (isList || action !== undefined)
  // A row that opens offers the one of the two it can do, as web names its
  // chevron, and a disabled one neither.
  const opens = branch && !disabled
  const select = () => {
    selectionManager.select(key)
  }
  const content = rowContentColor(theme, {
    isDisabled: disabled,
    isSelected: marked,
    variant,
  })
  const feedback = usePressFeedback({
    color: content,
    corners: route === undefined ? undefined : own.pill,
    disabled,
    onBlur,
    onFocus,
    onHoverIn,
    onHoverOut,
    onPressIn,
    onPressOut,
  })

  const box =
    isList && checks ? (
      <SelectBox
        isDisabled={disabled}
        isSelected={selected}
        onPress={acts && selectable ? select : undefined}
      />
    ) : null
  const lead =
    tree === null
      ? box === null
        ? leading
        : withBox(box, leading, own.lead)
      : treeLead({
          box,
          // The muted role at rest, as web draws the chevron, and the row's
          // own colour where the muted role would not read.
          chevron: branch ? (
            <TreeChevron
              color={
                disabled || marked ? content : theme.colors.onSurfaceVariant
              }
              isDisabled={disabled}
              isExpanded={expanded}
              onPress={toggle}
            />
          ) : null,
          indent: node.level * theme.spacing.xl,
          leading,
          style: own.lead,
        })
  const lines = (
    <RowContent
      isDisabled={disabled}
      isEmphasized={onTrail}
      isSelected={marked}
      leading={lead}
      overline={overline}
      supporting={supporting}
      trailing={trailing}
      variant={variant}
    >
      {node.rendered}
    </RowContent>
  )
  const rowStyle = rowStyleOf(theme, {
    isSelected: marked,
    overline,
    supporting,
    variant,
  })
  const accessibilityActions = [
    ...(offersSelect
      ? [{ label: collection.selectLabel, name: 'select' }]
      : []),
    ...(opens
      ? [
          expanded
            ? { label: messages.collapse, name: 'collapse' }
            : { label: messages.expand, name: 'expand' },
        ]
      : []),
  ]

  if (!checks && action === undefined && onPress === undefined) {
    return (
      <View
        aria-disabled={disabled || undefined}
        ref={rowRef}
        style={composeStyles<ViewStyle>(rowStyle, style)}
        testID={props.testID}
      >
        {lines}
      </View>
    )
  }

  return (
    <Pressable
      role={href === undefined ? 'button' : 'link'}
      {...props}
      {...(checks ? toggleState(selected) : undefined)}
      {...(route === undefined ? undefined : currentState(current))}
      {...(branch ? { 'aria-expanded': expanded } : undefined)}
      {...(accessibilityActions.length > 0
        ? {
            accessibilityActions,
            onAccessibilityAction: accessibilityActionOf({
              collapse: opens && expanded ? toggle : undefined,
              expand: opens && !expanded ? toggle : undefined,
              select: offersSelect ? select : undefined,
            }),
          }
        : undefined)}
      {...feedback.handlers}
      disabled={disabled}
      onLongPress={
        action !== undefined && selectable
          ? pressThen(onLongPress, select)
          : onLongPress
      }
      onPress={pressThen(onPress, acts ? action : selectable ? select : noop)}
      ref={rowRef}
      style={composeStyles<ViewStyle>(
        rowStyle,
        feedback.ring,
        feedback.ring === undefined ? undefined : rowStyles.ring,
        style,
      )}
    >
      {feedback.layer}
      {lines}
    </Pressable>
  )
}

/**
 * Where a row the list has not measured yet is reached: as far down as rows
 * of the average height would put it, which a `FlatList` asks for in place
 * of scrolling to a row it cannot place.
 */
function scrollNear(list: FlatList | null) {
  return ({ averageItemLength, index }: ScrollFailure) => {
    list?.scrollToOffset({
      animated: false,
      offset: averageItemLength * index,
    })
  }
}

/**
 * A section's heading: on a List's ground, so the rows pass under it as it
 * sticks, and on none in a ListBox, where it scrolls with them.
 */
function SectionHeader({ node }: { readonly node: Node<unknown> }) {
  const own = stylesOf(useTheme())
  const { ground, kind } = useCollection()
  const drawer = kind === 'drawer'
  // The lists page's subhead is title small, and the drawer page's label
  // large.
  const title = useTypeRole(drawer ? 'labelLarge' : 'titleSmall')

  return (
    <View
      style={
        ground === undefined
          ? undefined
          : composeStyles<ViewStyle>({ backgroundColor: ground })
      }
    >
      <NativeText
        role="heading"
        style={composeStyles<TextStyle>(
          title,
          drawer ? own.drawerHeader : own.header,
        )}
      >
        {node.rendered}
      </NativeText>
    </View>
  )
}

// The entry the collection holds for a `Section` part.
function* sectionNode(props: CollectionSectionProps) {
  const children = childElementsOf(props.children)

  yield {
    *childNodes() {
      for (const element of children) {
        yield { element }
      }
    },
    hasChildNodes: true,
    key: props.id,
    props,
    rendered: props.header,
    type: 'section',
  }
}

/**
 * The checkbox a List's selecting row draws, for the eye alone: the row is
 * what a screen reader hears and presses. On a row whose press runs an
 * action, a touch on the box selects instead, through a press of its own the
 * size of a 48dp target, hidden from the reader as the box is.
 */
function SelectBox({
  isDisabled,
  isSelected,
  onPress,
}: {
  readonly isDisabled: boolean
  readonly isSelected: boolean
  readonly onPress: (() => void) | undefined
}) {
  const drawn = (
    <CheckboxBox
      isDisabled={isDisabled}
      isSelected={isSelected}
      within={BOX_SLOT}
    />
  )

  if (onPress === undefined) {
    return <View style={styles.box}>{drawn}</View>
  }

  return (
    <Pressable
      accessible={false}
      aria-hidden
      disabled={isDisabled}
      focusable={false}
      hitSlop={hitSlop(BOX_SLOT, BOX_SLOT)}
      onPress={onPress}
      style={styles.box}
      tabIndex={-1}
    >
      {drawn}
    </Pressable>
  )
}

/**
 * Opens a tree's row, or closes it when it is open. Built by a call rather
 * than written inline, which is what react-perf's
 * no-new-function-as-prop is after.
 */
function toggleOf(tree: null | TreeState<unknown>, key: Key) {
  return () => {
    tree?.toggleKey(key)
  }
}

/**
 * The chevron a Tree's row with rows under it draws, which opens and closes
 * it, for the eye and the finger alone: the row is what a screen reader
 * hears, and opens or closes through its actions. It takes a press of its
 * own the size of a 48dp target, and draws no state layer, since the row
 * around it already carries one.
 */
function TreeChevron({
  color,
  isDisabled,
  isExpanded,
  onPress,
}: {
  readonly color: ColorValue
  readonly isDisabled: boolean
  readonly isExpanded: boolean
  readonly onPress: () => void
}) {
  return (
    <Pressable
      accessible={false}
      aria-hidden
      disabled={isDisabled}
      focusable={false}
      hitSlop={hitSlop(BOX_SLOT, BOX_SLOT)}
      onPress={onPress}
      style={styles.box}
      tabIndex={-1}
    >
      <ExpandChevron color={color} isExpanded={isExpanded} />
    </Pressable>
  )
}

/**
 * The leading slot of a Tree's row: its chevron, or the chevron's space on a
 * row with nothing under it so its headline lines up with one that opens,
 * then the checkbox of a tree that selects, then whatever the row was given,
 * all set in by the row's depth, a chevron's width a level.
 */
function treeLead({
  box,
  chevron,
  indent,
  leading,
  style,
}: {
  readonly box: ReactNode
  readonly chevron: ReactNode
  readonly indent: number
  readonly leading: ReactNode
  readonly style: StyleProp<ViewStyle>
}): ReactNode {
  return (
    <View style={composeStyles<ViewStyle>(style, { marginStart: indent })}>
      {chevron ?? <View style={styles.box} />}
      {box}
      {leading}
    </View>
  )
}

// The collection a cell is drawn in. Every cell is the `FlatList`'s, inside
// the collection's own provider, so there always is one.
function useCollection(): CollectionValue {
  const collection = use(CollectionContext)

  if (collection === null) {
    throw new Error('A List or ListBox part is drawn by the one it is in.')
  }
  return collection
}

// Says the ring's name on iOS as it appears. A list loading as it mounts
// says nothing, as a live region does not read what it was mounted holding.
function useLoadingAnnouncement(isLoading: boolean, label: string) {
  const was = useRef(isLoading)

  useEffect(() => {
    if (isLoading && !was.current && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(label)
    }
    was.current = isLoading
  }, [isLoading, label])
}

// Says how many rows are left on iOS each time the count changes. The count
// a list mounts with is not said, as a live region does not read what it was
// mounted holding, and an empty message says nothing.
function useResultsAnnouncement(message: string) {
  const was = useRef(message)

  useEffect(() => {
    if (message !== was.current && message !== '' && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(message)
    }
    was.current = message
  }, [message])
}

/**
 * The leading slot of a List's row that selects: the checkbox, then whatever
 * the row was given, in a row of their own so the two sit side by side.
 */
function withBox(
  box: ReactElement,
  leading: ReactNode,
  style: StyleProp<ViewStyle>,
): ReactNode {
  return hasContent(leading) ? (
    <View style={style}>
      {box}
      {leading}
    </View>
  ) : (
    box
  )
}

export {
  Collection,
  CollectionView,
  focusKeyOf,
  loaderNode,
  nestedRowNode,
  ResultsStatus,
  rowCountOf,
  rowNode,
  sectionNode,
}
export type {
  CollectionKind,
  CollectionLoadMoreProps,
  CollectionProps,
  CollectionRowProps,
  CollectionSectionProps,
  CollectionViewProps,
}
