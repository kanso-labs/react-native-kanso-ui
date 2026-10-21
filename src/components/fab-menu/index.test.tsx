import type { ComponentRef, ReactNode } from 'react'
import type {
  HostInstance,
  MeasureInWindowOnSuccessCallback,
  StyleProp,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { TestInstance } from 'test-renderer'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { closePath } from '@kanso-labs/kanso-ui-core/glyphs'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import {
  AccessibilityInfo,
  BackHandler,
  Dimensions,
  I18nManager,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { FabMenuProps } from '.'
import type { FabSize, FabTone } from '../../fab'

import { FabMenu } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { ThemeScope } from '../../theme-scope'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

// What the next menu the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

// What Android's back gesture is handed to.
type BackListener = Parameters<typeof BackHandler.addEventListener>[1]

type Frame = readonly [x: number, y: number, width: number, height: number]

// What React Native's Jest preset draws a View as: a class component holding
// its props, with the native methods on its prototype.
type MockedView = Pick<HostInstance, 'measureInWindow'> & {
  readonly props: ViewProps
}

const { theme } = scopeFor('light', {})
const { colors, motion, radii, shadows, sizing, spacing, stateLayerOpacity } =
  theme
const { typography } = theme

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

// The overlay layer fills a 400 by 800 window, and the FAB sits in its
// bottom trailing corner at whatever size a case gives it.
const LAYER: Frame = [0, 0, 400, 800]

// Where `measureInWindow` reports the FAB, by the test id a case gives it.
let fabFrame: Frame = [328, 728, 56, 56]

const BACK_PRESS = { timeStamp: 0, type: 'hardwareBackPress' }

// A press with no point on the page, on a control that measures nothing, so
// the ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// Each size's edge and corner, and the icon it hands its icon.
const SIZES: readonly (readonly [FabSize, number, number, number])[] = [
  ['md', sizing.controlLg, radii.lg, 24],
  ['lg', 80, 20, 28],
  ['xl', sizing.controlXl, radii.xl, 36],
]

// Each tone: its container pair, which the FAB and the actions draw closed,
// and the tone itself, which the close button draws.
const TONES: readonly (readonly [
  FabTone,
  readonly [string, string],
  readonly [string, string],
])[] = [
  [
    'primary',
    [colors.primaryContainer, colors.onPrimaryContainer],
    [colors.primary, colors.onPrimary],
  ],
  [
    'secondary',
    [colors.secondaryContainer, colors.onSecondaryContainer],
    [colors.secondary, colors.onSecondary],
  ],
  [
    'tertiary',
    [colors.tertiaryContainer, colors.onTertiaryContainer],
    [colors.tertiary, colors.onTertiary],
  ],
]

// An icon of the app's own, which writes the colour and size its slot hands
// it, as `colour size`.
function IconProbe({ testID }: { readonly testID: string }) {
  const { color, size } = useIconStyle()

  return <Text testID={testID}>{`${String(color)} ${String(size)}`}</Text>
}

// Hoisted so no prop below is a new value on every render, which is what
// react-perf's JSX rules are after.
const ICON = <IconProbe testID="icon" />
const FIRST_ICON = <IconProbe testID="first-icon" />

function action(name: string) {
  return screen.getByRole('menuitem', { name })
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

function childOf(element: TestInstance, message: string): TestInstance {
  const child = element.children.at(0)

  if (child === undefined || typeof child === 'string') {
    throw new TypeError(message)
  }
  return child
}

// The svg drawing the close mark, hidden from a screen reader as every glyph
// is.
function closeMark() {
  const found = screen.root?.queryAll(
    (node) =>
      node.type === 'RNSVGSvgView' &&
      node.queryAll(
        (path) => path.type === 'RNSVGPath' && path.props.d === closePath,
      ).length > 0,
  )

  return found?.at(0) ?? null
}

function fab() {
  return screen.getByTestId('fab')
}

// The FAB's eased width, height, corner and container as they stand.
function fabMorph() {
  const { backgroundColor, borderRadius, height, width } =
    getAnimatedStyle(fab())

  return { backgroundColor: same(backgroundColor), borderRadius, height, width }
}

// The first action, whose name its icon probe's text joins, found by its test
// id instead.
function first() {
  return screen.getByTestId('first')
}

function isMockedView(value: unknown): value is MockedView {
  return (
    typeof value === 'object' && value !== null && 'measureInWindow' in value
  )
}

// Reports the column's size, which is what places it.
async function laidOut(width = 200, height = 120) {
  await fireEvent(menu(), 'layout', {
    nativeEvent: { layout: { height, width, x: 0, y: 0 } },
  })
}

// The layer a press outside the menu lands on, drawn just before it.
function layer() {
  const siblings = menu().parent?.children ?? []
  const found = siblings.at(siblings.indexOf(menu()) - 1)

  if (found === undefined || typeof found === 'string') {
    throw new TypeError('expected the layer before the menu')
  }
  return found
}

// The column of actions, which is drawn in the overlay host.
function menu() {
  const found = queryMenu()

  if (found === null) {
    throw new TypeError('expected the menu to be open')
  }
  return found
}

function queryMenu() {
  return (
    screen.root?.queryAll((node) => node.props.role === 'menu').at(0) ?? null
  )
}

// Renders a menu of three actions, the second given an icon of its own.
async function renderMenu(props: Partial<FabMenuProps> = {}) {
  return render(
    withScope(
      <FabMenu aria-label="Label" icon={ICON} testID="fab" {...props}>
        <FabMenu.Item icon={FIRST_ICON} id="first" testID="first">
          First item
        </FabMenu.Item>
        <FabMenu.Item id="second">Second item</FabMenu.Item>
        <FabMenu.Item id="third">Third item</FabMenu.Item>
      </FabMenu>,
    ),
  )
}

function resize(width: number, height: number) {
  const metrics = { fontScale: 1, height, scale: 1, width }

  Dimensions.set({ screen: metrics, window: metrics })
}

// How far below its place the menu stands, by its translation.
function riseOf(): unknown {
  const { transform }: { transform?: unknown } = getAnimatedStyle(menu())
  const move: unknown = Array.isArray(transform) ? transform.at(0) : undefined

  return typeof move === 'object' && move !== null && 'translateY' in move
    ? move.translateY
    : undefined
}

// A colour as React Native reads it, so a hex and the `rgba()` an ease ends
// on compare equal.
function same(color: unknown) {
  if (typeof color !== 'string') {
    throw new TypeError('expected a colour')
  }
  return withOpacity(color, 1)
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle & ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

// The test id of the view a screen reader was sent to.
function testIdOf(target: unknown) {
  return isMockedView(target) ? target.props.testID : undefined
}

function withScope(children: ReactNode) {
  return <ThemeScope>{children}</ThemeScope>
}

beforeEach(() => {
  jest.useFakeTimers()
  resize(400, 800)
  fabFrame = [328, 728, 56, 56]
  const prototype: unknown = View.prototype

  if (!isMockedView(prototype)) {
    throw new TypeError('expected the View the Jest preset mocks')
  }

  jest.spyOn(prototype, 'measureInWindow').mockImplementation(function measure(
    this: MockedView,
    callback: MeasureInWindowOnSuccessCallback,
  ) {
    callback(...(this.props.testID === 'fab' ? fabFrame : LAYER))
  })
})

afterEach(() => {
  mockReducedMotion = false
  Dimensions.set(INITIAL)
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('FabMenu', () => {
  describe('structure', () => {
    it('is a FAB named by its aria-label that says its menu is collapsed', async () => {
      await renderMenu()

      const button = screen.getByRole('button', { name: 'Label' })

      expect(button).toBe(fab())
      expect(button).toBeCollapsed()
      expect(fab().props['aria-haspopup']).toBe('menu')
      expect(queryMenu()).toBe(null)
    })

    it('opens a menu of its actions, named by the FAB', async () => {
      await renderMenu()

      await fireEvent.press(fab())

      expect(fab()).toBeExpanded()
      expect(menu().props['aria-label']).toBe('Label')
      expect(first().props.role).toBe('menuitem')
      expect(action('Second item')).toBeTruthy()
      expect(action('Third item')).toBeTruthy()
    })

    it('runs an action with its id and closes', async () => {
      const onAction = jest.fn()
      const onOpenChange = jest.fn()
      await renderMenu({ defaultOpen: true, onAction, onOpenChange })
      await laidOut()

      await fireEvent.press(action('Second item'))

      expect(onAction.mock.calls).toEqual([['second']])
      expect(onOpenChange.mock.calls).toEqual([[false]])
      expect(queryMenu()).toBe(null)
    })

    it("runs an action's own onAction in place of the menu's", async () => {
      const onAction = jest.fn()
      const own = jest.fn()
      await render(
        withScope(
          <FabMenu
            aria-label="Label"
            defaultOpen
            icon={ICON}
            onAction={onAction}
          >
            <FabMenu.Item id="first" onAction={own}>
              First item
            </FabMenu.Item>
            <FabMenu.Item id="second">Second item</FabMenu.Item>
          </FabMenu>,
        ),
      )
      await laidOut()

      await fireEvent.press(action('First item'))

      expect(own).toHaveBeenCalledTimes(1)
      expect(onAction).not.toHaveBeenCalled()
      expect(queryMenu()).toBe(null)
    })

    it('takes no press on a disabled action', async () => {
      const onAction = jest.fn()
      await render(
        withScope(
          <FabMenu
            aria-label="Label"
            defaultOpen
            icon={ICON}
            onAction={onAction}
          >
            <FabMenu.Item id="first" isDisabled>
              First item
            </FabMenu.Item>
            <FabMenu.Item id="second">Second item</FabMenu.Item>
          </FabMenu>,
        ),
      )
      await laidOut()

      const disabled = screen.getByRole('menuitem', {
        disabled: true,
        name: 'First item',
      })
      await fireEvent.press(disabled)

      expect(onAction).not.toHaveBeenCalled()
      expect(queryMenu()).not.toBe(null)
    })

    it('stays as the call site holds it when controlled', async () => {
      const onOpenChange = jest.fn()
      const view = await renderMenu({ isOpen: false, onOpenChange })

      await fireEvent.press(fab())

      expect(onOpenChange.mock.calls).toEqual([[true]])
      expect(queryMenu()).toBe(null)

      onOpenChange.mockClear()
      await view.rerender(
        withScope(
          <FabMenu
            aria-label="Label"
            icon={ICON}
            isOpen
            onOpenChange={onOpenChange}
            testID="fab"
          >
            <FabMenu.Item id="first">First item</FabMenu.Item>
          </FabMenu>,
        ),
      )
      await laidOut()
      await fireEvent.press(layer())

      expect(onOpenChange.mock.calls).toEqual([[false]])
      expect(queryMenu()).not.toBe(null)
    })

    it('lands style, ref and testID on the FAB', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await renderMenu({ ref, style: { marginTop: 4 } })

      expect(styleOf(fab()).marginTop).toBe(4)
      expect(ref.current).not.toBe(null)
    })
  })

  describe('dismissal', () => {
    it('closes from a press outside it', async () => {
      const onOpenChange = jest.fn()
      await renderMenu({ defaultOpen: true, onOpenChange })
      await laidOut()

      await fireEvent.press(layer())

      expect(onOpenChange.mock.calls).toEqual([[false]])
      expect(queryMenu()).toBe(null)
    })

    it('closes from a second press on the FAB', async () => {
      const onOpenChange = jest.fn()
      await renderMenu({ onOpenChange })

      await fireEvent.press(fab())
      await fireEvent.press(fab())

      expect(onOpenChange.mock.calls).toEqual([[true], [false]])
      expect(fab()).toBeCollapsed()
    })

    it("closes from Android's back gesture", async () => {
      const listeners: BackListener[] = []
      jest
        .spyOn(BackHandler, 'addEventListener')
        .mockImplementation((_, listener) => {
          listeners.push(listener)
          return { remove: jest.fn() }
        })
      const onOpenChange = jest.fn()
      await renderMenu({ defaultOpen: true, onOpenChange })

      let handled: boolean | undefined = false
      await act(() => {
        handled = listeners.at(-1)?.(BACK_PRESS)
      })

      expect(handled).toBe(true)
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it("closes from VoiceOver's escape gesture", async () => {
      const onOpenChange = jest.fn()
      await renderMenu({ defaultOpen: true, onOpenChange })

      await fireEvent(menu(), 'accessibilityEscape')

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('the FAB', () => {
    it.each(SIZES)(
      'is Fab at %s while closed',
      async (size, edge, corner, icon) => {
        await renderMenu({ size })

        expect(fabMorph()).toEqual({
          backgroundColor: same(colors.primaryContainer),
          borderRadius: corner,
          height: edge,
          width: edge,
        })
        expect(screen.getByTestId('icon')).toHaveTextContent(
          `${colors.onPrimaryContainer} ${String(icon)}`,
        )
        expect(styleOf(fab()).boxShadow).toBe(shadows.elevation3)
      },
    )

    it.each(SIZES)(
      'becomes the 56dp close button in the tone itself from %s',
      async (size) => {
        await renderMenu({ size })

        await fireEvent.press(fab())
        await advance(motion.durationMedium1)

        expect(fabMorph()).toEqual({
          backgroundColor: same(colors.primary),
          borderRadius: sizing.controlLg / 2,
          height: sizing.controlLg,
          width: sizing.controlLg,
        })
        expect(screen.queryByTestId('icon')).toBe(null)
        expect(closeMark()?.props).toMatchObject({
          color: colors.onPrimary,
          height: 20,
          width: 20,
        })
      },
    )

    it('eases the change over medium1, and back as it closes', async () => {
      await renderMenu({ size: 'xl' })

      await fireEvent.press(fab())
      await advance(motion.durationMedium1 / 2)

      const { width } = fabMorph()

      expect(width).toBeGreaterThan(sizing.controlLg)
      expect(width).toBeLessThan(sizing.controlXl)

      await advance(motion.durationMedium1 / 2)
      await fireEvent.press(fab())
      await advance(motion.durationMedium1)

      expect(fabMorph()).toMatchObject({
        borderRadius: radii.xl,
        width: sizing.controlXl,
      })
      expect(closeMark()).toBe(null)
    })

    it('makes the change at once under reduced motion', async () => {
      mockReducedMotion = true
      await renderMenu({ size: 'xl' })

      await fireEvent.press(fab())
      await advance(0)

      expect(fabMorph()).toMatchObject({
        borderRadius: sizing.controlLg / 2,
        width: sizing.controlLg,
      })
    })

    it('clips its press feedback to the corner as it changes', async () => {
      await renderMenu({ size: 'lg' })

      const clip = childOf(fab(), 'expected the feedback to sit in a view')

      expect(getAnimatedStyle(clip).borderRadius).toBe(20)
      expect(styleOf(clip).overflow).toBe('hidden')

      await fireEvent.press(fab())
      await advance(motion.durationMedium1)

      expect(getAnimatedStyle(clip).borderRadius).toBe(sizing.controlLg / 2)
    })

    it.each(TONES)(
      'draws %s on its container closed and on the tone open',
      async (tone, [container], [fill, content]) => {
        await renderMenu({ tone })

        expect(fabMorph().backgroundColor).toBe(same(container))

        await fireEvent.press(fab())
        await advance(motion.durationMedium1)

        expect(fabMorph().backgroundColor).toBe(same(fill))
        expect(closeMark()?.props.color).toBe(content)
      },
    )

    it('lifts to level 4 under a hovering pointer', async () => {
      await renderMenu()

      await fireEvent(fab(), 'hoverIn', {})

      expect(styleOf(fab()).boxShadow).toBe(shadows.elevation4)
    })
  })

  describe('the actions', () => {
    it("draws each as the page's 56dp pill, 24dp in, its icon 8dp before the label", async () => {
      await renderMenu({ defaultOpen: true })

      expect(styleOf(first())).toMatchObject({
        alignItems: 'center',
        backgroundColor: colors.primaryContainer,
        borderRadius: radii.pill,
        boxShadow: shadows.elevation3,
        columnGap: spacing.sm,
        flexDirection: 'row',
        minHeight: sizing.controlLg,
        minWidth: sizing.controlLg,
        paddingHorizontal: spacing.xl,
      })
      expect(screen.getByTestId('first-icon')).toHaveTextContent(
        `${colors.onPrimaryContainer} 24`,
      )
    })

    it('sets each label in title medium, on one line', async () => {
      await renderMenu({ defaultOpen: true })

      const label = screen.getByText('First item')

      expect(label.props.numberOfLines).toBe(1)
      expect(styleOf(label)).toMatchObject({
        color: colors.onPrimaryContainer,
        fontSize: typography.titleMediumSize,
        lineHeight: typography.titleMediumLineHeight,
      })
    })

    it.each(TONES)(
      "draws %s's actions on its container pair",
      async (tone, [container, content]) => {
        await renderMenu({ defaultOpen: true, tone })

        expect(styleOf(first()).backgroundColor).toBe(container)
        expect(styleOf(screen.getByText('First item')).color).toBe(content)
      },
    )

    it('lifts an action to level 4 under a hovering pointer, and back while pressed', async () => {
      await renderMenu({ defaultOpen: true })

      await fireEvent(first(), 'hoverIn', {})

      expect(styleOf(first()).boxShadow).toBe(shadows.elevation4)

      await fireEvent(first(), 'pressIn', PRESS)

      expect(styleOf(first()).boxShadow).toBe(shadows.elevation3)
    })

    it('clips the state layer to the pill', async () => {
      await renderMenu({ defaultOpen: true })

      const surface = childOf(first(), 'expected the feedback')

      expect(styleOf(surface)).toMatchObject({
        borderRadius: radii.pill,
        overflow: 'hidden',
      })
    })

    it('draws a disabled action at the disabled opacities, without its shadow', async () => {
      await render(
        withScope(
          <FabMenu aria-label="Label" defaultOpen icon={ICON}>
            <FabMenu.Item id="first" isDisabled>
              First item
            </FabMenu.Item>
          </FabMenu>,
        ),
      )

      const disabled = screen.getByRole('menuitem', {
        disabled: true,
        name: 'First item',
      })

      expect(styleOf(disabled).backgroundColor).toBe(
        withOpacity(colors.onSurface, stateLayerOpacity.disabledContainer),
      )
      expect(styleOf(disabled).boxShadow).toBeUndefined()
      expect(styleOf(screen.getByText('First item')).color).toBe(
        withOpacity(colors.onSurface, stateLayerOpacity.disabledContent),
      )
    })

    it('stands them in a column 4dp apart, lined up on its end', async () => {
      await renderMenu({ defaultOpen: true })

      expect(styleOf(menu())).toMatchObject({
        alignItems: 'flex-end',
        rowGap: spacing.xs,
      })
    })

    it('is hidden until it is placed', async () => {
      await renderMenu({ defaultOpen: true })

      expect(styleOf(menu())).toMatchObject({ opacity: 0 })
    })

    it("sits 8dp above the FAB, lined up on the FAB's end", async () => {
      await renderMenu({ defaultOpen: true })
      await laidOut(200, 120)

      expect(styleOf(menu())).toMatchObject({
        left: 328 + 56 - 200,
        position: 'absolute',
        top: 728 - spacing.sm - 120,
      })
    })

    it('sits above the close button a larger FAB shrinks into', async () => {
      fabFrame = [288, 688, 96, 96]
      await renderMenu({ defaultOpen: true, size: 'xl' })
      await laidOut(200, 120)

      expect(styleOf(menu())).toMatchObject({
        left: 288 + 96 - 200,
        top: 688 + 96 - sizing.controlLg - spacing.sm - 120,
      })
    })

    it("lines up on the FAB's end under right-to-left", async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      jest.replaceProperty(I18nManager, 'doLeftAndRightSwapInRTL', false)
      fabFrame = [16, 688, 96, 96]
      await renderMenu({ defaultOpen: true, size: 'xl' })
      await laidOut(200, 120)

      expect(styleOf(menu())).toMatchObject({
        left: 16,
        top: 688 + 96 - sizing.controlLg - spacing.sm - 120,
      })
    })

    it('rises 8dp into place over short3 once it has been placed', async () => {
      await renderMenu({ defaultOpen: true })
      await advance(motion.durationShort3)

      expect(getAnimatedStyle(menu()).opacity).toBe(0)

      await laidOut()

      expect(getAnimatedStyle(menu())).toMatchObject({
        opacity: 0,
        transform: [{ translateY: 8 }],
      })

      await advance(motion.durationShort3 / 2)

      expect(getAnimatedStyle(menu()).opacity).toBeGreaterThan(0)
      expect(getAnimatedStyle(menu()).opacity).toBeLessThan(1)
      expect(riseOf()).toBeGreaterThan(0)
      expect(riseOf()).toBeLessThan(8)

      await advance(motion.durationShort3 / 2)

      expect(getAnimatedStyle(menu())).toMatchObject({
        opacity: 1,
        transform: [{ translateY: 0 }],
      })
    })

    it('arrives at once under reduced motion', async () => {
      mockReducedMotion = true
      await renderMenu({ defaultOpen: true })
      await laidOut()
      await advance(0)

      expect(getAnimatedStyle(menu())).toMatchObject({
        opacity: 1,
        transform: [{ translateY: 0 }],
      })
    })
  })

  describe('focus', () => {
    it('sends the screen reader to the first action a press reaches once it is placed', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      await render(
        withScope(
          <FabMenu aria-label="Label" icon={ICON} testID="fab">
            <FabMenu.Item id="first" isDisabled>
              First item
            </FabMenu.Item>
            <FabMenu.Item id="second" testID="second">
              Second item
            </FabMenu.Item>
          </FabMenu>,
        ),
      )

      await fireEvent.press(fab())

      expect(send).not.toHaveBeenCalled()

      await laidOut()

      expect(send).toHaveBeenCalledTimes(1)
      expect(send.mock.calls[0]?.[1]).toBe('focus')
      expect(testIdOf(send.mock.calls[0]?.[0])).toBe('second')
    })

    it('sends it back to the FAB once it has gone', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      await renderMenu()

      await fireEvent.press(fab())
      await laidOut()
      send.mockClear()
      await fireEvent.press(layer())

      expect(send).toHaveBeenCalledTimes(1)
      expect(testIdOf(send.mock.calls[0]?.[0])).toBe('fab')
    })
  })
})
