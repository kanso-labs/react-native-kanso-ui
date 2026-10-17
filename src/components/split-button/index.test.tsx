import type {
  HostInstance,
  MeasureInWindowOnSuccessCallback,
  StyleProp,
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
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Platform, StyleSheet, View } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { SplitButtonMenuProps, SplitButtonProps } from '.'
import type { ControlSize } from '../../button'

import { SplitButton } from '.'
import { HEIGHTS } from '../../button'
import { ThemeScope } from '../../theme-scope'
import { scopeFor } from '../../theme/scope'
import { Menu } from '../menu'

type Element = Parameters<typeof getAnimatedStyle>[0]

// What React Native's Jest preset draws a View as: a class component holding
// its props, with the native methods on its prototype.
type MockedView = Pick<HostInstance, 'measureInWindow'> & {
  readonly props: ViewProps
}

const { theme } = scopeFor('light', {})
const { colors, motion, radii, sizing, spacing, stateLayerOpacity } = theme

// A press with no point on the page, on a control that measures nothing, so
// the ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

const OWN = StyleSheet.create({ group: { marginTop: 3 } })

// Each size's leading padding, the trailing half's while the menu is closed
// and once it is open, start then end, and the chevron's side.
const SIZES: readonly (readonly [
  ControlSize,
  readonly [number, number],
  readonly [number, number],
  number,
  number,
])[] = [
  ['xs', [12, 10], [12, 14], 13, 22],
  ['md', [16, 12], [12, 14], 13, 22],
  ['lg', [24, 24], [13, 17], 15, 26],
  ['xl', [48, 48], [26, 32], 29, 38],
  ['xxl', [64, 64], [37, 49], 43, 50],
]

// Each size's inner corner at rest and while a half is active.
const CORNERS: readonly (readonly [ControlSize, number, number])[] = [
  ['xs', radii.xs, radii.sm],
  ['md', radii.xs, radii.md],
  ['lg', radii.xs, radii.md],
  ['xl', radii.sm, 20],
  ['xxl', radii.md, 20],
]

// Each variant's container, which both halves draw.
const VARIANTS: readonly (readonly [
  NonNullable<SplitButtonProps['variant']>,
  ViewStyle,
])[] = [
  ['filled', { backgroundColor: colors.primary }],
  ['tonal', { backgroundColor: colors.secondaryContainer }],
  ['elevated', { backgroundColor: colors.surfaceContainerLow }],
  ['outlined', { borderColor: colors.outlineVariant, borderWidth: 1 }],
]

function action() {
  return screen.getByRole('button', {
    includeHiddenElements: true,
    name: 'Label',
  })
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// The chevron's svg, at the side it is drawn.
function chevronSize(element: TestInstance) {
  const svg = element.queryAll((node) => node.type === 'RNSVGSvgView').at(0)
  const { bbHeight, bbWidth }: { bbHeight?: unknown; bbWidth?: unknown } =
    svg?.props ?? {}

  return [bbWidth, bbHeight]
}

// A half's corners on its two sides, read once their ease has run.
function cornersOf(element: Element) {
  const style: {
    borderBottomEndRadius?: unknown
    borderBottomLeftRadius?: unknown
    borderBottomRightRadius?: unknown
    borderBottomStartRadius?: unknown
    borderRadius?: unknown
    borderTopEndRadius?: unknown
    borderTopLeftRadius?: unknown
    borderTopRightRadius?: unknown
    borderTopStartRadius?: unknown
  } = getAnimatedStyle(element)

  return {
    end: [style.borderTopEndRadius, style.borderBottomEndRadius],
    left: [style.borderTopLeftRadius, style.borderBottomLeftRadius],
    right: [style.borderTopRightRadius, style.borderBottomRightRadius],
    round: style.borderRadius,
    start: [style.borderTopStartRadius, style.borderBottomStartRadius],
  }
}

function group() {
  return screen.getByTestId('group', { includeHiddenElements: true })
}

function isMockedView(value: unknown): value is MockedView {
  return (
    typeof value === 'object' && value !== null && 'measureInWindow' in value
  )
}

// The state layer a half draws, under the view that clips it.
function layerOf(element: TestInstance) {
  const clip = element.children.at(0)
  const surface = typeof clip === 'object' ? clip.children.at(0) : undefined
  const layer = typeof surface === 'object' ? surface.children.at(0) : undefined

  if (layer === undefined || typeof layer === 'string') {
    throw new TypeError('expected a state layer')
  }
  return layer
}

// Reports every open menu's size, which places it and lets presses through.
async function layOut() {
  const menus =
    screen.root?.queryAll((node) => node.props.role === 'menu') ?? []

  for (const surface of menus) {
    // oxlint-disable-next-line no-await-in-loop -- each layout is an act of its own, and two acts may not overlap
    await fireEvent(surface, 'layout', {
      nativeEvent: { layout: { height: 100, width: 200, x: 0, y: 0 } },
    })
  }
}

// A half's padding at the start and the end.
function paddingsOf(element: Element) {
  const {
    paddingEnd,
    paddingStart,
  }: { paddingEnd?: unknown; paddingStart?: unknown } =
    getAnimatedStyle(element)

  return [paddingStart, paddingEnd]
}

// Renders a split button of the two halves, the shape a call site draws.
async function renderSplit(
  props: Partial<SplitButtonProps> = {},
  menu: Partial<SplitButtonMenuProps> = {},
  onPress?: () => void,
) {
  return render(
    <ThemeScope>
      <SplitButton aria-label="Pair" testID="group" {...props}>
        <SplitButton.Action onPress={onPress}>Label</SplitButton.Action>
        <SplitButton.Menu aria-label="More options" {...menu}>
          <Menu.Item id="first">First item</Menu.Item>
          <Menu.Item id="second">Second item</Menu.Item>
        </SplitButton.Menu>
      </SplitButton>
    </ThemeScope>,
  )
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function trigger() {
  return screen.getByRole('button', {
    includeHiddenElements: true,
    name: 'More options',
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  const prototype: unknown = View.prototype

  if (!isMockedView(prototype)) {
    throw new TypeError('expected the View the Jest preset mocks')
  }

  // The trigger sits at (100, 300), 48 by 40, in a window 400 by 800, which
  // is what every other view reports.
  jest.spyOn(prototype, 'measureInWindow').mockImplementation(function measure(
    this: MockedView,
    callback: MeasureInWindowOnSuccessCallback,
  ) {
    if (this.props.accessibilityLabel === 'More options') {
      callback(100, 300, 48, 40)
    } else {
      callback(0, 0, 400, 800)
    }
  })
})

afterEach(() => {
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('the structure', () => {
  it('is a named group of the action and the menu trigger', async () => {
    await renderSplit()

    expect(group().props).toMatchObject({ 'aria-label': 'Pair', role: 'group' })
    expect(screen.getAllByRole('button')).toEqual([action(), trigger()])
    expect(screen.getByRole('button', { expanded: false })).toBe(trigger())
  })

  it('sets its halves side by side, 2dp apart', async () => {
    await renderSplit()

    expect(styleOf(group())).toMatchObject({
      alignSelf: 'flex-start',
      flexDirection: 'row',
      gap: spacing.xxs,
    })
  })

  it('lays its own style over the group', async () => {
    await renderSplit({ style: OWN.group })

    expect(styleOf(group())).toMatchObject({ gap: spacing.xxs, marginTop: 3 })
  })

  it("calls the action's onPress", async () => {
    const onPress = jest.fn()
    await renderSplit({}, {}, onPress)

    await fireEvent.press(action(), PRESS)

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(screen.queryAllByRole('menuitem')).toEqual([])
  })
})

describe('the menu', () => {
  it('opens from the trigger and shows its items', async () => {
    const onOpenChange = jest.fn()
    await renderSplit({}, { onOpenChange })

    await fireEvent.press(trigger(), PRESS)

    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(trigger().props.accessibilityState).toMatchObject({
      expanded: true,
    })
    expect(screen.getAllByRole('menuitem')).toHaveLength(2)
    expect(screen.getByRole('menuitem', { name: 'First item' })).toBeTruthy()
  })

  it("runs onAction with the chosen item's key and closes", async () => {
    const onAction = jest.fn()
    await renderSplit({}, { onAction })

    await fireEvent.press(trigger(), PRESS)
    await layOut()
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Second item' }))
    await advance(motion.durationLong2)

    expect(onAction).toHaveBeenCalledWith('second')
    expect(screen.queryAllByRole('menuitem')).toEqual([])
  })

  it('starts open given defaultOpen', async () => {
    await renderSplit({}, { defaultOpen: true })

    expect(screen.getAllByRole('menuitem')).toHaveLength(2)
  })

  it('follows isOpen, which the call site holds', async () => {
    const onOpenChange = jest.fn()
    await renderSplit({}, { isOpen: true, onOpenChange })

    await fireEvent.press(trigger(), PRESS)
    await layOut()
    await fireEvent.press(screen.getByRole('menuitem', { name: 'First item' }))
    await advance(motion.durationLong2)

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(screen.getAllByRole('menuitem')).toHaveLength(2)
  })

  it('disables the trigger alone given isDisabled', async () => {
    const onOpenChange = jest.fn()
    await renderSplit({}, { isDisabled: true, onOpenChange })

    expect(
      screen.getByRole('button', { disabled: true, name: 'More options' }),
    ).toBe(trigger())
    expect(screen.getByRole('button', { disabled: false, name: 'Label' })).toBe(
      action(),
    )

    await fireEvent.press(trigger(), PRESS)

    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

describe('the size', () => {
  it.each(SIZES)(
    'pads %s halves as the page does',
    async (size, leading, closed, open) => {
      await renderSplit({ size })

      expect(paddingsOf(action())).toEqual(leading)
      expect(paddingsOf(trigger())).toEqual(closed)

      await fireEvent.press(trigger(), PRESS)

      expect(paddingsOf(trigger())).toEqual([open, open])
      expect(paddingsOf(action())).toEqual(leading)
    },
  )

  it.each(SIZES)(
    'draws the chevron of a %s trigger at its icon size',
    async (size, _leading, _closed, _open, chevron) => {
      await renderSplit({ size })

      expect(chevronSize(trigger())).toEqual([chevron, chevron])
    },
  )

  it('hands its size to both halves, as heights', async () => {
    await renderSplit({ size: 'lg' })

    expect(styleOf(action()).minHeight).toBe(sizing.controlLg)
    expect(styleOf(trigger()).minHeight).toBe(sizing.controlLg)
  })
})

describe('the corners', () => {
  it.each(CORNERS)(
    'rounds the ends of %s halves and gives the edges between them %ddp',
    async (size, inner) => {
      await renderSplit({ size })
      const round = sizing[HEIGHTS[size]] / 2

      expect(cornersOf(action())).toMatchObject({
        end: [inner, inner],
        start: [round, round],
      })
      expect(cornersOf(trigger())).toMatchObject({
        end: [round, round],
        start: [inner, inner],
      })
    },
  )

  it.each(CORNERS)(
    'opens a hovered %s half out from %ddp to %ddp',
    async (size, inner, active) => {
      await renderSplit({ size })

      await fireEvent(action(), 'hoverIn', {})
      await advance(motion.durationShort2)

      expect(cornersOf(action()).end).toEqual([active, active])
      expect(cornersOf(trigger()).start).toEqual([inner, inner])

      await fireEvent(action(), 'hoverOut', {})
      await fireEvent(trigger(), 'hoverIn', {})
      await advance(motion.durationShort2)

      expect(cornersOf(action()).end).toEqual([inner, inner])
      expect(cornersOf(trigger()).start).toEqual([active, active])
    },
  )

  it('opens a half out while its focus ring shows', async () => {
    await renderSplit()

    await fireEvent(action(), 'focus', {})
    await advance(motion.durationShort2)

    expect(cornersOf(action()).end).toEqual([radii.md, radii.md])

    await fireEvent(action(), 'blur', {})
    await advance(motion.durationShort2)

    expect(cornersOf(action()).end).toEqual([radii.xs, radii.xs])
  })

  it('opens a half out while it is pressed, rather than tightening it', async () => {
    await renderSplit()

    await fireEvent(action(), 'pressIn', PRESS)
    await advance(motion.durationShort2)

    expect(cornersOf(action())).toMatchObject({
      end: [radii.md, radii.md],
      start: [sizing.controlSm / 2, sizing.controlSm / 2],
    })
  })

  it("rounds off the trigger's inner corner while the menu is open", async () => {
    await renderSplit()
    const round = sizing.controlSm / 2

    await fireEvent.press(trigger(), PRESS)
    await advance(motion.durationShort2)

    expect(cornersOf(trigger())).toMatchObject({
      end: [round, round],
      start: [round, round],
    })
    expect(cornersOf(action()).end).toEqual([radii.xs, radii.xs])
  })

  // Start and end rather than left and right, which is what turns the round
  // ends over with the layout's direction.
  it('keeps the round ends at the outer edges, whichever way the layout runs', async () => {
    await renderSplit()

    expect(cornersOf(action())).toMatchObject({
      left: [undefined, undefined],
      right: [undefined, undefined],
      round: undefined,
    })
  })

  it('sets the physical corners on web, the action on the left', async () => {
    jest.replaceProperty(Platform, 'OS', 'web')
    await renderSplit()
    const round = sizing.controlSm / 2

    expect(cornersOf(action())).toMatchObject({
      end: [undefined, undefined],
      left: [round, round],
      right: [radii.xs, radii.xs],
      start: [undefined, undefined],
    })
    expect(cornersOf(trigger())).toMatchObject({
      left: [radii.xs, radii.xs],
      right: [round, round],
    })
  })
})

describe('the colours', () => {
  it.each(VARIANTS)(
    'draws both halves on the %s container',
    async (variant, container) => {
      await renderSplit({ variant })

      expect(styleOf(action())).toMatchObject(container)
      expect(styleOf(trigger())).toMatchObject(container)
    },
  )

  it('lays the pressed layer over the trigger while the menu is open', async () => {
    await renderSplit()

    expect(styleOf(layerOf(trigger())).opacity).toBe(0)

    await fireEvent.press(trigger(), PRESS)

    expect(styleOf(layerOf(trigger())).opacity).toBe(stateLayerOpacity.pressed)
    expect(styleOf(layerOf(action())).opacity).toBe(0)
  })
})
