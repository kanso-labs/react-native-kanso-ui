import type { ComponentRef, ReactElement, ReactNode, Ref } from 'react'
import type {
  ColorValue,
  GestureResponderEvent,
  LayoutChangeEvent,
  LayoutRectangle,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PressableProps,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { Key, Node, Orientation } from 'react-stately'
import type {
  TabListState,
  TabListStateOptions,
} from 'react-stately/useTabListState'

import {
  Children,
  createContext,
  isValidElement,
  use,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import {
  I18nManager,
  Text as NativeText,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useTabListState } from 'react-stately/useTabListState'

import type { IconStyle } from '../../glyphs/icon-style'
import type { ResolvedTheme } from '../../theme/scope'

import { IconStyleContext } from '../../glyphs/icon-style'
import { usePressFeedback } from '../../press'
import { useLinkPress } from '../../router'
import { withOpacity } from '../../theme/color'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'
import { Badge } from '../badge'

// kanso-ui's Tabs: the tabs page's primary and secondary tabs, with the
// panels they switch between. Both are a 48dp bar divided into equal
// sections, with a 1dp outline-variant divider inside the bar along its
// bottom edge.
//
// **Primary** draws the active tab in the primary role and, under its label,
// a 3dp primary indicator rounded along its top. The indicator follows the
// label rather than the tab, 2dp short of the label at either end and never
// shorter than 24dp. A primary tab given an icon stacks the page's 24dp icon
// over its label, 2dp apart, and the bar grows to the page's 64dp.
//
// **Secondary** is the strip that sits under a primary one. Its active tab
// keeps the on-surface role, and its 2dp primary indicator spans the whole
// tab. An icon sits before the label, 8dp from it, and the strip keeps its
// 48dp.
//
// A badge sits on the icon where a primary tab stacks one, and 4dp after the
// label anywhere else.
//
// **The bar is equal sections unless `layout` says otherwise.**
// `layout="scrollable"` gives each tab its label's width, between 72dp and
// 264dp, in a bar that scrolls without a scroll indicator and brings the
// selected tab into view, at once the first time and with the platform's
// own scroll after that.
//
// **`orientation="vertical"` turns the bar on its side**, as web does, since
// the page draws no vertical tabs: the tabs stack, the divider runs down the
// bar's end edge, and each indicator lies along that edge, 3dp and rounded
// toward the tab on a primary bar, 2dp and square on a secondary one. The bar
// sits beside the panels rather than above them.
//
// **The state is React Stately's `useTabListState`**, the one web's React Aria
// keeps. `Tabs` finds its `Tabs.List` among its children, through any view or
// fragment around it, and builds the state from the tabs written there, so
// the selection, the first tab chosen when none is given and the disabled
// keys behave as they do on web. Each `Tabs.Tab` gives the state its entry and
// renders nothing itself: the list draws every tab from its entry.
//
// **The indicator is one view**, which moves to the selected tab's measured
// place over medium1 on the emphasized curve, as web's shared element does,
// and at once under reduced motion or when the bar itself is laid out again.
// `Tabs.Panels` moves its height the same way, between the heights its
// panels report.
//
// A tab is a `tab` reporting whether it is selected, inside a `tablist`, and
// a panel is a `tabpanel` named by its tab. Touch has no arrow keys, so web's
// `keyboardActivation` is not taken.
//
// **The label comes first in the tree and is drawn after the icon**, through
// a reversed row or column, as src/navigation does it and for its reason: a
// badge's count is text, and ahead of the label it put the count before the
// name.

/** The bar's three decisions, which every part reads from the root. */
type Bar = {
  readonly layout: TabsLayout
  readonly orientation: Orientation
  readonly variant: TabsVariant
}

/** What a tab has reported of its place in the bar. */
type Measured = {
  readonly label?: LayoutRectangle
  readonly tab?: LayoutRectangle
}

/** Where the indicator lies along the bar's own axis. */
type Placement = {
  readonly length: number
  readonly offset: number
}

type TabsContextValue = {
  readonly bar: Bar
  /** Whether a `Tabs.List` was found among the root's children. */
  readonly found: boolean
  /** The root's own id, which the tabs' and panels' ids start with. */
  readonly ids: string
  readonly state: TabListState<object>
}

/** How the bar shares its room among the tabs. */
type TabsLayout = 'fixed' | 'scrollable'

type TabsListElement = ReactElement<TabsListProps>

type TabsListProps<T extends object = object> = {
  /** Names the bar, for a screen reader. */
  readonly 'aria-label'?: string
  /** Names the bar after the element with this id. */
  readonly 'aria-labelledby'?: string
  /**
   * The tabs, as `Tabs.Tab` elements each given an `id`, or with `items` a
   * function from an item to its tab.
   */
  readonly children?: ((item: T) => ReactElement) | ReactNode
  /** The items to draw a tab for, through the function `children` is. */
  readonly items?: Iterable<T>
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

type TabsPanelProps = {
  readonly children?: ReactNode
  /**
   * The key of the tab the panel belongs to, which is drawn while that tab
   * is selected. A panel given none is drawn under whichever tab is.
   */
  readonly id?: Key
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

type TabsPanelsProps = {
  /** The `Tabs.Panel` elements, whose box moves between their heights. */
  readonly children?: ReactNode
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

type TabsProps = {
  /** The bar, as a `Tabs.List`, and the `Tabs.Panel` elements it switches. */
  readonly children?: ReactNode
  /** The tab selected at first, when the bar keeps its own selection. */
  readonly defaultSelectedKey?: Key
  /** The keys of the tabs that take no press, and draw disabled. */
  readonly disabledKeys?: Iterable<Key>
  /**
   * Disables every tab.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * How the bar shares its room: `fixed` divides it into equal sections, and
   * `scrollable` gives each tab its label's width in a bar that scrolls,
   * which is the page's choice for more tabs than the room has sections for.
   * @default 'fixed'
   */
  readonly layout?: TabsLayout
  /** Called with the key of the tab that has just been selected. */
  readonly onSelectionChange?: (key: Key) => void
  /**
   * Whether the bar runs across, above its panels, or down, beside them.
   * @default 'horizontal'
   */
  readonly orientation?: Orientation
  readonly ref?: Ref<ComponentRef<typeof View>>
  /** The key of the selected tab, when the call site holds it. */
  readonly selectedKey?: Key | null
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
  /**
   * Which of the page's two tab bars this is: `primary` for the main one,
   * `secondary` for a strip under a primary one.
   * @default 'primary'
   */
  readonly variant?: TabsVariant
}

type TabsTabProps = Omit<
  PressableProps,
  'children' | 'disabled' | 'id' | 'role' | 'style'
> & {
  /**
   * A badge on the tab: `true` for the badges page's small dot, a number for
   * the large badge holding it. It sits on a primary tab's icon, and after
   * the label anywhere else. The badge is hidden from a screen reader, so say
   * what it says in the tab's `aria-label` too: "Second item, 3 new".
   */
  readonly badge?: boolean | number
  /** The tab's label. */
  readonly children?: ReactNode
  /** Where the tab goes when pressed, through the app's router. */
  readonly href?: string
  /**
   * An icon with the label, at the page's 24dp: over it on a primary tab,
   * whose bar grows to 64dp, and before it on a secondary one. The slot hands
   * it its colour and size through `useIconStyle()`.
   */
  readonly icon?: ReactNode
  /**
   * The tab's key, which selection reports and its `Tabs.Panel` shares.
   * Without one, a tab drawn from `items` takes its item's `id` or `key`.
   */
  readonly id?: Key
  /**
   * Draws the tab disabled, and it takes no press, as a key in the bar's
   * `disabledKeys` does.
   * @default false
   */
  readonly isDisabled?: boolean
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
  /**
   * The tab's text, for a label that is not a plain string. Read off
   * `children` when it is one.
   */
  readonly textValue?: string
}

/** The tabs page's two styles of tab bar. */
type TabsVariant = 'primary' | 'secondary'

// The page's thicknesses for the two indicators, and the least a primary one
// is drawn at, which no token holds.
const PRIMARY_THICKNESS = 3
const SECONDARY_THICKNESS = 2
const LEAST_INDICATOR = 24

// The page's 24dp icon, and the 64dp a primary bar grows to with one stacked
// over a label. No sizing token holds 64.
const ICON_SIZE = 24
const STACKED_HEIGHT = 64

// A scrollable bar's tab: MDC-Android's 72dp at the least and 264dp at the
// most, as on web.
const SCROLLABLE_LEAST = 72
const SCROLLABLE_MOST = 264

const NO_MEASUREMENTS: ReadonlyMap<Key, Measured> = new Map()
const NO_HEIGHTS: ReadonlyMap<Key, number> = new Map()
const NO_TABS: ReactNode[] = []

const TabsContext = createContext<null | TabsContextValue>(null)

// The heights the panels inside a `Tabs.Panels` report, by key. Null is no
// box, and a panel then reports nothing.
const PanelHeightContext = createContext<
  ((key: Key, height: number | undefined) => void) | null
>(null)

const styles = StyleSheet.create({
  // The bar's left edge, which a horizontal indicator is moved from, in the
  // two spellings `leftEdgeOf` picks between.
  atLeft: {
    left: 0,
  },
  atRight: {
    right: 0,
  },
  // A badge after the label, which keeps its size while the label narrows.
  badge: {
    flexShrink: 0,
  },
  // Beside a vertical bar a panel takes the rest of the row.
  besideBar: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  // What a box's height moves inside: its content lays out at its own height
  // whatever the box is, which is what a panel's `onLayout` measures.
  clip: {
    overflow: 'hidden',
  },
  // The page's 24dp icon slot.
  icon: {
    alignItems: 'center',
    flexShrink: 0,
    height: ICON_SIZE,
    justifyContent: 'center',
    width: ICON_SIZE,
  },
  // A label longer than its tab narrows to fit inside it rather than pushing
  // out past its padding.
  label: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    minWidth: 0,
  },
  // The label's text and the badge after it.
  line: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    minWidth: 0,
  },
  // A vertical bar holds its tabs in a column as wide as its widest.
  listVertical: {
    flexDirection: 'column',
    flexShrink: 0,
  },
  // A vertical bar sits beside its panels.
  rootVertical: {
    flexDirection: 'row',
  },
  // A horizontal bar holds its tabs in a row.
  row: {
    flexDirection: 'row',
  },
  // A bar that scrolls takes the room the bar has, rather than its tabs'
  // whole length.
  scroll: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  // A bar's tab in its scrolling form, as wide as its label.
  tabScrollable: {
    flexGrow: 0,
    flexShrink: 0,
    maxWidth: SCROLLABLE_MOST,
    minWidth: SCROLLABLE_LEAST,
  },
  // An equal share of the bar, whatever its label measures.
  tabShared: {
    flex: 1,
    minWidth: 0,
  },
  tabStacked: {
    minHeight: STACKED_HEIGHT,
  },
  // A vertical bar's tab: one row of it, as tall as its content, with its
  // label at the start.
  tabVertical: {
    justifyContent: 'flex-start',
  },
  text: {
    flexShrink: 1,
    textAlign: 'center',
  },
  textVertical: {
    textAlign: 'auto',
  },
})

const stylesOf = themedStyles(({ colors, sizing, spacing }: ResolvedTheme) =>
  StyleSheet.create({
    // The divider, inside the bar along its bottom edge, so it is part of the
    // 48 rather than a pixel under it, and the indicator is drawn over it.
    divider: {
      backgroundColor: colors.outlineVariant,
      bottom: 0,
      height: 1,
      left: 0,
      pointerEvents: 'none',
      position: 'absolute',
      right: 0,
    },
    // Down a vertical bar's end edge.
    dividerVertical: {
      backgroundColor: colors.outlineVariant,
      bottom: 0,
      end: 0,
      pointerEvents: 'none',
      position: 'absolute',
      top: 0,
      width: 1,
    },
    // Under the label along a horizontal bar, rounded along its top.
    indicator: {
      backgroundColor: colors.primary,
      borderTopLeftRadius: PRIMARY_THICKNESS,
      borderTopRightRadius: PRIMARY_THICKNESS,
      bottom: 0,
      height: PRIMARY_THICKNESS,
      pointerEvents: 'none',
      position: 'absolute',
    },
    // Across the whole tab, square.
    indicatorSecondary: {
      backgroundColor: colors.primary,
      bottom: 0,
      height: SECONDARY_THICKNESS,
      pointerEvents: 'none',
      position: 'absolute',
    },
    indicatorSecondaryVertical: {
      backgroundColor: colors.primary,
      end: 0,
      pointerEvents: 'none',
      position: 'absolute',
      top: 0,
      width: SECONDARY_THICKNESS,
    },
    // Along the tab's end edge, rounded toward the tab.
    indicatorVertical: {
      backgroundColor: colors.primary,
      borderBottomStartRadius: PRIMARY_THICKNESS,
      borderTopStartRadius: PRIMARY_THICKNESS,
      end: 0,
      pointerEvents: 'none',
      position: 'absolute',
      top: 0,
      width: PRIMARY_THICKNESS,
    },
    // A secondary tab's icon before its label, 8dp from it. The label comes
    // first in the tree, so the row runs backwards.
    labelInline: {
      flexDirection: 'row-reverse',
      gap: spacing.sm,
    },
    // A primary tab's icon over its label, 2dp apart.
    labelStacked: {
      flexDirection: 'column-reverse',
      gap: spacing.xxs,
    },
    // A badge 4dp after the label.
    lineBadged: {
      gap: spacing.xs,
    },
    // A minimum rather than a height, so the bar takes its tallest tab's:
    // the row stretches every tab in it to one height.
    tab: {
      alignItems: 'center',
      boxSizing: 'border-box',
      flexDirection: 'row',
      justifyContent: 'center',
      minHeight: sizing.controlMd,
      paddingHorizontal: spacing.lg,
    },
  }),
)

// The focus ring, drawn inside the tab as web's is, so a focused tab shows
// its whole ring rather than the half its neighbours cover.
const ringStyles = StyleSheet.create({
  ring: {
    outlineOffset: -2,
  },
})

/**
 * A tab bar and the panels it switches between. Pass `selectedKey` with
 * `onSelectionChange` to hold the selection, or `defaultSelectedKey` to let
 * the bar keep its own. Each `Tabs.Tab` names the `Tabs.Panel` it shows
 * through a shared `id`, and a bar may stand alone without panels.
 *
 * ```tsx
 * <Tabs defaultSelectedKey="first">
 *   <Tabs.List aria-label="Sections">
 *     <Tabs.Tab id="first">First item</Tabs.Tab>
 *     <Tabs.Tab id="second">Second item</Tabs.Tab>
 *   </Tabs.List>
 *   <Tabs.Panel id="first">
 *     <Text>Supporting line</Text>
 *   </Tabs.Panel>
 *   <Tabs.Panel id="second">
 *     <Text>Supporting line</Text>
 *   </Tabs.Panel>
 * </Tabs>
 * ```
 *
 * Write the `Tabs.List` among the children of `Tabs`, inside any view or
 * fragment, rather than in a component of the call site's own: the bar is
 * found there, and its tabs are what the selection is built from.
 *
 * `style`, `ref` and `testID` land on the root view, the one a layout
 * positions.
 */
function Tabs({
  children,
  defaultSelectedKey,
  disabledKeys,
  isDisabled,
  layout = 'fixed',
  onSelectionChange,
  orientation = 'horizontal',
  ref,
  selectedKey,
  style,
  testID,
  variant = 'primary',
}: TabsProps) {
  const list = listOf(children)
  const state = useTabListState<object>({
    // Each tab builds its own entry in the collection; see
    // `TabsTab.getCollectionNode`. The collection skips what is not an
    // element, as a ReactNode may be, and asks any element for its entry.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    children: (list?.props.children ??
      NO_TABS) as TabListStateOptions<object>['children'],
    defaultSelectedKey,
    disabledKeys,
    isDisabled,
    items: list?.props.items,
    onSelectionChange,
    selectedKey: selectedKey ?? undefined,
  })
  const ids = useId()
  const context = contextOf(
    { layout, orientation, variant },
    list !== undefined,
    ids,
    state,
  )

  return (
    <TabsContext value={context}>
      <View
        ref={ref}
        style={composeStyles<ViewStyle>(
          orientation === 'vertical' ? styles.rootVertical : undefined,
          style,
        )}
        testID={testID}
      >
        {children}
      </View>
    </TabsContext>
  )
}

/**
 * The bar: every tab, drawn from the entries its `Tabs.Tab` children gave
 * the root, with the divider and the indicator. Name it with `aria-label` or
 * `aria-labelledby`.
 *
 * `style`, `ref` and `testID` land on the bar's own view.
 */
function TabsList<T extends object = object>({
  'aria-label': ariaLabel,
  'aria-labelledby': labelledBy,
  ref,
  style,
  testID,
}: TabsListProps<T>) {
  const { bar, ids, state } = useTabs('Tabs.List', true)
  const theme = useTheme()
  const own = stylesOf(theme)
  const reduceMotion = useReducedMotion()
  const [measured, setMeasured] = useState(NO_MEASUREMENTS)
  const [viewport, setViewport] = useState(0)
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)
  const scrolled = useRef(0)
  // The key last brought into view, and undefined until one has been, which
  // is what makes the first reveal instant.
  const revealed = useRef<Key | null | undefined>(undefined)
  const vertical = bar.orientation === 'vertical'
  const scrollable = bar.layout === 'scrollable'
  const { selectedKey } = state
  const selected = selectedKey === null ? undefined : measured.get(selectedKey)
  const placement = placementOf(bar, selected, theme.spacing.xxs)

  const measure = useCallback(
    (key: Key, part: keyof Measured, layout: LayoutRectangle) => {
      setMeasured((previous) => withMeasurement(previous, key, part, layout))
    },
    [],
  )

  // Keeps how far the bar has scrolled, for the next reveal to measure from.
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = event.nativeEvent
      scrolled.current = vertical ? contentOffset.y : contentOffset.x
    },
    [vertical],
  )

  // Brings the selected tab into view in a bar that scrolls, as it becomes
  // the selected one.
  useEffect(() => {
    const tab = selected?.tab

    if (
      !scrollable ||
      tab === undefined ||
      viewport === 0 ||
      revealed.current === selectedKey
    ) {
      return
    }

    const first = revealed.current === undefined
    revealed.current = selectedKey

    const target = revealOffset(
      scrolled.current,
      viewport,
      vertical ? tab.y : tab.x,
      vertical ? tab.height : tab.width,
    )

    if (target !== undefined) {
      const animated = !first && !reduceMotion
      scroll.current?.scrollTo(
        vertical ? { animated, y: target } : { animated, x: target },
      )
    }
  }, [reduceMotion, scrollable, selected, selectedKey, vertical, viewport])

  const tabs = (
    <>
      {[...state.collection].map((node) => (
        <ListTab
          bar={bar}
          ids={ids}
          key={node.key}
          node={node}
          onMeasure={measure}
          state={state}
        />
      ))}
      {placement === undefined ? null : (
        <Indicator bar={bar} placement={placement} selectedKey={selectedKey} />
      )}
    </>
  )

  return (
    <View
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      ref={ref}
      role="tablist"
      style={composeStyles<ViewStyle>(
        vertical ? styles.listVertical : styles.row,
        style,
      )}
      testID={testID}
    >
      <View style={vertical ? own.dividerVertical : own.divider} />
      {scrollable ? (
        <ScrollView
          horizontal={!vertical}
          onLayout={viewportOf(setViewport, vertical)}
          onScroll={onScroll}
          ref={scroll}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          {tabs}
        </ScrollView>
      ) : (
        tabs
      )}
    </View>
  )
}

/**
 * One tab of a `Tabs.List`, which draws it: the root builds its selection
 * from these, so one renders nothing on its own. Give every tab an `id`,
 * which is the key selection reports and its `Tabs.Panel` shares.
 */
function TabsTab(_props: TabsTabProps): null {
  return null
}

// The entry the root's collection holds for a tab, as React Stately's own
// `Item` gives one: keyed by the tab's `id`, and carrying the props the bar
// draws it from.
TabsTab.getCollectionNode = function* getCollectionNode(props: TabsTabProps) {
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

type TabState = {
  readonly disabled: boolean
  readonly engaged: boolean
  readonly selected: boolean
}

// The badge, which wraps the icon where a primary tab stacks one and stands
// after the label anywhere else: `true` for the small dot, a number for the
// large badge, and nothing for `false`.
function badgeFor(
  badge: boolean | number | undefined,
  icon?: ReactNode,
): ReactNode {
  if (badge === undefined || badge === false) {
    return icon ?? null
  }
  return (
    <Badge
      count={badge === true ? undefined : badge}
      style={icon === undefined ? styles.badge : undefined}
    >
      {icon}
    </Badge>
  )
}

/**
 * The colour a tab draws its label and icon in: primary for the active tab
 * of a primary bar and on surface for a secondary one's, on surface for an
 * inactive tab a pointer, a focus or a press engages, on surface variant at
 * rest, and on surface at the disabled content opacity while disabled.
 */
function colorOf(
  { colors, stateLayerOpacity }: ResolvedTheme,
  variant: TabsVariant,
  { disabled, engaged, selected }: TabState,
): string {
  if (disabled) {
    return withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)
  }
  if (selected) {
    return variant === 'primary' ? colors.primary : colors.onSurface
  }
  return engaged ? colors.onSurface : colors.onSurfaceVariant
}

// Built by a call rather than written inline at the prop, which is what
// react-perf's jsx-no-new-object-as-prop is after; the React Compiler
// memoises the result on its inputs.
function contextOf(
  bar: Bar,
  found: boolean,
  ids: string,
  state: TabListState<object>,
): TabsContextValue {
  return { bar, found, ids, state }
}

// A panel's `onLayout` inside a `Tabs.Panels`, which reports its height, and
// none outside one.
function heightOf(
  report: ((key: Key, height: number | undefined) => void) | null,
  key: Key,
) {
  if (report === null) {
    return undefined
  }
  return (event: LayoutChangeEvent) => {
    report(key, event.nativeEvent.layout.height)
  }
}

function iconStyleOf(color: ColorValue): IconStyle {
  return { color, size: ICON_SIZE }
}

/**
 * The active indicator: one view, which moves to the selected tab's place
 * when the selection does, and is put there at once when the bar is only
 * laid out again.
 */
function Indicator({
  bar,
  placement,
  selectedKey,
}: {
  readonly bar: Bar
  readonly placement: Placement
  readonly selectedKey: Key | null
}) {
  const theme = useTheme()
  const { motion } = theme
  const own = stylesOf(theme)
  const reduceMotion = useReducedMotion()
  const offset = useSharedValue(placement.offset)
  const length = useSharedValue(placement.length)
  const placed = useRef(selectedKey)
  const vertical = bar.orientation === 'vertical'

  useEffect(() => {
    const moved = placed.current !== selectedKey
    placed.current = selectedKey

    if (!moved || reduceMotion) {
      offset.set(placement.offset)
      length.set(placement.length)
      return
    }

    const timing = {
      duration: motion.durationMedium1,
      easing: Easing.bezier(...motion.easingEmphasized),
    }
    offset.set(withTiming(placement.offset, timing))
    length.set(withTiming(placement.length, timing))
  }, [
    length,
    motion,
    offset,
    placement.length,
    placement.offset,
    reduceMotion,
    selectedKey,
  ])

  const motionStyle = useAnimatedStyle(() => {
    'worklet'
    return vertical
      ? { height: length.get(), transform: [{ translateY: offset.get() }] }
      : { transform: [{ translateX: offset.get() }], width: length.get() }
  })

  return (
    <Animated.View
      style={composeStyles<AnimatedStyle<ViewStyle>>(
        indicatorStyleOf(own, bar),
        vertical ? undefined : leftEdgeOf(),
        motionStyle,
      )}
    />
  )
}

function indicatorStyleOf(own: ReturnType<typeof stylesOf>, bar: Bar) {
  if (bar.variant === 'primary') {
    return bar.orientation === 'vertical'
      ? own.indicatorVertical
      : own.indicator
  }
  return bar.orientation === 'vertical'
    ? own.indicatorSecondaryVertical
    : own.indicatorSecondary
}

/**
 * The style that puts a horizontal indicator at the bar's left edge, which is
 * where a layout measures a tab's `x` from in either direction, so that the
 * indicator's translation is the tab's own `x`. React Native swaps `left` and
 * `right` under a right-to-left layout unless the app turns that off, so
 * there `right` is the one naming the left edge. React Native Web reports no
 * right-to-left layout here and keeps `left` where CSS has it.
 */
function leftEdgeOf() {
  return I18nManager.isRTL && I18nManager.getConstants().doLeftAndRightSwapInRTL
    ? styles.atRight
    : styles.atLeft
}

// The `Tabs.List` among the root's children, looked for through any element
// around it, a view or a fragment alike, though never inside another `Tabs`,
// whose bar is its own. A function child, which some components take, is
// skipped, as `Children.toArray` skips it.
function listOf(children: ReactNode): TabsListElement | undefined {
  for (const child of Children.toArray(children)) {
    if (isValidElement<TabsListProps>(child) && child.type === TabsList) {
      return child
    }
    if (
      isValidElement<{ children?: ReactNode }>(child) &&
      child.type !== Tabs
    ) {
      const nested = listOf(child.props.children)

      if (nested !== undefined) {
        return nested
      }
    }
  }
  return undefined
}

/**
 * One tab as the bar draws it, from its entry in the collection: a `tab`
 * that selects itself when pressed, and reports where it and its label lie
 * so the indicator can follow them.
 */
function ListTab({
  bar,
  ids,
  node,
  onMeasure,
  state,
}: {
  readonly bar: Bar
  readonly ids: string
  readonly node: Node<object>
  readonly onMeasure: (
    key: Key,
    part: keyof Measured,
    layout: LayoutRectangle,
  ) => void
  readonly state: TabListState<object>
}) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const role = useTypeRole('titleSmall')
  // A node carries the props its tab was written with, which
  // `getCollectionNode` puts there and React Stately types as `any`.
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- see above
  const {
    'aria-label': ariaLabel,
    badge,
    children,
    href,
    icon,
    id: _id,
    isDisabled: _isDisabled,
    onBlur,
    onFocus,
    onHoverIn,
    onHoverOut,
    onLayout,
    onPress,
    onPressIn,
    onPressOut,
    ref,
    style,
    textValue: _textValue,
    ...props
  }: TabsTabProps = node.props
  const { key } = node
  // The selection manager reads a tab's own `isDisabled` off its node, beside
  // the bar's `disabledKeys`, so it answers for both.
  const disabled = state.isDisabled || state.selectionManager.isDisabled(key)
  const selected = state.selectedKey === key
  const { variant } = bar
  const feedback = usePressFeedback({
    color:
      variant === 'primary' && selected
        ? theme.colors.primary
        : theme.colors.onSurface,
    disabled,
    onBlur,
    onFocus,
    onHoverIn,
    onHoverOut,
    onPressIn,
    onPressOut,
    pressedColor:
      variant === 'primary' ? theme.colors.primary : theme.colors.onSurface,
  })
  const press = useLinkPress(href, onPress)
  const vertical = bar.orientation === 'vertical'
  const hasIcon = icon !== undefined && icon !== null
  const stacked = hasIcon && variant === 'primary'
  const color = colorOf(theme, variant, {
    disabled,
    engaged:
      feedback.hovered || feedback.pressed || feedback.ring !== undefined,
    selected,
  })
  const after = stacked ? null : badgeFor(badge)
  const text = (
    <NativeText
      numberOfLines={stacked ? 1 : 2}
      style={composeStyles<TextStyle>(
        role,
        styles.text,
        vertical ? styles.textVertical : undefined,
        { color },
      )}
    >
      {children}
    </NativeText>
  )

  return (
    <Pressable
      aria-label={ariaLabel ?? nameOf(children)}
      aria-selected={selected}
      id={tabIdOf(ids, key)}
      ref={ref}
      role="tab"
      {...props}
      {...feedback.handlers}
      disabled={disabled}
      onLayout={measureThen(onMeasure, key, 'tab', onLayout)}
      onPress={selectThen(state, key, press)}
      style={composeStyles<ViewStyle>(
        own.tab,
        vertical ? styles.tabVertical : tabWidthOf(bar.layout),
        stacked ? styles.tabStacked : undefined,
        feedback.ring,
        feedback.ring === undefined ? undefined : ringStyles.ring,
        style,
      )}
    >
      {feedback.layer}
      <View
        onLayout={measureThen(onMeasure, key, 'label')}
        style={composeStyles<ViewStyle>(
          styles.label,
          hasIcon ? (stacked ? own.labelStacked : own.labelInline) : undefined,
        )}
      >
        {after === null ? (
          text
        ) : (
          <View style={composeStyles<ViewStyle>(styles.line, own.lineBadged)}>
            {text}
            {after}
          </View>
        )}
        {hasIcon ? (
          <View style={styles.icon}>
            <IconStyleContext value={iconStyleOf(color)}>
              {stacked ? badgeFor(badge, icon) : icon}
            </IconStyleContext>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

// A tab's or a label's `onLayout`, which reports its place to the bar, then
// calls the call site's own.
function measureThen(
  onMeasure: (key: Key, part: keyof Measured, layout: LayoutRectangle) => void,
  key: Key,
  part: keyof Measured,
  onLayout?: ((event: LayoutChangeEvent) => void) | null,
) {
  return (event: LayoutChangeEvent) => {
    onMeasure(key, part, event.nativeEvent.layout)
    onLayout?.(event)
  }
}

// A label that is a string names its tab; anything else leaves the name to
// `aria-label`.
function nameOf(children: ReactNode): string | undefined {
  return typeof children === 'string' ? children : undefined
}

/**
 * Where the indicator lies along the bar, from the selected tab's measured
 * place: under its label on a horizontal primary bar, 2dp short of it at
 * either end and at least 24dp, and along the tab's whole length on a
 * secondary bar. Down a vertical bar the same two, along the tab's height.
 * Nothing until what it follows has been measured.
 */
function placementOf(
  { orientation, variant }: Bar,
  measured: Measured | undefined,
  inset: number,
): Placement | undefined {
  const tab = measured?.tab

  if (tab === undefined) {
    return undefined
  }

  if (orientation === 'vertical') {
    if (variant === 'secondary') {
      return { length: tab.height, offset: tab.y }
    }
    const length = Math.max(LEAST_INDICATOR, tab.height - 2 * inset)
    return { length, offset: tab.y + (tab.height - length) / 2 }
  }

  if (variant === 'secondary') {
    return { length: tab.width, offset: tab.x }
  }

  const label = measured?.label

  if (label === undefined) {
    return undefined
  }

  const length = Math.max(LEAST_INDICATOR, label.width - 2 * inset)
  return { length, offset: tab.x + label.x + (label.width - length) / 2 }
}

// How far to scroll a bar so a tab lies whole inside it, or nothing when it
// already does: to its start when it is cut off there, and to its end when
// it is cut off at the end.
function revealOffset(
  scrolled: number,
  viewport: number,
  start: number,
  size: number,
): number | undefined {
  if (start < scrolled) {
    return start
  }
  if (start + size > scrolled + viewport) {
    return start + size - viewport
  }
  return undefined
}

// A press's selection of its tab, then the call site's own handler and the
// tab's `href`.
function selectThen(
  state: TabListState<object>,
  key: Key,
  press: (event: GestureResponderEvent) => void,
) {
  return (event: GestureResponderEvent) => {
    state.setSelectedKey(key)
    press(event)
  }
}

// The id a tab carries for its panel to be named by. Whitespace is taken out
// of the key, as React Aria does, since a name list is split on it.
function tabIdOf(ids: string, key: Key) {
  return `${ids}-tab-${String(key).replaceAll(/\s+/gu, '')}`
}

/**
 * The content of one tab, drawn while its tab is selected. Its `id` is the
 * tab's.
 *
 * `style`, `ref` and `testID` land on the panel's own view.
 */
function TabsPanel({ children, id, ref, style, testID }: TabsPanelProps) {
  const { bar, ids, state } = useTabs('Tabs.Panel')
  const report = use(PanelHeightContext)
  const key = id ?? state.selectedKey
  const shown = key !== null && key === state.selectedKey

  // A panel's height is forgotten once it is no longer drawn, so the box
  // waits for the next one's own rather than moving to a height measured
  // the last time it was shown.
  useEffect(() => {
    if (report === null || !shown) {
      return undefined
    }
    return () => {
      report(key, undefined)
    }
  }, [key, report, shown])

  if (!shown) {
    return null
  }

  return (
    <View
      aria-labelledby={tabIdOf(ids, key)}
      onLayout={heightOf(report, key)}
      ref={ref}
      role="tabpanel"
      style={composeStyles<ViewStyle>(
        bar.orientation === 'vertical' ? styles.besideBar : undefined,
        style,
      )}
      testID={testID}
    >
      {children}
    </View>
  )
}

/**
 * An optional box around the panels, which moves its height as one panel
 * gives way to the next, over medium1 on the emphasized curve and at once
 * under reduced motion. Without it the panels still work; the box around
 * them simply jumps from one height to the other.
 *
 * `style`, `ref` and `testID` land on the box.
 */
function TabsPanels({ children, ref, style, testID }: TabsPanelsProps) {
  const { bar, state } = useTabs('Tabs.Panels')
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const [heights, setHeights] = useState(NO_HEIGHTS)
  const height = useSharedValue(-1)
  // The key the box last took its height from, and undefined until it has
  // taken one, which is what keeps the first height from moving.
  const placed = useRef<Key | null | undefined>(undefined)
  const { selectedKey } = state
  const target = selectedKey === null ? undefined : heights.get(selectedKey)

  const report = useCallback((key: Key, next: number | undefined) => {
    setHeights((previous) => withHeight(previous, key, next))
  }, [])

  useEffect(() => {
    if (target === undefined) {
      return
    }

    const moved = placed.current !== undefined && placed.current !== selectedKey
    placed.current = selectedKey

    height.set(
      moved && !reduceMotion
        ? withTiming(target, {
            duration: motion.durationMedium1,
            easing: Easing.bezier(...motion.easingEmphasized),
          })
        : target,
    )
  }, [height, motion, reduceMotion, selectedKey, target])

  // Before a panel has reported its height the box takes its content's own.
  const box = useAnimatedStyle(() => {
    'worklet'
    const measuredHeight = height.get()

    return measuredHeight < 0 ? {} : { height: measuredHeight }
  })

  return (
    <PanelHeightContext value={report}>
      <Animated.View
        ref={ref}
        style={composeStyles<AnimatedStyle<ViewStyle>>(
          styles.clip,
          bar.orientation === 'vertical' ? styles.besideBar : undefined,
          box,
          style,
        )}
        testID={testID}
      >
        <View>{children}</View>
      </Animated.View>
    </PanelHeightContext>
  )
}

function tabWidthOf(layout: TabsLayout) {
  return layout === 'scrollable' ? styles.tabScrollable : styles.tabShared
}

function useTabs(part: string, list = false): TabsContextValue {
  const value = use(TabsContext)
  if (value === null) {
    throw new Error(`${part} is drawn inside Tabs.`)
  }
  if (list && !value.found) {
    throw new Error(
      'Tabs.List is written among the children of Tabs, inside any view or fragment, rather than in a component of its own.',
    )
  }
  return value
}

// The bar's `onLayout` while it scrolls, which keeps how much of it shows.
function viewportOf(
  setViewport: (viewport: number) => void,
  vertical: boolean,
) {
  return (event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout
    setViewport(vertical ? height : width)
  }
}

function withHeight(
  previous: ReadonlyMap<Key, number>,
  key: Key,
  height: number | undefined,
): ReadonlyMap<Key, number> {
  if (previous.get(key) === height) {
    return previous
  }
  const next = new Map(previous)
  if (height === undefined) {
    next.delete(key)
  } else {
    next.set(key, height)
  }
  return next
}

function withMeasurement(
  previous: ReadonlyMap<Key, Measured>,
  key: Key,
  part: keyof Measured,
  layout: LayoutRectangle,
): ReadonlyMap<Key, Measured> {
  const known = previous.get(key)?.[part]
  if (
    known !== undefined &&
    known.x === layout.x &&
    known.y === layout.y &&
    known.width === layout.width &&
    known.height === layout.height
  ) {
    return previous
  }
  const next = new Map(previous)
  next.set(key, { ...previous.get(key), [part]: layout })
  return next
}

Tabs.List = TabsList
Tabs.Panel = TabsPanel
Tabs.Panels = TabsPanels
Tabs.Tab = TabsTab

export { Tabs, TabsList, TabsPanel, TabsPanels, TabsTab }
export type {
  TabsLayout,
  TabsListProps,
  TabsPanelProps,
  TabsPanelsProps,
  TabsProps,
  TabsTabProps,
  TabsVariant,
}
