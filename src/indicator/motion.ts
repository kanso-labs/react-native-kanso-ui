import type { SharedValue } from 'react-native-reanimated'

import { useEffect } from 'react'
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

// The machinery an indeterminate indicator's choreography runs on: a clock
// that loops from 0 to 1, and the keyframes read off it. Web writes the same
// choreography as CSS keyframes, each segment on a curve of its own; React
// Native has no keyframes, so each property here is a list of the same
// frames, read at the clock's time on the UI thread.

/** A cubic Bézier's four control coordinates, in the order CSS writes them. */
type Curve = readonly [number, number, number, number]

/**
 * One keyframe: where it falls in the loop, from 0 to 1, the value there,
 * and the curve the value takes to the next frame. A frame with no curve
 * moves to the next one at a constant rate, as a CSS keyframe with no timing
 * function does under a linear animation.
 */
type Keyframe = readonly [at: number, value: number, curve?: Curve]

// How finely a curve's progress is searched for. Twenty-four halvings leave
// it a sixteen-millionth out, far finer than a frame can show.
const SEARCH_STEPS = 24

/**
 * The value `frames` give at `time`, a share of the loop: the frames either
 * side of it, and the curve between them.
 *
 * A curve is a function of its parameter rather than of the time, so the
 * parameter is found by halving the interval until the curve's own `x` is the
 * share of the segment gone, which holds for every curve whose control points
 * lie inside the unit interval across, as every timing function's do. The
 * search is nested here rather than beside it: a worklet captures what it
 * calls when the module is evaluated, so one calling another declared below it
 * would be handed nothing, and the linter orders declarations by name.
 */
function keyframeAt(frames: readonly Keyframe[], time: number) {
  'worklet'
  let index = 0
  while (index < frames.length - 2 && time >= frames[index + 1][0]) {
    index++
  }

  const [from, start, curve] = frames[index]
  const [to, end] = frames[index + 1]
  const share = Math.min(1, Math.max(0, (time - from) / (to - from)))

  if (curve === undefined || share === 0 || share === 1) {
    return start + (end - start) * share
  }

  // One coordinate of the curve from (0, 0) to (1, 1) at a parameter, given
  // the same coordinate of its two control points.
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- a worklet captures what it calls when the module is evaluated; see above
  function coordinateAt(first: number, second: number, parameter: number) {
    const rest = 1 - parameter
    return (
      3 * rest * rest * parameter * first +
      3 * rest * parameter * parameter * second +
      parameter * parameter * parameter
    )
  }

  const [x1, y1, x2, y2] = curve
  let low = 0
  let high = 1
  let parameter = share
  for (let step = 0; step < SEARCH_STEPS; step++) {
    if (coordinateAt(x1, x2, parameter) < share) {
      low = parameter
    } else {
      high = parameter
    }
    parameter = (low + high) / 2
  }

  return start + (end - start) * coordinateAt(y1, y2, parameter)
}

/**
 * A clock running from 0 to 1 over `duration` ms and starting again, for as
 * long as `running` holds. It runs whatever the device says about reduced
 * motion: Reanimated would otherwise jump a looping animation to its end,
 * which freezes an indeterminate indicator, so a component slows its loop
 * there by lengthening `duration` instead, as web's does.
 */
function useLoop(duration: number, running: boolean): SharedValue<number> {
  const clock = useSharedValue(0)

  useEffect(() => {
    if (!running) {
      return undefined
    }

    clock.set(0)
    clock.set(
      withRepeat(
        withTiming(1, {
          duration,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.Never,
        }),
        -1,
        false,
        undefined,
        ReduceMotion.Never,
      ),
    )

    return () => {
      cancelAnimation(clock)
    }
  }, [clock, duration, running])

  return clock
}

export { keyframeAt, useLoop }
export type { Curve, Keyframe }
