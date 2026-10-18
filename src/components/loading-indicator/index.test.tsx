import type { ComponentRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { TestInstance } from 'test-renderer'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { act, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { StyleSheet, View } from 'react-native'

import { LoadingIndicator } from '.'
import { scopeFor } from '../../theme/scope'

// What the next indicator the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

// A path drawn as a plain element, so Reanimated's record of an animated
// path's later frames, which it keeps beside the path in Jest, reads as
// written; react-native-svg's own Path would drop it. Reanimated moves a path
// through `setNativeProps`, which has nothing to do here.
jest.mock('react-native-svg', () => {
  const { Component, createElement } =
    jest.requireActual<typeof import('react')>('react')

  class Path extends Component {
    render() {
      return createElement('Path', this.props)
    }

    setNativeProps() {}
  }

  return {
    __esModule: true,
    ...jest.requireActual<object>('react-native-svg'),
    Path,
  }
})

const { theme } = scopeFor('light', {})
const { colors, radii } = theme

// The shapes' box and its centre, and a full turn in degrees.
const CENTRE = 50
const DEGREES = 360

// How far each shape reaches from the centre at its first point, at three
// o'clock before it turns, and at its farthest, which between them tell the
// seven apart.
const SHAPES = {
  cookie4Sided: [29, 39.605],
  cookie9Sided: [32.5, 33.964],
  oval: [30, 39.322],
  pentagon: [32, 35.224],
  pill: [32.6, 34.838],
  softBurst: [26, 32.846],
  sunny: [33, 33],
}

// A style a call site hands the indicator.
const MARGIN = { margin: 8 }

// The order the page morphs through, back to the first.
const ORDER = [
  SHAPES.softBurst,
  SHAPES.cookie9Sided,
  SHAPES.pentagon,
  SHAPES.pill,
  SHAPES.sunny,
  SHAPES.cookie4Sided,
  SHAPES.oval,
  SHAPES.softBurst,
]

// One morph's interval, and the spin's period, at the page's rate and
// slowed under reduced motion.
const MORPH_MS = 650
const SPIN_MS = 4666
const SLOW_MORPH_MS = MORPH_MS * 1.25
const SLOW_SPIN_MS = Math.round(SPIN_MS * 1.25)

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// How far the shape has turned, clockwise from three o'clock, in degrees:
// where its first point is, which starts there.
function angleOf() {
  const [[x, y]] = pointsOf()
  const angle = (Math.atan2(y - CENTRE, x - CENTRE) * DEGREES) / (2 * Math.PI)
  return angle < 0 ? angle + DEGREES : angle
}

// The frame Reanimated last drew the shape at, which it records beside the
// path in Jest, over the path's own props.
function frameOf(props: Record<string, unknown>) {
  const record: unknown = props.jestAnimatedProps
  if (typeof record === 'object' && record !== null && 'value' in record) {
    const { value } = record
    return typeof value === 'object' ? value : undefined
  }
  return undefined
}

function indicator() {
  return screen.getByRole('progressbar')
}

function path(): Record<string, unknown> {
  const [shape] = indicator().queryAll((each) => each.type === 'Path')
  return Object.assign({}, shape.props, frameOf(shape.props))
}

// Every point the shape's path passes through, in order.
function pointsOf() {
  const { d } = path()
  if (typeof d !== 'string') {
    throw new TypeError('expected a path')
  }
  const numbers = (d.match(/-?\d+(?:\.\d+)?/gu) ?? []).map(Number)
  const points: number[][] = []
  for (let index = 0; index < numbers.length; index += 2) {
    points.push([numbers[index], numbers[index + 1]])
  }
  return points
}

// How far the shape reaches at its first point and at its farthest.
function reachOf() {
  const reaches = pointsOf().map(([x, y]) => Math.hypot(x - CENTRE, y - CENTRE))
  return [reaches[0], Math.max(...reaches)]
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function svg(): TestInstance {
  const [found] = indicator().queryAll((each) =>
    each.type.startsWith('RNSVGSvgView'),
  )
  return found
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  mockReducedMotion = false
  jest.useRealTimers()
})

describe('LoadingIndicator', () => {
  it('is a busy progress bar with no value, named by its label', async () => {
    await render(<LoadingIndicator aria-label="Label" />)

    expect(indicator()).toBe(screen.getByRole('progressbar', { name: 'Label' }))
    expect(indicator()).toBeBusy()
    expect(indicator().props['aria-valuenow']).toBeUndefined()
  })

  it('is named by what it is labelled by', async () => {
    await render(<LoadingIndicator aria-labelledby="title" />)

    expect(indicator()).toHaveProp('aria-labelledby', 'title')
  })

  it('hides its shape from a screen reader', async () => {
    await render(<LoadingIndicator aria-label="Label" />)

    expect(svg().props).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    })
  })

  it('is a 48dp circle with the shape drawn over all of it', async () => {
    await render(<LoadingIndicator aria-label="Label" />)

    expect(styleOf(indicator())).toMatchObject({
      borderRadius: radii.circle,
      height: 48,
      width: 48,
    })
    expect(styleOf(svg())).toMatchObject({ height: 48, width: 48 })
    expect(svg().props).toMatchObject({ vbHeight: 100, vbWidth: 100 })
    expect(pointsOf()).toHaveLength(90)
  })

  it('draws the shape in primary on nothing', async () => {
    await render(<LoadingIndicator aria-label="Label" />)

    expect(path().fill).toBe(colors.primary)
    expect(styleOf(indicator()).backgroundColor).toBeUndefined()
  })

  it('draws the shape in on primary container on primary container when contained', async () => {
    await render(<LoadingIndicator aria-label="Label" contained />)

    expect(path().fill).toBe(colors.onPrimaryContainer)
    expect(styleOf(indicator()).backgroundColor).toBe(colors.primaryContainer)
  })

  it('morphs through the seven shapes in order, one every 650ms', async () => {
    await render(<LoadingIndicator aria-label="Label" />)
    const reached = [reachOf()]

    for (let morph = 1; morph < ORDER.length; morph++) {
      // oxlint-disable-next-line no-await-in-loop -- each step reads the frame the one before it left
      await advance(MORPH_MS)
      reached.push(reachOf())
    }

    expect(reached).toEqual(
      ORDER.map((reach) => reach.map((each) => expect.closeTo(each, 2))),
    )
  })

  it('overshoots each shape on its spring before settling on it', async () => {
    await render(<LoadingIndicator aria-label="Label" />)
    await advance(MORPH_MS / 2)

    // Halfway through, the spring is at 1.079 of the way from the soft
    // burst's 26 to the nine-sided cookie's 32.5.
    expect(reachOf()[0]).toBeCloseTo(26 + 6.5 * 1.079, 2)
  })

  it('turns a quarter with each morph, over a turn every 4666ms', async () => {
    await render(<LoadingIndicator aria-label="Label" />)
    const angles = [angleOf()]

    for (let morph = 1; morph <= 4; morph++) {
      // oxlint-disable-next-line no-await-in-loop -- each step reads the frame the one before it left
      await advance(MORPH_MS)
      angles.push(angleOf())
    }

    expect(angles).toEqual(
      [0, 1, 2, 3, 4].map((morph) =>
        expect.closeTo(
          (morph * 90 + ((morph * MORPH_MS) / SPIN_MS) * DEGREES) % DEGREES,
          1,
        ),
      ),
    )
  })

  it('turns on the spring between quarters', async () => {
    await render(<LoadingIndicator aria-label="Label" />)
    await advance(MORPH_MS / 2)

    expect(angleOf()).toBeCloseTo(
      90 * 1.079 + (MORPH_MS / 2 / SPIN_MS) * DEGREES,
      1,
    )
  })

  it('runs a quarter slower under reduced motion rather than stopping', async () => {
    mockReducedMotion = true
    await render(<LoadingIndicator aria-label="Label" />)
    await advance(SLOW_MORPH_MS * 2)

    expect(reachOf()).toEqual(
      SHAPES.pentagon.map((each) => expect.closeTo(each, 2)),
    )
    expect(angleOf()).toBeCloseTo(
      180 + ((SLOW_MORPH_MS * 2) / SLOW_SPIN_MS) * DEGREES,
      1,
    )
  })

  it('puts style, ref and testID on the container', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(
      <LoadingIndicator
        aria-label="Label"
        ref={ref}
        style={MARGIN}
        testID="indicator"
      />,
    )

    expect(screen.getByTestId('indicator')).toBe(indicator())
    expect(styleOf(indicator())).toMatchObject({ margin: 8, width: 48 })
    expect(ref.current).not.toBeNull()
  })
})
