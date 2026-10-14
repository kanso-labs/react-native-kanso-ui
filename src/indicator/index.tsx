import type { ReactNode } from 'react'
import type { LayoutChangeEvent, ViewStyle } from 'react-native'
import type { AnimatedStyle, SharedValue } from 'react-native-reanimated'

import { NumberFormatter } from '@internationalized/number'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { Text } from '../components/text'
import { useIconStyle } from '../glyphs/icon-style'
import { localeOf } from '../number/locale'
import { withOpacity } from '../theme/color'
import { useTheme } from '../theme/scope'
import { composeStyles } from '../theme/styles'
import { RESERVED, styles, stylesOf } from './styles'

// The pieces a linear indicator is drawn from, shared by ProgressIndicator and
// Meter as web's src/indicator is. The styles they use are in ./styles.ts.
//
// Web lays the line out with `calc()` against the row's own width. React
// Native has no `calc()`, so the row is measured through `onLayout` and the
// active indicator's width worked out from that, which is also the length a
// wave along the line follows.

/** What a line draws its parts in. */
type IndicatorColors = {
  /** The active indicator and the stop indicator. */
  readonly active: string
  /** The track. */
  readonly track: string
}

/** How a value that changes moves: a duration in ms and a cubic Bézier. */
type IndicatorTiming = {
  readonly duration: number
  readonly easing: readonly [number, number, number, number]
}

/**
 * The line's colour. `primary` is the page's own pair. `negative` and
 * `positive` swap the active indicator and the stop indicator alone, leaving
 * the track in secondary container, so a column of meters reads as one scale
 * with bars of different colours. `inherit` takes the colour of the slot the
 * line sits in for both, and gives the track a quarter of it.
 */
type IndicatorTone = 'inherit' | 'negative' | 'positive' | 'primary'

/**
 * The active indicator's length at a value: the value's share of what the two
 * gaps and the stop leave of the row, as web's `activeAt` gives it. A share of
 * the whole row would run the row 12dp long at the maximum, with the stop
 * drawn past its end.
 */
function activeLength(width: number, percentage: number) {
  'worklet'
  return (Math.max(0, width - RESERVED) * percentage) / 100
}

// A view's fill, built by a call rather than written inline at the prop,
// which is what react-perf's no-new-object-as-prop is after.
function fillOf(color: string) {
  return { backgroundColor: color }
}

/**
 * The label and, optionally, the value, on a row above the indicator, both in
 * the label-large role and on-surface-variant. Renders nothing when there is
 * neither to show.
 */
function IndicatorLabels({
  label,
  value,
}: {
  readonly label: string | undefined
  readonly value: string | undefined
}) {
  const theme = useTheme()
  const hasLabel = label !== undefined && label !== ''
  const hasValue = value !== undefined && value !== ''

  if (!hasLabel && !hasValue) {
    return null
  }

  return (
    <View style={stylesOf(theme).labels}>
      {hasLabel ? (
        <Text style={styles.label} tone="muted" variant="labelLarge">
          {label}
        </Text>
      ) : null}
      {hasValue ? (
        <Text
          numberOfLines={1}
          style={styles.value}
          tone="muted"
          variant="labelLarge"
        >
          {value}
        </Text>
      ) : null}
    </View>
  )
}

/**
 * The page's line: the active indicator at its share of the measured width,
 * the track taking what is left, and the stop indicator at the end. Anything
 * passed as `children` is drawn inside the track, which is what the progress
 * indicator's buffer fills it with; with none the track is solid.
 * `activeOpacity` is how far the active indicator shows, which is how the
 * progress indicator fades it under a wave.
 */
function IndicatorLine({
  activeOpacity,
  children,
  colors,
  percentage,
  width,
}: {
  readonly activeOpacity?: SharedValue<number>
  readonly children?: ReactNode
  readonly colors: IndicatorColors
  readonly percentage: SharedValue<number>
  readonly width: number
}) {
  const theme = useTheme()
  const sheet = stylesOf(theme)
  const active = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: activeOpacity === undefined ? 1 : activeOpacity.get(),
      width: activeLength(width, percentage.get()),
    }
  })

  return (
    <View style={styles.line}>
      <Animated.View
        style={composeStyles<AnimatedStyle<ViewStyle>>(
          styles.active,
          sheet.active,
          fillOf(colors.active),
          active,
        )}
      />
      <View
        style={composeStyles<ViewStyle>(
          styles.track,
          sheet.track,
          children === undefined ? fillOf(colors.track) : undefined,
        )}
      >
        {children}
      </View>
      <View
        style={composeStyles<ViewStyle>(
          styles.stop,
          sheet.stop,
          fillOf(colors.active),
        )}
      />
    </View>
  )
}

/**
 * The value as React Aria's `useProgressBar` and `useMeter` read it: clamped to the range,
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
 * A value that moves to each new target over `timing`, or jumps to it while
 * the reader has asked for reduced motion, as web's transition drops to `0s`
 * there. It starts at its first target, so nothing moves as it mounts.
 */
function useEased(target: number, timing: IndicatorTiming) {
  const reduceMotion = useReducedMotion()
  const shown = useSharedValue(target)
  const { duration } = timing
  const [x1, y1, x2, y2] = timing.easing

  useEffect(() => {
    shown.set(
      reduceMotion
        ? target
        : withTiming(target, {
            duration,
            easing: Easing.bezier(x1, y1, x2, y2),
          }),
    )
  }, [duration, reduceMotion, shown, target, x1, x2, y1, y2])

  return shown
}

/**
 * The colours a tone draws the line in. `inherit` reads the colour of the
 * slot the line sits in, as a button hands its content colour to what it
 * holds, and falls back to on-surface outside one.
 */
function useIndicatorColors(tone: IndicatorTone): IndicatorColors {
  const { colors } = useTheme()
  const slot = useIconStyle().color

  if (tone === 'inherit') {
    const color = typeof slot === 'string' ? slot : colors.onSurface

    return { active: color, track: withOpacity(color, 0.25) }
  }

  return { active: colors[tone], track: colors.secondaryContainer }
}

/** The width a view was last laid out at, and the handler that reads it. */
function useMeasuredWidth() {
  const [width, setWidth] = useState(0)

  return {
    onLayout: (event: LayoutChangeEvent) => {
      setWidth(event.nativeEvent.layout.width)
    },
    width,
  }
}

export {
  activeLength,
  fillOf,
  IndicatorLabels,
  IndicatorLine,
  readingOf,
  useEased,
  useIndicatorColors,
  useMeasuredWidth,
}
export type { IndicatorColors, IndicatorTiming, IndicatorTone }
