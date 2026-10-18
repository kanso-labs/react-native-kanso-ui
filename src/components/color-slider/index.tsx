import type { ComponentRef, Ref } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { Color, ColorChannel, ColorSpace } from 'react-stately'
import type { ColorSliderState } from 'react-stately/useColorSliderState'

import { useId, useState } from 'react'
import { I18nManager, Text as NativeText, StyleSheet, View } from 'react-native'
import {
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { useColorSliderState } from 'react-stately/useColorSliderState'

import { Chequer } from '../../chequer'
import { ColorThumb } from '../../color-thumb'
import { HIDDEN } from '../../glyphs/hidden'
import { useLocaleOf } from '../../i18n/provider'
import {
  ADJUSTABLE,
  adjustOf,
  lengthTo,
  seatPlaceOf,
  seats,
  useTrackGesture,
} from '../../slider'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// kanso-ui's ColorSlider: the sliders page's track, carrying one channel of
// a colour instead of an active and an inactive part. The page's 16dp strip
// with its 8dp corner, centred in the 44dp a handle takes, and the same
// label-large label above it, with the value at the far end of its line in
// body-small in on surface variant, so it reads as a readout rather than a
// second label. The gradient along the strip is React Aria's, stop for stop:
// the channel's range through the colour, with the hue running through its
// six primaries and lightness through the colour at its middle, so what runs
// along the strip is the channel rather than anything chosen here.
//
// Three things depart from the page, each because a colour slider shows a
// value the page's slider does not have, and each as web departs.
//
// **The handle is a circle carrying the colour, not the page's 4dp bar.** It
// has to show the value it sits on, and 4dp of a colour is not a colour
// anyone can read. It is the ringed handle in src/color-thumb, centred in the
// page's 44dp.
//
// **There is no value indicator.** The page's label floats a number over the
// handle; here the readout beside the label already says it, and the handle
// itself shows the colour.
//
// **There is no stop at the inactive end**, since a channel has no inactive
// part for it to mark.
//
// The alpha channel is the one drawn over a chequer, for the reason
// src/chequer gives: a track fading to transparent over a light surface and
// one fading to white are the same pixels without it. React Stately's display
// colour is opaque on every other channel, so no other track shows one.
//
// Disabled, the strip and the handle fade and the label and the readout keep
// their colour, since a disabled control still has to be readable.
//
// **The state is React Stately's `useColorSliderState`**, the one web's React
// Aria keeps, and presses and drags work as they do on `Slider`, through the
// same gesture in src/slider. The handle is an adjustable control to a screen
// reader, named by the label, else `aria-label`, else the channel's name in
// the provider's locale, as React Aria names it. Its value is the readout's
// words with the hue's name after them on a hue track and the colour's name
// on any other but alpha, "200°, cyan blue", as React Aria announces it.
//
// Vertical, the strip stands up 16dp across and the channel rises from the
// bottom, 240dp tall until `style` says otherwise. Under a right-to-left
// layout a horizontal channel runs from the right, as presses are read.

type ColorSliderProps = {
  /**
   * The slider's name for a screen reader, when no `label` is drawn. Left
   * out with the label too, the slider is named by its channel.
   */
  readonly 'aria-label'?: string
  /** Which channel of the colour the slider moves. */
  readonly channel: ColorChannel
  /**
   * The space the channel is read in, when the value is given in another: a
   * hex or `rgb()` value has no hue until it is read as `hsl` or `hsb`.
   */
  readonly colorSpace?: ColorSpace
  /**
   * The colour the slider starts at, when it keeps its own: a CSS colour
   * string, or a `Color` from `parseColor`.
   */
  readonly defaultValue?: Color | string
  /**
   * Draws the slider disabled, and takes no presses, drags or screen reader
   * actions.
   * @default false
   */
  readonly isDisabled?: boolean
  /** What the slider is for, drawn above the track. */
  readonly label?: string
  /** Called with the colour as the channel moves. */
  readonly onChange?: (value: Color) => void
  /** Called with the colour once a drag, a press or an action has ended. */
  readonly onChangeEnd?: (value: Color) => void
  /**
   * Along which axis the handle moves. A vertical slider is 240dp tall until
   * `style` says otherwise.
   * @default 'horizontal'
   */
  readonly orientation?: 'horizontal' | 'vertical'
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * Whether the channel's value is shown at the end of the label's line.
   * @default true
   */
  readonly showValue?: boolean
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
  /** The colour, for a call site holding it itself with `onChange`. */
  readonly value?: Color | string
}

// The page's strip, and the room above and below it that makes up the 44dp
// a press lands in.
const STRIP = 16
const TARGET = 44
const MARGIN = (TARGET - STRIP) / 2

/** A vertical slider's height when the call site gives it none. */
const VERTICAL_HEIGHT = 240

// The hues React Aria runs a hue track through.
const HUES = [0, 60, 120, 180, 240, 300, 360]

const styles = StyleSheet.create({
  // What a press is read along: the whole of the 44dp.
  area: {
    flexGrow: 1,
  },
  // The readout, at the far end of the label's line.
  output: {
    marginStart: 'auto',
  },
  // A slider fills the width it is given, as web's does.
  root: {
    width: '100%',
  },
  rootVertical: {
    alignItems: 'flex-start',
    height: VERTICAL_HEIGHT,
  },
  row: {
    alignItems: 'baseline',
    flexDirection: 'row',
  },
  // The strip, across the middle of the 44dp. It clips the gradient and the
  // chequer to its corners.
  strip: {
    end: 0,
    height: STRIP,
    overflow: 'hidden',
    position: 'absolute',
    start: 0,
    top: MARGIN,
  },
  stripVertical: {
    bottom: 0,
    overflow: 'hidden',
    position: 'absolute',
    start: MARGIN,
    top: 0,
    width: STRIP,
  },
  track: {
    height: TARGET,
  },
  trackVertical: {
    flexGrow: 1,
    minHeight: 0,
    width: TARGET,
  },
})

const stylesOf = themedStyles(({ colors, radii, spacing, stateLayerOpacity }) =>
  StyleSheet.create({
    disabled: {
      opacity: stateLayerOpacity.disabledContent,
    },
    label: {
      color: colors.onSurfaceVariant,
    },
    output: {
      color: colors.onSurfaceVariant,
    },
    root: {
      gap: spacing.xs,
    },
    row: {
      gap: spacing.sm,
    },
    strip: {
      borderRadius: radii.sm,
    },
  }),
)

/**
 * A slider over one channel of a colour: hue, saturation, lightness, alpha
 * and the rest. Its state is React Stately's, as web's is: pass `value` with
 * `onChange` to control it, or `defaultValue`, as a CSS colour string or a
 * `Color` from `parseColor`, which this package re-exports. One of the two is
 * required.
 *
 * ```tsx
 * <ColorSlider channel="hue" defaultValue="hsl(200, 100%, 50%)" label="Label" />
 * ```
 *
 * **`channel` has to name a channel the value's own space has.** A hex or
 * `rgb()` value is read as RGB, which has no hue, so `channel="hue"` against
 * one throws rather than converting. Pass `colorSpace="hsl"` to convert it,
 * or give the value in the space you mean to slide.
 *
 * A press on the track moves the handle there, and a drag carries it. A
 * screen reader hears an adjustable control named by the label, with the
 * channel's value and the colour's name. `style`, `ref` and `testID` land on
 * the slider as a whole, which is the view a layout positions. With a
 * `testID`, the drag and the press are registered with Gesture Handler as
 * `<testID>-pan` and `<testID>-tap`, which its `getByGestureTestId` finds in
 * a test.
 */
function ColorSlider({
  'aria-label': ariaLabel,
  channel,
  colorSpace,
  defaultValue,
  isDisabled = false,
  label,
  onChange,
  onChangeEnd,
  orientation = 'horizontal',
  ref,
  showValue = true,
  style,
  testID,
  value,
}: ColorSliderProps) {
  const own = stylesOf(useTheme())
  const locale = useLocaleOf(undefined)
  const state = useColorSliderState({
    channel,
    colorSpace,
    defaultValue,
    isDisabled,
    locale,
    onChange,
    onChangeEnd,
    orientation,
    value,
  })
  const labelRole = useTypeRole('labelLarge')
  const outputRole = useTypeRole('bodySmall')
  const [length, setLength] = useState(0)
  const vertical = orientation === 'vertical'
  const gesture = useTrackGesture({
    isDisabled,
    length,
    state,
    testID,
    vertical,
  })
  const display = state.getDisplayColor()

  return (
    <View
      ref={ref}
      style={composeStyles<ViewStyle>(
        styles.root,
        vertical ? styles.rootVertical : undefined,
        own.root,
        style,
      )}
      testID={testID}
    >
      {label === undefined && !showValue ? null : (
        <View aria-hidden style={composeStyles<ViewStyle>(styles.row, own.row)}>
          {label === undefined ? null : (
            <NativeText style={composeStyles<TextStyle>(labelRole, own.label)}>
              {label}
            </NativeText>
          )}
          {showValue ? (
            <NativeText
              style={composeStyles<TextStyle>(
                outputRole,
                own.output,
                styles.output,
              )}
            >
              {state.getThumbValueLabel(0)}
            </NativeText>
          ) : null}
        </View>
      )}
      <GestureHandlerRootView
        style={vertical ? styles.trackVertical : styles.track}
      >
        <GestureDetector gesture={gesture}>
          <View
            onLayout={lengthTo(setLength, vertical)}
            style={composeStyles<ViewStyle>(
              styles.area,
              isDisabled ? own.disabled : undefined,
            )}
          >
            <View
              style={composeStyles<ViewStyle>(
                vertical ? styles.stripVertical : styles.strip,
                own.strip,
              )}
            >
              {channel === 'alpha' ? <Chequer /> : null}
              <Gradient stops={stopsOf(state, channel)} vertical={vertical} />
            </View>
            <View
              accessibilityActions={ADJUSTABLE}
              accessible
              aria-disabled={isDisabled}
              aria-label={
                label ??
                ariaLabel ??
                state.value.getChannelName(channel, locale)
              }
              aria-valuemax={state.getThumbMaxValue(0)}
              aria-valuemin={state.getThumbMinValue(0)}
              aria-valuenow={state.getThumbValue(0)}
              aria-valuetext={valueTextOf(state, channel, locale)}
              onAccessibilityAction={adjustOf(state, 0)}
              role="slider"
              style={composeStyles<ViewStyle>(
                vertical ? seats.seatVertical : seats.seat,
                seatPlaceOf(state.getThumbPercent(0), vertical),
              )}
            >
              <ColorThumb color={display} dragging={state.isDragging} />
            </View>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </View>
  )
}

// The channel along the strip: the stops, evenly spaced, from the strip's
// start, or from its bottom standing up. Each is drawn opaque at its own
// opacity, since a gradient's stops take the two apart.
function Gradient({
  stops,
  vertical,
}: {
  readonly stops: readonly Color[]
  readonly vertical: boolean
}) {
  // A gradient is found by its id, which has to be unique in the page under
  // React Native Web, as the chequer's pattern is.
  const id = `channel${useId()}`
  const reversed = !vertical && I18nManager.isRTL

  return (
    <Svg {...HIDDEN} height="100%" style={StyleSheet.absoluteFill} width="100%">
      <Defs>
        <LinearGradient
          id={id}
          x1={reversed ? 1 : 0}
          x2={vertical || reversed ? 0 : 1}
          y1={vertical ? 1 : 0}
          y2={0}
        >
          {stops.map((stop, index) => (
            <Stop
              // oxlint-disable-next-line react/no-array-index-key -- a stop's place is its identity
              key={index}
              offset={index / (stops.length - 1)}
              stopColor={stop
                .toFormat('rgb')
                .withChannelValue('alpha', 1)
                .toString('css')}
              stopOpacity={stop.getChannelValue('alpha')}
            />
          ))}
        </LinearGradient>
      </Defs>
      <Rect fill={`url(#${id})`} height="100%" width="100%" />
    </Svg>
  )
}

// React Aria's stops for a channel, from its useColorSlider: the hue through
// its six primaries, lightness from its least through the colour at its
// middle to its most, which is what keeps the hue showing at all, and every
// other channel from its least to its most.
function stopsOf(state: ColorSliderState, channel: ColorChannel): Color[] {
  const display = state.getDisplayColor()
  const min = state.getThumbMinValue(0)
  const max = state.getThumbMaxValue(0)

  if (channel === 'hue') {
    return HUES.map((hue) => display.withChannelValue('hue', hue))
  }
  if (channel === 'lightness') {
    return [min, (max - min) / 2, max].map((each) =>
      display.withChannelValue(channel, each),
    )
  }
  return [min, max].map((each) => display.withChannelValue(channel, each))
}

// What a screen reader hears the handle say, as React Aria writes it: the
// readout's words, then the hue's name on a hue track and the colour's on any
// other but alpha, whose readout is already all there is to say.
function valueTextOf(
  state: ColorSliderState,
  channel: ColorChannel,
  locale: string,
) {
  const words = state.getThumbValueLabel(0)
  const display = state.getDisplayColor()

  if (channel === 'hue') {
    return `${words}, ${display.getHueName(locale)}`
  }
  if (channel === 'alpha') {
    return words
  }
  return `${words}, ${display.getColorName(locale)}`
}

export { ColorSlider }
export type { ColorSliderProps }
