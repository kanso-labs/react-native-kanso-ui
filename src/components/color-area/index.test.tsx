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

import { ColorArea } from '.'
import { I18nProvider } from '../../i18n/provider'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const { colors, radii, shadows, stateLayerOpacity } = theme

const BLUE = 'hsl(200, 100%, 50%)'
const MIDDLE = 'hsl(200, 50%, 50%)'
const TRANSLUCENT = 'hsla(200, 100%, 50%, 0.4)'

// The plane's side in every test that lays it out.
const SIDE = 200

// A style a call site hands the plane.
const NARROW = { width: 160 }

// What Gesture Handler's helpers find a plane's gestures by.
const TEST_ID = 'area'

type Paint = { readonly alpha: number; readonly rgb: string }

// The view a press is read across, which is the one the plane is measured on.
function area() {
  const found = screen
    .getByTestId(TEST_ID)
    .queryAll((each) => each.props.onLayout !== undefined)
    .at(0)
  if (found === undefined) {
    throw new TypeError('expected a measured view')
  }
  return found
}

// Asks a channel's half of the handle for an action, as a screen reader does.
async function ask(name: string, actionName: string) {
  await fireEvent(screen.getByRole('slider', { name }), 'accessibilityAction', {
    nativeEvent: { actionName },
  })
}

// What a colour comes to, from the integer svg packs it in.
function decode(value: number): Paint {
  const packed = value >>> 0
  return {
    alpha: Math.round(((packed >>> 24) / 255) * 100) / 100,
    rgb: `rgb(${(packed >>> 16) & 255}, ${(packed >>> 8) & 255}, ${packed & 255})`,
  }
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

// The handle's hairline, inside the frame the two halves share.
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

// The plane's layers, bottom first: a fill's colour, or a gradient's
// direction and stops, and whether a mask fades it in.
function layers() {
  const root = screen.getByTestId(TEST_ID)
  const gradients = new Map(
    root
      .queryAll((each) => each.type === 'RNSVGLinearGradient')
      .map((each) => [nameOf(each), each]),
  )
  const masks = new Set(
    root.queryAll((each) => each.type === 'RNSVGMask').map(nameOf),
  )
  return root
    .queryAll(
      (each) => each.type === 'RNSVGRect' && each.parent?.type !== 'RNSVGMask',
    )
    .map((rect) => {
      const { brushRef = '', mask, payload = 0 } = paintOf(rect)
      const gradient = gradients.get(brushRef)
      if (gradient === undefined) {
        return { fill: decode(payload) }
      }
      const { direction, stops } = stopsOf(gradient)
      return {
        direction,
        masked: mask !== undefined && masks.has(mask),
        stops,
      }
    })
}

async function layOut(width = SIDE, height = SIDE) {
  await fireEvent(area(), 'layout', {
    nativeEvent: { layout: { height, width, x: 0, y: 0 } },
  })
}

function nameOf(element: { props: { name?: string } }) {
  return element.props.name ?? ''
}

// What a shape is painted with: a gradient by its name, or a colour, and the
// mask it is drawn through.
function paintOf(element: {
  props: { fill?: { brushRef?: string; payload?: number }; mask?: string }
}) {
  return { ...element.props.fill, mask: element.props.mask }
}

// The view the plane is drawn in, clipped to its corner.
function plane() {
  const found = views(area()).at(0)
  if (found === undefined) {
    throw new TypeError('expected a plane')
  }
  return found
}

function ring() {
  const found = views(hairline()).at(0)
  if (found === undefined) {
    throw new TypeError('expected a ring')
  }
  return found
}

// The frame the handle and its two halves sit in.
function seat() {
  const found = views(area()).at(1)
  if (found === undefined) {
    throw new TypeError('expected a seat')
  }
  return found
}

function stopsOf(element: TestInstance) {
  const {
    gradient: packed = [],
    x1,
    x2,
    y1,
    y2,
  } = element.props as {
    gradient?: readonly number[]
    x1?: number
    x2?: number
    y1?: number
    y2?: number
  }
  const stops: { offset: number; paint: Paint }[] = []
  for (let index = 0; index < packed.length; index += 2) {
    stops.push({
      offset: packed[index] ?? Number.NaN,
      paint: decode(packed[index + 1] ?? 0),
    })
  }
  return { direction: [x1, y1, x2, y2], stops }
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

function views(element: TestInstance) {
  return element.children.filter(
    (each): each is TestInstance => typeof each !== 'string',
  )
}

const ACROSS = [0, 0, 1, 0]
const UP = [0, 1, 0, 0]

afterEach(() => {
  jest.restoreAllMocks()
})

describe('ColorArea', () => {
  describe('the plane', () => {
    it('is a square filling its width, cut to the small corner', async () => {
      await render(
        <ColorArea
          defaultValue={BLUE}
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )

      expect(styleOf(screen.getByTestId(TEST_ID))).toStrictEqual({
        aspectRatio: 1,
        boxSizing: 'border-box',
        width: '100%',
      })
      expect(styleOf(plane())).toMatchObject({
        borderRadius: radii.sm,
        overflow: 'hidden',
      })
    })

    it('lays lightness over saturation over the hue in HSL', async () => {
      await render(
        <ColorArea
          defaultValue={BLUE}
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )

      expect(layers()).toStrictEqual([
        { fill: { alpha: 1, rgb: 'rgb(0, 170, 255)' } },
        {
          direction: ACROSS,
          masked: false,
          stops: [
            { offset: 0, paint: { alpha: 1, rgb: 'rgb(128, 128, 128)' } },
            { offset: 1, paint: { alpha: 0, rgb: 'rgb(128, 128, 128)' } },
          ],
        },
        {
          direction: UP,
          masked: false,
          stops: [
            { offset: 0, paint: { alpha: 1, rgb: 'rgb(0, 0, 0)' } },
            { offset: 0.5, paint: { alpha: 0, rgb: 'rgb(0, 0, 0)' } },
            { offset: 0.5, paint: { alpha: 0, rgb: 'rgb(255, 255, 255)' } },
            { offset: 1, paint: { alpha: 1, rgb: 'rgb(255, 255, 255)' } },
          ],
        },
      ])
    })

    it('runs the hue through its primaries with no fill under it when hue is an axis', async () => {
      await render(
        <ColorArea
          defaultValue="hsl(200, 100%, 25%)"
          testID={TEST_ID}
          xChannel="hue"
          yChannel="saturation"
        />,
      )

      const drawn = layers()
      const hue = drawn.at(0)
      expect(drawn).toHaveLength(2)
      expect(hue).toMatchObject({ direction: ACROSS })
      expect((hue?.stops ?? []).map(({ offset }) => offset)).toStrictEqual(
        [0, 1, 2, 3, 4, 5, 6].map((step) => step / 6),
      )
      expect((hue?.stops ?? []).map(({ paint }) => paint.rgb)).toStrictEqual([
        'rgb(128, 0, 0)',
        'rgb(128, 128, 0)',
        'rgb(0, 128, 0)',
        'rgb(0, 128, 128)',
        'rgb(0, 0, 128)',
        'rgb(128, 0, 128)',
        'rgb(128, 0, 0)',
      ])
      expect(drawn.at(1)).toStrictEqual({
        direction: UP,
        masked: false,
        stops: [
          { offset: 0, paint: { alpha: 1, rgb: 'rgb(64, 64, 64)' } },
          { offset: 1, paint: { alpha: 0, rgb: 'rgb(64, 64, 64)' } },
        ],
      })
    })

    it('fades saturation from white and brightness from black in HSB', async () => {
      await render(
        <ColorArea
          defaultValue="hsb(200, 100%, 100%)"
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="brightness"
        />,
      )

      expect(layers()).toStrictEqual([
        { fill: { alpha: 1, rgb: 'rgb(0, 170, 255)' } },
        {
          direction: ACROSS,
          masked: false,
          stops: [
            { offset: 0, paint: { alpha: 1, rgb: 'rgb(255, 255, 255)' } },
            { offset: 1, paint: { alpha: 0, rgb: 'rgb(255, 255, 255)' } },
          ],
        },
        {
          direction: UP,
          masked: false,
          stops: [
            { offset: 0, paint: { alpha: 1, rgb: 'rgb(0, 0, 0)' } },
            { offset: 1, paint: { alpha: 0, rgb: 'rgb(0, 0, 0)' } },
          ],
        },
      ])
    })

    it('fades the row along the top in over the row along the bottom in RGB', async () => {
      await render(
        <ColorArea
          defaultValue="rgb(0, 170, 255)"
          testID={TEST_ID}
          xChannel="red"
          yChannel="green"
        />,
      )

      expect(layers()).toStrictEqual([
        {
          direction: ACROSS,
          masked: false,
          stops: [
            { offset: 0, paint: { alpha: 1, rgb: 'rgb(0, 0, 255)' } },
            { offset: 1, paint: { alpha: 1, rgb: 'rgb(255, 0, 255)' } },
          ],
        },
        {
          direction: ACROSS,
          masked: true,
          stops: [
            { offset: 0, paint: { alpha: 1, rgb: 'rgb(0, 255, 255)' } },
            { offset: 1, paint: { alpha: 1, rgb: 'rgb(255, 255, 255)' } },
          ],
        },
      ])

      const [rise] = screen
        .getByTestId(TEST_ID)
        .queryAll((each) => each.parent?.type === 'RNSVGMask')
        .map((each) => paintOf(each).brushRef)
      const fade = screen
        .getByTestId(TEST_ID)
        .queryAll(
          (each) =>
            each.type === 'RNSVGLinearGradient' && each.props.name === rise,
        )
        .at(0)
      expect(fade === undefined ? null : stopsOf(fade)).toStrictEqual({
        direction: UP,
        stops: [
          { offset: 0, paint: { alpha: 1, rgb: 'rgb(0, 0, 0)' } },
          { offset: 1, paint: { alpha: 1, rgb: 'rgb(255, 255, 255)' } },
        ],
      })
    })

    it('draws no mask where nothing rises', async () => {
      await render(
        <ColorArea
          defaultValue={BLUE}
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )

      expect(
        screen
          .getByTestId(TEST_ID)
          .queryAll((each) => each.type === 'RNSVGMask'),
      ).toHaveLength(0)
    })

    it('moves alpha in RGB without thinning the plane', async () => {
      await render(
        <ColorArea
          defaultValue="rgba(0, 170, 255, 0.6)"
          testID={TEST_ID}
          xChannel="red"
          yChannel="alpha"
        />,
      )

      const row = [
        { offset: 0, paint: { alpha: 1, rgb: 'rgb(0, 170, 0)' } },
        { offset: 1, paint: { alpha: 1, rgb: 'rgb(255, 170, 0)' } },
      ]
      expect(layers()).toStrictEqual([
        { direction: ACROSS, masked: false, stops: row },
        { direction: ACROSS, masked: true, stops: row },
      ])
      expect(styleOf(seat())).toMatchObject({ top: '40%' })
    })

    it('draws the two channels alpha is not, asked for alpha in HSL', async () => {
      const { rerender } = await render(
        <ColorArea
          defaultValue={BLUE}
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )
      const drawn = layers()

      await rerender(
        <ColorArea
          defaultValue={BLUE}
          key="alpha"
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="alpha"
        />,
      )

      expect(layers()).toStrictEqual(drawn)
    })

    it('runs the horizontal channel from the right under a right-to-left layout', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(
        <ColorArea
          defaultValue={BLUE}
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )

      expect(
        layers().map((layer) =>
          'direction' in layer ? layer.direction : null,
        ),
      ).toStrictEqual([null, [1, 0, 0, 0], UP])
    })

    it('throws for a channel the value’s space lacks, and converts with colorSpace', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(
        render(
          <ColorArea
            defaultValue="#6750A4"
            xChannel="saturation"
            yChannel="lightness"
          />,
        ),
      ).rejects.toThrow('Unknown color channel: saturation')

      await render(
        <ColorArea
          colorSpace="hsl"
          defaultValue="#6750A4"
          xChannel="saturation"
          yChannel="lightness"
        />,
      )

      expect(
        screen.getByRole('slider', { name: 'Saturation' }),
      ).toHaveAccessibilityValue({ now: 34.43 })
    })

    it('gives each plane’s gradients ids of their own', async () => {
      await render(
        <View>
          <ColorArea defaultValue="rgb(0, 170, 255)" testID={TEST_ID} />
          <ColorArea defaultValue="rgb(0, 170, 255)" />
        </View>,
      )

      const names =
        screen.root
          ?.queryAll(
            (each) =>
              each.type === 'RNSVGLinearGradient' || each.type === 'RNSVGMask',
          )
          .map((each) => each.props.name as unknown) ?? []
      expect(names).toHaveLength(8)
      expect(new Set(names).size).toBe(8)
    })
  })

  describe('the handle', () => {
    it('sits where the two channels meet, from the start and the top', async () => {
      await render(
        <ColorArea
          defaultValue="hsl(200, 40%, 75%)"
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )

      expect(styleOf(seat())).toMatchObject({
        alignItems: 'center',
        height: 48,
        justifyContent: 'center',
        marginStart: -24,
        marginTop: -24,
        position: 'absolute',
        start: '40%',
        top: '25%',
        width: 48,
      })
    })

    it('carries the colour opaque, and the ring the slider’s handle draws', async () => {
      await render(
        <ColorArea
          defaultValue={TRANSLUCENT}
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )

      expect(styleOf(ring()).backgroundColor).toBe('hsla(200, 100%, 50%, 1)')
      expect(styleOf(ring())).toMatchObject({
        borderColor: colors.surface,
        borderWidth: 2,
      })
      expect(styleOf(hairline())).toMatchObject({ borderWidth: 1, width: 26 })
    })

    it('lifts while it is dragged, and settles when it is let go', async () => {
      await render(
        <ColorArea
          defaultValue={BLUE}
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )
      await layOut()

      expect(styleOf(hairline()).boxShadow).toBeUndefined()

      const held = heldDrag()
      await held.begin(50, 50)

      expect(styleOf(hairline()).boxShadow).toBe(shadows.elevation2)

      await held.end(50, 50)

      expect(styleOf(hairline()).boxShadow).toBeUndefined()
    })
  })

  describe('to a screen reader', () => {
    it('is two adjustable halves, start then end, each named by its channel with its range', async () => {
      await render(
        <ColorArea
          defaultValue={BLUE}
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )

      const halves = views(seat())
      const first = halves.at(0)
      const second = halves.at(1)
      expect(first?.props['aria-label']).toBe('Saturation')
      expect(second?.props['aria-label']).toBe('Lightness')
      expect(first).toHaveAccessibilityValue({ max: 100, min: 0, now: 100 })
      expect(second).toHaveAccessibilityValue({ max: 100, min: 0, now: 50 })
      expect(first?.props.accessibilityActions).toStrictEqual([
        { name: 'increment' },
        { name: 'decrement' },
      ])
      expect(styleOf(first ?? { props: {} })).toStrictEqual({ flexGrow: 1 })
    })

    it('says each channel’s value and the colour’s name', async () => {
      await render(
        <ColorArea
          defaultValue={BLUE}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )

      expect(
        screen.getByRole('slider', { name: 'Saturation' }).props[
          'aria-valuetext'
        ],
      ).toBe('100%, light vibrant cyan blue')
      expect(
        screen.getByRole('slider', { name: 'Lightness' }).props[
          'aria-valuetext'
        ],
      ).toBe('50%, light vibrant cyan blue')
    })

    it('names each after aria-label, in the provider’s locale', async () => {
      await render(
        <I18nProvider locale="pt-BR">
          <ColorArea
            aria-label="Rótulo"
            defaultValue={BLUE}
            xChannel="saturation"
            yChannel="lightness"
          />
        </I18nProvider>,
      )

      expect(
        screen.getByRole('slider', { name: 'Rótulo, Saturação' }),
      ).toBeTruthy()
      expect(
        screen.getByRole('slider', { name: 'Rótulo, Luminosidade' }),
      ).toBeTruthy()
    })

    it('steps one channel for each action, and ends the change each time', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      const onChangeEnd = jest.fn<(value: Color) => void>()
      await render(
        <ColorArea
          defaultValue={MIDDLE}
          onChange={onChange}
          onChangeEnd={onChangeEnd}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )

      await ask('Saturation', 'increment')

      expect(onChangeEnd.mock.calls.at(-1)?.[0].toString('css')).toBe(
        'hsla(200, 51%, 50%, 1)',
      )

      await ask('Lightness', 'decrement')
      await ask('Lightness', 'decrement')
      await ask('Saturation', 'decrement')

      expect(onChangeEnd.mock.calls.at(-1)?.[0].toString('css')).toBe(
        'hsla(200, 50%, 48%, 1)',
      )
      expect(onChange).toHaveBeenCalledTimes(4)
      expect(onChangeEnd).toHaveBeenCalledTimes(4)

      await ask('Lightness', 'increment')

      expect(
        screen.getByRole('slider', { name: 'Lightness' }),
      ).toHaveAccessibilityValue({ now: 49 })
    })

    it('steps by the channel’s own step', async () => {
      await render(
        <ColorArea
          defaultValue="rgba(0, 170, 255, 0.6)"
          xChannel="red"
          yChannel="alpha"
        />,
      )

      await ask('Alpha', 'increment')
      await ask('Red', 'increment')

      expect(
        screen.getByRole('slider', { name: 'Alpha' }),
      ).toHaveAccessibilityValue({ now: 0.61 })
      expect(
        screen.getByRole('slider', { name: 'Red' }),
      ).toHaveAccessibilityValue({ now: 1 })
    })

    it('steps alpha by its own step across the plane too', async () => {
      await render(
        <ColorArea
          defaultValue="rgba(0, 170, 255, 0.6)"
          xChannel="alpha"
          yChannel="red"
        />,
      )

      await ask('Alpha', 'increment')

      expect(
        screen.getByRole('slider', { name: 'Alpha' }),
      ).toHaveAccessibilityValue({ now: 0.61 })

      await ask('Alpha', 'decrement')
      await ask('Alpha', 'decrement')

      expect(
        screen.getByRole('slider', { name: 'Alpha' }),
      ).toHaveAccessibilityValue({ now: 0.59 })
    })
  })

  describe('its state', () => {
    it('sets both channels where a press lands', async () => {
      const onChangeEnd = jest.fn<(value: Color) => void>()
      await render(
        <ColorArea
          defaultValue={BLUE}
          onChangeEnd={onChangeEnd}
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )
      await layOut()

      await tap(50, 150)

      expect(onChangeEnd).toHaveBeenCalledTimes(1)
      expect(onChangeEnd.mock.calls.at(-1)?.[0].toString('css')).toBe(
        'hsla(200, 25%, 25%, 1)',
      )
      expect(styleOf(seat())).toMatchObject({ start: '25%', top: '75%' })
    })

    it('follows a drag across both axes, and ends the change once it lets go', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      const onChangeEnd = jest.fn<(value: Color) => void>()
      await render(
        <ColorArea
          defaultValue={BLUE}
          onChange={onChange}
          onChangeEnd={onChangeEnd}
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )
      await layOut()

      await drag([20, 180], [100, 100], [180, 20])

      expect(
        onChange.mock.calls.map(([value]) => [
          value.getChannelValue('saturation'),
          value.getChannelValue('lightness'),
        ]),
      ).toStrictEqual([
        [10, 10],
        [50, 50],
        [90, 90],
      ])
      expect(onChangeEnd).toHaveBeenCalledTimes(1)
      expect(onChangeEnd.mock.calls.at(-1)?.[0].toString('css')).toBe(
        'hsla(200, 90%, 90%, 1)',
      )
    })

    it('clamps a drag past an edge to the channel’s end', async () => {
      const onChangeEnd = jest.fn<(value: Color) => void>()
      await render(
        <ColorArea
          defaultValue={BLUE}
          onChangeEnd={onChangeEnd}
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )
      await layOut()

      await drag([100, 100], [260, -40])

      expect(onChangeEnd.mock.calls.at(-1)?.[0].toString('css')).toBe(
        'hsla(200, 100%, 100%, 1)',
      )
    })

    it('reads a press from the right under a right-to-left layout', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(
        <ColorArea
          defaultValue={BLUE}
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )
      await layOut()

      await tap(50, 100)

      expect(
        screen.getByRole('slider', { name: 'Saturation' }),
      ).toHaveAccessibilityValue({ now: 75 })
    })

    it('reads a press against the plane’s own height', async () => {
      await render(
        <ColorArea
          defaultValue={BLUE}
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )
      await layOut(SIDE, 2 * SIDE)

      await tap(100, 300)

      expect(
        screen.getByRole('slider', { name: 'Lightness' }),
      ).toHaveAccessibilityValue({ now: 25 })
    })

    it('takes nothing before the plane has a size', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      await render(
        <ColorArea
          defaultValue={BLUE}
          onChange={onChange}
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )

      await tap(50, 50)
      await layOut(SIDE, 0)
      await tap(50, 50)

      expect(onChange).not.toHaveBeenCalled()
    })

    it('follows a value the call site holds', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      const { rerender } = await render(
        <ColorArea
          onChange={onChange}
          value={MIDDLE}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )

      await ask('Saturation', 'increment')

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(
        screen.getByRole('slider', { name: 'Saturation' }),
      ).toHaveAccessibilityValue({ now: 50 })

      await rerender(
        <ColorArea
          onChange={onChange}
          value={parseColor('hsl(200, 20%, 50%)')}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )

      expect(
        screen.getByRole('slider', { name: 'Saturation' }),
      ).toHaveAccessibilityValue({ now: 20 })
    })

    it('fades the plane and the handle while disabled, and takes nothing', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      await render(
        <ColorArea
          defaultValue={MIDDLE}
          isDisabled
          onChange={onChange}
          testID={TEST_ID}
          xChannel="saturation"
          yChannel="lightness"
        />,
      )
      await layOut()

      expect(styleOf(screen.getByTestId(TEST_ID))).toMatchObject({
        opacity: stateLayerOpacity.disabledContent,
      })
      expect(screen.getByRole('slider', { name: 'Saturation' })).toBeDisabled()
      expect(screen.getByRole('slider', { name: 'Lightness' })).toBeDisabled()
      expect(getByGestureTestId(`${TEST_ID}-pan`).config).toMatchObject({
        enabled: false,
      })
      expect(getByGestureTestId(`${TEST_ID}-tap`).config).toMatchObject({
        enabled: false,
      })

      await ask('Saturation', 'increment')
      await ask('Lightness', 'decrement')

      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('the call site', () => {
    it('lands style, ref and testID on the square, whose width style sets', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        <ColorArea
          defaultValue={BLUE}
          ref={ref}
          style={NARROW}
          testID={TEST_ID}
        />,
      )

      expect(styleOf(screen.getByTestId(TEST_ID))).toMatchObject({
        aspectRatio: 1,
        width: 160,
      })
      expect(ref.current).not.toBeNull()
    })
  })
})
