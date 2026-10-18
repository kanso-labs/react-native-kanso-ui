import type { ReactElement, ReactNode, Ref } from 'react'
import type {
  AccessibilityActionEvent,
  ColorValue,
  HostInstance,
  LayoutChangeEvent,
  ListRenderItemInfo,
  PressableProps,
  ScrollViewProps,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
import type { GestureType } from 'react-native-gesture-handler'
import type {
  DisabledBehavior,
  Key,
  Node,
  Selection,
  SelectionMode,
  SortDescriptor,
} from 'react-stately'
import type {
  ColumnSize,
  ColumnStaticSize,
  TableColumnResizeState,
  TableState,
  TableStateProps,
} from 'react-stately/useTableState'

import {
  Children,
  createContext,
  isValidElement,
  use,
  useMemo,
  useState,
} from 'react'
import {
  FlatList,
  I18nManager,
  Text as NativeText,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import {
  useTableColumnResizeState,
  useTableState,
} from 'react-stately/useTableState'

import type { CollectionLoadMoreProps } from '../../collection'
import type { ResolvedTheme } from '../../theme/scope'

import { toggleState } from '../../button'
import {
  accessibilityActionOf,
  childElementsOf,
  LoadingRow,
  loadMoreOf,
  noop,
  pressThen,
  SelectBox,
  Status,
} from '../../collection'
import { LAYER_SIZE } from '../../control/styles'
import { ArrowDownwardGlyph, ArrowUpwardGlyph } from '../../glyphs'
import { IconStyleContext } from '../../glyphs/icon-style'
import { columnSizeFor, sortedFor } from '../../i18n'
import { useLocaleOf, useMessages } from '../../i18n/provider'
import { usePressFeedback } from '../../press'
import { useOpenLink } from '../../router'
import { rowContentColor, rowStyles } from '../../row/styles'
import { ADJUSTABLE, SLOP_RANGE } from '../../slider'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'
import { Checkbox } from '../checkbox'

// kanso-ui's Table: a grid of rows and columns, with sorting, selection,
// resizing, a footer and a row that loads more. The design system carries no
// data table page, so web draws it from the archived one at
// <https://m2.material.io/components/data-tables>, and so does this: a 56dp
// header row in label large and the muted role, 52dp body rows in body
// medium, 16dp of padding at each side of a cell, a rule between rows and
// under the header, and an arrow beside the name of the column being sorted.
// Its colour roles are the current system's, and a row's state layers and
// selected container are the ones a list row takes, written from the same
// tokens, as web's are. The state is React Stately's table state, which web's
// React Aria builds on, so the columns, rows, selection and sort are kept as
// web keeps them, and the widths are worked out by React Stately's column
// layout, `fr` widths and all.
//
// Four things differ from web's, each because a screen reader or a touch on
// a phone works differently from a keyboard in a browser.
//
// **A row is one element to a screen reader**, as a List's row is. VoiceOver
// and TalkBack read a pressable row as one element and reach nothing inside
// it, and announce neither a grid nor a cell, so a row is a button that reads
// its cells in turn and reports whether it is selected, and a row's
// checkbox is drawn for the eye: selecting a row from a screen reader is an
// accessibility action named by `selectLabel`. `isRowHeader` is kept for a
// call site written for both libraries, and says nothing on native. A press
// does what React Aria's touch press does, as on a List's row: it selects a
// row that has no action, and on one that has, runs the action while nothing
// is selected and selects once something is, and a long press selects.
//
// **A sortable column says how it sorts in its name.** Neither platform reads
// web's `aria-sort`, so a sortable column's header is a button whose name is
// its own, then "sortable column", then the direction it sorts in while it is
// the sorted one, which is what React Aria says on Android for the same
// reason. Once the rows are sorted, the sort is said as React Aria says it.
//
// **The header sticks by being drawn outside the rows.** The rows are a
// `FlatList`, and `stickyHeader` draws the header above it rather than as its
// first cell, so the rows scroll under nothing and the header needs no ground
// of its own to hide them. The table scrolls sideways as one when its columns
// are wider than it is, header and footer with the rows.
//
// **A resize handle is a slider to a screen reader.** Web's handle is a
// slider a keyboard steps with its arrow keys; this one takes a drag along
// the header, and a screen reader steps it by 10dp, React Aria's step for a
// key, through its increment and decrement actions. The handles are drawn
// over the header row, after its columns, so each is above the column it
// reaches into.

// The archived page's body row, which no token carries.
const ROW_HEIGHT = 52

// The arrow beside a sorted column's name, at the 18dp web draws it at.
const ARROW_SIZE = 18

// The target a resize handle takes, centred on the column's trailing edge,
// and the one past the last column, which keeps the half inside it, as web
// clips it there.
const HANDLE = 24

// How far a screen reader's step moves a column's edge, React Aria's step for
// a key.
const RESIZE_STEP = 10

// The width a column takes before anything says otherwise, and the narrowest
// it is drawn, React Stately's own defaults.
const FLEXIBLE = '1fr'
const MIN_WIDTH = 75

const styles = StyleSheet.create({
  // The header, the rows and the footer, as wide as the columns together.
  grid: {
    flexDirection: 'column',
  },
  // A column's handle, a target across the header's height.
  handle: {
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: HANDLE,
  },
  handleLast: {
    width: HANDLE / 2,
  },
  // Over the header's columns, taking no press but its handles'.
  handles: {
    bottom: 0,
    left: 0,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  // The divider's own rule, inside the column it ends, as web draws it, so a
  // column's edge is one line whether or not it can be dragged.
  rule: {
    bottom: 0,
    end: HANDLE / 2,
    position: 'absolute',
    top: 0,
    width: 1,
  },
  ruleLast: {
    end: 0,
  },
  // A checkbox's column, centred in the 16dp either side.
  selection: {
    alignItems: 'center',
  },
})

const stylesOf = themedStyles(({ colors, sizing, spacing }: ResolvedTheme) =>
  StyleSheet.create({
    // The page's 16dp at each side, which is also what puts 32dp between
    // two columns.
    cell: {
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    // What the body shows in place of rows: muted, padded and centred, as
    // web's box is.
    empty: {
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xxl,
    },
    emptyText: {
      color: colors.onSurfaceVariant,
      textAlign: 'center',
    },
    // The footer's own rule above it, since its first row drops the rule
    // every first row drops.
    footer: {
      borderTopColor: colors.outlineVariant,
      borderTopWidth: 1,
    },
    footerText: {
      color: colors.onSurfaceVariant,
    },
    // The page's 56dp header, and the rule under it.
    header: {
      borderBottomColor: colors.outlineVariant,
      borderBottomWidth: 1,
      flexDirection: 'row',
      minHeight: sizing.rowSm,
    },
    // The name and its arrow, after the name as the page puts it.
    headerContent: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    headerText: {
      color: colors.onSurfaceVariant,
      flexShrink: 1,
    },
    // The ring while more rows are fetched, at a body row's height, so the
    // table does not jump as they replace it.
    loading: {
      minHeight: ROW_HEIGHT,
    },
    // The page's 52dp row.
    row: {
      flexDirection: 'row',
      minHeight: ROW_HEIGHT,
    },
    // The rule above a row, dropped on the first of a group, where the
    // header's own rule or the table's edge already is.
    rowRule: {
      borderTopColor: colors.outlineVariant,
      borderTopWidth: 1,
    },
    ruleLine: {
      backgroundColor: colors.outlineVariant,
    },
    // Thickened and in primary while it is dragged, inward, into the column
    // being sized.
    ruleResizing: {
      backgroundColor: colors.primary,
      width: 2,
    },
    selected: {
      backgroundColor: colors.primaryContainer,
    },
  }),
)

/**
 * What a part's entry is built with: the columns the header has given so
 * far, which a row reads its cells against.
 */
type BuilderContext = {
  columns: Node<unknown>[]
}

/** A cell's entry, and where it sits among the columns it spans. */
type CellNode = Node<unknown> & {
  readonly colIndex?: null | number
  readonly colSpan?: null | number
}

type TableBodyProps<T extends object = object> = {
  /**
   * The rows, each a `Table.Row`, with a `Table.LoadMore` after them. With
   * `items`, a function from an item to its row, called for each in turn.
   */
  readonly children?: ((item: T) => ReactElement) | ReactNode
  /** The entries `children` draws a row for, when it is a function. */
  readonly items?: Iterable<T>
  /**
   * What the table shows in place of rows when it has none and nothing is
   * loading, in a muted, padded box across its width. A string is set in
   * body medium.
   */
  readonly renderEmptyState?: () => ReactNode
}

type TableCellProps = {
  /** What the cell holds. A string is set in body medium. */
  readonly children?: ReactNode
  /**
   * How many columns the cell spans, from where it sits.
   * @default 1
   */
  readonly colSpan?: number
  /**
   * Draws this row's selection checkbox instead of `children`. The row's own
   * text is what names the row.
   */
  readonly selection?: boolean
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
  /** The cell's text, read off `children` when they are a plain string. */
  readonly textValue?: string
}

type TableColumnProps = {
  /**
   * Makes the header itself the control that sorts by the column, as
   * React Aria's prop does. The arrow appears on the column the table's
   * `sortDescriptor` names.
   * @default false
   */
  readonly allowsSorting?: boolean
  /** The column's name. */
  readonly children?: ReactNode
  /** The width the column starts at, when the table keeps its widths. */
  readonly defaultWidth?: ColumnSize | null
  /**
   * The key the column is sorted and sized by. It shares a namespace with
   * the rows' ids, so give the two sets values that cannot meet.
   */
  readonly id?: Key
  /**
   * Marks the column a screen reader reads a row by on web. Kept for a call
   * site written for both libraries; native reads every cell of a row.
   * @default false
   */
  readonly isRowHeader?: boolean
  /** The widest the column is drawn. */
  readonly maxWidth?: ColumnStaticSize | null
  /**
   * The narrowest the column is drawn.
   * @default 75
   */
  readonly minWidth?: ColumnStaticSize | null
  /**
   * Draws a handle at the column's trailing edge that drags its width. Needs
   * the table's own `resizable` as well.
   * @default false
   */
  readonly resizable?: boolean
  /**
   * Draws the select-all checkbox instead of `children`, for the column the
   * rows put their own checkboxes in.
   * @default false
   */
  readonly selection?: boolean
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
  /** The column's name as text, read off `children` when it is a string. */
  readonly textValue?: string
  /** The column's width, for a call site holding the widths itself. */
  readonly width?: ColumnSize | null
}

type TableFooterProps = {
  /** The rows under the body, each a `Table.Row` of `Table.Cell`s. */
  readonly children?: ReactNode
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

type TableHeaderProps<T extends object = object> = {
  /**
   * The columns, each a `Table.Column`. With `columns`, a function from an
   * entry to its column, called for each in turn.
   */
  readonly children?: ((column: T) => ReactElement) | ReactNode
  /** The entries `children` draws a column for, when it is a function. */
  readonly columns?: Iterable<T>
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

type TableLoadMoreProps = CollectionLoadMoreProps

type TableProps = Omit<
  ScrollViewProps,
  'children' | 'horizontal' | 'role' | 'stickyHeaderIndices' | 'style'
> & {
  /**
   * The parts: a `Table.Header`, a `Table.Body` and, under them, a
   * `Table.Footer`.
   */
  readonly children?: ReactNode
  /** The keys selected at first, when the table keeps its own selection. */
  readonly defaultSelectedKeys?: 'all' | Iterable<Key>
  /**
   * Whether `disabledKeys` takes every press off a row, or only its
   * selection, as React Aria's prop says.
   * @default 'all'
   */
  readonly disabledBehavior?: DisabledBehavior
  /** The keys of the rows drawn disabled. */
  readonly disabledKeys?: Iterable<Key>
  /**
   * Keeps the last selected row selected, so a press on it changes nothing.
   * @default false
   */
  readonly disallowEmptySelection?: boolean
  /** Called as a column is dragged, with every column's width. */
  readonly onResize?: (widths: Map<Key, ColumnSize>) => void
  /** Called once a drag ends, with every column's width. */
  readonly onResizeEnd?: (widths: Map<Key, ColumnSize>) => void
  /**
   * Called with a row's key when a press runs its action. A row's own
   * `onAction` takes its place for that row.
   */
  readonly onRowAction?: (key: Key) => void
  /** Called with the selected keys whenever a press changes them. */
  readonly onSelectionChange?: (keys: Selection) => void
  /** Called with the column and direction a press on a header asks for. */
  readonly onSortChange?: (descriptor: SortDescriptor) => void
  readonly ref?: Ref<FlatList>
  /**
   * Lets the columns marked `resizable` be dragged.
   * @default false
   */
  readonly resizable?: boolean
  /**
   * What a resize handle is called, for a screen reader, before its column's
   * name. Left out, it is the word for it in the `I18nProvider`'s language,
   * or the device's outside one, "Resizer" in English.
   */
  readonly resizeLabel?: string
  /**
   * What the select-all checkbox is called, for a screen reader. Left out,
   * it is the word for it in the `I18nProvider`'s language, or the device's
   * outside one, "Select All" in English, or "Select" while one row at a
   * time selects.
   */
  readonly selectAllLabel?: string
  /** The selected keys, for a call site holding the selection itself. */
  readonly selectedKeys?: 'all' | Iterable<Key>
  /**
   * Whether rows can be selected: one at a time, several, or none.
   * @default 'none'
   */
  readonly selectionMode?: SelectionMode
  /**
   * What selecting a row is called, for a screen reader: the accessibility
   * action that selects a row. Left out, it is the word for it in the
   * `I18nProvider`'s language, or the device's outside one, "Select" in
   * English.
   */
  readonly selectLabel?: string
  /** The column the rows are sorted by, and in which direction. */
  readonly sortDescriptor?: SortDescriptor
  /**
   * Holds the header row in place while the rows scroll under it. Needs the
   * table to have a height to scroll in.
   * @default false
   */
  readonly stickyHeader?: boolean
  readonly style?: StyleProp<ViewStyle>
}

type TableRowProps<T extends object = object> = Omit<
  PressableProps,
  'children' | 'disabled' | 'id' | 'role' | 'style'
> & {
  /**
   * The row's cells, one `Table.Cell` for each column it spans, or a
   * function from a column's key to its cell.
   */
  readonly children?: ((columnKey: Key) => ReactElement) | ReactNode
  /** Goes to this route when a press runs the row's action. */
  readonly href?: string
  /**
   * The key the row is selected and reported by. Give one to every row, and
   * keep it apart from every column's.
   */
  readonly id?: Key
  /**
   * Draws the row disabled, as a key in the table's `disabledKeys` does.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * Called when a press runs the row's action, in place of the table's
   * `onRowAction` for this row.
   */
  readonly onAction?: () => void
  readonly ref?: Ref<HostInstance>
  readonly style?: StyleProp<ViewStyle>
  /** The row's text, for a row whose cells hold elements. */
  readonly textValue?: string
  /** The entry `children` was drawn for, kept on the row's node. */
  readonly value?: T
}

// What the parts drawn in the table read from it.
type TableValue = {
  readonly columns: readonly Node<unknown>[]
  readonly footer: TableFooterProps | undefined
  readonly header: TableHeaderProps
  readonly layout: TableColumnResizeState<unknown>
  readonly loadMore: TableLoadMoreProps | undefined
  /** The table's sideways scroll, which a handle's drag holds still. */
  // oxlint-disable-next-line typescript/no-deprecated -- the type of the builder ResizeHandle keeps; see there
  readonly native: GestureType | undefined
  readonly onResize: TableProps['onResize']
  readonly onResizeEnd: TableProps['onResizeEnd']
  readonly onRowAction: TableProps['onRowAction']
  readonly renderEmptyState: (() => ReactNode) | undefined
  readonly resizable: boolean
  readonly resizeLabel: string
  readonly selectAllLabel: string | undefined
  readonly selectLabel: string
  readonly state: TableState<unknown>
  readonly testID: string | undefined
}

// What a `Table` hands the view it draws.
type TableViewProps = Omit<
  TableProps,
  | 'children'
  | 'defaultSelectedKeys'
  | 'disabledBehavior'
  | 'disabledKeys'
  | 'disallowEmptySelection'
  | 'onSelectionChange'
  | 'onSortChange'
  | 'selectedKeys'
  | 'selectionMode'
  | 'sortDescriptor'
> & {
  readonly body: TableBodyProps
  readonly footer: TableFooterProps | undefined
  readonly header: TableHeaderProps
  readonly layout: TableColumnResizeState<unknown>
  /** Called with the table's width as it is laid out. */
  readonly onWidth: (width: number) => void
  readonly state: TableState<unknown>
  /** The width the columns fill. */
  readonly width: number
}

const TableContext = createContext<null | TableValue>(null)

/**
 * A cell of a body row, its column's width or the columns' it spans: its
 * text in body medium and the row's content colour, or what it was given,
 * with an icon in it drawn in that colour, or the row's checkbox.
 */
function BodyCell({
  cell,
  color,
  isDisabled,
  isSelected,
  onSelect,
}: {
  readonly cell: CellNode
  readonly color: ColorValue
  readonly isDisabled: boolean
  readonly isSelected: boolean
  readonly onSelect: (() => void) | undefined
}) {
  const own = stylesOf(useTheme())
  const table = useTable()
  const text = useTypeRole('bodyMedium')
  const icon = useMemo(() => ({ color, size: 24 }), [color])
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- a node carries the props its cell was written with, which React Stately types as `any`
  const { selection = false, style, testID }: TableCellProps = cell.props
  const width = spanWidthOf(table, cell)

  if (selection) {
    return (
      <View
        style={composeStyles<ViewStyle>(
          own.cell,
          styles.selection,
          { width },
          style,
        )}
        testID={testID}
      >
        <SelectBox
          isDisabled={isDisabled}
          isSelected={isSelected}
          onPress={onSelect}
        />
      </View>
    )
  }

  return (
    <View
      style={composeStyles<ViewStyle>(own.cell, { width }, style)}
      testID={testID}
    >
      <IconStyleContext value={icon}>
        {isTextual(cell.rendered) ? (
          <NativeText style={composeStyles<TextStyle>(text, { color })}>
            {cell.rendered}
          </NativeText>
        ) : (
          cell.rendered
        )}
      </IconStyleContext>
    </View>
  )
}

// The entry the collection holds for a `Table.Body` part: its rows, each
// built by its own part, with the `Table.LoadMore` among them left to the
// table, which draws it after them.
function* bodyNode(props: TableBodyProps) {
  const { children, items } = props

  yield {
    *childNodes() {
      if (typeof children === 'function') {
        for (const value of items ?? []) {
          yield { renderer: children, type: 'item', value }
        }
        return
      }
      for (const element of childElementsOf(children)) {
        if (!isLoadMore(element)) {
          yield { element, type: 'item' }
        }
      }
    },
    hasChildNodes: true,
    props,
    type: 'body',
  }
}

/**
 * A row of the body: the state layer, the ripple and the focus ring over its
 * cells, on primary container while selected and faded while disabled. A row
 * with nothing to do on a press, in a table that neither selects nor acts, is
 * a `View` that only presents.
 */
function BodyRow({
  index,
  node,
}: {
  readonly index: number
  readonly node: Node<unknown>
}) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const table = useTable()
  const openLink = useOpenLink()
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- a node carries the props its row was written with, which React Stately types as `any`
  const {
    children: _children,
    href,
    id: _id,
    isDisabled: _isDisabled,
    onAction,
    onBlur,
    onFocus,
    onHoverIn,
    onHoverOut,
    onLongPress,
    onPress,
    onPressIn,
    onPressOut,
    ref,
    style,
    textValue: _textValue,
    value: _value,
    ...props
  }: TableRowProps = node.props
  const { selectionManager } = table.state
  const { key } = node
  // The selection manager reads a row's own `isDisabled` off its entry,
  // beside the table's `disabledKeys`, so it answers for both.
  const disabled = selectionManager.isDisabled(key)
  const checks = selectionManager.selectionMode !== 'none'
  const selectable = selectionManager.canSelectItem(key)
  const selected = checks && selectionManager.isSelected(key)
  // A disabled row is drawn on no container, whether or not it is selected.
  const marked = selected && !disabled
  const rowAction = table.onRowAction
  const action =
    onAction ??
    (href === undefined
      ? rowAction === undefined
        ? undefined
        : () => {
            rowAction(key)
          }
      : () => {
          openLink(href)
        })
  // React Aria's rule for a touch press on a row that selects: the action
  // while nothing is selected, the selection after.
  const acts = action !== undefined && (!selectable || selectionManager.isEmpty)
  const select = () => {
    selectionManager.select(key)
  }
  const content = rowContentColor(theme, {
    isDisabled: disabled,
    isSelected: marked,
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
  // A table's collection always has `getChildren`, which hands a row's cells
  // over with the column each sits in.
  const cells = [...(table.state.collection.getChildren?.(key) ?? [])].map(
    (cell) => (
      <BodyCell
        cell={cell}
        color={content}
        isDisabled={disabled}
        isSelected={selected}
        key={cell.key}
        onSelect={acts && selectable ? select : undefined}
      />
    ),
  )
  const rowStyle = composeStyles<ViewStyle>(
    own.row,
    index > 0 ? own.rowRule : undefined,
    marked ? own.selected : undefined,
  )

  if (!checks && action === undefined && onPress === undefined) {
    return (
      <View
        aria-disabled={disabled || undefined}
        ref={ref}
        style={composeStyles<ViewStyle>(rowStyle, style)}
        testID={props.testID}
      >
        {cells}
      </View>
    )
  }

  return (
    <Pressable
      role={href === undefined ? 'button' : 'link'}
      {...props}
      {...(checks ? toggleState(selected) : undefined)}
      {...(selectable
        ? {
            accessibilityActions: [
              { label: table.selectLabel, name: 'select' },
            ],
            onAccessibilityAction: accessibilityActionOf({
              collapse: undefined,
              expand: undefined,
              select,
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
      ref={ref}
      style={composeStyles<ViewStyle>(
        rowStyle,
        feedback.ring,
        feedback.ring === undefined ? undefined : rowStyles.ring,
        style,
      )}
    >
      {feedback.layer}
      {cells}
    </Pressable>
  )
}

// The entry the collection holds for a `Table.Cell` part.
function* cellNode(props: TableCellProps) {
  yield {
    hasChildNodes: false,
    props,
    rendered: props.children,
    textValue:
      props.textValue ??
      (typeof props.children === 'string' ? props.children : ''),
    type: 'cell',
  }
}

/**
 * A column's header: its name in label large and the muted role, with the
 * arrow after it while the rows are sorted by it, as a button that sorts
 * where the column allows it, or the select-all checkbox.
 */
function ColumnHeader({ column }: { readonly column: Node<unknown> }) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const table = useTable()
  const messages = useMessages()
  const label = useTypeRole('labelLarge')
  const { selectionManager } = table.state
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- a node carries the props its column was written with, which React Stately types as `any`
  const {
    allowsSorting = false,
    selection = false,
    style,
    testID,
  }: TableColumnProps = column.props
  const { sortDescriptor } = table.state
  const direction =
    sortDescriptor?.column === column.key ? sortDescriptor.direction : undefined
  const feedback = usePressFeedback({ color: theme.colors.onSurface })
  const cellStyle = composeStyles<ViewStyle>(own.cell, {
    width: table.layout.getColumnWidth(column.key),
  })

  if (selection) {
    const mode = selectionManager.selectionMode
    return (
      <View
        style={composeStyles<ViewStyle>(cellStyle, styles.selection, style)}
        testID={testID}
      >
        <Checkbox
          aria-label={
            table.selectAllLabel ??
            (mode === 'single' ? messages.select : messages.table.selectAll)
          }
          isDisabled={mode !== 'multiple' || table.state.collection.size === 0}
          isIndeterminate={
            !selectionManager.isEmpty && !selectionManager.isSelectAll
          }
          isSelected={selectionManager.isSelectAll}
          onChange={selectAllOf(table.state)}
        />
      </View>
    )
  }

  const arrowColor = theme.colors.onSurfaceVariant
  const name = (
    <View style={own.headerContent}>
      {isTextual(column.rendered) ? (
        <NativeText style={composeStyles<TextStyle>(label, own.headerText)}>
          {column.rendered}
        </NativeText>
      ) : (
        column.rendered
      )}
      {direction === undefined ? null : direction === 'ascending' ? (
        <ArrowUpwardGlyph color={arrowColor} size={ARROW_SIZE} />
      ) : (
        <ArrowDownwardGlyph color={arrowColor} size={ARROW_SIZE} />
      )}
    </View>
  )

  if (!allowsSorting) {
    return (
      <View style={composeStyles<ViewStyle>(cellStyle, style)} testID={testID}>
        {name}
      </View>
    )
  }

  return (
    <Pressable
      aria-label={[
        column.textValue,
        messages.table.sortable,
        ...(direction === undefined ? [] : [messages.table[direction]]),
      ].join(', ')}
      role="button"
      {...feedback.handlers}
      onPress={sortOf(table.state, column.key)}
      style={composeStyles<ViewStyle>(
        cellStyle,
        feedback.ring,
        feedback.ring === undefined ? undefined : rowStyles.ring,
        style,
      )}
      testID={testID}
    >
      {feedback.layer}
      {name}
    </Pressable>
  )
}

// The entry the collection holds for a `Table.Column` part, which it also
// adds to the columns a row reads its cells against, again whenever the
// collection is rebuilt around it, as React Stately's own column does.
function* columnNode(
  props: TableColumnProps,
  context: BuilderContext,
): Generator<object, void, readonly Node<unknown>[]> {
  const nodes = yield {
    hasChildNodes: false,
    key: props.id,
    props,
    rendered: props.children,
    shouldInvalidate(next: BuilderContext) {
      next.columns.push(...nodes)
      return false
    },
    textValue:
      props.textValue ??
      (typeof props.children === 'string' ? props.children : ''),
    type: 'column',
  }

  context.columns.push(...nodes)
}

/**
 * The widths a column takes before anything says otherwise: React Stately's
 * own, and a checkbox's column as wide as its box and its padding, which it
 * keeps, since it holds one control and should not take a column of data's
 * room.
 */
function defaultsOf(selectionWidth: number) {
  return {
    getDefaultMinWidth: (node: Node<unknown>): ColumnSize =>
      isSelection(node) ? selectionWidth : MIN_WIDTH,
    getDefaultWidth: (node: Node<unknown>): ColumnSize =>
      isSelection(node) ? selectionWidth : FLEXIBLE,
  }
}

/**
 * What the body shows in place of rows, from its `renderEmptyState`, as the
 * component `ListEmptyComponent` takes.
 */
function EmptyBody() {
  const own = stylesOf(useTheme())
  const text = useTypeRole('bodyMedium')
  const shown = useTable().renderEmptyState?.()

  return (
    <View style={own.empty}>
      {isTextual(shown) ? (
        <NativeText style={composeStyles<TextStyle>(text, own.emptyText)}>
          {shown}
        </NativeText>
      ) : (
        shown
      )}
    </View>
  )
}

/**
 * Where each column ends, from the table's start, which is where its resize
 * handle is centred.
 */
function endsOf(table: TableValue): number[] {
  const ends: number[] = []
  let end = 0

  for (const column of table.columns) {
    end += table.layout.getColumnWidth(column.key)
    ends.push(end)
  }
  return ends
}

/**
 * The rows under the body, in label large and the muted role, under a rule
 * of their own, each cell its column's width or the columns' it spans. They
 * take no press and no selection, as React Aria keeps a footer out of both.
 */
function FooterRows() {
  const own = stylesOf(useTheme())
  const table = useTable()
  const label = useTypeRole('labelLarge')
  const { footer } = table

  if (footer === undefined) {
    return null
  }

  return (
    <View
      style={composeStyles<ViewStyle>(own.footer, footer.style)}
      testID={footer.testID}
    >
      {childElementsOf(footer.children).map((row, rowIndex) => {
        if (!isValidElement<TableRowProps>(row)) {
          return null
        }
        let start = 0
        const cells = childElementsOf(
          typeof row.props.children === 'function' ? null : row.props.children,
        ).map((cell, cellIndex) => {
          if (!isValidElement<TableCellProps>(cell)) {
            return null
          }
          const span = cell.props.colSpan ?? 1
          const width = widthAcross(table, start, span)
          start += span
          return (
            <View
              key={cell.key ?? cellIndex}
              style={composeStyles<ViewStyle>(
                own.cell,
                { width },
                cell.props.style,
              )}
              testID={cell.props.testID}
            >
              {isTextual(cell.props.children) ? (
                <NativeText
                  style={composeStyles<TextStyle>(label, own.footerText)}
                >
                  {cell.props.children}
                </NativeText>
              ) : (
                cell.props.children
              )}
            </View>
          )
        })
        return (
          <View
            key={row.key ?? rowIndex}
            style={composeStyles<ViewStyle>(
              own.row,
              rowIndex > 0 ? own.rowRule : undefined,
              row.props.style,
            )}
            testID={row.props.testID}
          >
            {cells}
          </View>
        )
      })}
    </View>
  )
}

// The entries the collection holds for a `Table.Header` part: its columns,
// each built by its own part, read afresh each time the collection is.
function* headerNodes(props: TableHeaderProps, context: BuilderContext) {
  const { children, columns } = props

  context.columns = []
  if (typeof children === 'function') {
    for (const value of columns ?? []) {
      yield { renderer: children, type: 'column', value }
    }
    return
  }
  for (const element of childElementsOf(children)) {
    yield { element, type: 'column' }
  }
}

/**
 * The header row: each column's header, its column's width, and the resize
 * handles over them in a table that resizes.
 */
function HeaderRow() {
  const own = stylesOf(useTheme())
  const table = useTable()
  const { header } = table

  return (
    <View
      style={composeStyles<ViewStyle>(own.header, header.style)}
      testID={header.testID}
    >
      {table.columns.map((column) => (
        <ColumnHeader column={column} key={column.key} />
      ))}
      {table.resizable ? <ResizeHandles /> : null}
    </View>
  )
}

function isLoadMore(
  element: ReactNode,
): element is ReactElement<TableLoadMoreProps> {
  return isValidElement(element) && element.type === TableLoadMore
}

// Whether a column is the one the rows put their checkboxes in.
function isSelection(node: Node<unknown>) {
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- a node carries the props its column was written with, which React Stately types as `any`
  return node.props?.selection === true
}

/**
 * Whether what a cell holds is text alone, which it sets in its own type
 * role, as React Native draws text only inside a Text.
 */
function isTextual(node: ReactNode) {
  const parts = Children.toArray(node)

  return (
    parts.length > 0 &&
    parts.every((part) => typeof part === 'string' || typeof part === 'number')
  )
}

// A row's key in the `FlatList`.
function keyOf(node: Node<unknown>) {
  return String(node.key)
}

/**
 * The part `type` of the table's children, or what is left out: the header,
 * the body and the footer are each read off their own part.
 */
function partOf<P>(children: ReactNode, type: unknown) {
  return childElementsOf(children).find(
    (child): child is ReactElement<P> =>
      isValidElement(child) && child.type === type,
  )
}

// One row of the body, drawn as the part it came from.
function renderRow({ index, item }: ListRenderItemInfo<Node<unknown>>) {
  return <BodyRow index={index} node={item} />
}

/**
 * A column's resize handle: a target centred on its trailing edge holding
 * the divider's rule, which a drag along the header moves, and a slider to a
 * screen reader, stepped by `RESIZE_STEP`. A drag starting on it holds the
 * table's sideways scroll still.
 */
function ResizeHandle({
  column,
  end,
  isLast,
}: {
  readonly column: Node<unknown>
  readonly end: number
  readonly isLast: boolean
}) {
  const own = stylesOf(useTheme())
  const table = useTable()
  const locale = useLocaleOf(undefined)
  const { layout, native, onResize, onResizeEnd } = table
  const { key } = column
  // The width the drag started from, or -1 between drags, and the width it
  // last asked for. Shared values rather than refs: the gesture's callbacks
  // are built while rendering, and the React Compiler lets no ref reach
  // them.
  const from = useSharedValue(-1)
  const last = useSharedValue(0)
  const width = layout.getColumnWidth(key)
  const resizing = layout.resizingColumn === key

  function begin() {
    from.set(layout.getColumnWidth(key))
    last.set(layout.getColumnWidth(key))
    layout.startResize(key)
  }

  function move(translation: number) {
    const start = from.get()
    if (start < 0) {
      return
    }
    // A drag towards the end widens the column, which is leftwards in a
    // right-to-left layout.
    const next = start + (I18nManager.isRTL ? -translation : translation)
    last.set(next)
    onResize?.(layout.updateResizedColumns(key, next))
  }

  function finish() {
    if (from.get() < 0) {
      return
    }
    from.set(-1)
    const sizes = layout.updateResizedColumns(key, last.get())
    layout.endResize()
    onResizeEnd?.(sizes)
  }

  // Gesture Handler 3 deprecates these builders for hooks that version 2
  // does not have, and the peer range admits both, so the builders stay
  // while it does.
  // oxlint-disable-next-line react/capitalized-calls, typescript/no-deprecated -- a builder named after its gesture, not a component; see above
  const drag = Gesture.Pan()
    // Taken once it moves along the header, and let go to a scroll once it
    // moves across it first.
    .activeOffsetX(SLOP_RANGE)
    .failOffsetY(SLOP_RANGE)
    .runOnJS(true)
    // The edge follows the finger from where it went down, so the distance
    // it moved before the drag was taken counts too.
    .onStart(({ translationX }) => {
      begin()
      move(translationX)
    })
    .onUpdate(({ translationX }) => {
      move(translationX)
    })
    .onFinalize(() => {
      finish()
    })
  const held = native === undefined ? drag : drag.blocksExternalGesture(native)
  const pan =
    table.testID === undefined
      ? held
      : held.withTestId(`${table.testID}-resize-${String(key)}`)

  return (
    <GestureDetector gesture={pan}>
      <View
        accessibilityActions={ADJUSTABLE}
        accessible
        aria-label={`${table.resizeLabel} ${column.textValue}`}
        aria-valuemax={Math.floor(layout.getColumnMaxWidth(key))}
        aria-valuemin={Math.floor(layout.getColumnMinWidth(key))}
        aria-valuenow={Math.floor(width)}
        aria-valuetext={columnSizeFor(Math.floor(width), locale)}
        onAccessibilityAction={stepOf(table, key)}
        role="slider"
        style={composeStyles<ViewStyle>(
          styles.handle,
          isLast ? styles.handleLast : undefined,
          { start: end - HANDLE / 2 },
        )}
      >
        <View
          style={composeStyles<ViewStyle>(
            styles.rule,
            isLast ? styles.ruleLast : undefined,
            own.ruleLine,
            resizing ? own.ruleResizing : undefined,
          )}
        />
      </View>
    </GestureDetector>
  )
}

// The handles of the columns that resize, over the header's columns.
function ResizeHandles() {
  const table = useTable()
  const ends = endsOf(table)
  const lastIndex = table.columns.length - 1

  return (
    <View style={styles.handles}>
      {table.columns.map((column, index) =>
        // oxlint-disable-next-line typescript/no-unsafe-member-access -- a node carries the props its column was written with, which React Stately types as `any`
        column.props?.resizable === true ? (
          <ResizeHandle
            column={column}
            end={ends[index] ?? 0}
            isLast={index === lastIndex}
            key={column.key}
          />
        ) : null,
      )}
    </View>
  )
}

// The entry the collection holds for a `Table.Row` part: keyed by the row's
// `id`, carrying the props it is drawn from, and holding its cells, which
// have to fill every column, as React Stately's own row holds them to.
function* rowNode(props: TableRowProps, context: BuilderContext) {
  const { children } = props

  yield {
    'aria-label': props['aria-label'],
    *childNodes() {
      if (typeof children === 'function') {
        for (const column of context.columns) {
          yield { element: children(column.key), key: column.key, type: 'cell' }
        }
        return
      }
      const cells = childElementsOf(children)
      const count = cells.reduce<number>((sum, cell) => sum + spanOf(cell), 0)
      if (count !== context.columns.length) {
        throw new Error(
          `Cell count must match column count. Found ${count} cells and ${context.columns.length} columns.`,
        )
      }
      for (const element of cells) {
        yield { element, type: 'cell' }
      }
    },
    hasChildNodes: true,
    key: props.id,
    props,
    shouldInvalidate(next: BuilderContext) {
      return (
        next.columns.length !== context.columns.length ||
        next.columns.some(
          (column, index) => column.key !== context.columns[index]?.key,
        )
      )
    },
    textValue: props.textValue,
    type: 'item',
  }
}

// Selects every row, or none once all of them are, as React Aria's
// select-all checkbox does whatever it is handed.
function selectAllOf(state: TableState<unknown>) {
  return () => {
    state.selectionManager.toggleSelectAll()
  }
}

/**
 * What the table says once its rows are sorted, as React Aria says it, and
 * nothing for a table that sorts by nothing.
 */
function sortMessageOf(state: TableState<unknown>, locale: string) {
  const { sortDescriptor } = state

  if (sortDescriptor === null) {
    return ''
  }
  const column = state.collection.columns.find(
    (each) => each.key === sortDescriptor.column,
  )
  return sortedFor(
    sortDescriptor.direction,
    column?.textValue ?? String(sortDescriptor.column),
    locale,
  )
}

// Sorts by a column, the other way round when it already is.
function sortOf(state: TableState<unknown>, key: Key) {
  return () => {
    state.sort(key)
  }
}

// How many columns a cell spans.
function spanOf(cell: ReactNode) {
  return isValidElement<TableCellProps>(cell) ? (cell.props.colSpan ?? 1) : 1
}

// The width a body cell is drawn at: the columns' it spans from where it sits.
function spanWidthOf(table: TableValue, cell: CellNode) {
  return widthAcross(table, cell.colIndex ?? cell.index, cell.colSpan ?? 1)
}

/**
 * Runs the step a screen reader asks a handle for, as a drag that starts and
 * ends at once, so `onResizeEnd` comes once as it does for a key on web.
 */
function stepOf(table: TableValue, key: Key) {
  return (event: AccessibilityActionEvent) => {
    const { actionName } = event.nativeEvent
    if (actionName !== 'increment' && actionName !== 'decrement') {
      return
    }
    const { layout } = table
    const step = actionName === 'increment' ? RESIZE_STEP : -RESIZE_STEP
    layout.startResize(key)
    const sizes = layout.updateResizedColumns(
      key,
      layout.getColumnWidth(key) + step,
    )
    table.onResize?.(sizes)
    layout.endResize()
    table.onResizeEnd?.(sizes)
  }
}

/**
 * A grid of rows and columns. Sorting and selection are React Stately's, as
 * web's are React Aria's: pass `sortDescriptor` with `onSortChange` and mark
 * the sortable columns `allowsSorting`, and set `selectionMode` to `single`
 * or `multiple` with `selectedKeys` and `onSelectionChange`, or
 * `defaultSelectedKeys`.
 *
 * ```tsx
 * <Table aria-label="Label" selectionMode="multiple">
 *   <Table.Header>
 *     <Table.Column id="colSelect" selection />
 *     <Table.Column id="colName" isRowHeader>Label</Table.Column>
 *   </Table.Header>
 *   <Table.Body>
 *     <Table.Row id="first">
 *       <Table.Cell selection />
 *       <Table.Cell>First item</Table.Cell>
 *     </Table.Row>
 *   </Table.Body>
 * </Table>
 * ```
 *
 * Composed from parts, since a cell takes any content: `Table.Header`,
 * `Table.Column`, `Table.Body`, `Table.Row`, `Table.Cell`, `Table.LoadMore`
 * and `Table.Footer`, which the table draws from their props, so none of them
 * renders anything on its own. A column's `id` and a row's share one
 * namespace, so keep the two sets apart, as `col`-prefixed column ids do.
 * Name the table with `aria-label`.
 *
 * The columns fill the table's width, `1fr` each unless `defaultWidth` or
 * `width` says otherwise, and the table scrolls sideways once they are wider
 * than it is. The rows scroll by themselves, so a table on a page that
 * scrolls takes `scrollEnabled={false}` and is laid out at its full length,
 * and one with `stickyHeader` wants a height to fill. `style` lands on the
 * box the table is drawn in, and `ref`, `aria-label`, `testID` and the
 * scroll props on the `FlatList` that holds the rows.
 *
 * The rows take focus while they run past the table's height, as web's grid
 * is a tab stop, so a keyboard can scroll them whatever they hold, and the
 * sideways scroll does while the columns are wider than the table; a call
 * site's own `focusable` still wins for the rows.
 */
function Table({
  children,
  defaultSelectedKeys,
  disabledBehavior = 'all',
  disabledKeys,
  disallowEmptySelection,
  onSelectionChange,
  onSortChange,
  selectedKeys,
  selectionMode = 'none',
  sortDescriptor,
  ...props
}: TableProps) {
  const theme = useTheme()
  const window = useWindowDimensions()
  const [measured, setMeasured] = useState<null | number>(null)
  const header = partOf<TableHeaderProps>(children, TableHeader)
  const body = partOf<TableBodyProps>(children, TableBody)
  const footer = partOf<TableFooterProps>(children, TableFooter)

  if (header === undefined || body === undefined) {
    throw new Error('A Table holds a Table.Header and a Table.Body.')
  }

  const state = useTableState<object>({
    // Each part builds its own entry in the collection; see `rowNode` and
    // the parts beside it. The collection asks each element for its entry.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    children: [header, body] as TableStateProps<object>['children'],
    defaultSelectedKeys,
    disabledBehavior,
    disabledKeys,
    disallowEmptySelection,
    onSelectionChange,
    onSortChange,
    selectedKeys,
    selectionMode,
    sortDescriptor,
  })
  const selectionWidth = 2 * theme.spacing.lg + LAYER_SIZE
  const defaults = useMemo(() => defaultsOf(selectionWidth), [selectionWidth])
  const width = measured ?? window.width
  const layout = useTableColumnResizeState(
    { ...defaults, tableWidth: width },
    state,
  )

  return (
    <TableView
      {...props}
      body={body.props}
      footer={footer?.props}
      header={header.props}
      layout={layout}
      onWidth={setMeasured}
      state={state}
      width={width}
    />
  )
}

/**
 * The rows. `renderEmptyState` is what the table shows when there are none,
 * and a `Table.LoadMore` after them is the row it shows while fetching
 * more. The table draws it from its props, so it renders nothing on its
 * own.
 */
function TableBody<T extends object = object>(_props: TableBodyProps<T>): null {
  return null
}

TableBody.getCollectionNode = bodyNode

/**
 * One cell. `selection` draws this row's checkbox in place of whatever else
 * the cell would hold. `style` and `testID` land on the cell.
 */
function TableCell(_props: TableCellProps): null {
  return null
}

TableCell.getCollectionNode = cellNode

/**
 * One column. `allowsSorting` makes the header itself the control that
 * sorts; the arrow appears on the column the `sortDescriptor` names.
 * `selection` draws the select-all checkbox in place of a name. `style` and
 * `testID` land on the column's header.
 *
 * Its `id` shares a namespace with the rows', so give the two sets values
 * that cannot meet: a column and a row with one id between them leaves the
 * table with no columns at all.
 */
function TableColumn(_props: TableColumnProps): null {
  return null
}

TableColumn.getCollectionNode = columnNode

// What follows the rows: the ring while more are fetched, then the footer.
function TableEnd() {
  const own = stylesOf(useTheme())
  const { loadMore } = useTable()

  return (
    <>
      {loadMore === undefined ? null : (
        <LoadingRow
          {...loadMore}
          style={composeStyles<ViewStyle>(
            loadMore.isLoading === true ? own.loading : undefined,
            loadMore.style,
          )}
        />
      )}
      <FooterRows />
    </>
  )
}

/**
 * Rows under the body, for totals and the like, ruled off from it. They are
 * not part of the selection and take no press, as React Aria keeps a footer
 * out of both. `style` and `testID` land on the footer.
 */
function TableFooter(_props: TableFooterProps): null {
  return null
}

/**
 * The header row, holding the columns, and the rule drawn under it. `style`
 * and `testID` land on the row.
 */
function TableHeader<T extends object = object>(
  _props: TableHeaderProps<T>,
): null {
  return null
}

TableHeader.getCollectionNode = headerNodes

/**
 * The row shown while more rows are being fetched. `onLoadMore` is called
 * as the reader nears the end of the table, and the ring is drawn only while
 * `isLoading`, in a live region, so a screen reader hears it arrive. It goes
 * inside `Table.Body`, after the rows.
 */
function TableLoadMore(_props: TableLoadMoreProps): null {
  return null
}

/**
 * One row. Give every row an `id`, which is the key selection is reported
 * by, and keep it apart from every column's. `onAction` runs when a press
 * runs the row's action, and `href` goes to that route. `style`, `ref` and
 * `testID` land on the row.
 */
function TableRow<T extends object = object>(_props: TableRowProps<T>): null {
  return null
}

TableRow.getCollectionNode = rowNode

// Keeps the rows' height as it changes, and hands it on to the call site.
function contentTo(
  set: (height: number) => void,
  then: ScrollViewProps['onContentSizeChange'],
) {
  return (width: number, height: number) => {
    set(height)
    then?.(width, height)
  }
}

// Keeps the height the rows scroll in as it is laid out, and hands the
// layout on to the call site.
function roomTo(
  set: (height: number) => void,
  then: ScrollViewProps['onLayout'],
) {
  return (event: LayoutChangeEvent) => {
    set(event.nativeEvent.layout.height)
    then?.(event)
  }
}

/**
 * What a `Table` draws once it has its state and its columns' widths: the
 * header, the rows and the footer, as wide as the columns together, in a
 * box that scrolls sideways once they are wider than it is.
 */
function TableView({
  body,
  footer,
  header,
  layout,
  onContentSizeChange,
  onLayout,
  onResize,
  onResizeEnd,
  onRowAction,
  onWidth,
  ref,
  resizable = false,
  resizeLabel,
  selectAllLabel,
  selectLabel,
  state,
  stickyHeader = false,
  style,
  width,
  ...props
}: TableViewProps) {
  const messages = useMessages()
  const locale = useLocaleOf(undefined)
  const [content, setContent] = useState(0)
  const [room, setRoom] = useState(0)
  const { columns } = state.collection
  const total = columns.reduce(
    (sum, column) => sum + layout.getColumnWidth(column.key),
    0,
  )
  const rows = useMemo(() => [...state.collection], [state.collection])
  const { renderEmptyState } = body
  const loadMore = childElementsOf(
    typeof body.children === 'function' ? null : body.children,
  ).find(isLoadMore)?.props
  const isLoading = loadMore?.isLoading ?? false
  const native = useMemo(
    // oxlint-disable-next-line react/capitalized-calls, typescript/no-deprecated -- a builder named after its gesture, not a component; see ResizeHandle
    () => (resizable ? Gesture.Native() : undefined),
    [resizable],
  )
  const { testID } = props
  const value = useMemo<TableValue>(
    () => ({
      columns,
      footer,
      header,
      layout,
      loadMore,
      native,
      onResize,
      onResizeEnd,
      onRowAction,
      renderEmptyState,
      resizable,
      resizeLabel: resizeLabel ?? messages.table.resizer,
      selectAllLabel,
      selectLabel: selectLabel ?? messages.select,
      state,
      testID,
    }),
    [
      columns,
      footer,
      header,
      layout,
      loadMore,
      messages,
      native,
      onResize,
      onResizeEnd,
      onRowAction,
      renderEmptyState,
      resizable,
      resizeLabel,
      selectAllLabel,
      selectLabel,
      state,
      testID,
    ],
  )
  const Root = resizable ? GestureHandlerRootView : View
  const scroller = (
    <ScrollView
      // A keyboard stop while there is anywhere to scroll, as the rows are,
      // which axe's scrollable-region-focusable asks of it under React
      // Native Web.
      focusable={total > width}
      horizontal
      scrollEnabled={total > width}
      showsHorizontalScrollIndicator={total > width}
    >
      <View style={composeStyles<ViewStyle>(styles.grid, { width: total })}>
        {stickyHeader ? <HeaderRow /> : null}
        <FlatList
          // A keyboard stop while the rows run past the room they have, so
          // the arrow keys scroll them whatever they hold, which axe's
          // scrollable-region-focusable asks of it under React Native Web.
          focusable={content > room}
          {...props}
          data={rows}
          keyExtractor={keyOf}
          ListEmptyComponent={
            isLoading || renderEmptyState === undefined ? undefined : EmptyBody
          }
          ListFooterComponent={TableEnd}
          ListHeaderComponent={stickyHeader ? undefined : HeaderRow}
          onContentSizeChange={contentTo(setContent, onContentSizeChange)}
          onEndReached={
            loadMore === undefined ? undefined : loadMoreOf(loadMore)
          }
          onEndReachedThreshold={loadMore?.scrollOffset ?? 1}
          onLayout={roomTo(setRoom, onLayout)}
          ref={ref}
          renderItem={renderRow}
        />
      </View>
    </ScrollView>
  )

  return (
    <TableContext value={value}>
      <Root onLayout={widthTo(onWidth)} style={style}>
        {native === undefined ? (
          scroller
        ) : (
          <GestureDetector gesture={native}>{scroller}</GestureDetector>
        )}
        <Status message={sortMessageOf(state, locale)} />
      </Root>
    </TableContext>
  )
}

// The table a part is drawn in. Every part is drawn inside the table's own
// provider, so there always is one.
function useTable(): TableValue {
  const table = use(TableContext)

  if (table === null) {
    throw new Error('A Table part is drawn by the Table it is in.')
  }
  return table
}

// The width `span` columns take from the column at `start`.
function widthAcross(table: TableValue, start: number, span: number) {
  let width = 0

  for (const column of table.columns.slice(start, start + span)) {
    width += table.layout.getColumnWidth(column.key)
  }
  return width
}

// Keeps the table's width as it is laid out, which its columns fill.
function widthTo(set: (width: number) => void) {
  return ({ nativeEvent }: LayoutChangeEvent) => {
    set(nativeEvent.layout.width)
  }
}

Table.Body = TableBody
Table.Cell = TableCell
Table.Column = TableColumn
Table.Footer = TableFooter
Table.Header = TableHeader
Table.LoadMore = TableLoadMore
Table.Row = TableRow

export {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableFooter,
  TableHeader,
  TableLoadMore,
  TableRow,
}
export type {
  TableBodyProps,
  TableCellProps,
  TableColumnProps,
  TableFooterProps,
  TableHeaderProps,
  TableLoadMoreProps,
  TableProps,
  TableRowProps,
}
