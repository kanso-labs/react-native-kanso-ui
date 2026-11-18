import type { ReactNode } from 'react'
import type { Insets, PressableProps, ViewStyle } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'

import { useRef, useState } from 'react'
import { Platform, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { useTheme } from '../theme/scope'
import { composeStyles } from '../theme/styles'
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
  /**
   * Whether a pointer is over the control, for a control that draws more
   * than the layer while hovered. Never while disabled or pending.
   */
  readonly hovered: boolean
  /** The state layer and the ripple, to render as the `Pressable`'s first child. */
  readonly layer: ReactNode
  /**
   * Whether the control is pressed, for a control that draws more than the
   * layer while pressed. Never while disabled or pending.
   */
  readonly pressed: boolean
  /** The focus ring while it shows, to compose into the control's style. */
  readonly ring: undefined | ViewStyle
}

type PressFeedbackOptions = Handlers & {
  /**
   * The size of a layer drawn on a part of the control rather than across
   * it, as a navigation destination draws its layer on the indicator behind
   * its icon. The ripple then grows from that part's centre wherever the
   * press lands, and nothing is measured, as for `disc`.
   */
  readonly area?: Size | undefined
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
  /**
   * The side of a round layer of a fixed size, for a control whose state
   * layer is a disc beside its label rather than the whole control: a
   * checkbox's. The ripple then grows from the disc's centre wherever the
   * press lands, and nothing is measured. Left out, the ripple grows from
   * the press point across the control.
   */
  readonly disc?: number | undefined
  /**
   * Takes no press or hover while true, with no layer and no ripple for
   * either, and keeps the focus and its ring, as a pending button does.
   */
  readonly pending?: boolean | undefined
  /**
   * The colour the pressed layer and the ripple are drawn in, where it
   * differs from the hover and focus layers': a checkbox's swaps between
   * primary and on surface once pressed. Defaults to `color`.
   */
  readonly pressedColor?: string | undefined
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

type Size = { readonly height: number; readonly width: number }

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
 * Whether the browser draws its focus ring on the control a focus `event`
 * arrived at, by the `:focus-visible` rule web's ring is drawn under, or
 * `undefined` where the control is not an element of a page, as on a device.
 */
function focusVisibleOn(event: unknown): boolean | undefined {
  const target =
    typeof event === 'object' && event !== null && 'currentTarget' in event
      ? event.currentTarget
      : undefined

  return Platform.OS === 'web' && matchesSelectors(target)
    ? target.matches(':focus-visible')
    : undefined
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

// A page's element, which the library's types, written without the DOM's,
// know only by the method it is read through.
function matchesSelectors(
  target: unknown,
): target is { readonly matches: (selectors: string) => boolean } {
  return (
    typeof target === 'object' &&
    target !== null &&
    'matches' in target &&
    typeof target.matches === 'function'
  )
}

/**
 * The ripple's disc, which follows the shared values `usePressFeedback`
 * moves it by. Drawn from a control's first press on, so its animated style
 * is kept only for a control that has been pressed.
 */
function Ripple({
  color,
  fade,
  geometry,
  grow,
}: {
  readonly color: string
  readonly fade: SharedValue<number>
  readonly geometry: SharedValue<RippleGeometry>
  readonly grow: SharedValue<number>
}) {
  const motion = useAnimatedStyle(() => {
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

  return <Animated.View style={motion} />
}

/**
 * The press feedback every interactive control draws: the state layer, the
 * ripple and the focus ring, as Material Design's state layers page sets them
 * out.
 *
 * The state layer is the control's content colour at the state's opacity
 * token, over the whole control: hover for an iPad pointer or an Android
 * mouse, focus while the ring shows. React Native has no `color-mix()`, so it
 * is a view of its own rather than a blended background.
 *
 * A press is one layer, as the page draws it: the ripple at the pressed
 * opacity, over the control at rest. The hover and focus layers come off
 * while a pointer presses the control, so neither stacks under the ripple,
 * and the pressed layer is the one the control draws in the ripple's place:
 * when `disableRipple` turns the ripple off, while the device asks for
 * reduced motion, and while a key holds the control down, since the ripple
 * answers a key only once it is released. The layer then gives way to the
 * ripple, which plays its whole press from the centre, as on web.
 *
 * The ripple grows from the press point to cover the control and fades out
 * once the press ends, held at least `durationMedium1` so a tap reads, and is
 * drawn the same on iOS and Android rather than through Android's own
 * `android_ripple`. It is a solid disc where web's has a soft edge, since
 * React Native draws a gradient only through an experimental style that React
 * Native Web ignores.
 *
 * A control whose layer is a disc of its own beside its label, as a
 * checkbox's is, passes the disc's side as `disc`, and its ripple grows from
 * the disc's centre instead. One whose layer is drawn on a part of it of a
 * fixed size passes that size as `area`, with the same effect. One whose
 * pressed layer takes another colour passes it as `pressedColor`.
 *
 * The ring shows when focus arrives from a keyboard, and not when it arrives
 * with a press. On web that is the browser's own `:focus-visible`, read as
 * focus arrives, since React Native Web focuses a control as the mouse goes
 * down, before its press begins. On a device, where focus moves under a
 * hardware keyboard, it is focus that no press brought.
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
  area,
  color,
  corners,
  disabled,
  disableRipple = false,
  disc,
  onBlur,
  onFocus,
  onHoverIn,
  onHoverOut,
  onPressIn,
  onPressOut,
  pending,
  pressedColor = color,
}: PressFeedbackOptions): PressFeedback {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  // Whether the press in flight is a key's, which draws the pressed layer
  // until it is released and plays the ripple then.
  const [keyHeld, setKeyHeld] = useState(false)
  const [ringShown, setRingShown] = useState(false)
  const focused = useRef(false)
  // Whether the press in flight began while the control had no focus, which
  // makes the focus that follows it a pointer's.
  const pressedUnfocused = useRef(false)
  const pressStarted = useRef(0)
  const phase = useRef<RipplePhase>('idle')
  // The size a key's ripple is drawn at, measured as the key goes down.
  const keySize = useRef<Size>(undefined)
  const geometry = useSharedValue(NO_RIPPLE)
  const grow = useSharedValue(0)
  const fade = useSharedValue(0)
  // Whether the control has been pressed since it was drawn, which is when
  // its ripple's view is first drawn. A long list draws a row's feedback for
  // every row in reach, and most are never pressed, so each would otherwise
  // carry an animated view, and Reanimated a style to keep, for nothing.
  const [armed, setArmed] = useState(false)

  const { motion, spacing, stateLayerOpacity } = theme
  const active = disabled !== true
  const interactive = active && pending !== true
  const rippled = interactive && !disableRipple && !reduceMotion

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

  // Plays the ripple of a key's press from the centre of a control `size`
  // across, once the key is released, and lets it go at once, so it shows
  // for the least a ripple may.
  function playFromCentre({ height, width }: Size) {
    ripple(width, height, { x: width / 2, y: height / 2 })
    release()
  }

  const handlers: PressFeedback['handlers'] = {
    onBlur: (event) => {
      focused.current = false
      setRingShown(false)
      onBlur?.(event)
    },
    onFocus: (event) => {
      focused.current = true
      setRingShown(focusVisibleOn(event) ?? !pressedUnfocused.current)
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
      const { pageX, pageY } = event.nativeEvent
      // A press from a key carries no point on the page.
      const fromKey = !Number.isFinite(pageX) || !Number.isFinite(pageY)
      const fixed = disc === undefined ? area : { height: disc, width: disc }

      pressedUnfocused.current = !focused.current
      setPressed(true)
      setKeyHeld(fromKey)
      if (rippled && !armed) {
        setArmed(true)
      }

      // Where the ripple is off, the pressed layer alone marks the press.
      if (rippled && fromKey) {
        // A key's ripple waits for the release, so the control is measured
        // as the key goes down and the ripple drawn from that size then.
        keySize.current = fixed
        if (fixed === undefined && typeof event.currentTarget !== 'number') {
          event.currentTarget.measure((_x, _y, width, height) => {
            keySize.current = { height, width }

            if (phase.current === 'released') {
              playFromCentre(keySize.current)
              phase.current = 'idle'
            }
          })
        }
      } else if (rippled && fixed !== undefined) {
        ripple(fixed.width, fixed.height, {
          x: fixed.width / 2,
          y: fixed.height / 2,
        })
        phase.current = 'shown'
      } else if (rippled && typeof event.currentTarget !== 'number') {
        // A touch's own location is measured from whichever child it landed
        // on, so the point is taken from the page and the control measured
        // there. React Native Web measures a frame later, so a press can end
        // first, and its ripple is then drawn whole. React Native types the
        // target as a bare view tag too, which has nothing to measure.
        phase.current = 'measuring'
        event.currentTarget.measure((_x, _y, width, height, left, top) => {
          ripple(width, height, { x: pageX - left, y: pageY - top })

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
      setKeyHeld(false)

      if (rippled && keyHeld) {
        if (keySize.current === undefined) {
          phase.current = 'released'
        } else {
          playFromCentre(keySize.current)
          phase.current = 'idle'
        }
      } else {
        if (phase.current === 'shown') {
          release()
        }
        phase.current = phase.current === 'measuring' ? 'released' : 'idle'
      }

      onPressOut?.(event)
    },
  }

  // The pressed layer, where no ripple draws the press; a pointer's press
  // with the ripple on keeps the control at rest under it.
  const pressedLayer = interactive && pressed && (!rippled || keyHeld)
  const layerOpacity = !active
    ? 0
    : pressedLayer
      ? stateLayerOpacity.pressed
      : interactive && pressed
        ? 0
        : ringShown
          ? stateLayerOpacity.focus
          : interactive && hovered
            ? stateLayerOpacity.hover
            : 0
  const surface = composeStyles<ViewStyle>(styles.surface, corners)
  const state = composeStyles<ViewStyle>(styles.layer, {
    backgroundColor: pressedLayer ? pressedColor : color,
    opacity: layerOpacity,
  })

  return {
    handlers,
    hovered: interactive && hovered,
    layer: (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={surface}
      >
        <View style={state} />
        {rippled && armed ? (
          <Ripple
            color={pressedColor}
            fade={fade}
            geometry={geometry}
            grow={grow}
          />
        ) : null}
      </View>
    ),
    pressed: interactive && pressed,
    ring: active && ringShown ? stylesOf(theme).ring : undefined,
  }
}

export { hitSlop, TARGET_SIZE, usePressFeedback }
export type { Corners, PressFeedback, PressFeedbackOptions }
