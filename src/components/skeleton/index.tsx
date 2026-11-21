import type { ComponentRef, ReactNode, Ref } from 'react'
import type {
  DimensionValue,
  StyleProp,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'

import { StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated'

import { HIDDEN } from '../../glyphs/hidden'
import { useMessages } from '../../i18n/provider'
import { useLoop } from '../../indicator/motion'
import { rowStyles } from '../../row'
import { rowStylesOf } from '../../row/styles'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// The shape of a page drawn at once, while what fills it is read: rows at the
// lists page's 56dp and 72dp heights, holding bars in place of their lines
// and 40dp circles in place of their marks. No Material Design page draws a
// skeleton, so this is kanso's own, drawn on the lists page's row as
// ListItem draws it, from src/row: its 16dp inline and 12dp block padding and
// 16dp between a slot and the lines.
//
// Every shape is surface container highest, the bars at the 4dp corner and
// the circles round. A bar is 12dp tall for an eyebrow or a supporting line,
// 14dp for a title or a figure and 28dp for a headline, each a little under
// the line it stands in for, so a row of bars reads as a row of text rather
// than as blocks. Those three heights fall between steps of the spacing scale
// and are written out. Its width is the call site's, since only it knows how
// long the words it stands in for tend to be.
//
// **No shimmer.** What is inside a skeleton fades from full opacity to 60%
// over 1.5 seconds and back, together, so a screen of rows breathes as one
// rather than flickering row by row. Under reduced motion it holds at full
// opacity.
//
// **A screen reader hears one "Loading".** The skeleton is one element, a
// busy progress bar named by `aria-label`, or by the library's own word for
// loading in the locale, as LoadingIndicator is. What it holds is hidden from
// screen readers on every platform, so nothing inside is read past it.

// A cycle of the fade: 1.5 seconds down to 60%, and 1.5 back.
const FADE_MS = 3000
const FADED = 0.6

// The bars' heights, by what each stands in for.
const BAR_HEIGHTS = {
  lg: 28,
  md: 14,
  sm: 12,
} as const

type SkeletonBarProps = {
  /**
   * What the bar stands in for: `sm`, 12dp, an eyebrow or a supporting line;
   * `md`, 14dp, a title or a figure; `lg`, 28dp, a headline.
   * @default 'sm'
   */
  readonly size?: SkeletonBarSize
  readonly style?: StyleProp<ViewStyle>
  /** How wide the bar is, in dp or as a percentage of what holds it. */
  readonly width: DimensionValue
}

type SkeletonBarSize = keyof typeof BAR_HEIGHTS

type SkeletonCircleProps = {
  readonly style?: StyleProp<ViewStyle>
}

type SkeletonProps = Omit<ViewProps, 'children' | 'style'> & {
  /**
   * What a screen reader hears. Left out, it is the library's word for
   * loading in the `I18nProvider`'s locale, or the device's outside one,
   * "Loading" in English.
   */
  readonly 'aria-label'?: string
  /** The shapes: `Skeleton.Row`s, or bars and circles of the call site's. */
  readonly children?: ReactNode
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
}

type SkeletonRowProps = {
  /** The bars standing in for the row's lines, one above the other. */
  readonly children?: ReactNode
  /** What stands before the lines, usually a `Skeleton.Circle`. */
  readonly leading?: ReactNode
  /**
   * How many lines the row stands in for: `1` is the lists page's 56dp
   * one-line item, `2` its 72dp two-line item.
   * @default 1
   */
  readonly lines?: 1 | 2
  readonly style?: StyleProp<ViewStyle>
  /** What stands after the lines, such as a bar in place of a figure. */
  readonly trailing?: ReactNode
}

const styles = StyleSheet.create({
  // The lines, one above the other, taking the room the slots leave.
  lines: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
})

const stylesOf = themedStyles(({ colors, radii, sizing, spacing }) =>
  StyleSheet.create({
    bar: {
      backgroundColor: colors.surfaceContainerHighest,
      borderRadius: radii.xs,
    },
    circle: {
      backgroundColor: colors.surfaceContainerHighest,
      borderRadius: radii.pill,
      height: sizing.controlSm,
      width: sizing.controlSm,
    },
    gap: {
      gap: spacing.sm,
    },
  }),
)

/**
 * The shape of what is being read, drawn at once in its place: rows of bars
 * and circles, fading gently, that a screen reader hears as one "Loading".
 *
 * ```tsx
 * <Skeleton>
 *   <Skeleton.Row leading={<Skeleton.Circle />} lines={2}>
 *     <Skeleton.Bar size="md" width="60%" />
 *     <Skeleton.Bar width="40%" />
 *   </Skeleton.Row>
 * </Skeleton>
 * ```
 *
 * Draw it where the content will be, in its place rather than over it, and
 * swap it for the content once that is read. `style`, `ref` and `testID`
 * land on its own view.
 */
function Skeleton({
  'aria-label': ariaLabel,
  children,
  style,
  ...props
}: SkeletonProps) {
  const messages = useMessages()
  const reduceMotion = useReducedMotion()
  const clock = useLoop(FADE_MS, !reduceMotion)
  const fade = useAnimatedStyle(() => {
    'worklet'
    if (reduceMotion) {
      return { opacity: 1 }
    }
    // Down to FADED and back up over one cycle, easing at either end.
    const depth = (1 - Math.cos(2 * Math.PI * clock.get())) / 2

    return { opacity: 1 - (1 - FADED) * depth }
  })

  return (
    <Animated.View
      accessible
      aria-busy
      aria-label={ariaLabel ?? messages.loading}
      role="progressbar"
      {...props}
      style={composeStyles<AnimatedStyle<ViewStyle>>(fade, style)}
    >
      <View {...HIDDEN}>{children}</View>
    </Animated.View>
  )
}

/** A bar standing in for a line of text, at the width the call site gives. */
function SkeletonBar({ size = 'sm', style, width }: SkeletonBarProps) {
  const own = stylesOf(useTheme())

  return (
    <View
      style={composeStyles<ViewStyle>(
        own.bar,
        { height: BAR_HEIGHTS[size], width },
        style,
      )}
    />
  )
}

/** A 40dp circle standing in for a row's mark, such as an avatar. */
function SkeletonCircle({ style }: SkeletonCircleProps) {
  const own = stylesOf(useTheme())

  return <View style={composeStyles<ViewStyle>(own.circle, style)} />
}

/**
 * A row standing in for a list item: 56dp for one line, 72dp for two, with
 * the lists page's padding, a leading and a trailing slot, and its bars one
 * above the other between them.
 */
function SkeletonRow({
  children,
  leading,
  lines = 1,
  style,
  trailing,
}: SkeletonRowProps) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const row = rowStylesOf(theme)

  return (
    <View
      style={composeStyles<ViewStyle>(
        row.base,
        row.list,
        lines === 2 ? row.twoLine : undefined,
        style,
      )}
    >
      {leading === undefined ? null : (
        <View style={rowStyles.slot}>{leading}</View>
      )}
      <View style={composeStyles<ViewStyle>(styles.lines, own.gap)}>
        {children}
      </View>
      {trailing === undefined ? null : (
        <View style={rowStyles.slot}>{trailing}</View>
      )}
    </View>
  )
}

Skeleton.Bar = SkeletonBar
Skeleton.Circle = SkeletonCircle
Skeleton.Row = SkeletonRow

export { Skeleton, SkeletonBar, SkeletonCircle, SkeletonRow }
export type {
  SkeletonBarProps,
  SkeletonBarSize,
  SkeletonCircleProps,
  SkeletonProps,
  SkeletonRowProps,
}
