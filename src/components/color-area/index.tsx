import type { ComponentRef, Ref } from 'react'
import type {
  AccessibilityActionEvent,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
} from 'react-native'
import type { Color, ColorChannel, ColorSpace } from 'react-stately'
import type { ColorAreaState } from 'react-stately/useColorAreaState'

import { useId, useState } from 'react'
import { I18nManager, StyleSheet, View } from 'react-native'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Svg, { Defs, LinearGradient, Mask, Rect, Stop } from 'react-native-svg'
import { parseColor } from 'react-stately'
import { useColorAreaState } from 'react-stately/useColorAreaState'

import { ColorThumb } from '../../color-thumb'
import { HIDDEN } from '../../glyphs/hidden'
import { useLocaleOf } from '../../i18n/provider'
import { ADJUSTABLE, percentOf } from '../../slider'
import { usePickedColor } from '../../swatch'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// kanso-ui's ColorArea: two channels of a colour as a plane, one along each
// axis, with ColorSlider's ringed handle where they meet. No Material Design
// page draws one, so what is here is web's own, each choice for web's reason.
//
// **It is square, and takes the width it is given.** A plane has no natural
// size, and one that was not square would give its two channels unequal
// travel, so the same drag would move one further than the other. `style`
// sets its width, and its height follows.
//
// **Its corner is the small one, and it carries no chequer.** The plane is
// opaque across the whole of it, so nothing behind it is ever seen, which is
// why web took its chequer out.
//
// **The plane is React Aria's, layer for layer**, from its
// useColorAreaGradient, in react-native-svg rather than CSS:
//
// - In HSL and HSB it is a gradient along each axis laid one over the other,
//   over a solid hue when hue is the channel neither axis carries. A CSS
//   gradient into `transparent` fades the colour itself out, and an SVG one
//   fades towards whatever colour the transparent stop names, so each fade
//   here keeps its colour and drops its opacity, and lightness's black,
//   transparent and white is two fades meeting at the middle.
// - In RGB React Aria screens one gradient per channel over a solid third,
//   which blends as no SVG paint does. The plane those layers make is the
//   colour with each axis's channel running from its least to its most, which
//   moves along each axis alone, so it is drawn as the row along its bottom
//   with the row along its top over it, faded in from the bottom.
//
// **A channel missing from the value's space throws, and alpha is a channel
// here only in RGB, as on web.** A hex or `rgb()` value is read as RGB, which
// has no saturation, so `xChannel="saturation"` against one throws rather
// than converting; `colorSpace` converts it. Asked for alpha in HSL or HSB,
// React Aria draws the two channels alpha is not instead and says nothing,
// and so does this. In RGB the handle moves alpha, and the plane still does
// not thin, since React Aria's layers are opaque.
//
// **A screen reader adjusts each channel apart.** React Aria gives the plane
// a hidden range input per channel, and an element here adjusts in one
// direction only, so the handle holds two adjustable halves, the start one
// for the horizontal channel and the end one for the vertical, each named by
// its channel, after `aria-label` when there is one. Each says its channel's
// value and the colour's name, "100%, light vibrant cyan blue", in the
// provider's locale. A press on the plane moves the handle there and a drag
// carries it, setting both channels together, and `onChangeEnd` comes once
// as it lets go. Disabled, the plane and the handle fade and take nothing.
//
// Under a right-to-left layout the horizontal channel runs from the right,
// as presses are read.

type ColorAreaProps = {
  /**
   * What the plane is for, which a screen reader hears before each channel's
   * name.
   */
  readonly 'aria-label'?: string
  /**
   * The space the channels are read in, when the value is given in another:
   * a hex or `rgb()` value has no saturation until it is read as `hsl` or
   * `hsb`.
   */
  readonly colorSpace?: ColorSpace
  /**
   * The colour the plane starts at, when it keeps its own: a CSS colour
   * string, or a `Color` from `parseColor`. White when neither this nor
   * `value` is given.
   */
  readonly defaultValue?: Color | string
  /**
   * Draws the plane disabled, and takes no presses, drags or screen reader
   * actions.
   * @default false
   */
  readonly isDisabled?: boolean
  /** Called with the colour as either channel moves. */
  readonly onChange?: (value: Color) => void
  /** Called with the colour once a drag, a press or an action has ended. */
  readonly onChangeEnd?: (value: Color) => void
  readonly ref?: Ref<ComponentRef<typeof View>>
  /** Lands on the square, and sets its width; its height follows. */
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
  /** The colour, for a call site holding it itself with `onChange`. */
  readonly value?: Color | string
  /**
   * The channel along the horizontal axis. The first of the space's
   * channels the vertical one is not, when left out.
   */
  readonly xChannel?: ColorChannel
  /**
   * The channel up the vertical axis. The first of the space's channels the
   * horizontal one is not, when left out.
   */
  readonly yChannel?: ColorChannel
}

type Fade = {
  readonly color: string
  readonly offset: number
  readonly opacity: number
}

// A layer of the plane, bottom first: a fill, or a gradient along one axis,
// which a rising one shows only as far up the plane as it has faded in.
type Layer =
  | {
      readonly axis: 'x' | 'y'
      readonly rising?: boolean
      readonly stops: readonly Fade[]
    }
  | { readonly color: string }

// How far a press moves before it is a drag rather than a tap: Gesture
// Handler's own default distance for a pan, as Slider's.
const SLOP = 10

// The frame a screen reader outlines the handle in, the sliders page's 48dp
// target, centred on the handle.
const TARGET = 48

// The hues React Aria runs a hue axis through.
const HUES = [0, 60, 120, 180, 240, 300, 360]

const BLACK = 'rgb(0, 0, 0)'
const WHITE = 'rgb(255, 255, 255)'

const styles = StyleSheet.create({
  // One adjustable half of the handle's frame.
  half: {
    flexGrow: 1,
  },
  root: {
    aspectRatio: 1,
    boxSizing: 'border-box',
    width: '100%',
  },
  // Where the handle sits: the frame centred on the value, with the handle
  // centred in it and the two halves side by side across it.
  seat: {
    alignItems: 'center',
    flexDirection: 'row',
    height: TARGET,
    justifyContent: 'center',
    marginStart: -TARGET / 2,
    marginTop: -TARGET / 2,
    position: 'absolute',
    width: TARGET,
  },
  // The handle, over both halves and taking none of their presses.
  thumb: {
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    ...StyleSheet.absoluteFill,
  },
})

const stylesOf = themedStyles(({ radii, stateLayerOpacity }) =>
  StyleSheet.create({
    disabled: {
      opacity: stateLayerOpacity.disabledContent,
    },
    // The plane, clipped to the corner while the handle is free to sit over
    // its edge.
    plane: {
      borderRadius: radii.sm,
      overflow: 'hidden',
      ...StyleSheet.absoluteFill,
    },
  }),
)

// Runs the step a screen reader asks a channel for, as a move that starts
// and ends at once, so `onChangeEnd` comes once as it does for a key on web.
function adjustOf(state: ColorAreaState, axis: 'x' | 'y', isDisabled: boolean) {
  return (event: AccessibilityActionEvent) => {
    const { actionName } = event.nativeEvent
    if (
      isDisabled ||
      (actionName !== 'increment' && actionName !== 'decrement')
    ) {
      return
    }
    const up = actionName === 'increment'
    state.setDragging(true)
    if (axis === 'x') {
      if (up) {
        state.incrementX(state.xChannelStep)
      } else {
        state.decrementX(state.xChannelStep)
      }
    } else if (up) {
      state.incrementY(state.yChannelStep)
    } else {
      state.decrementY(state.yChannelStep)
    }
    state.setDragging(false)
  }
}

/**
 * Two channels of a colour as a plane, with a handle where they meet. Its
 * state is React Stately's, as web's is: pass `value` with `onChange` to
 * control it, or `defaultValue`, as a CSS colour string or a `Color` from
 * `parseColor`, which this package re-exports.
 *
 * ```tsx
 * <ColorArea
 *   defaultValue="hsl(200, 100%, 50%)"
 *   xChannel="saturation"
 *   yChannel="lightness"
 * />
 * ```
 *
 * **`xChannel` and `yChannel` have to name channels the value's own space
 * has.** A hex or `rgb()` value is read as RGB, which has no saturation, so
 * naming one against it throws rather than converting. Pass `colorSpace` to
 * convert it, or give the value in the space you mean to work in.
 *
 * **`alpha` is a channel here only in RGB.** Asked for it in HSL, the plane
 * quietly draws saturation and lightness instead, as React Aria's does.
 *
 * A press on the plane moves the handle there, and a drag carries it. A
 * screen reader adjusts each channel apart, through two halves of the
 * handle, each named by its channel. `style`, `ref` and `testID` land on the
 * square, whose width `style` sets. With a `testID`, the drag and the press
 * are registered with Gesture Handler as `<testID>-pan` and `<testID>-tap`,
 * which its `getByGestureTestId` finds in a test.
 *
 * Inside a `ColorPicker` it takes the picker's colour where it is given no
 * `value`, and reports a change to the picker before its own `onChange`.
 */
function ColorArea({
  'aria-label': ariaLabel,
  colorSpace,
  defaultValue,
  isDisabled = false,
  onChange,
  onChangeEnd,
  ref,
  style,
  testID,
  value,
  xChannel,
  yChannel,
}: ColorAreaProps) {
  const own = stylesOf(useTheme())
  const locale = useLocaleOf(undefined)
  const picked = usePickedColor(value, onChange)
  const state = useColorAreaState({
    colorSpace,
    defaultValue,
    isDisabled,
    onChange: picked.onChange,
    onChangeEnd,
    value: picked.value,
    xChannel,
    yChannel,
  })
  const [size, setSize] = useState({ height: 0, width: 0 })
  const gesture = usePlaneGesture({ isDisabled, size, state, testID })
  const { x, y } = state.getThumbPosition()
  const { channels } = state

  return (
    <View
      ref={ref}
      style={composeStyles<ViewStyle>(
        styles.root,
        isDisabled ? own.disabled : undefined,
        style,
      )}
      testID={testID}
    >
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <GestureDetector gesture={gesture}>
          <View onLayout={sizeTo(setSize)} style={StyleSheet.absoluteFill}>
            <View style={own.plane}>
              <Plane layers={layersOf(state)} />
            </View>
            <View
              style={composeStyles<ViewStyle>(styles.seat, {
                start: percentOf(x),
                top: percentOf(y),
              })}
            >
              <Half
                axis="x"
                channel={channels.xChannel}
                isDisabled={isDisabled}
                label={ariaLabel}
                locale={locale}
                state={state}
              />
              <Half
                axis="y"
                channel={channels.yChannel}
                isDisabled={isDisabled}
                label={ariaLabel}
                locale={locale}
                state={state}
              />
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

// A colour drawn as a stop: opaque, since a stop's opacity is its own.
function cssOf(color: Color) {
  return color.toFormat('rgb').withChannelValue('alpha', 1).toString('css')
}

// A colour fading out along an axis, keeping its colour as it goes.
function fadeOf(color: string): Fade[] {
  return [
    { color, offset: 0, opacity: 1 },
    { color, offset: 1, opacity: 0 },
  ]
}

// One channel's half of the handle's frame, which a screen reader adjusts.
function Half({
  axis,
  channel,
  isDisabled,
  label,
  locale,
  state,
}: {
  readonly axis: 'x' | 'y'
  readonly channel: ColorChannel
  readonly isDisabled: boolean
  readonly label: string | undefined
  readonly locale: string
  readonly state: ColorAreaState
}) {
  const color = state.value
  const name = color.getChannelName(channel, locale)
  const { maxValue, minValue } = color.getChannelRange(channel)

  return (
    <View
      accessibilityActions={ADJUSTABLE}
      accessible
      aria-disabled={isDisabled}
      aria-label={label === undefined ? name : `${label}, ${name}`}
      aria-valuemax={maxValue}
      aria-valuemin={minValue}
      aria-valuenow={color.getChannelValue(channel)}
      aria-valuetext={`${color.formatChannelValue(channel, locale)}, ${state
        .getDisplayColor()
        .getColorName(locale)}`}
      onAccessibilityAction={adjustOf(state, axis, isDisabled)}
      role="slider"
      style={styles.half}
    />
  )
}

// React Aria's layers for the plane, from its useColorAreaGradient, bottom
// first rather than CSS's top first.
function layersOf(state: ColorAreaState): Layer[] {
  const { xChannel, yChannel, zChannel } = state.channels
  const space = state.value.getColorSpace()
  const zValue = state.value.getChannelValue(zChannel)

  if (space === 'rgb') {
    // The colour with the third channel's value and each axis's channel at
    // either end, and opaque, as the screened layers come out.
    const corner = (
      xEnd: 'maxValue' | 'minValue',
      yEnd: 'maxValue' | 'minValue',
    ) =>
      cssOf(
        parseColor(BLACK)
          .withChannelValue(zChannel, zValue)
          .withChannelValue(
            xChannel,
            state.value.getChannelRange(xChannel)[xEnd],
          )
          .withChannelValue(
            yChannel,
            state.value.getChannelRange(yChannel)[yEnd],
          ),
      )
    return [
      {
        axis: 'x',
        stops: rowOf(
          corner('minValue', 'minValue'),
          corner('maxValue', 'minValue'),
        ),
      },
      {
        axis: 'x',
        rising: true,
        stops: rowOf(
          corner('minValue', 'maxValue'),
          corner('maxValue', 'maxValue'),
        ),
      },
    ]
  }

  const base = parseColor(
    space === 'hsl' ? 'hsl(0, 100%, 50%)' : 'hsb(0, 100%, 100%)',
  ).withChannelValue(zChannel, zValue)
  const layers: Layer[] = zChannel === 'hue' ? [{ color: cssOf(base) }] : []
  for (const channel of state.value.getColorChannels()) {
    if (channel !== zChannel) {
      layers.push({
        axis: channel === xChannel ? 'x' : 'y',
        stops: stopsOf(channel, base),
      })
    }
  }
  return layers
}

// The plane's layers, painted bottom first, each filling the square.
function Plane({ layers }: { readonly layers: readonly Layer[] }) {
  // A gradient is found by its id, which has to be unique in the page under
  // React Native Web, as the chequer's pattern is.
  const id = `plane${useId()}`
  const reversed = I18nManager.isRTL

  return (
    <Svg {...HIDDEN} height="100%" style={StyleSheet.absoluteFill} width="100%">
      <Defs>
        {layers.some((layer) => 'rising' in layer && layer.rising) ? (
          <>
            {/* How far up the plane a rising layer shows: none of it along the
            bottom and all of it along the top, as a mask's luminance. */}
            <LinearGradient id={`${id}-rise`} x1={0} x2={0} y1={1} y2={0}>
              <Stop offset={0} stopColor={BLACK} />
              <Stop offset={1} stopColor={WHITE} />
            </LinearGradient>
            <Mask id={`${id}-mask`}>
              <Rect fill={`url(#${id}-rise)`} height="100%" width="100%" />
            </Mask>
          </>
        ) : null}
        {layers.map((layer, index) =>
          'stops' in layer ? (
            <LinearGradient
              id={`${id}-${index}`}
              // oxlint-disable-next-line react/no-array-index-key -- a layer's place is its identity
              key={index}
              x1={layer.axis === 'x' && reversed ? 1 : 0}
              x2={layer.axis === 'y' || reversed ? 0 : 1}
              y1={layer.axis === 'y' ? 1 : 0}
              y2={0}
            >
              {layer.stops.map((stop) => (
                <Stop
                  key={`${stop.offset}${stop.color}`}
                  offset={stop.offset}
                  stopColor={stop.color}
                  stopOpacity={stop.opacity}
                />
              ))}
            </LinearGradient>
          ) : null,
        )}
      </Defs>
      {layers.map((layer, index) => (
        <Rect
          fill={'stops' in layer ? `url(#${id}-${index})` : layer.color}
          height="100%"
          // oxlint-disable-next-line react/no-array-index-key -- as above
          key={index}
          mask={
            'rising' in layer && layer.rising ? `url(#${id}-mask)` : undefined
          }
          width="100%"
        />
      ))}
    </Svg>
  )
}

function rowOf(start: string, end: string): Fade[] {
  return [
    { color: start, offset: 0, opacity: 1 },
    { color: end, offset: 1, opacity: 1 },
  ]
}

// Keeps the plane's size as it is laid out.
function sizeTo(set: (size: { height: number; width: number }) => void) {
  return ({ nativeEvent }: LayoutChangeEvent) => {
    set({ height: nativeEvent.layout.height, width: nativeEvent.layout.width })
  }
}

// A channel's gradient in HSL or HSB, as React Aria writes each.
function stopsOf(channel: ColorChannel, base: Color): Fade[] {
  if (channel === 'hue') {
    return HUES.map((hue, index) => ({
      color: cssOf(base.withChannelValue('hue', hue)),
      offset: index / (HUES.length - 1),
      opacity: 1,
    }))
  }
  if (channel === 'saturation') {
    return fadeOf(cssOf(base.withChannelValue('saturation', 0)))
  }
  if (channel === 'lightness') {
    // Black, transparent and white: two fades meeting at the middle.
    return [
      { color: BLACK, offset: 0, opacity: 1 },
      { color: BLACK, offset: 0.5, opacity: 0 },
      { color: WHITE, offset: 0.5, opacity: 0 },
      { color: WHITE, offset: 1, opacity: 1 },
    ]
  }
  // Brightness, the one channel left in HSB.
  return fadeOf(BLACK)
}

/**
 * The plane's pan and tap. Each reads a press's place as a fraction of the
 * way across the plane, from the start, and down it, and sets both channels
 * there. The pan holds the plane as dragged until it lets go, which is what
 * lifts the handle and what `onChangeEnd` waits for; the tap moves it and
 * lets it go at once.
 *
 * Both run on the JavaScript thread, since every move sets React state.
 */
function usePlaneGesture({
  isDisabled,
  size,
  state,
  testID,
}: {
  readonly isDisabled: boolean
  readonly size: { readonly height: number; readonly width: number }
  readonly state: ColorAreaState
  readonly testID: string | undefined
}) {
  // Sets both channels from a press, once the plane has a size to read it
  // against. A press past an edge reads past it, which React Stately clamps.
  function setFrom(x: number, y: number) {
    if (size.width <= 0 || size.height <= 0) {
      return
    }
    const across = x / size.width
    state.setColorFromPoint(
      I18nManager.isRTL ? 1 - across : across,
      y / size.height,
    )
  }

  // Gesture Handler 3 deprecates these builders for hooks that version 2 does
  // not have, and the peer range admits both, so the builders stay while it
  // does.
  // oxlint-disable-next-line react/capitalized-calls, typescript/no-deprecated -- a builder named after its gesture, not a component; see above
  const pan = Gesture.Pan()
    .minDistance(SLOP)
    .enabled(!isDisabled)
    .runOnJS(true)
    .onStart(({ x, y }) => {
      state.setDragging(true)
      setFrom(x, y)
    })
    .onUpdate(({ x, y }) => {
      setFrom(x, y)
    })
    // A pan the tap beat never started, and letting go of a plane nothing
    // holds ends nothing, so this needs no guard.
    .onFinalize(() => {
      state.setDragging(false)
    })
  // oxlint-disable-next-line react/capitalized-calls, typescript/no-deprecated -- as above
  const tap = Gesture.Tap()
    .maxDistance(SLOP)
    .enabled(!isDisabled)
    .runOnJS(true)
    .onEnd(({ x, y }, success) => {
      if (success) {
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

export { ColorArea }
export type { ColorAreaProps }
