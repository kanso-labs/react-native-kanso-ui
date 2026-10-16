import type { ComponentRef, ReactNode, Ref } from 'react'
import type { StyleProp, ViewProps, ViewStyle } from 'react-native'
import type { AnimatedStyle, SharedValue } from 'react-native-reanimated'
import type { ToggleState } from 'react-stately/useToggleState'

import { useId, useState } from 'react'
import {
  I18nManager,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useToggleState } from 'react-stately/useToggleState'

import type { ResolvedTheme } from '../../theme/scope'

import {
  ControlLabel,
  ControlMessage,
  describedBy,
  LAYER_SIZE,
  messageOf,
} from '../../control'
import { controlStylesOf } from '../../control/styles'
import { CheckGlyph } from '../../glyphs'
import { hitSlop, usePressFeedback } from '../../press'
import { withOpacity } from '../../theme/color'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// The switch page, as kanso-ui's Switch draws it: a 52 by 32dp track with a
// 2dp outline and a full corner, a handle that is 16dp off, 24dp on and 28dp
// while pressed, a 16dp icon in the handle when asked for, a 40dp state layer
// around the handle and a 48dp target. Off, the track is surface container
// highest inside an outline rule and the handle is outline, turning on surface
// variant while hovered, pressed or focused; on, the track is primary and the
// handle on primary, turning primary container in the same states, with the
// icon in on primary container. Disabled, the track and its rule are on
// surface at the disabled container opacity and the handle on surface at the
// disabled content opacity, or surface when on. The state layer is on surface
// off and primary on, at each state's opacity, and does not swap once pressed
// as a checkbox's does.
//
// The handle travels between the two ends of the track and grows between its
// three sizes over the motion tokens' short duration on the standard curve,
// as web's transition does, and at once for a reader who asks the device for
// reduced motion. The track's colours ease alongside. The state layer and the
// ripple sit on a 40dp disc centred on the handle, so they travel with it.
//
// The handle follows a drag, as the page's pressed switch does: the switch
// flips when it is let go past the middle of the track and springs back when
// it is not. The drag is Gesture Handler's, over the whole track rather than
// only the handle, as a drag on iOS's own switch is. A press that moves less
// than half the travel is still a tap, which the row's `Pressable` takes and
// which flips the switch on its own. Once a drag takes over, Gesture Handler
// ends that press without a tap on iOS and Android, so letting go settles the
// switch once, from where the handle is. React Native Web has nothing to end
// the press with, and the click a pointer's release sends would flip it a
// second time, so there the switch ignores the tap a drag took over.
//
// Under a right-to-left layout the handle starts from the right, and a drag
// toward the left turns the switch on.
//
// Gesture Handler recognises a drag only under its root view, so the track
// carries one of its own, as its guide asks of a library. An app that wraps
// itself in one already makes this one a plain view.
//
// The row, the label and the line under it are src/control's, which Checkbox
// and Radio draw through as well. The whole row is the `Pressable`, so a press
// on the label flips the switch, as a press on web's label does. The line
// under it starts where the label does, past the track.

type Paint = {
  readonly fill: string
  readonly glyph: string
  readonly handle: string
  readonly rule: string
}

type SwitchProps = Omit<ViewProps, 'children' | 'style'> & {
  /**
   * The label, beside the switch. A switch that a row labels some other way
   * leaves it out and passes `aria-label` instead.
   */
  readonly children?: ReactNode
  /**
   * Whether the switch starts on, when it keeps its own state.
   * @default false
   */
  readonly defaultSelected?: boolean
  /**
   * A hint under the label. Replaced by `error` when there is one, so the
   * two never stack.
   */
  readonly description?: string
  /**
   * The problem with the current value, in words. Its presence is what puts
   * the switch in its error state: the line under the label is the error, in
   * the error colour.
   */
  readonly error?: string
  /**
   * Draws the check in the handle while the switch is on, the page's "icon on
   * selected switch" form.
   * @default false
   */
  readonly icon?: boolean
  /**
   * Draws the switch disabled, and takes no presses or drags.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * Shows the state without letting a press or a drag change it.
   * @default false
   */
  readonly isReadOnly?: boolean
  /**
   * Whether the switch is on, for a call site holding the state itself with
   * `onChange`.
   */
  readonly isSelected?: boolean
  /** Called with the new state whenever a press or a drag changes it. */
  readonly onChange?: (isSelected: boolean) => void
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
}

// The track's size and its rule, from the page.
const TRACK_WIDTH = 52
const TRACK_HEIGHT = 32
const TRACK_RULE = 2

// The handle's three sizes and the icon's, from the page.
const HANDLE_OFF = 16
const HANDLE_ON = 24
const HANDLE_PRESSED = 28
const ICON_SIZE = 16

// How far the handle's seat, the pressed handle's 28dp, travels: the track's
// 48dp inside its rule, less the seat. Off, the seat's centre is 16dp from the
// track's start, and on, 16dp from its end, which is where the page's handles
// sit.
const TRAVEL = TRACK_WIDTH - 2 * TRACK_RULE - HANDLE_PRESSED

// How far a press moves before it is a drag: half the travel, the platforms'
// own touch slop, as web's is for a finger. A finger drifts several dp on an
// ordinary tap, and a tap inside this flips the switch. A drag past it is past
// the middle too, so it turns the switch over unless it comes back.
const DRAG_SLOP = TRAVEL / 2

const styles = StyleSheet.create({
  // The 52 by 40 the switch takes in the row, the height of the state layer
  // around the handle, with the track centred in it. Gesture Handler's root
  // view, sized to the track rather than to the screen it fills by default.
  control: {
    flexShrink: 0,
    height: LAYER_SIZE,
    width: TRACK_WIDTH,
  },
  // What the drag is recognised over: the whole of the control.
  drag: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },
  handle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The 40dp state layer, centred on the handle and so on its seat.
  layer: {
    height: LAYER_SIZE,
    position: 'absolute',
    start: (HANDLE_PRESSED - LAYER_SIZE) / 2,
    top: (HANDLE_PRESSED - LAYER_SIZE) / 2,
    width: LAYER_SIZE,
  },
  // The handle's seat, the pressed handle's size, at the start of the track
  // inside its rule. It travels by a translation, so the layout never moves.
  seat: {
    alignItems: 'center',
    height: HANDLE_PRESSED,
    justifyContent: 'center',
    position: 'absolute',
    start: 0,
    top: 0,
    width: HANDLE_PRESSED,
  },
  track: {
    borderWidth: TRACK_RULE,
    height: TRACK_HEIGHT,
    width: TRACK_WIDTH,
  },
})

const stylesOf = themedStyles(({ radii, spacing }) =>
  StyleSheet.create({
    handle: {
      borderRadius: radii.circle,
    },
    // Past the track rather than the 40dp layer a checkbox draws, so the line
    // starts where the label's text does.
    messages: {
      marginStart: TRACK_WIDTH + spacing.sm,
    },
    track: {
      borderRadius: radii.pill,
    },
  }),
)

// A press's flip, unless a drag took the press over. Built by a call rather
// than declared in the component, which is what react-perf's
// jsx-no-new-function-as-prop is after.
function flipOf(state: ToggleState, took: SharedValue<boolean>) {
  return () => {
    if (took.get()) {
      took.set(false)
      return
    }
    state.toggle()
  }
}

/**
 * What the switch is painted in: the track's fill and rule, the handle and
 * the icon. Where the page draws no rule it is the fill made clear rather than
 * plain transparent black, so the rule eases through its own colour rather
 * than through grey.
 */
function paintOf(
  { colors, stateLayerOpacity }: ResolvedTheme,
  {
    active,
    isDisabled,
    on,
  }: {
    readonly active: boolean
    readonly isDisabled: boolean
    readonly on: boolean
  },
): Paint {
  const disabledContent = withOpacity(
    colors.onSurface,
    stateLayerOpacity.disabledContent,
  )

  if (isDisabled) {
    const fill = withOpacity(
      on ? colors.onSurface : colors.surfaceContainerHighest,
      stateLayerOpacity.disabledContainer,
    )

    return {
      fill,
      glyph: disabledContent,
      handle: on ? colors.surface : disabledContent,
      rule: on
        ? withOpacity(fill, 0)
        : withOpacity(colors.onSurface, stateLayerOpacity.disabledContainer),
    }
  }

  if (on) {
    return {
      fill: colors.primary,
      glyph: colors.onPrimaryContainer,
      handle: active ? colors.primaryContainer : colors.onPrimary,
      rule: colors.primary,
    }
  }

  return {
    fill: colors.surfaceContainerHighest,
    glyph: colors.onPrimaryContainer,
    handle: active ? colors.onSurfaceVariant : colors.outline,
    rule: colors.outline,
  }
}

/**
 * A switch that turns a setting on or off, with its label and optionally a
 * description or an error under it. Its state is React Stately's, as web's
 * is: pass `isSelected` with `onChange` to control it, or `defaultSelected` to
 * let it keep its own. A switch takes effect as it is flipped, which is what
 * sets it apart from a checkbox in a form.
 *
 * ```tsx
 * <Switch defaultSelected description="Supporting line">
 *   Label
 * </Switch>
 * ```
 *
 * A screen reader hears it as a switch named by its label, on or off,
 * followed by the line under it. A press anywhere on the track or the label
 * flips it, and the handle can be dragged across the track, settling on
 * whichever side it is let go. `style`, `ref` and `testID` land on the view
 * holding the row and the line under it, which is the element a layout
 * positions. With a `testID`, the drag is registered with Gesture Handler as
 * `<testID>-drag`, which its `getByGestureTestId` finds in a test.
 */
function Switch({
  'aria-label': ariaLabel,
  children,
  defaultSelected,
  description,
  error,
  icon = false,
  isDisabled = false,
  isReadOnly = false,
  isSelected,
  onChange,
  style,
  testID,
  ...props
}: SwitchProps) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const state = useToggleState({
    defaultSelected,
    isReadOnly,
    isSelected,
    onChange,
  })
  const messageId = useId()

  const { colors, radii } = theme
  const on = state.isSelected
  const interactive = !isDisabled && !isReadOnly
  const drag = useHandleDrag({ enabled: interactive, on, state, testID })

  const feedback = usePressFeedback({
    color: on ? colors.primary : colors.onSurface,
    corners: { borderRadius: radii.circle },
    disabled: !interactive,
    disc: LAYER_SIZE,
    onPressIn: drag.onPressIn,
  })
  const active =
    interactive &&
    (drag.dragging ||
      feedback.hovered ||
      feedback.pressed ||
      feedback.ring !== undefined)
  const paint = paintOf(theme, { active, isDisabled, on })
  const size =
    drag.dragging || feedback.pressed
      ? HANDLE_PRESSED
      : on
        ? HANDLE_ON
        : HANDLE_OFF
  const motion = useSwitchMotion(paint, { offset: drag.offset, on, size })

  return (
    <View {...props} style={style} testID={testID}>
      <Pressable
        aria-checked={on}
        aria-label={ariaLabel}
        role="switch"
        {...describedBy(messageId, messageOf(description, error))}
        {...feedback.handlers}
        disabled={isDisabled}
        hitSlop={hitSlop(LAYER_SIZE, TRACK_WIDTH)}
        onPress={drag.pressOf(state)}
        style={controlStylesOf(theme).row}
      >
        <GestureHandlerRootView style={styles.control}>
          <GestureDetector gesture={drag.gesture}>
            <View style={styles.drag}>
              <Animated.View
                style={composeStyles<AnimatedStyle<ViewStyle>>(
                  styles.track,
                  own.track,
                  motion.track,
                  feedback.ring,
                )}
              >
                <Animated.View
                  style={composeStyles<AnimatedStyle<ViewStyle>>(
                    styles.seat,
                    motion.seat,
                  )}
                >
                  <View style={styles.layer}>{feedback.layer}</View>
                  <Animated.View
                    style={composeStyles<AnimatedStyle<ViewStyle>>(
                      styles.handle,
                      own.handle,
                      motion.handle,
                    )}
                  >
                    {icon && on ? (
                      <CheckGlyph color={paint.glyph} size={ICON_SIZE} />
                    ) : null}
                  </Animated.View>
                </Animated.View>
              </Animated.View>
            </View>
          </GestureDetector>
        </GestureHandlerRootView>
        <ControlLabel isDisabled={isDisabled}>{children}</ControlLabel>
      </Pressable>
      <ControlMessage
        description={description}
        error={error}
        id={messageId}
        style={own.messages}
      />
    </View>
  )
}

/**
 * The handle following a drag across the track, and settling from where it
 * is let go: on past the middle, off before it. `offset` is where the drag
 * has put the handle's seat while one is under way, measured from the start
 * of the track, and nothing otherwise, when the seat rests at the end the
 * switch is on.
 *
 * The drag is recognised once it has moved `DRAG_SLOP` across the track, and
 * on the JavaScript thread, since settling sets React state and a drag moves
 * one shared value.
 */
function useHandleDrag({
  enabled,
  on,
  state,
  testID,
}: {
  readonly enabled: boolean
  readonly on: boolean
  readonly state: ToggleState
  readonly testID: string | undefined
}) {
  const [dragging, setDragging] = useState(false)
  const offset = useSharedValue<null | number>(null)
  // Whether a drag has taken over the press in flight, whose click React
  // Native Web would otherwise turn into a second flip. Cleared by the next
  // press rather than by that click, which a touch dragged far enough never
  // sends. A shared value rather than a ref: the gesture's callbacks are
  // built while rendering, and the React Compiler lets no ref reach them.
  const took = useSharedValue(false)

  // Where the press began across the track. Gesture Handler measures its
  // translation from where the drag was recognised, past the slop, so the
  // distance is taken from here instead, as web's is from the press.
  const began = useSharedValue(0)

  // Puts the seat where the drag has carried it, from the end it started at,
  // and no further than either end.
  function follow(x: number) {
    const along = I18nManager.isRTL ? began.get() - x : x - began.get()
    offset.set(Math.min(TRAVEL, Math.max(0, (on ? TRAVEL : 0) + along)))
  }

  // Gesture Handler 3 deprecates this builder for hooks that version 2 does not
  // have, and the peer range admits both, so the builder stays while it does.
  // oxlint-disable-next-line react/capitalized-calls, typescript/no-deprecated -- a builder named after its gesture, not a component; see above
  const pan = Gesture.Pan()
    .activeOffsetX([-DRAG_SLOP, DRAG_SLOP])
    .enabled(enabled)
    .runOnJS(true)
    .onBegin(({ x }) => {
      began.set(x)
    })
    .onStart(({ x }) => {
      took.set(Platform.OS === 'web')
      setDragging(true)
      follow(x)
    })
    .onUpdate(({ x }) => {
      follow(x)
    })
    .onEnd((_event, success) => {
      const stopped = offset.get()
      if (success && stopped !== null && stopped > TRAVEL / 2 !== on) {
        state.setSelected(!on)
      }
    })
    .onFinalize(() => {
      offset.set(null)
      setDragging(false)
    })

  return {
    dragging,
    gesture: testID === undefined ? pan : pan.withTestId(`${testID}-drag`),
    offset,
    onPressIn: () => {
      took.set(false)
    },
    pressOf: (toggle: ToggleState) => flipOf(toggle, took),
  }
}

// The track's colours, the seat's travel and the handle's size and colour,
// eased to as the state changes. While a drag is under way the seat follows it
// at once, and once it ends the seat eases from wherever it was let go.
function useSwitchMotion(
  { fill, handle, rule }: Paint,
  {
    offset,
    on,
    size,
  }: {
    readonly offset: SharedValue<null | number>
    readonly on: boolean
    readonly size: number
  },
) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const timing = {
    duration: motion.durationShort2,
    easing: Easing.bezier(...motion.easingStandard),
  }
  // A translation is not mirrored under a right-to-left layout, though the
  // seat's start is, so the seat travels the other way there.
  const direction = I18nManager.isRTL ? -1 : 1
  const rest = (on ? TRAVEL : 0) * direction

  const track = useAnimatedStyle(() => {
    'worklet'
    return {
      backgroundColor: reduceMotion ? fill : withTiming(fill, timing),
      borderColor: reduceMotion ? rule : withTiming(rule, timing),
    }
  })
  const seat = useAnimatedStyle(() => {
    'worklet'
    const dragged = offset.get()
    return {
      transform: [
        {
          translateX:
            dragged !== null
              ? dragged * direction
              : reduceMotion
                ? rest
                : withTiming(rest, timing),
        },
      ],
    }
  })
  const handleMotion = useAnimatedStyle(() => {
    'worklet'
    return {
      backgroundColor: reduceMotion ? handle : withTiming(handle, timing),
      height: reduceMotion ? size : withTiming(size, timing),
      width: reduceMotion ? size : withTiming(size, timing),
    }
  })

  return { handle: handleMotion, seat, track }
}

export { Switch }
export type { SwitchProps }
