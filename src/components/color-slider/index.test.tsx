import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
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

import { ColorSlider } from '.'
import { I18nProvider } from '../../i18n/provider'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const { colors, radii, shadows, spacing, stateLayerOpacity, typography } = theme

const BLUE = 'hsl(200, 100%, 50%)'
const TRANSLUCENT = 'hsla(200, 100%, 50%, 0.4)'

// The track's length in every test that lays it out.
const LENGTH = 360
const VERTICAL_LENGTH = 240

// Across the strip, where a press lands.
const ACROSS = 22

// A style a call site hands the slider.
const OFFSET = { marginTop: 4 }
const SHORTER = { height: 160 }

// What Gesture Handler's helpers find a slider's gestures by.
const TEST_ID = 'slider'

type Paint = { readonly alpha: number; readonly rgb: string }

// The view a press is read along, which is the one the track is measured on.
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

// Asks the handle for an action, as a screen reader does.
async function ask(actionName: string) {
  await fireEvent(screen.getByRole('slider'), 'accessibilityAction', {
    nativeEvent: { actionName },
  })
}

// What a gradient stop's colour comes to, from the integer svg packs it in.
function decode(value: number): Paint {
  const packed = value >>> 0
  return {
    alpha: Math.round(((packed >>> 24) / 255) * 100) / 100,
    rgb: `rgb(${(packed >>> 16) & 255}, ${(packed >>> 8) & 255}, ${packed & 255})`,
  }
}

async function drag(...along: number[]) {
  const [first = 0] = along
  const last = along.at(-1) ?? first
  await act(() => {
    fireGestureHandler(getByGestureTestId(`${TEST_ID}-pan`), [
      { state: State.BEGAN, x: first, y: ACROSS },
      ...along.map((x) => ({ state: State.ACTIVE, x, y: ACROSS })),
      { state: State.END, x: last, y: ACROSS },
    ])
  })
}

function gradient() {
  const found = screen
    .getByTestId(TEST_ID)
    .queryAll((each) => each.type === 'RNSVGLinearGradient')
    .at(0)
  if (found === undefined) {
    throw new TypeError('expected a gradient')
  }
  return found
}

function gradientOf(element: {
  props: {
    gradient?: readonly number[]
    x1?: number
    x2?: number
    y1?: number
    y2?: number
  }
}) {
  const { gradient: packed = [], x1, x2, y1, y2 } = element.props
  const stops: { offset: number; paint: Paint }[] = []
  for (let index = 0; index < packed.length; index += 2) {
    stops.push({
      offset: packed[index] ?? Number.NaN,
      paint: decode(packed[index + 1] ?? 0),
    })
  }
  return { direction: [x1, y1, x2, y2], stops }
}

function hairline() {
  const edge = views(screen.getByRole('slider')).at(0)
  if (edge === undefined) {
    throw new TypeError('expected a handle')
  }
  return edge
}

// A pan held part of the way, which a test can look at before it ends.
function heldDrag() {
  const { handlerTag } = getByGestureTestId(`${TEST_ID}-pan`)
  const send = async (name: string, event: object) => {
    await act(() => {
      DeviceEventEmitter.emit(name, { handlerTag, ...event })
    })
  }

  return {
    begin: async (x: number) => {
      await send('onGestureHandlerStateChange', {
        oldState: State.UNDETERMINED,
        state: State.BEGAN,
        x,
        y: ACROSS,
      })
      await send('onGestureHandlerStateChange', {
        oldState: State.BEGAN,
        state: State.ACTIVE,
        x,
        y: ACROSS,
      })
    },
    end: async (x: number) => {
      await send('onGestureHandlerStateChange', {
        oldState: State.ACTIVE,
        state: State.END,
        x,
        y: ACROSS,
      })
    },
  }
}

// The handle's hairline, and the surface ring inside it holding the colour.
// Text the slider hides from a screen reader, which hears it from the handle.
function hiddenText(text: string) {
  return screen.getByText(text, { includeHiddenElements: true })
}

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

function ring() {
  const inner = views(hairline()).at(0)
  if (inner === undefined) {
    throw new TypeError('expected a ring')
  }
  return inner
}

// The strip the channel runs along: the first view in the measured one.
function strip() {
  const found = views(area()).at(0)
  if (found === undefined) {
    throw new TypeError('expected a strip')
  }
  return found
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle & ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

async function tap(x: number, y = ACROSS) {
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

afterEach(() => {
  jest.restoreAllMocks()
})

describe('ColorSlider', () => {
  describe('the label and the readout', () => {
    it('sets the label in label large and the value in body small at the end of its line', async () => {
      await render(
        <ColorSlider channel="hue" defaultValue={BLUE} label="Label" />,
      )

      expect(styleOf(hiddenText('Label'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.labelLargeSize,
      })
      expect(styleOf(hiddenText('200°'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.bodySmallSize,
        marginStart: 'auto',
      })
      expect(
        styleOf(hiddenText('Label').parent ?? { props: {} }),
      ).toMatchObject({
        alignItems: 'baseline',
        flexDirection: 'row',
        gap: spacing.sm,
      })
    })

    it('hides both from a screen reader, which hears them from the handle', async () => {
      await render(
        <ColorSlider channel="hue" defaultValue={BLUE} label="Label" />,
      )

      expect(screen.queryByText('Label')).toBeNull()
      expect(hiddenText('Label')).toBeTruthy()
    })

    it('reads the value in the provider’s locale', async () => {
      await render(
        <I18nProvider locale="de-DE">
          <ColorSlider
            channel="alpha"
            defaultValue={TRANSLUCENT}
            label="Label"
          />
        </I18nProvider>,
      )

      expect(hiddenText('40 %')).toBeTruthy()
    })

    it('drops the readout when asked, and the line with nothing on it', async () => {
      const { rerender } = await render(
        <ColorSlider
          channel="hue"
          defaultValue={BLUE}
          label="Label"
          showValue={false}
          testID={TEST_ID}
        />,
      )

      expect(
        screen.queryByText('200°', { includeHiddenElements: true }),
      ).toBeNull()
      expect(hiddenText('Label')).toBeTruthy()

      await rerender(
        <ColorSlider
          channel="hue"
          defaultValue={BLUE}
          showValue={false}
          testID={TEST_ID}
        />,
      )

      expect(views(screen.getByTestId(TEST_ID))).toHaveLength(1)
    })

    it('shows the value alone with no label', async () => {
      await render(<ColorSlider channel="hue" defaultValue={BLUE} />)

      expect(hiddenText('200°')).toBeTruthy()
    })
  })

  describe('the track', () => {
    it('draws the page’s 16dp strip with its corner, centred in the 44dp a press lands in', async () => {
      await render(
        <ColorSlider channel="hue" defaultValue={BLUE} testID={TEST_ID} />,
      )

      expect(styleOf(area().parent ?? { props: {} })).toMatchObject({
        height: 44,
      })
      expect(styleOf(strip())).toStrictEqual({
        borderRadius: radii.sm,
        end: 0,
        height: 16,
        overflow: 'hidden',
        position: 'absolute',
        start: 0,
        top: 14,
      })
    })

    it('runs the hue through its six primaries from the start', async () => {
      await render(
        <ColorSlider channel="hue" defaultValue={BLUE} testID={TEST_ID} />,
      )

      const { direction, stops } = gradientOf(gradient())
      expect(direction).toStrictEqual([0, 0, 1, 0])
      expect(stops.map(({ offset }) => offset)).toStrictEqual([
        0,
        1 / 6,
        2 / 6,
        3 / 6,
        4 / 6,
        5 / 6,
        1,
      ])
      expect(stops.map(({ paint }) => paint.rgb)).toStrictEqual([
        'rgb(255, 0, 0)',
        'rgb(255, 255, 0)',
        'rgb(0, 255, 0)',
        'rgb(0, 255, 255)',
        'rgb(0, 0, 255)',
        'rgb(255, 0, 255)',
        'rgb(255, 0, 0)',
      ])
    })

    it('runs lightness through the colour at its middle', async () => {
      await render(
        <ColorSlider
          channel="lightness"
          defaultValue="hsl(200, 100%, 40%)"
          testID={TEST_ID}
        />,
      )

      expect(
        gradientOf(gradient()).stops.map(({ paint }) => paint.rgb),
      ).toStrictEqual([
        'rgb(0, 0, 0)',
        'rgb(0, 170, 255)',
        'rgb(255, 255, 255)',
      ])
    })

    it('runs any other channel from its least to its most, opaque', async () => {
      await render(
        <ColorSlider
          channel="saturation"
          defaultValue={TRANSLUCENT}
          testID={TEST_ID}
        />,
      )

      expect(gradientOf(gradient()).stops).toStrictEqual([
        { offset: 0, paint: { alpha: 1, rgb: 'rgb(128, 128, 128)' } },
        { offset: 1, paint: { alpha: 1, rgb: 'rgb(0, 170, 255)' } },
      ])
    })

    it('fades the alpha channel out over a chequer, which no other track draws', async () => {
      const { rerender } = await render(
        <ColorSlider
          channel="alpha"
          defaultValue={TRANSLUCENT}
          testID={TEST_ID}
        />,
      )

      expect(gradientOf(gradient()).stops).toStrictEqual([
        { offset: 0, paint: { alpha: 0, rgb: 'rgb(0, 170, 255)' } },
        { offset: 1, paint: { alpha: 1, rgb: 'rgb(0, 170, 255)' } },
      ])
      expect(
        strip().queryAll((each) => each.type === 'RNSVGPattern'),
      ).toHaveLength(1)

      await rerender(
        <ColorSlider channel="hue" defaultValue={BLUE} testID={TEST_ID} />,
      )

      expect(
        strip().queryAll((each) => each.type === 'RNSVGPattern'),
      ).toHaveLength(0)
    })

    it('runs the channel from the right under a right-to-left layout', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(
        <ColorSlider channel="hue" defaultValue={BLUE} testID={TEST_ID} />,
      )

      expect(gradientOf(gradient()).direction).toStrictEqual([1, 0, 0, 0])
    })

    it('gives each gradient an id of its own', async () => {
      await render(
        <View>
          <ColorSlider channel="hue" defaultValue={BLUE} testID={TEST_ID} />
          <ColorSlider channel="alpha" defaultValue={TRANSLUCENT} />
        </View>,
      )

      const names = screen.root
        ?.queryAll((each) => each.type === 'RNSVGLinearGradient')
        .map((each) => each.props.name as unknown)
      expect(new Set(names).size).toBe(2)
    })
  })

  describe('the handle', () => {
    it('carries the colour at the point it sits on', async () => {
      const { rerender } = await render(
        <ColorSlider channel="hue" defaultValue="hsl(200, 50%, 30%)" />,
      )

      // A hue track shows the hue alone, at its most vivid.
      expect(styleOf(ring()).backgroundColor).toBe('hsla(200, 100%, 50%, 1)')

      // A default value is read once, so each channel is a slider of its own.
      await rerender(
        <ColorSlider
          channel="saturation"
          defaultValue={TRANSLUCENT}
          key="saturation"
        />,
      )

      expect(styleOf(ring()).backgroundColor).toBe('hsla(200, 100%, 50%, 1)')

      await rerender(
        <ColorSlider channel="alpha" defaultValue={TRANSLUCENT} key="alpha" />,
      )

      expect(styleOf(ring()).backgroundColor).toBe('hsla(200, 100%, 50%, 0.4)')
    })

    it('is ringed in surface, with a hairline in outline outside it', async () => {
      await render(<ColorSlider channel="hue" defaultValue={BLUE} />)

      expect(styleOf(hairline())).toStrictEqual({
        borderColor: colors.outline,
        borderRadius: radii.circle,
        borderWidth: 1,
        height: 26,
        width: 26,
      })
      expect(styleOf(ring())).toMatchObject({
        borderColor: colors.surface,
        borderRadius: radii.circle,
        borderWidth: 2,
        flexGrow: 1,
      })
    })

    it('sits at the value along the strip, centred across it', async () => {
      await render(<ColorSlider channel="hue" defaultValue={BLUE} />)

      expect(styleOf(screen.getByRole('slider'))).toMatchObject({
        alignItems: 'center',
        bottom: 0,
        justifyContent: 'center',
        start: `${(200 / 360) * 100}%`,
        top: 0,
      })
    })

    it('lifts while it is dragged, and settles when it is let go', async () => {
      await render(
        <ColorSlider channel="hue" defaultValue={BLUE} testID={TEST_ID} />,
      )
      await layOut()

      expect(styleOf(hairline()).boxShadow).toBeUndefined()

      const held = heldDrag()
      await held.begin(90)

      expect(styleOf(hairline()).boxShadow).toBe(shadows.elevation2)

      await held.end(90)

      expect(styleOf(hairline()).boxShadow).toBeUndefined()
    })
  })

  describe('to a screen reader', () => {
    it('is an adjustable control named by the label, with the channel’s range', async () => {
      await render(
        <ColorSlider channel="hue" defaultValue={BLUE} label="Label" />,
      )

      const handle = screen.getByRole('slider', { name: 'Label' })
      expect(handle.props.accessibilityActions).toStrictEqual([
        { name: 'increment' },
        { name: 'decrement' },
      ])
      expect(handle).toHaveAccessibilityValue({ max: 360, min: 0, now: 200 })
    })

    it('names the hue, the colour, or nothing after the value, as React Aria does', async () => {
      const { rerender } = await render(
        <ColorSlider channel="hue" defaultValue={BLUE} label="Label" />,
      )

      expect(screen.getByRole('slider').props['aria-valuetext']).toBe(
        '200°, cyan blue',
      )

      await rerender(
        <ColorSlider channel="saturation" defaultValue={BLUE} label="Label" />,
      )

      expect(screen.getByRole('slider').props['aria-valuetext']).toBe(
        '100%, light vibrant cyan blue',
      )

      await rerender(
        <ColorSlider
          channel="alpha"
          defaultValue={TRANSLUCENT}
          key="alpha"
          label="Label"
        />,
      )

      expect(screen.getByRole('slider').props['aria-valuetext']).toBe('40%')
    })

    it('takes aria-label without a label, and the channel’s name in the locale without either', async () => {
      const { rerender } = await render(
        <ColorSlider aria-label="Brand" channel="hue" defaultValue={BLUE} />,
      )

      expect(screen.getByRole('slider', { name: 'Brand' })).toBeTruthy()

      // The label is what a sighted reader sees, so it wins.
      await rerender(
        <ColorSlider
          aria-label="Brand"
          channel="hue"
          defaultValue={BLUE}
          label="Label"
        />,
      )

      expect(screen.getByRole('slider', { name: 'Label' })).toBeTruthy()

      await rerender(
        <I18nProvider locale="pt-BR">
          <ColorSlider channel="hue" defaultValue={BLUE} />
        </I18nProvider>,
      )

      expect(screen.getByRole('slider', { name: 'Matiz' })).toBeTruthy()
      expect(screen.getByRole('slider').props['aria-valuetext']).toBe(
        '200 °, azul-ciano',
      )
    })

    it('moves a step for each action, and ends the change each time', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      const onChangeEnd = jest.fn<(value: Color) => void>()
      await render(
        <ColorSlider
          channel="hue"
          defaultValue={BLUE}
          label="Label"
          onChange={onChange}
          onChangeEnd={onChangeEnd}
        />,
      )

      await ask('increment')

      expect(onChange.mock.calls.at(-1)?.[0].getChannelValue('hue')).toBe(201)
      expect(onChangeEnd).toHaveBeenCalledTimes(1)

      await ask('decrement')
      await ask('decrement')

      expect(screen.getByRole('slider')).toHaveAccessibilityValue({ now: 199 })
      expect(onChangeEnd).toHaveBeenCalledTimes(3)
    })
  })

  describe('its state', () => {
    it('moves the handle where a press lands', async () => {
      const onChangeEnd = jest.fn<(value: Color) => void>()
      await render(
        <ColorSlider
          channel="hue"
          defaultValue={BLUE}
          onChangeEnd={onChangeEnd}
          testID={TEST_ID}
        />,
      )
      await layOut()

      await tap(90)

      expect(screen.getByRole('slider')).toHaveAccessibilityValue({ now: 90 })
      expect(onChangeEnd.mock.calls.at(-1)?.[0].toString('css')).toBe(
        'hsla(90, 100%, 50%, 1)',
      )
    })

    it('follows a drag, and ends the change once it lets go', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      const onChangeEnd = jest.fn<(value: Color) => void>()
      await render(
        <ColorSlider
          channel="hue"
          defaultValue={BLUE}
          onChange={onChange}
          onChangeEnd={onChangeEnd}
          testID={TEST_ID}
        />,
      )
      await layOut()

      await drag(90, 180, 270)

      expect(
        onChange.mock.calls.map(([value]) => value.getChannelValue('hue')),
      ).toStrictEqual([90, 180, 270])
      expect(onChangeEnd).toHaveBeenCalledTimes(1)
    })

    it('reads a vertical press from the bottom', async () => {
      await render(
        <ColorSlider
          channel="hue"
          defaultValue={BLUE}
          orientation="vertical"
          testID={TEST_ID}
        />,
      )
      await layOut(VERTICAL_LENGTH, true)

      await tap(ACROSS, 60)

      expect(screen.getByRole('slider')).toHaveAccessibilityValue({ now: 270 })
    })

    it('follows a value the call site holds', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      const { rerender } = await render(
        <ColorSlider channel="hue" onChange={onChange} value={BLUE} />,
      )

      await ask('increment')

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('slider')).toHaveAccessibilityValue({ now: 200 })

      await rerender(
        <ColorSlider
          channel="hue"
          onChange={onChange}
          value={parseColor('hsl(120, 100%, 50%)')}
        />,
      )

      expect(screen.getByRole('slider')).toHaveAccessibilityValue({ now: 120 })
    })

    it('reads the channel in the space colorSpace names', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(
        render(<ColorSlider channel="hue" defaultValue="#6750A4" />),
      ).rejects.toThrow('Unknown color channel: hue')

      await render(
        <ColorSlider channel="hue" colorSpace="hsl" defaultValue="#6750A4" />,
      )

      expect(hiddenText('256.43°')).toBeTruthy()
    })

    it('fades the strip and the handle while disabled, keeps the label, and takes nothing', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      await render(
        <ColorSlider
          channel="hue"
          defaultValue={BLUE}
          isDisabled
          label="Label"
          onChange={onChange}
          testID={TEST_ID}
        />,
      )
      await layOut()

      expect(styleOf(area())).toMatchObject({
        opacity: stateLayerOpacity.disabledContent,
      })
      expect(styleOf(hiddenText('Label')).opacity).toBeUndefined()
      expect(screen.getByRole('slider')).toBeDisabled()
      expect(getByGestureTestId(`${TEST_ID}-pan`).config).toMatchObject({
        enabled: false,
      })

      await ask('increment')

      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('vertical', () => {
    it('stands the strip up, 16dp across, in a slider 240dp tall', async () => {
      await render(
        <ColorSlider
          channel="hue"
          defaultValue={BLUE}
          orientation="vertical"
          testID={TEST_ID}
        />,
      )

      expect(styleOf(screen.getByTestId(TEST_ID))).toMatchObject({
        alignItems: 'flex-start',
        height: 240,
      })
      expect(styleOf(area().parent ?? { props: {} })).toMatchObject({
        flexGrow: 1,
        minHeight: 0,
        width: 44,
      })
      expect(styleOf(strip())).toStrictEqual({
        borderRadius: radii.sm,
        bottom: 0,
        overflow: 'hidden',
        position: 'absolute',
        start: 14,
        top: 0,
        width: 16,
      })
    })

    it('runs the channel up from the bottom, under either direction', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(
        <ColorSlider
          channel="hue"
          defaultValue={BLUE}
          orientation="vertical"
          testID={TEST_ID}
        />,
      )

      expect(gradientOf(gradient()).direction).toStrictEqual([0, 1, 0, 0])
      expect(styleOf(screen.getByRole('slider'))).toMatchObject({
        bottom: `${(200 / 360) * 100}%`,
      })
    })
  })

  describe('the call site', () => {
    it('lands style, ref and testID on the slider as a whole', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      const { rerender } = await render(
        <ColorSlider
          channel="hue"
          defaultValue={BLUE}
          ref={ref}
          style={OFFSET}
          testID={TEST_ID}
        />,
      )

      expect(styleOf(screen.getByTestId(TEST_ID))).toMatchObject({
        ...OFFSET,
        gap: spacing.xs,
        width: '100%',
      })
      expect(ref.current).not.toBeNull()

      await rerender(
        <ColorSlider
          channel="hue"
          defaultValue={BLUE}
          orientation="vertical"
          style={SHORTER}
          testID={TEST_ID}
        />,
      )

      expect(styleOf(screen.getByTestId(TEST_ID)).height).toBe(160)
    })
  })
})
