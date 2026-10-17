import type { ReactNode } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { TestInstance, TestNode } from 'test-renderer'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import { Dimensions, I18nManager, StyleSheet, Text } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { NavigationBarItemProps, NavigationTabBarProps } from '.'
import type { KuiTheme } from '../../tokens/defaults'

import { NavigationBar, NavigationTabBar } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { RouterProvider } from '../../router'
import { ThemeScope } from '../../theme-scope'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'
import { breakpoints } from '../../tokens/defaults'

let mockReducedMotion = false

// Every timing a destination asks Reanimated for, so a case can read which
// duration and curve the indicator moved over.
const mockTimings: unknown[] = []

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<typeof import('react-native-reanimated')>(
    'react-native-reanimated',
  )
  return {
    __esModule: true,
    ...actual,
    useReducedMotion: () => mockReducedMotion,
    withTiming: (...args: Parameters<typeof actual.withTiming>) => {
      mockTimings.push(args[1])
      return actual.withTiming(...args)
    },
  }
})

const { theme } = scopeFor('light', {})
const { colors, motion, spacing, stateLayerOpacity, typography } = theme

const FADED = withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

// A window a dp short of the medium class, and one at its lower bound.
const COMPACT = breakpoints.medium - 1
const MEDIUM = breakpoints.medium

const ICON = <Icon />

const CALL_SITE = StyleSheet.create({ bar: { marginTop: 4 } }).bar

const NO_ITEMS: ItemOverrides = {}

// A theme of its own, which nothing else renders under.
const OWN_THEME: KuiTheme = {}

const ROUTES = [
  { key: 'first-key', name: 'first', params: { id: 1 } },
  { key: 'second-key', name: 'second' },
  { key: 'third-key', name: 'third' },
]

// Each route's options, as both navigators hand them over: a title, an icon
// and nothing else, so a case adds only what it is about.
const DESCRIPTORS: NavigationTabBarProps['descriptors'] = {
  'first-key': { options: { tabBarIcon: iconFor, title: 'First item' } },
  'second-key': { options: { tabBarIcon: iconFor, title: 'Second item' } },
  'third-key': { options: { tabBarIcon: iconFor, title: 'Third item' } },
}

type ItemOverrides = Partial<
  Record<'first' | 'second' | 'third', Partial<NavigationBarItemProps>>
>

afterEach(() => {
  Dimensions.set(INITIAL)
  mockReducedMotion = false
  mockTimings.length = 0
  jest.useRealTimers()
})

beforeEach(() => {
  jest.useFakeTimers()
})

function child(node: TestNode | undefined): TestInstance {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

// The count in the large badge on a destination's icon, after the space that
// sets it apart.
function countOf(name: string) {
  return child(markOf(name).children[1])
}

// The fill a destination's active indicator draws, behind its icon.
function fillOf(name: string) {
  return child(pillOf(name).children[0])
}

// How grown a destination's indicator is: its opacity and its width as a
// share of the whole, once the frame has run.
async function growthOf(name: string) {
  await act(() => {
    jest.advanceTimersByTime(0)
  })
  const style = getAnimatedStyle(fillOf(name))
  const transform: unknown = style.transform
  const scale: unknown = Array.isArray(transform) ? transform.at(0) : undefined
  const scaleX: unknown =
    typeof scale === 'object' && scale !== null && 'scaleX' in scale
      ? scale.scaleX
      : undefined
  return { opacity: style.opacity, scaleX }
}

// What a destination's slot hands an icon, written out where a case can
// read it.
function Icon() {
  const { color, size } = useIconStyle()

  return <Text testID="icon">{`${String(color)} ${String(size)}`}</Text>
}

// The parameters of a tab icon, written out as the icon.
function iconFor({
  color,
  focused,
  size,
}: {
  readonly color: string
  readonly focused: boolean
  readonly size: number
}): ReactNode {
  return (
    <Text testID="icon">{`${color} ${String(size)}${focused ? ' focused' : ''}`}</Text>
  )
}

// What the icon in a destination was handed: its colour, then its size.
function iconOf(name: string) {
  const text: unknown = within(tab(name)).getByTestId('icon').props.children
  if (typeof text !== 'string') {
    throw new TypeError('expected the icon to write a string')
  }
  return text
}

// The slot holding a destination's icon, and the badge on it.
function iconSlotOf(name: string) {
  return child(pillOf(name).children.at(-1))
}

// A destination's label, which comes first in the tree in either form.
function labelOf(name: string) {
  return child(
    tab(name).children.find(
      (node) => typeof node !== 'string' && node.type === 'Text',
    ),
  )
}

// Lays the bar out at the given width for its destinations, and measures the
// horizontal form at the width it needs.
async function layOut({
  needed,
  room,
}: {
  readonly needed?: number
  readonly room?: number
}) {
  if (room !== undefined) {
    await fireEvent(rowOf(), 'layout', {
      nativeEvent: { layout: { height: 64, width: room, x: 0, y: 0 } },
    })
  }
  if (needed !== undefined) {
    await fireEvent(measuredOf(), 'layout', {
      nativeEvent: { layout: { height: 40, width: needed, x: 0, y: 0 } },
    })
  }
}

// The badge's mark on a destination's icon.
function markOf(name: string) {
  return child(child(iconSlotOf(name).children[0]).children[1])
}

// The destinations drawn off screen in the horizontal form, to be measured.
function measuredOf() {
  return child(child(measurerOf().children[0]).children[0])
}

function measurerOf() {
  return child(screen.getByTestId('bar').children[1])
}

// What a destination draws its layers, its ring and its fill on: the
// indicator in the vertical form, and the whole destination in the
// horizontal one.
function pillOf(name: string) {
  const destination = tab(name)
  const last = child(destination.children.at(-1))
  return last.children.length > 1 ? last : destination
}

// Renders a bar of three destinations, the second one current unless a case
// says otherwise.
async function renderBar({
  items = NO_ITEMS,
  selectedRoute = '/second',
  width = COMPACT,
}: {
  readonly items?: ItemOverrides
  readonly selectedRoute?: string
  readonly width?: number
} = {}) {
  resize(width)
  return render(<Sample items={items} selectedRoute={selectedRoute} />)
}

// Renders the tab bar adapter over the three routes, as Expo Router hands
// them over, the given one focused.
async function renderExpoTabs({
  defaultPrevented = false,
  index = 0,
}: {
  readonly defaultPrevented?: boolean
  readonly index?: number
} = {}) {
  const emit = jest.fn<(event: unknown) => unknown>(() => ({
    defaultPrevented,
  }))
  const navigateToTab = jest.fn<(routeKey: string) => void>()
  const tabs = {
    descriptors: DESCRIPTORS,
    emitter: { emit },
    navigateToTab,
    state: { index, routes: ROUTES },
    testID: 'bar',
  }
  resize(COMPACT)
  await render(<NavigationTabBar {...tabs} />)
  return { emit, navigateToTab }
}

// Renders the tab bar adapter over the three routes, as React Navigation
// hands them over, the given one focused.
async function renderTabs({
  defaultPrevented = false,
  descriptors = DESCRIPTORS,
  index = 0,
  width = COMPACT,
}: {
  readonly defaultPrevented?: boolean
  readonly descriptors?: NavigationTabBarProps['descriptors']
  readonly index?: number
  readonly width?: number
} = {}) {
  const emit = jest.fn<(event: unknown) => unknown>(() => ({
    defaultPrevented,
  }))
  const navigate = jest.fn<(name: string, params?: object) => void>()
  const tabs = {
    descriptors,
    navigation: { emit, navigate },
    state: { index, routes: ROUTES },
    testID: 'bar',
  }
  resize(width)
  await render(<NavigationTabBar {...tabs} />)
  return { emit, navigate }
}

// The window as the platform reports it when it changes, which is what the
// size class follows.
function resize(width: number) {
  Dimensions.set({ ...INITIAL, window: { ...INITIAL.window, width } })
}

// The row the destinations are laid out in, inside the safe area.
function rowOf() {
  return child(safeAreaOf().children[0])
}

function safeAreaOf() {
  return child(screen.getByTestId('bar').children[0])
}

function Sample({
  items = NO_ITEMS,
  selectedRoute,
}: {
  readonly items?: ItemOverrides
  readonly selectedRoute?: string
}) {
  return (
    <NavigationBar selectedRoute={selectedRoute} testID="bar">
      <NavigationBar.Item href="/first" icon={ICON} {...items.first}>
        First item
      </NavigationBar.Item>
      <NavigationBar.Item href="/second" icon={ICON} {...items.second}>
        Second item
      </NavigationBar.Item>
      <NavigationBar.Item href="/third" icon={ICON} {...items.third}>
        Third item
      </NavigationBar.Item>
    </NavigationBar>
  )
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function tab(name: string) {
  return screen.getByRole('tab', { name })
}

function textStyleOf(element: {
  props: { style?: StyleProp<TextStyle> }
}): TextStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

describe('NavigationBar', () => {
  describe('semantics', () => {
    it('is a tab list of its destinations, each a tab named by its label', async () => {
      await renderBar()

      expect(screen.getByTestId('bar').props.role).toBe('tablist')
      expect(screen.getAllByRole('tab')).toHaveLength(3)
      expect(tab('First item')).toBeTruthy()
      expect(tab('Third item')).toBeTruthy()
    })

    it('selects the destination whose href is the selected route', async () => {
      await renderBar({ selectedRoute: '/third' })

      expect(screen.getByRole('tab', { selected: true })).toBe(
        tab('Third item'),
      )
      expect(tab('First item')).not.toBeSelected()
      expect(tab('Second item')).not.toBeSelected()
    })

    it('selects nothing for a route no destination has', async () => {
      await renderBar({ selectedRoute: '/elsewhere' })

      expect(screen.queryByRole('tab', { selected: true })).toBeNull()
    })

    it('takes a name of its own for a destination', async () => {
      await renderBar({
        items: { first: { 'aria-label': 'First item, 3 new', badge: 3 } },
      })

      expect(tab('First item, 3 new')).toBeTruthy()
    })

    it('says a disabled destination is disabled', async () => {
      await renderBar({ items: { first: { isDisabled: true } } })

      expect(tab('First item')).toBeDisabled()
    })
  })

  describe('pressing a destination', () => {
    it('goes to its href through the router, after its own handler', async () => {
      const calls: string[] = []
      const navigate = jest.fn((href: string) => {
        calls.push(`navigate ${href}`)
      })
      const onPress = jest.fn(() => {
        calls.push('onPress')
      })
      const sample = { items: { third: { onPress } } }
      resize(COMPACT)
      await render(
        <RouterProvider navigate={navigate}>
          <Sample {...sample} />
        </RouterProvider>,
      )

      await fireEvent.press(tab('Third item'))

      expect(calls).toEqual(['onPress', 'navigate /third'])
    })

    it('goes nowhere while disabled', async () => {
      const navigate = jest.fn()
      const sample = { items: { third: { isDisabled: true } } }
      resize(COMPACT)
      await render(
        <RouterProvider navigate={navigate}>
          <Sample {...sample} />
        </RouterProvider>,
      )

      await fireEvent.press(tab('Third item'))

      expect(navigate).not.toHaveBeenCalled()
    })
  })

  describe('the bar', () => {
    it('is the surface container, at least 64dp tall', async () => {
      await renderBar()

      expect(styleOf(screen.getByTestId('bar')).backgroundColor).toBe(
        colors.surfaceContainer,
      )
      expect(styleOf(rowOf())).toMatchObject({
        flexDirection: 'row',
        minHeight: 64,
      })
    })

    it('keeps its destinations clear of the bottom and the sides', async () => {
      await renderBar()

      expect(safeAreaOf().type).toBe('RNCSafeAreaView')
      expect(safeAreaOf().props.edges).toEqual({
        bottom: 'additive',
        left: 'additive',
        right: 'additive',
        top: 'off',
      })
    })

    it('paints its surface around the inset', async () => {
      await renderBar()

      expect(styleOf(safeAreaOf()).backgroundColor).toBeUndefined()
    })

    it('lands the call site’s style on the bar', async () => {
      resize(COMPACT)
      await render(<NavigationBar style={CALL_SITE} testID="bar" />)

      expect(styleOf(screen.getByTestId('bar'))).toMatchObject({
        backgroundColor: colors.surfaceContainer,
        marginTop: 4,
      })
    })
  })

  describe('in a compact window', () => {
    it('draws each destination vertical, sharing the bar’s width', async () => {
      await renderBar()

      expect(styleOf(tab('First item'))).toMatchObject({
        alignItems: 'center',
        flexBasis: 0,
        flexGrow: 1,
        gap: spacing.xs,
        paddingVertical: 6,
      })
      expect(styleOf(tab('First item')).flexDirection).toBe('column-reverse')
      expect(styleOf(rowOf()).alignItems).toBe('stretch')
    })

    it('puts the label under a 56dp by 32dp indicator', async () => {
      await renderBar()

      expect(styleOf(pillOf('First item'))).toMatchObject({
        height: 32,
        width: 56,
      })
      expect(labelOf('First item').type).toBe('Text')
      expect(labelOf('First item').children).toEqual(['First item'])
    })

    it('puts the label first in the tree, ahead of a badge’s count', async () => {
      await renderBar({ items: { first: { badge: 3 } } })

      expect(tab('First item').children[0]).toBe(labelOf('First item'))
      expect(tab('First item').children[1]).toBe(pillOf('First item'))
    })

    it('reaches no further than itself', async () => {
      await renderBar()

      expect(tab('First item').props.hitSlop).toBeUndefined()
    })

    it('measures nothing', async () => {
      await renderBar()

      expect(screen.getByTestId('bar').children).toHaveLength(1)
    })
  })

  describe('from the medium window size class', () => {
    it('draws each destination as a horizontal pill, label beside icon', async () => {
      await renderBar({ width: MEDIUM })

      expect(styleOf(tab('First item'))).toMatchObject({
        alignItems: 'center',
        flexDirection: 'row-reverse',
        gap: spacing.xs,
        minHeight: 40,
        paddingHorizontal: spacing.lg,
      })
      expect(pillOf('First item')).toBe(tab('First item'))
      expect(labelOf('First item').children).toEqual(['First item'])
    })

    it('puts the label first in the tree, ahead of a badge’s count', async () => {
      await renderBar({ items: { first: { badge: 3 } }, width: MEDIUM })

      const parts = tab('First item').children
      expect(parts.indexOf(labelOf('First item'))).toBe(2)
      expect(parts.at(-1)).toBe(iconSlotOf('First item'))
    })

    it('centres the pills, 8dp apart', async () => {
      await renderBar({ width: MEDIUM })

      expect(styleOf(rowOf())).toMatchObject({
        alignItems: 'center',
        gap: spacing.sm,
        justifyContent: 'center',
      })
    })

    it('reaches 4dp above and below the 40dp pill, to the 48dp target', async () => {
      await renderBar({ width: MEDIUM })

      expect(tab('First item').props.hitSlop).toEqual({
        bottom: 4,
        left: 0,
        right: 0,
        top: 4,
      })
    })

    it('measures its destinations off screen, hidden from a screen reader', async () => {
      await renderBar({ width: MEDIUM })

      expect(measurerOf().props['aria-hidden']).toBe(true)
      expect(styleOf(measurerOf())).toMatchObject({
        height: 0,
        overflow: 'hidden',
        position: 'absolute',
        width: 0,
      })
      expect(styleOf(measuredOf())).toMatchObject({
        flexDirection: 'row',
        gap: spacing.sm,
      })
      expect(within(measuredOf()).queryAllByRole('tab')).toHaveLength(0)
      expect(measuredOf().children).toHaveLength(3)
      expect(styleOf(child(measuredOf().children[0]))).toMatchObject({
        flexDirection: 'row-reverse',
        paddingHorizontal: spacing.lg,
      })
    })

    it('stays horizontal where the bar is as wide as the pills', async () => {
      await renderBar({ width: MEDIUM })

      await layOut({ needed: 560, room: 560 })

      expect(styleOf(tab('First item')).flexDirection).toBe('row-reverse')
    })

    it('turns vertical where the pills would not fit', async () => {
      await renderBar({ width: MEDIUM })

      await layOut({ needed: 561, room: 560 })

      expect(styleOf(tab('First item')).flexDirection).toBe('column-reverse')
      expect(styleOf(tab('First item')).flexGrow).toBe(1)
      expect(styleOf(rowOf()).alignItems).toBe('stretch')
    })

    it('turns horizontal again once the bar is wide enough', async () => {
      await renderBar({ width: MEDIUM })
      await layOut({ needed: 700, room: 560 })

      await layOut({ room: 700 })

      expect(styleOf(tab('First item')).flexDirection).toBe('row-reverse')
    })

    it.each([{ room: 10 }, { needed: 10_000 }])(
      'stays horizontal until both widths are known, given only %p',
      async (widths) => {
        await renderBar({ width: MEDIUM })

        await layOut(widths)

        expect(styleOf(tab('First item')).flexDirection).toBe('row-reverse')
      },
    )

    it('is vertical in a compact window, however wide the pills would fit', async () => {
      await renderBar({ width: MEDIUM })
      await layOut({ needed: 100, room: 560 })

      resize(COMPACT)
      await act(() => {
        jest.advanceTimersByTime(0)
      })

      expect(styleOf(tab('First item')).flexDirection).toBe('column-reverse')
    })
  })

  describe('colours', () => {
    it('draws the current destination’s icon in on secondary container and its label in secondary', async () => {
      await renderBar()

      expect(iconOf('Second item')).toBe(`${colors.onSecondaryContainer} 24`)
      expect(textStyleOf(labelOf('Second item')).color).toBe(colors.secondary)
    })

    it('draws every other in on surface variant', async () => {
      await renderBar()

      expect(iconOf('First item')).toBe(`${colors.onSurfaceVariant} 24`)
      expect(textStyleOf(labelOf('First item')).color).toBe(
        colors.onSurfaceVariant,
      )
    })

    it('draws the label inside the pill in on secondary container', async () => {
      await renderBar({ width: MEDIUM })

      expect(textStyleOf(labelOf('Second item')).color).toBe(
        colors.onSecondaryContainer,
      )
      expect(textStyleOf(labelOf('First item')).color).toBe(
        colors.onSurfaceVariant,
      )
    })

    it('fades a disabled destination’s icon and label, current or not', async () => {
      await renderBar({ items: { second: { isDisabled: true } } })

      expect(iconOf('Second item')).toBe(`${FADED} 24`)
      expect(textStyleOf(labelOf('Second item')).color).toBe(FADED)
    })

    it('sets the label in label medium, on one line', async () => {
      await renderBar()

      expect(textStyleOf(labelOf('First item'))).toMatchObject({
        fontSize: typography.labelMediumSize,
        lineHeight: typography.labelMediumLineHeight,
      })
      expect(labelOf('First item').props.numberOfLines).toBe(1)
    })
  })

  describe('the active indicator', () => {
    it('is the secondary container, drawn whole behind the current icon', async () => {
      await renderBar()

      expect(styleOf(fillOf('Second item'))).toMatchObject({
        backgroundColor: colors.secondaryContainer,
        position: 'absolute',
      })
      expect(await growthOf('Second item')).toEqual({ opacity: 1, scaleX: 1 })
      expect(await growthOf('First item')).toEqual({
        opacity: 0,
        scaleX: 0.4,
      })
    })

    it('grows from 40% behind a destination as it becomes current', async () => {
      await renderBar()

      await screen.rerender(<Sample selectedRoute="/first" />)
      await act(() => {
        jest.advanceTimersByTime(motion.durationLong2 / 4)
      })

      const growing = await growthOf('First item')
      expect(growing.scaleX).toBeGreaterThan(0.4)
      expect(growing.scaleX).toBeLessThan(1)

      await act(() => {
        jest.advanceTimersByTime(motion.durationLong2)
      })

      expect(await growthOf('First item')).toEqual({ opacity: 1, scaleX: 1 })
      expect(mockTimings.at(-1)).toMatchObject({
        duration: motion.durationLong2,
      })
    })

    it('shrinks back behind the destination that was current', async () => {
      await renderBar()

      await screen.rerender(<Sample selectedRoute="/first" />)
      await act(() => {
        jest.advanceTimersByTime(motion.durationLong2)
      })

      expect(await growthOf('Second item')).toEqual({
        opacity: 0,
        scaleX: 0.4,
      })
    })

    it('fades in over the first fifth of its growth', async () => {
      await renderBar()

      await screen.rerender(<Sample selectedRoute="/first" />)
      await act(() => {
        jest.advanceTimersByTime(motion.durationLong2 / 50)
      })

      // How far it has grown, read off its width, says how opaque it is.
      const { opacity, scaleX } = await growthOf('First item')
      const grown = (Number(scaleX) - 0.4) / 0.6
      expect(grown).toBeGreaterThan(0)
      expect(grown).toBeLessThan(0.2)
      expect(opacity).toBeCloseTo(grown / 0.2)
    })

    it('moves at once under reduced motion', async () => {
      mockReducedMotion = true
      await renderBar()

      await screen.rerender(<Sample selectedRoute="/first" />)

      expect(await growthOf('First item')).toEqual({ opacity: 1, scaleX: 1 })
      expect(await growthOf('Second item')).toEqual({
        opacity: 0,
        scaleX: 0.4,
      })
    })

    it('is the whole pill in the horizontal form', async () => {
      await renderBar({ width: MEDIUM })

      expect(child(tab('Second item').children[0])).toBe(fillOf('Second item'))
      expect(await growthOf('Second item')).toEqual({ opacity: 1, scaleX: 1 })
    })
  })

  describe('feedback', () => {
    it('draws the layers on the indicator in on secondary container', async () => {
      await renderBar()

      await fireEvent(tab('First item'), 'hoverIn')

      const layer = child(pillOf('First item').children[1])
      expect(layer.props.importantForAccessibility).toBe('no-hide-descendants')
      expect(styleOf(child(layer.children[0]))).toMatchObject({
        backgroundColor: colors.onSecondaryContainer,
        opacity: stateLayerOpacity.hover,
      })
    })

    it('grows the ripple from the indicator’s centre in the vertical form, measuring nothing', async () => {
      await renderBar()
      const measure = jest.fn()

      await fireEvent(tab('First item'), 'pressIn', {
        currentTarget: { measure },
        nativeEvent: { pageX: 300, pageY: 30 },
      })
      await act(() => {
        jest.advanceTimersByTime(motion.durationLong1)
      })

      const surface = child(pillOf('First item').children[1])
      const side = Math.floor(56 * 0.2)
      expect(measure).not.toHaveBeenCalled()
      expect(getAnimatedStyle(child(surface.children[1]))).toMatchObject({
        height: side,
        transform: [
          { translateX: (56 - side) / 2 },
          { translateY: (32 - side) / 2 },
          { scale: (Math.hypot(56, 32) + spacing.sm) / side },
        ],
      })
    })

    it('rings the indicator in the vertical form', async () => {
      await renderBar()

      await fireEvent(tab('First item'), 'focus')

      expect(styleOf(pillOf('First item')).outlineWidth).toBe(2)
      expect(styleOf(tab('First item')).outlineWidth).toBeUndefined()
    })

    it('rings the whole pill in the horizontal form', async () => {
      await renderBar({ width: MEDIUM })

      await fireEvent(tab('First item'), 'focus')

      expect(styleOf(tab('First item')).outlineWidth).toBe(2)
    })

    it('draws no layer on a disabled destination', async () => {
      await renderBar({ items: { first: { isDisabled: true } } })

      await fireEvent(tab('First item'), 'hoverIn')

      const layer = child(pillOf('First item').children[1])
      expect(styleOf(child(layer.children[0])).opacity).toBe(0)
    })
  })

  describe('badges', () => {
    it('draws the small dot for `true`, on the icon’s top trailing corner', async () => {
      await renderBar({ items: { first: { badge: true } } })

      expect(styleOf(markOf('First item'))).toMatchObject({
        backgroundColor: colors.error,
        end: 0,
        height: 6,
        position: 'absolute',
        top: 0,
        width: 6,
      })
      expect(markOf('First item').children).toHaveLength(0)
    })

    it('draws the large badge holding a number, 2dp above the icon and 12dp in', async () => {
      await renderBar({ items: { first: { badge: 3 } } })

      expect(styleOf(markOf('First item'))).toMatchObject({
        backgroundColor: colors.error,
        minHeight: 16,
        minWidth: 16,
        paddingHorizontal: spacing.xs,
        position: 'absolute',
        start: 12,
        top: -2,
      })
      const count = countOf('First item')
      expect(count.children).toEqual(['3'])
      expect(textStyleOf(count)).toMatchObject({
        color: colors.onError,
        fontSize: typography.labelSmallSize,
        fontVariant: ['tabular-nums'],
      })
    })

    it('sets the count apart from the label with a space out of the flow', async () => {
      await renderBar({ items: { first: { badge: 3 } } })

      const space = child(markOf('First item').children[0])
      expect(space.children).toEqual([' '])
      expect(textStyleOf(space)).toMatchObject({ position: 'absolute' })
    })

    it('caps a count at 999+', async () => {
      await renderBar({ items: { first: { badge: 1000 } } })

      expect(countOf('First item').children).toEqual(['999+'])
    })

    it('draws a count of 999 as itself', async () => {
      await renderBar({ items: { first: { badge: 999 } } })

      expect(countOf('First item').children).toEqual(['999'])
    })

    it('hides the badge from a screen reader, so the label stays the name', async () => {
      await renderBar({ items: { first: { badge: 3 } } })

      expect(markOf('First item').props['aria-hidden']).toBe(true)
      expect(tab('First item')).toBeTruthy()
    })

    it('draws nothing for `false`', async () => {
      await renderBar({ items: { first: { badge: false } } })

      expect(iconSlotOf('First item').children).toHaveLength(1)
      expect(within(iconSlotOf('First item')).getByTestId('icon')).toBeTruthy()
    })

    it('joins the flow beside the label in the horizontal form', async () => {
      await renderBar({ items: { first: { badge: 3 } }, width: MEDIUM })

      expect(styleOf(markOf('First item'))).toMatchObject({
        marginStart: -12,
        position: 'relative',
        top: -2,
      })
    })

    it('keeps the small dot on the corner in the horizontal form', async () => {
      await renderBar({ items: { first: { badge: true } }, width: MEDIUM })

      expect(styleOf(markOf('First item'))).toMatchObject({
        end: 0,
        position: 'absolute',
      })
    })
  })

  describe('in a right-to-left layout', () => {
    it('places the badge by start and end, which the layout turns over', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      const sample = { items: { first: { badge: 3 }, second: { badge: true } } }
      resize(COMPACT)
      await render(
        <ThemeScope theme={OWN_THEME}>
          <Sample {...sample} />
        </ThemeScope>,
      )

      expect(styleOf(markOf('First item'))).toMatchObject({ start: 12 })
      expect(styleOf(markOf('Second item'))).toMatchObject({ end: 0 })
      expect(styleOf(markOf('First item')).left).toBeUndefined()
      expect(styleOf(markOf('Second item')).right).toBeUndefined()
      expect(styleOf(rowOf()).flexDirection).toBe('row')
    })
  })
})

describe('NavigationTabBar', () => {
  it('draws a destination per route, named by its title, the focused one selected', async () => {
    await renderTabs({ index: 1 })

    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getByRole('tab', { selected: true })).toBe(tab('Second item'))
  })

  it('follows the focused route as the navigator moves', async () => {
    const tabs = {
      descriptors: DESCRIPTORS,
      navigation: { emit: jest.fn(), navigate: jest.fn() },
      testID: 'bar',
    }
    const first = { ...tabs, state: { index: 0, routes: ROUTES } }
    const third = { ...tabs, state: { index: 2, routes: ROUTES } }
    resize(COMPACT)
    await render(<NavigationTabBar {...first} />)

    await screen.rerender(<NavigationTabBar {...third} />)

    expect(screen.getByRole('tab', { selected: true })).toBe(tab('Third item'))
  })

  it('labels a route by its name where it has no title', async () => {
    await renderTabs({
      descriptors: { ...DESCRIPTORS, 'third-key': { options: {} } },
    })

    expect(tab('third')).toBeTruthy()
  })

  it('labels a route by its tab bar label over its title', async () => {
    await renderTabs({
      descriptors: {
        ...DESCRIPTORS,
        'third-key': { options: { tabBarLabel: 'Label', title: 'Title' } },
      },
    })

    expect(tab('Label')).toBeTruthy()
  })

  it('hands a label function the title, colour, focus and position', async () => {
    const tabBarLabel = jest.fn(() => 'Drawn')
    await renderTabs({
      descriptors: {
        ...DESCRIPTORS,
        'first-key': { options: { tabBarLabel, title: 'First item' } },
      },
    })

    expect(tabBarLabel).toHaveBeenLastCalledWith({
      children: 'First item',
      color: colors.secondary,
      focused: true,
      position: 'below-icon',
    })
    expect(tab('First item')).toBeTruthy()
    expect(labelOf('First item').children).toEqual(['Drawn'])
  })

  it('tells a label function it is beside the icon in the horizontal form', async () => {
    const tabBarLabel = jest.fn(() => 'Drawn')
    await renderTabs({
      descriptors: {
        ...DESCRIPTORS,
        'first-key': { options: { tabBarLabel, title: 'First item' } },
      },
      width: MEDIUM,
    })

    expect(tabBarLabel).toHaveBeenCalledWith({
      children: 'First item',
      color: colors.onSecondaryContainer,
      focused: true,
      position: 'beside-icon',
    })
  })

  it('draws each icon at 24dp in the destination’s colour', async () => {
    await renderTabs()

    expect(iconOf('First item')).toBe(
      `${colors.onSecondaryContainer} 24 focused`,
    )
    expect(iconOf('Second item')).toBe(`${colors.onSurfaceVariant} 24`)
  })

  it('names a route by its accessibility label, and lands its test id', async () => {
    await renderTabs({
      descriptors: {
        ...DESCRIPTORS,
        'first-key': {
          options: {
            tabBarAccessibilityLabel: 'First item, 3 new',
            tabBarButtonTestID: 'first-tab',
            title: 'First item',
          },
        },
      },
    })

    expect(screen.getByTestId('first-tab')).toBe(tab('First item, 3 new'))
  })

  it.each<[number | string, string]>([
    [3, '3'],
    ['12', '12'],
  ])('draws a badge of %p as its count', async (badge, count) => {
    await renderTabs({
      descriptors: {
        ...DESCRIPTORS,
        'second-key': {
          options: {
            tabBarBadge: badge,
            tabBarIcon: iconFor,
            title: 'Second item',
          },
        },
      },
    })

    expect(countOf('Second item').children).toEqual([count])
  })

  it('draws any other string as the small dot', async () => {
    await renderTabs({
      descriptors: {
        ...DESCRIPTORS,
        'second-key': {
          options: {
            tabBarBadge: 'New',
            tabBarIcon: iconFor,
            title: 'Second item',
          },
        },
      },
    })

    expect(styleOf(markOf('Second item'))).toMatchObject({ height: 6 })
    expect(markOf('Second item').children).toHaveLength(0)
  })

  it('draws no badge for an empty string', async () => {
    await renderTabs({
      descriptors: {
        ...DESCRIPTORS,
        'second-key': {
          options: {
            tabBarBadge: '',
            tabBarIcon: iconFor,
            title: 'Second item',
          },
        },
      },
    })

    expect(iconSlotOf('Second item').children).toHaveLength(1)
  })

  describe('on React Navigation', () => {
    it('reports a press, then navigates to the route', async () => {
      const { emit, navigate } = await renderTabs()

      await fireEvent.press(tab('Second item'))

      expect(emit).toHaveBeenCalledWith({
        canPreventDefault: true,
        target: 'second-key',
        type: 'tabPress',
      })
      expect(navigate).toHaveBeenCalledWith('second', undefined)
    })

    it('passes the route’s params on', async () => {
      const { navigate } = await renderTabs({ index: 2 })

      await fireEvent.press(tab('First item'))

      expect(navigate).toHaveBeenCalledWith('first', { id: 1 })
    })

    it('stays where a listener prevents the press', async () => {
      const { emit, navigate } = await renderTabs({ defaultPrevented: true })

      await fireEvent.press(tab('Second item'))

      expect(emit).toHaveBeenCalled()
      expect(navigate).not.toHaveBeenCalled()
    })

    it('reports a press on the focused route without moving', async () => {
      const { emit, navigate } = await renderTabs()

      await fireEvent.press(tab('First item'))

      expect(emit).toHaveBeenCalledWith(
        expect.objectContaining({ target: 'first-key', type: 'tabPress' }),
      )
      expect(navigate).not.toHaveBeenCalled()
    })

    it('reports a long press', async () => {
      const { emit, navigate } = await renderTabs()

      await fireEvent(tab('Third item'), 'longPress')

      expect(emit).toHaveBeenCalledWith({
        target: 'third-key',
        type: 'tabLongPress',
      })
      expect(navigate).not.toHaveBeenCalled()
    })
  })

  describe('on Expo Router', () => {
    it('reports a press, then navigates to the route’s key', async () => {
      const { emit, navigateToTab } = await renderExpoTabs()

      await fireEvent.press(tab('Third item'))

      expect(emit).toHaveBeenCalledWith({
        canPreventDefault: true,
        target: 'third-key',
        type: 'tabPress',
      })
      expect(navigateToTab).toHaveBeenCalledWith('third-key')
    })

    it('stays where a listener prevents the press', async () => {
      const { emit, navigateToTab } = await renderExpoTabs({
        defaultPrevented: true,
      })

      await fireEvent.press(tab('Third item'))

      expect(emit).toHaveBeenCalled()
      expect(navigateToTab).not.toHaveBeenCalled()
    })
  })
})
