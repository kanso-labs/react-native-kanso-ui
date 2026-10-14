import { describe, expect, it } from '@jest/globals'
import { Easing } from 'react-native-reanimated'

import type { Curve, Keyframe } from './motion'

import { keyframeAt } from './motion'

// The ring's curve, and a pair of frames that eases from 0 to 1 along it, so
// a value read off them is the curve's own.
const RING: Curve = [0.4, 0, 0.2, 1]
const EASED: readonly Keyframe[] = [
  [0, 0, RING],
  [1, 1],
]

describe('keyframeAt', () => {
  it('lands on each frame at its time', () => {
    const frames: readonly Keyframe[] = [
      [0, 0.08],
      [0.3665, 0.08, [0.334731, 0.12482, 0.785844, 1]],
      [0.6915, 0.661479, [0.06, 0.11, 0.6, 1]],
      [1, 0.08],
    ]

    expect(keyframeAt(frames, 0)).toBe(0.08)
    expect(keyframeAt(frames, 0.3665)).toBe(0.08)
    expect(keyframeAt(frames, 0.6915)).toBeCloseTo(0.661479, 6)
    expect(keyframeAt(frames, 1)).toBeCloseTo(0.08, 6)
  })

  it('moves at a constant rate between frames with no curve', () => {
    const frames: readonly Keyframe[] = [
      [0, 10],
      [0.5, 20],
      [1, 0],
    ]

    expect(keyframeAt(frames, 0.25)).toBe(15)
    expect(keyframeAt(frames, 0.75)).toBe(10)
  })

  it('follows a curve as Reanimated’s own Bézier does', () => {
    const reference = Easing.bezierFn(...RING)

    for (const time of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(keyframeAt(EASED, time)).toBeCloseTo(reference(time), 4)
    }
  })

  it('takes each segment’s curve from the frame that opens it', () => {
    const frames: readonly Keyframe[] = [
      [0, 0],
      [0.5, 1, RING],
      [1, 2],
    ]

    // Linear into the middle frame, then the ring's curve out of it.
    expect(keyframeAt(frames, 0.25)).toBe(0.5)
    expect(keyframeAt(frames, 0.75)).toBeCloseTo(
      1 + Easing.bezierFn(...RING)(0.5),
      4,
    )
  })

  it('holds the ends outside the loop', () => {
    expect(keyframeAt(EASED, -1)).toBe(0)
    expect(keyframeAt(EASED, 2)).toBe(1)
  })
})
