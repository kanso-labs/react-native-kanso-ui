import type { RefObject } from 'react'
import type { HostInstance, ViewStyle } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'

import { useEffect, useRef } from 'react'
import {
  AccessibilityInfo,
  BackHandler,
  I18nManager,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import type { OverlaySide, Rect } from './placement'

import { useTheme } from '../theme/scope'
import { useHiddenBelow } from './host'

// What a non-modal panel anchored beside its trigger does besides being
// placed, shared by Popover and Menu so the two cannot drift: the layer a
// press outside lands on, Android's back gesture and Escape on the web, the
// motion in and out, and where a screen reader is sent as it comes and goes.

/** The little of a keyboard event a panel reads. */
type KeyPress = {
  readonly key: string
  readonly preventDefault: () => void
  readonly stopImmediatePropagation: () => void
}

/**
 * The little of the web's document a panel listens to Escape through. The
 * library is typed without the DOM, which Hermes has none of.
 */
type KeyTarget = {
  addEventListener: (
    type: 'keydown' | 'keyup',
    listener: (event: KeyPress) => void,
    capture: boolean,
  ) => void
  removeEventListener: (
    type: 'keydown' | 'keyup',
    listener: (event: KeyPress) => void,
    capture: boolean,
  ) => void
}

// What the panel scales up from as it arrives, web's keyframes'.
const SCALE_FROM = 0.95

/** The edge a panel grows from, the one facing its anchor. */
const PANEL_ORIGINS = {
  bottom: 'top',
  left: 'right',
  right: 'left',
  top: 'bottom',
} as const satisfies Record<OverlaySide, string>

// The panels open on the web that close on Escape, the one opened last at the
// end, which is the one an Escape closes.
const escapable: (() => void)[] = []

const styles = StyleSheet.create({
  // Over the whole screen and under the panel.
  layer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  // The same, passing a press through wherever no part of it is drawn.
  layerAround: {
    bottom: 0,
    left: 0,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 0,
    top: 0,
  },
})

/**
 * Closes a panel on the web when Escape is pressed while it is the last
 * panel opened, so Escape closes the panels one at a time, the one on top
 * first, as React Aria's do. Heard on the document, so it reaches the panel
 * wherever the focus is, on its trigger or inside it. The Escape's release
 * goes no further once it has closed a panel: React Native Web's `Modal`
 * closes on that release, and a dialog under the panel would close with it.
 * Returns what stops listening.
 */
function closeOnEscape(close: () => void) {
  const target: unknown = Reflect.get(globalThis, 'document')

  if (!isKeyTarget(target)) {
    return undefined
  }

  const entry = () => {
    close()
  }
  const swallow = (event: KeyPress) => {
    if (event.key === 'Escape') {
      event.stopImmediatePropagation()
      target.removeEventListener('keyup', swallow, true)
    }
  }
  const onKeyDown = (event: KeyPress) => {
    if (event.key !== 'Escape' || escapable.at(-1) !== entry) {
      return
    }
    event.preventDefault()
    target.addEventListener('keyup', swallow, true)
    entry()
  }

  escapable.push(entry)
  target.addEventListener('keydown', onKeyDown, false)

  return () => {
    target.removeEventListener('keydown', onKeyDown, false)
    escapable.splice(escapable.indexOf(entry), 1)
  }
}

/**
 * The layer a press outside a non-modal panel lands on, drawn just before the
 * panel so it sits under it. The press goes no further, so a press on the
 * trigger closes the panel rather than opening it again, as on web. While it
 * is drawn, a screen reader is kept from the screen under it and from the
 * overlays before it.
 *
 * Given a `hole`, the layer is drawn around that frame rather than over it,
 * so a press there reaches the screen under it and leaves the panel open: a
 * combo box's box, where a tap places the caret in the text being typed, as
 * a click in a combo box's input leaves its list open on web.
 */
function DismissLayer({
  hidesBelow = true,
  hole,
  onPress,
}: {
  /**
   * Whether a screen reader is kept from the screen under the panel, as a
   * finger is. A combo box leaves it in reach, since its input is still
   * typed into while its list is open, as React Aria leaves it on web.
   */
  readonly hidesBelow?: boolean
  readonly hole?: Rect | undefined
  readonly onPress: () => void
}) {
  useHiddenBelow(hidesBelow)

  if (hole === undefined) {
    return <LayerPart onPress={onPress} style={styles.layer} />
  }

  const parts = partsAround(hole)

  return (
    <View style={styles.layerAround}>
      <LayerPart onPress={onPress} style={parts.above} />
      <LayerPart onPress={onPress} style={parts.below} />
      <LayerPart onPress={onPress} style={parts.left} />
      <LayerPart onPress={onPress} style={parts.right} />
    </View>
  )
}

// Whether the web's document is there to listen on.
function isKeyTarget(value: unknown): value is KeyTarget {
  return (
    typeof value === 'object' &&
    value !== null &&
    'addEventListener' in value &&
    'removeEventListener' in value
  )
}

/**
 * One piece of the layer. Nothing but a press reaches it: React Native Web's
 * Pressable is a tab stop unless told otherwise, whatever `focusable` says.
 */
function LayerPart({
  onPress,
  style,
}: {
  readonly onPress: () => void
  readonly style: ViewStyle
}) {
  return (
    <Pressable
      accessible={false}
      aria-hidden
      focusable={false}
      onPress={onPress}
      style={style}
      tabIndex={-1}
    />
  )
}

/**
 * The four pieces of a layer drawn around a frame: the bands above and below
 * it, across the whole layer, and the two beside it, as tall as it. The frame
 * is in physical coordinates, as `measureInWindow` reports it, and React
 * Native swaps `left` and `right` in a right-to-left layout unless an app
 * turns that off, so there each side is set through the other's name.
 */
function partsAround({ height, width, x, y }: Rect) {
  const swapped = I18nManager.isRTL && I18nManager.doLeftAndRightSwapInRTL
  const left = swapped ? 'right' : 'left'
  const right = swapped ? 'left' : 'right'
  const beside: ViewStyle = {
    height,
    position: 'absolute',
    top: y,
  }

  return {
    above: {
      height: Math.max(0, y),
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    below: {
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: y + height,
    },
    left: { ...beside, [left]: 0, width: Math.max(0, x) },
    right: { ...beside, [left]: x + width, [right]: 0 },
  } satisfies Record<string, ViewStyle>
}

/**
 * Closes a non-modal panel from Android's back gesture, as a `Modal` closes a
 * modal one, and on the web from Escape, as a `Modal` closes there. React
 * Native calls the latest back listener first, and Escape closes the panel
 * opened last, so a panel opened from another closes before the one it came
 * from. React Native Web has no back gesture, and its BackHandler reports an
 * error when one is listened for, so only Escape is listened for there.
 *
 * Escape on Android's hardware keyboard closes nothing. React Native hands a
 * view its keys only behind `enableKeyEvents`, a native flag an app sets
 * when it starts, which is off by default and in Expo Go, and its hardware
 * key events leave Escape out. A `Modal` hears Escape natively, which is why
 * a dialog closes on it there.
 */
function useBackToClose(close: () => void, active: boolean) {
  // The latest `close`, so a panel keeps its place among those open when it
  // is handed a new one.
  const latest = useRef(close)

  useEffect(() => {
    latest.current = close
  })

  useEffect(() => {
    if (!active || Platform.OS !== 'web') {
      return undefined
    }
    return closeOnEscape(() => {
      latest.current()
    })
  }, [active])

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
  return usePanelStyle(usePanelShown(isOpen, placed, setPresent))
}

/**
 * How far a panel has arrived, from 0 to 1, on `usePanelMotion`'s timing,
 * for a panel that moves something besides itself with it, as a picker's
 * scrim fades with the surface it is cast by.
 */
function usePanelShown(
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

  return shown
}

/** The panel's fade and scale, for how far it has arrived. */
function usePanelStyle(shown: SharedValue<number>) {
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
  usePanelShown,
  usePanelStyle,
  useReturnFocus,
}
