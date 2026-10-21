import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle } from 'react-native'
import type { TestNode } from 'test-renderer'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { checkPath } from '@kanso-labs/kanso-ui-core/glyphs'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import {
  DeviceEventEmitter,
  I18nManager,
  Platform,
  StyleSheet,
  View,
} from 'react-native'
import { State } from 'react-native-gesture-handler'
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils'
import { getAnimatedStyle } from 'react-native-reanimated'

import { Switch } from '.'
import { ThemeScope } from '../../theme-scope'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

// What the next switch the device draws is told about reduced motion.
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

// Where a drag begins across the track, and how far the seat travels from one
// end to the other, from the page: the track's 48 inside its rule, less the
// pressed handle's 28.
const BEGIN = 16
const TRAVEL = 20

// One frame at sixty a second.
const FRAME = 16

// A theme over one colour, and a style from outside.
const PRIMARY = { '--kui-color-primary': '#0b57d0' }
const OFFSET = { marginTop: 4 }

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
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

// A drag carried through to its end with Gesture Handler's own helper: begun
// at `BEGIN`, moved through each of `across`, and let go at the last.
async function drag(...across: number[]) {
  const last = across.at(-1) ?? BEGIN
  await act(() => {
    fireGestureHandler(getByGestureTestId('switch-drag'), [
      { state: State.BEGAN, x: BEGIN },
      ...across.map((x) => ({ state: State.ACTIVE, x })),
      { state: State.END, x: last },
    ])
  })
}

// The handle's colour and side as they stand.
function handleOf() {
  const style = getAnimatedStyle(parts().handle)
  return {
    color: same(style.backgroundColor),
    size: [style.width, style.height],
  }
}

// A drag a test can look at before it ends. `fireGestureHandler` carries a
// gesture through to its end in one call, so these send the same events one
// at a time, on the channel the helper sends a gesture's events on, with a
// frame between each as a device has.
function heldDrag() {
  const { handlerTag } = getByGestureTestId('switch-drag')
  const send = async (name: string, event: object) => {
    await act(() => {
      DeviceEventEmitter.emit(name, { handlerTag, ...event })
    })
    await advance(FRAME)
  }
  let at = BEGIN

  return {
    begin: async () => {
      await send('onGestureHandlerStateChange', {
        oldState: State.UNDETERMINED,
        state: State.BEGAN,
        x: at,
      })
    },
    end: async () => {
      await send('onGestureHandlerStateChange', {
        oldState: State.ACTIVE,
        state: State.END,
        x: at,
      })
    },
    move: async (x: number) => {
      const started = at !== BEGIN
      at = x
      await (started
        ? send('onGestureHandlerEvent', { state: State.ACTIVE, x })
        : send('onGestureHandlerStateChange', {
            oldState: State.BEGAN,
            state: State.ACTIVE,
            x,
          }))
    },
  }
}

// The parts of the switch, from the row in: Gesture Handler's root view, the
// view the drag is recognised over, the track, the handle's seat, the state
// layer's disc and the press feedback inside it, the handle, and the icon in
// the handle while one is drawn.
function parts() {
  const control = child(switchOf().children.at(0))
  const area = child(control.children.at(0))
  const track = child(area.children.at(0))
  const seat = child(track.children.at(0))
  const disc = child(seat.children.at(0))
  const surface = child(disc.children.at(0))
  const handle = child(seat.children.at(1))
  const glyph = handle.children.at(0)
  return {
    control,
    disc,
    glyph: glyph === undefined ? undefined : child(glyph),
    handle,
    layer: child(surface.children.at(0)),
    seat,
    surface,
    track,
  }
}

function pathOf(node: TestNode | undefined): unknown {
  if (node === undefined || typeof node === 'string') {
    return undefined
  }
  if (node.type === 'RNSVGPath') {
    return node.props.d
  }
  return node.children.map(pathOf).find((d) => d !== undefined)
}

// One spelling of a colour, since Reanimated writes the colours it eases
// through as `rgba()` whatever they were given as.
function same(color: unknown) {
  if (typeof color !== 'string') {
    throw new TypeError('expected a colour')
  }
  return withOpacity(color, 1)
}

// Where the seat stands across the track, by its translation.
function seatAt(): unknown {
  const { transform }: { transform?: unknown } = getAnimatedStyle(parts().seat)
  const first: unknown = Array.isArray(transform) ? transform.at(0) : undefined

  return typeof first === 'object' && first !== null && 'translateX' in first
    ? first.translateX
    : undefined
}

// The whole switch once its eases have run: the track's fill and rule, the
// handle and the seat.
async function settled() {
  await advance(motion.durationShort2)
  const track = getAnimatedStyle(parts().track)
  return {
    fill: same(track.backgroundColor),
    handle: handleOf(),
    rule: same(track.borderColor),
    seat: seatAt(),
  }
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle> }
}): TextStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function switchOf() {
  return screen.getByRole('switch')
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  mockReducedMotion = false
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('Switch', () => {
  describe('semantics', () => {
    it('is announced as a switch named by its label', async () => {
      await render(<Switch>Label</Switch>)

      expect(screen.getByRole('switch', { name: 'Label' })).toBeTruthy()
    })

    it('is named by aria-label without a label of its own', async () => {
      await render(<Switch aria-label="Label" />)

      expect(screen.getByRole('switch', { name: 'Label' })).toBeTruthy()
      // The track alone, with no empty text beside it to take a gap.
      expect(switchOf().children).toHaveLength(1)
    })

    it('reports off and on', async () => {
      await render(<Switch>Label</Switch>)
      expect(switchOf()).not.toBeChecked()

      await screen.rerender(<Switch isSelected>Label</Switch>)
      expect(switchOf()).toBeChecked()
    })

    it('reads its description as its hint, and the error in its place', async () => {
      await render(<Switch description="Supporting line">Label</Switch>)

      expect(switchOf().props.accessibilityHint).toBe('Supporting line')
      expect(screen.queryByText('Supporting line')).toBeNull()

      await screen.rerender(
        <Switch description="Supporting line" error="Turn this on.">
          Label
        </Switch>,
      )

      expect(switchOf().props.accessibilityHint).toBe('Turn this on.')
      expect(
        screen.queryByText('Supporting line', { includeHiddenElements: true }),
      ).toBeNull()
    })

    it('points at the line under it on the web, which drops the hint', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await render(<Switch description="Supporting line">Label</Switch>)

      const line = screen.getByText('Supporting line')
      expect(typeof line.props.id).toBe('string')
      expect(switchOf().props['aria-describedby']).toBe(line.props.id)
    })

    it('sets the error in the error colour', async () => {
      await render(<Switch error="Turn this on.">Label</Switch>)

      expect(
        styleOf(
          screen.getByText('Turn this on.', { includeHiddenElements: true }),
        ).color,
      ).toBe(colors.error)
    })
  })

  describe('pressing', () => {
    it('keeps its own state, flipped by a press on the track or the label', async () => {
      const onChange = jest.fn()
      await render(<Switch onChange={onChange}>Label</Switch>)

      await fireEvent.press(switchOf())
      expect(switchOf()).toBeChecked()
      expect(onChange).toHaveBeenLastCalledWith(true)

      await fireEvent.press(screen.getByText('Label'))
      expect(switchOf()).not.toBeChecked()
      expect(onChange).toHaveBeenLastCalledWith(false)
    })

    it('starts on when told to', async () => {
      await render(<Switch defaultSelected>Label</Switch>)

      expect(switchOf()).toBeChecked()
    })

    it('reports without moving when controlled', async () => {
      const onChange = jest.fn()
      await render(
        <Switch isSelected={false} onChange={onChange}>
          Label
        </Switch>,
      )

      await fireEvent.press(switchOf())

      expect(onChange).toHaveBeenCalledWith(true)
      expect(switchOf()).not.toBeChecked()
    })

    it('takes no press while disabled, and is announced disabled', async () => {
      const onChange = jest.fn()
      await render(
        <Switch isDisabled onChange={onChange}>
          Label
        </Switch>,
      )

      await fireEvent.press(switchOf())

      expect(switchOf()).toBeDisabled()
      expect(switchOf()).not.toBeChecked()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('takes no press while read-only, without being announced disabled', async () => {
      const onChange = jest.fn()
      await render(
        <Switch defaultSelected isReadOnly onChange={onChange}>
          Label
        </Switch>,
      )

      await fireEvent.press(switchOf())

      expect(switchOf()).toBeEnabled()
      expect(switchOf()).toBeChecked()
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('dragging', () => {
    it('turns on when the handle is let go past the middle', async () => {
      const onChange = jest.fn()
      await render(
        <Switch onChange={onChange} testID="switch">
          Label
        </Switch>,
      )

      await drag(BEGIN + 6, BEGIN + 11)

      expect(switchOf()).toBeChecked()
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(true)
    })

    it('springs back when the handle is let go before the middle', async () => {
      const onChange = jest.fn()
      await render(
        <Switch onChange={onChange} testID="switch">
          Label
        </Switch>,
      )

      await drag(BEGIN + 6, BEGIN + 10)

      expect(switchOf()).not.toBeChecked()
      expect(onChange).not.toHaveBeenCalled()
      expect((await settled()).seat).toBe(0)
    })

    it('turns off when the handle is carried back past the middle', async () => {
      const onChange = jest.fn()
      await render(
        <Switch defaultSelected onChange={onChange} testID="switch">
          Label
        </Switch>,
      )

      await drag(BEGIN - 11)

      expect(switchOf()).not.toBeChecked()
      expect(onChange).toHaveBeenCalledWith(false)
    })

    it('is recognised once a press has moved half the travel', async () => {
      await render(<Switch testID="switch">Label</Switch>)

      expect(getByGestureTestId('switch-drag').config).toMatchObject({
        activeOffsetXEnd: TRAVEL / 2,
        activeOffsetXStart: -TRAVEL / 2,
      })
    })

    it('goes no further than the end it started at', async () => {
      const onChange = jest.fn()
      await render(
        <Switch onChange={onChange} testID="switch">
          Label
        </Switch>,
      )
      const held = heldDrag()

      await held.begin()
      await held.move(BEGIN - 30)
      expect(seatAt()).toBe(0)
      await held.end()

      expect(onChange).not.toHaveBeenCalled()
    })

    it('carries an on handle from the far end', async () => {
      const onChange = jest.fn()
      await render(
        <Switch defaultSelected onChange={onChange} testID="switch">
          Label
        </Switch>,
      )
      const held = heldDrag()

      await held.begin()
      await held.move(BEGIN - 8)
      expect(seatAt()).toBe(TRAVEL - 8)
      await held.end()

      expect(switchOf()).toBeChecked()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('settles nothing when the drag is cancelled', async () => {
      const onChange = jest.fn()
      await render(
        <Switch onChange={onChange} testID="switch">
          Label
        </Switch>,
      )

      await act(() => {
        fireGestureHandler(getByGestureTestId('switch-drag'), [
          { state: State.BEGAN, x: BEGIN },
          { state: State.ACTIVE, x: BEGIN + 15 },
          { state: State.CANCELLED, x: BEGIN + 15 },
        ])
      })

      expect(switchOf()).not.toBeChecked()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('reports a drag without moving when controlled, and goes back', async () => {
      const onChange = jest.fn()
      await render(
        <Switch isSelected={false} onChange={onChange} testID="switch">
          Label
        </Switch>,
      )

      await drag(BEGIN + 15)

      expect(onChange).toHaveBeenCalledWith(true)
      expect(switchOf()).not.toBeChecked()
      expect((await settled()).seat).toBe(0)
    })

    it.each([
      { name: 'disabled', props: { isDisabled: true } },
      { name: 'read-only', props: { isReadOnly: true } },
    ])('cannot be dragged while $name', async ({ props }) => {
      const onChange = jest.fn()
      await render(
        <Switch {...props} onChange={onChange} testID="switch">
          Label
        </Switch>,
      )

      await drag(BEGIN + 15)

      expect(switchOf()).not.toBeChecked()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('turns on for a drag toward the left under a right-to-left layout', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      const onChange = jest.fn()
      await render(
        <Switch onChange={onChange} testID="switch">
          Label
        </Switch>,
      )

      await drag(BEGIN + 15)
      expect(onChange).not.toHaveBeenCalled()

      await drag(BEGIN - 15)
      expect(onChange).toHaveBeenCalledWith(true)
      expect(switchOf()).toBeChecked()
    })

    it('carries the seat with the drag, and grows the handle while it lasts', async () => {
      await render(<Switch testID="switch">Label</Switch>)
      const held = heldDrag()

      await held.begin()
      await held.move(BEGIN + 12)
      expect(seatAt()).toBe(12)
      await held.move(BEGIN + 40)
      expect(seatAt()).toBe(TRAVEL)
      await advance(motion.durationShort2)
      expect(handleOf()).toEqual({
        color: same(colors.onSurfaceVariant),
        size: [28, 28],
      })

      await held.end()

      expect(switchOf()).toBeChecked()
      expect(await settled()).toMatchObject({
        handle: { color: same(colors.onPrimary), size: [24, 24] },
        seat: TRAVEL,
      })
    })

    it('carries the seat the other way under a right-to-left layout', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(<Switch testID="switch">Label</Switch>)
      const held = heldDrag()

      await held.begin()
      await held.move(BEGIN - 12)

      expect(seatAt()).toBe(-12)
    })

    it('eases back from wherever a short drag let the handle go', async () => {
      await render(<Switch testID="switch">Label</Switch>)
      const held = heldDrag()

      await held.begin()
      await held.move(BEGIN + 8)
      await held.end()
      await advance(motion.durationShort2 / 2 - FRAME)

      const seat = seatAt()
      expect(typeof seat).toBe('number')
      expect(seat).toBeGreaterThan(0)
      expect(seat).toBeLessThan(8)
    })

    it('ignores the tap a drag took over on the web, and not the next one', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      const onChange = jest.fn()
      await render(
        <Switch onChange={onChange} testID="switch">
          Label
        </Switch>,
      )

      await fireEvent(switchOf(), 'pressIn', { nativeEvent: {} })
      await drag(BEGIN + 15)
      await fireEvent(switchOf(), 'pressOut', {})
      await fireEvent.press(switchOf())

      expect(switchOf()).toBeChecked()
      expect(onChange).toHaveBeenCalledTimes(1)

      await fireEvent(switchOf(), 'pressIn', { nativeEvent: {} })
      await fireEvent.press(switchOf())

      expect(switchOf()).not.toBeChecked()
    })

    // A touch dragged far enough sends no click at all, so the press that
    // follows is the one to clear what the drag took.
    it('takes the next tap on the web after a drag that sent no click', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await render(<Switch testID="switch">Label</Switch>)

      await fireEvent(switchOf(), 'pressIn', { nativeEvent: {} })
      await drag(BEGIN + 15)
      await fireEvent(switchOf(), 'pressOut', {})
      expect(switchOf()).toBeChecked()

      await fireEvent(switchOf(), 'pressIn', { nativeEvent: {} })
      await fireEvent.press(switchOf())

      expect(switchOf()).not.toBeChecked()
    })

    // React Native Web calls onPress for a click no pointer made, a screen
    // reader's among them, with no press before it.
    it('takes a click with no press before it on the web after a drag', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await render(<Switch testID="switch">Label</Switch>)

      await fireEvent(switchOf(), 'pressIn', { nativeEvent: {} })
      await drag(BEGIN + 15)
      await fireEvent(switchOf(), 'pressOut', {})
      await fireEvent.press(switchOf())
      expect(switchOf()).toBeChecked()

      await fireEvent.press(switchOf())

      expect(switchOf()).not.toBeChecked()
    })

    // Gesture Handler ends the press itself on iOS and Android, so a tap that
    // follows a drag there is a tap of its own.
    it('takes the next tap after a drag on a device', async () => {
      await render(<Switch testID="switch">Label</Switch>)

      await drag(BEGIN + 15)
      await fireEvent.press(switchOf())

      expect(switchOf()).not.toBeChecked()
    })

    it('registers the drag with Gesture Handler only for a switch with a testID', async () => {
      await render(<Switch>Label</Switch>)

      expect(() => getByGestureTestId('undefined-drag')).toThrow(
        "Handler with id: 'undefined-drag' cannot be found",
      )
    })
  })

  describe('appearance', () => {
    it('draws an off switch as an outlined track with a small outline handle', async () => {
      await render(<Switch icon>Label</Switch>)

      expect(await settled()).toEqual({
        fill: same(colors.surfaceContainerHighest),
        handle: { color: same(colors.outline), size: [16, 16] },
        rule: same(colors.outline),
        seat: 0,
      })
      // The icon is the on handle's alone.
      expect(parts().glyph).toBeUndefined()
    })

    it('fills an on switch with primary, its handle on primary at the far end', async () => {
      await render(<Switch defaultSelected>Label</Switch>)

      expect(await settled()).toEqual({
        fill: same(colors.primary),
        handle: { color: same(colors.onPrimary), size: [24, 24] },
        rule: same(colors.primary),
        seat: TRAVEL,
      })
      expect(parts().glyph).toBeUndefined()
    })

    it('draws the check in the on handle when asked for an icon', async () => {
      await render(
        <Switch defaultSelected icon>
          Label
        </Switch>,
      )

      expect(pathOf(parts().glyph)).toBe(checkPath)
      expect(parts().glyph?.props).toMatchObject({
        color: colors.onPrimaryContainer,
        height: 16,
        width: 16,
      })
    })

    it('starts the on handle from the right under a right-to-left layout', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(<Switch defaultSelected>Label</Switch>)

      expect((await settled()).seat).toBe(-TRAVEL)
    })

    it('grows the handle and deepens it while pressed', async () => {
      await render(<Switch>Label</Switch>)

      await fireEvent(switchOf(), 'pressIn', { nativeEvent: {} })
      expect((await settled()).handle).toEqual({
        color: same(colors.onSurfaceVariant),
        size: [28, 28],
      })

      await fireEvent(switchOf(), 'pressOut', {})
      await screen.rerender(<Switch isSelected>Label</Switch>)
      await fireEvent(switchOf(), 'pressIn', { nativeEvent: {} })
      expect((await settled()).handle).toEqual({
        color: same(colors.primaryContainer),
        size: [28, 28],
      })
    })

    it('deepens the handle without growing it while hovered or focused', async () => {
      await render(<Switch>Label</Switch>)

      await fireEvent(switchOf(), 'hoverIn', {})
      expect((await settled()).handle).toEqual({
        color: same(colors.onSurfaceVariant),
        size: [16, 16],
      })
      await fireEvent(switchOf(), 'hoverOut', {})
      expect((await settled()).handle.color).toBe(same(colors.outline))

      await fireEvent(switchOf(), 'focus', {})
      expect((await settled()).handle.color).toBe(same(colors.onSurfaceVariant))
    })

    it('rings the track for focus from a key', async () => {
      await render(<Switch>Label</Switch>)

      await fireEvent(switchOf(), 'focus', {})

      expect(styleOf(parts().track)).toMatchObject({
        borderRadius: radii.pill,
        outlineColor: colors.primary,
        outlineStyle: 'solid',
        outlineWidth: 2,
      })
    })

    it('dims the track, the handle and the label while disabled', async () => {
      await render(
        <Switch icon isDisabled>
          Label
        </Switch>,
      )

      expect(await settled()).toMatchObject({
        fill: same(
          withOpacity(
            colors.surfaceContainerHighest,
            stateLayerOpacity.disabledContainer,
          ),
        ),
        handle: { color: same(DISABLED_CONTENT), size: [16, 16] },
        rule: same(
          withOpacity(colors.onSurface, stateLayerOpacity.disabledContainer),
        ),
      })
      expect(styleOf(screen.getByText('Label')).color).toBe(DISABLED_CONTENT)

      await screen.rerender(
        <Switch icon isDisabled isSelected>
          Label
        </Switch>,
      )

      const fill = withOpacity(
        colors.onSurface,
        stateLayerOpacity.disabledContainer,
      )
      expect(await settled()).toMatchObject({
        fill: same(fill),
        handle: { color: same(colors.surface), size: [24, 24] },
        rule: same(withOpacity(fill, 0)),
      })
      expect(parts().glyph?.props.color).toBe(DISABLED_CONTENT)
    })

    it('keeps the handle at rest under a pointer or a press while read-only', async () => {
      await render(<Switch isReadOnly>Label</Switch>)

      await fireEvent(switchOf(), 'hoverIn', {})
      await fireEvent(switchOf(), 'pressIn', { nativeEvent: {} })

      expect((await settled()).handle).toEqual({
        color: same(colors.outline),
        size: [16, 16],
      })
    })

    it('eases to the on switch over the short duration once pressed', async () => {
      await render(<Switch>Label</Switch>)
      await advance(motion.durationShort2)

      await fireEvent.press(switchOf())
      await advance(motion.durationShort2 / 2)

      const track = getAnimatedStyle(parts().track)
      expect(same(track.backgroundColor)).not.toBe(same(colors.primary))
      expect(same(track.backgroundColor)).not.toBe(
        same(colors.surfaceContainerHighest),
      )
      expect(seatAt()).toBeGreaterThan(0)
      expect(seatAt()).toBeLessThan(TRAVEL)
      expect(handleOf().color).not.toBe(same(colors.onPrimary))
      expect(handleOf().color).not.toBe(same(colors.outline))

      expect(await settled()).toMatchObject({
        fill: same(colors.primary),
        handle: { color: same(colors.onPrimary) },
        seat: TRAVEL,
      })
    })

    it('moves at once for a reader who asks for reduced motion', async () => {
      mockReducedMotion = true
      await render(<Switch>Label</Switch>)

      await fireEvent.press(switchOf())
      await advance(0)

      expect(same(getAnimatedStyle(parts().track).backgroundColor)).toBe(
        same(colors.primary),
      )
      expect(seatAt()).toBe(TRAVEL)
      expect(handleOf()).toEqual({
        color: same(colors.onPrimary),
        size: [24, 24],
      })
    })

    it('reads its colours from the theme around it', async () => {
      await render(
        <ThemeScope theme={PRIMARY}>
          <Switch defaultSelected>Label</Switch>
        </ThemeScope>,
      )

      expect((await settled()).fill).toBe(same('#0b57d0'))
    })

    // On primary container and on primary differ in both schemes, but the
    // dark one is where the icon's role is read against a dark handle.
    it('draws the icon in on primary container in the dark scheme', async () => {
      const dark = scopeFor('dark', {}).theme.colors
      await render(
        <ThemeScope scheme="dark">
          <Switch defaultSelected icon>
            Label
          </Switch>
        </ThemeScope>,
      )

      expect(parts().glyph?.props.color).toBe(dark.onPrimaryContainer)
    })
  })

  describe('the state layer', () => {
    it.each([
      { color: colors.onSurface, name: 'an off switch', props: {} },
      {
        color: colors.primary,
        name: 'an on switch',
        props: { isSelected: true },
      },
    ])(
      'is drawn over $name in one colour, hovered or pressed',
      async ({ color, props }) => {
        await render(<Switch {...props}>Label</Switch>)

        await fireEvent(switchOf(), 'hoverIn', {})
        expect(styleOf(parts().layer)).toMatchObject({
          backgroundColor: color,
          opacity: stateLayerOpacity.hover,
        })

        await fireEvent(switchOf(), 'pressIn', { nativeEvent: {} })
        expect(styleOf(parts().layer)).toMatchObject({
          backgroundColor: color,
          opacity: stateLayerOpacity.pressed,
        })
      },
    )

    it.each([
      { name: 'disabled', props: { isDisabled: true } },
      { name: 'read-only', props: { isReadOnly: true } },
    ])('is not drawn while $name', async ({ props }) => {
      await render(<Switch {...props}>Label</Switch>)

      await fireEvent(switchOf(), 'hoverIn', {})

      expect(styleOf(parts().layer).opacity).toBe(0)
    })

    it('is a 40 disc centred on the handle, clipped to its circle', async () => {
      await render(<Switch>Label</Switch>)

      expect(styleOf(parts().disc)).toMatchObject({
        height: 40,
        position: 'absolute',
        start: -6,
        top: -6,
        width: 40,
      })
      expect(styleOf(parts().surface)).toMatchObject({
        borderRadius: radii.circle,
        overflow: 'hidden',
      })
    })
  })

  describe('measurements', () => {
    it('draws a 52 by 32 track with a 2 rule inside a 52 by 40 control', async () => {
      await render(<Switch>Label</Switch>)

      expect(styleOf(parts().control)).toMatchObject({
        flexShrink: 0,
        height: 40,
        width: 52,
      })
      expect(styleOf(parts().track)).toMatchObject({
        borderRadius: radii.pill,
        borderWidth: 2,
        height: 32,
        width: 52,
      })
      expect(styleOf(parts().seat)).toMatchObject({
        height: 28,
        position: 'absolute',
        start: 0,
        top: 0,
        width: 28,
      })
      expect(styleOf(parts().handle)).toMatchObject({
        borderRadius: radii.circle,
      })
    })

    it('takes presses over a 48dp target', async () => {
      await render(<Switch aria-label="Label" />)

      expect(switchOf().props.hitSlop).toEqual({
        bottom: 4,
        left: 0,
        right: 0,
        top: 4,
      })
    })

    it('sets the label in body large, its first line centred on the track', async () => {
      await render(<Switch>Label</Switch>)

      expect(styleOf(switchOf())).toMatchObject({
        columnGap: spacing.sm,
        flexDirection: 'row',
        minHeight: 40,
      })
      expect(styleOf(screen.getByText('Label'))).toMatchObject({
        color: colors.onSurface,
        fontSize: typography.bodyLargeSize,
        paddingVertical: (40 - typography.bodyLargeLineHeight) / 2,
      })
    })

    it('starts the line under the label past the track', async () => {
      await render(<Switch description="Supporting line">Label</Switch>)

      const line = screen.getByText('Supporting line', {
        includeHiddenElements: true,
      })
      expect(styleOf(child(line.parent))).toEqual({
        marginStart: 52 + spacing.sm,
        marginTop: spacing.xs,
      })
    })
  })

  it('passes style, ref and testID through to the view holding the row', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(
      <Switch ref={ref} style={OFFSET} testID="switch">
        Label
      </Switch>,
    )

    const root = screen.getByTestId('switch')
    expect(styleOf(root)).toEqual({ marginTop: 4 })
    expect(root.children.at(0)).toBe(switchOf())
    expect(ref.current).not.toBeNull()
  })
})
