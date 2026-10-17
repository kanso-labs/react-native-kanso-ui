import type {
  GestureResponderEvent,
  LayoutChangeEvent,
  PressableProps,
} from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import type { ToggleGroupState } from 'react-stately/useToggleGroupState'

import { createContext } from 'react'
import { StyleSheet } from 'react-native'
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated'

import type { ControlSize } from '.'

import { toggleState } from '.'
import { TARGET_SIZE } from '../press'
import { useTheme } from '../theme/scope'

// What a ButtonGroup hands each Button or IconButton in it, as web's
// src/button/context.ts does: the group's size, whether it is disabled, its
// selection, a connected group's corners, and a standard group's part in a
// press. Apart from src/components, which holds the public components alone,
// and from ./index.ts, which the group reads too.

type ButtonGroupItem = {
  /**
   * The corners a connected group gives the button for its state, which take
   * the place of its own shape.
   */
  readonly corners?: (state: GroupButtonState) => GroupCorners
  /** Whether the group is disabled, which disables every button in it. */
  readonly isDisabled: boolean
  /**
   * Whether the button keeps the 48dp touch target as its least width, as
   * the two smallest do in a connected group.
   */
  readonly keepsTarget: boolean
  /** Called as a press on the button ends, so the group lets go of it. */
  readonly onPressEnd?: () => void
  /**
   * Called as a press on the button starts, with its width, so a standard
   * group can widen it and narrow its neighbours.
   */
  readonly onPressStart?: (width: number) => void
  /**
   * The group's selection, by the buttons' `id`s, when it selects: `single`
   * for one at a time, as a radio group, or several, as toggles.
   */
  readonly selection?: {
    readonly single: boolean
    readonly state: ToggleGroupState
  }
  /**
   * How far the button's width moves while it or a neighbour is pressed, in
   * dp: the pressed button's gain, or a neighbour's loss as a negative. Zero
   * at rest.
   */
  readonly shift: number
  /** The group's size, which a button takes unless it names its own. */
  readonly size: ControlSize | undefined
}

/** What a connected group shapes a button's corners from. */
type GroupButtonState = {
  readonly pressed: boolean
  readonly selected: boolean
}

/** A button's corners on its two sides, in dp: start and end. */
type GroupCorners = { readonly end: number; readonly start: number }

/** How a button in a selecting group is announced, and whether it is chosen. */
type GroupMembership = {
  readonly accessibility: {
    readonly 'aria-checked'?: boolean
    readonly 'aria-pressed'?: boolean
    readonly 'aria-selected'?: boolean
    readonly role: 'button' | 'radio'
  }
  readonly selected: boolean
  readonly toggle: () => void
}

const ButtonGroupItemContext = createContext<ButtonGroupItem | null>(null)

const groupStyles = StyleSheet.create({
  // The touch target the two smallest sizes keep in a connected group.
  target: {
    minWidth: TARGET_SIZE,
  },
})

/**
 * The press handlers a button in a group that tracks presses takes: its own,
 * with the group told first, given the width `groupWidthThen` last recorded.
 * Its own alone anywhere else.
 */
function groupPressHandlers(
  group: ButtonGroupItem | null,
  width: SharedValue<number>,
  onPressIn: PressableProps['onPressIn'],
  onPressOut: PressableProps['onPressOut'],
) {
  const start = group?.onPressStart

  if (start === undefined) {
    return { onPressIn, onPressOut }
  }

  const end = group?.onPressEnd

  return {
    onPressIn: (event: GestureResponderEvent) => {
      start(width.get())
      onPressIn?.(event)
    },
    onPressOut: (event: GestureResponderEvent) => {
      end?.()
      onPressOut?.(event)
    },
  }
}

/**
 * Where a button with this `id` stands in the selecting group around it: how
 * it is announced, whether it is chosen, and what a press on it changes.
 * Nothing outside a group that selects, or for a button without an `id`,
 * which has no key to be chosen by.
 */
function groupSelectionOf(
  group: ButtonGroupItem | null,
  id: string | undefined,
): GroupMembership | undefined {
  const selection = group?.selection

  if (selection === undefined) {
    return undefined
  }

  const { single, state } = selection
  const selected = id !== undefined && state.selectedKeys.has(id)

  return {
    accessibility: single
      ? { 'aria-checked': selected, role: 'radio' }
      : { ...toggleState(selected), role: 'button' },
    selected,
    toggle: () => {
      if (id !== undefined) {
        state.toggleKey(id)
      }
    },
  }
}

/**
 * The call site's own `onLayout`, after recording the button's width for the
 * group to widen it from, in a group that tracks presses. The call site's
 * own alone anywhere else.
 */
function groupWidthThen(
  group: ButtonGroupItem | null,
  width: SharedValue<number>,
  onLayout: PressableProps['onLayout'],
): PressableProps['onLayout'] {
  if (group?.onPressStart === undefined) {
    return onLayout
  }

  return (event: LayoutChangeEvent) => {
    width.set(event.nativeEvent.layout.width)
    onLayout?.(event)
  }
}

/**
 * The style a standard group eases a button's width by: `property` at `base`
 * at rest, moved by the group's shift while a press is held, over the motion
 * tokens' short duration on the emphasised curve, as the corner eases, and at
 * once under reduced motion. Padding takes half the shift on either side, as
 * `paddingLeft` and `paddingRight` rather than `paddingHorizontal`: on web
 * Reanimated writes an animated style straight onto the element, where a
 * React Native shorthand is no CSS property and is dropped. The two sides are
 * equal, so they need no direction, and on native either beats the
 * `paddingHorizontal` a button rests at. Nothing outside a group that tracks
 * presses, which leaves the button's own size alone.
 */
function useGroupShift(
  group: ButtonGroupItem | null,
  base: number,
  property: 'padding' | 'width',
) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const shift = group?.shift ?? 0
  const target = base + (property === 'width' ? shift : shift / 2)
  const timing = {
    duration: motion.durationShort2,
    easing: Easing.bezier(...motion.easingEmphasized),
  }
  const style = useAnimatedStyle(() => {
    'worklet'
    const value = reduceMotion ? target : withTiming(target, timing)

    return property === 'width'
      ? { width: value }
      : { paddingLeft: value, paddingRight: value }
  })

  return group?.onPressStart === undefined ? undefined : style
}

export {
  ButtonGroupItemContext,
  groupPressHandlers,
  groupSelectionOf,
  groupStyles,
  groupWidthThen,
  useGroupShift,
}
export type { ButtonGroupItem, GroupButtonState, GroupCorners }
