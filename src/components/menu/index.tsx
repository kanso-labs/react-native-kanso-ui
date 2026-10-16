import type { ReactElement, ReactNode, Ref, RefObject } from 'react'
import type {
  GestureResponderEvent,
  HostInstance,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PressableProps,
  StyleProp,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { Key, Node, Selection, SelectionMode } from 'react-stately'
import type { RootMenuTriggerState } from 'react-stately/useMenuTriggerState'
import type { TreeProps, TreeState } from 'react-stately/useTreeState'

import {
  Children,
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  I18nManager,
  Text as NativeText,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import Animated from 'react-native-reanimated'
import {
  useMenuTriggerState,
  useSubmenuTriggerState,
} from 'react-stately/useMenuTriggerState'
import { useTreeState } from 'react-stately/useTreeState'

import type { ButtonSlots } from '../../button/slots'
import type { OverlayAlign, OverlaySide } from '../../overlay'
import type { ResolvedTheme } from '../../theme/scope'

import { ButtonSlotContext } from '../../button/slots'
import { CheckGlyph, ChevronEndGlyph } from '../../glyphs'
import { messagesFor } from '../../i18n'
import { Overlay, useAnchoredPlacement } from '../../overlay'
import {
  DismissLayer,
  PANEL_ORIGINS,
  useBackToClose,
  useFocusOnPlaced,
  usePanelMotion,
  useReturnFocus,
} from '../../overlay/panel'
import { usePressFeedback } from '../../press'
import { refsOf } from '../../ref'
import { useOpenLink } from '../../router'
import { RowContent, rowContentColor, rowStyleOf, rowStyles } from '../../row'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'
import { ProgressIndicator } from '../progress-indicator'
import { Separator } from '../separator'

// kanso-ui's Menu, from the menus page: a surface between 112 and 280dp wide
// with the 4dp corner and the second elevation, 8dp above and below its
// items, holding rows 48dp tall with a label in label large, on tertiary
// container when selected, with a check beside the label. The container
// colour is the Expressive column's surface container low, as web's is,
// rather than the baseline's surface container. The container alone sits as
// close as 1.1:1 to the surface, so the check is what carries the selection
// for a reader who cannot tell the two apart.
//
// Six parts, as on web: `Menu.Content`, `Menu.Item`, `Menu.Section`,
// `Menu.Separator`, `Menu.Submenu` and `Menu.LoadMore`. A `Button` or
// `IconButton` placed directly inside `Menu` is its trigger, wired through
// the button's slots as Popover's is.
//
// **A menu's children are a collection**, built by React Stately's tree
// state as React Aria builds web's: each part hands the collection an entry
// of its own, and the content draws the rows from those entries, so the
// parts render nothing on their own. Selection is the collection's too, so
// `selectionMode`, `selectedKeys` and `onSelectionChange` behave as on web.
//
// **The surface is src/overlay's anchored panel**, as Popover's is: drawn in
// the overlay host above the screen, placed beside its trigger, flipped at
// the edge of the window and kept inside the safe area, faded and scaled in
// from the edge facing the trigger once it has been placed and out again
// before it unmounts, at once under reduced motion. A press outside it lands
// on the dismiss layer under it and closes the menu, and Android's back
// gesture and VoiceOver's escape gesture close it too. Its items scroll when
// they run past the room the window leaves.
//
// **A press on an item runs its action and closes the menu**, unless the
// menu selects several items at once, where each press toggles one and the
// menu stays open, as on web. An item given an `href` follows it and closes
// the menu whatever the selection.
//
// **A submenu opens on a press on its item**, where web opens one on hover
// too: a press is the one way in that touch has. It opens at the inline end
// of the item, where the item's chevron points, with its first item level
// with the one that opened it, and draws no dismiss layer of its own, so a
// press on another item of the menu it came from still reaches that item and
// a press outside both closes the whole menu. Android's back gesture and
// VoiceOver's escape close the submenu alone, and closing the menu closes
// every submenu with it.
//
// **A screen reader is sent to the first item** that takes a press once the
// surface is placed, and back to the trigger, or to the item that opened a
// submenu, once it has gone. Items are `menuitem` rows; a selecting menu's
// report whether they are checked, and on the web they are web's
// `menuitemradio` and `menuitemcheckbox`. Typeahead and the keycap
// shortcuts web draws need a hardware keyboard, which this pass leaves out,
// so the items take no `shortcut`.

// The menus page's width range.
const MENU_MIN = 112
const MENU_MAX = 280

// The check at the menus page's 24dp icon size, and the chevron at web's
// 20dp.
const CHECK_SIZE = 24
const CHEVRON_SIZE = 20

// The loading ring at web's 20dp, which leaves the row an item's height.
const LOADING_DIAMETER = '20px'

// React Native Web writes `aria-haspopup` onto the element, which React
// Native's types do not name.
const HAS_SUBMENU: { readonly 'aria-haspopup': 'menu' } = {
  'aria-haspopup': 'menu',
}

const styles = StyleSheet.create({
  // Only as tall as its items until the panel's room runs out, where it
  // scrolls.
  scroll: {
    flexGrow: 0,
  },
  // What `Menu.LoadMore` leaves while nothing is loading: a point the menu
  // can tell is in view.
  sentinel: {
    height: 0,
  },
})

const stylesOf = themedStyles(
  ({ colors, radii, shadows, sizing, spacing }: ResolvedTheme) =>
    StyleSheet.create({
      // The page's 8dp above and below the items.
      content: {
        paddingVertical: spacing.sm,
      },
      empty: {
        color: colors.onSurfaceVariant,
      },
      // A section's heading, at the item's own inline padding so it lines up
      // with the labels under it. The menus page names no subhead, so the
      // type is the lists page's, title small in on surface variant, with
      // more room above than below so it reads as belonging to what follows.
      header: {
        color: colors.onSurfaceVariant,
        paddingBottom: spacing.xxs,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
      },
      // The ring on its own, centred in a row an item's height.
      loading: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: sizing.rowXs,
      },
      // The menus page's divider: the rule with 8dp either side of it.
      separator: {
        marginVertical: spacing.sm,
      },
      surface: {
        backgroundColor: colors.surfaceContainerLow,
        borderRadius: radii.xs,
        boxShadow: shadows.elevation2,
        maxWidth: MENU_MAX,
        minWidth: MENU_MIN,
        overflow: 'hidden',
      },
    }),
)

// The props a row is drawn from, as an item's entry in the collection
// carries them: the item's own, and for an item that opens a submenu, the
// content it opens.
type ItemNodeProps = MenuItemProps & {
  readonly submenu?: ReactElement<MenuContentProps>
}

type MenuAlign = OverlayAlign

type MenuContentProps<T extends object = object> = Omit<
  ViewProps,
  'children' | 'role' | 'style'
> & {
  /**
   * Where the menu lines up along the side it opens on. On `top` and
   * `bottom`, `start` and `end` follow a right-to-left layout.
   * @default 'start'
   */
  readonly align?: MenuAlign
  /**
   * Moves the menu along that side, in dp: right or down when positive.
   * Left out, a submenu moves up by the surface's own padding, which puts
   * its first item level with the one that opened it.
   */
  readonly alignOffset?: number
  /**
   * The items, each a `Menu.Item`, `Menu.Section`, `Menu.Separator`,
   * `Menu.Submenu` or `Menu.LoadMore`. With `items`, a function from an item
   * to its part, called for each item in turn.
   */
  readonly children?: ((item: T) => ReactElement) | ReactNode
  /** The keys selected at first, when the menu keeps its own selection. */
  readonly defaultSelectedKeys?: 'all' | Iterable<Key>
  /** The keys of the items drawn disabled, which take no presses. */
  readonly disabledKeys?: Iterable<Key>
  /**
   * Keeps the last selected item selected, so a press on it changes
   * nothing.
   * @default false
   */
  readonly disallowEmptySelection?: boolean
  /** The entries `children` draws a part for, when it is a function. */
  readonly items?: Iterable<T>
  /** Called with an item's key when a press on it runs its action. */
  readonly onAction?: (key: Key) => void
  /** Called when a press on an item closes the menu. */
  readonly onClose?: () => void
  /** Called with the selected keys whenever a press changes them. */
  readonly onSelectionChange?: (keys: Selection) => void
  readonly ref?: Ref<HostInstance>
  /**
   * What the menu shows when nothing is in it. Left out, it is a muted row
   * saying "No results" in the device's language, so the menu keeps a row's
   * height.
   */
  readonly renderEmptyState?: () => ReactNode
  /**
   * The selected keys, for a call site holding the selection itself with
   * `onSelectionChange`.
   */
  readonly selectedKeys?: 'all' | Iterable<Key>
  /**
   * Whether a press selects an item: one at a time, several, or none, in
   * which case a press runs the item's action alone.
   * @default 'none'
   */
  readonly selectionMode?: SelectionMode
  /**
   * Whether a press on an item closes the menu. Left out, it does unless the
   * menu selects several items at once, or the item has an `href`.
   */
  readonly shouldCloseOnSelect?: boolean
  /**
   * Which side of the trigger the menu opens on. It flips to the opposite
   * side when there is no room. Left out, a menu opens below its trigger and
   * a submenu at the inline end of the item that opens it.
   */
  readonly side?: MenuSide
  /**
   * The gap between the trigger and the menu, in dp. Left out, a menu sits
   * `spacing.sm` from its trigger and a submenu against its item.
   */
  readonly sideOffset?: number
  readonly style?: StyleProp<ViewStyle>
}

type MenuItemProps = Omit<
  PressableProps,
  'children' | 'disabled' | 'id' | 'role' | 'style'
> & {
  /** The item's label: what it does. */
  readonly children?: ReactNode
  /**
   * Where a press on the item leads, through the app's router as Button's
   * `href` does. An item with one closes the menu whatever the selection.
   */
  readonly href?: string
  /**
   * The key the item is selected and reported by. Give one to every item
   * the call site needs to tell apart.
   */
  readonly id?: Key
  /**
   * Draws the item disabled, and takes no presses on it, as a key in the
   * menu's `disabledKeys` does.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * Content before the label, usually an icon, which takes the label's
   * colour at 24dp. A selected item draws the check here in its place.
   */
  readonly leading?: ReactNode
  /**
   * Called when a press runs the item's action, in place of the menu's
   * `onAction` for this item.
   */
  readonly onAction?: () => void
  readonly ref?: Ref<HostInstance>
  readonly style?: StyleProp<ViewStyle>
  /**
   * The item's text, read off `children` when they are a plain string, so
   * an item whose label is an element passes it.
   */
  readonly textValue?: string
  /** Content after the label. */
  readonly trailing?: ReactNode
}

// One level of the menu tree, as its content reads it: the root's, from
// `Menu`, or a submenu's, from the item that opens it.
type MenuLevel = {
  /** The view the content is placed beside. */
  readonly anchor: RefObject<HostInstance | null>
  /** Closes this level: the whole menu at the root, the submenu alone below. */
  readonly close: () => void
  readonly isOpen: boolean
  /**
   * Follows an item's `href`. Read where the app's router reaches, outside
   * the overlay host, and handed down to every level.
   */
  readonly openLink: (href: string) => void
  /** The root's state, which every level closes the whole menu through. */
  readonly root: RootMenuTriggerState
  readonly submenu: boolean
}

type MenuLoadMoreProps = {
  /**
   * Draws the ring in a row of its own while more items are being fetched.
   * @default false
   */
  readonly isLoading?: boolean
  /**
   * What a screen reader calls the ring while it shows. Left out, it is the
   * word for it in the device's language, "Loading more" in English.
   */
  readonly label?: string
  /**
   * Called when the row comes within `scrollOffset` of the menu's visible
   * end, while nothing is loading.
   */
  readonly onLoadMore?: () => void
  /**
   * How far past the visible end of the menu the row starts loading, as a
   * share of the menu's visible height.
   * @default 1
   */
  readonly scrollOffset?: number
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

type MenuProps = {
  /** The trigger, then the `Menu.Content` it opens. */
  readonly children?: ReactNode
  /** Whether the menu starts open, when it keeps its own state. */
  readonly defaultOpen?: boolean
  /** Whether the menu is open, when the call site holds the state. */
  readonly isOpen?: boolean
  /** Called with the new state as the menu opens or closes. */
  readonly onOpenChange?: (isOpen: boolean) => void
  /**
   * What opens the menu: a press on the trigger, or a press held on it, in
   * which case a plain press runs the trigger's own `onPress`.
   * @default 'press'
   */
  readonly trigger?: MenuTrigger
}

type MenuSectionProps = {
  readonly 'aria-label'?: string
  /** The items in the section. */
  readonly children?: ReactNode
  /**
   * The section's heading, which names the group. A section without one is
   * a group with no name, and takes `aria-label` for one instead.
   */
  readonly header?: ReactNode
  readonly id?: Key
}

type MenuSeparatorProps = {
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

type MenuSide = OverlaySide

type MenuSubmenuProps = {
  /**
   * The item that opens the submenu, then the `Menu.Content` it opens.
   * Exactly those two, in that order.
   */
  readonly children: readonly [
    trigger: ReactElement<MenuItemProps>,
    content: ReactElement<MenuContentProps>,
  ]
}

type MenuTrigger = 'longPress' | 'press'

type PanelProps<T extends object> = MenuContentProps<T> & {
  readonly level: MenuLevel
  readonly setPresent: (present: boolean) => void
}

// What a row reads from the content it is drawn in.
type PanelValue<T> = {
  /** Runs a press on an item: its selection, its action and the close. */
  readonly activate: (node: Node<T>) => void
  /** The item a screen reader is sent to once the panel is placed. */
  readonly focusKey: Key | null
  readonly level: MenuLevel
  readonly setFocusTarget: (node: HostInstance | null) => void
  readonly state: TreeState<T>
  readonly viewport: Viewport
}

// The part of the menu's scroll view in view, for `Menu.LoadMore` to tell
// whether it is near: read when asked, with a listener told whenever the
// view scrolls or is laid out.
type Viewport = {
  readonly read: () => { readonly height: number; readonly offset: number }
  readonly subscribe: (listener: () => void) => () => void
}

const LevelContext = createContext<MenuLevel | null>(null)

/**
 * A list of actions or choices opened from a control. Pass `isOpen` with
 * `onOpenChange` to hold the open state, or `defaultOpen` to let it keep its
 * own.
 *
 * ```tsx
 * <Menu>
 *   <Button variant="outlined">Open</Button>
 *   <Menu.Content>
 *     <Menu.Item id="first">First item</Menu.Item>
 *   </Menu.Content>
 * </Menu>
 * ```
 *
 * A `Button` or `IconButton` placed directly inside `Menu` is its trigger,
 * and a press on it toggles the menu. Everything the menu shows goes in
 * `Menu.Content`, since the trigger lives in the screen while the menu is
 * drawn above it.
 */
function Menu({
  children,
  defaultOpen,
  isOpen,
  onOpenChange,
  trigger = 'press',
}: MenuProps) {
  const state = useMenuTriggerState({
    defaultOpen,
    isOpen,
    onOpenChange,
    trigger,
  })
  const anchor = useRef<HostInstance>(null)
  const openLink = useOpenLink()
  const close = useLatest(() => {
    state.close()
  })
  const slots = useMemo<ButtonSlots>(
    () =>
      trigger === 'longPress'
        ? {
            trigger: {
              expanded: state.isOpen,
              onLongPress: () => {
                state.open()
              },
              ref: anchor,
            },
          }
        : {
            default: () => {
              state.toggle()
            },
            trigger: { expanded: state.isOpen, ref: anchor },
          },
    [state, trigger],
  )
  const level = useMemo<MenuLevel>(
    () => ({
      anchor,
      close,
      isOpen: state.isOpen,
      openLink,
      root: state,
      submenu: false,
    }),
    [close, openLink, state],
  )

  return (
    <LevelContext value={level}>
      <ButtonSlotContext value={slots}>{children}</ButtonSlotContext>
    </LevelContext>
  )
}

/**
 * The menu itself, and the surface it is drawn on. Its items scroll when they
 * run past the room the window leaves on the side it opened on.
 *
 * A menu with nothing in it shows a muted "No results" row in place of its
 * items; pass `renderEmptyState` to draw something else.
 *
 * `style`, `ref` and `testID` land on the surface.
 */
function MenuContent<T extends object = object>(props: MenuContentProps<T>) {
  const level = use(LevelContext)

  if (level === null) {
    throw new Error('Menu.Content is drawn inside Menu or Menu.Submenu.')
  }

  const { anchor, isOpen } = level
  const [present, setPresent] = useState(isOpen)

  // Mounted the moment it opens, and kept until its exit has run.
  if (isOpen && !present) {
    setPresent(true)
  }

  useReturnFocus(present, false, anchor)

  if (!present) {
    return null
  }

  return (
    <Overlay>
      <MenuPanel<T> {...props} level={level} setPresent={setPresent} />
    </Overlay>
  )
}

/**
 * One action or choice. Its slots are the row's: `leading` before the label,
 * the label as children, and `trailing` after it. A selected item draws the
 * check, in place of `leading` where it has one and at the end of the row
 * where it has none, so choosing an item moves nothing in the menu. An item
 * that opens a submenu draws the chevron itself.
 *
 * The menu draws it from its entry in the collection, so it renders nothing
 * on its own. `style`, `ref` and `testID` land on the row.
 */
function MenuItem(_props: MenuItemProps): null {
  return null
}

// The entry the collection holds for an item, as React Stately's own `Item`
// gives one: keyed by the item's `id`, and carrying the props the row is
// drawn from.
MenuItem.getCollectionNode = function* getCollectionNode(props: ItemNodeProps) {
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
 * The row shown while more items are being fetched. `onLoadMore` is called
 * when it comes near the visible end of the menu, and the ring is drawn only
 * while `isLoading`. It goes last, after the items it loads more of.
 */
function MenuLoadMore(_props: MenuLoadMoreProps): null {
  return null
}

MenuLoadMore.getCollectionNode = function* getCollectionNode(
  props: MenuLoadMoreProps,
) {
  yield { hasChildNodes: false, props, rendered: null, type: 'loader' }
}

/**
 * A named group of items. `header` names it, and is what a screen reader
 * reads before the items inside.
 */
function MenuSection(_props: MenuSectionProps): null {
  return null
}

MenuSection.getCollectionNode = function* getCollectionNode(
  props: MenuSectionProps,
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
    'aria-label': props['aria-label'],
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

/** A rule between groups of items, with the menus page's 8dp either side. */
function MenuSeparator(_props: MenuSeparatorProps): null {
  return null
}

MenuSeparator.getCollectionNode = function* getCollectionNode(
  props: MenuSeparatorProps,
) {
  yield { hasChildNodes: false, props, rendered: null, type: 'separator' }
}

/**
 * An item that opens a menu of its own. Takes exactly two children: the
 * `Menu.Item` that opens it, then the `Menu.Content` it opens. A press on
 * the item opens it, and a second press closes it.
 */
function MenuSubmenu(_props: MenuSubmenuProps): null {
  return null
}

// The trigger item's own entry, carrying the content it opens.
MenuSubmenu.getCollectionNode = function* getCollectionNode(
  props: MenuSubmenuProps,
) {
  const [trigger, content] = props.children

  yield* MenuItem.getCollectionNode({ ...trigger.props, submenu: content })
}

/** Runs a press on an item, from its entry. Built by a call, as below. */
function activationOf<T>(panel: PanelValue<T>, node: Node<T>) {
  return () => {
    panel.activate(node)
  }
}

/**
 * The muted row a menu shows when nothing is in it: an item's box and label
 * in on surface variant, with no press of its own.
 */
function EmptyRow() {
  const theme = useTheme()
  const own = stylesOf(theme)
  const label = useTypeRole('labelLarge')

  return (
    <View style={rowStyleOf(theme, { variant: 'menu' })}>
      <NativeText style={composeStyles<TextStyle>(label, own.empty)}>
        {messagesFor().noResults}
      </NativeText>
    </View>
  )
}

// What the menu shows when nothing is in it.
function emptyState() {
  return <EmptyRow />
}

/** The first item a press reaches, which a screen reader is sent to. */
function firstItemKey<T>(state: TreeState<T>) {
  for (const key of state.collection.getKeys()) {
    if (
      state.collection.getItem(key)?.type === 'item' &&
      !state.selectionManager.isDisabled(key)
    ) {
      return key
    }
  }

  return null
}

/**
 * The role a row reports. React Native's roles stop at `menuitem`, which iOS
 * and Android read with the checked state beside it. Web's checkable items
 * are roles of their own, which React Native Web writes from
 * `accessibilityRole`, typed as any string.
 */
function itemRoleOf(
  mode: SelectionMode,
): Pick<ViewProps, 'accessibilityRole' | 'role'> {
  if (Platform.OS !== 'web' || mode === 'none') {
    return { role: 'menuitem' }
  }

  return {
    accessibilityRole: mode === 'single' ? 'menuitemradio' : 'menuitemcheckbox',
  }
}

/**
 * The row `Menu.LoadMore` draws: nothing while idle, and the ring while
 * loading. Each time it is laid out, and each time the menu scrolls, it asks
 * whether it has come within `scrollOffset` of the visible end, and calls
 * `onLoadMore` once for each place it is found there, so a load that adds
 * nothing does not start another.
 */
function LoaderRow({
  props,
  viewport,
}: {
  readonly props: MenuLoadMoreProps
  readonly viewport: Viewport
}) {
  const own = stylesOf(useTheme())
  const {
    isLoading = false,
    label,
    onLoadMore,
    scrollOffset = 1,
    style,
    testID,
  } = props
  const top = useRef<null | number>(null)
  const loadedAt = useRef<null | number>(null)
  // The latest props, for a check the viewport runs between renders.
  const latest = useRef({ isLoading, onLoadMore, scrollOffset })

  useEffect(() => {
    latest.current = { isLoading, onLoadMore, scrollOffset }
  })

  const check = useCallback(() => {
    const y = top.current
    const { height, offset } = viewport.read()
    const now = latest.current

    if (
      y === null ||
      height === 0 ||
      now.isLoading ||
      now.onLoadMore === undefined ||
      loadedAt.current === y ||
      y > offset + height * (1 + now.scrollOffset)
    ) {
      return
    }

    loadedAt.current = y
    now.onLoadMore()
  }, [viewport])

  useEffect(() => viewport.subscribe(check), [check, viewport])

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      top.current = event.nativeEvent.layout.y
      check()
    },
    [check],
  )

  if (!isLoading) {
    return (
      <View
        onLayout={onLayout}
        style={composeStyles<ViewStyle>(styles.sentinel, style)}
        testID={testID}
      />
    )
  }

  return (
    <View
      onLayout={onLayout}
      role="menuitem"
      style={composeStyles<ViewStyle>(own.loading, style)}
      testID={testID}
    >
      <ProgressIndicator
        diameter={LOADING_DIAMETER}
        isIndeterminate
        label={label ?? messagesFor().loadingMore}
        variant="circular"
      />
    </View>
  )
}

// One entry of the collection, drawn as the part it came from.
function MenuNode<T>({
  node,
  panel,
}: {
  readonly node: Node<T>
  readonly panel: PanelValue<T>
}) {
  const own = stylesOf(useTheme())

  switch (node.type) {
    case 'loader': {
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- a node carries the props its part was written with, which React Stately types as `any`
      const props: MenuLoadMoreProps = node.props
      return <LoaderRow props={props} viewport={panel.viewport} />
    }
    case 'section': {
      return <SectionNode node={node} panel={panel} />
    }
    case 'separator': {
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- see above
      const { style, testID }: MenuSeparatorProps = node.props
      return (
        <Separator
          style={composeStyles<ViewStyle>(own.separator, style)}
          testID={testID}
        />
      )
    }
    default: {
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- see above
      const props: ItemNodeProps = node.props
      return props.submenu === undefined ? (
        <MenuRow
          node={node}
          onActivate={activationOf(panel, node)}
          panel={panel}
        />
      ) : (
        <SubmenuRow content={props.submenu} node={node} panel={panel} />
      )
    }
  }
}

// The surface and the rows inside it, drawn in the overlay host above the
// screen, so the placement measures the layer the surface is drawn in.
function MenuPanel<T extends object>({
  align = 'start',
  alignOffset,
  children,
  defaultSelectedKeys,
  disabledKeys,
  disallowEmptySelection,
  items,
  level,
  onAction,
  onClose,
  onSelectionChange,
  ref,
  renderEmptyState = emptyState,
  selectedKeys,
  selectionMode = 'none',
  setPresent,
  shouldCloseOnSelect,
  side,
  sideOffset,
  style,
  ...props
}: PanelProps<T>) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const { anchor, close, isOpen, openLink, root, submenu } = level
  const state = useTreeState<T>({
    // Each part builds its own entry in the collection; see the parts'
    // `getCollectionNode`. The collection skips what is not an element, as a
    // ReactNode may be, and asks any element for its entry.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    children: children as TreeProps<T>['children'],
    defaultSelectedKeys,
    disabledKeys,
    disallowEmptySelection,
    items,
    onSelectionChange,
    selectedKeys,
    selectionMode,
  })
  const placement = useAnchoredPlacement({
    align,
    alignOffset: alignOffset ?? (submenu ? -theme.spacing.sm : undefined),
    anchor,
    side: side ?? (submenu ? (I18nManager.isRTL ? 'left' : 'right') : 'bottom'),
    sideOffset: sideOffset ?? (submenu ? 0 : undefined),
  })
  const motion = usePanelMotion(isOpen, placement.placed, setPresent)
  const [focusTarget, setFocusTarget] = useState<HostInstance | null>(null)
  const scroll = useViewport()
  const focusKey = firstItemKey(state)

  useBackToClose(close, isOpen)
  useFocusOnPlaced(placement.placed, focusTarget)

  const activate = useCallback(
    (node: Node<T>) => {
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- a node carries the props its part was written with, which React Stately types as `any`
      const item: ItemNodeProps = node.props
      const closes =
        shouldCloseOnSelect ??
        (selectionMode !== 'multiple' || item.href !== undefined)

      if (selectionMode !== 'none') {
        state.selectionManager.select(node.key)
      }

      if (item.onAction === undefined) {
        onAction?.(node.key)
      } else {
        item.onAction()
      }

      if (item.href !== undefined) {
        openLink(item.href)
      }

      if (closes) {
        onClose?.()
        root.close()
      }
    },
    [
      onAction,
      onClose,
      openLink,
      root,
      selectionMode,
      shouldCloseOnSelect,
      state,
    ],
  )
  const panel = useMemo<PanelValue<T>>(
    () => ({
      activate,
      focusKey,
      level,
      setFocusTarget,
      state,
      viewport: scroll.viewport,
    }),
    [activate, focusKey, level, scroll.viewport, state],
  )
  const nodes = [...state.collection]

  return (
    <>
      {submenu || !isOpen ? null : <DismissLayer onPress={close} />}
      <Animated.View
        onAccessibilityEscape={close}
        role="menu"
        {...props}
        onLayout={placement.onLayout}
        ref={ref}
        style={composeStyles<AnimatedStyle<ViewStyle>>(
          own.surface,
          placement.style,
          { transformOrigin: PANEL_ORIGINS[placement.side] },
          motion,
          style,
        )}
      >
        <ScrollView
          contentContainerStyle={own.content}
          onLayout={scroll.onLayout}
          onScroll={scroll.onScroll}
          scrollEventThrottle={16}
          style={styles.scroll}
        >
          {nodes.length === 0 ? (
            <View role="menuitem">{renderEmptyState()}</View>
          ) : (
            nodes.map((node) => (
              <MenuNode key={node.key} node={node} panel={panel} />
            ))
          )}
        </ScrollView>
      </Animated.View>
    </>
  )
}

/**
 * An item's row: the state layer, the ripple and the focus ring over the
 * leading slot, the label and the trailing slot, on tertiary container while
 * selected.
 */
function MenuRow<T>({
  anchor,
  expanded,
  node,
  onActivate,
  panel,
}: {
  /** Where the row's node is kept, for a submenu to be placed against. */
  readonly anchor?: RefObject<HostInstance | null>
  /** Whether the submenu the row opens is open. */
  readonly expanded?: boolean
  readonly node: Node<T>
  readonly onActivate: () => void
  readonly panel: PanelValue<T>
}) {
  const theme = useTheme()
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- a node carries the props its item was written with, which React Stately types as `any`
  const {
    children,
    href: _href,
    id: _id,
    isDisabled: _isDisabled,
    leading,
    onAction: _onAction,
    onBlur,
    onFocus,
    onHoverIn,
    onHoverOut,
    onPress,
    onPressIn,
    onPressOut,
    ref,
    style,
    submenu,
    textValue: _textValue,
    trailing,
    ...props
  }: ItemNodeProps = node.props
  const { selectionManager } = panel.state
  // The selection manager reads an item's own `isDisabled` off its entry,
  // beside the menu's `disabledKeys`, so it answers for both.
  const disabled = selectionManager.isDisabled(node.key)
  const selectable = selectionManager.selectionMode !== 'none'
  const selected = selectable && selectionManager.isSelected(node.key)
  const content = rowContentColor(theme, {
    isDisabled: disabled,
    isSelected: selected,
    variant: 'menu',
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

  const hasLeading = leading !== undefined && leading !== null
  const check = selected ? (
    <CheckGlyph color={content} size={CHECK_SIZE} />
  ) : null
  const lead = hasLeading ? (check ?? leading) : null
  const end =
    submenu === undefined ? (
      <>
        {trailing}
        {hasLeading ? null : check}
      </>
    ) : (
      <>
        {trailing}
        <ChevronEndGlyph color={content} size={CHEVRON_SIZE} />
      </>
    )
  const hasEnd =
    submenu !== undefined ||
    (trailing !== undefined && trailing !== null) ||
    (!hasLeading && check !== null)

  return (
    <Pressable
      {...itemRoleOf(selectionManager.selectionMode)}
      {...(selectable ? { 'aria-checked': selected } : undefined)}
      {...(submenu === undefined
        ? undefined
        : { ...HAS_SUBMENU, 'aria-expanded': expanded })}
      {...props}
      {...feedback.handlers}
      disabled={disabled}
      onPress={pressThen(onPress, onActivate)}
      ref={refsOf(
        anchor,
        node.key === panel.focusKey ? panel.setFocusTarget : undefined,
        ref,
      )}
      style={composeStyles<ViewStyle>(
        rowStyleOf(theme, { isSelected: selected, variant: 'menu' }),
        feedback.ring,
        feedback.ring === undefined ? undefined : rowStyles.ring,
        style,
      )}
    >
      {feedback.layer}
      <RowContent
        isDisabled={disabled}
        isSelected={selected}
        leading={lead}
        trailing={hasEnd ? end : undefined}
        variant="menu"
      >
        {children}
      </RowContent>
    </Pressable>
  )
}

/**
 * The press handler of a row: the call site's own `onPress`, then the row's
 * activation. Built by a call rather than written inline at the prop, which
 * is what react-perf's no-new-function-as-prop is after.
 */
function pressThen(onPress: PressableProps['onPress'], onActivate: () => void) {
  return (event: GestureResponderEvent) => {
    onPress?.(event)
    onActivate()
  }
}

/** A section: its heading, then its items, as a group named by the heading. */
function SectionNode<T>({
  node,
  panel,
}: {
  readonly node: Node<T>
  readonly panel: PanelValue<T>
}) {
  const own = stylesOf(useTheme())
  const titleRole = useTypeRole('titleSmall')
  const id = useId()
  const header = node.rendered
  const named = header !== undefined && header !== null
  // The TreeCollection useTreeState builds has no getChildren, so a section's
  // items are read off its node, as React Aria's own menu reads them.
  const children =
    panel.state.collection.getChildren?.(node.key) ??
    // oxlint-disable-next-line typescript/no-deprecated -- the only route to them here
    node.childNodes

  return (
    <View
      aria-label={named ? undefined : node['aria-label']}
      aria-labelledby={named ? id : undefined}
      role="group"
    >
      {named ? (
        <NativeText
          nativeID={id}
          style={composeStyles<TextStyle>(titleRole, own.header)}
        >
          {header}
        </NativeText>
      ) : null}
      {[...children].map((child) => (
        <MenuNode key={child.key} node={child} panel={panel} />
      ))}
    </View>
  )
}

/**
 * An item that opens a submenu: its row, and the submenu's content, drawn
 * under the submenu's own level so it opens beside the row and closes on its
 * own. A press on the row toggles it.
 */
function SubmenuRow<T>({
  content,
  node,
  panel,
}: {
  readonly content: ReactElement<MenuContentProps>
  readonly node: Node<T>
  readonly panel: PanelValue<T>
}) {
  const { openLink, root } = panel.level
  const anchor = useRef<HostInstance>(null)
  const submenuState = useSubmenuTriggerState({ triggerKey: node.key }, root)
  const close = useLatest(() => {
    submenuState.close()
  })
  const toggle = useCallback(() => {
    submenuState.toggle()
  }, [submenuState])
  const level = useMemo<MenuLevel>(
    () => ({
      anchor,
      close,
      isOpen: submenuState.isOpen,
      openLink,
      root,
      submenu: true,
    }),
    [close, openLink, root, submenuState.isOpen],
  )

  return (
    <>
      <MenuRow
        anchor={anchor}
        expanded={submenuState.isOpen}
        node={node}
        onActivate={toggle}
        panel={panel}
      />
      <LevelContext value={level}>{content}</LevelContext>
    </>
  )
}

/**
 * A callback of one identity for the life of the component, which calls the
 * latest `callback` it was rendered with. A menu's state is a new object on
 * every render, and the back gesture's listener is added again whenever the
 * callback it closes through changes: added again after a submenu's, the
 * menu's own would be the one Android calls first, and the gesture would
 * close the whole menu rather than the submenu.
 */
function useLatest(callback: () => void) {
  const latest = useRef(callback)

  useEffect(() => {
    latest.current = callback
  })

  return useCallback(() => {
    latest.current()
  }, [])
}

/**
 * Keeps track of the part of the menu's scroll view in view, for
 * `Menu.LoadMore`, and tells it whenever that changes.
 */
function useViewport() {
  const seen = useRef({ height: 0, offset: 0 })
  const [listeners] = useState(() => new Set<() => void>())
  const viewport = useMemo<Viewport>(
    () => ({
      read: () => seen.current,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    }),
    [listeners],
  )

  function notify() {
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    onLayout: (event: LayoutChangeEvent) => {
      seen.current = {
        ...seen.current,
        height: event.nativeEvent.layout.height,
      }
      notify()
    },
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      seen.current = {
        ...seen.current,
        offset: event.nativeEvent.contentOffset.y,
      }
      notify()
    },
    viewport,
  }
}

Menu.Content = MenuContent
Menu.Item = MenuItem
Menu.LoadMore = MenuLoadMore
Menu.Section = MenuSection
Menu.Separator = MenuSeparator
Menu.Submenu = MenuSubmenu

export {
  Menu,
  MenuContent,
  MenuItem,
  MenuLoadMore,
  MenuSection,
  MenuSeparator,
  MenuSubmenu,
}
export type {
  MenuAlign,
  MenuContentProps,
  MenuItemProps,
  MenuLoadMoreProps,
  MenuProps,
  MenuSectionProps,
  MenuSeparatorProps,
  MenuSide,
  MenuSubmenuProps,
  MenuTrigger,
}
