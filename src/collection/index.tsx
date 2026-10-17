import type { ReactElement, ReactNode, Ref } from 'react'
import type {
  AccessibilityActionEvent,
  ColorValue,
  GestureResponderEvent,
  HostInstance,
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

import { Children, createContext, use, useEffect, useMemo, useRef } from 'react'
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
import { resultsFor } from '../i18n'
import { useLocaleOf, useMessages } from '../i18n/provider'
import { hitSlop, usePressFeedback } from '../press'
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
// transparent, so the same one sits on a page and inside a popover.
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
// **Sections are flattened.** A `FlatList` holds one column of cells, so a
// section is its header and then its rows, and the header is a heading to a
// screen reader rather than the name of a group. A List's headers stay at the
// top while their rows scroll under them. A ListBox's scroll with the rows,
// since it has no ground to cover them with.
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

// What the loading row reads when the collection has no `LoadMore` part,
// which leaves it nothing to draw.
const IDLE: CollectionLoadMoreProps = {}

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

const stylesOf = themedStyles(({ colors, sizing, spacing }: ResolvedTheme) =>
  StyleSheet.create({
    // The 8dp above the first row and below the last, as web's container
    // draws them.
    content: {
      paddingVertical: spacing.sm,
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
    // Never seen, but in a pair that reads, for a checker that looks.
    status: {
      color: colors.onSurface,
    },
  }),
)

/**
 * Which component draws the collection: a List, whose rows that select carry
 * a checkbox and whose ground is surface, or a ListBox, whose options carry
 * none and which has no ground.
 */
type CollectionKind = 'list' | 'listbox'

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

// What the cells of the `FlatList` read from the collection they are drawn
// in.
type CollectionValue = {
  /**
   * The ground a List's sticky header covers the rows under it with, and
   * none for a ListBox, whose headers do not stick.
   */
  readonly ground: ColorValue | undefined
  readonly kind: CollectionKind
  /** The `LoadMore` part the collection ends in, if it has one. */
  readonly loadMore: CollectionLoadMoreProps | undefined
  readonly onAction: ((key: Key) => void) | undefined
  readonly renderEmptyState: () => ReactNode
  readonly selectLabel: string
  readonly state: ListState<unknown>
}

/** One cell of the `FlatList`: a section's header, or a row. */
type Entry = {
  readonly kind: 'header' | 'item'
  readonly node: Node<unknown>
}

const CollectionContext = createContext<CollectionValue | null>(null)

/**
 * The `FlatList` List and ListBox draw, from parts read off its children by
 * React Stately's list state. Inside an `Autocomplete`, it shows the rows the
 * search keeps and says how many there are to a screen reader, and a tap on
 * a row reaches it while the keyboard is up.
 */
function Collection<T extends object = object>({
  children,
  contentContainerStyle,
  defaultSelectedKeys,
  disabledKeys,
  disallowEmptySelection,
  items,
  keyboardShouldPersistTaps,
  kind,
  onAction,
  onSelectionChange,
  ref,
  renderEmptyState = emptyState,
  selectedKeys,
  selectionMode = 'none',
  selectLabel,
  style,
  ...props
}: CollectionProps<T> & { readonly kind: CollectionKind }) {
  const theme = useTheme()
  const own = stylesOf(theme)
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
  const { entries, loader, rows, sticky } = useMemo(
    () => entriesOf(state),
    [state],
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
      ground,
      kind,
      loadMore,
      onAction,
      renderEmptyState,
      selectLabel: selectLabel ?? messages.select,
      state,
    }),
    [
      ground,
      kind,
      loadMore,
      messages,
      onAction,
      renderEmptyState,
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
        keyboardShouldPersistTaps={
          keyboardShouldPersistTaps ??
          (autocomplete === null ? undefined : 'handled')
        }
        keyExtractor={keyOf}
        ListEmptyComponent={isLoading ? undefined : EmptyState}
        ListFooterComponent={loadMore === undefined ? undefined : LoaderRow}
        onEndReached={loadMore === undefined ? undefined : loadMoreOf(loadMore)}
        onEndReachedThreshold={loadMore?.scrollOffset ?? LOAD_OFFSET}
        ref={ref}
        renderItem={renderEntry}
        stickyHeaderIndices={isList ? sticky : undefined}
        style={listStyle}
      />
      {autocomplete === null ? null : <ResultsStatus count={rows} />}
    </CollectionContext>
  )
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
 * section's header followed by its rows. The row that loads more is drawn
 * after them all.
 */
function entriesOf<T>(state: ListState<T>) {
  const entries: Entry[] = []
  const sticky: number[] = []
  let loader: Node<T> | undefined
  let rows = 0

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
        entries.push({ kind: 'item', node: row })
        rows++
      }
    } else {
      entries.push({ kind: 'item', node })
      rows++
    }
  }

  return { entries, loader, rows, sticky }
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
 * so nothing is drawn there at all.
 */
function ResultsStatus({ count }: { readonly count: number }) {
  const own = stylesOf(useTheme())
  const locale = useLocaleOf(undefined)
  const message = resultsFor(count, locale)

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
 * selected, with a List's checkbox before them on a row that selects. A row
 * with nothing to do on a press, in a collection that neither selects nor
 * acts, is a `View` that only presents.
 */
function RowNode({ node }: { readonly node: Node<unknown> }) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const collection = useCollection()

  // oxlint-disable-next-line typescript/no-unsafe-assignment -- a node carries the props its row was written with, which React Stately types as `any`
  const {
    children,
    id: _id,
    isDisabled: _isDisabled,
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
  }: CollectionRowProps = node.props
  const isList = collection.kind === 'list'
  const { selectionManager } = collection.state
  const { key } = node
  // The selection manager reads a row's own `isDisabled` off its entry,
  // beside the list's `disabledKeys`, so it answers for both.
  const disabled = selectionManager.isDisabled(key)
  const checks = selectionManager.selectionMode !== 'none'
  const selectable = selectionManager.canSelectItem(key)
  const selected = checks && selectionManager.isSelected(key)
  const listAction = collection.onAction
  const action =
    onAction ??
    (listAction === undefined
      ? undefined
      : () => {
          listAction(key)
        })
  // React Aria's rule for a touch press on a row that selects: the action
  // while nothing is selected, the selection after.
  const acts = action !== undefined && (!selectable || selectionManager.isEmpty)
  // A List's row offers the select action wherever its checkbox does; a
  // ListBox's option only where a press may run its action instead.
  const offersSelect = selectable && (isList || action !== undefined)
  const select = () => {
    selectionManager.select(key)
  }
  const content = rowContentColor(theme, {
    isDisabled: disabled,
    isSelected: selected,
  })
  const feedback = usePressFeedback({
    color: content,
    disabled,
    onBlur,
    onFocus,
    onHoverIn,
    onHoverOut,
    onPressIn,
    onPressOut,
  })

  const lead =
    isList && checks
      ? withBox(
          <SelectBox
            isDisabled={disabled}
            isSelected={selected}
            onPress={acts && selectable ? select : undefined}
          />,
          leading,
          own.lead,
        )
      : leading
  const lines = (
    <RowContent
      isDisabled={disabled}
      isSelected={selected}
      leading={lead}
      overline={overline}
      supporting={supporting}
      trailing={trailing}
    >
      {children}
    </RowContent>
  )
  const rowStyle = rowStyleOf(theme, {
    isSelected: selected,
    overline,
    supporting,
  })

  if (!checks && action === undefined && onPress === undefined) {
    return (
      <View
        aria-disabled={disabled || undefined}
        ref={ref}
        style={composeStyles<ViewStyle>(rowStyle, style)}
        testID={props.testID}
      >
        {lines}
      </View>
    )
  }

  return (
    <Pressable
      role="button"
      {...props}
      {...(checks ? toggleState(selected) : undefined)}
      {...(offersSelect
        ? {
            accessibilityActions: [
              { label: collection.selectLabel, name: 'select' },
            ],
            onAccessibilityAction: selectionActionOf(select),
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
      ref={ref}
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
 * A section's heading: on a List's ground, so the rows pass under it as it
 * sticks, and on none in a ListBox, where it scrolls with them.
 */
function SectionHeader({ node }: { readonly node: Node<unknown> }) {
  const own = stylesOf(useTheme())
  const title = useTypeRole('titleSmall')
  const { ground } = useCollection()

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
        style={composeStyles<TextStyle>(title, own.header)}
      >
        {node.rendered}
      </NativeText>
    </View>
  )
}

// The entry the collection holds for a `Section` part.
function* sectionNode(props: CollectionSectionProps) {
  const children: ReactNode[] = []

  // Walked as React Stately's own Section walks them, which leaves each
  // child its own key rather than the one `Children.toArray` gives it.
  Children.forEach(props.children, (child) => {
    if (child !== null && child !== undefined && child !== false) {
      children.push(child)
    }
  })

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

// Runs the selection when a screen reader asks for the row's select action.
function selectionActionOf(select: () => void) {
  return (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'select') {
      select()
    }
  }
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
// mounted holding.
function useResultsAnnouncement(message: string) {
  const was = useRef(message)

  useEffect(() => {
    if (message !== was.current && Platform.OS === 'ios') {
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

export { Collection, loaderNode, rowNode, sectionNode }
export type {
  CollectionKind,
  CollectionLoadMoreProps,
  CollectionProps,
  CollectionRowProps,
  CollectionSectionProps,
}
