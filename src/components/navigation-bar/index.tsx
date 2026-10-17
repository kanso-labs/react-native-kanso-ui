import type { ComponentRef, ReactNode, Ref } from 'react'
import type {
  LayoutChangeEvent,
  StyleProp,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { Edge } from 'react-native-safe-area-context'

import { use, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { NavigationItemProps } from '../../navigation'

import { useWindowSizeClass } from '../../hooks/useWindowSizeClass'
import {
  iconColorOf,
  labelColorOf,
  NavigationContext,
  NavigationDestination,
  NavigationItem,
} from '../../navigation'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// kanso-ui's NavigationBar, the navigation bar page's flexible bar: three to
// five destinations across the bottom of a compact window, on the surface
// container, 64dp tall. In a compact window each destination is vertical and
// the destinations share the bar's width equally; from the medium window
// size class each is the page's horizontal pill, as wide as what it holds,
// and the group sits centred with the spare width at the bar's ends, 8dp
// between two pills. The destinations are src/navigation's, which holds the
// two forms' values.
//
// The 8dp between two horizontal pills is the library's own, as on web. The
// page puts each pill in an item of a fixed width it does not give, and with
// no space at all the pills met edge to edge.
//
// **A bar too narrow for its horizontal form keeps the vertical one.** A
// horizontal destination is as wide as its icon, its label and 16dp either
// side, so five of them need far more than the 600dp the medium class starts
// at, and drawn anyway every label would be cut short the moment the window
// crossed into it. So from that class the bar draws its destinations a
// second time, off screen in the horizontal form at their own widths, and
// draws that form only while the bar is at least as wide as they are. Web
// measures the labels it cuts short instead, which native has no way to ask.
// The horizontal form is drawn until the first measurement arrives, so a bar
// that fits never draws the other form for a frame.
//
// The bar paints its surface to the screen's bottom edge, under the home
// indicator, and keeps its destinations inside the safe area: a
// `SafeAreaView` pads it by the home indicator and a landscape notch
// wherever the bar meets them, and by nothing where it does not.
//
// The bar is a `tablist` and each destination a `tab`, which is how both
// platforms' own tab bars are announced. Web's is a landmark of links with
// the current one marked as the page, which native has no counterpart for.
// A destination still goes to its `href` through the app's router, see
// `RouterProvider`. `NavigationTabBar` draws the bar for React Navigation's
// bottom tabs and Expo Router's tabs instead.

type NavigationBarItemProps = NavigationItemProps

type NavigationBarProps = Omit<ViewProps, 'children' | 'style'> & {
  /** The destinations, each a `NavigationBar.Item`. */
  readonly children?: ReactNode
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * The route of the current destination, matched against each
   * destination's `href`. The match is the selected tab, and draws the
   * active indicator.
   */
  readonly selectedRoute?: string | undefined
  readonly style?: StyleProp<ViewStyle>
}

/** The routes a tab navigator hands its tab bar, as both navigators do. */
type NavigationTabBarProps = Omit<
  NavigationBarProps,
  'children' | 'selectedRoute'
> &
  TabNavigatorProps & {
    /** Each route's options, by the route's key. */
    readonly descriptors: Readonly<
      Partial<Record<string, { readonly options: TabOptions }>>
    >
    /**
     * The insets the navigator measured, which the bar measures for itself
     * instead.
     */
    readonly insets?: unknown
    /** The navigator's routes, and which of them is focused. */
    readonly state: {
      readonly index: number
      readonly routes: readonly TabRoute[]
    }
  }

/** What a tab bar's press tells the navigator, and how it moves to a tab. */
type TabActions = {
  readonly emit: (event: TabEvent) => unknown
  readonly go: (route: TabRoute) => void
}

/**
 * What hears a tab bar's events: React Navigation's `navigation` and Expo
 * Router's `emitter` alike.
 */
type TabEmitter = {
  emit(event: TabEvent): unknown
}

/** The events a tab bar reports, as both navigators name them. */
type TabEvent =
  | {
      readonly canPreventDefault: true
      readonly target: string
      readonly type: 'tabPress'
    }
  | { readonly target: string; readonly type: 'tabLongPress' }

/**
 * How a tab bar moves to a tab: through React Navigation's `navigation`, or
 * through Expo Router's `navigateToTab`.
 */
type TabNavigatorProps =
  | {
      readonly emitter: TabEmitter
      readonly navigateToTab: (routeKey: string) => void
      readonly navigation?: never
    }
  | {
      readonly emitter?: never
      readonly navigateToTab?: never
      readonly navigation: TabEmitter & {
        navigate(name: string, params?: object): void
      }
    }

/**
 * A tab's options the bar reads, as React Navigation's bottom tabs and Expo
 * Router's tabs both hand them to a tab bar. Options they take that are not
 * listed here are left to them.
 */
type TabOptions = {
  /** The tab's name for a screen reader, where it differs from its label. */
  readonly tabBarAccessibilityLabel?: string | undefined
  /**
   * The badge on the tab's icon. A number, or a string of digits, is the
   * large badge's count; any other string is the small dot, since a badge
   * draws a count and nothing else.
   */
  readonly tabBarBadge?: number | string | undefined
  readonly tabBarButtonTestID?: string | undefined
  /** The tab's icon, drawn at the size and in the colour it is handed. */
  readonly tabBarIcon?:
    | ((props: {
        readonly color: string
        readonly focused: boolean
        readonly size: number
      }) => ReactNode)
    | undefined
  /** The tab's label, in place of its title. */
  readonly tabBarLabel?:
    | ((props: {
        readonly children: string
        readonly color: string
        readonly focused: boolean
        readonly position: 'below-icon' | 'beside-icon'
      }) => ReactNode)
    | string
    | undefined
  readonly title?: string | undefined
}

type TabRoute = {
  readonly key: string
  readonly name: string
  readonly params?: object | undefined
}

// Where the destinations are drawn off screen to be measured. Wider than any
// bar, so each one is measured at its own width rather than squeezed.
const MEASURING_ROOM = 10_000

// The size a tab's icon is drawn at, the page's.
const ICON_SIZE = 24

// A route its navigator handed no options for.
const NO_OPTIONS: TabOptions = {}

// A string of digits, which a badge draws as a count.
const DIGITS = /^\d+$/u

// The bar's sides as well as its bottom, so a landscape notch is cleared too.
// The top is the screen's.
const EDGES: readonly Edge[] = ['bottom', 'left', 'right']

const styles = StyleSheet.create({
  // Holds the destinations measured off screen. It has no size and clips what
  // it holds, so they are laid out and never drawn, and take no touches.
  measurer: {
    height: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    position: 'absolute',
    start: 0,
    top: 0,
    width: 0,
  },
  // The room the destinations are measured in, with the row of them at its
  // start, at the row's own width.
  room: {
    alignItems: 'flex-start',
    width: MEASURING_ROOM,
  },
  // The vertical form: each destination its share of the bar's height.
  vertical: {
    alignItems: 'stretch',
  },
})

const stylesOf = themedStyles(({ colors, spacing }) =>
  StyleSheet.create({
    bar: {
      backgroundColor: colors.surfaceContainer,
    },
    // The horizontal form: the pills centred, 8dp apart.
    horizontal: {
      alignItems: 'center',
      gap: spacing.sm,
    },
    // The destinations, measured in the horizontal form.
    measured: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    // The page's 64dp, a minimum rather than a height, so a larger text size
    // the device asks for grows the bar rather than cutting the labels off.
    row: {
      flexDirection: 'row',
      justifyContent: 'center',
      minHeight: 64,
    },
  }),
)

/**
 * What the bar tells the navigator and how it moves, from whichever of the
 * two navigators drew it.
 */
function actionsOf(
  emitter: TabEmitter | undefined,
  navigateToTab: ((routeKey: string) => void) | undefined,
  navigation: TabNavigatorProps['navigation'],
): TabActions {
  if (navigation !== undefined) {
    return {
      emit: (event) => navigation.emit(event),
      go: (route) => {
        navigation.navigate(route.name, route.params)
      },
    }
  }
  return {
    emit: (event) => emitter?.emit(event),
    go: (route) => {
      navigateToTab?.(route.key)
    },
  }
}

/**
 * The badge a tab's `tabBarBadge` draws: the count of a number or a string of
 * digits, and the small dot for any other string.
 */
function badgeOf(
  badge: number | string | undefined,
): boolean | number | undefined {
  if (typeof badge === 'number') {
    return badge
  }
  if (badge === undefined || badge === '') {
    return undefined
  }
  return DIGITS.test(badge) ? Number(badge) : true
}

/**
 * Reports a long press on a tab. Built by a call rather than written inline
 * at the prop, for the reason `widthThen` gives.
 */
function longPressThen(actions: TabActions, route: TabRoute) {
  return () => {
    actions.emit({ target: route.key, type: 'tabLongPress' })
  }
}

/**
 * The bar of three to five top-level destinations a compact window keeps at
 * its bottom edge. Each destination goes to its `href` through the app's
 * router, see `RouterProvider`.
 *
 * ```tsx
 * <NavigationBar selectedRoute="/first">
 *   <NavigationBar.Item href="/first" icon={<FirstIcon />}>
 *     First item
 *   </NavigationBar.Item>
 *   <NavigationBar.Item href="/second" icon={<SecondIcon />}>
 *     Second item
 *   </NavigationBar.Item>
 *   <NavigationBar.Item href="/third" icon={<ThirdIcon />}>
 *     Third item
 *   </NavigationBar.Item>
 * </NavigationBar>
 * ```
 *
 * Draw it below the screen's content, at the bottom of the window: it paints
 * its surface to the bottom edge and keeps its destinations clear of the home
 * indicator itself. From the medium window size class each destination puts
 * its label beside its icon, where the bar is wide enough for every label.
 *
 * `style`, `ref` and `testID` land on the bar's own view, which is announced
 * as a tab list.
 */
function NavigationBar({
  children,
  selectedRoute,
  style,
  ...props
}: NavigationBarProps) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const sizeClass = useWindowSizeClass()
  // The width the destinations have, and the width the horizontal form
  // takes, while each is known.
  const [room, setRoom] = useState<number | undefined>(undefined)
  const [needed, setNeeded] = useState<number | undefined>(undefined)

  const wide = sizeClass !== 'compact'
  const horizontal =
    wide && (room === undefined || needed === undefined || needed <= room)
  const context = useMemo(
    () => ({
      form: horizontal ? ('horizontal' as const) : ('vertical' as const),
      measuring: false,
      selectedRoute,
    }),
    [horizontal, selectedRoute],
  )
  const measuring = useMemo(
    () => ({ form: 'horizontal' as const, measuring: true, selectedRoute }),
    [selectedRoute],
  )

  return (
    <View
      role="tablist"
      {...props}
      style={composeStyles<ViewStyle>(own.bar, style)}
    >
      <SafeAreaView edges={EDGES}>
        <View
          onLayout={widthThen(setRoom)}
          style={composeStyles<ViewStyle>(
            own.row,
            horizontal ? own.horizontal : styles.vertical,
          )}
        >
          <NavigationContext value={context}>{children}</NavigationContext>
        </View>
      </SafeAreaView>
      {wide ? (
        <View aria-hidden style={styles.measurer}>
          <View style={styles.room}>
            <View onLayout={widthThen(setNeeded)} style={own.measured}>
              <NavigationContext value={measuring}>
                {children}
              </NavigationContext>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}

/**
 * One destination of a navigation bar: an icon, a label and, while it is the
 * current one, the active indicator behind the icon. Pressing it calls
 * `onPress`, then goes to its `href`. Renders nothing of its own outside a
 * `NavigationBar`, whose `selectedRoute` says whether it is selected.
 *
 * `style`, `ref` and `testID` land on the destination's `Pressable`.
 */
function NavigationBarItem(props: NavigationBarItemProps) {
  return <NavigationItem {...props} />
}

/**
 * A navigation bar drawing a tab navigator's routes, for the `tabBar` prop of
 * React Navigation's bottom tabs and of Expo Router's `Tabs` alike.
 *
 * ```tsx
 * <Tabs tabBar={(props) => <NavigationTabBar {...props} />}>
 *   <Tabs.Screen name="index" options={{ tabBarIcon: () => <FirstIcon />, title: 'First item' }} />
 * </Tabs>
 * ```
 *
 * Each route is a destination, labelled by its `tabBarLabel` or its title,
 * with the icon `tabBarIcon` draws and the badge `tabBarBadge` asks for, and
 * the focused route is the selected one. Pressing a destination reports
 * `tabPress` to the navigator and moves to its route unless a listener
 * prevents it, and a long press reports `tabLongPress`, as the navigators'
 * own tab bars do.
 *
 * `style`, `ref` and `testID` land on the bar's own view, as on a
 * `NavigationBar`.
 */
function NavigationTabBar({
  descriptors,
  emitter,
  insets: _insets,
  navigateToTab,
  navigation,
  state,
  ...props
}: NavigationTabBarProps) {
  const actions = actionsOf(emitter, navigateToTab, navigation)
  const focused = state.routes[state.index]?.key

  return (
    <NavigationBar {...props}>
      {state.routes.map((route) => (
        <TabDestination
          focused={route.key === focused}
          key={route.key}
          onLongPress={longPressThen(actions, route)}
          onPress={pressThen(actions, route, route.key === focused)}
          options={descriptors[route.key]?.options ?? NO_OPTIONS}
          route={route}
        />
      ))}
    </NavigationBar>
  )
}

/**
 * Moves to a tab once the navigator has heard the press, unless a listener
 * prevented it or the tab is already focused. Built by a call rather than
 * written inline at the prop, for the reason `widthThen` gives.
 */
function pressThen(actions: TabActions, route: TabRoute, focused: boolean) {
  return () => {
    const event = actions.emit({
      canPreventDefault: true,
      target: route.key,
      type: 'tabPress',
    })

    if (!focused && !prevented(event)) {
      actions.go(route)
    }
  }
}

// Whether a listener prevented an event, as the navigator reports it.
function prevented(event: unknown) {
  return (
    typeof event === 'object' &&
    event !== null &&
    'defaultPrevented' in event &&
    event.defaultPrevented === true
  )
}

/**
 * One route's destination. Its colours are the destination's own for the
 * form the bar draws, which is why it reads them inside the bar rather than
 * the bar computing them for it.
 */
function TabDestination({
  focused,
  onLongPress,
  onPress,
  options,
  route,
}: {
  readonly focused: boolean
  readonly onLongPress: () => void
  readonly onPress: () => void
  readonly options: TabOptions
  readonly route: TabRoute
}) {
  const theme = useTheme()
  const { form } = use(NavigationContext)
  const { tabBarLabel } = options
  const title =
    typeof tabBarLabel === 'string'
      ? tabBarLabel
      : (options.title ?? route.name)

  return (
    <NavigationDestination
      aria-label={options.tabBarAccessibilityLabel ?? title}
      badge={badgeOf(options.tabBarBadge)}
      icon={options.tabBarIcon?.({
        color: iconColorOf(theme, false, focused),
        focused,
        size: ICON_SIZE,
      })}
      onLongPress={onLongPress}
      onPress={onPress}
      selected={focused}
      testID={options.tabBarButtonTestID}
    >
      {typeof tabBarLabel === 'function'
        ? tabBarLabel({
            children: title,
            color: labelColorOf(theme, form, false, focused),
            focused,
            position: form === 'horizontal' ? 'beside-icon' : 'below-icon',
          })
        : title}
    </NavigationDestination>
  )
}

/**
 * Records a view's width, as React Native lays it out. Built by a call
 * rather than written inline at the prop, which is what react-perf's
 * jsx-no-new-function-as-prop is after; the React Compiler memoises the
 * result on its inputs.
 */
function widthThen(setWidth: (width: number) => void) {
  return (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width)
  }
}

NavigationBar.Item = NavigationBarItem

export type {
  NavigationBarItemProps,
  NavigationBarProps,
  NavigationTabBarProps,
}

export { NavigationBar, NavigationBarItem, NavigationTabBar }
