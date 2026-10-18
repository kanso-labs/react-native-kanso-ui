import type { ComponentRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { Color } from 'react-stately'
import type { TestInstance } from 'test-renderer'

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { DeviceEventEmitter, I18nManager, StyleSheet, View } from 'react-native'
import { State } from 'react-native-gesture-handler'
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils'
import { parseColor } from 'react-stately'

import { ColorWheel } from '.'
import { I18nProvider } from '../../i18n/provider'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const { colors, shadows, stateLayerOpacity } = theme

const BLUE = 'hsl(200, 100%, 50%)'
// Hue at six o'clock, where the handle sits straight below the centre.
const DOWN = 'hsl(90, 100%, 50%)'

// A style a call site hands the wheel.
const SPACED = { marginTop: 8 }

// What Gesture Handler's helpers find a wheel's gestures by.
const TEST_ID = 'wheel'

// Where a press on the default wheel lands at each hour of the clock, on
// the middle of the band: 92dp out from the centre at 100, 100.
const THREE = [192, 100] as const
const SIX = [100, 192] as const
const NINE = [8, 100] as const
const TWELVE = [100, 8] as const

// Asks the handle for an action, as a screen reader does.
async function ask(actionName: string) {
  await fireEvent(screen.getByRole('slider'), 'accessibilityAction', {
    nativeEvent: { actionName },
  })
}

// What a colour comes to, from the integer svg packs it in.
function decode(value: number) {
  const packed = value >>> 0
  return `rgb(${(packed >>> 16) & 255}, ${(packed >>> 8) & 255}, ${packed & 255})`
}

async function drag(...along: (readonly [number, number])[]) {
  const [first = [0, 0]] = along
  const last = along.at(-1) ?? first
  await act(() => {
    fireGestureHandler(getByGestureTestId(`${TEST_ID}-pan`), [
      { state: State.BEGAN, x: first[0], y: first[1] },
      ...along.map(([x, y]) => ({ state: State.ACTIVE, x, y })),
      { state: State.END, x: last[0], y: last[1] },
    ])
  })
}

// A slice's colour, from the fill svg packs it in.
function fillOf(element: { props: { fill?: { payload?: number } } }) {
  return decode(element.props.fill?.payload ?? 0)
}

// The angle and the distance of a point from the centre of a wheel of
// `outer` radius, in React Aria's degrees: 0° at three o'clock, clockwise.
function from(outer: number, across: number, down: number) {
  const x = across - outer
  const y = down - outer
  return {
    degrees: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
    distance: Math.hypot(x, y),
  }
}

// A slice's outline, read off its path: where it starts and ends round the
// wheel, and how far out its outer and inner edges are.
function geometryOf(element: { props: { d?: string } }, outer = 100) {
  const numbers = (element.props.d ?? '').match(/-?[\d.]+/g)?.map(Number) ?? []
  const at = (index: number) => numbers[index] ?? Number.NaN
  // M x y A r r 0 0 1 x y L x y A r r 0 0 0 x y
  const start = from(outer, at(0), at(1))
  const end = from(outer, at(7), at(8))
  const innerEnd = from(outer, at(9), at(10))
  const innerStart = from(outer, at(16), at(17))
  return {
    end: end.degrees,
    inner: [at(11), innerEnd.distance, innerStart.distance],
    outer: [at(2), start.distance, end.distance],
    start: start.degrees,
  }
}

// The handle's hairline, inside the frame a screen reader adjusts.
function hairline() {
  const found = screen
    .getByTestId(TEST_ID)
    .queryAll((each) => styleOf(each).borderColor === colors.outline)
    .at(0)
  if (found === undefined) {
    throw new TypeError('expected a handle')
  }
  return found
}

// A pan held part of the way, which a test can look at before it ends.
function heldDrag() {
  const { handlerTag } = getByGestureTestId(`${TEST_ID}-pan`)
  const send = async (event: object) => {
    await act(() => {
      DeviceEventEmitter.emit('onGestureHandlerStateChange', {
        handlerTag,
        ...event,
      })
    })
  }

  return {
    begin: async (x: number, y: number) => {
      await send({ oldState: State.UNDETERMINED, state: State.BEGAN, x, y })
      await send({ oldState: State.BEGAN, state: State.ACTIVE, x, y })
    },
    end: async (x: number, y: number) => {
      await send({ oldState: State.ACTIVE, state: State.END, x, y })
    },
  }
}

function hue() {
  return screen.getByRole('slider').props['aria-valuenow'] as unknown
}

function ring() {
  const found = views(hairline()).at(0)
  if (found === undefined) {
    throw new TypeError('expected a ring')
  }
  return found
}

function slice(degrees: number) {
  const found = slices().at(degrees)
  if (found === undefined) {
    throw new TypeError(`expected a slice at ${degrees}°`)
  }
  return found
}

function slices() {
  return screen
    .getByTestId(TEST_ID)
    .queryAll((each) => each.type === 'RNSVGPath')
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

async function tap(x: number, y: number) {
  await act(() => {
    fireGestureHandler(getByGestureTestId(`${TEST_ID}-tap`), [
      { state: State.BEGAN, x, y },
      { state: State.ACTIVE, x, y },
      { state: State.END, x, y },
    ])
  })
}

// The handle's view, inside the frame a screen reader adjusts.
function thumb() {
  const found = views(screen.getByRole('slider')).at(0)
  if (found === undefined) {
    throw new TypeError('expected a handle')
  }
  return found
}

function views(element: TestInstance) {
  return element.children.filter(
    (each): each is TestInstance => typeof each !== 'string',
  )
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('ColorWheel', () => {
  describe('the ring', () => {
    it('is twice its outer radius across', async () => {
      await render(<ColorWheel defaultValue={BLUE} testID={TEST_ID} />)

      expect(styleOf(screen.getByTestId(TEST_ID))).toStrictEqual({
        boxSizing: 'border-box',
        height: 200,
        width: 200,
      })
    })

    it('is a slice per degree, each in its own hue', async () => {
      await render(<ColorWheel defaultValue={BLUE} testID={TEST_ID} />)

      expect(slices()).toHaveLength(360)
      expect(fillOf(slice(0))).toBe('rgb(255, 0, 0)')
      expect(fillOf(slice(90))).toBe('rgb(128, 255, 0)')
      expect(fillOf(slice(200))).toBe('rgb(0, 170, 255)')
      expect(fillOf(slice(359))).toBe('rgb(255, 0, 4)')
    })

    it('runs hue clockwise from three o’clock, each slice centred on its degree', async () => {
      await render(<ColorWheel defaultValue={BLUE} testID={TEST_ID} />)

      const six = geometryOf(slice(90))
      expect(six.start).toBeCloseTo(89.5)
      expect(six.end).toBeCloseTo(91)
      expect(geometryOf(slice(270)).start).toBeCloseTo(269.5)
    })

    it('lets each slice reach past where the next begins, so no seam shows', async () => {
      await render(<ColorWheel defaultValue={BLUE} testID={TEST_ID} />)

      for (const degrees of [0, 89, 180, 358]) {
        expect(geometryOf(slice(degrees)).end).toBeGreaterThan(
          geometryOf(slice(degrees + 1)).start,
        )
      }
    })

    it('draws the band alone, and leaves the middle empty', async () => {
      await render(<ColorWheel defaultValue={BLUE} testID={TEST_ID} />)

      const drawn = screen
        .getByTestId(TEST_ID)
        .queryAll(
          (each) =>
            each.type.startsWith('RNSVG') &&
            each.type !== 'RNSVGSvgView' &&
            each.type !== 'RNSVGSvgViewAndroid' &&
            each.type !== 'RNSVGGroup',
        )
      expect(drawn.every((each) => each.type === 'RNSVGPath')).toBe(true)
      expect(drawn).toHaveLength(360)
      for (const degrees of [0, 123, 300]) {
        const { inner, outer } = geometryOf(slice(degrees))
        for (const radius of outer) {
          expect(radius).toBeCloseTo(100, 2)
        }
        for (const radius of inner) {
          expect(radius).toBeCloseTo(84, 2)
        }
      }
    })

    it('takes its hole from the thickness, so the two cannot disagree', async () => {
      const { rerender } = await render(
        <ColorWheel defaultValue={BLUE} testID={TEST_ID} thickness={8} />,
      )

      expect(geometryOf(slice(10)).inner.at(0)).toBe(92)

      await rerender(
        <ColorWheel defaultValue={BLUE} testID={TEST_ID} thickness={40} />,
      )

      expect(geometryOf(slice(10)).inner.at(0)).toBe(60)
    })

    it('leaves no hole at all when the band is wider than the wheel', async () => {
      await render(
        <ColorWheel
          defaultValue={DOWN}
          outerRadius={50}
          testID={TEST_ID}
          thickness={200}
        />,
      )

      const { inner, outer } = geometryOf(slice(10), 50)
      expect(outer.at(0)).toBe(50)
      expect(inner.at(0)).toBe(0)
      for (const radius of inner.slice(1)) {
        expect(radius).toBeCloseTo(0, 2)
      }
      // The handle rides the band's middle, halfway out.
      expect(styleOf(screen.getByRole('slider')).top).toBeCloseTo(75)
    })

    it('is sized by how far the ring reaches', async () => {
      await render(
        <ColorWheel defaultValue={BLUE} outerRadius={60} testID={TEST_ID} />,
      )

      expect(styleOf(screen.getByTestId(TEST_ID))).toMatchObject({
        height: 120,
        width: 120,
      })
      expect(geometryOf(slice(10), 60).outer.at(0)).toBe(60)
      expect(geometryOf(slice(10), 60).inner.at(0)).toBe(44)
    })
  })

  describe('the handle', () => {
    it('sits on the middle of the band, at its hue', async () => {
      await render(<ColorWheel defaultValue={DOWN} testID={TEST_ID} />)

      const seat = styleOf(screen.getByRole('slider'))
      expect(seat).toMatchObject({
        alignItems: 'center',
        height: 48,
        justifyContent: 'center',
        marginStart: -24,
        marginTop: -24,
        position: 'absolute',
        width: 48,
      })
      // Halfway between the 84dp hole and the 100dp edge, below the centre.
      expect(seat.start).toBeCloseTo(100)
      expect(seat.top).toBeCloseTo(192)
    })

    it('follows the band when the band moves', async () => {
      await render(
        <ColorWheel defaultValue={DOWN} testID={TEST_ID} thickness={40} />,
      )

      // Halfway between a 60dp hole and the 100dp edge.
      expect(styleOf(screen.getByRole('slider')).top).toBeCloseTo(180)
    })

    it('stays at its hue right to left, since a ring has no reading direction', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(
        <ColorWheel defaultValue="hsl(0, 100%, 50%)" testID={TEST_ID} />,
      )

      // `start` measures from the right here, so three o'clock is 8dp in.
      expect(styleOf(screen.getByRole('slider')).start).toBeCloseTo(8)
    })

    it('carries the hue it sits on, at full strength, in the slider’s ring', async () => {
      await render(
        <ColorWheel defaultValue="hsla(200, 40%, 30%, 0.5)" testID={TEST_ID} />,
      )

      expect(styleOf(ring()).backgroundColor).toBe('hsla(200, 100%, 50%, 1)')
      expect(styleOf(ring())).toMatchObject({
        borderColor: colors.surface,
        borderWidth: 2,
      })
      expect(styleOf(hairline())).toMatchObject({ borderWidth: 1, width: 26 })
      expect(styleOf(thumb()).pointerEvents).toBe('none')
    })

    it('lifts while it is dragged, and settles when it is let go', async () => {
      await render(<ColorWheel defaultValue={BLUE} testID={TEST_ID} />)

      expect(styleOf(hairline()).boxShadow).toBeUndefined()

      const held = heldDrag()
      await held.begin(...THREE)

      expect(styleOf(hairline()).boxShadow).toBe(shadows.elevation2)

      await held.end(...THREE)

      expect(styleOf(hairline()).boxShadow).toBeUndefined()
    })

    it('stays down for a drag that begins in the hole', async () => {
      await render(<ColorWheel defaultValue={BLUE} testID={TEST_ID} />)

      const held = heldDrag()
      await held.begin(100, 100)

      expect(styleOf(hairline()).boxShadow).toBeUndefined()

      await held.end(100, 100)
    })
  })

  describe('to a screen reader', () => {
    it('is an adjustable handle named for hue, with its range and value', async () => {
      await render(<ColorWheel defaultValue={BLUE} />)

      const handle = screen.getByRole('slider', { name: 'Hue' })
      expect(handle).toHaveAccessibilityValue({
        max: 360,
        min: 0,
        now: 200,
        text: '200°, cyan blue',
      })
      expect(handle.props).toMatchObject({
        accessibilityActions: [{ name: 'increment' }, { name: 'decrement' }],
        accessible: true,
      })
    })

    it('takes aria-label in place of the channel’s name', async () => {
      await render(<ColorWheel aria-label="Label" defaultValue={BLUE} />)

      expect(screen.getByRole('slider', { name: 'Label' })).toBeOnTheScreen()
    })

    it('speaks the provider’s locale', async () => {
      await render(
        <I18nProvider locale="pt-BR">
          <ColorWheel defaultValue={BLUE} />
        </I18nProvider>,
      )

      expect(
        screen.getByRole('slider', { name: 'Matiz' }),
      ).toHaveAccessibilityValue({ text: '200 °, azul-ciano' })
    })

    it('steps a degree, and ends the change once a step', async () => {
      const onChangeEnd = jest.fn<(value: Color) => void>()
      await render(<ColorWheel defaultValue={BLUE} onChangeEnd={onChangeEnd} />)

      await ask('increment')

      expect(hue()).toBe(201)
      expect(onChangeEnd).toHaveBeenCalledTimes(1)

      await ask('decrement')
      await ask('decrement')

      expect(hue()).toBe(199)
      expect(onChangeEnd).toHaveBeenCalledTimes(3)
    })

    it('steps past 360 back to 0, and below 0 round to 359', async () => {
      await render(<ColorWheel defaultValue="hsl(359, 100%, 50%)" />)

      await ask('increment')

      expect(hue()).toBe(0)

      await ask('decrement')

      expect(hue()).toBe(359)
    })

    it('ignores an action it does not know', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      await render(<ColorWheel defaultValue={BLUE} onChange={onChange} />)

      await ask('activate')

      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('its state', () => {
    it('starts at red when it is given no colour', async () => {
      await render(<ColorWheel />)

      expect(hue()).toBe(0)
    })

    it('takes a hex value, since a wheel names no channel', async () => {
      await render(<ColorWheel defaultValue="#6750A4" />)

      expect(screen.getByRole('slider').props['aria-valuetext']).toContain(
        '256',
      )
    })

    it('sets the hue from the angle of a press on the ring', async () => {
      const onChangeEnd = jest.fn<(value: Color) => void>()
      await render(
        <ColorWheel
          defaultValue={BLUE}
          onChangeEnd={onChangeEnd}
          testID={TEST_ID}
        />,
      )

      await tap(...SIX)

      expect(hue()).toBe(90)
      expect(onChangeEnd).toHaveBeenCalledTimes(1)
      expect(onChangeEnd.mock.calls.at(-1)?.[0].getChannelValue('hue')).toBe(90)

      await tap(...NINE)

      expect(hue()).toBe(180)

      await tap(...TWELVE)

      expect(hue()).toBe(270)

      await tap(...THREE)

      expect(hue()).toBe(0)
    })

    it('counts a press across the 48dp target, and none past it', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      await render(
        <ColorWheel defaultValue={BLUE} onChange={onChange} testID={TEST_ID} />,
      )

      // 26dp in from the band's middle, in the hole.
      await tap(100, 166)
      // In a corner, past the edge of the ring.
      await tap(4, 4)

      expect(onChange).not.toHaveBeenCalled()

      // 22dp in, inside the target's half of 24.
      await tap(100, 170)

      expect(hue()).toBe(90)
    })

    it('counts a press anywhere on a band wider than the target', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      await render(
        <ColorWheel
          defaultValue={BLUE}
          onChange={onChange}
          testID={TEST_ID}
          thickness={80}
        />,
      )

      // 25dp from the centre, the band's inner edge at 20dp.
      await tap(100, 125)

      expect(hue()).toBe(90)
    })

    it('takes nothing from the very centre, which has no angle', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      await render(
        <ColorWheel
          defaultValue={BLUE}
          onChange={onChange}
          outerRadius={20}
          testID={TEST_ID}
        />,
      )

      await tap(20, 20)

      expect(onChange).not.toHaveBeenCalled()
    })

    it('follows a drag round the ring, and ends the change once it lets go', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      const onChangeEnd = jest.fn<(value: Color) => void>()
      await render(
        <ColorWheel
          defaultValue={BLUE}
          onChange={onChange}
          onChangeEnd={onChangeEnd}
          testID={TEST_ID}
        />,
      )

      await drag(THREE, SIX, NINE)

      expect(
        onChange.mock.calls.map(([color]) => color.getChannelValue('hue')),
      ).toStrictEqual([0, 90, 180])
      expect(onChangeEnd).toHaveBeenCalledTimes(1)
      expect(hue()).toBe(180)
    })

    it('tells a drag from a press by Gesture Handler’s own distance', async () => {
      await render(<ColorWheel defaultValue={BLUE} testID={TEST_ID} />)

      expect(getByGestureTestId(`${TEST_ID}-pan`).config).toMatchObject({
        minDist: 10,
      })
      expect(getByGestureTestId(`${TEST_ID}-tap`).config).toMatchObject({
        maxDist: 10,
      })
    })

    it('keeps following once a drag leaves the ring', async () => {
      await render(<ColorWheel defaultValue={BLUE} testID={TEST_ID} />)

      await drag(THREE, [100, 130])

      expect(hue()).toBe(90)
    })

    it('takes no drag that begins in the hole', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      const onChangeEnd = jest.fn<(value: Color) => void>()
      await render(
        <ColorWheel
          defaultValue={BLUE}
          onChange={onChange}
          onChangeEnd={onChangeEnd}
          testID={TEST_ID}
        />,
      )

      await drag([100, 150], SIX, NINE)

      expect(onChange).not.toHaveBeenCalled()
      expect(onChangeEnd).not.toHaveBeenCalled()
    })

    it('follows a value the call site holds', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      const { rerender } = await render(
        <ColorWheel onChange={onChange} value={BLUE} />,
      )

      await ask('increment')

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(hue()).toBe(200)

      await rerender(
        <ColorWheel
          onChange={onChange}
          value={parseColor('hsl(120, 100%, 50%)')}
        />,
      )

      expect(hue()).toBe(120)
    })

    it('fades the wheel while disabled, and takes nothing', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      await render(
        <ColorWheel
          defaultValue={BLUE}
          isDisabled
          onChange={onChange}
          testID={TEST_ID}
        />,
      )

      expect(styleOf(screen.getByTestId(TEST_ID))).toMatchObject({
        opacity: stateLayerOpacity.disabledContent,
      })
      expect(screen.getByRole('slider')).toBeDisabled()
      expect(getByGestureTestId(`${TEST_ID}-pan`).config).toMatchObject({
        enabled: false,
      })
      expect(getByGestureTestId(`${TEST_ID}-tap`).config).toMatchObject({
        enabled: false,
      })

      await ask('increment')
      await ask('decrement')

      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('the call site', () => {
    it('lands style, ref and testID on the wheel', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        <ColorWheel
          defaultValue={BLUE}
          ref={ref}
          style={SPACED}
          testID={TEST_ID}
        />,
      )

      expect(styleOf(screen.getByTestId(TEST_ID))).toMatchObject({
        marginTop: 8,
        width: 200,
      })
      expect(ref.current).not.toBeNull()
    })
  })
})
