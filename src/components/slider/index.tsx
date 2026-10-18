import type { ComponentRef, ReactNode, Ref } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { SliderState } from 'react-stately/useSliderState'

import { NumberFormatter } from '@internationalized/number'
import { useState } from 'react'
import { Text as NativeText, StyleSheet, View } from 'react-native'
import {
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated'
import { useSliderState } from 'react-stately/useSliderState'

import type { IconStyle } from '../../glyphs/icon-style'
import type { ResolvedTheme } from '../../theme/scope'

import { IconStyleContext } from '../../glyphs/icon-style'
import { useLocaleOf } from '../../i18n/provider'
import {
  ADJUSTABLE,
  adjustOf,
  lengthTo,
  percentOf,
  seatPlaceOf,
  seats,
  useTrackGesture,
} from '../../slider'
import { withOpacity } from '../../theme/color'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// kanso-ui's Slider: the sliders page. At the size its tokens call
// extra-small, the default, a 16dp track with an 8dp corner, the active part
// in primary and the inactive part in secondary container, a 4dp stop in on
// secondary container 6dp from the inactive end, and a handle 4dp wide and
// 44dp tall in primary that narrows to 2dp while it is dragged. The track's
// parts on each side of the handle stop 6dp short of it, and their corners
// against it are 2dp where their outer ends are full. Disabled, the active
// part and the handle are on surface at the disabled content opacity and the
// inactive part at the disabled container opacity.
//
// `size` takes the page's four larger sizes, which thicken the track and
// round its ends more, and lengthen the handle from M up:
//
// | Size | Track | Corner | Handle | Inset icon |
// | ---- | ----- | ------ | ------ | ---------- |
// | xs   | 16dp  | 8dp    | 44dp   |            |
// | sm   | 24dp  | 8dp    | 44dp   |            |
// | md   | 40dp  | 12dp   | 52dp   | 24dp       |
// | lg   | 56dp  | 16dp   | 68dp   | 24dp       |
// | xl   | 96dp  | 28dp   | 108dp  | 32dp       |
//
// The handle stays 4dp wide, the corners against it 2dp and the space beside
// it 6dp at every size.
//
// `showStops` is the page's stops configuration: a 4dp stop at every step,
// in on primary on the active part and on secondary container on the
// inactive one, so the reader can see where the handle can land. The stops at
// the two ends sit 6dp in from them, as the single stop does. A part clips
// what it holds, which is what hides the stops beside the handle: the part
// ends 6dp short of it.
//
// `icon` is the page's inset icon, at the start of the active part in on
// primary, from M up, 10dp in from the part's start, MDC-Android's padding,
// since the page gives none. Like MDC-Android it is drawn only while the part
// has room for it and that padding on both sides, which the track's measured
// length says, and only for a single handle.
//
// The value indicator is the page's label: inverse surface under label large
// in inverse on surface, 44dp tall and at least 48dp wide, 12dp above the
// handle, while the handle is dragged. It is hidden from a screen reader,
// which hears the same words as the handle's value.
//
// **The state is React Stately's `useSliderState`**, the one web's React Aria
// keeps, with a `NumberFormatter` in the provider's locale, so the steps, the
// handles of a range keeping their order and what each handle reads as
// behave as they do on web.
//
// **A press on the track moves the handle nearest it there.** Gesture
// Handler's pan takes a drag once it has moved 10dp along the track, and its
// tap a press that moved less, so a slider inside a scroll view still lets a
// drag across the track's axis scroll it. The pan follows the finger from
// where it took over, and `onChangeEnd` comes once, when it lets go. The
// parts and the handles follow the value from React's render, since every
// move changes the value and the words the indicator shows, and the handle's
// narrowing eases on Reanimated over the short2 duration on the standard
// curve, at once under reduced motion.
//
// **Each handle is an adjustable control to a screen reader**, named by its
// entry in `thumbLabels` and then the slider's label, as React Aria names a
// range's handles, with its value in the formatter's words and an increment
// and a decrement action that move it a step. The label drawn above the track
// is hidden from a screen reader, since every handle already says it.
//
// Vertical, the same parts run up the track, with the active part rising
// from the bottom and the indicator to the start side of the handle. The
// corners a part turns to the handle are its corners on the handle's side,
// the bottom ones on the part above it and the top ones on the part below.
//
// Under a right-to-left layout the track's start is its right end, as web's
// is: the parts are placed from their logical edges, and a press reads its
// place from the right.

/** One end of a part: a fraction of the track's length, and dp on top. */
type Inset = {
  readonly fraction: number
  readonly px: number
}

/** A size's measurements, from the page. */
type Metrics = {
  readonly corner: 'lg' | 'md' | 'sm' | 'xl'
  readonly handle: number
  /** The inset icon's size, at the sizes the page draws one. */
  readonly icon?: number
  readonly track: number
}

/**
 * A part of the track, by the insets of its two ends from the track's, and
 * which of the three it is: the inactive part before a range's first handle,
 * the active part, or the inactive part after the last handle.
 */
type Part = {
  readonly active: boolean
  readonly end: Inset
  readonly name: 'active' | 'after' | 'before'
  readonly start: Inset
}

type SliderProps = {
  /**
   * The slider's name for a screen reader, when no `label` is drawn: a
   * slider that a row labels some other way leaves `label` out and passes
   * this instead.
   */
  readonly 'aria-label'?: string
  /** The value the slider starts at, when it keeps its own. */
  readonly defaultValue?: number | number[]
  /**
   * How the value reads, in the indicator and to a screen reader, in the
   * provider's locale.
   */
  readonly formatOptions?: Intl.NumberFormatOptions
  /**
   * The page's inset icon, at the start of the active part, from `md` up:
   * the page gives it a size at M, L and XL alone. Drawn for a single
   * handle, and only while the active part has room for it. It reads its
   * colour and size through `useIconStyle()`.
   */
  readonly icon?: ReactNode
  /**
   * Draws the slider disabled, and takes no presses, drags or screen reader
   * actions.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * What the slider sets. A slider that a row labels some other way leaves
   * it out and passes `aria-label` instead.
   */
  readonly label?: string
  /**
   * The largest value.
   * @default 100
   */
  readonly maxValue?: number
  /**
   * The smallest value.
   * @default 0
   */
  readonly minValue?: number
  /** Called with the value as it moves. */
  readonly onChange?: (value: number | number[]) => void
  /** Called with the value once a drag, a press or an action has ended. */
  readonly onChangeEnd?: (value: number | number[]) => void
  /**
   * Along which axis the handle moves. A vertical slider is 240dp tall until
   * `style` says otherwise.
   * @default 'horizontal'
   */
  readonly orientation?: 'horizontal' | 'vertical'
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * A stop at every step, the page's stops configuration, so the reader can
   * see where the handle can land. Meant for a slider with a handful of
   * steps: each stop is a 4dp dot, and a fine step draws a crowd of them.
   * @default false
   */
  readonly showStops?: boolean
  /**
   * The page's sizes, by the track's thickness: 16dp at `xs`, 24dp at `sm`,
   * 40dp at `md`, 56dp at `lg` and 96dp at `xl`, with the handle 44dp long
   * up to `sm` and 52dp, 68dp and 108dp past it.
   * @default 'xs'
   */
  readonly size?: SliderSize
  /**
   * The distance between two values the handle can land on.
   * @default 1
   */
  readonly step?: number
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
  /**
   * A name for each handle of a range slider, in order, since two handles
   * named by the same label cannot be told apart.
   */
  readonly thumbLabels?: readonly string[]
  /**
   * The value, for a call site holding it itself with `onChange`: a number
   * for one handle, or an array of numbers for a handle each.
   */
  readonly value?: number | number[]
}

type SliderSize = 'lg' | 'md' | 'sm' | 'xl' | 'xs'

// The sliders page's own measurements, which are constants of the component
// rather than steps of the consumer's spacing scale, as on web.
const GAP = 6
const HANDLE_WIDTH = 4
/** The handle's width while it is dragged. */
const HANDLE_PRESSED = 2
/** How far a part stops short of a handle's centre. */
const CLEAR = GAP + HANDLE_WIDTH / 2
/** A stop's size. */
const STOP = 4
/** The corner a part turns to a handle. */
const INNER_CORNER = 2
/** MDC-Android's padding either side of the inset icon. */
const ICON_PADDING = 10
/** The value indicator's height and its narrowest width. */
const INDICATOR_HEIGHT = 44
const INDICATOR_MIN_WIDTH = 48
/** A vertical slider's height when the call site gives it none. */
const VERTICAL_HEIGHT = 240

const SIZES: Readonly<Record<SliderSize, Metrics>> = {
  lg: { corner: 'lg', handle: 68, icon: 24, track: 56 },
  md: { corner: 'md', handle: 52, icon: 24, track: 40 },
  sm: { corner: 'sm', handle: 44, track: 24 },
  xl: { corner: 'xl', handle: 108, icon: 32, track: 96 },
  xs: { corner: 'sm', handle: 44, track: 16 },
}

const AT_END: Inset = { fraction: 0, px: 0 }

// Hoisted so a slider without stops hands its parts one stable array, which
// is what react-perf's no-new-array-as-prop is after.
const NO_STEPS: readonly number[] = []

const styles = StyleSheet.create({
  // What a press is read along: the whole of the track's strip.
  area: {
    flexGrow: 1,
  },
  // The handle's value, centred on it across the track by its frame.
  indicator: {
    alignItems: 'center',
    height: INDICATOR_HEIGHT,
    justifyContent: 'center',
    minWidth: INDICATOR_MIN_WIDTH,
    position: 'absolute',
  },
  // Above the handle.
  indicatorHorizontal: {
    bottom: '100%',
  },
  // A vertical slider's value, to the start side of its handle.
  indicatorVertical: {
    end: '100%',
  },
  // The corners a part turns to a handle, which depend on the axis and on
  // which end of the part meets it.
  innerEnd: {
    borderBottomEndRadius: INNER_CORNER,
    borderTopEndRadius: INNER_CORNER,
  },
  // A vertical part's end is its top.
  innerEndVertical: {
    borderTopEndRadius: INNER_CORNER,
    borderTopStartRadius: INNER_CORNER,
  },
  innerStart: {
    borderBottomStartRadius: INNER_CORNER,
    borderTopStartRadius: INNER_CORNER,
  },
  // A vertical part's start is its bottom, where the value starts from.
  innerStartVertical: {
    borderBottomEndRadius: INNER_CORNER,
    borderBottomStartRadius: INNER_CORNER,
  },
  // One part of the track. It clips what it holds, which is what keeps a
  // stop beside the handle from showing.
  part: {
    overflow: 'hidden',
    position: 'absolute',
  },
  // A slider fills the width it is given, as web's does.
  root: {
    width: '100%',
  },
  // A vertical slider needs a height to run along; this is the one a call
  // site gets without asking, and `style` sets another.
  rootVertical: {
    alignItems: 'flex-start',
    height: VERTICAL_HEIGHT,
  }, // A stop: 4dp, centred across the strip.
  stop: {
    height: STOP,
    position: 'absolute',
    width: STOP,
  },
  // The stops at the track's two ends, the page's gap in from each.
  stopEnd: {
    end: GAP,
  },
  stopEndVertical: {
    top: GAP,
  },
  stopStart: {
    start: GAP,
  },
  stopStartVertical: {
    bottom: GAP,
  },
})

const stylesOf = themedStyles(
  ({ colors, radii, spacing, stateLayerOpacity }) => {
    const disabledContent = withOpacity(
      colors.onSurface,
      stateLayerOpacity.disabledContent,
    )

    return StyleSheet.create({
      active: {
        backgroundColor: colors.primary,
      },
      activeDisabled: {
        backgroundColor: disabledContent,
      },
      handle: {
        backgroundColor: colors.primary,
        borderRadius: radii.pill,
      },
      handleDisabled: {
        backgroundColor: disabledContent,
      },
      inactive: {
        backgroundColor: colors.secondaryContainer,
      },
      inactiveDisabled: {
        backgroundColor: withOpacity(
          colors.onSurface,
          stateLayerOpacity.disabledContainer,
        ),
      },
      // The value indicator's surface, its gap above the handle and the room
      // either side of its words.
      indicator: {
        backgroundColor: colors.inverseSurface,
        borderRadius: radii.pill,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.md,
      },
      indicatorText: {
        color: colors.inverseOnSurface,
        textAlign: 'center',
      },
      // To the start side, the same gap.
      indicatorVertical: {
        marginBottom: 0,
        marginEnd: spacing.md,
      },
      label: {
        color: colors.onSurfaceVariant,
      },
      root: {
        gap: spacing.xs,
      },
      stop: {
        backgroundColor: colors.onSecondaryContainer,
        borderRadius: radii.circle,
      },
      // A stop on the active part.
      stopActive: {
        backgroundColor: colors.onPrimary,
      },
      stopActiveDisabled: {
        backgroundColor: colors.inverseOnSurface,
      },
      stopDisabled: {
        backgroundColor: disabledContent,
      },
    })
  },
)

// A part's start inset, clear of a handle at `fraction` of the way along. The
// fraction lands on the handle's centre, so half the handle's width joins the
// page's gap to reach its edge.
function after(fraction: number): Inset {
  return { fraction, px: CLEAR }
}

// A part's end inset, clear of a handle at `fraction` of the way along.
function before(fraction: number): Inset {
  return { fraction: 1 - fraction, px: CLEAR }
}

// One handle: the frame a screen reader adjusts, the handle in it, and the
// value above it while it is dragged.
function Handle({
  index,
  metrics,
  name,
  state,
  vertical,
}: {
  readonly index: number
  readonly metrics: Metrics
  readonly name: string | undefined
  readonly state: SliderState
  readonly vertical: boolean
}) {
  const own = stylesOf(useTheme())
  const labelRole = useTypeRole('labelLarge')
  const dragging = state.isThumbDragging(index)
  const narrowing = useHandleMotion(dragging, vertical)

  return (
    <View
      accessibilityActions={ADJUSTABLE}
      accessible
      aria-disabled={state.isDisabled}
      aria-label={name}
      aria-valuemax={state.getThumbMaxValue(index)}
      aria-valuemin={state.getThumbMinValue(index)}
      aria-valuenow={state.getThumbValue(index)}
      aria-valuetext={state.getThumbValueLabel(index)}
      onAccessibilityAction={adjustOf(state, index)}
      role="slider"
      style={composeStyles<ViewStyle>(
        vertical ? seats.seatVertical : seats.seat,
        seatPlaceOf(state.getThumbPercent(index), vertical),
      )}
    >
      <Animated.View
        style={composeStyles<AnimatedStyle<ViewStyle>>(
          own.handle,
          handleLengthOf(metrics, vertical),
          state.isDisabled ? own.handleDisabled : undefined,
          narrowing,
        )}
      />
      {dragging ? (
        <View
          aria-hidden
          style={composeStyles<ViewStyle>(
            styles.indicator,
            vertical ? styles.indicatorVertical : styles.indicatorHorizontal,
            own.indicator,
            vertical ? own.indicatorVertical : undefined,
          )}
        >
          <NativeText
            numberOfLines={1}
            style={composeStyles<TextStyle>(labelRole, own.indicatorText)}
          >
            {state.getThumbValueLabel(index)}
          </NativeText>
        </View>
      ) : null}
    </View>
  )
}

// The handle's length across the track, which is the strip's own thickness.
function handleLengthOf({ handle }: Metrics, vertical: boolean): ViewStyle {
  return vertical ? { width: handle } : { height: handle }
}

// Where the inset icon sits: its padding in from the part's start, centred
// across the strip.
function iconPlaceOf(
  { track }: Metrics,
  size: number,
  vertical: boolean,
): ViewStyle {
  const across = (track - size) / 2
  return {
    alignItems: 'center',
    height: size,
    justifyContent: 'center',
    position: 'absolute',
    width: size,
    ...(vertical
      ? { bottom: ICON_PADDING, start: across }
      : { start: ICON_PADDING, top: across }),
  }
}

function iconStyleOf(color: string, size: number): IconStyle {
  return { color, size }
}

// The corners a part turns to a handle, at whichever of its ends meets one.
function innerCornersOf(part: Part, vertical: boolean) {
  const start = vertical ? styles.innerStartVertical : styles.innerStart
  const end = vertical ? styles.innerEndVertical : styles.innerEnd
  return composeStyles<ViewStyle>(
    part.start === AT_END ? undefined : start,
    part.end === AT_END ? undefined : end,
  )
}

// The inset icon, at the foot of the active part, while the part has room
// for it and its padding on both sides.
function InsetIcon({
  icon,
  isDisabled,
  length,
  metrics,
  part,
  vertical,
}: {
  readonly icon: ReactNode
  readonly isDisabled: boolean
  readonly length: number
  readonly metrics: Metrics
  readonly part: Part
  readonly vertical: boolean
}) {
  const { colors } = useTheme()
  const size = metrics.icon ?? 0
  const slot = iconStyleOf(
    isDisabled ? colors.inverseOnSurface : colors.onPrimary,
    size,
  )

  if (lengthOf(part, length) < size + 2 * ICON_PADDING) {
    return null
  }
  return (
    <View style={iconPlaceOf(metrics, size, vertical)}>
      <IconStyleContext value={slot}>{icon}</IconStyleContext>
    </View>
  )
}

// How long a part is on a track `length` long.
function lengthOf({ end, start }: Part, length: number) {
  return (1 - start.fraction - end.fraction) * length - start.px - end.px
}

// A handle's name: its own in a range, then the slider's, as React Aria
// joins them on web.
function nameOf(own: string | undefined, group: string | undefined) {
  const words = [own, group].filter((each) => each !== undefined && each !== '')
  return words.length === 0 ? undefined : words.join(' ')
}

function partColourOf(
  own: ReturnType<typeof stylesOf>,
  active: boolean,
  isDisabled: boolean,
) {
  if (active) {
    return isDisabled ? own.activeDisabled : own.active
  }
  return isDisabled ? own.inactiveDisabled : own.inactive
}

// A part's thickness and corner, centred in the strip the handle's length
// takes.
function partOf(
  { corner, handle, track }: Metrics,
  { radii }: ResolvedTheme,
  vertical: boolean,
): ViewStyle {
  const across = (handle - track) / 2
  return vertical
    ? { borderRadius: radii[corner], start: across, width: track }
    : { borderRadius: radii[corner], height: track, top: across }
}

// The track's parts: an inactive part before the first handle of a range,
// the active part up to or between the handles, and the inactive part after
// the last one, which carries the stop.
function partsOf(state: SliderState): Part[] {
  const fractions = state.values.map((_, index) => state.getThumbPercent(index))
  const first = fractions[0] ?? 0
  const last = fractions.at(-1) ?? 0
  const range = fractions.length > 1
  const active: Part = {
    active: true,
    end: before(last),
    name: 'active',
    start: range ? after(first) : AT_END,
  }
  const afterLast: Part = {
    active: false,
    end: AT_END,
    name: 'after',
    start: after(last),
  }
  if (!range) {
    return [active, afterLast]
  }
  return [
    { active: false, end: before(first), name: 'before', start: AT_END },
    active,
    afterLast,
  ]
}

// Where a part's two ends lie, from the track's ends: a share of its length
// and the dp past it, each on a logical edge, so a right-to-left layout
// starts the track from the right.
function placementOf({ end, start }: Part, vertical: boolean): ViewStyle {
  return vertical
    ? {
        bottom: percentOf(start.fraction),
        marginBottom: start.px,
        marginTop: end.px,
        top: percentOf(end.fraction),
      }
    : {
        end: percentOf(end.fraction),
        marginEnd: end.px,
        marginStart: start.px,
        start: percentOf(start.fraction),
      }
}

/**
 * A slider for one value, or for a range when the value is an array. Its
 * state is React Stately's, as web's is: pass `value` with `onChange` to
 * control it, or `defaultValue` to let it keep its own, with `minValue`,
 * `maxValue` and `step` to shape it and `formatOptions` to say how it reads.
 *
 * ```tsx
 * <Slider defaultValue={40} label="Label" />
 * ```
 *
 * A press on the track moves the nearest handle there, and a drag carries
 * it. A screen reader hears each handle as an adjustable control named by the
 * label, which it moves a step at a time. `style`, `ref` and `testID` land on
 * the slider as a whole, which is the view a layout positions and the one
 * that gives a vertical slider its height. With a `testID`, the drag and the
 * press are registered with Gesture Handler as `<testID>-pan` and
 * `<testID>-tap`, which its `getByGestureTestId` finds in a test.
 */
function Slider({
  'aria-label': ariaLabel,
  defaultValue,
  formatOptions,
  icon,
  isDisabled = false,
  label,
  maxValue,
  minValue,
  onChange,
  onChangeEnd,
  orientation = 'horizontal',
  ref,
  showStops = false,
  size = 'xs',
  step,
  style,
  testID,
  thumbLabels,
  value,
}: SliderProps) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const locale = useLocaleOf(undefined)
  const state = useSliderState<number | number[]>({
    defaultValue,
    isDisabled,
    maxValue,
    minValue,
    numberFormatter: new NumberFormatter(locale, formatOptions),
    onChange,
    onChangeEnd,
    orientation,
    step,
    value,
  })
  const labelRole = useTypeRole('labelLarge')
  // The track's length along its axis, which a press is read against and
  // the stops and the icon are placed by.
  const [length, setLength] = useState(0)
  const vertical = orientation === 'vertical'
  const metrics = SIZES[size]
  const gesture = useTrackGesture({
    isDisabled,
    length,
    state,
    testID,
    vertical,
  })
  const parts = partsOf(state)
  const steps = showStops ? stepsOf(state) : NO_STEPS
  const hasIcon =
    icon !== undefined &&
    icon !== null &&
    metrics.icon !== undefined &&
    parts.length === 2
  const group = label ?? ariaLabel

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
      {label === undefined ? null : (
        <NativeText
          aria-hidden
          style={composeStyles<TextStyle>(labelRole, own.label)}
        >
          {label}
        </NativeText>
      )}
      <GestureHandlerRootView style={trackOf(metrics, vertical)}>
        <GestureDetector gesture={gesture}>
          <View onLayout={lengthTo(setLength, vertical)} style={styles.area}>
            {parts.map((part) => (
              <View
                key={part.name}
                style={composeStyles<ViewStyle>(
                  styles.part,
                  partOf(metrics, theme, vertical),
                  partColourOf(own, part.active, isDisabled),
                  innerCornersOf(part, vertical),
                  placementOf(part, vertical),
                )}
              >
                {part.active && hasIcon ? (
                  <InsetIcon
                    icon={icon}
                    isDisabled={isDisabled}
                    length={length}
                    metrics={metrics}
                    part={part}
                    vertical={vertical}
                  />
                ) : null}
                <Stops
                  isDisabled={isDisabled}
                  length={length}
                  metrics={metrics}
                  part={part}
                  showStops={showStops}
                  steps={steps}
                  vertical={vertical}
                />
              </View>
            ))}
            {state.values.map((_, index) => (
              <Handle
                index={index}
                // oxlint-disable-next-line react/no-array-index-key -- a handle's position is its identity
                key={index}
                metrics={metrics}
                name={nameOf(thumbLabels?.[index], group)}
                state={state}
                vertical={vertical}
              />
            ))}
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </View>
  )
}

// The fractions of the way along the track that a step lands on, ends left
// out: those are drawn as the end stops, the page's gap in from each end.
function stepsOf(state: SliderState) {
  const min = state.getThumbMinValue(0)
  const max = state.getThumbMaxValue(state.values.length - 1)
  const fractions: number[] = []
  if (state.step <= 0) {
    return fractions
  }
  for (let index = 1; min + index * state.step < max; index++) {
    fractions.push(state.getValuePercent(min + index * state.step))
  }
  return fractions
}

function stopColourOf(
  own: ReturnType<typeof stylesOf>,
  active: boolean,
  isDisabled: boolean,
) {
  if (active) {
    return isDisabled ? own.stopActiveDisabled : own.stopActive
  }
  return isDisabled ? own.stopDisabled : undefined
}

// Where a stop at `fraction` of the way along the track starts inside a
// part, from the part's own start.
function stopOffsetOf(
  { start }: Part,
  fraction: number,
  length: number,
): number {
  return (fraction - start.fraction) * length - start.px - STOP / 2
}

// A stop's place in a part: centred across the strip, and along it either at
// one of the part's ends or at its offset from the part's start.
function stopPlaceOf(
  { track }: Metrics,
  vertical: boolean,
  offset: number,
): ViewStyle {
  const across = (track - STOP) / 2
  return vertical
    ? { bottom: offset, start: across }
    : { start: offset, top: across }
}

// What a part holds: a stop at each step inside it, and the end stops where
// it reaches the track's ends. The steps inside are placed by the track's
// measured length, so they wait for the first layout; the end stops are
// placed from the part's own ends and need none.
function Stops({
  isDisabled,
  length,
  metrics,
  part,
  showStops,
  steps,
  vertical,
}: {
  readonly isDisabled: boolean
  readonly length: number
  readonly metrics: Metrics
  readonly part: Part
  readonly showStops: boolean
  readonly steps: readonly number[]
  readonly vertical: boolean
}) {
  const own = stylesOf(useTheme())
  const colour = stopColourOf(own, part.active, isDisabled)
  const across = (metrics.track - STOP) / 2
  const from = part.start.fraction
  const to = 1 - part.end.fraction
  const inside =
    showStops && length > 0 && to > from
      ? steps.filter((fraction) => fraction >= from && fraction <= to)
      : []
  const atStart = part.start === AT_END
  // The single stop at the track's end, which only the inactive part after
  // the last handle reaches, is drawn with or without the stops
  // configuration; the one at the start is the configuration's own.
  const atEnd = part.end === AT_END
  const centred = vertical ? { start: across } : { top: across }

  return (
    <>
      {showStops && atStart ? (
        <View
          style={composeStyles<ViewStyle>(
            styles.stop,
            own.stop,
            colour,
            centred,
            vertical ? styles.stopStartVertical : styles.stopStart,
          )}
        />
      ) : null}
      {inside.map((fraction) => (
        <View
          key={fraction}
          style={composeStyles<ViewStyle>(
            styles.stop,
            own.stop,
            colour,
            stopPlaceOf(
              metrics,
              vertical,
              stopOffsetOf(part, fraction, length),
            ),
          )}
        />
      ))}
      {atEnd ? (
        <View
          style={composeStyles<ViewStyle>(
            styles.stop,
            own.stop,
            colour,
            centred,
            vertical ? styles.stopEndVertical : styles.stopEnd,
          )}
        />
      ) : null}
    </>
  )
}

// The strip the handles are placed along: as long across as the handle, so a
// press anywhere on it lands on the slider. Gesture Handler's root view,
// sized to the strip rather than to the screen it fills by default.
function trackOf({ handle }: Metrics, vertical: boolean): ViewStyle {
  return vertical
    ? { flexGrow: 1, minHeight: 0, width: handle }
    : { height: handle }
}

// The handle narrowing to 2dp while it is dragged, over the short2 duration
// on the standard curve, as web's transition does, and at once under reduced
// motion.
function useHandleMotion(dragging: boolean, vertical: boolean) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const thickness = dragging ? HANDLE_PRESSED : HANDLE_WIDTH
  const timing = {
    duration: motion.durationShort2,
    easing: Easing.bezier(...motion.easingStandard),
  }

  return useAnimatedStyle(() => {
    'worklet'
    const to = reduceMotion ? thickness : withTiming(thickness, timing)
    return vertical ? { height: to } : { width: to }
  })
}

export { Slider }
export type { SliderProps, SliderSize }
