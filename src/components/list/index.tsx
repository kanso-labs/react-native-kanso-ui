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

import type { ResolvedTheme } from '../../theme/scope'

import { toggleState } from '../../button'
import { CheckboxBox } from '../../control/checkbox-box'
import { messagesFor } from '../../i18n'
import { hitSlop, usePressFeedback } from '../../press'
import {
  hasContent,
  RowContent,
  rowContentColor,
  rowStyleOf,
  rowStyles,
} from '../../row'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'
import { ProgressIndicator } from '../progress-indicator'

// kanso-ui's List, from the lists page: a column of the rows ListItem draws,
// shared through src/row, with selection, an action per row, sections and a
// row that loads more. It is a `FlatList`, so a long list draws the rows in
// view and a few screens either side rather than every row it holds.
//
// Four things differ from web's, each because a screen reader or a touch on
// a phone works differently from a keyboard in a browser.
//
// **A row is one element to a screen reader.** Web's row is a grid row whose
// checkbox is a cell a keyboard reaches on its own. VoiceOver and TalkBack
// read a pressable row as one element and reach nothing inside it, so the
// row is a button that reports whether it is selected, and selecting it is an
// accessibility action named by `selectLabel`, which is what web's checkbox
// is named by. The checkbox is drawn for the eye and hidden from the reader.
// Under React Native Web the row reports itself pressed instead, as a toggle
// button does, since a button cannot be selected there.
//
// **A press does what React Aria's touch press does.** On a row that selects
// and has no action, a press selects it. On one with an action, a press runs
// the action while nothing is selected and selects once something is, and a
// long press selects; a press on the checkbox selects either way.
//
// **Sections are flattened, with sticky headers.** A `FlatList` holds one
// column of cells, so a section is its header, which stays at the top while
// its rows scroll under it, and then its rows. The header is a heading to a
// screen reader rather than the name of a group.
//
// **The list is drawn on surface,** the lists page's container colour, which
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

// What the loading row reads when the list has no `List.LoadMore`, which
// leaves it nothing to draw.
const IDLE: ListLoadMoreProps = {}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    height: BOX_SLOT,
    justifyContent: 'center',
    width: BOX_SLOT,
  },
  // What `List.LoadMore` leaves while nothing is loading: the live region,
  // with nothing in it and no height.
  idle: {
    height: 0,
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
  }),
)

/** One cell of the `FlatList`: a section's header, or a row. */
type ListEntry = {
  readonly kind: 'header' | 'item'
  readonly node: Node<unknown>
}

type ListLoadMoreProps = {
  /**
   * Draws the ring in a row of its own while more items are being fetched.
   * @default false
   */
  readonly isLoading?: boolean
  /**
   * What a screen reader calls the ring, and hears as it appears. Left out,
   * it is the word for it in the device's language, "Loading more" in
   * English.
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

type ListProps<T extends object = object> = Omit<
  ScrollViewProps,
  'children' | 'role' | 'stickyHeaderIndices' | 'style'
> & {
  /**
   * The rows, each a `List.Item`, `List.Section` or `List.LoadMore`. With
   * `items`, a function from an item to its part, called for each item in
   * turn.
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
   * out, it is a muted row saying "No results" in the device's language, so
   * the list keeps a row's height.
   */
  readonly renderEmptyState?: () => ReactNode
  /**
   * The selected keys, for a call site holding the selection itself with
   * `onSelectionChange`.
   */
  readonly selectedKeys?: 'all' | Iterable<Key>
  /**
   * Whether rows can be selected: one at a time, several, or none. A list
   * that selects draws a checkbox on every row.
   * @default 'none'
   */
  readonly selectionMode?: SelectionMode
  /**
   * What selecting a row is called, for a screen reader: the accessibility
   * action each selectable row offers, which is what its checkbox does. The
   * row's own text is what names the row. Left out, it is the word for it in
   * the device's language, "Select" in English.
   */
  readonly selectLabel?: string
  readonly style?: StyleProp<ViewStyle>
}

// `Row` rather than `Item`, though the part is `List.Item`, for the reason
// web gives: `ListItemProps` is the standalone ListItem's, and both are
// exported from the package.
type ListRowProps = Omit<
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

type ListSectionProps = {
  /** The rows in the section. */
  readonly children?: ReactNode
  /**
   * The section's heading, which stays at the top of the list while the
   * section's rows scroll under it. A section without one is its rows alone.
   */
  readonly header?: ReactNode
  readonly id?: Key
}

// What the cells of the `FlatList` read from the list they are drawn in.
type ListValue = {
  /** The ground a sticky header covers the rows under it with. */
  readonly ground: ColorValue
  /** The `List.LoadMore` the list ends in, if it has one. */
  readonly loadMore: ListLoadMoreProps | undefined
  readonly onAction: ((key: Key) => void) | undefined
  readonly renderEmptyState: () => ReactNode
  readonly selectLabel: string
  readonly state: ListState<unknown>
}

const ListContext = createContext<ListValue | null>(null)

/**
 * A list of rows, one or more of which can be selected. Selection is React
 * Stately's, as web's is React Aria's: set `selectionMode` to `single` or
 * `multiple`, and pass `selectedKeys` with `onSelectionChange` to control
 * it or `defaultSelectedKeys` to let it keep its own. A list whose rows do
 * something takes `onAction`, or an `onAction` on each row.
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
 * `scrollEnabled={false}` and is laid out at its full length. `style` and
 * `ref` land on the `FlatList`.
 */
function List<T extends object = object>({
  children,
  contentContainerStyle,
  defaultSelectedKeys,
  disabledKeys,
  disallowEmptySelection,
  items,
  onAction,
  onSelectionChange,
  ref,
  renderEmptyState = emptyState,
  selectedKeys,
  selectionMode = 'none',
  selectLabel,
  style,
  ...props
}: ListProps<T>) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const state = useListState<T>({
    // Each part builds its own entry in the collection; see the parts'
    // `getCollectionNode`. The collection skips what is not an element, as a
    // ReactNode may be, and asks any element for its entry.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    children: children as StatelyListProps<T>['children'],
    defaultSelectedKeys,
    disabledKeys,
    disallowEmptySelection,
    items,
    onSelectionChange,
    selectedKeys,
    selectionMode,
  })
  const { entries, loader, sticky } = useMemo(() => entriesOf(state), [state])
  const listStyle = composeStyles<ViewStyle>(own.list, style)
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- a node carries the props its part was written with, which React Stately types as `any`
  const loadMore: ListLoadMoreProps | undefined = loader?.props
  const isLoading = loadMore?.isLoading ?? false
  // The list's own ground unless `style` gives it another.
  const ground =
    StyleSheet.flatten(style)?.backgroundColor ?? theme.colors.surface
  const value = useMemo<ListValue>(
    () => ({
      ground,
      loadMore,
      onAction,
      renderEmptyState,
      selectLabel: selectLabel ?? messagesFor().select,
      state,
    }),
    [ground, loadMore, onAction, renderEmptyState, selectLabel, state],
  )

  return (
    <ListContext value={value}>
      <FlatList
        {...props}
        contentContainerStyle={composeStyles<ViewStyle>(
          own.content,
          contentContainerStyle,
        )}
        data={entries}
        keyExtractor={keyOf}
        ListEmptyComponent={isLoading ? undefined : EmptyState}
        ListFooterComponent={loadMore === undefined ? undefined : LoaderRow}
        onEndReached={loadMore === undefined ? undefined : loadMoreOf(loadMore)}
        onEndReachedThreshold={loadMore?.scrollOffset ?? LOAD_OFFSET}
        ref={ref}
        renderItem={renderEntry}
        stickyHeaderIndices={sticky}
        style={listStyle}
      />
    </ListContext>
  )
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

ListLoadMore.getCollectionNode = function* getCollectionNode(
  props: ListLoadMoreProps,
) {
  yield { hasChildNodes: false, props, rendered: null, type: 'loader' }
}

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

// The entry the collection holds for a row, as React Stately's own `Item`
// gives one: keyed by the row's `id`, and carrying the props it is drawn
// from.
ListRow.getCollectionNode = function* getCollectionNode(props: ListRowProps) {
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
 * A group of rows under a heading, which stays at the top of the list while
 * the group's rows scroll under it.
 */
function ListSection(_props: ListSectionProps): null {
  return null
}

ListSection.getCollectionNode = function* getCollectionNode(
  props: ListSectionProps,
) {
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
 * The muted row a list shows when nothing is in it: a row's box and
 * headline in on surface variant, with no press of its own.
 */
function EmptyRow() {
  const theme = useTheme()
  const own = stylesOf(theme)
  const headline = useTypeRole('bodyLarge')

  return (
    <View style={rowStyleOf(theme, {})}>
      <NativeText style={composeStyles<TextStyle>(headline, own.empty)}>
        {messagesFor().noResults}
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
  return <>{useList().renderEmptyState()}</>
}

/**
 * The cells the `FlatList` draws, in order, and where the headers among
 * them are: the rows outside any section, and each section's header
 * followed by its rows. The row that loads more is drawn after them all.
 */
function entriesOf<T>(state: ListState<T>) {
  const entries: ListEntry[] = []
  const sticky: number[] = []
  let loader: Node<T> | undefined

  for (const node of state.collection) {
    if (node.type === 'loader') {
      loader = node
    } else if (node.type === 'section') {
      if (hasContent(node.rendered)) {
        sticky.push(entries.length)
        entries.push({ kind: 'header', node })
      }
      const rows =
        state.collection.getChildren?.(node.key) ??
        // oxlint-disable-next-line typescript/no-deprecated -- a fallback for a collection without getChildren
        node.childNodes
      for (const row of rows) {
        entries.push({ kind: 'item', node: row })
      }
    } else {
      entries.push({ kind: 'item', node })
    }
  }

  return { entries, loader, sticky }
}

// A cell's key in the `FlatList`: a header's and a row's apart, since a
// section's header carries the section's key.
function keyOf({ kind, node }: ListEntry) {
  return `${kind}:${String(node.key)}`
}

/**
 * A row: the state layer, the ripple and the focus ring over the checkbox,
 * the leading slot, the lines and the trailing slot, on primary container
 * while selected. A row with nothing to do on a press, in a list that
 * neither selects nor acts, is a `View` that only presents.
 */
function ListRowNode({ node }: { readonly node: Node<unknown> }) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const list = useList()

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
  }: ListRowProps = node.props
  const { selectionManager } = list.state
  const { key } = node
  // The selection manager reads a row's own `isDisabled` off its entry,
  // beside the list's `disabledKeys`, so it answers for both.
  const disabled = selectionManager.isDisabled(key)
  const checks = selectionManager.selectionMode !== 'none'
  const selectable = selectionManager.canSelectItem(key)
  const selected = checks && selectionManager.isSelected(key)
  const listAction = list.onAction
  const action =
    onAction ??
    (listAction === undefined
      ? undefined
      : () => {
          listAction(key)
        })
  // React Aria's rule for a touch press on a row that selects with a
  // checkbox: the action while nothing is selected, the selection after.
  const acts = action !== undefined && (!selectable || selectionManager.isEmpty)
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

  const lead = checks
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
      {...(selectable
        ? {
            accessibilityActions: [{ label: list.selectLabel, name: 'select' }],
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
 * The row `List.LoadMore` draws: a live region, empty while idle and
 * holding the ring while loading. Android and React Native Web say what
 * arrives in it; iOS has no live regions, so the ring's name is said there
 * as it appears.
 */
function LoaderRow() {
  const own = stylesOf(useTheme())
  const { isLoading = false, label, style, testID } = useList().loadMore ?? IDLE
  const name = label ?? messagesFor().loadingMore

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
function loadMoreOf({ isLoading = false, onLoadMore }: ListLoadMoreProps) {
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
function renderEntry({ item }: ListRenderItemInfo<ListEntry>) {
  return item.kind === 'header' ? (
    <SectionHeader node={item.node} />
  ) : (
    <ListRowNode node={item.node} />
  )
}

/** A section's heading, on the list's ground so the rows pass under it. */
function SectionHeader({ node }: { readonly node: Node<unknown> }) {
  const own = stylesOf(useTheme())
  const title = useTypeRole('titleSmall')
  const { ground } = useList()

  return (
    <View style={composeStyles<ViewStyle>({ backgroundColor: ground })}>
      <NativeText
        role="heading"
        style={composeStyles<TextStyle>(title, own.header)}
      >
        {node.rendered}
      </NativeText>
    </View>
  )
}

/**
 * The checkbox a selecting row draws, for the eye alone: the row is what a
 * screen reader hears and presses. On a row whose press runs an action, a
 * touch on the box selects instead, through a press of its own the size of
 * a 48dp target, hidden from the reader as the box is.
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

// The list a cell is drawn in. Every cell is the `FlatList`'s, inside the
// list's own provider, so there always is one.
function useList(): ListValue {
  const list = use(ListContext)

  if (list === null) {
    throw new Error('A List part is drawn by the List it is in.')
  }
  return list
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

/**
 * The leading slot of a row that selects: the checkbox, then whatever the
 * row was given, in a row of their own so the two sit side by side.
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

List.Item = ListRow
List.LoadMore = ListLoadMore
List.Section = ListSection

export { List, ListLoadMore, ListRow, ListSection }
export type { ListLoadMoreProps, ListProps, ListRowProps, ListSectionProps }
