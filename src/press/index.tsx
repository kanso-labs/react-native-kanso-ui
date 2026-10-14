import type { ReactNode } from 'react'
import type { Insets, PressableProps, ViewStyle } from 'react-native'

import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { useTheme } from '../theme/scope'
import { styles, stylesOf } from './styles'

/** The corners a control is drawn with, which its feedback clips to. */
type Corners = Pick<
  ViewStyle,
  | 'borderBottomEndRadius'
  | 'borderBottomStartRadius'
  | 'borderRadius'
  | 'borderTopEndRadius'
  | 'borderTopStartRadius'
>

/** The handlers the feedback reads its states from. */
type Handlers = Pick<
  PressableProps,
  'onBlur' | 'onFocus' | 'onHoverIn' | 'onHoverOut' | 'onPressIn' | 'onPressOut'
>

type Point = { readonly x: number; readonly y: number }

type PressFeedback = {
  /**
   * The handlers to hand the control's `Pressable`. Each calls the one of
   * the same name it was given after its own.
   */
  readonly handlers: {
    readonly [Name in keyof Handlers]-?: NonNullable<Handlers[Name]>
  }
  /** The state layer and the ripple, to render as the `Pressable`'s first child. */
  readonly layer: ReactNode
  /** The focus ring while it shows, to compose into the control's style. */
  readonly ring: undefined | ViewStyle
}

type PressFeedbackOptions = Handlers & {
  /**
   * The colour the layer and the ripple are drawn in: the theme's value for
   * the control's content colour role.
   */
  readonly color: string
  /** The control's corners, which the layer and the ripple clip to. */
  readonly corners?: Corners | undefined
  readonly disabled?: boolean | null | undefined
  /**
   * Draws no ripple and leaves the state layer, as `disableRipple` does on
   * web's Button.
   */
  readonly disableRipple?: boolean | undefined
}

/** Where the ripple starts and ends, and how far it grows, for one press. */
type RippleGeometry = {
  readonly end: Point
  readonly scale: number
  readonly size: number
  readonly start: Point
}

// Where the ripple of the latest press is: waiting on the control's
// measurement, shown, or released before the measurement arrived.
type RipplePhase = 'idle' | 'measuring' | 'released' | 'shown'

/**
 * The least a touch target measures each way, from Material Design's
 * accessibility guidance. A floor rather than a token, as web's `TARGET_SIZE`
 * is: a theme changes how big a control is drawn, never how small a target
 * may be.
 */
const TARGET_SIZE = 48

// The ripple starts as a disc a fifth of the control's longer side, as on web.
const INITIAL_ORIGIN_SCALE = 0.2

// The fade, in milliseconds: quick in and slow out, so a tap reads as a ripple
// rather than a flicker. These are web's, and deliberately not motion tokens:
// the two are tuned as a ratio to each other, which snapping either to the
// scale would undo. Linear for the same reason, since a fade to and from a
// state layer wants no acceleration.
const FADE_IN = 105
const FADE_OUT = 375

const NO_RIPPLE: RippleGeometry = {
  end: { x: 0, y: 0 },
  scale: 1,
  size: 0,
  start: { x: 0, y: 0 },
}

/**
 * The `hitSlop` that brings a control smaller than 48dp up to a 48dp target,
 * centred on it, as web's controls draw their target with a `::before`.
 * Nothing for a control already that big. A width left out is taken to be
 * wide enough, as a labelled button's is.
 */
function hitSlop(height: number, width = TARGET_SIZE): Insets | undefined {
  const vertical = Math.max(0, (TARGET_SIZE - height) / 2)
  const horizontal = Math.max(0, (TARGET_SIZE - width) / 2)

  if (vertical === 0 && horizontal === 0) {
    return undefined
  }

  return {
    bottom: vertical,
    left: horizontal,
    right: horizontal,
    top: vertical,
  }
}

/**
 * The press feedback every interactive control draws: the state layer, the
 * ripple and the focus ring, as Material Design's state layers page sets them
 * out.
 *
 * The state layer is the control's content colour at the state's opacity
 * token, over the whole control: hover for an iPad pointer or an Android
 * mouse, focus while the ring shows, pressed while pressed. React Native has
 * no `color-mix()`, so it is a view of its own rather than a blended
 * background.
 *
 * The ripple grows from the press point to cover the control and fades out
 * once the press ends, held at least `durationMedium1` so a tap reads, and is
 * drawn the same on iOS and Android rather than through Android's own
 * `android_ripple`. It is a solid disc where web's has a soft edge, since
 * React Native draws a gradient only through an experimental style that React
 * Native Web ignores. It is not drawn while the device asks for reduced
 * motion, where the pressed layer alone marks the press.
 *
 * The ring shows when focus arrives from a keyboard, and not when it arrives
 * with a press, which on web is a click focusing what it presses.
 *
 * ```tsx
 * const feedback = usePressFeedback({ color: colors.onPrimary, corners, onPressIn })
 *
 * <Pressable {...feedback.handlers} style={[styles.button, feedback.ring]}>
 *   {feedback.layer}
 *   <Text>Label</Text>
 * </Pressable>
 * ```
 */
function usePressFeedback({
  color,
  corners,
  disabled,
  disableRipple = false,
  onBlur,
  onFocus,
  onHoverIn,
  onHoverOut,
  onPressIn,
  onPressOut,
}: PressFeedbackOptions): PressFeedback {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [ringShown, setRingShown] = useState(false)
  const focused = useRef(false)
  // Whether the press in flight began while the control had no focus, which
  // makes the focus that follows it a pointer's.
  const pressedUnfocused = useRef(false)
  const pressStarted = useRef(0)
  const phase = useRef<RipplePhase>('idle')
  const geometry = useSharedValue(NO_RIPPLE)
  const grow = useSharedValue(0)
  const fade = useSharedValue(0)

  const { motion, spacing, stateLayerOpacity } = theme
  const active = disabled !== true
  const rippled = active && !disableRipple && !reduceMotion

  const rippleMotion = useAnimatedStyle(() => {
    'worklet'
    const { end, scale, size, start } = geometry.get()
    const progress = grow.get()

    // The whole style is the animation's, so the view takes the one object it
    // hands back.
    return {
      backgroundColor: color,
      borderRadius: size / 2,
      height: size,
      left: 0,
      opacity: fade.get(),
      position: 'absolute',
      top: 0,
      transform: [
        { translateX: start.x + (end.x - start.x) * progress },
        { translateY: start.y + (end.y - start.y) * progress },
        { scale: 1 + (scale - 1) * progress },
      ],
      width: size,
    }
  })

  // Grows a disc a fifth of the control's longer side from the press point
  // to the centre, until it covers the control and `spacing.sm` beyond its
  // corners, as web's does.
  function ripple(width: number, height: number, origin: Point) {
    const size = Math.max(
      1,
      Math.floor(Math.max(width, height) * INITIAL_ORIGIN_SCALE),
    )

    geometry.set({
      end: { x: (width - size) / 2, y: (height - size) / 2 },
      scale: (Math.hypot(width, height) + spacing.sm) / size,
      size,
      start: { x: origin.x - size / 2, y: origin.y - size / 2 },
    })
    grow.set(0)
    grow.set(
      withTiming(1, {
        duration: motion.durationLong1,
        easing: Easing.bezier(...motion.easingStandard),
      }),
    )
    fade.set(
      withTiming(stateLayerOpacity.pressed, {
        duration: FADE_IN,
        easing: Easing.linear,
      }),
    )
    pressStarted.current = Date.now()
  }

  // Fades the ripple out, once it has been shown for `durationMedium1`.
  function release() {
    const shown = Date.now() - pressStarted.current

    fade.set(
      withDelay(
        Math.max(0, motion.durationMedium1 - shown),
        withTiming(0, { duration: FADE_OUT, easing: Easing.linear }),
      ),
    )
  }

  const handlers: PressFeedback['handlers'] = {
    onBlur: (event) => {
      focused.current = false
      setRingShown(false)
      onBlur?.(event)
    },
    onFocus: (event) => {
      focused.current = true
      setRingShown(!pressedUnfocused.current)
      pressedUnfocused.current = false
      onFocus?.(event)
    },
    onHoverIn: (event) => {
      setHovered(true)
      onHoverIn?.(event)
    },
    onHoverOut: (event) => {
      setHovered(false)
      onHoverOut?.(event)
    },
    onPressIn: (event) => {
      pressedUnfocused.current = !focused.current
      setPressed(true)

      if (rippled) {
        const { pageX, pageY } = event.nativeEvent

        // A touch's own location is measured from whichever child it landed
        // on, so the point is taken from the page and the control measured
        // there. A press from a key carries no point, and ripples from the
        // centre. React Native Web measures a frame later, so a press can end
        // first, and its ripple is then drawn whole.
        phase.current = 'measuring'
        event.currentTarget.measure((_x, _y, width, height, left, top) => {
          ripple(width, height, {
            x: Number.isFinite(pageX - left) ? pageX - left : width / 2,
            y: Number.isFinite(pageY - top) ? pageY - top : height / 2,
          })

          if (phase.current === 'released') {
            release()
            phase.current = 'idle'
          } else {
            phase.current = 'shown'
          }
        })
      }

      onPressIn?.(event)
    },
    onPressOut: (event) => {
      pressedUnfocused.current = false
      setPressed(false)

      if (phase.current === 'shown') {
        release()
      }
      phase.current = phase.current === 'measuring' ? 'released' : 'idle'

      onPressOut?.(event)
    },
  }

  const layerOpacity = !active
    ? 0
    : pressed
      ? stateLayerOpacity.pressed
      : ringShown
        ? stateLayerOpacity.focus
        : hovered
          ? stateLayerOpacity.hover
          : 0
  const surface = StyleSheet.compose(styles.surface, corners)
  const state = StyleSheet.compose(styles.layer, {
    backgroundColor: color,
    opacity: layerOpacity,
  })

  return {
    handlers,
    layer: (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={surface}
      >
        <View style={state} />
        {rippled ? <Animated.View style={rippleMotion} /> : null}
      </View>
    ),
    ring: active && ringShown ? stylesOf(theme).ring : undefined,
  }
}

export { hitSlop, usePressFeedback }
export type { Corners, PressFeedback, PressFeedbackOptions }
