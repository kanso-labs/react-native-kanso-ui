import type { RefObject } from 'react'
import type { HostInstance } from 'react-native'

import { useEffect, useRef } from 'react'
import {
  AccessibilityInfo,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native'
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import type { OverlaySide } from './placement'

import { useTheme } from '../theme/scope'

// What a non-modal panel anchored beside its trigger does besides being
// placed, shared by Popover and Menu so the two cannot drift: the layer a
// press outside lands on, Android's back gesture, the motion in and out, and
// where a screen reader is sent as it comes and goes.

// What the panel scales up from as it arrives, web's keyframes'.
const SCALE_FROM = 0.95

/** The edge a panel grows from, the one facing its anchor. */
const PANEL_ORIGINS = {
  bottom: 'top',
  left: 'right',
  right: 'left',
  top: 'bottom',
} as const satisfies Record<OverlaySide, string>

const styles = StyleSheet.create({
  // Over the whole screen and under the panel.
  layer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
})

/**
 * The layer a press outside a non-modal panel lands on, drawn just before the
 * panel so it sits under it. The press goes no further, so a press on the
 * trigger closes the panel rather than opening it again, as on web. Nothing
 * but that press reaches it: React Native Web's Pressable is a tab stop
 * unless told otherwise, whatever `focusable` says.
 */
function DismissLayer({ onPress }: { readonly onPress: () => void }) {
  return (
    <Pressable
      accessible={false}
      aria-hidden
      focusable={false}
      onPress={onPress}
      style={styles.layer}
      tabIndex={-1}
    />
  )
}

/**
 * Closes a non-modal panel from Android's back gesture, as a `Modal` closes a
 * modal one. React Native calls the latest listener first, so a panel opened
 * from another closes before the one it came from. React Native Web has no
 * back gesture, and its BackHandler reports an error when one is listened for,
 * so nothing listens there.
 */
function useBackToClose(close: () => void, active: boolean) {
  useEffect(() => {
    if (!active || Platform.OS === 'web') {
      return undefined
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        close()
        return true
      },
    )

    return () => {
      subscription.remove()
    }
  }, [active, close])
}

/**
 * Sends the screen reader to `target` once `ready`, which a panel passes once
 * it has been placed, and so can be seen. React Native Web has no screen
 * reader of its own to send.
 */
function useFocusOnPlaced(ready: boolean, target: HostInstance | null) {
  useEffect(() => {
    if (ready && target !== null && Platform.OS !== 'web') {
      AccessibilityInfo.sendAccessibilityEvent(target, 'focus')
    }
  }, [ready, target])
}

/**
 * A panel's motion, and the timer that unmounts it once its exit has run: it
 * fades and scales up from 95% over the short3 duration on the emphasised
 * decelerating curve, and back over short2 on the accelerating one. The
 * entrance waits for the panel to be placed, so it is not spent while the
 * panel is still hidden being measured, and the panel stays transparent
 * until then. Under reduced motion it arrives and leaves at once.
 */
function usePanelMotion(
  isOpen: boolean,
  placed: boolean,
  setPresent: (present: boolean) => void,
) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const shown = useSharedValue(0)

  useEffect(() => {
    if (isOpen && !placed) {
      return undefined
    }

    if (isOpen) {
      shown.set(
        reduceMotion
          ? 1
          : withTiming(1, {
              duration: motion.durationShort3,
              easing: Easing.bezier(...motion.easingEmphasizedDecelerate),
            }),
      )
      return undefined
    }

    if (reduceMotion) {
      shown.set(0)
      setPresent(false)
      return undefined
    }

    shown.set(
      withTiming(0, {
        duration: motion.durationShort2,
        easing: Easing.bezier(...motion.easingEmphasizedAccelerate),
      }),
    )
    const timer = setTimeout(() => {
      setPresent(false)
    }, motion.durationShort2)

    return () => {
      clearTimeout(timer)
    }
  }, [isOpen, motion, placed, reduceMotion, setPresent, shown])

  return useAnimatedStyle(() => {
    'worklet'
    const progress = shown.get()

    return {
      opacity: progress,
      transform: [{ scale: SCALE_FROM + (1 - SCALE_FROM) * progress }],
    }
  })
}

/**
 * Sends the screen reader back to the trigger once a panel has gone, unless
 * `quiet` says nothing moved it there, as a pointer resting on a hover
 * trigger does not. React Native Web's `Modal` restores focus itself, and has
 * no screen reader to send otherwise.
 */
function useReturnFocus(
  present: boolean,
  quiet: boolean,
  trigger: RefObject<HostInstance | null>,
) {
  const shown = useRef(present)

  useEffect(() => {
    const gone = shown.current && !present
    const target = trigger.current

    shown.current = present
    if (gone && !quiet && target !== null && Platform.OS !== 'web') {
      AccessibilityInfo.sendAccessibilityEvent(target, 'focus')
    }
  }, [quiet, present, trigger])
}

export {
  DismissLayer,
  PANEL_ORIGINS,
  useBackToClose,
  useFocusOnPlaced,
  usePanelMotion,
  useReturnFocus,
}
