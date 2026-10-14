import type { Ref } from 'react'
import type {
  DimensionValue,
  StyleProp,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle, SharedValue } from 'react-native-reanimated'

import { NumberFormatter } from '@internationalized/number'
import { I18nManager, StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import type { IndicatorColors, IndicatorTone } from '../../indicator'
import type { Curve, Keyframe } from '../../indicator/motion'
import type { RingWave } from '../../indicator/paths'

import { HIDDEN } from '../../glyphs/hidden'
import {
  activeLength,
  fillOf,
  IndicatorLabels,
  IndicatorLine,
  useEased,
  useIndicatorColors,
  useMeasuredWidth,
} from '../../indicator'
import { keyframeAt, useLoop } from '../../indicator/motion'
import {
  arcPath,
  TURN,
  WAVE_HEIGHT,
  WAVE_ORIGIN,
  wavePath,
  wavyArcPath,
} from '../../indicator/paths'
import {
  DETERMINATE_EASING,
  GAP,
  stylesOf as indicatorStylesOf,
  THICKNESS,
} from '../../indicator/styles'
import { localeOf } from '../../number/locale'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// The progress indicators page's indicator, as kanso-ui's ProgressIndicator
// draws it: a line or a ring, in either of the page's two shapes, flat and
// wavy. Both carry the three parts the page's anatomy names, the active
// indicator in primary, the track in secondary container and, on the line,
// the stop indicator in primary at the end, at the page's 4dp thickness with
// the 4dp gap its measurements give either side of the track. The flat ring
// is the page's default 40dp of the four sizes it draws, and the wavy ring the
// 48dp its wave needs room for.
//
// The determinate line is src/indicator's, which Meter draws too: the active
// indicator takes the value's share of what the gaps and the stop leave, and
// the track takes the rest. The determinate ring is two arcs of one circle:
// the active arc runs clockwise from the top for its share of the
// circumference, and the track picks up 4dp past it and stops 4dp before it
// comes back round, which is the same gap measured along the curve.
//
// The animations are Material's own, with web's numbers: the line's two bars
// and their four keyframe sets, the buffer's scrolling dots, the ring's 1333ms
// arc, its four-arc cycle and its 1568ms rotation, and the 250ms and 500ms a
// determinate value moves over. React Native has no CSS keyframes, so each
// set is a list of the same frames read off a looping clock on the UI thread,
// in src/indicator/motion.ts.
//
// Under reduced motion the motion slows rather than stopping, as web's does:
// an indicator that freezes stops saying the work is going on, and a frozen
// arc caught at its short end reads as broken. The multipliers are web's, two
// for the line and a quarter more for the ring. A determinate value jumps
// there instead of easing, as web's transition drops to `0s`.
//
// The wavy shape draws the active indicator as a wave and leaves the track and
// the stop flat, as the page does, with web's numbers, which are Material's
// own: on the line a 3dp amplitude, a 40dp wavelength and a 10dp row, with a
// 20dp wavelength while indeterminate; on the ring a 1.6dp amplitude and a
// 15dp wavelength, rounded to a whole number of waves so the wave closes on
// itself. A determinate wave lies flat up to a tenth of the way and from 95%
// on, and is drawn over the flat drawing, the two crossfading as the value
// crosses those bounds. The flat drawing is also what a reader who has asked
// for reduced motion sees, since a wave is motion even standing still, and
// what a line wider than `WAVE_REACH` is drawn as.
//
// Web cuts its arcs and waves out of whole curves with dash patterns; here
// each is a path built from where it starts and how far it runs, for the
// reason src/indicator/paths.ts gives.
//
// The root carries the role, the range, the value and its text, which React
// Aria's `useProgressBar` gives web's, so a screen reader hears the label and
// the value as one element. The value is read as React Aria reads it: clamped
// to the range, and written as a percentage unless `formatOptions` says
// otherwise, in `locale`.

/** A bar of the indeterminate line, as web's keyframes move it. */
type Bar = {
  /** Its scale across, from its start. */
  readonly scale: readonly Keyframe[]
  /** Where it starts, as a share of the row before the row's own start. */
  readonly start: number
  /** How far it has travelled from there, as a share of the row. */
  readonly translate: readonly Keyframe[]
}

type ProgressIndicatorProps = Omit<ViewProps, 'children' | 'style'> & {
  /**
   * How far the work is loaded ahead of the value, a video's buffered
   * seconds or a queue's fetched pages. Read on the same scale as `value`:
   * the track is solid up to it and dotted beyond. Ignored while the
   * indicator is indeterminate and by the ring, and left out for work with
   * nothing to buffer.
   */
  readonly buffer?: number
  /**
   * How wide the ring is drawn, in dp. Everything inside scales with it, so a
   * ring in a button can take the button's icon size. Web takes a CSS length
   * here; React Native's lengths are numbers. Ignored by the line, which fills
   * the width it is given.
   * @default 40, or 48 for the wavy ring
   */
  readonly diameter?: number
  /**
   * How the value reads.
   * @default { style: 'percent' }
   */
  readonly formatOptions?: Intl.NumberFormatOptions
  /**
   * For work whose length is not known: the indicator runs on its own, and
   * has no value to show or announce.
   * @default false
   */
  readonly isIndeterminate?: boolean
  /**
   * What the work is, shown above the indicator. A screen reader reads it as
   * the indicator's name; an indicator whose surroundings name it takes
   * `aria-label` instead and leaves this out.
   */
  readonly label?: string
  /**
   * The BCP 47 locale the value is written in. Defaults to the device's.
   */
  readonly locale?: string
  /**
   * The value at which the work is done.
   * @default 100
   */
  readonly maxValue?: number
  /**
   * The value at which the work starts.
   * @default 0
   */
  readonly minValue?: number
  readonly ref?: Ref<View>
  /**
   * The page's two shapes. `wavy` draws the active indicator as a wave, which
   * lies flat near either end of a determinate value, and leaves the track
   * and the stop flat; the wavy ring is 48dp across rather than 40. Under
   * reduced motion a wavy indicator is drawn flat.
   * @default 'flat'
   */
  readonly shape?: ProgressIndicatorShape
  /**
   * Whether the value is shown beside the label. Ignored while the indicator
   * is indeterminate, which has no value to show.
   * @default false
   */
  readonly showValue?: boolean
  readonly style?: StyleProp<ViewStyle>
  /**
   * Which colours it is drawn in. `primary` is the page's own pair, the active
   * indicator in primary over a secondary container track, and `inherit`
   * takes the colour of the slot it sits in, for an indicator inside something
   * that already has one, such as a button, where primary would be the fill.
   * @default 'primary'
   */
  readonly tone?: ProgressIndicatorTone
  /**
   * How far the work has gone, between `minValue` and `maxValue`.
   * @default 0
   */
  readonly value?: number
  /** The value as words, in place of the number `formatOptions` writes. */
  readonly valueLabel?: string
  /**
   * The line the page draws, or the ring: `linear` fills the width it is
   * given, `circular` is 40dp across.
   * @default 'linear'
   */
  readonly variant?: ProgressIndicatorVariant
}

type ProgressIndicatorShape = 'flat' | 'wavy'

// The two of the shared line's four tones an indicator draws. The other two
// say how a measurement reads, which is a meter's business rather than a
// running task's.
type ProgressIndicatorTone = Extract<IndicatorTone, 'inherit' | 'primary'>

type ProgressIndicatorVariant = 'circular' | 'linear'

// The flat ring. The radius is the diameter less the stroke, halved, so the
// stroke sits inside the 40dp box rather than straddling its edge.
const CIRCULAR_SIZE = 40
const RADIUS = (CIRCULAR_SIZE - THICKNESS) / 2

// The ring's timings. The arc is 1333ms; a full cycle is four of them; and the
// rotation is the arc scaled by 360/306, which is the arc's start rotation plus
// the circle less the arc's size. A determinate ring moves on Material's own
// curve rather than the line's.
const ARC_MS = 1333
const CYCLE_MS = ARC_MS * 4
const ROTATE_MS = Math.round((ARC_MS * 360) / 306)
const RING_EASING: Curve = [0.4, 0, 0.2, 1]
const RING_SETTLE: Curve = [0, 0, 0.2, 1]

// The line's own: 2s for an indeterminate pass, and the 250ms the buffer's
// dots take to scroll one pitch.
const INDETERMINATE_MS = 2000
const BUFFER_MS = 250

// What reduced motion slows each shape by.
const LINE_SLOWDOWN = 2
const RING_SLOWDOWN = 1.25

// The wavy line's two wavelengths, and how far the wave runs: a row wider than
// that draws flat, as web's does.
const WAVE_WAVELENGTH = 40
const INDETERMINATE_WAVELENGTH = 20
const WAVE_REACH = 2048

// Where a determinate wave stands up and where it lies down again, as
// percentages of the way.
const WAVE_FROM = 10
const WAVE_UNTIL = 95

// The wavy ring: the 48dp box, and the wave round the circle pulled in by the
// amplitude so its crests stay inside the box. The wave count is the
// wavelength's share of that circle, rounded, which is nine.
const WAVY_SIZE = 48
const RING_AMPLITUDE = 1.6
const RING_WAVELENGTH = 15
const WAVY_RADIUS = (WAVY_SIZE - THICKNESS) / 2 - RING_AMPLITUDE

const RING_WAVE: RingWave = {
  amplitude: RING_AMPLITUDE,
  centre: WAVY_SIZE / 2,
  radius: WAVY_RADIUS,
  waves: Math.round((TURN * WAVY_RADIUS) / RING_WAVELENGTH),
}

// The buffer's dots: the track's colour, at the stroke's size, one pitch of
// two and a half strokes apart.
const PITCH = THICKNESS * 2.5

// The two bars of the indeterminate line, translated and scaled at once, with
// web's keyframes, which are Material's.
const PRIMARY_BAR: Bar = {
  scale: [
    [0, 0.08],
    [0.3665, 0.08, [0.334731, 0.12482, 0.785844, 1]],
    [0.6915, 0.661479, [0.06, 0.11, 0.6, 1]],
    [1, 0.08],
  ],
  start: -1.45167,
  translate: [
    [0, 0],
    [0.2, 0, [0.5, 0, 0.701732, 0.495819]],
    [0.5915, 0.836714, [0.302435, 0.381352, 0.55, 0.956352]],
    [1, 2.00611],
  ],
}

const SECONDARY_BAR: Bar = {
  scale: [
    [0, 0.08, [0.205028, 0.057051, 0.57661, 0.453971]],
    [0.1915, 0.457104, [0.152313, 0.196432, 0.648374, 1.00432]],
    [0.4415, 0.72796, [0.257759, -0.003163, 0.211762, 1.38179]],
    [1, 0.08],
  ],
  start: -0.548889,
  translate: [
    [0, 0, [0.15, 0, 0.515058, 0.409685]],
    [0.25, 0.376519, [0.31033, 0.284058, 0.8, 0.733712]],
    [0.4835, 0.843862, [0.4, 0.627035, 0.6, 0.902026]],
    [1, 1.60278],
  ],
}

// The indeterminate ring's arc, as a share of the way round. Material
// contracts it to 10 degrees of turn and grows it to 270; web draws the short
// end at 8% rather than 10 degrees, since a round cap on so short an arc draws
// a dot, and this is web's.
const EXPAND_ARC: readonly Keyframe[] = [
  [0, 0.08, RING_EASING],
  [0.5, 0.75, RING_EASING],
  [1, 0.08],
]

// Where the arc starts, in turns. Material turns it in eight steps of 135
// degrees rather than at a constant rate, each on the arc's own curve, so it
// settles at each position and springs to the next: three full turns over the
// cycle, under the rotation's own single turn.
const TRAVEL_ARC: readonly Keyframe[] = [
  [0, 0, RING_EASING],
  [0.125, 0.375, RING_EASING],
  [0.25, 0.75, RING_EASING],
  [0.375, 1.125, RING_EASING],
  [0.5, 1.5, RING_EASING],
  [0.625, 1.875, RING_EASING],
  [0.75, 2.25, RING_EASING],
  [0.875, 2.625, RING_EASING],
  [1, 3],
]

const AnimatedPath = Animated.createAnimatedComponent(Path)

const styles = StyleSheet.create({
  // A bar of the indeterminate line: the row's width, scaled from its start
  // and travelling across. Physical rather than logical, as web's are: the
  // keyframes move one way only, so the direction is handled once, by
  // mirroring the row.
  bar: {
    height: THICKNESS,
    left: 0,
    position: 'absolute',
    top: 0,
    transformOrigin: 'left center',
  },
  // The solid part of a buffered track, as far as the buffer reaches.
  buffered: {
    flexShrink: 0,
    height: THICKNESS,
  },
  dot: {
    height: THICKNESS,
    width: THICKNESS,
  },
  // The dots, scrolling one pitch toward the start of the line and starting
  // again.
  dotRow: {
    flexDirection: 'row',
    gap: PITCH - THICKNESS,
  },
  // What the buffer leaves of the track, which the dots fill.
  dots: {
    flexGrow: 1,
    flexShrink: 1,
    height: THICKNESS,
    minWidth: 0,
    overflow: 'hidden',
  },
  // The flat line's row, whose width the line is drawn to.
  line: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  mirrored: {
    transform: [{ scaleX: -1 }],
  },
  // A circular indicator is its own size rather than the room it is given.
  rootCircular: {
    alignItems: 'flex-start',
  },
  // The indeterminate line's row, which clips its bars at both ends.
  row: {
    alignSelf: 'stretch',
    height: THICKNESS,
    overflow: 'hidden',
  },
  // The track behind the indeterminate line's bars.
  track: {
    ...StyleSheet.absoluteFill,
  },
  // A wave over the line: the row's whole box, mirrored under a right-to-left
  // layout so it starts at the start of the line.
  wave: {
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
  // The wavy line's row: the wave's 10dp, with the flat line through its
  // middle.
  wavyLine: {
    alignSelf: 'stretch',
    height: WAVE_HEIGHT,
    justifyContent: 'center',
  },
})

const stylesOf = themedStyles(({ radii }) =>
  StyleSheet.create({
    // The bars carry the pill every other part of the line draws. It is drawn
    // under the bar's own scale, so it flattens as the bar narrows, as web's
    // and Material's do.
    bar: { borderRadius: radii.pill },
    dot: { borderRadius: radii.circle },
    row: { borderRadius: radii.pill },
  }),
)

/**
 * The dots beyond the buffer, scrolling toward the start of the line. There
 * is one more of them than the row has room for, so the row stays full as
 * they move.
 */
function Buffer({
  colors,
  share,
  width,
}: {
  readonly colors: IndicatorColors
  readonly share: number
  readonly width: number
}) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const reduceMotion = useReducedMotion()
  const clock = useLoop(BUFFER_MS * (reduceMotion ? LINE_SLOWDOWN : 1), true)
  // A translation is not mirrored under a right-to-left layout, though the
  // row is, so the dots travel the other way there.
  const direction = I18nManager.isRTL ? -1 : 1
  const scroll = useAnimatedStyle(() => {
    'worklet'
    return { transform: [{ translateX: -PITCH * clock.get() * direction }] }
  })

  return (
    <>
      <View
        style={composeStyles<ViewStyle>(
          styles.buffered,
          fillOf(colors.track),
          widthOf(`${share}%`),
        )}
      />
      <View style={styles.dots}>
        <Animated.View
          style={composeStyles<AnimatedStyle<ViewStyle>>(styles.dotRow, scroll)}
        >
          {dotsFor(width).map((dot) => (
            <View
              key={dot}
              style={composeStyles<ViewStyle>(
                styles.dot,
                own.dot,
                fillOf(colors.track),
              )}
            />
          ))}
        </Animated.View>
      </View>
    </>
  )
}

// How much of the track the buffer covers. The buffer is read on the value's
// scale, and the track holds what the value has not taken, so the solid part
// is the buffer's share of that remainder, as web's `bufferShare` gives it.
function bufferShare(
  buffer: number | undefined,
  percentage: number,
  minValue: number,
  maxValue: number,
) {
  if (buffer === undefined) {
    return undefined
  }
  const range = maxValue - minValue
  const buffered = range === 0 ? 0 : ((buffer - minValue) / range) * 100
  const remaining = 100 - percentage
  if (remaining <= 0) {
    return 0
  }
  return Math.min(100, Math.max(0, ((buffered - percentage) / remaining) * 100))
}

/**
 * The ring: two arcs of one circle while determinate, one arc growing,
 * shrinking and travelling round while indeterminate, and for the wavy shape a
 * wave over the active arc. Drawn on a box of its own size and scaled to the
 * diameter, so the stroke and the gap scale with it.
 */
function CircularTrack({
  colors,
  diameter,
  isIndeterminate,
  percentage,
  shape,
}: {
  readonly colors: IndicatorColors
  readonly diameter: number
  readonly isIndeterminate: boolean
  readonly percentage: number
  readonly shape: ProgressIndicatorShape
}) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const wavy = shape === 'wavy'
  const waves = wavy && !reduceMotion
  const box = wavy ? WAVY_SIZE : CIRCULAR_SIZE
  const centre = box / 2
  const radius = wavy ? WAVY_RADIUS : RADIUS
  const circumference = TURN * radius
  const timing = { duration: motion.durationLong2, easing: RING_SETTLE }
  const shown = useEased(percentage, timing)
  const fade = useEased(
    waves && (isIndeterminate || isWaving(percentage)) ? 1 : 0,
    timing,
  )
  const slowdown = reduceMotion ? RING_SLOWDOWN : 1
  const arc = useLoop(ARC_MS * slowdown, isIndeterminate)
  const cycle = useLoop(CYCLE_MS * slowdown, isIndeterminate)
  const turn = useLoop(Math.round(ROTATE_MS * slowdown), isIndeterminate)

  // The active arc, or the indeterminate one: it grows and shrinks over the
  // arc's duration, its start travels the circle over the cycle, and the
  // whole of it turns over the rotation's. An indeterminate ring starts at
  // three o'clock, as web's does once its spin replaces the quarter turn back
  // that puts a determinate one's start at the top.
  const active = useAnimatedProps(() => {
    'worklet'
    const opacity = 1 - fade.get()
    if (isIndeterminate) {
      const from =
        TURN / 4 + TURN * (turn.get() + keyframeAt(TRAVEL_ARC, cycle.get()))
      return {
        d: arcPath(
          centre,
          radius,
          from,
          TURN * keyframeAt(EXPAND_ARC, arc.get()),
        ),
        opacity,
      }
    }
    return {
      d: arcPath(centre, radius, 0, (TURN * shown.get()) / 100),
      opacity,
    }
  })
  // The track picks up a gap past the active arc and stops a gap before the
  // top.
  const track = useAnimatedProps(() => {
    'worklet'
    const length = (circumference * shown.get()) / 100
    return {
      d: arcPath(
        centre,
        radius,
        (length + GAP) / radius,
        Math.max(0, circumference - length - 2 * GAP) / radius,
      ),
    }
  })

  return (
    <Svg
      {...HIDDEN}
      height={diameter}
      viewBox={`0 0 ${box} ${box}`}
      width={diameter}
    >
      {isIndeterminate ? null : (
        <AnimatedPath animatedProps={track} {...strokeOf(colors.track)} />
      )}
      <AnimatedPath animatedProps={active} {...strokeOf(colors.active)} />
      {waves ? (
        <RingWavePath
          arc={arc}
          colors={colors}
          cycle={cycle}
          fade={fade}
          isIndeterminate={isIndeterminate}
          shown={shown}
          turn={turn}
        />
      ) : null}
    </Svg>
  )
}

/**
 * The line determinate: src/indicator's, with the buffer in its track, and
 * for the wavy shape a wave over its active indicator, crossfading with it as
 * the value crosses the bounds the wave stands between.
 */
function DeterminateLine({
  buffer,
  colors,
  percentage,
  waves,
  width,
}: {
  readonly buffer: number | undefined
  readonly colors: IndicatorColors
  readonly percentage: number
  readonly waves: boolean
  readonly width: number
}) {
  const { motion } = useTheme()
  const timing = {
    duration: motion.durationMedium1,
    easing: DETERMINATE_EASING,
  }
  const shown = useEased(percentage, timing)
  const fade = useEased(waves && isWaving(percentage) ? 1 : 0, timing)
  const under = useDerivedValue(() => 1 - fade.get())

  return (
    <>
      <IndicatorLine
        activeOpacity={waves ? under : undefined}
        colors={colors}
        percentage={shown}
        width={width}
      >
        {buffer === undefined ? undefined : (
          <Buffer colors={colors} share={buffer} width={width} />
        )}
      </IndicatorLine>
      {waves ? (
        <LineWave colors={colors} fade={fade} shown={shown} width={width} />
      ) : null}
    </>
  )
}

// One key for each dot the buffer draws across `width`.
function dotsFor(width: number) {
  return Array.from(
    { length: Math.ceil(width / PITCH) + 1 },
    (_, index) => index,
  )
}

// The flat bars of the indeterminate line.
function IndeterminateBars({
  clock,
  colors,
  width,
}: {
  readonly clock: SharedValue<number>
  readonly colors: IndicatorColors
  readonly width: number
}) {
  const own = stylesOf(useTheme())
  const primary = useBarStyle(clock, PRIMARY_BAR, width)
  const secondary = useBarStyle(clock, SECONDARY_BAR, width)

  return (
    <>
      <Animated.View
        style={composeStyles<AnimatedStyle<ViewStyle>>(
          styles.bar,
          own.bar,
          widthOf(width),
          fillOf(colors.active),
          primary,
        )}
      />
      <Animated.View
        style={composeStyles<AnimatedStyle<ViewStyle>>(
          styles.bar,
          own.bar,
          widthOf(width),
          fillOf(colors.active),
          secondary,
        )}
      />
    </>
  )
}

/**
 * The line indeterminate: the track, with two bars crossing it, or for the
 * wavy shape two stretches of a wave crossing it where the bars would be. The
 * row is mirrored under a right-to-left layout, which makes the sweep travel
 * the way the line reads while the bars move as Material's keyframes say.
 */
function IndeterminateLine({
  colors,
  waves,
  width,
}: {
  readonly colors: IndicatorColors
  readonly waves: boolean
  readonly width: number
}) {
  const own = stylesOf(useTheme())
  const reduceMotion = useReducedMotion()
  const clock = useLoop(
    INDETERMINATE_MS * (reduceMotion ? LINE_SLOWDOWN : 1),
    true,
  )
  const mirrored = I18nManager.isRTL ? styles.mirrored : undefined

  return (
    <>
      <View style={composeStyles<ViewStyle>(styles.row, own.row, mirrored)}>
        <View
          style={composeStyles<ViewStyle>(styles.track, fillOf(colors.track))}
        />
        {waves ? null : (
          <IndeterminateBars clock={clock} colors={colors} width={width} />
        )}
      </View>
      {waves ? (
        <Svg
          {...HIDDEN}
          height={WAVE_HEIGHT}
          style={composeStyles<ViewStyle>(styles.wave, mirrored)}
          width={width}
        >
          <WaveBar
            bar={PRIMARY_BAR}
            clock={clock}
            colors={colors}
            width={width}
          />
          <WaveBar
            bar={SECONDARY_BAR}
            clock={clock}
            colors={colors}
            width={width}
          />
        </Svg>
      ) : null}
    </>
  )
}

// Whether a determinate wave stands at this value; see `WAVE_FROM`.
function isWaving(percentage: number) {
  return percentage > WAVE_FROM && percentage < WAVE_UNTIL
}

/**
 * The line, measured: the row is laid out first and the line drawn to its
 * width, which is what web's `calc()` and container units do without a
 * measurement.
 */
function LinearTrack({
  buffer,
  colors,
  isIndeterminate,
  percentage,
  shape,
}: {
  readonly buffer: number | undefined
  readonly colors: IndicatorColors
  readonly isIndeterminate: boolean
  readonly percentage: number
  readonly shape: ProgressIndicatorShape
}) {
  const { onLayout, width } = useMeasuredWidth()
  const reduceMotion = useReducedMotion()
  const wavy = shape === 'wavy'
  const waves = wavy && !reduceMotion && width <= WAVE_REACH

  return (
    <View onLayout={onLayout} style={wavy ? styles.wavyLine : styles.line}>
      {isIndeterminate ? (
        <IndeterminateLine colors={colors} waves={waves} width={width} />
      ) : (
        <DeterminateLine
          buffer={buffer}
          colors={colors}
          percentage={percentage}
          waves={waves}
          width={width}
        />
      )}
    </View>
  )
}

/** The determinate line's wave, cut to the active indicator's length. */
function LineWave({
  colors,
  fade,
  shown,
  width,
}: {
  readonly colors: IndicatorColors
  readonly fade: SharedValue<number>
  readonly shown: SharedValue<number>
  readonly width: number
}) {
  // The active indicator's length less the half stroke each round cap adds at
  // either end, as web's `waveAt` gives it.
  const wave = useAnimatedProps(() => {
    'worklet'
    const length = Math.max(0, activeLength(width, shown.get()) - THICKNESS)
    return {
      d: wavePath(WAVE_WAVELENGTH, WAVE_ORIGIN, WAVE_ORIGIN + length),
      opacity: fade.get(),
    }
  })

  return (
    <Svg
      {...HIDDEN}
      height={WAVE_HEIGHT}
      style={composeStyles<ViewStyle>(
        styles.wave,
        I18nManager.isRTL ? styles.mirrored : undefined,
      )}
      width={width}
    >
      <AnimatedPath animatedProps={wave} {...strokeOf(colors.active)} />
    </Svg>
  )
}

/**
 * Progress through a task, as a line or a ring. Pass `value` between
 * `minValue` and `maxValue`, or set `isIndeterminate` for work whose length is
 * not known. `formatOptions` says how the value reads, in `locale`, and
 * `buffer` marks how far the work is loaded ahead of it.
 *
 * ```tsx
 * <ProgressIndicator label="Label" showValue value={40} />
 * ```
 *
 * A screen reader hears it as a progress bar named by its label, with its
 * value as `formatOptions` writes it, and no value while it is indeterminate.
 * `style`, `ref` and `testID` land on the indicator as a whole, which is the
 * view a layout positions.
 */
function ProgressIndicator({
  'aria-label': ariaLabel,
  buffer,
  diameter,
  formatOptions,
  isIndeterminate = false,
  label,
  locale,
  maxValue = 100,
  minValue = 0,
  shape = 'flat',
  showValue = false,
  style,
  tone = 'primary',
  value = 0,
  valueLabel,
  variant = 'linear',
  ...props
}: ProgressIndicatorProps) {
  const theme = useTheme()
  const colors = useIndicatorColors(tone)
  const reading = readingOf({
    formatOptions,
    locale,
    maxValue,
    minValue,
    value,
    valueLabel,
  })
  const text = isIndeterminate ? undefined : reading.text

  return (
    <View
      accessible
      aria-label={label ?? ariaLabel}
      aria-valuemax={maxValue}
      aria-valuemin={minValue}
      aria-valuenow={isIndeterminate ? undefined : reading.value}
      aria-valuetext={text}
      role="progressbar"
      {...props}
      style={composeStyles<ViewStyle>(
        indicatorStylesOf(theme).root,
        variant === 'circular' ? styles.rootCircular : undefined,
        style,
      )}
    >
      <IndicatorLabels label={label} value={showValue ? text : undefined} />
      {variant === 'circular' ? (
        <CircularTrack
          colors={colors}
          diameter={diameter ?? (shape === 'wavy' ? WAVY_SIZE : CIRCULAR_SIZE)}
          isIndeterminate={isIndeterminate}
          percentage={reading.percentage}
          shape={shape}
        />
      ) : (
        <LinearTrack
          buffer={bufferShare(buffer, reading.percentage, minValue, maxValue)}
          colors={colors}
          isIndeterminate={isIndeterminate}
          percentage={reading.percentage}
          shape={shape}
        />
      )}
    </View>
  )
}

/**
 * The value as React Aria's `useProgressBar` reads it: clamped to the range,
 * as a percentage of it, and written out by `formatOptions` in the locale,
 * the share of the range under a percent style and the value itself under
 * any other, unless `valueLabel` says it in words.
 */
function readingOf({
  formatOptions = { style: 'percent' },
  locale,
  maxValue,
  minValue,
  value,
  valueLabel,
}: {
  readonly formatOptions: Intl.NumberFormatOptions | undefined
  readonly locale: string | undefined
  readonly maxValue: number
  readonly minValue: number
  readonly value: number
  readonly valueLabel: string | undefined
}) {
  const clamped = Math.min(Math.max(value, minValue), maxValue)
  const range = maxValue - minValue
  const share = range === 0 ? 0 : (clamped - minValue) / range
  const text =
    valueLabel ??
    new NumberFormatter(localeOf(locale), formatOptions).format(
      formatOptions.style === 'percent' ? share : clamped,
    )

  return { percentage: share * 100, text, value: clamped }
}

/**
 * The wave over the ring's active arc, cut by the same lengths, or running
 * round as the indeterminate arc does. Its crests turn with the ring.
 */
function RingWavePath({
  arc,
  colors,
  cycle,
  fade,
  isIndeterminate,
  shown,
  turn,
}: {
  readonly arc: SharedValue<number>
  readonly colors: IndicatorColors
  readonly cycle: SharedValue<number>
  readonly fade: SharedValue<number>
  readonly isIndeterminate: boolean
  readonly shown: SharedValue<number>
  readonly turn: SharedValue<number>
}) {
  const wave = useAnimatedProps(() => {
    'worklet'
    if (isIndeterminate) {
      const phase = TURN / 4 + TURN * turn.get()
      return {
        d: wavyArcPath(
          RING_WAVE,
          phase,
          phase + TURN * keyframeAt(TRAVEL_ARC, cycle.get()),
          TURN * keyframeAt(EXPAND_ARC, arc.get()),
        ),
        opacity: fade.get(),
      }
    }
    return {
      d: wavyArcPath(RING_WAVE, 0, 0, (TURN * shown.get()) / 100),
      opacity: fade.get(),
    }
  })

  return <AnimatedPath animatedProps={wave} {...strokeOf(colors.active)} />
}

// What every curve of the indicator is stroked with: the colour, at the 4dp
// thickness, with round ends and joins, and no fill.
function strokeOf(color: string) {
  return {
    fill: 'none',
    stroke: color,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: THICKNESS,
  } as const
}

/**
 * A bar of the indeterminate line where the clock has it: its start, and its
 * scale from there, both as web's keyframes give them in shares of the row.
 */
function useBarStyle(clock: SharedValue<number>, bar: Bar, width: number) {
  return useAnimatedStyle(() => {
    'worklet'
    const time = clock.get()
    return {
      transform: [
        { translateX: (bar.start + keyframeAt(bar.translate, time)) * width },
        { scaleX: keyframeAt(bar.scale, time) },
      ],
    }
  })
}

/**
 * A bar of the indeterminate line drawn as a stretch of the wave: from where
 * the flat bar starts, as long as the flat bar is, and nothing of it before
 * the wave's own start.
 */
function WaveBar({
  bar,
  clock,
  colors,
  width,
}: {
  readonly bar: Bar
  readonly clock: SharedValue<number>
  readonly colors: IndicatorColors
  readonly width: number
}) {
  const wave = useAnimatedProps(() => {
    'worklet'
    const time = clock.get()
    const from =
      WAVE_ORIGIN + (bar.start + keyframeAt(bar.translate, time)) * width
    const to = from + keyframeAt(bar.scale, time) * width
    return {
      d: wavePath(
        INDETERMINATE_WAVELENGTH,
        Math.max(WAVE_ORIGIN, from),
        Math.min(WAVE_ORIGIN + width, to),
      ),
    }
  })

  return <AnimatedPath animatedProps={wave} {...strokeOf(colors.active)} />
}

// A view's width, built by a call rather than written inline at the prop,
// which is what react-perf's no-new-object-as-prop is after.
function widthOf(width: DimensionValue) {
  return { width }
}

export { ProgressIndicator }
export type {
  ProgressIndicatorProps,
  ProgressIndicatorShape,
  ProgressIndicatorTone,
  ProgressIndicatorVariant,
}
