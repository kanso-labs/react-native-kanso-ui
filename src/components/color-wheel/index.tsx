import type { ComponentRef, Ref } from 'react'
import type {
  AccessibilityActionEvent,
  StyleProp,
  ViewStyle,
} from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import type { Color } from 'react-stately'
import type { ColorWheelState } from 'react-stately/useColorWheelState'

import { I18nManager, StyleSheet, View } from 'react-native'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useColorWheelState } from 'react-stately/useColorWheelState'

import { ColorThumb } from '../../color-thumb'
import { HIDDEN } from '../../glyphs/hidden'
import { useLocaleOf } from '../../i18n/provider'
import { ADJUSTABLE } from '../../slider'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// kanso-ui's ColorWheel: hue as a ring, with ColorSlider's ringed handle on
// it. No Material Design page draws one, so what is here is web's, each
// choice for web's reason, drawn and pressed as the platform allows.
//
// **The band is the sliders page's 16dp track**, a hue slider's thickness,
// since a hue wheel and a hue slider are one control in two shapes. The
// thickness is a prop and the inner radius is not: it is the thickness in
// from `outerRadius`, so the two cannot disagree, and a band wider than the
// wheel leaves no hole rather than a negative one.
//
// **The ring is slices, and the middle is empty.** react-native-svg has no
// conic gradient, so the band is drawn as 360 slices, one per degree of hue,
// each the hue at its middle and a little wider than its degree, so no seam
// shows between neighbours. React Aria's gradient runs straight between its
// stops, which is what hue at full saturation does, so the slices draw it to
// within half a degree. Nothing is drawn inside the band, so whatever the
// wheel sits over shows through, and a ColorArea or a swatch can sit in it.
//
// **Hue runs as React Aria's does**: 0° at three o'clock, rising clockwise,
// and the same right to left, since a ring has no reading direction.
//
// **A press counts across the 48dp target.** The 16dp band is narrower than
// the target Material Design asks a touch to have, so a press or a drag that
// begins within 24dp of the band's middle, or anywhere on a wider band, moves
// the handle there, and one beginning in the hole or a corner moves nothing.
// Once begun, a drag follows the angle wherever it goes, as web's does.
//
// **A screen reader adjusts the handle**, named "Hue", or by `aria-label` in
// its place, as React Aria names it, and hears the hue and its name, "200°,
// cyan blue", in the provider's locale. It steps by a degree, past 360 back
// to 0. `onChangeEnd` comes once as a drag, a press or a step ends.
// Disabled, the wheel fades and takes nothing.

type ColorWheelProps = {
  /** What a screen reader calls the wheel, in place of "Hue". */
  readonly 'aria-label'?: string
  /**
   * The colour the wheel starts at, when it keeps its own: a CSS colour
   * string in any notation, or a `Color` from `parseColor`. Red when neither
   * this nor `value` is given.
   */
  readonly defaultValue?: Color | string
  /**
   * Draws the wheel disabled, and takes no presses, drags or screen reader
   * actions.
   * @default false
   */
  readonly isDisabled?: boolean
  /** Called with the colour as its hue moves. */
  readonly onChange?: (value: Color) => void
  /** Called with the colour once a drag, a press or an action has ended. */
  readonly onChangeEnd?: (value: Color) => void
  /**
   * How far the ring reaches from the centre, in dp. The wheel is twice this
   * across.
   * @default 100
   */
  readonly outerRadius?: number
  readonly ref?: Ref<ComponentRef<typeof View>>
  /** Lands on the wheel. Its size comes from `outerRadius`. */
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
  /**
   * How wide the band is, in dp. The inner radius is this in from
   * `outerRadius`, so the two cannot disagree.
   * @default 16
   */
  readonly thickness?: number
  /** The colour, for a call site holding it itself with `onChange`. */
  readonly value?: Color | string
}

const DEFAULT_OUTER_RADIUS = 100
// The sliders page's track, which is what a hue slider draws.
const DEFAULT_THICKNESS = 16

// How far a press moves before it is a drag rather than a tap: Gesture
// Handler's own default distance for a pan, as Slider's.
const SLOP = 10

// The target a press counts across, and the frame a screen reader outlines
// the handle in: the sliders page's 48dp, centred on the band's middle.
const TARGET = 48

// How far past its degree each slice reaches, which covers the hairline a
// renderer can leave between two shapes that only meet.
const OVERLAP = 0.5

// One slice per degree of hue.
const HUES = Array.from({ length: 360 }, (_, hue) => hue)

const styles = StyleSheet.create({
  root: {
    boxSizing: 'border-box',
  },
  // Where the handle sits: the frame centred on the band, with the handle
  // centred in it.
  seat: {
    alignItems: 'center',
    height: TARGET,
    justifyContent: 'center',
    marginStart: -TARGET / 2,
    marginTop: -TARGET / 2,
    position: 'absolute',
    width: TARGET,
  },
  // The handle, taking none of the frame's presses.
  thumb: {
    pointerEvents: 'none',
  },
})

const stylesOf = themedStyles(({ stateLayerOpacity }) =>
  StyleSheet.create({
    disabled: {
      opacity: stateLayerOpacity.disabledContent,
    },
  }),
)

// Runs the step a screen reader asks for, as a move that starts and ends at
// once, so `onChangeEnd` comes once as it does for a key on web.
function adjustOf(state: ColorWheelState, isDisabled: boolean) {
  return (event: AccessibilityActionEvent) => {
    const { actionName } = event.nativeEvent
    if (
      isDisabled ||
      (actionName !== 'increment' && actionName !== 'decrement')
    ) {
      return
    }
    state.setDragging(true)
    if (actionName === 'increment') {
      state.increment(state.step)
    } else {
      state.decrement(state.step)
    }
    state.setDragging(false)
  }
}

/**
 * Hue as a ring, with a handle on it. Its state is React Stately's, as web's
 * is: pass `value` with `onChange` to control it, or `defaultValue`, as a
 * CSS colour string or a `Color` from `parseColor`, which this package
 * re-exports.
 *
 * ```tsx
 * <ColorWheel defaultValue="hsl(200, 100%, 50%)" />
 * ```
 *
 * A wheel moves hue and nothing else, so unlike `ColorSlider` and
 * `ColorArea` it names no channel and there is no space for one to be
 * missing from: a hex value works here.
 *
 * The middle is empty rather than filled, so a `ColorArea` or a
 * `ColorSwatch` can sit inside one. A press on the ring moves the handle
 * there, and a drag carries it round. A screen reader hears "Hue", or
 * `aria-label`, with the value. `style`, `ref` and `testID` land on the
 * wheel, whose size comes from `outerRadius`. With a `testID`, the drag and
 * the press are registered with Gesture Handler as `<testID>-pan` and
 * `<testID>-tap`, which its `getByGestureTestId` finds in a test.
 */
function ColorWheel({
  'aria-label': ariaLabel,
  defaultValue,
  isDisabled = false,
  onChange,
  onChangeEnd,
  outerRadius = DEFAULT_OUTER_RADIUS,
  ref,
  style,
  testID,
  thickness = DEFAULT_THICKNESS,
  value,
}: ColorWheelProps) {
  const own = stylesOf(useTheme())
  const locale = useLocaleOf(undefined)
  const state = useColorWheelState({
    defaultValue,
    isDisabled,
    onChange,
    onChangeEnd,
    value,
  })
  const innerRadius = Math.max(0, outerRadius - thickness)
  // The middle of the band, which is where the handle rides.
  const thumbRadius = (innerRadius + outerRadius) / 2
  const gesture = useWheelGesture({
    isDisabled,
    outerRadius,
    reach: Math.max(outerRadius - innerRadius, TARGET) / 2,
    state,
    testID,
    thumbRadius,
  })
  const { x, y } = state.getThumbPosition(thumbRadius)
  const color = state.value
  const { maxValue, minValue } = color.getChannelRange('hue')

  return (
    <View
      ref={ref}
      style={composeStyles<ViewStyle>(
        styles.root,
        { height: outerRadius * 2, width: outerRadius * 2 },
        isDisabled ? own.disabled : undefined,
        style,
      )}
      testID={testID}
    >
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <GestureDetector gesture={gesture}>
          <View style={StyleSheet.absoluteFill}>
            <Ring innerRadius={innerRadius} outerRadius={outerRadius} />
            <View
              accessibilityActions={ADJUSTABLE}
              accessible
              aria-disabled={isDisabled}
              aria-label={ariaLabel ?? color.getChannelName('hue', locale)}
              aria-valuemax={maxValue}
              aria-valuemin={minValue}
              aria-valuenow={state.hue}
              aria-valuetext={`${color.formatChannelValue('hue', locale)}, ${color.getHueName(locale)}`}
              onAccessibilityAction={adjustOf(state, isDisabled)}
              role="slider"
              style={composeStyles<ViewStyle>(styles.seat, {
                // `start` turns over right to left, so the handle is put
                // back where its hue is.
                start: outerRadius + (I18nManager.isRTL ? -x : x),
                top: outerRadius + y,
              })}
            >
              <View style={styles.thumb}>
                <ColorThumb
                  color={state.getDisplayColor()}
                  dragging={state.isDragging}
                />
              </View>
            </View>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </View>
  )
}

// A point `radius` from the wheel's centre at `degrees` of hue, as React
// Aria places hue: 0° at three o'clock, rising clockwise.
function pointOf(outerRadius: number, radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180
  const across = outerRadius + radius * Math.cos(radians)
  const down = outerRadius + radius * Math.sin(radians)
  return `${across.toFixed(3)} ${down.toFixed(3)}`
}

// The band, one slice of it per degree of hue.
function Ring({
  innerRadius,
  outerRadius,
}: {
  readonly innerRadius: number
  readonly outerRadius: number
}) {
  return (
    <Svg
      {...HIDDEN}
      height={outerRadius * 2}
      style={StyleSheet.absoluteFill}
      width={outerRadius * 2}
    >
      {HUES.map((hue) => (
        <Path
          d={sliceOf(hue, innerRadius, outerRadius)}
          fill={`hsl(${hue}, 100%, 50%)`}
          key={hue}
        />
      ))}
    </Svg>
  )
}

// The band's slice for one degree of hue, centred on it: out along the outer
// edge clockwise, in, and back along the inner edge.
function sliceOf(hue: number, innerRadius: number, outerRadius: number) {
  const from = hue - 1 / 2
  const to = hue + 1 / 2 + OVERLAP
  return [
    `M ${pointOf(outerRadius, outerRadius, from)}`,
    `A ${outerRadius} ${outerRadius} 0 0 1 ${pointOf(outerRadius, outerRadius, to)}`,
    `L ${pointOf(outerRadius, innerRadius, to)}`,
    `A ${innerRadius} ${innerRadius} 0 0 0 ${pointOf(outerRadius, innerRadius, from)}`,
    'Z',
  ].join(' ')
}

/**
 * The wheel's pan and tap. Each reads a press against the wheel's centre and
 * sets the hue from its angle, and counts only a press that begins within
 * `reach` of the band's middle. The pan holds the wheel as dragged until it
 * lets go, which lifts the handle and is what `onChangeEnd` waits for; the
 * tap moves it and lets it go at once.
 *
 * Both run on the JavaScript thread, since every move sets React state.
 */
function useWheelGesture({
  isDisabled,
  outerRadius,
  reach,
  state,
  testID,
  thumbRadius,
}: {
  readonly isDisabled: boolean
  readonly outerRadius: number
  readonly reach: number
  readonly state: ColorWheelState
  readonly testID: string | undefined
  readonly thumbRadius: number
}) {
  // Whether the pan began on the ring. A shared value rather than a ref: the
  // gesture's callbacks are built while rendering, and the React Compiler
  // lets no ref reach them.
  const held: SharedValue<boolean> = useSharedValue(false)

  function reaches(x: number, y: number) {
    const distance = Math.hypot(x - outerRadius, y - outerRadius)
    return Math.abs(distance - thumbRadius) <= reach
  }

  // Sets the hue from a press's angle. The very centre has none, and moves
  // nothing.
  function setFrom(x: number, y: number) {
    const across = x - outerRadius
    const down = y - outerRadius
    const distance = Math.hypot(across, down)
    if (distance > 0) {
      state.setHueFromPoint(across, down, distance)
    }
  }

  // Gesture Handler 3 deprecates these builders for hooks that version 2 does
  // not have, and the peer range admits both, so the builders stay while it
  // does.
  // oxlint-disable-next-line react/capitalized-calls, typescript/no-deprecated -- a builder named after its gesture, not a component; see above
  const pan = Gesture.Pan()
    .minDistance(SLOP)
    .enabled(!isDisabled)
    .runOnJS(true)
    .onBegin(({ x, y }) => {
      held.set(reaches(x, y))
    })
    .onStart(({ x, y }) => {
      if (held.get()) {
        state.setDragging(true)
        setFrom(x, y)
      }
    })
    .onUpdate(({ x, y }) => {
      if (held.get()) {
        setFrom(x, y)
      }
    })
    // A pan the tap beat, or one begun off the ring, never started, and
    // letting go of a wheel nothing holds ends nothing, so this needs no
    // guard.
    .onFinalize(() => {
      state.setDragging(false)
    })
  // oxlint-disable-next-line react/capitalized-calls, typescript/no-deprecated -- as above
  const tap = Gesture.Tap()
    .maxDistance(SLOP)
    .enabled(!isDisabled)
    .runOnJS(true)
    .onEnd(({ x, y }, success) => {
      if (success && reaches(x, y)) {
        state.setDragging(true)
        setFrom(x, y)
        state.setDragging(false)
      }
    })

  // oxlint-disable-next-line react/capitalized-calls, typescript/no-deprecated -- as above
  return Gesture.Race(
    testID === undefined ? pan : pan.withTestId(`${testID}-pan`),
    testID === undefined ? tap : tap.withTestId(`${testID}-tap`),
  )
}

export { ColorWheel }
export type { ColorWheelProps }
