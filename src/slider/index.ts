import type {
  AccessibilityActionEvent,
  AccessibilityActionInfo,
  DimensionValue,
  KeyDownEvent,
  LayoutChangeEvent,
  ViewStyle,
} from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import type { SliderState } from 'react-stately/useSliderState'

import { useMemo } from 'react'
import { I18nManager, StyleSheet } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'

import { useLatest } from '../gesture/latest'

// What a slider and a colour slider share: the press and the drag along the
// track, the frame a screen reader adjusts a handle in and the steps it asks
// for. Both keep React Stately's slider state, a colour slider's being one
// over a channel, so each reads and moves its value the same way.

// How far a press moves along the track before it is a drag rather than a
// tap, and across it before it is someone scrolling past: Gesture Handler's
// own default distance for a pan.
const SLOP = 10
const SLOP_RANGE: [number, number] = [-SLOP, SLOP]

// The width a screen reader frames a handle in, the page's 48dp target,
// centred on the handle. Presses reach the track rather than this frame, so
// it decides nothing but what a screen reader outlines.
const TARGET = 48

// What a screen reader can ask of a handle: a step up, or a step down.
const ADJUSTABLE: readonly AccessibilityActionInfo[] = [
  { name: 'increment' },
  { name: 'decrement' },
]

const seats = StyleSheet.create({
  // Where a handle sits: a frame the target's width, centred on the value,
  // across the whole strip, with the handle centred in it.
  seat: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    marginStart: -TARGET / 2,
    position: 'absolute',
    top: 0,
    width: TARGET,
  },
  seatVertical: {
    alignItems: 'center',
    end: 0,
    height: TARGET,
    justifyContent: 'center',
    marginBottom: -TARGET / 2,
    position: 'absolute',
    start: 0,
  },
})

// What a key asks a handle for under React Native Web, as React Aria's handle
// reads the keys on web: an arrow is a step, up and right raising the value
// and down and left lowering it, with right and left swapped under a
// right-to-left layout, whichever way the slider runs; Page Up and Page Down
// are React Stately's larger step; Home and End are the handle's ends.
type KeyMove =
  | 'decrement'
  | 'end'
  | 'home'
  | 'increment'
  | 'pageDown'
  | 'pageUp'

// Runs the step a screen reader asks a handle for, as a move that starts and
// ends at once, so `onChangeEnd` comes once as it does for a key on web.
function adjustOf(state: SliderState, index: number) {
  return (event: AccessibilityActionEvent) => {
    const { actionName } = event.nativeEvent
    if (actionName !== 'increment' && actionName !== 'decrement') {
      return
    }
    state.setThumbDragging(index, true)
    if (actionName === 'increment') {
      state.incrementThumb(index)
    } else {
      state.decrementThumb(index)
    }
    state.setThumbDragging(index, false)
  }
}

const KEY_MOVES: Readonly<Record<string, KeyMove>> = {
  ArrowDown: 'decrement',
  ArrowLeft: 'decrement',
  ArrowRight: 'increment',
  ArrowUp: 'increment',
  End: 'end',
  Home: 'home',
  PageDown: 'pageDown',
  PageUp: 'pageUp',
}

// The handle nearest a press at `value`, as React Aria picks it on web: the
// first handle past it or the last before it, whichever is closer, and the
// one past it when the two are as close.
function closestThumb(values: readonly number[], value: number) {
  const split = values.findIndex((each) => value - each < 0)
  if (split === 0) {
    return 0
  }
  if (split === -1) {
    return values.length - 1
  }
  const lastBefore = values[split - 1] ?? value
  const firstPast = values[split] ?? value
  return Math.abs(lastBefore - value) < Math.abs(firstPast - value)
    ? split - 1
    : split
}

// The move a key asks for, with right and left swapped under a right-to-left
// layout, or undefined for a key a handle takes no move from.
function keyMoveOf(key: string, rtl: boolean): KeyMove | undefined {
  if (rtl && key === 'ArrowLeft') {
    return 'increment'
  }
  if (rtl && key === 'ArrowRight') {
    return 'decrement'
  }
  return KEY_MOVES[key]
}

/**
 * The keys a handle takes under React Native Web, where it is focused from
 * the keyboard: the arrows, Page Up and Page Down, Home and End, each run as
 * a move that starts and ends at once, as a screen reader's step is, so
 * `onChangeEnd` comes once a key. A range's handle moves itself alone, within
 * the bounds its neighbours set, which React Stately keeps. A key it moves by
 * is kept from the page, which would otherwise scroll. A disabled slider
 * takes none.
 */
function keysOf(state: SliderState, index: number) {
  return (event: KeyDownEvent) => {
    const move = keyMoveOf(event.nativeEvent.key, I18nManager.isRTL)
    if (move === undefined || state.isDisabled) {
      return
    }
    event.preventDefault()
    state.setThumbDragging(index, true)
    switch (move) {
      case 'decrement': {
        state.decrementThumb(index)
        break
      }
      case 'end': {
        state.setThumbValue(index, state.getThumbMaxValue(index))
        break
      }
      case 'home': {
        state.setThumbValue(index, state.getThumbMinValue(index))
        break
      }
      case 'increment': {
        state.incrementThumb(index)
        break
      }
      case 'pageDown': {
        state.decrementThumb(index, state.pageSize)
        break
      }
      case 'pageUp': {
        state.incrementThumb(index, state.pageSize)
        break
      }
    }
    state.setThumbDragging(index, false)
  }
}

// Keeps the track's length along its axis as it is laid out.
function lengthTo(set: (length: number) => void, vertical: boolean) {
  return ({ nativeEvent }: LayoutChangeEvent) => {
    set(vertical ? nativeEvent.layout.height : nativeEvent.layout.width)
  }
}

function percentOf(fraction: number): DimensionValue {
  return `${fraction * 100}%`
}

// Where a handle's frame sits along the track: centred on its value.
function seatPlaceOf(fraction: number, vertical: boolean): ViewStyle {
  return vertical
    ? { bottom: percentOf(fraction) }
    : { start: percentOf(fraction) }
}

/**
 * The track's pan and tap. Each reads a press's place as a fraction of the
 * track, from the start or, vertical, from the bottom, and moves the handle
 * nearest it there. The pan holds that handle as dragged until it lets go,
 * which is what brings up its indicator and narrows it, and what
 * `onChangeEnd` waits for; the tap moves it and lets it go at once.
 *
 * Both run on the JavaScript thread, since every move sets React Stately's
 * state, which is what `onChange` is called from as the handle moves. The
 * handle could follow a shared value on the UI thread with the state set
 * less often, but `onChange` would then fire less often too, so the handle
 * moves with each commit, as before. What a move no longer does is rebuild
 * the gesture: it is memoised over what configures it, and reads the state
 * and the track's length of the latest render through `useLatest`.
 */
function useTrackGesture({
  isDisabled,
  length,
  state,
  testID,
  vertical,
}: {
  readonly isDisabled: boolean
  readonly length: number
  readonly state: SliderState
  readonly testID: string | undefined
  readonly vertical: boolean
}) {
  // Which handle the pan holds, or -1. A shared value rather than a ref: the
  // gesture's callbacks are built while rendering, and the React Compiler
  // lets no ref reach them.
  const dragged: SharedValue<number> = useSharedValue(-1)
  const latest = useLatest({ length, state })

  return useMemo(() => {
    // A press's place as a fraction of the way along the track, or null
    // before the track has a length to read it against. A press past either
    // end reads past 0 or 1, which React Stately clamps to the slider's ends.
    function fractionAt(x: number, y: number) {
      const along = latest.get().length
      if (along <= 0) {
        return null
      }
      const share = (vertical ? y : x) / along
      if (vertical) {
        return 1 - share
      }
      return I18nManager.isRTL ? 1 - share : share
    }

    function grab(x: number, y: number) {
      const fraction = fractionAt(x, y)
      if (fraction === null) {
        return
      }
      const { state: now } = latest.get()
      const index = closestThumb(now.values, now.getPercentValue(fraction))
      dragged.set(index)
      now.setThumbDragging(index, true)
      now.setThumbPercent(index, fraction)
    }

    function move(x: number, y: number) {
      const index = dragged.get()
      const fraction = fractionAt(x, y)
      if (index >= 0 && fraction !== null) {
        latest.get().state.setThumbPercent(index, fraction)
      }
    }

    function release() {
      const index = dragged.get()
      if (index >= 0) {
        dragged.set(-1)
        latest.get().state.setThumbDragging(index, false)
      }
    }

    function jump(x: number, y: number) {
      const fraction = fractionAt(x, y)
      if (fraction === null) {
        return
      }
      const { state: now } = latest.get()
      const index = closestThumb(now.values, now.getPercentValue(fraction))
      now.setThumbDragging(index, true)
      now.setThumbPercent(index, fraction)
      now.setThumbDragging(index, false)
    }

    // Gesture Handler 3 deprecates these builders for hooks that version 2
    // does not have, and the peer range admits both, so the builders stay
    // while it does.
    // oxlint-disable-next-line react/capitalized-calls, typescript/no-deprecated -- a builder named after its gesture, not a component; see above
    const drag = Gesture.Pan()
    // Taken once it moves along the track, and let go to a scroll view once
    // it moves across it first.
    const oriented = vertical
      ? drag.activeOffsetY(SLOP_RANGE).failOffsetX(SLOP_RANGE)
      : drag.activeOffsetX(SLOP_RANGE).failOffsetY(SLOP_RANGE)
    const pan = oriented
      .enabled(!isDisabled)
      .runOnJS(true)
      .onStart(({ x, y }) => {
        grab(x, y)
      })
      .onUpdate(({ x, y }) => {
        move(x, y)
      })
      .onFinalize(() => {
        release()
      })
    // oxlint-disable-next-line react/capitalized-calls, typescript/no-deprecated -- as above
    const tap = Gesture.Tap()
      .maxDistance(SLOP)
      .enabled(!isDisabled)
      .runOnJS(true)
      .onEnd(({ x, y }, success) => {
        if (success) {
          jump(x, y)
        }
      })

    // oxlint-disable-next-line react/capitalized-calls, typescript/no-deprecated -- as above
    return Gesture.Race(
      testID === undefined ? pan : pan.withTestId(`${testID}-pan`),
      testID === undefined ? tap : tap.withTestId(`${testID}-tap`),
    )
  }, [dragged, isDisabled, latest, testID, vertical])
}

export {
  ADJUSTABLE,
  adjustOf,
  closestThumb,
  keysOf,
  lengthTo,
  percentOf,
  seatPlaceOf,
  seats,
  SLOP_RANGE,
  useTrackGesture,
}
