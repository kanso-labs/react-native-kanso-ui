import type { ComponentRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { TestNode } from 'test-renderer'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { DeviceEventEmitter, I18nManager, StyleSheet, View } from 'react-native'
import { State } from 'react-native-gesture-handler'
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { SliderSize } from '.'

import { Slider } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { I18nProvider } from '../../i18n/provider'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

// What the next slider the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

const { theme } = scopeFor('light', {})
const { colors, motion, radii, spacing, stateLayerOpacity, typography } = theme

const DISABLED_CONTENT = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContent,
)
const DISABLED_CONTAINER = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContainer,
)

// The track's length in every test that lays it out, so a press's place
// reads as a share of a hundred: 4dp a step.
const LENGTH = 400
const VERTICAL_LENGTH = 240

// Across the strip, where a press lands: inside the handle's 44dp.
const ACROSS = 20

// One frame at sixty a second.
const FRAME = 16

// Hoisted so each is one stable value per render, which is what react-perf's
// rules are after: two ranges, two handles a step apart, the names of a
// range's handles, a format, and two styles from outside.
const RANGE = [20, 60]
const WIDE = [20, 80]
const NEAR = [50, 60]
const THUMB_LABELS = ['Start', 'End']
const PERCENT: Intl.NumberFormatOptions = { style: 'percent' }
const OFFSET = { marginTop: 4 }
const SHORTER = { height: 160 }

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// The view a press is read along, which is the one the track's length is
// measured on.
function area() {
  const found = findAll(screen.getByTestId('slider'), (node) =>
    Boolean(node.props.onLayout),
  )
  if (found.length !== 1) {
    throw new TypeError('expected one measured view')
  }
  return child(found.at(0))
}

// Asks a handle for an action, as a screen reader does.
async function ask(actionName: string, index = 0) {
  await fireEvent(
    child(screen.getAllByRole('slider').at(index)),
    'accessibilityAction',
    { nativeEvent: { actionName } },
  )
}

function child(element: null | TestNode | undefined) {
  if (
    element === null ||
    element === undefined ||
    typeof element === 'string'
  ) {
    throw new TypeError('expected a view')
  }
  return element
}

// A pan carried through to its end with Gesture Handler's own helper: begun
// at the first place, moved through the rest, and let go at the last.
async function drag(...along: number[]) {
  const [first = 0] = along
  const last = along.at(-1) ?? first
  await act(() => {
    fireGestureHandler(getByGestureTestId('slider-pan'), [
      { state: State.BEGAN, x: first, y: ACROSS },
      ...along.map((x) => ({ state: State.ACTIVE, x, y: ACROSS })),
      { state: State.END, x: last, y: ACROSS },
    ])
  })
}

function findAll(
  node: TestNode,
  matches: (node: Exclude<TestNode, string>) => boolean,
): Exclude<TestNode, string>[] {
  if (typeof node === 'string') {
    return []
  }
  return [
    ...(matches(node) ? [node] : []),
    ...node.children.flatMap((each) => findAll(each, matches)),
  ]
}

// The handle's own view inside its frame.
function handleOf(index = 0) {
  return child(child(screen.getAllByRole('slider').at(index)).children.at(0))
}

// A pan a test can look at before it ends. `fireGestureHandler` carries a
// gesture through to its end in one call, so these send the same events one
// at a time, on the channel the helper sends a gesture's events on, with a
// frame between each as a device has.
function heldDrag() {
  const { handlerTag } = getByGestureTestId('slider-pan')
  const send = async (name: string, event: object) => {
    await act(() => {
      DeviceEventEmitter.emit(name, { handlerTag, ...event })
    })
    await advance(FRAME)
  }
  let at: number | undefined

  return {
    begin: async (x: number) => {
      await send('onGestureHandlerStateChange', {
        oldState: State.UNDETERMINED,
        state: State.BEGAN,
        x,
        y: ACROSS,
      })
    },
    end: async () => {
      await send('onGestureHandlerStateChange', {
        oldState: State.ACTIVE,
        state: State.END,
        x: at,
        y: ACROSS,
      })
    },
    move: async (x: number) => {
      const started = at !== undefined
      at = x
      await (started
        ? send('onGestureHandlerEvent', { state: State.ACTIVE, x, y: ACROSS })
        : send('onGestureHandlerStateChange', {
            oldState: State.BEGAN,
            state: State.ACTIVE,
            x,
            y: ACROSS,
          }))
    },
  }
}

// The value indicator above a dragged handle, if one is up.
function indicatorOf(index = 0) {
  const indicator = child(screen.getAllByRole('slider').at(index)).children.at(
    1,
  )
  return indicator === undefined ? undefined : child(indicator)
}

// The track laid out at a length along its axis.
async function layOut(length = LENGTH, vertical = false) {
  await fireEvent(area(), 'layout', {
    nativeEvent: {
      layout: {
        height: vertical ? length : 44,
        width: vertical ? 44 : length,
        x: 0,
        y: 0,
      },
    },
  })
}

// The track's parts, in order, with the handles' frames left out.
function partsOf() {
  return area()
    .children.map(child)
    .filter((each) => each.props.role !== 'slider')
}

// An icon that draws the slot it is handed, as an app's own icon reads it.
function Probe() {
  const { color, size } = useIconStyle()
  return <View style={probeOf(color, size)} testID="icon" />
}

function probeOf(color: unknown, size: number): ViewStyle {
  return { backgroundColor: String(color), height: size, width: size }
}

// The stops a part holds, which are every view in it.
function stopsIn(part: Exclude<TestNode, string>) {
  return part.children
    .map(child)
    .filter((each) => styleOf(each).width === 4)
    .map(styleOf)
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

async function tap(x: number, y = ACROSS) {
  await act(() => {
    fireGestureHandler(getByGestureTestId('slider-tap'), [
      { state: State.BEGAN, x, y },
      { state: State.ACTIVE, x, y },
      { state: State.END, x, y },
    ])
  })
}

const ICON = <Probe />

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  mockReducedMotion = false
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('Slider', () => {
  describe('semantics', () => {
    it('is an adjustable control named by its label, with its value', async () => {
      await render(<Slider defaultValue={40} label="Label" />)

      const handle = screen.getByRole('slider', { name: 'Label' })
      expect(handle).toHaveAccessibilityValue({
        max: 100,
        min: 0,
        now: 40,
        text: '40',
      })
      expect(handle.props.accessibilityActions).toStrictEqual([
        { name: 'increment' },
        { name: 'decrement' },
      ])
      expect(handle).not.toBeDisabled()
    })

    it('hides the label it draws, which every handle already says', async () => {
      await render(<Slider defaultValue={40} label="Label" />)

      const label = screen.getByText('Label', { includeHiddenElements: true })
      expect(label.props['aria-hidden']).toBe(true)
      expect(styleOf(label)).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.labelLargeSize,
      })
    })

    it('takes its name from aria-label when no label is drawn', async () => {
      await render(
        <Slider aria-label="Volume" defaultValue={40} testID="slider" />,
      )

      expect(screen.getByRole('slider', { name: 'Volume' })).toBeOnTheScreen()
      // Nothing above the track, not even an empty line taking the gap.
      expect(screen.getByTestId('slider').children).toHaveLength(1)
    })

    it("names a range's handles by their own labels, then the slider's", async () => {
      await render(
        <Slider
          defaultValue={RANGE}
          label="Label"
          thumbLabels={THUMB_LABELS}
        />,
      )

      // Each handle's bounds are its neighbour's value, so the two keep their
      // order, as React Aria's do.
      expect(
        screen.getByRole('slider', { name: 'Start Label' }),
      ).toHaveAccessibilityValue({ max: 60, min: 0, now: 20, text: '20' })
      expect(
        screen.getByRole('slider', { name: 'End Label' }),
      ).toHaveAccessibilityValue({ max: 100, min: 20, now: 60, text: '60' })
    })

    it('reads its value in the format and the locale it is given', async () => {
      await render(
        <I18nProvider locale="de-DE">
          <Slider
            defaultValue={0.4}
            formatOptions={PERCENT}
            label="Label"
            maxValue={1}
            step={0.01}
          />
        </I18nProvider>,
      )

      expect(screen.getByRole('slider')).toHaveAccessibilityValue({
        text: new Intl.NumberFormat('de-DE', { style: 'percent' }).format(0.4),
      })
    })

    it('is announced as disabled', async () => {
      await render(<Slider defaultValue={40} isDisabled label="Label" />)

      expect(screen.getByRole('slider')).toBeDisabled()
    })
  })

  describe('a screen reader', () => {
    it('moves a handle a step at a time, and ends each move', async () => {
      const onChange = jest.fn()
      const onChangeEnd = jest.fn()
      await render(
        <Slider
          defaultValue={40}
          label="Label"
          onChange={onChange}
          onChangeEnd={onChangeEnd}
          step={10}
        />,
      )

      await ask('increment')
      expect(screen.getByRole('slider')).toHaveAccessibilityValue({ now: 50 })
      expect(onChange.mock.calls).toStrictEqual([[50]])
      expect(onChangeEnd.mock.calls).toStrictEqual([[50]])

      await ask('decrement')
      await ask('decrement')
      expect(screen.getByRole('slider')).toHaveAccessibilityValue({ now: 30 })
      expect(onChange.mock.calls).toStrictEqual([[50], [40], [30]])
      expect(onChangeEnd.mock.calls).toStrictEqual([[50], [40], [30]])
    })

    it('stops at the ends', async () => {
      await render(
        <Slider defaultValue={99} label="Label" maxValue={100} step={1} />,
      )

      await ask('increment')
      await ask('increment')
      expect(screen.getByRole('slider')).toHaveAccessibilityValue({ now: 100 })
    })

    it("keeps a range's handles in order", async () => {
      const onChange = jest.fn()
      await render(
        <Slider
          defaultValue={NEAR}
          label="Label"
          onChange={onChange}
          step={10}
          thumbLabels={THUMB_LABELS}
        />,
      )

      await ask('increment', 0)
      await ask('increment', 0)
      expect(
        screen.getByRole('slider', { name: 'Start Label' }),
      ).toHaveAccessibilityValue({ now: 60 })
      expect(onChange.mock.calls).toStrictEqual([[[60, 60]]])
    })

    it('ignores an action it does not know', async () => {
      const onChange = jest.fn()
      const onChangeEnd = jest.fn()
      await render(
        <Slider
          defaultValue={40}
          label="Label"
          onChange={onChange}
          onChangeEnd={onChangeEnd}
        />,
      )

      await ask('activate')
      expect(onChange).not.toHaveBeenCalled()
      expect(onChangeEnd).not.toHaveBeenCalled()
    })

    it('moves nothing while disabled', async () => {
      const onChange = jest.fn()
      await render(
        <Slider
          defaultValue={40}
          isDisabled
          label="Label"
          onChange={onChange}
        />,
      )

      await ask('increment')
      expect(screen.getByRole('slider')).toHaveAccessibilityValue({ now: 40 })
      expect(onChange).not.toHaveBeenCalled()
    })

    it('leaves a held value where the call site holds it', async () => {
      const onChange = jest.fn()
      await render(<Slider label="Label" onChange={onChange} value={40} />)

      await ask('increment')
      expect(onChange.mock.calls).toStrictEqual([[41]])
      expect(screen.getByRole('slider')).toHaveAccessibilityValue({ now: 40 })
    })
  })

  describe('the track', () => {
    it('moves the handle to a press, and ends the move', async () => {
      const onChange = jest.fn()
      const onChangeEnd = jest.fn()
      await render(
        <Slider
          defaultValue={40}
          label="Label"
          onChange={onChange}
          onChangeEnd={onChangeEnd}
          testID="slider"
        />,
      )
      await layOut()

      await tap(300)
      expect(screen.getByRole('slider')).toHaveAccessibilityValue({ now: 75 })
      expect(onChange.mock.calls).toStrictEqual([[75]])
      expect(onChangeEnd.mock.calls).toStrictEqual([[75]])
    })

    it('lands a press on the nearest step', async () => {
      await render(
        <Slider defaultValue={40} label="Label" step={10} testID="slider" />,
      )
      await layOut()

      await tap(290)
      expect(screen.getByRole('slider')).toHaveAccessibilityValue({ now: 70 })
    })

    it('carries the handle along a drag, and ends it once on letting go', async () => {
      const onChange = jest.fn()
      const onChangeEnd = jest.fn()
      await render(
        <Slider
          defaultValue={40}
          label="Label"
          onChange={onChange}
          onChangeEnd={onChangeEnd}
          testID="slider"
        />,
      )
      await layOut()

      await drag(200, 240, 280)
      expect(onChange.mock.calls).toStrictEqual([[50], [60], [70]])
      expect(onChangeEnd.mock.calls).toStrictEqual([[70]])
    })

    it('stops a drag at the ends of the track', async () => {
      await render(<Slider defaultValue={40} label="Label" testID="slider" />)
      await layOut()

      await drag(200, -50)
      expect(screen.getByRole('slider')).toHaveAccessibilityValue({ now: 0 })
      await drag(200, LENGTH + 50)
      expect(screen.getByRole('slider')).toHaveAccessibilityValue({ now: 100 })
    })

    it("moves a range's nearest handle, the one past a press on a tie", async () => {
      const onChange = jest.fn()
      await render(
        <Slider
          defaultValue={RANGE}
          label="Label"
          onChange={onChange}
          testID="slider"
        />,
      )
      await layOut()

      await tap(300)
      await tap(100)
      // 50 is as near 25 as it is 75, so the handle past it moves.
      await tap(200)
      await tap(40)
      expect(onChange.mock.calls).toStrictEqual([
        [[20, 75]],
        [[25, 75]],
        [[25, 50]],
        [[10, 50]],
      ])
    })

    it("never carries a range's handle past the other", async () => {
      await render(
        <Slider
          defaultValue={RANGE}
          label="Label"
          testID="slider"
          thumbLabels={THUMB_LABELS}
        />,
      )
      await layOut()

      await drag(80, 360)
      expect(
        screen.getByRole('slider', { name: 'Start Label' }),
      ).toHaveAccessibilityValue({ now: 60 })
      expect(
        screen.getByRole('slider', { name: 'End Label' }),
      ).toHaveAccessibilityValue({ now: 60 })
    })

    it('reads a press from the right under a right-to-left layout', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(<Slider defaultValue={40} label="Label" testID="slider" />)
      await layOut()

      await tap(100)
      expect(screen.getByRole('slider')).toHaveAccessibilityValue({ now: 75 })
    })

    it('reads a vertical press from the bottom', async () => {
      await render(
        <Slider
          defaultValue={40}
          label="Label"
          orientation="vertical"
          testID="slider"
        />,
      )
      await layOut(VERTICAL_LENGTH, true)

      await tap(ACROSS, 60)
      expect(screen.getByRole('slider')).toHaveAccessibilityValue({ now: 75 })
    })

    it('reads no press before the track has a length', async () => {
      const onChange = jest.fn()
      await render(
        <Slider
          defaultValue={40}
          label="Label"
          onChange={onChange}
          testID="slider"
        />,
      )

      await tap(300)
      await drag(200, 300)
      expect(onChange).not.toHaveBeenCalled()
    })

    it('takes a drag along the track, and leaves one across it', async () => {
      await render(<Slider defaultValue={40} label="Label" testID="slider" />)

      expect(getByGestureTestId('slider-pan').config).toMatchObject({
        activeOffsetXEnd: 10,
        activeOffsetXStart: -10,
        enabled: true,
        failOffsetYEnd: 10,
        failOffsetYStart: -10,
      })
      expect(getByGestureTestId('slider-tap').config).toMatchObject({
        enabled: true,
        maxDist: 10,
      })
    })

    it('swaps the axes when vertical', async () => {
      await render(
        <Slider
          defaultValue={40}
          label="Label"
          orientation="vertical"
          testID="slider"
        />,
      )

      expect(getByGestureTestId('slider-pan').config).toMatchObject({
        activeOffsetYEnd: 10,
        activeOffsetYStart: -10,
        failOffsetXEnd: 10,
        failOffsetXStart: -10,
      })
    })

    it('takes no press while disabled', async () => {
      await render(
        <Slider defaultValue={40} isDisabled label="Label" testID="slider" />,
      )

      expect(getByGestureTestId('slider-pan').config).toMatchObject({
        enabled: false,
      })
      expect(getByGestureTestId('slider-tap').config).toMatchObject({
        enabled: false,
      })
    })

    it('registers its gestures under no test ID unless given one', async () => {
      await render(<Slider defaultValue={40} label="Label" />)

      expect(() => getByGestureTestId('undefined-pan')).toThrow(
        "Handler with id: 'undefined-pan' cannot be found",
      )
      expect(() => getByGestureTestId('undefined-tap')).toThrow(
        "Handler with id: 'undefined-tap' cannot be found",
      )
    })
  })

  describe('while dragged', () => {
    it('shows the value above the handle until it is let go', async () => {
      const onChangeEnd = jest.fn()
      await render(
        <Slider
          defaultValue={40}
          label="Label"
          onChangeEnd={onChangeEnd}
          testID="slider"
        />,
      )
      await layOut()
      expect(indicatorOf()).toBeUndefined()

      const held = heldDrag()
      await held.begin(160)
      await held.move(200)
      const indicator = indicatorOf()
      expect(indicator?.props['aria-hidden']).toBe(true)
      expect(
        screen.getByText('50', { includeHiddenElements: true }),
      ).toBeOnTheScreen()
      expect(onChangeEnd).not.toHaveBeenCalled()

      await held.move(240)
      expect(
        screen.getByText('60', { includeHiddenElements: true }),
      ).toBeOnTheScreen()

      await held.end()
      expect(indicatorOf()).toBeUndefined()
      expect(onChangeEnd.mock.calls).toStrictEqual([[60]])
    })

    it('draws the value on inverse surface, its gap above the handle', async () => {
      await render(<Slider defaultValue={40} label="Label" testID="slider" />)
      await layOut()

      const held = heldDrag()
      await held.begin(160)
      await held.move(200)
      const indicator = child(indicatorOf())
      expect(styleOf(indicator)).toMatchObject({
        backgroundColor: colors.inverseSurface,
        borderRadius: radii.pill,
        bottom: '100%',
        height: 44,
        marginBottom: spacing.md,
        minWidth: 48,
        paddingHorizontal: spacing.md,
        position: 'absolute',
      })
      const words = screen.getByText('50', { includeHiddenElements: true })
      expect(styleOf(words)).toMatchObject({
        color: colors.inverseOnSurface,
        fontSize: typography.labelLargeSize,
      })
      expect(words.props.numberOfLines).toBe(1)
      await held.end()
    })

    it('draws a vertical value to the start side of the handle', async () => {
      await render(
        <Slider
          defaultValue={40}
          label="Label"
          orientation="vertical"
          testID="slider"
        />,
      )
      await layOut(VERTICAL_LENGTH, true)

      const { handlerTag } = getByGestureTestId('slider-pan')
      const send = async (name: string, event: object) => {
        await act(() => {
          DeviceEventEmitter.emit(name, { handlerTag, ...event })
        })
      }
      await send('onGestureHandlerStateChange', {
        oldState: State.UNDETERMINED,
        state: State.BEGAN,
        x: ACROSS,
        y: 120,
      })
      await send('onGestureHandlerStateChange', {
        oldState: State.BEGAN,
        state: State.ACTIVE,
        x: ACROSS,
        y: 120,
      })
      const style = styleOf(child(indicatorOf()))
      expect(style).toMatchObject({
        end: '100%',
        marginBottom: 0,
        marginEnd: spacing.md,
      })
      expect(style.bottom).toBeUndefined()
      await send('onGestureHandlerStateChange', {
        oldState: State.ACTIVE,
        state: State.END,
        x: ACROSS,
        y: 120,
      })
    })

    it('narrows the handle to 2dp, and widens it again on letting go', async () => {
      await render(<Slider defaultValue={40} label="Label" testID="slider" />)
      await layOut()
      await advance(motion.durationShort2)
      expect(getAnimatedStyle(handleOf())).toMatchObject({ width: 4 })

      const held = heldDrag()
      await held.begin(160)
      await held.move(200)
      await advance(motion.durationShort2)
      expect(getAnimatedStyle(handleOf())).toMatchObject({ width: 2 })

      await held.end()
      await advance(motion.durationShort2)
      expect(getAnimatedStyle(handleOf())).toMatchObject({ width: 4 })
    })

    it('eases the narrowing rather than jumping', async () => {
      await render(<Slider defaultValue={40} label="Label" testID="slider" />)
      await layOut()

      const held = heldDrag()
      await held.begin(160)
      await held.move(200)
      const width = Number(getAnimatedStyle(handleOf()).width)
      expect(width).toBeGreaterThan(2)
      expect(width).toBeLessThan(4)
      await held.end()
    })

    it('narrows the handle at once under reduced motion', async () => {
      mockReducedMotion = true
      await render(<Slider defaultValue={40} label="Label" testID="slider" />)
      await layOut()

      const held = heldDrag()
      await held.begin(160)
      await held.move(200)
      expect(getAnimatedStyle(handleOf())).toMatchObject({ width: 2 })
      await held.end()
    })

    it('narrows a vertical handle along its height', async () => {
      await render(
        <Slider
          defaultValue={40}
          label="Label"
          orientation="vertical"
          testID="slider"
        />,
      )
      await advance(motion.durationShort2)

      expect(getAnimatedStyle(handleOf())).toMatchObject({ height: 4 })
      expect(styleOf(handleOf())).toMatchObject({ width: 44 })
    })
  })

  describe('the parts', () => {
    it('fills up to the handle in primary, and the rest in its container', async () => {
      await render(<Slider defaultValue={40} label="Label" testID="slider" />)

      const [active, after, extra] = partsOf()
      expect(extra).toBeUndefined()
      expect(styleOf(child(active))).toMatchObject({
        backgroundColor: colors.primary,
        borderBottomEndRadius: 2,
        borderRadius: radii.sm,
        borderTopEndRadius: 2,
        end: '60%',
        height: 16,
        marginEnd: 8,
        marginStart: 0,
        overflow: 'hidden',
        position: 'absolute',
        start: '0%',
        top: 14,
      })
      expect(styleOf(child(active)).borderTopStartRadius).toBeUndefined()
      expect(styleOf(child(after))).toMatchObject({
        backgroundColor: colors.secondaryContainer,
        borderBottomStartRadius: 2,
        borderTopStartRadius: 2,
        end: '0%',
        marginEnd: 0,
        marginStart: 8,
        start: '40%',
      })
      expect(styleOf(child(after)).borderTopEndRadius).toBeUndefined()
    })

    it('fills a range between its handles, clear of each', async () => {
      await render(
        <Slider defaultValue={RANGE} label="Label" testID="slider" />,
      )

      const [before, active, after] = partsOf().map(styleOf)
      expect(before).toMatchObject({
        backgroundColor: colors.secondaryContainer,
        borderTopEndRadius: 2,
        end: '80%',
        marginEnd: 8,
        start: '0%',
      })
      expect(active).toMatchObject({
        backgroundColor: colors.primary,
        borderTopEndRadius: 2,
        borderTopStartRadius: 2,
        end: '40%',
        marginEnd: 8,
        marginStart: 8,
        start: '20%',
      })
      expect(after).toMatchObject({
        backgroundColor: colors.secondaryContainer,
        marginStart: 8,
        start: '60%',
      })
    })

    it('greys every part and the handle out while disabled', async () => {
      await render(
        <Slider defaultValue={40} isDisabled label="Label" testID="slider" />,
      )

      const [active, after] = partsOf().map(styleOf)
      expect(active.backgroundColor).toBe(DISABLED_CONTENT)
      expect(after.backgroundColor).toBe(DISABLED_CONTAINER)
      expect(styleOf(handleOf()).backgroundColor).toBe(DISABLED_CONTENT)
    })

    it('draws the handle in primary, centred on the value', async () => {
      await render(<Slider defaultValue={40} label="Label" testID="slider" />)

      expect(styleOf(handleOf())).toMatchObject({
        backgroundColor: colors.primary,
        borderRadius: radii.pill,
        height: 44,
      })
      expect(styleOf(screen.getByRole('slider'))).toMatchObject({
        marginStart: -24,
        start: '40%',
        width: 48,
      })
    })

    it('runs a vertical track up from the bottom', async () => {
      await render(
        <Slider
          defaultValue={40}
          label="Label"
          orientation="vertical"
          testID="slider"
        />,
      )

      const [active, after] = partsOf().map(styleOf)
      expect(active).toMatchObject({
        borderTopEndRadius: 2,
        borderTopStartRadius: 2,
        bottom: '0%',
        marginBottom: 0,
        marginTop: 8,
        start: 14,
        top: '60%',
        width: 16,
      })
      expect(active.borderBottomStartRadius).toBeUndefined()
      expect(after).toMatchObject({
        borderBottomEndRadius: 2,
        borderBottomStartRadius: 2,
        bottom: '40%',
        marginBottom: 8,
        top: '0%',
      })
      expect(styleOf(screen.getByRole('slider'))).toMatchObject({
        bottom: '40%',
        height: 48,
        marginBottom: -24,
      })
      expect(styleOf(child(area().parent))).toMatchObject({
        flexGrow: 1,
        width: 44,
      })
    })

    it.each<[SliderSize, number, number, number]>([
      ['xs', 16, radii.sm, 44],
      ['sm', 24, radii.sm, 44],
      ['md', 40, radii.md, 52],
      ['lg', 56, radii.lg, 68],
      ['xl', 96, radii.xl, 108],
    ])(
      'draws %s with a %pdp track, a %pdp corner and a %pdp handle',
      async (size, track, corner, handle) => {
        await render(
          <Slider
            defaultValue={40}
            label="Label"
            size={size}
            testID="slider"
          />,
        )

        expect(styleOf(child(partsOf()[0]))).toMatchObject({
          borderRadius: corner,
          height: track,
          top: (handle - track) / 2,
        })
        expect(styleOf(handleOf())).toMatchObject({ height: handle })
        expect(styleOf(child(area().parent))).toMatchObject({ height: handle })
      },
    )
  })

  describe('the stops', () => {
    it('draws one stop at the inactive end, without the configuration', async () => {
      await render(<Slider defaultValue={40} label="Label" testID="slider" />)
      await layOut()

      const [active, after] = partsOf()
      expect(stopsIn(child(active))).toStrictEqual([])
      expect(stopsIn(child(after))).toStrictEqual([
        expect.objectContaining({
          backgroundColor: colors.onSecondaryContainer,
          borderRadius: radii.circle,
          end: 6,
          height: 4,
          position: 'absolute',
          top: 6,
        }),
      ])
    })

    it('draws a stop at every step, each in its part', async () => {
      await render(
        <Slider
          defaultValue={40}
          label="Label"
          showStops
          step={10}
          testID="slider"
        />,
      )
      await layOut()

      const [active, after] = partsOf()
      const onActive = stopsIn(child(active))
      expect(onActive.map((each) => each.start)).toStrictEqual([
        6, 38, 78, 118, 158,
      ])
      expect(
        onActive.every((each) => each.backgroundColor === colors.onPrimary),
      ).toBe(true)
      // The stop under the handle starts at 158, past where the part ends at
      // 152, so the part clips it away.
      expect(styleOf(child(active)).overflow).toBe('hidden')

      const onAfter = stopsIn(child(after))
      // Rounded, since a step's share of the track is a float.
      expect(
        onAfter.map((each) => Math.round(Number(each.start ?? each.end))),
      ).toStrictEqual([-10, 30, 70, 110, 150, 190, 6])
      expect(onAfter.at(-1)).toMatchObject({ end: 6 })
      expect(
        onAfter.every(
          (each) => each.backgroundColor === colors.onSecondaryContainer,
        ),
      ).toBe(true)
    })

    it('draws no step of its own for a step of zero', async () => {
      await render(
        <Slider
          defaultValue={40}
          label="Label"
          showStops
          step={0}
          testID="slider"
        />,
      )
      await layOut()

      const [active, after] = partsOf()
      expect(stopsIn(child(active))).toHaveLength(1)
      expect(stopsIn(child(after))).toHaveLength(1)
    })

    it('places the steps inside only once the track has a length', async () => {
      await render(
        <Slider
          defaultValue={40}
          label="Label"
          showStops
          step={10}
          testID="slider"
        />,
      )

      const [active, after] = partsOf()
      expect(stopsIn(child(active))).toStrictEqual([
        expect.objectContaining({ start: 6 }),
      ])
      expect(stopsIn(child(after))).toStrictEqual([
        expect.objectContaining({ end: 6 }),
      ])
    })

    it('greys the stops out while disabled', async () => {
      await render(
        <Slider
          defaultValue={40}
          isDisabled
          label="Label"
          showStops
          step={10}
          testID="slider"
        />,
      )
      await layOut()

      const [active, after] = partsOf()
      expect(
        stopsIn(child(active)).every(
          (each) => each.backgroundColor === colors.inverseOnSurface,
        ),
      ).toBe(true)
      expect(
        stopsIn(child(after)).every(
          (each) => each.backgroundColor === DISABLED_CONTENT,
        ),
      ).toBe(true)
    })

    it('runs the stops up a vertical track', async () => {
      await render(
        <Slider
          defaultValue={50}
          label="Label"
          orientation="vertical"
          showStops
          step={25}
          testID="slider"
        />,
      )
      await layOut(VERTICAL_LENGTH, true)

      const [active, after] = partsOf()
      expect(stopsIn(child(active))).toStrictEqual([
        expect.objectContaining({ bottom: 6, start: 6 }),
        expect.objectContaining({ bottom: 58, start: 6 }),
        expect.objectContaining({ bottom: 118, start: 6 }),
      ])
      expect(stopsIn(child(after))).toStrictEqual([
        expect.objectContaining({ bottom: -10 }),
        expect.objectContaining({ bottom: 50 }),
        expect.objectContaining({ start: 6, top: 6 }),
      ])
    })

    it("puts a range's start stop on the part before its first handle", async () => {
      await render(
        <Slider
          defaultValue={RANGE}
          label="Label"
          showStops
          step={10}
          testID="slider"
        />,
      )
      await layOut()

      const [before, active] = partsOf()
      expect(stopsIn(child(before))).toStrictEqual([
        expect.objectContaining({
          backgroundColor: colors.onSecondaryContainer,
          start: 6,
        }),
        expect.objectContaining({
          backgroundColor: colors.onSecondaryContainer,
          start: 38,
        }),
      ])
      const onActive = stopsIn(child(active))
      expect(onActive).toHaveLength(5)
      expect(
        onActive.every((each) => each.backgroundColor === colors.onPrimary),
      ).toBe(true)
    })
  })

  describe('the inset icon', () => {
    it('sits at the start of the active part from md, in on primary', async () => {
      await render(
        <Slider
          defaultValue={40}
          icon={ICON}
          label="Label"
          size="md"
          testID="slider"
        />,
      )
      await layOut()

      expect(styleOf(screen.getByTestId('icon'))).toStrictEqual({
        backgroundColor: colors.onPrimary,
        height: 24,
        width: 24,
      })
      expect(styleOf(child(screen.getByTestId('icon').parent))).toMatchObject({
        height: 24,
        position: 'absolute',
        start: 10,
        top: 8,
        width: 24,
      })
    })

    it('takes the larger icon at xl', async () => {
      await render(
        <Slider
          defaultValue={40}
          icon={ICON}
          label="Label"
          size="xl"
          testID="slider"
        />,
      )
      await layOut()

      expect(styleOf(screen.getByTestId('icon'))).toMatchObject({ width: 32 })
      expect(styleOf(child(screen.getByTestId('icon').parent))).toMatchObject({
        top: 32,
      })
    })

    it.each<SliderSize>(['xs', 'sm'])('draws none at %s', async (size) => {
      await render(
        <Slider
          defaultValue={40}
          icon={ICON}
          label="Label"
          size={size}
          testID="slider"
        />,
      )
      await layOut()

      expect(screen.queryByTestId('icon')).toBeNull()
    })

    it.each<[SliderSize, number, boolean]>([
      ['md', 13, true],
      ['md', 12, false],
      ['xl', 15, true],
      ['xl', 14, false],
    ])(
      'at %s and %p, draws it only with room on both sides: %p',
      async (size, value, drawn) => {
        await render(
          <Slider
            defaultValue={value}
            icon={ICON}
            label="Label"
            size={size}
            testID="slider"
          />,
        )
        await layOut()

        expect(screen.queryByTestId('icon') !== null).toBe(drawn)
      },
    )

    it('waits for the track to have a length', async () => {
      await render(
        <Slider
          defaultValue={40}
          icon={ICON}
          label="Label"
          size="md"
          testID="slider"
        />,
      )

      expect(screen.queryByTestId('icon')).toBeNull()
    })

    it('draws none on a range', async () => {
      await render(
        <Slider
          defaultValue={WIDE}
          icon={ICON}
          label="Label"
          size="md"
          testID="slider"
        />,
      )
      await layOut()

      expect(screen.queryByTestId('icon')).toBeNull()
    })

    it('sits at the foot of a vertical track', async () => {
      await render(
        <Slider
          defaultValue={50}
          icon={ICON}
          label="Label"
          orientation="vertical"
          size="md"
          testID="slider"
        />,
      )
      await layOut(VERTICAL_LENGTH, true)

      expect(styleOf(child(screen.getByTestId('icon').parent))).toMatchObject({
        bottom: 10,
        start: 8,
      })
    })

    it('takes inverse on surface while disabled', async () => {
      await render(
        <Slider
          defaultValue={40}
          icon={ICON}
          isDisabled
          label="Label"
          size="md"
          testID="slider"
        />,
      )
      await layOut()

      expect(styleOf(screen.getByTestId('icon'))).toMatchObject({
        backgroundColor: colors.inverseOnSurface,
      })
    })
  })

  describe('the call site', () => {
    it("lands style, ref and testID on the slider's own view", async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        <Slider
          defaultValue={40}
          label="Label"
          ref={ref}
          style={OFFSET}
          testID="slider"
        />,
      )

      const root = screen.getByTestId('slider')
      expect(styleOf(root)).toMatchObject({
        gap: spacing.xs,
        marginTop: 4,
        width: '100%',
      })
      expect(ref.current).not.toBeNull()
    })

    it('gives a vertical slider a height, which style replaces', async () => {
      await render(
        <Slider
          defaultValue={40}
          label="Label"
          orientation="vertical"
          testID="slider"
        />,
      )
      expect(styleOf(screen.getByTestId('slider'))).toMatchObject({
        height: 240,
      })

      await render(
        <Slider
          defaultValue={40}
          label="Label"
          orientation="vertical"
          style={SHORTER}
          testID="slider"
        />,
      )
      expect(styleOf(screen.getByTestId('slider'))).toMatchObject({
        height: 160,
      })
    })
  })
})
