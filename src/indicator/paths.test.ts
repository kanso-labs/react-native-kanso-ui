import { describe, expect, it } from '@jest/globals'

import {
  arcPath,
  shapePath,
  TURN,
  WAVE_HEIGHT,
  wavePath,
  wavyArcPath,
} from './paths'

// The flat ring's circle, and the wavy ring's wave, as the progress
// indicator draws them.
const CENTRE = 20
const RADIUS = 18
const WAVE = { amplitude: 1.6, centre: 24, radius: 20.4, waves: 9 }

// Two shapes of three points each about the loading indicator's centre, a
// triangle and the same triangle twice the size, its points listed x then y.
const SHAPE_CENTRE = 50
const SMALL = [60, 50, 50, 60, 40, 50]
const LARGE = [70, 50, 50, 70, 30, 50]

// How far round from the top a point on a circle about `centre` is,
// clockwise, in radians from 0 to a full turn.
function angleOf([x, y]: number[], centre: number) {
  const angle = Math.atan2(x - centre, centre - y)
  return angle < 0 ? angle + TURN : angle
}

// Every point a path passes through, in order, whatever command reaches it.
function pointsOf(d: string) {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/gu) ?? []).map(Number)
  if (d.includes('A')) {
    // An arc writes its radii, rotation and two flags before its end point.
    return [
      [numbers[0], numbers[1]],
      [numbers[7], numbers[8]],
    ]
  }
  const points: number[][] = []
  for (let index = 0; index < numbers.length; index += 2) {
    points.push([numbers[index], numbers[index + 1]])
  }
  return points
}

// How far a point on the wavy ring is from its centre.
function reachOf([x, y]: number[]) {
  return Math.hypot(x - WAVE.centre, y - WAVE.centre)
}

describe('arcPath', () => {
  it('runs clockwise from the top for its sweep', () => {
    const d = arcPath(CENTRE, RADIUS, 0, TURN / 4)
    const [start, end] = pointsOf(d)

    expect(start).toEqual([20, 2])
    expect(end).toEqual([38, 20])
    // A quarter is the short way round, drawn clockwise.
    expect(d).toContain('A18 18 0 0 1 ')
  })

  it('takes the long way round past half a turn', () => {
    expect(arcPath(CENTRE, RADIUS, 0, (TURN * 3) / 4)).toContain(
      'A18 18 0 1 1 ',
    )
  })

  it('starts where it is told', () => {
    const [start, end] = pointsOf(arcPath(CENTRE, RADIUS, TURN / 4, TURN / 4))

    expect(start).toEqual([38, 20])
    expect(end).toEqual([20, 38])
  })

  it('draws a dot for a sweep of nothing', () => {
    const [start, end] = pointsOf(arcPath(CENTRE, RADIUS, 0, 0))

    // Apart, so the path has a length and its round caps draw, but by less
    // than a screen shows.
    expect(start).not.toEqual(end)
    expect(Math.hypot(end[0] - start[0], end[1] - start[1])).toBeLessThan(0.1)
  })

  it('stops a full turn short of where it started', () => {
    const [start, end] = pointsOf(arcPath(CENTRE, RADIUS, 0, TURN))

    expect(start).not.toEqual(end)
    expect(Math.hypot(end[0] - start[0], end[1] - start[1])).toBeLessThan(0.1)
  })
})

describe('wavePath', () => {
  it('draws nothing for an empty stretch', () => {
    expect(wavePath(40, 10, 10)).toBe('')
    expect(wavePath(40, 10, 5)).toBe('')
  })

  it('runs from the start of the stretch to its end', () => {
    const points = pointsOf(wavePath(40, 2, 102))

    expect(points.at(0)?.[0]).toBe(2)
    expect(points.at(-1)?.[0]).toBe(102)
    expect(points.map(([x]) => x)).toEqual(
      points.map(([x]) => x).toSorted((a, b) => a - b),
    )
  })

  it('rises first, three either side of the middle of its row', () => {
    const points = pointsOf(wavePath(40, 2, 42))
    const heights = points.map(([, y]) => y)

    // It starts in the middle, crests a quarter of the way along, and
    // troughs three quarters along, as web's wave does.
    expect(points.at(0)).toEqual([2, WAVE_HEIGHT / 2])
    expect(points.find(([x]) => x === 12)).toEqual([12, WAVE_HEIGHT / 2 - 3])
    expect(points.find(([x]) => x === 32)).toEqual([32, WAVE_HEIGHT / 2 + 3])
    expect(Math.min(...heights)).toBe(2)
    expect(Math.max(...heights)).toBe(8)
  })

  it('stays on the same wave wherever a stretch starts', () => {
    const whole = pointsOf(wavePath(20, 2, 102))
    const part = pointsOf(wavePath(20, 47, 77))

    for (const point of part.slice(1, -1)) {
      expect(whole).toContainEqual(point)
    }
  })
})

describe('wavyArcPath', () => {
  it('rises and falls by its amplitude about the circle', () => {
    const points = pointsOf(wavyArcPath(WAVE, 0, 0, TURN))
    const reaches = points.map(reachOf)

    expect(Math.max(...reaches)).toBeCloseTo(22, 2)
    expect(Math.min(...reaches)).toBeCloseTo(18.8, 2)
  })

  it('runs clockwise from the top for its sweep', () => {
    const points = pointsOf(wavyArcPath(WAVE, 0, 0, TURN / 4))

    expect(angleOf(points[0], 24)).toBeCloseTo(0, 6)
    expect(angleOf(points[1], 24)).toBeGreaterThan(0)
    expect(angleOf(points.at(-1) ?? [], 24)).toBeCloseTo(TURN / 4, 3)
  })

  it('turns its crests with its phase', () => {
    const still = pointsOf(wavyArcPath(WAVE, 0, 0, TURN / 9))
    const turned = pointsOf(wavyArcPath(WAVE, TURN / 4, TURN / 4, TURN / 9))

    expect(turned.map(reachOf)).toEqual(
      still.map(reachOf).map((value) => expect.closeTo(value, 2)),
    )
  })

  it('draws a dot for a sweep of nothing', () => {
    const points = pointsOf(wavyArcPath(WAVE, 0, 0, 0))

    expect(points).toHaveLength(2)
    expect(points[0]).not.toEqual(points[1])
  })
})

describe('shapePath', () => {
  it('draws the first shape at the start, and closes it', () => {
    const d = shapePath(SMALL, LARGE, 0, 0, SHAPE_CENTRE)

    expect(d).toBe('M60.000 50.000L50.000 60.000L40.000 50.000Z')
  })

  it('moves each point toward its counterpart in the second shape', () => {
    expect(pointsOf(shapePath(SMALL, LARGE, 0.5, 0, SHAPE_CENTRE))).toEqual([
      [65, 50],
      [50, 65],
      [35, 50],
    ])
    expect(pointsOf(shapePath(SMALL, LARGE, 1, 0, SHAPE_CENTRE))).toEqual([
      [70, 50],
      [50, 70],
      [30, 50],
    ])
  })

  it('carries on past the second shape for a share past 1', () => {
    const [first] = pointsOf(shapePath(SMALL, LARGE, 1.1, 0, SHAPE_CENTRE))

    expect(first).toEqual([71, 50])
  })

  it('turns the shape clockwise about the centre', () => {
    const points = pointsOf(shapePath(SMALL, LARGE, 0, TURN / 4, SHAPE_CENTRE))

    expect(points).toEqual([
      [50, 60],
      [40, 50],
      [50, 40],
    ])
  })
})
