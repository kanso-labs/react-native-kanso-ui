import type { ReactNode } from 'react'
import type {
  Insets,
  LayoutChangeEvent,
  TextStyle,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'

import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated'

import type { IconStyle } from '../glyphs/icon-style'
import type { ResolvedTheme } from '../theme/scope'

import { CheckGlyph } from '../glyphs'
import { IconStyleContext } from '../glyphs/icon-style'
import { TARGET_SIZE } from '../press'
import { withOpacity } from '../theme/color'
import { useTheme } from '../theme/scope'
import { composeStyles } from '../theme/styles'
import { useTypeRole } from '../typography/roles'
import { GLYPH_SIZE, styles, stylesOf } from './styles'

// The pill the chips page draws, shared by Chip and ChipGroup's chip so the
// two cannot drift, as web's `src/chip` is. Not a component of the library's
// own and not exported from the package. A 32dp pill with an 8dp corner, 16dp
// of inline padding and a 1dp rule, its label in label-large.
//
// An unselected chip is an outline-variant rule around nothing. **An elevated
// chip trades the outline for a container**, surface container low at the
// page's elevation 1, raised to 2 under a pointer; a selected one keeps the
// secondary container and takes the shadow with it. Its rule stays,
// transparent, so a chip is one size whichever container it is on.
//
// The check takes the icon's place rather than joining it, so a chip with an
// icon keeps its width when it is chosen, where one without grows by the
// slot. The check is what makes the selection legible without colour. An icon
// is in the primary role, and in the label's colour while disabled; the check
// is always in the label's. The slot is the page's 18dp, and a chip drawing
// one pads 8dp on that side rather than 16.
//
// **The label is one line, cut short with an ellipsis.** The chip is never
// wider than what holds it, which leaves the label a width to be cut at, and a
// screen reader still reads all of it. The height is a floor rather than a
// fixed size, so a label the device's text size enlarges grows the chip
// rather than running out of it.
//
// The fill, the rule and the label's colour ease over `durationShort2` on the
// standard curve, and change at once under reduced motion. The check appears
// at once, as on web, and the shadow moves at once, as a button's does.
//
// **Disabled is the page's colour at an opacity, translucent**, as a button's
// is: the label on-surface at `disabledContent`, a selected or elevated chip's
// container on-surface at `disabledContainer`, and an unselected one's rule at
// the same. A disabled chip casts no shadow.
//
// The state layers, the ripple and the focus ring are src/press's: on-surface
// over an unselected or elevated chip, on-secondary-container over a selected
// one.
//
// **The target departs from the page's 48dp, as web's does.** Across, it is
// the chip's width or 48dp, whichever is wider, centred on the chip. Up and
// down it reaches half the `spacing.sm` that chips wrap apart, not the 8dp a
// 48dp target would ask: a full reach would lay one row's target over the next
// one's, and a press just under one chip could go to the chip below it.
// Halfway, two rows' targets meet in the middle of the gap.

/** The colours a chip draws in one state. */
type Paint = {
  /** The label's colour. */
  readonly content: string
  readonly fill: string
  /**
   * The glyph's colour: the label's for the check, and for an icon the
   * primary role's, or the label's while the chip is disabled.
   */
  readonly glyph: string
  /** The state layer's and the ripple's colour. */
  readonly layer: string
  readonly rule: string
}

const CHECK = <CheckGlyph />

/**
 * What a chip draws before its label: the check while it is selected, its own
 * icon while it is not, and nothing for an unselected chip with no icon. The
 * slot hands the glyph its colour and size through `useIconStyle()`.
 */
function ChipGlyph({
  color,
  icon,
  selected,
}: {
  readonly color: string
  readonly icon: ReactNode
  readonly selected: boolean
}) {
  const own = stylesOf(useTheme())
  const glyph = selected ? CHECK : icon

  if (glyph === undefined || glyph === null) {
    return null
  }

  return (
    <IconStyleContext value={iconStyleOf(color)}>
      <View style={composeStyles<ViewStyle>(styles.glyph, own.glyphStart)}>
        {glyph}
      </View>
    </IconStyleContext>
  )
}

/**
 * The label a chip draws, on one line and cut short with an ellipsis, in the
 * colour `useEasedColors` eases.
 */
function ChipLabel({
  children,
  color,
}: {
  readonly children: ReactNode
  readonly color: AnimatedStyle<TextStyle>
}) {
  const role = useTypeRole('labelLarge')

  return (
    <Animated.Text
      numberOfLines={1}
      style={composeStyles<AnimatedStyle<TextStyle>>(role, styles.label, color)}
    >
      {children}
    </Animated.Text>
  )
}

function iconStyleOf(color: string): IconStyle {
  return { color, size: GLYPH_SIZE }
}

/**
 * Records a chip's width for its target, then calls the call site's own
 * `onLayout`. Built by a call rather than declared in a component, which is
 * what react-perf's jsx-no-new-function-as-prop is after; the React Compiler
 * memoises the result on its inputs.
 */
function measureThen(
  setWidth: (width: number) => void,
  onLayout: ((event: LayoutChangeEvent) => void) | null | undefined,
) {
  return (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width)
    onLayout?.(event)
  }
}

/**
 * The colours a chip draws, as the header sets them out. Transparent is
 * written as the colour it eases to or from at no opacity, since Reanimated
 * reads `transparent` as black at none and an ease from it would darken on
 * the way: the fill as the secondary container a selected chip takes, and the
 * rule as the outline it gives up.
 */
function paintOf(
  { colors, stateLayerOpacity }: ResolvedTheme,
  {
    assist,
    disabled,
    elevated,
    selected,
  }: {
    readonly assist: boolean
    readonly disabled: boolean
    readonly elevated: boolean
    readonly selected: boolean
  },
): Paint {
  const clearFill = withOpacity(colors.secondaryContainer, 0)
  const clearRule = withOpacity(colors.outlineVariant, 0)
  const contained = selected || elevated

  if (disabled) {
    const content = withOpacity(
      colors.onSurface,
      stateLayerOpacity.disabledContent,
    )
    const container = withOpacity(
      colors.onSurface,
      stateLayerOpacity.disabledContainer,
    )

    return {
      content,
      fill: contained ? container : clearFill,
      glyph: content,
      layer: colors.onSurface,
      rule: contained ? clearRule : container,
    }
  }

  if (selected) {
    return {
      content: colors.onSecondaryContainer,
      fill: colors.secondaryContainer,
      glyph: colors.onSecondaryContainer,
      layer: colors.onSecondaryContainer,
      rule: clearRule,
    }
  }

  return {
    content: assist ? colors.onSurface : colors.onSurfaceVariant,
    fill: elevated ? colors.surfaceContainerLow : clearFill,
    glyph: colors.primary,
    layer: colors.onSurface,
    rule: elevated ? clearRule : colors.outlineVariant,
  }
}

/**
 * The target the header sets out: half the gap chips wrap apart above and
 * below, and across, whatever brings the chip up to 48dp wide.
 */
function targetOf(width: number, { spacing }: ResolvedTheme): Insets {
  const across = Math.max(0, (TARGET_SIZE - width) / 2)
  const reach = spacing.sm / 2

  return { bottom: reach, left: across, right: across, top: reach }
}

/**
 * The container's fill and rule and the label's colour, easing to the paint
 * they are given, or there at once under reduced motion.
 */
function useEasedColors({ content, fill, rule }: Paint) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const timing = {
    duration: motion.durationShort2,
    easing: Easing.bezier(...motion.easingStandard),
  }

  const container = useAnimatedStyle(() => {
    'worklet'
    return {
      backgroundColor: reduceMotion ? fill : withTiming(fill, timing),
      borderColor: reduceMotion ? rule : withTiming(rule, timing),
    }
  })
  const label = useAnimatedStyle(() => {
    'worklet'
    return { color: reduceMotion ? content : withTiming(content, timing) }
  })

  return { container, label }
}

export { ChipGlyph, ChipLabel, measureThen, paintOf, targetOf, useEasedColors }
export type { Paint }
