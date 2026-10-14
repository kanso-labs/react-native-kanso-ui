import type { ComponentRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { TestInstance, TestNode } from 'test-renderer'

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
import { StyleSheet, View } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import { Meter } from '.'
import { scopeFor } from '../../theme/scope'

// What the next meter the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

const { theme } = scopeFor('light', {})
const { colors, motion } = theme

// The row a line is laid out in. What the two gaps and the stop take from it
// leaves 300 for the active indicator and the track.
const WIDTH = 312
const ROOM = 300

const BYTES = {
  notation: 'compact',
  style: 'unit',
  unit: 'gigabyte',
} as const

const OFFSET = { marginTop: 4 }

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

function child(node: TestNode | undefined): TestInstance {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

function fillOf(element: TestInstance) {
  return styleOf(element).backgroundColor
}

// Lays the line out at `width`, which is what it draws to.
async function layOut(width = WIDTH) {
  await fireEvent(line(), 'layout', {
    nativeEvent: { layout: { height: 4, width, x: 0, y: 0 } },
  })
  // A style drawn to the new width follows on the next frame.
  await advance(0)
}

// The row the line is measured in.
function line() {
  const [measured] = meter().queryAll(
    (node) => typeof node.props.onLayout === 'function',
  )
  return child(measured)
}

// The three parts of the line, in order along it.
function lineParts() {
  const row = child(line().children.at(0))
  return {
    active: child(row.children.at(0)),
    stop: child(row.children.at(2)),
    track: child(row.children.at(1)),
  }
}

function meter() {
  return screen.getByRole('meter')
}

function styleOf(element: { props: { style?: StyleProp<ViewStyle> } }) {
  return StyleSheet.flatten([element.props.style])
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  mockReducedMotion = false
  jest.useRealTimers()
})

describe('Meter', () => {
  describe('semantics', () => {
    it('is announced as a meter named by its label', async () => {
      await render(<Meter label="Label" value={40} />)

      expect(screen.getByRole('meter', { name: 'Label' })).toBeTruthy()
      expect(screen.queryByRole('progressbar')).toBeNull()
    })

    it('takes its name from aria-label when nothing shows one', async () => {
      await render(<Meter aria-label="Label" value={40} />)

      expect(screen.getByRole('meter', { name: 'Label' })).toBeTruthy()
    })

    it('carries its range and its value as a percentage', async () => {
      await render(<Meter label="Label" value={40} />)

      expect(meter().props).toMatchObject({
        'aria-valuemax': 100,
        'aria-valuemin': 0,
        'aria-valuenow': 40,
        'aria-valuetext': '40%',
      })
    })

    it('reads the value on the scale it is given', async () => {
      await render(<Meter label="Label" maxValue={5} minValue={1} value={4} />)

      expect(meter().props).toMatchObject({
        'aria-valuemax': 5,
        'aria-valuemin': 1,
        'aria-valuenow': 4,
        'aria-valuetext': '75%',
      })
    })

    it('clamps a value outside its scale', async () => {
      await render(<Meter label="Label" value={-20} />)

      expect(meter().props).toMatchObject({
        'aria-valuenow': 0,
        'aria-valuetext': '0%',
      })
    })
  })

  describe('value', () => {
    it('shows the value beside the label', async () => {
      await render(<Meter label="Label" value={40} />)

      expect(screen.getByText('Label')).toBeTruthy()
      expect(screen.getByText('40%')).toBeTruthy()
    })

    it('hides the value when asked, and still announces it', async () => {
      await render(<Meter label="Label" showValue={false} value={40} />)

      expect(screen.queryByText('40%')).toBeNull()
      expect(meter().props['aria-valuetext']).toBe('40%')
    })

    it('writes the value itself under a unit format, in the locale', async () => {
      await render(
        <Meter
          formatOptions={BYTES}
          label="Label"
          locale="de-DE"
          maxValue={512}
          value={318}
        />,
      )
      const written = new Intl.NumberFormat('de-DE', BYTES).format(318)

      expect(screen.getByText(written)).toBeTruthy()
      expect(meter().props['aria-valuetext']).toBe(written)
    })

    it('writes a percentage in the locale', async () => {
      await render(<Meter label="Label" locale="de-DE" value={40} />)

      expect(
        screen.getByText(
          new Intl.NumberFormat('de-DE', { style: 'percent' }).format(0.4),
        ),
      ).toBeTruthy()
    })

    it('says the value in words given a valueLabel', async () => {
      await render(<Meter label="Label" value={4} valueLabel="Fourth item" />)

      expect(screen.getByText('Fourth item')).toBeTruthy()
      expect(meter().props['aria-valuetext']).toBe('Fourth item')
    })

    it('draws no label row when there is neither a label nor a value', async () => {
      await render(<Meter aria-label="Label" showValue={false} value={40} />)

      expect(meter().children).toHaveLength(1)
      expect(meter().children.at(0)).toBe(line())
    })
  })

  describe('appearance', () => {
    it('draws primary over secondary container, with the stop in primary', async () => {
      await render(<Meter label="Label" value={40} />)
      const { active, stop, track } = lineParts()

      expect(fillOf(active)).toBe(colors.primary)
      expect(fillOf(track)).toBe(colors.secondaryContainer)
      expect(fillOf(stop)).toBe(colors.primary)
    })

    it.each(['negative', 'positive'] as const)(
      'recolours the active and stop indicators alone under %s',
      async (tone) => {
        await render(<Meter label="Label" tone={tone} value={40} />)
        const { active, stop, track } = lineParts()

        expect(fillOf(active)).toBe(colors[tone])
        expect(fillOf(stop)).toBe(colors[tone])
        expect(fillOf(track)).toBe(colors.secondaryContainer)
      },
    )
  })

  describe('geometry', () => {
    it('gives the active indicator its share of what the gaps and the stop leave', async () => {
      await render(<Meter label="Label" value={40} />)
      await layOut()

      expect(getAnimatedStyle(lineParts().active).width).toBe(ROOM * 0.4)
    })

    it('stretches the line across the meter', async () => {
      await render(<Meter label="Label" value={40} />)

      expect(styleOf(line()).alignSelf).toBe('stretch')
    })

    it('eases to a new value over the medium duration', async () => {
      const { rerender } = await render(<Meter label="Label" value={40} />)
      await layOut()
      await rerender(<Meter label="Label" value={80} />)
      await advance(motion.durationMedium1 / 2)
      const midway = getAnimatedStyle(lineParts().active).width

      expect(midway).toBeGreaterThan(ROOM * 0.4)
      expect(midway).toBeLessThan(ROOM * 0.8)

      await advance(motion.durationMedium1)

      expect(getAnimatedStyle(lineParts().active).width).toBe(ROOM * 0.8)
    })

    it('moves to a new value at once under reduced motion', async () => {
      mockReducedMotion = true
      const { rerender } = await render(<Meter label="Label" value={40} />)
      await layOut()
      await rerender(<Meter label="Label" value={80} />)
      await advance(0)

      expect(getAnimatedStyle(lineParts().active).width).toBe(ROOM * 0.8)
    })
  })

  it('puts the style, ref and testID on the meter as a whole', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(
      <Meter
        label="Label"
        ref={ref}
        style={OFFSET}
        testID="meter"
        value={40}
      />,
    )

    expect(screen.getByTestId('meter')).toBe(meter())
    expect(styleOf(meter())).toMatchObject(OFFSET)
    expect(typeof ref.current?.measure).toBe('function')
  })
})
