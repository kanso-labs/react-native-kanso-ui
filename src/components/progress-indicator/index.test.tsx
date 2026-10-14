import type { ComponentRef, ReactElement } from 'react'
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
import { I18nManager, StyleSheet, View } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import { ProgressIndicator } from '.'
import { IconStyleContext } from '../../glyphs/icon-style'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

// What the next indicator the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

// A path drawn as a plain element, so what the indicator hands it reads as
// written, and so does Reanimated's record of an animated path's later frames,
// which it keeps on the side in Jest rather than on the element and which
// react-native-svg's own Path would drop. Reanimated moves a path through
// `setNativeProps`, which has nothing to do here.
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
const { colors, motion } = theme

// The row a line is laid out in. What the two gaps and the stop take from it
// leaves 300 for the active indicator and the track.
const WIDTH = 312
const ROOM = 300

// A slot's colour, as a button hands its content colour to what it holds.
const SLOT = '#6750a4'
const SLOT_STYLE = { color: SLOT, size: 20 }

// A value with a unit, which the indicator writes as given rather than as a
// share.
const MEGABYTES = { style: 'unit', unit: 'megabyte' } as const

// A full turn, and the flat ring's circle on its 40-unit box.
const TURN = 2 * Math.PI
const CENTRE = 20
const RADIUS = 18
const CIRCUMFERENCE = TURN * RADIUS

// The indeterminate line's bars start this far before the row, as shares of
// it, which is where web's keyframes put them.
const PRIMARY_START = -1.45167
const SECONDARY_START = -0.548889

const OFFSET = { marginTop: 4 }

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// How far round from the top a point on the flat ring is, clockwise.
function angleOf([x, y]: readonly number[]) {
  const angle = Math.atan2(x - CENTRE, CENTRE - y)
  return angle < 0 ? angle + TURN : angle
}

// The ring's paths, the track first when there is one.
function arcs() {
  return pathsIn(indicator())
}

// The indeterminate line's row, its track and its two bars.
function bars() {
  const row = child(line().children.at(0))
  return {
    primary: child(row.children.at(1)),
    row,
    secondary: child(row.children.at(2)),
    track: child(row.children.at(0)),
  }
}

// The buffered line's track, what it fills solid, and its row of dots.
function bufferParts() {
  const { track } = lineParts()
  const dots = child(track.children.at(1))
  return {
    buffered: child(track.children.at(0)),
    row: child(dots.children.at(0)),
    track,
  }
}

function child(node: TestNode | undefined): TestInstance {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

// Where an arc starts and ends, read off its path.
function endsOf(d: unknown) {
  if (typeof d !== 'string') {
    throw new TypeError('expected a path')
  }
  const numbers = (d.match(/-?\d+(?:\.\d+)?/gu) ?? []).map(Number)
  return [numbers.slice(0, 2), numbers.slice(-2)]
}

function fillOf(element: TestInstance) {
  return styleOf(element).backgroundColor
}

// The frame Reanimated last drew an animated path at, which it records
// beside the path in Jest.
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

// Lays the line out at `width`, which is what it draws to.
async function layOut(width = WIDTH) {
  await fireEvent(line(), 'layout', {
    nativeEvent: { layout: { height: 4, width, x: 0, y: 0 } },
  })
  // A style drawn to the new width follows on the next frame.
  await advance(0)
}

// The view a line is measured in: the row the flat line runs along, or the
// taller one a wave runs along.
function line() {
  const [measured] = indicator().queryAll(
    (node) => typeof node.props.onLayout === 'function',
  )
  return child(measured)
}

// The three parts of the determinate line, in order along it.
function lineParts() {
  const row = child(line().children.at(0))
  return {
    active: child(row.children.at(0)),
    stop: child(row.children.at(2)),
    track: child(row.children.at(1)),
  }
}

// What each path in `node` draws now: its own props, with an animated
// path's latest frame over them.
function pathsIn(node: TestInstance) {
  return node
    .queryAll((each) => each.type === 'Path')
    .map((path): Record<string, unknown> =>
      Object.assign({}, path.props, frameOf(path.props)),
    )
}

function pointsOf(d: unknown) {
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

function styleOf(element: { props: { style?: StyleProp<ViewStyle> } }) {
  return StyleSheet.flatten([element.props.style])
}

function svgsIn(node: TestInstance) {
  return node.queryAll((each) => each.type.startsWith('RNSVGSvgView'))
}

// A transform's steps, flattened into one object.
function transformOf(style: { transform?: unknown }) {
  const steps: unknown[] = Array.isArray(style.transform) ? style.transform : []
  const merged: Record<string, unknown> = {}
  for (const step of steps) {
    Object.assign(merged, step)
  }
  return merged
}

function withSlot(element: ReactElement) {
  return <IconStyleContext value={SLOT_STYLE}>{element}</IconStyleContext>
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  mockReducedMotion = false
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('ProgressIndicator', () => {
  describe('semantics', () => {
    it('is announced as a progress bar named by its label', async () => {
      await render(<ProgressIndicator label="Label" value={40} />)

      expect(screen.getByRole('progressbar', { name: 'Label' })).toBeTruthy()
      expect(screen.getByText('Label')).toBeTruthy()
    })

    it('takes its name from aria-label when nothing shows one', async () => {
      await render(<ProgressIndicator aria-label="Label" value={40} />)

      expect(screen.getByRole('progressbar', { name: 'Label' })).toBeTruthy()
    })

    it('carries its range and its value as a percentage', async () => {
      await render(<ProgressIndicator label="Label" value={40} />)

      expect(indicator().props).toMatchObject({
        'aria-valuemax': 100,
        'aria-valuemin': 0,
        'aria-valuenow': 40,
        'aria-valuetext': '40%',
      })
    })

    it('reads the value as a share of its own range', async () => {
      await render(
        <ProgressIndicator
          label="Label"
          maxValue={20}
          minValue={10}
          value={15}
        />,
      )

      expect(indicator().props).toMatchObject({
        'aria-valuemax': 20,
        'aria-valuemin': 10,
        'aria-valuenow': 15,
        'aria-valuetext': '50%',
      })
    })

    it('clamps a value outside its range', async () => {
      await render(<ProgressIndicator label="Label" value={140} />)

      expect(indicator().props).toMatchObject({
        'aria-valuenow': 100,
        'aria-valuetext': '100%',
      })
    })

    it('writes the value as formatOptions say, in the locale', async () => {
      await render(
        <ProgressIndicator
          formatOptions={MEGABYTES}
          label="Label"
          locale="de-DE"
          maxValue={250}
          showValue
          value={125.5}
        />,
      )
      const written = new Intl.NumberFormat('de-DE', MEGABYTES).format(125.5)

      expect(indicator().props['aria-valuetext']).toBe(written)
      expect(screen.getByText(written)).toBeTruthy()
    })

    it('writes a percentage in the locale', async () => {
      await render(
        <ProgressIndicator label="Label" locale="de-DE" value={40} />,
      )

      expect(indicator().props['aria-valuetext']).toBe(
        new Intl.NumberFormat('de-DE', { style: 'percent' }).format(0.4),
      )
    })

    it('says the value in words given a valueLabel', async () => {
      await render(
        <ProgressIndicator
          label="Label"
          showValue
          value={2}
          valueLabel="Second item"
        />,
      )

      expect(indicator().props['aria-valuetext']).toBe('Second item')
      expect(screen.getByText('Second item')).toBeTruthy()
    })

    it('shows the value beside the label only when asked', async () => {
      await render(<ProgressIndicator label="Label" value={40} />)

      expect(screen.queryByText('40%')).toBeNull()

      await render(<ProgressIndicator label="Label" showValue value={40} />)

      expect(screen.getByText('40%')).toBeTruthy()
    })

    it('lets a long label break inside itself rather than widen the row', async () => {
      await render(<ProgressIndicator label="Label" showValue value={40} />)

      expect(styleOf(screen.getByText('Label'))).toMatchObject({
        flexShrink: 1,
        minWidth: 0,
      })
    })

    it('has no value to announce or show while indeterminate', async () => {
      await render(
        <ProgressIndicator
          isIndeterminate
          label="Label"
          showValue
          value={40}
        />,
      )

      expect(indicator().props['aria-valuenow']).toBeUndefined()
      expect(indicator().props['aria-valuetext']).toBeUndefined()
      expect(screen.queryByText('40%')).toBeNull()
    })

    it('keeps its drawing from screen readers', async () => {
      await render(
        <ProgressIndicator label="Label" value={40} variant="circular" />,
      )
      const [svg] = svgsIn(indicator())

      expect(svg.props).toMatchObject({
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      })
    })
  })

  describe('as a line', () => {
    it('gives the active indicator its share of what the gaps and the stop leave', async () => {
      await render(<ProgressIndicator label="Label" value={40} />)
      await layOut()

      expect(getAnimatedStyle(lineParts().active).width).toBe(ROOM * 0.4)
    })

    it('eases to a new value over the medium duration', async () => {
      const { rerender } = await render(
        <ProgressIndicator label="Label" value={40} />,
      )
      await layOut()
      await rerender(<ProgressIndicator label="Label" value={80} />)
      await advance(motion.durationMedium1 / 2)
      const midway = getAnimatedStyle(lineParts().active).width

      expect(midway).toBeGreaterThan(ROOM * 0.4)
      expect(midway).toBeLessThan(ROOM * 0.8)

      await advance(motion.durationMedium1)

      expect(getAnimatedStyle(lineParts().active).width).toBe(ROOM * 0.8)
    })

    it('moves to a new value at once under reduced motion', async () => {
      mockReducedMotion = true
      const { rerender } = await render(
        <ProgressIndicator label="Label" value={40} />,
      )
      await layOut()
      await rerender(<ProgressIndicator label="Label" value={80} />)
      await advance(0)

      expect(getAnimatedStyle(lineParts().active).width).toBe(ROOM * 0.8)
    })

    it('draws primary over secondary container, with the stop in primary', async () => {
      await render(<ProgressIndicator label="Label" value={40} />)
      const { active, stop, track } = lineParts()

      expect(fillOf(active)).toBe(colors.primary)
      expect(fillOf(track)).toBe(colors.secondaryContainer)
      expect(fillOf(stop)).toBe(colors.primary)
    })

    it('takes the colour of its slot under inherit, and a quarter of it for the track', async () => {
      await render(
        withSlot(<ProgressIndicator label="Label" tone="inherit" value={40} />),
      )
      const { active, stop, track } = lineParts()

      expect(fillOf(active)).toBe(SLOT)
      expect(fillOf(track)).toBe(withOpacity(SLOT, 0.25))
      expect(fillOf(stop)).toBe(SLOT)
    })

    it('takes on surface under inherit outside a slot', async () => {
      await render(
        <ProgressIndicator label="Label" tone="inherit" value={40} />,
      )

      expect(fillOf(lineParts().active)).toBe(colors.onSurface)
    })
  })

  describe('buffered', () => {
    it('fills the track solid up to the buffer and dots it beyond', async () => {
      await render(<ProgressIndicator buffer={70} label="Label" value={30} />)
      await layOut()
      const { buffered, row, track } = bufferParts()

      // The buffer's share of what the value leaves: 40 of the 70 left.
      expect(styleOf(buffered).width).toBe(`${(40 / 70) * 100}%`)
      expect(fillOf(buffered)).toBe(colors.secondaryContainer)
      expect(fillOf(track)).toBeUndefined()
      // One more dot than the row has room for, so it stays full as they
      // scroll.
      expect(row.children).toHaveLength(Math.ceil(WIDTH / 10) + 1)
      expect(fillOf(child(row.children.at(0)))).toBe(colors.secondaryContainer)
    })

    it('reads the buffer on the value’s own scale', async () => {
      await render(
        <ProgressIndicator
          buffer={18}
          label="Label"
          maxValue={20}
          minValue={10}
          value={15}
        />,
      )

      expect(styleOf(bufferParts().buffered).width).toBe('60%')
    })

    it('scrolls the dots one pitch toward the start of the line', async () => {
      await render(<ProgressIndicator buffer={70} label="Label" value={30} />)
      await layOut()
      await advance(125)

      expect(
        transformOf(getAnimatedStyle(bufferParts().row)).translateX,
      ).toBeCloseTo(-5, 0)
    })

    it('scrolls them the other way under a right-to-left layout', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(<ProgressIndicator buffer={70} label="Label" value={30} />)
      await layOut()
      await advance(125)

      expect(
        transformOf(getAnimatedStyle(bufferParts().row)).translateX,
      ).toBeCloseTo(5, 0)
    })

    it('ignores the buffer while indeterminate', async () => {
      await render(
        <ProgressIndicator buffer={70} isIndeterminate label="Label" />,
      )

      expect(child(line().children.at(0)).children).toHaveLength(3)
    })
  })

  describe('indeterminate, as a line', () => {
    it('starts its two bars before the row, at Material’s smallest scale', async () => {
      await render(<ProgressIndicator isIndeterminate label="Label" />)
      await layOut()
      const { primary, secondary } = bars()

      expect(transformOf(getAnimatedStyle(primary))).toEqual({
        scaleX: 0.08,
        translateX: PRIMARY_START * WIDTH,
      })
      expect(transformOf(getAnimatedStyle(secondary))).toEqual({
        scaleX: 0.08,
        translateX: SECONDARY_START * WIDTH,
      })
    })

    it('sweeps them across the row and starts again every two seconds', async () => {
      await render(<ProgressIndicator isIndeterminate label="Label" />)
      await layOut()
      await advance(1000)
      const midway = transformOf(getAnimatedStyle(bars().primary))

      expect(midway.translateX).toBeGreaterThan(PRIMARY_START * WIDTH)
      expect(midway.scaleX).toBeGreaterThan(0.08)

      // A tenth of the way into the next pass the primary bar has not yet
      // begun to move, as Material's keyframes hold it for a fifth.
      await advance(1200)

      expect(transformOf(getAnimatedStyle(bars().primary)).translateX).toBe(
        PRIMARY_START * WIDTH,
      )
    })

    it('runs at half speed under reduced motion rather than stopping', async () => {
      mockReducedMotion = true
      await render(<ProgressIndicator isIndeterminate label="Label" />)
      await layOut()
      await advance(2200)

      // Past halfway through its first, slower pass.
      expect(
        transformOf(getAnimatedStyle(bars().primary)).translateX,
      ).toBeGreaterThan((PRIMARY_START + 0.25) * WIDTH)
    })

    it('draws its bars and track in the tone’s colours', async () => {
      await render(
        withSlot(
          <ProgressIndicator isIndeterminate label="Label" tone="inherit" />,
        ),
      )
      const { primary, secondary, track } = bars()

      expect(fillOf(primary)).toBe(SLOT)
      expect(fillOf(secondary)).toBe(SLOT)
      expect(fillOf(track)).toBe(withOpacity(SLOT, 0.25))
    })

    it('scales its bars from their own start', async () => {
      await render(<ProgressIndicator isIndeterminate label="Label" />)

      expect(styleOf(bars().primary).transformOrigin).toBe('left center')
    })

    it('mirrors the row under a right-to-left layout', async () => {
      await render(<ProgressIndicator isIndeterminate label="Label" />)

      expect(styleOf(bars().row).transform).toBeUndefined()

      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(<ProgressIndicator isIndeterminate label="Label" />)

      expect(styleOf(bars().row).transform).toEqual([{ scaleX: -1 }])
    })
  })

  describe('wavy, as a line', () => {
    it('stands a 10dp row with the line through its middle', async () => {
      await render(<ProgressIndicator label="Label" shape="wavy" value={40} />)

      expect(styleOf(line())).toMatchObject({
        height: 10,
        justifyContent: 'center',
      })
    })

    it('draws a wave over the active indicator, and hides the flat one under it', async () => {
      await render(<ProgressIndicator label="Label" shape="wavy" value={40} />)
      await layOut()
      const [wave] = pathsIn(line())
      const points = pointsOf(wave.d)

      // From half a stroke in to the active indicator's end less half a
      // stroke, so its round caps end where the flat one would.
      expect(points.at(0)).toEqual([2, 5])
      expect(points.at(-1)?.[0]).toBe(2 + ROOM * 0.4 - 4)
      expect(wave).toMatchObject({
        opacity: 1,
        stroke: colors.primary,
        strokeLinecap: 'round',
        strokeWidth: 4,
      })
      expect(getAnimatedStyle(lineParts().active).opacity).toBe(0)
    })

    it.each([10, 95])('lies flat at %d', async (value) => {
      await render(
        <ProgressIndicator label="Label" shape="wavy" value={value} />,
      )
      await layOut()

      expect(pathsIn(line())[0].opacity).toBe(0)
      expect(getAnimatedStyle(lineParts().active).opacity).toBe(1)
    })

    it('crossfades the wave as the value crosses where it stands', async () => {
      const { rerender } = await render(
        <ProgressIndicator label="Label" shape="wavy" value={5} />,
      )
      await layOut()
      await rerender(
        <ProgressIndicator label="Label" shape="wavy" value={50} />,
      )
      await advance(motion.durationMedium1 / 2)
      const opacity = getAnimatedStyle(lineParts().active).opacity

      expect(opacity).toBeGreaterThan(0)
      expect(opacity).toBeLessThan(1)

      await advance(motion.durationMedium1)

      expect(getAnimatedStyle(lineParts().active).opacity).toBe(0)
    })

    it('draws flat under reduced motion', async () => {
      mockReducedMotion = true
      await render(<ProgressIndicator label="Label" shape="wavy" value={40} />)
      await layOut()

      expect(svgsIn(indicator())).toHaveLength(0)
      expect(styleOf(line()).height).toBe(10)
      expect(getAnimatedStyle(lineParts().active).opacity).toBe(1)
    })

    it('draws flat once the row is wider than the wave reaches', async () => {
      await render(<ProgressIndicator label="Label" shape="wavy" value={40} />)
      await layOut(2049)

      expect(svgsIn(indicator())).toHaveLength(0)
    })

    it('mirrors the wave under a right-to-left layout', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(<ProgressIndicator label="Label" shape="wavy" value={40} />)
      await layOut()

      expect(styleOf(svgsIn(indicator())[0]).transform).toEqual([
        { scaleX: -1 },
      ])
    })

    it('draws its indeterminate bars as stretches of a shorter wave', async () => {
      await render(
        <ProgressIndicator isIndeterminate label="Label" shape="wavy" />,
      )
      await layOut()
      const row = child(line().children.at(0))
      const drawn: number[][] = []
      await act(() => {
        for (let time = 0; time < 2000; time += 250) {
          jest.advanceTimersByTime(250)
          for (const { d } of pathsIn(line())) {
            drawn.push(...(d === '' ? [] : pointsOf(d)))
          }
        }
      })

      // The track alone, with no flat bars over it.
      expect(row.children).toHaveLength(1)
      expect(pathsIn(line())).toHaveLength(2)
      expect(drawn.length).toBeGreaterThan(0)
      // Every point on a 20dp wave rising from half a stroke in, and never
      // outside the row.
      for (const [x, y] of drawn) {
        expect(x).toBeGreaterThanOrEqual(2)
        expect(x).toBeLessThanOrEqual(2 + WIDTH)
        expect(y).toBeCloseTo(5 - 3 * Math.sin((TURN * (x - 2)) / 20), 2)
      }
    })
  })

  describe('as a ring', () => {
    it('is 40 across, or the diameter given', async () => {
      await render(
        <ProgressIndicator label="Label" value={40} variant="circular" />,
      )

      expect(svgsIn(indicator())[0].props).toMatchObject({
        bbHeight: 40,
        bbWidth: 40,
        vbHeight: 40,
        vbWidth: 40,
      })

      await render(
        <ProgressIndicator
          diameter="20px"
          label="Label"
          value={40}
          variant="circular"
        />,
      )

      expect(svgsIn(indicator())[0].props).toMatchObject({
        bbHeight: 20,
        bbWidth: 20,
        vbWidth: 40,
      })
    })

    it('runs its active arc clockwise from the top for its share of the way', async () => {
      await render(
        <ProgressIndicator label="Label" value={25} variant="circular" />,
      )
      const [, active] = arcs()
      const [start, end] = endsOf(active.d)

      expect(start).toEqual([20, 2])
      expect(end).toEqual([38, 20])
      expect(active).toMatchObject({
        stroke: colors.primary,
        strokeLinecap: 'round',
        strokeWidth: 4,
      })
    })

    it('leaves the page’s gap either side of the track', async () => {
      await render(
        <ProgressIndicator label="Label" value={25} variant="circular" />,
      )
      const [track] = arcs()
      const [start, end] = endsOf(track.d)

      expect(angleOf(start)).toBeCloseTo((CIRCUMFERENCE / 4 + 4) / RADIUS, 2)
      expect(angleOf(end)).toBeCloseTo(TURN - 4 / RADIUS, 2)
      expect(track.stroke).toBe(colors.secondaryContainer)
    })

    it('eases to a new value over the long duration', async () => {
      const { rerender } = await render(
        <ProgressIndicator label="Label" value={25} variant="circular" />,
      )
      await rerender(
        <ProgressIndicator label="Label" value={50} variant="circular" />,
      )
      await advance(motion.durationLong2 / 2)
      const midway = angleOf(endsOf(arcs()[1].d)[1])

      expect(midway).toBeGreaterThan(TURN / 4)
      expect(midway).toBeLessThan(TURN / 2)

      await advance(motion.durationLong2)

      expect(endsOf(arcs()[1].d)[1]).toEqual([20, 38])
    })

    it('moves to a new value at once under reduced motion', async () => {
      mockReducedMotion = true
      const { rerender } = await render(
        <ProgressIndicator label="Label" value={25} variant="circular" />,
      )
      await rerender(
        <ProgressIndicator label="Label" value={50} variant="circular" />,
      )
      await advance(0)

      expect(endsOf(arcs()[1].d)[1]).toEqual([20, 38])
    })

    it('draws one arc and no track while indeterminate, from three o’clock', async () => {
      await render(
        <ProgressIndicator isIndeterminate label="Label" variant="circular" />,
      )
      const paths = arcs()
      const [start, end] = endsOf(paths[0].d)

      expect(paths).toHaveLength(1)
      expect(start).toEqual([38, 20])
      // Material's shortest arc.
      expect(angleOf(end) - angleOf(start)).toBeCloseTo(TURN * 0.08, 2)
    })

    it('grows its arc as it turns', async () => {
      await render(
        <ProgressIndicator isIndeterminate label="Label" variant="circular" />,
      )
      await advance(333)
      const [start, end] = endsOf(arcs()[0].d)
      const sweep = angleOf(end) - angleOf(start)

      expect(angleOf(start)).not.toBeCloseTo(TURN / 4, 1)
      expect(sweep < 0 ? sweep + TURN : sweep).toBeGreaterThan(TURN * 0.08)
    })

    it('stands its arc and track in the tone’s colours', async () => {
      await render(
        withSlot(
          <ProgressIndicator
            label="Label"
            tone="inherit"
            value={25}
            variant="circular"
          />,
        ),
      )
      const [track, active] = arcs()

      expect(active.stroke).toBe(SLOT)
      expect(track.stroke).toBe(withOpacity(SLOT, 0.25))
    })

    it('stays its own size rather than the room it is given', async () => {
      await render(
        <ProgressIndicator label="Label" value={25} variant="circular" />,
      )

      expect(styleOf(indicator()).alignItems).toBe('flex-start')
    })
  })

  describe('wavy, as a ring', () => {
    it('is 48 across, with a wave over the active arc', async () => {
      await render(
        <ProgressIndicator
          label="Label"
          shape="wavy"
          value={40}
          variant="circular"
        />,
      )
      const [, flat, wave] = arcs()
      const reaches = pointsOf(wave.d).map(([x, y]) =>
        Math.hypot(x - 24, y - 24),
      )

      expect(svgsIn(indicator())[0].props).toMatchObject({
        bbWidth: 48,
        vbWidth: 48,
      })
      expect(flat.opacity).toBe(0)
      expect(wave.opacity).toBe(1)
      expect(Math.max(...reaches)).toBeCloseTo(22, 1)
      expect(Math.min(...reaches)).toBeCloseTo(18.8, 1)
    })

    it('lies flat near either end of the way', async () => {
      await render(
        <ProgressIndicator
          label="Label"
          shape="wavy"
          value={5}
          variant="circular"
        />,
      )
      const [, flat, wave] = arcs()

      expect(flat.opacity).toBe(1)
      expect(wave.opacity).toBe(0)
    })

    it('draws flat under reduced motion', async () => {
      mockReducedMotion = true
      await render(
        <ProgressIndicator
          label="Label"
          shape="wavy"
          value={40}
          variant="circular"
        />,
      )
      const paths = arcs()

      expect(paths).toHaveLength(2)
      expect(paths[1].opacity).toBe(1)
    })

    it('runs its wave round while indeterminate, over no flat arc', async () => {
      await render(
        <ProgressIndicator
          isIndeterminate
          label="Label"
          shape="wavy"
          variant="circular"
        />,
      )
      const [flat, wave] = arcs()

      expect(flat.opacity).toBe(0)
      expect(wave.opacity).toBe(1)
    })
  })

  it('puts the style, ref and testID on the indicator as a whole', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(
      <ProgressIndicator
        label="Label"
        ref={ref}
        style={OFFSET}
        testID="indicator"
        value={40}
      />,
    )

    expect(screen.getByTestId('indicator')).toBe(indicator())
    expect(styleOf(indicator())).toMatchObject(OFFSET)
    expect(typeof ref.current?.measure).toBe('function')
  })
})
