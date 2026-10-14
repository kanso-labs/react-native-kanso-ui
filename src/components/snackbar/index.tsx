import type { ReactNode, Ref } from 'react'
import type {
  LayoutChangeEvent,
  StyleProp,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle, SharedValue } from 'react-native-reanimated'

import { use, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  AccessibilityInfo,
  Text as NativeText,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

import { CloseGlyph } from '../../glyphs'
import { useWindowSizeClass } from '../../hooks/useWindowSizeClass'
import { Overlay } from '../../overlay'
import { hitSlop, usePressFeedback } from '../../press'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// The snackbar page's brief message at the bottom of the screen, with an
// optional action beside it and an optional close button after that, as
// kanso-ui's Snackbar draws it. The page's container is the inverse surface
// at a 4dp corner and elevation 3, its supporting text is body-medium in
// inverse on surface, its action label is inverse primary, and its close icon
// takes the supporting text's colour. The measurements are the page's too: 8dp
// of margin from the edges of the screen, 8dp of padding inside the container
// with another 8dp either side of the message, 14dp above and below on a
// single line, and between 320 and 576dp wide from the 600dp breakpoint up,
// the width of the window less its margins below it. The margin is counted
// from the safe area, so a message clears the home indicator and the gesture
// bar.
//
// One at a time, as on web. The page shows a single snackbar and replaces it
// rather than stacking, so a message added while another is up closes that
// one, whose `onClose` runs, and takes its place. Nothing waits behind it, so
// an Undo never comes back long after the thing it undid.
//
// The queue is web's API: `add` a message with its options from anywhere, and
// mount one `Snackbar` with the queue near the root. It draws in the overlay
// host of the outermost `ThemeScope`, so it floats above every screen in the
// theme around it.
//
// **A message is read out as it arrives.** On iOS and Android it is
// announced through `AccessibilityInfo`, after whatever VoiceOver is already
// saying, which is how CopyField says its confirmation too. Under React Native
// Web the region it appears in is a polite live region instead, as web's is,
// and the browser's screen reader reads it as it changes. Android is not given
// a live region as well, since TalkBack would then read each message twice.
//
// **A message is a string, where web takes a node.** The announcement is the
// message's words, and a node has none to hand VoiceOver.
//
// **The action and the close button are drawn here rather than through
// Button and IconButton**, as on web: the page colours them inverse primary
// and inverse on surface, which no variant of either carries. They take the
// state layer, the ripple and the focus ring from src/press, with the ring
// drawn 2dp inside the control rather than outside it: the close button is
// 48dp in a strip 48dp tall, so a ring outside it crossed the strip's edges
// onto the screen, in a colour chosen to read on the strip rather than on
// the screen around it.

// How long a message is shown when the call site names no `timeout`, web's
// durations from the snackbar's guidelines and accessibility pages. A message
// alone leaves after five seconds, which Android lengthens from the reader's
// own accessibility setting, as its own snackbar does. A message with an
// action stays until the action is taken or something closes it, since no
// timer knows how long a reader needs to reach it.
const MESSAGE_MS = 5000
const UNTIL_CLOSED = 0

// The width from the 600dp breakpoint up, the page's. Literals, as on web:
// they bound the strip rather than measure anything a theme would resize.
const MIN_WIDE = 320
const MAX_WIDE = 576

// The page's 14dp above and below the message, which with its 20dp line makes
// a single-line strip 48dp tall. A literal, as on web, since no spacing step
// is 14.
const MESSAGE_BLOCK_PADDING = 14

// The ring's 2dp, drawn 4dp in from the control's edge so all of it lies
// inside.
const RING_WIDTH = 2
const RING_OFFSET = -4

// Outside a SafeAreaProvider the insets are unknown, and the window's own edge
// is the best bound there is.
const NO_INSETS = { bottom: 0, left: 0, right: 0, top: 0 }

const stylesOf = themedStyles(({ colors, radii, shadows, sizing, spacing }) =>
  StyleSheet.create({
    // Material Design's text button in the page's inverse primary, at the
    // label large the page gives it: 40dp tall, as Button's medium size is,
    // over a 48dp target, which is the strip's own height. A least height
    // rather than a height, so a type scale with a taller line grows the
    // button instead of clipping its label.
    action: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: sizing.controlSm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    actionLabel: {
      color: colors.inversePrimary,
    },
    actionRing: {
      outlineColor: colors.inversePrimary,
      outlineOffset: RING_OFFSET,
      outlineStyle: 'solid',
      outlineWidth: RING_WIDTH,
    },
    // The page's 24dp icon in the supporting text's colour, in a 48dp box,
    // the least press area the icon buttons page allows.
    close: {
      alignItems: 'center',
      height: sizing.controlMd,
      justifyContent: 'center',
      width: sizing.controlMd,
    },
    closeRing: {
      outlineColor: colors.inverseOnSurface,
      outlineOffset: RING_OFFSET,
      outlineStyle: 'solid',
      outlineWidth: RING_WIDTH,
    },
    // Both controls are pills, which the state layer and the ripple clip to.
    control: {
      borderRadius: radii.pill,
    },
    // The message: its 8dp either side inside the strip's own 8dp, and the
    // 14dp above and below. The height is the message's rather than the
    // strip's, which is what lets a 48dp close button sit beside it without
    // making the strip taller than the page draws it.
    //
    // Its basis is half the strip, which is what decides when the controls
    // drop beneath it. A word longer than the line holds breaks inside
    // itself rather than running under the controls, which the least width
    // of 0 allows on the web, where a flex item otherwise keeps the width of
    // its longest word.
    message: {
      flexBasis: '50%',
      flexGrow: 1,
      marginHorizontal: spacing.sm,
      minWidth: 0,
      paddingVertical: MESSAGE_BLOCK_PADDING,
    },
    messageText: {
      color: colors.inverseOnSurface,
    },
    // A strip along the bottom of the overlay layer, with the page's 8dp
    // above it. It passes a touch through wherever no strip is drawn, so
    // the screen under it stays usable.
    region: {
      alignItems: 'center',
      bottom: 0,
      left: 0,
      paddingTop: spacing.sm,
      pointerEvents: 'box-none',
      position: 'absolute',
      right: 0,
    },
    // The container: the page's 8dp either side, and nothing above or
    // below, since what sets its height is the message and the close
    // button. It wraps, so controls too long to leave the message half the
    // strip drop onto a line of their own beneath it, Material Design's
    // two-line snackbar with a longer action.
    strip: {
      alignItems: 'center',
      backgroundColor: colors.inverseSurface,
      borderRadius: radii.xs,
      boxShadow: shadows.elevation3,
      flexDirection: 'row',
      flexWrap: 'wrap',
      minHeight: sizing.controlMd,
      paddingHorizontal: spacing.sm,
      width: '100%',
    },
  }),
)

const styles = StyleSheet.create({
  // The action, and the close button after it, kept together after the
  // message so they move beneath it together. The auto margin puts them at
  // the trailing edge: on the message's row the message takes all the room
  // first, and on a row of their own it is all the room there is.
  controls: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    marginStart: 'auto',
  },
  wide: {
    maxWidth: MAX_WIDE,
    minWidth: MIN_WIDE,
  },
})

// A message on screen, with what it was added with.
type ShownMessage = {
  readonly action: SnackbarAction | undefined
  readonly key: string
  readonly message: string
  readonly onClose: (() => void) | undefined
  readonly showCloseButton: boolean
  readonly timeout: number
}

type SnackbarAction = {
  /** What the action says. The page gives it a single word where it can. */
  readonly label: string
  /** Run when the action is pressed, just before the snackbar closes. */
  readonly onPress: () => void
}

type SnackbarOptions = {
  /**
   * A single action shown after the message. Pressing it runs `onPress` and
   * closes the snackbar, which is what the page draws.
   */
  readonly action?: SnackbarAction
  /**
   * Run when the snackbar closes, however it was closed: by its timer, its
   * action or close button, `close`, `clear`, or a newer message added in its
   * place.
   */
  readonly onClose?: () => void
  /**
   * Whether a close button is shown at the end. The page draws one for a
   * message a reader may want out of the way before it expires.
   * @default false
   */
  readonly showCloseButton?: boolean
  /**
   * How long the snackbar is shown, in milliseconds. Defaults to five seconds
   * for a message alone, which Android lengthens from the reader's own
   * accessibility setting. A message with an action defaults to `0` and stays
   * until the action is taken or something closes it, as Material Design asks
   * of an actionable snackbar. The timer is paused while a pointer is over the
   * snackbar or one of its controls has focus, so a message never expires
   * while it is being read.
   *
   * `0` is the page's indefinite length: the snackbar stays until something
   * closes it. Give one of those an action or `showCloseButton`, or there is
   * no way to be rid of it.
   */
  readonly timeout?: number
}

type SnackbarProps = Omit<ViewProps, 'children' | 'style'> & {
  /**
   * What a screen reader calls the button that dismisses a snackbar. It sits
   * here rather than on a message's own options because it does not vary by
   * message.
   * @default 'Close'
   */
  readonly closeLabel?: string
  /** The queue the snackbar shows messages from. */
  readonly queue: SnackbarQueue
  readonly ref?: Ref<View>
  readonly style?: StyleProp<ViewStyle>
}

/**
 * The queue a snackbar is shown from. Make one where the app can reach it, a
 * module of its own being the usual place, mount `Snackbar` once with it, and
 * call `add` from anywhere.
 *
 * ```ts
 * const messages = new Snackbar.Queue()
 * messages.add('Label', { action: { label: 'Undo', onPress: undo } })
 * ```
 */
class SnackbarQueue {
  #added = 0
  readonly #listeners = new Set<() => void>()
  #shown: null | ShownMessage = null

  /**
   * Shows a message in place of the one on screen, and returns the key that
   * closes it. The message it replaces is closed, so its `onClose` runs, and
   * it does not come back.
   */
  add(message: string, options: SnackbarOptions = {}): string {
    const { action, onClose, showCloseButton = false, timeout } = options

    this.clear()
    this.#added += 1

    const key = `snackbar-${String(this.#added)}`

    this.#shown = {
      action,
      key,
      message,
      onClose,
      showCloseButton,
      timeout: timeout ?? (action === undefined ? MESSAGE_MS : UNTIL_CLOSED),
    }
    this.#changed()

    return key
  }

  /** Closes the snackbar on screen, running its `onClose`. */
  clear() {
    if (this.#shown !== null) {
      this.close(this.#shown.key)
    }
  }

  /** Closes one snackbar, by the key `add` returned. */
  close(key: string) {
    const shown = this.#shown

    if (shown?.key !== key) {
      return
    }

    // Off the screen before `onClose` runs, so one that adds the next message
    // adds it to an empty queue.
    this.#shown = null
    this.#changed()
    shown.onClose?.()
  }

  /**
   * Calls `listener` whenever the message on screen changes, and returns what
   * stops it. `Snackbar` reads the queue through this and `visible`, and
   * neither is meant for a call site.
   */
  readonly subscribe = (listener: () => void) => {
    this.#listeners.add(listener)

    return () => {
      this.#listeners.delete(listener)
    }
  }

  /** The message on screen, or `null`. */
  readonly visible = () => this.#shown

  #changed() {
    for (const listener of this.#listeners) {
      listener()
    }
  }
}

// The handlers the strip hands its views, each built by a call rather than
// declared in the component, which is what react-perf's
// jsx-no-new-function-as-prop is after; the React Compiler memoises the result
// on its inputs.
function actionOf(action: SnackbarAction, close: () => void) {
  return () => {
    action.onPress()
    close()
  }
}

function closeOf(queue: SnackbarQueue, key: string) {
  return () => {
    queue.close(key)
  }
}

function flagOf(set: (value: boolean) => void, value: boolean) {
  return () => {
    set(value)
  }
}

function measureInto(height: SharedValue<number>) {
  return (event: LayoutChangeEvent) => {
    height.set(event.nativeEvent.layout.height)
  }
}

/**
 * A brief message at the bottom of the screen, with an optional action, with
 * web's props and values. Mount one of these with a `Snackbar.Queue`, and
 * call the queue's `add` to show a message from anywhere.
 *
 * ```tsx
 * const messages = new Snackbar.Queue()
 *
 * <Snackbar queue={messages} />
 * ```
 *
 * It draws in the overlay host of the app's outermost `ThemeScope`, above the
 * screen, and needs one around it. It is one region rather than one per
 * message, so mount it once, near the root, inside the `SafeAreaProvider`
 * whose insets it keeps clear of.
 *
 * `style`, `ref` and `testID` land on that region, a view along the bottom of
 * the screen that holds the message.
 */
function Snackbar({
  closeLabel = 'Close',
  queue,
  style,
  ...props
}: SnackbarProps) {
  const theme = useTheme()
  const insets = use(SafeAreaInsetsContext) ?? NO_INSETS
  const wide = useWindowSizeClass() !== 'compact'
  const shown = useSyncExternalStore(queue.subscribe, queue.visible)
  // The message up when the snackbar mounted, which was on screen before it
  // rather than arriving, so it is put in place rather than risen to it: on
  // a screen that remounts the snackbar, and on a story seeded with one.
  const [standing] = useState(() => queue.visible()?.key)
  const { spacing } = theme

  return (
    <Overlay>
      <View
        aria-live={Platform.OS === 'web' ? 'polite' : undefined}
        {...props}
        style={composeStyles<ViewStyle>(
          stylesOf(theme).region,
          {
            paddingBottom: spacing.sm + insets.bottom,
            paddingLeft: spacing.sm + insets.left,
            paddingRight: spacing.sm + insets.right,
          },
          style,
        )}
      >
        {shown === null ? null : (
          <SnackbarStrip
            arrives={shown.key !== standing}
            closeLabel={closeLabel}
            key={shown.key}
            queue={queue}
            shown={shown}
            wide={wide}
          />
        )}
      </View>
    </Overlay>
  )
}

/**
 * One of the snackbar's two controls, a pill drawing the state layer, the
 * ripple and the ring in its own colour, over a target brought up to 48dp
 * from the `height` it is drawn at. It reports when it takes and loses focus,
 * which pauses the message's timer.
 */
function SnackbarButton({
  'aria-label': ariaLabel,
  children,
  color,
  height,
  onFocusChange,
  onPress,
  ring,
  style,
}: {
  readonly 'aria-label'?: string
  readonly children: ReactNode
  readonly color: string
  readonly height: number
  readonly onFocusChange: (focused: boolean) => void
  readonly onPress: () => void
  readonly ring: ViewStyle
  readonly style: ViewStyle
}) {
  const theme = useTheme()
  const corners = stylesOf(theme).control
  const feedback = usePressFeedback({
    color,
    corners,
    onBlur: () => {
      onFocusChange(false)
    },
    onFocus: () => {
      onFocusChange(true)
    },
  })

  return (
    <Pressable
      {...feedback.handlers}
      aria-label={ariaLabel}
      hitSlop={hitSlop(height)}
      onPress={onPress}
      role="button"
      style={composeStyles<ViewStyle>(
        corners,
        style,
        feedback.ring === undefined ? undefined : ring,
      )}
    >
      {feedback.layer}
      {children}
    </Pressable>
  )
}

/** One message: the words, then whatever sits after them. */
function SnackbarStrip({
  arrives,
  closeLabel,
  queue,
  shown,
  wide,
}: {
  /** Whether the message rises into place, or is drawn there at once. */
  readonly arrives: boolean
  readonly closeLabel: string
  readonly queue: SnackbarQueue
  readonly shown: ShownMessage
  readonly wide: boolean
}) {
  const theme = useTheme()
  const themed = stylesOf(theme)
  const body = useTypeRole('bodyMedium')
  const label = useTypeRole('labelLarge')
  const reduceMotion = useReducedMotion()
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const { action, key, message, showCloseButton } = shown
  const { colors, motion, sizing } = theme

  // It rises its own height from the bottom edge as it fades in, which is
  // what the page draws and what says the message came from the edge of the
  // screen rather than appearing over it. Reduced motion puts it in its
  // settled place at once, as web's zeroed duration does.
  const rises = arrives && !reduceMotion
  const arrived = useSharedValue(rises ? 0 : 1)
  const height = useSharedValue(0)
  const rise = useAnimatedStyle(() => {
    'worklet'
    const progress = arrived.get()

    return {
      opacity: progress,
      transform: [{ translateY: (1 - progress) * height.get() }],
    }
  })

  useEffect(() => {
    if (rises) {
      arrived.set(
        withTiming(1, {
          duration: motion.durationMedium1,
          easing: Easing.bezier(...motion.easingEmphasizedDecelerate),
        }),
      )
    }
  }, [arrived, motion, rises])

  useEffect(() => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      AccessibilityInfo.announceForAccessibilityWithOptions(message, {
        queue: true,
      })
    }
  }, [message])

  const close = closeOf(queue, key)

  useExpiry(useShownFor(shown.timeout), focused || hovered, close)

  return (
    <Animated.View
      onLayout={measureInto(height)}
      onPointerEnter={flagOf(setHovered, true)}
      onPointerLeave={flagOf(setHovered, false)}
      style={composeStyles<AnimatedStyle<ViewStyle>>(
        themed.strip,
        wide ? styles.wide : undefined,
        rise,
      )}
    >
      <View style={themed.message}>
        <NativeText style={composeStyles<TextStyle>(body, themed.messageText)}>
          {message}
        </NativeText>
      </View>
      {action === undefined && !showCloseButton ? null : (
        <View style={styles.controls}>
          {action === undefined ? null : (
            <SnackbarButton
              color={colors.inversePrimary}
              height={sizing.controlSm}
              onFocusChange={setFocused}
              onPress={actionOf(action, close)}
              ring={themed.actionRing}
              style={themed.action}
            >
              <NativeText
                style={composeStyles<TextStyle>(label, themed.actionLabel)}
              >
                {action.label}
              </NativeText>
            </SnackbarButton>
          )}
          {showCloseButton ? (
            <SnackbarButton
              aria-label={closeLabel}
              color={colors.inverseOnSurface}
              height={sizing.controlMd}
              onFocusChange={setFocused}
              onPress={close}
              ring={themed.closeRing}
              style={themed.close}
            >
              <CloseGlyph color={colors.inverseOnSurface} size={24} />
            </SnackbarButton>
          ) : null}
        </View>
      )}
    </Animated.View>
  )
}

// Closes a message once it has been shown for `duration` milliseconds,
// counting only the time it was not paused. Nothing for a `duration` of 0,
// which is until closed, or of `null`, which is not yet known.
function useExpiry(
  duration: null | number,
  paused: boolean,
  expire: () => void,
) {
  const left = useRef<null | number>(null)

  useEffect(() => {
    if (duration === null || duration === 0 || paused) {
      return undefined
    }

    const remaining = left.current ?? duration
    const started = Date.now()
    const timer = setTimeout(expire, remaining)

    return () => {
      clearTimeout(timer)
      left.current = remaining - (Date.now() - started)
    }
  }, [duration, expire, paused])
}

// How long a message is shown: its `timeout`, which Android lengthens from
// the reader's "Time to take action" setting, as its own snackbar does, and
// is `null` until Android has answered. Nothing is asked for a message shown
// until closed.
function useShownFor(timeout: number): null | number {
  const [recommended, setRecommended] = useState<null | number>(null)
  const asks = Platform.OS === 'android' && timeout > 0

  useEffect(() => {
    if (!asks) {
      return undefined
    }

    let current = true

    async function ask() {
      const milliseconds =
        await AccessibilityInfo.getRecommendedTimeoutMillis(timeout)

      if (current) {
        setRecommended(milliseconds)
      }
    }

    void ask()

    return () => {
      current = false
    }
  }, [asks, timeout])

  return asks ? recommended : timeout
}

Snackbar.Queue = SnackbarQueue

// The queue is reached as `Snackbar.Queue` rather than exported beside the
// component, as on web: a module exporting something that is not a component
// is one fast refresh reloads whole.
export { Snackbar }
export type { SnackbarAction, SnackbarOptions, SnackbarProps, SnackbarQueue }
