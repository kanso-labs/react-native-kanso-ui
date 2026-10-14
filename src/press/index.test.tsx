import type { StyleProp, ViewStyle } from 'react-native'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Pressable, StyleSheet } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { PressFeedbackOptions } from '.'

import { hitSlop, usePressFeedback } from '.'
import { scopeFor } from '../theme/scope'

// What the next control the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

const COLOR = '#1d1b20'
const CORNERS = { borderRadius: 12 }

const { theme } = scopeFor('light', {})
const { motion, spacing, stateLayerOpacity } = theme

type Options = Partial<Omit<PressFeedbackOptions, 'color'>>

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// A bare control, drawn the way every component draws its feedback.
function Control(options: Options) {
  const feedback = usePressFeedback({ color: COLOR, ...options })

  return (
    <Pressable {...feedback.handlers} style={feedback.ring} testID="control">
      {feedback.layer}
    </Pressable>
  )
}

function control() {
  return screen.getByTestId('control')
}

function drawnRipple() {
  const drawn = parts().ripple
  if (drawn === undefined) {
    throw new Error('expected a ripple to be drawn')
  }
  return drawn
}

function layerOpacity() {
  return styleOf(parts().layer).opacity
}

// The surface the feedback draws in, and the layer and, while one is drawn,
// the ripple inside it.
function parts() {
  const surface = control().children.at(0)
  if (surface === undefined || typeof surface === 'string') {
    throw new TypeError('expected the feedback to be a view')
  }
  const layer = surface.children.at(0)
  const ripple = surface.children.at(1)
  if (
    layer === undefined ||
    typeof layer === 'string' ||
    typeof ripple === 'string'
  ) {
    throw new TypeError('expected the layer and the ripple to be views')
  }
  return { layer, ripple, surface }
}

// A press at a point on the page, on a control measured at another. A control
// 100 by 40 whose corner is at (10, 20), pressed at (30, 30), is pressed 20
// in and 10 down.
function pressAt(pageX?: number, pageY?: number) {
  return {
    currentTarget: {
      measure: (
        callback: (
          ...values: [number, number, number, number, number, number]
        ) => void,
      ) => {
        callback(0, 0, 100, 40, 10, 20)
      },
    },
    nativeEvent: { pageX, pageY },
  }
}

function styleOf(element: { props: { style?: StyleProp<ViewStyle> } }) {
  return StyleSheet.flatten([element.props.style])
}

// How far across the ripple has moved.
function translateX(): unknown {
  const { transform }: { transform?: unknown } = getAnimatedStyle(drawnRipple())
  const first: unknown = Array.isArray(transform) ? transform.at(0) : undefined

  return typeof first === 'object' && first !== null && 'translateX' in first
    ? first.translateX
    : undefined
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  mockReducedMotion = false
  jest.useRealTimers()
})

describe('hitSlop', () => {
  it('brings a 32dp control up to a 48dp target', () => {
    expect(hitSlop(32, 32)).toEqual({ bottom: 8, left: 8, right: 8, top: 8 })
  })

  it('adds nothing to a 48dp control', () => {
    expect(hitSlop(48, 48)).toBeUndefined()
  })

  it('takes a control with no width as wide enough', () => {
    expect(hitSlop(40)).toEqual({ bottom: 4, left: 0, right: 0, top: 4 })
  })
})

describe('the state layer', () => {
  it('draws the hover opacity while a pointer is over the control', async () => {
    await render(<Control />)

    await fireEvent(control(), 'hoverIn', {})
    expect(styleOf(parts().layer)).toMatchObject({
      backgroundColor: COLOR,
      opacity: stateLayerOpacity.hover,
    })

    await fireEvent(control(), 'hoverOut', {})
    expect(layerOpacity()).toBe(0)
  })

  it('draws the focus opacity while the ring shows', async () => {
    await render(<Control />)

    await fireEvent(control(), 'focus', {})
    expect(layerOpacity()).toBe(stateLayerOpacity.focus)

    await fireEvent(control(), 'blur', {})
    expect(layerOpacity()).toBe(0)
  })

  it('draws the pressed opacity while pressed, over hover and focus', async () => {
    await render(<Control />)

    await fireEvent(control(), 'hoverIn', {})
    await fireEvent(control(), 'focus', {})
    await fireEvent(control(), 'pressIn', pressAt(30, 30))
    expect(layerOpacity()).toBe(stateLayerOpacity.pressed)

    await fireEvent(control(), 'pressOut', {})
    expect(layerOpacity()).toBe(stateLayerOpacity.focus)
  })

  it('draws nothing on a disabled control', async () => {
    await render(<Control disabled />)

    await fireEvent(control(), 'hoverIn', {})
    expect(layerOpacity()).toBe(0)
  })

  it('clips to the corners it is given', async () => {
    await render(<Control corners={CORNERS} />)

    expect(styleOf(parts().surface)).toMatchObject({
      borderRadius: 12,
      overflow: 'hidden',
    })
  })
})

describe('the focus ring', () => {
  it('shows when focus arrives from a key', async () => {
    await render(<Control />)

    await fireEvent(control(), 'focus', {})

    expect(styleOf(control())).toMatchObject({
      outlineColor: theme.colors.primary,
      outlineOffset: 2,
      outlineStyle: 'solid',
      outlineWidth: 2,
    })

    await fireEvent(control(), 'blur', {})
    expect(styleOf(control()).outlineWidth).toBeUndefined()
  })

  it('does not show when focus arrives with a press', async () => {
    await render(<Control />)

    await fireEvent(control(), 'pressIn', pressAt(30, 30))
    await fireEvent(control(), 'focus', {})
    await fireEvent(control(), 'pressOut', {})

    expect(styleOf(control()).outlineWidth).toBeUndefined()
    expect(layerOpacity()).toBe(0)
  })

  it('shows for a key once a touch that focused nothing has ended', async () => {
    await render(<Control />)

    await fireEvent(control(), 'pressIn', pressAt(30, 30))
    await fireEvent(control(), 'pressOut', {})
    await fireEvent(control(), 'focus', {})

    expect(styleOf(control()).outlineWidth).toBe(2)
  })

  it('does not show on a disabled control', async () => {
    await render(<Control disabled />)

    await fireEvent(control(), 'focus', {})

    expect(styleOf(control()).outlineWidth).toBeUndefined()
  })
})

describe('the ripple', () => {
  const size = 20
  const scale = (Math.hypot(100, 40) + spacing.sm) / size

  it('starts at the press point and grows to cover the control', async () => {
    await render(<Control />)

    await fireEvent(control(), 'pressIn', pressAt(30, 30))
    // The style follows the animation on the next frame.
    await advance(0)

    expect(getAnimatedStyle(drawnRipple())).toMatchObject({
      height: size,
      transform: [{ translateX: 10 }, { translateY: 0 }, { scale: 1 }],
      width: size,
    })

    // The standard easing has covered more than half the way by half the
    // time.
    await advance(motion.durationLong1 / 2)

    expect(translateX()).toBeGreaterThan(25)

    await advance(motion.durationLong1 / 2)

    expect(getAnimatedStyle(drawnRipple())).toMatchObject({
      opacity: stateLayerOpacity.pressed,
      transform: [{ translateX: 40 }, { translateY: 10 }, { scale }],
    })
    expect(getAnimatedStyle(drawnRipple()).backgroundColor).toBe(COLOR)
  })

  it('starts at the centre for a press with no point', async () => {
    await render(<Control />)

    await fireEvent(control(), 'pressIn', pressAt())
    await advance(0)

    expect(getAnimatedStyle(drawnRipple())).toMatchObject({
      transform: [{ translateX: 40 }, { translateY: 10 }, { scale: 1 }],
    })
  })

  it('fades once the press ends, after showing for the least it may', async () => {
    await render(<Control />)

    await fireEvent(control(), 'pressIn', pressAt(30, 30))
    await advance(50)
    await fireEvent(control(), 'pressOut', {})
    await advance(motion.durationMedium1 - 50 - 1)

    expect(getAnimatedStyle(drawnRipple()).opacity).toBe(
      stateLayerOpacity.pressed,
    )

    await advance(375 + 1)

    expect(getAnimatedStyle(drawnRipple()).opacity).toBe(0)
  })

  it('is drawn whole for a press that ends before the control is measured', async () => {
    let measured: (() => void) | undefined
    await render(<Control />)

    await fireEvent(control(), 'pressIn', {
      currentTarget: {
        measure: (
          callback: (
            ...values: [number, number, number, number, number, number]
          ) => void,
        ) => {
          measured = () => {
            callback(0, 0, 100, 40, 10, 20)
          }
        },
      },
      nativeEvent: { pageX: 30, pageY: 30 },
    })
    await fireEvent(control(), 'pressOut', {})
    await act(() => {
      measured?.()
    })
    await advance(105)

    expect(getAnimatedStyle(drawnRipple()).opacity).toBe(
      stateLayerOpacity.pressed,
    )

    await advance(motion.durationMedium1 + 375)

    expect(getAnimatedStyle(drawnRipple()).opacity).toBe(0)
  })

  it('is not drawn under reduced motion, where the layer marks the press', async () => {
    mockReducedMotion = true
    await render(<Control />)

    await fireEvent(control(), 'pressIn', pressAt(30, 30))

    expect(parts().ripple).toBeUndefined()
    expect(layerOpacity()).toBe(stateLayerOpacity.pressed)
  })

  it('is not drawn when turned off, and leaves the layer', async () => {
    await render(<Control disableRipple />)

    await fireEvent(control(), 'pressIn', pressAt(30, 30))

    expect(parts().ripple).toBeUndefined()
    expect(layerOpacity()).toBe(stateLayerOpacity.pressed)
  })
})

describe('the handlers', () => {
  it('call the ones the control was given', async () => {
    const calls: string[] = []
    const record = (name: string) => () => {
      calls.push(name)
    }
    await render(
      <Control
        onBlur={record('blur')}
        onFocus={record('focus')}
        onHoverIn={record('hoverIn')}
        onHoverOut={record('hoverOut')}
        onPressIn={record('pressIn')}
        onPressOut={record('pressOut')}
      />,
    )

    await fireEvent(control(), 'hoverIn', {})
    await fireEvent(control(), 'hoverOut', {})
    await fireEvent(control(), 'focus', {})
    await fireEvent(control(), 'blur', {})
    await fireEvent(control(), 'pressIn', pressAt(30, 30))
    await fireEvent(control(), 'pressOut', {})

    expect(calls).toEqual([
      'hoverIn',
      'hoverOut',
      'focus',
      'blur',
      'pressIn',
      'pressOut',
    ])
  })
})
