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
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { NavigationRailItemProps } from '.'

import { NavigationRail } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { RouterProvider } from '../../router'
import { scopeFor } from '../../theme/scope'

let mockReducedMotion = false

// Every move to a width the rail asks Reanimated for, so a case can read
// which duration and curve its width moved over. The destinations' active
// indicators move between 0 and 1, which are no rail's width.
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
      if (typeof args[0] === 'number' && args[0] > 1) {
        mockTimings.push(args[1])
      }
      return actual.withTiming(...args)
    },
  }
})

const { theme } = scopeFor('light', {})
const { colors, motion, spacing, typography } = theme

const ICON = <Icon />

const CALL_SITE = StyleSheet.create({ rail: { marginTop: 4 } }).rail

// A view that puts what it holds at the rail's foot.
const FOOT = StyleSheet.create({
  foot: { alignSelf: 'stretch', marginTop: 'auto' },
}).foot

const HEADER = (
  <Pressable aria-label="Menu" role="button" testID="header-button" />
)

const NO_ITEMS: ItemOverrides = {}

type ItemOverrides = Partial<
  Record<'first' | 'second' | 'third', Partial<NavigationRailItemProps>>
>

afterEach(() => {
  jest.restoreAllMocks()
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

// The rail's form: its padding, its width and how it lays out its header and
// destinations.
function columnOf() {
  return child(safeAreaOf().children[0])
}

// How the block the destinations scroll in lays them out.
function containerStyleOf(element: {
  props: { contentContainerStyle?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.contentContainerStyle]) ?? {}
}

// What the rail measures: the form being drawn, at its own width.
function contentOf() {
  return child(screen.getByTestId('rail').children[0])
}

// The header's own view, above the destinations.
function headerOf() {
  return child(columnOf().children[0])
}

// What a destination's slot hands an icon, written out where a case can
// read it.
function Icon() {
  const { color, size } = useIconStyle()

  return <Text testID="icon">{`${String(color)} ${String(size)}`}</Text>
}

// What the icon in a destination was handed: its colour, then its size.
function iconOf(name: string) {
  const text: unknown = within(tab(name)).getByTestId('icon').props.children
  if (typeof text !== 'string') {
    throw new TypeError('expected the icon to write a string')
  }
  return text
}

// A destination's label, which comes first in the tree in either form.
function labelOf(name: string) {
  return child(
    tab(name).children.find(
      (node) => typeof node !== 'string' && node.type === 'Text',
    ),
  )
}

// Lays the form being drawn out at a width, as the platform measures it.
async function layOut(width: number) {
  await fireEvent(contentOf(), 'layout', {
    nativeEvent: { layout: { height: 440, width, x: 0, y: 0 } },
  })
}

// The block the destinations scroll in, which is the tab list.
function listOf() {
  return child(columnOf().children.at(-1))
}

// What a destination draws its layers, its ring and its fill on: the
// indicator in the collapsed form, and the whole destination in the
// expanded one.
function pillOf(name: string) {
  const destination = tab(name)
  const last = child(destination.children.at(-1))
  return last.children.length > 1 ? last : destination
}

function railOf() {
  return screen.getByTestId('rail')
}

async function renderRail({
  header,
  isExpanded = false,
  items = NO_ITEMS,
  selectedRoute = '/first',
}: {
  readonly header?: ReactNode
  readonly isExpanded?: boolean
  readonly items?: ItemOverrides
  readonly selectedRoute?: string
} = {}) {
  const sample = { header, isExpanded, items, selectedRoute }
  return render(<Sample {...sample} />)
}

function safeAreaOf() {
  return child(contentOf().children[0])
}

// Renders a rail of three destinations, the first one current unless a case
// says otherwise.
function Sample({
  header,
  isExpanded,
  items = NO_ITEMS,
  selectedRoute,
}: {
  readonly header?: ReactNode
  readonly isExpanded?: boolean
  readonly items?: ItemOverrides
  readonly selectedRoute?: string
}) {
  const rail = { header, isExpanded, selectedRoute }

  return (
    <NavigationRail aria-label="Label" {...rail} testID="rail">
      <NavigationRail.Item href="/first" icon={ICON} {...items.first}>
        First item
      </NavigationRail.Item>
      <NavigationRail.Item href="/second" icon={ICON} {...items.second}>
        Second item
      </NavigationRail.Item>
      <NavigationRail.Item href="/third" icon={ICON} {...items.third}>
        Third item
      </NavigationRail.Item>
    </NavigationRail>
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

// The rail's width once the frame has run, or undefined while it follows
// the form it draws.
async function widthOf() {
  await act(() => {
    jest.advanceTimersByTime(0)
  })
  return getAnimatedStyle(railOf()).width
}

describe('NavigationRail', () => {
  describe('semantics', () => {
    it('is a tab list of its destinations, named by its label', async () => {
      await renderRail()

      expect(listOf().props.role).toBe('tablist')
      expect(listOf().props['aria-label']).toBe('Label')
      expect(within(listOf()).getAllByRole('tab')).toHaveLength(3)
      expect(tab('Second item')).toBeTruthy()
    })

    it('selects the destination whose href is the selected route', async () => {
      await renderRail({ selectedRoute: '/third' })

      expect(screen.getByRole('tab', { selected: true })).toBe(
        tab('Third item'),
      )
      expect(tab('First item')).not.toBeSelected()
    })

    it('keeps the header outside the tab list', async () => {
      await renderRail({ header: HEADER })

      expect(within(listOf()).queryByTestId('header-button')).toBeNull()
      expect(within(headerOf()).getByTestId('header-button')).toBeTruthy()
    })

    it('takes a name of its own for a destination', async () => {
      await renderRail({
        items: { second: { 'aria-label': 'Second item, 3 new', badge: 3 } },
      })

      expect(tab('Second item, 3 new')).toBeTruthy()
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
      await render(
        <RouterProvider navigate={navigate}>
          <Sample {...sample} />
        </RouterProvider>,
      )

      await fireEvent.press(tab('Third item'))

      expect(calls).toEqual(['onPress', 'navigate /third'])
    })
  })

  describe('the rail', () => {
    it('is the surface, keeping its width beside what it sits by', async () => {
      await renderRail()

      expect(styleOf(railOf())).toMatchObject({
        backgroundColor: colors.surface,
        flexShrink: 0,
        overflow: 'hidden',
      })
      expect(styleOf(contentOf()).flexShrink).toBe(0)
    })

    it('keeps its contents clear of the top, the bottom and its leading side', async () => {
      await renderRail()

      expect(safeAreaOf().type).toBe('RNCSafeAreaView')
      expect(safeAreaOf().props.edges).toEqual({
        bottom: 'additive',
        left: 'additive',
        right: 'off',
        top: 'additive',
      })
    })

    it('takes its leading inset on the right under right-to-left', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await renderRail()

      expect(safeAreaOf().props.edges).toEqual({
        bottom: 'additive',
        left: 'off',
        right: 'additive',
        top: 'additive',
      })
    })

    it('scrolls its destinations, every focus ring whole', async () => {
      await renderRail()

      expect(listOf().type).toBe('RCTScrollView')
      expect(styleOf(safeAreaOf())).toMatchObject({ flexShrink: 1 })
      expect(styleOf(columnOf())).toMatchObject({ flexShrink: 1 })
      expect(styleOf(listOf())).toMatchObject({ flexShrink: 1, margin: -4 })
      expect(containerStyleOf(listOf())).toMatchObject({ padding: 4 })
    })

    it.each([
      ['collapsed', false],
      ['expanded', true],
    ])(
      'gives a destination at its foot the height the rest leave, %s',
      async (_form, isExpanded) => {
        await render(
          <NavigationRail
            aria-label="Label"
            isExpanded={isExpanded}
            testID="rail"
          >
            <NavigationRail.Item href="/first" icon={ICON}>
              First item
            </NavigationRail.Item>
            <View style={FOOT}>
              <NavigationRail.Item href="/second" icon={ICON}>
                Second item
              </NavigationRail.Item>
            </View>
          </NavigationRail>,
        )

        expect(containerStyleOf(listOf())).toMatchObject({ flexGrow: 1 })
        expect(within(listOf()).getAllByRole('tab')).toHaveLength(2)
      },
    )

    it('lands the call site’s style on its surface', async () => {
      await render(
        <NavigationRail style={CALL_SITE} testID="rail">
          {null}
        </NavigationRail>,
      )

      expect(styleOf(railOf())).toMatchObject({
        backgroundColor: colors.surface,
        marginTop: 4,
      })
    })
  })

  describe('collapsed', () => {
    it('is 96dp wide, its contents 44dp down and 24dp clear of its foot', async () => {
      await renderRail()

      expect(styleOf(columnOf())).toMatchObject({
        alignItems: 'center',
        paddingBottom: spacing.xl,
        paddingTop: 44,
        width: 96,
      })
    })

    it('draws its destinations 4dp apart, each as wide as the rail', async () => {
      await renderRail()

      expect(containerStyleOf(listOf())).toMatchObject({ gap: spacing.xs })
      expect(styleOf(tab('First item'))).toMatchObject({
        alignSelf: 'stretch',
        flexDirection: 'column-reverse',
        flexShrink: 0,
        gap: spacing.xs,
        paddingHorizontal: spacing.xs,
        paddingVertical: 6,
      })
    })

    it('puts the label under a 56dp by 32dp indicator, in label medium', async () => {
      await renderRail()

      expect(styleOf(pillOf('First item'))).toMatchObject({
        height: 32,
        width: 56,
      })
      expect(textStyleOf(labelOf('First item'))).toMatchObject({
        color: colors.secondary,
        fontSize: typography.labelMediumSize,
      })
      expect(iconOf('First item')).toBe(`${colors.onSecondaryContainer} 24`)
      expect(textStyleOf(labelOf('Second item')).color).toBe(
        colors.onSurfaceVariant,
      )
    })

    it('puts a header 40dp clear of the first destination, with the 4dp gap', async () => {
      await renderRail({ header: HEADER })

      expect(styleOf(headerOf())).toMatchObject({
        alignItems: 'center',
        marginBottom: spacing.xxxl - spacing.xs,
      })
    })

    it('grows the ripple from the indicator’s centre, measuring nothing', async () => {
      await renderRail()
      const measure = jest.fn()

      await fireEvent(tab('Second item'), 'pressIn', {
        currentTarget: { measure },
        nativeEvent: { pageX: 300, pageY: 30 },
      })
      await act(() => {
        jest.advanceTimersByTime(motion.durationLong1)
      })

      const surface = child(pillOf('Second item').children[1])
      const side = Math.floor(56 * 0.2)
      expect(measure).not.toHaveBeenCalled()
      expect(getAnimatedStyle(child(surface.children[1]))).toMatchObject({
        height: side,
      })
    })
  })

  describe('expanded', () => {
    it('is between 220dp and 360dp wide, 20dp either side of its pills', async () => {
      await renderRail({ isExpanded: true })

      expect(styleOf(columnOf())).toMatchObject({
        flexShrink: 1,
        maxWidth: 360,
        minWidth: 220,
        paddingBottom: spacing.xl,
        paddingHorizontal: 20,
        paddingTop: 44,
      })
      expect(styleOf(columnOf()).width).toBeUndefined()
    })

    it('draws each destination as the page’s 56dp pill, its label beside the icon', async () => {
      await renderRail({ isExpanded: true })

      expect(styleOf(tab('First item'))).toMatchObject({
        alignSelf: 'flex-start',
        flexDirection: 'row-reverse',
        gap: spacing.sm,
        maxWidth: '100%',
        minHeight: 56,
        paddingHorizontal: spacing.lg,
      })
      expect(pillOf('First item')).toBe(tab('First item'))
      expect(textStyleOf(labelOf('First item'))).toMatchObject({
        color: colors.onSecondaryContainer,
        fontSize: typography.labelLargeSize,
      })
    })

    it('reaches no further than its 56dp pill, which is target enough', async () => {
      await renderRail({ isExpanded: true })

      expect(tab('First item').props.hitSlop).toBeUndefined()
    })

    it('draws its pills with no gap between, at its leading edge', async () => {
      await renderRail({ isExpanded: true })

      const list = containerStyleOf(listOf())
      expect(list.alignItems).toBe('flex-start')
      expect(list.gap).toBeUndefined()
    })

    it('puts a header at the leading edge, 40dp clear of the first destination', async () => {
      await renderRail({ header: HEADER, isExpanded: true })

      expect(styleOf(headerOf())).toMatchObject({
        alignItems: 'flex-start',
        alignSelf: 'stretch',
        marginBottom: spacing.xxxl,
        paddingStart: spacing.sm,
      })
    })

    it('joins a count badge to the flow beside the label', async () => {
      await renderRail({
        isExpanded: true,
        items: { second: { 'aria-label': 'Second item, 3 new', badge: 3 } },
      })

      const slot = child(tab('Second item, 3 new').children.at(-1))
      const mark = child(child(slot.children[0]).children[1])
      expect(styleOf(mark)).toMatchObject({
        marginStart: -12,
        position: 'relative',
      })
    })
  })

  describe('changing form', () => {
    it('follows the form it draws until that is first measured', async () => {
      await renderRail()

      expect(await widthOf()).toBeUndefined()

      await layOut(96)

      expect(await widthOf()).toBe(96)
      expect(mockTimings).toHaveLength(0)
    })

    it('widens to the expanded form’s width over long 2 on the emphasized curve', async () => {
      await renderRail()
      await layOut(96)

      await screen.rerender(<Sample isExpanded selectedRoute="/first" />)
      await layOut(240)

      expect(mockTimings).toEqual([
        expect.objectContaining({
          duration: motion.durationLong2,
          easing: expect.objectContaining({
            bezier: [...motion.easingEmphasized],
          }),
        }),
      ])
      await act(() => {
        jest.advanceTimersByTime(motion.durationLong2 / 2)
      })
      const midway = getAnimatedStyle(railOf()).width
      expect(midway).toBeGreaterThan(96)
      expect(midway).toBeLessThan(240)
      expect(styleOf(tab('First item')).flexDirection).toBe('row-reverse')

      await act(() => {
        jest.advanceTimersByTime(motion.durationLong2)
      })
      expect(getAnimatedStyle(railOf()).width).toBe(240)
    })

    it('narrows back once collapsed', async () => {
      await renderRail({ isExpanded: true })
      await layOut(240)

      await screen.rerender(<Sample selectedRoute="/first" />)
      await layOut(96)
      await act(() => {
        jest.advanceTimersByTime(motion.durationLong2)
      })

      expect(getAnimatedStyle(railOf()).width).toBe(96)
      expect(mockTimings).toHaveLength(1)
    })

    it('changes width at once under reduced motion', async () => {
      mockReducedMotion = true
      await renderRail()
      await layOut(96)

      await screen.rerender(<Sample isExpanded selectedRoute="/first" />)
      await layOut(240)

      expect(await widthOf()).toBe(240)
      expect(mockTimings).toHaveLength(0)
    })
  })
})
