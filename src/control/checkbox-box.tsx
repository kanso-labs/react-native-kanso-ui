import type { ViewStyle } from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'

import { StyleSheet } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated'

import type { ResolvedTheme } from '../theme/scope'

import { CheckGlyph, IndeterminateGlyph } from '../glyphs'
import { withOpacity } from '../theme/color'
import { useTheme } from '../theme/scope'
import { composeStyles } from '../theme/styles'

// The box the checkbox page draws, apart from the press around it: Checkbox
// draws it inside its state layer, and a list row that selects draws it in
// its leading slot, where the row is what a screen reader hears and presses.

/** Which pair of colours the box is drawn in. */
type CheckboxTone = 'error' | 'marked' | 'unmarked'

// The box's side, its rule and its corner, from the page. The glyph is the
// box's size and sits over the whole of it, rule included.
const BOX_SIZE = 18
const BOX_CORNER = 2
const BOX_RULE = 2

const styles = StyleSheet.create({
  box: {
    borderRadius: BOX_CORNER,
    borderWidth: BOX_RULE,
    height: BOX_SIZE,
    width: BOX_SIZE,
  },
})

// Where the glyph sits over the box, which the view around both centres. Over
// the box rather than inside it, since a box's children are laid out inside
// its rule and the glyph covers the rule as well.
const glyphs = new Map<number, ViewStyle>()

/**
 * The box and its glyph, centred in a square view `within` across: the
 * Checkbox's 40dp state layer, or a row's 24dp slot. `active` is a hovered,
 * pressed or focused box, whose rule darkens while unmarked.
 */
function CheckboxBox({
  active = false,
  isDisabled = false,
  isIndeterminate = false,
  isSelected,
  tone,
  within,
}: {
  readonly active?: boolean
  readonly isDisabled?: boolean
  readonly isIndeterminate?: boolean
  readonly isSelected: boolean
  readonly tone?: CheckboxTone
  readonly within: number
}) {
  const theme = useTheme()
  const marked = isSelected || isIndeterminate
  const paint = paintOf(theme, {
    active,
    isDisabled,
    marked,
    tone: tone ?? (marked ? 'marked' : 'unmarked'),
  })
  const box = useBoxColors(paint)
  const Glyph = isIndeterminate
    ? IndeterminateGlyph
    : isSelected
      ? CheckGlyph
      : null

  return (
    <>
      <Animated.View
        style={composeStyles<AnimatedStyle<ViewStyle>>(styles.box, box)}
      />
      {Glyph === null ? null : (
        <Glyph color={paint.glyph} size={BOX_SIZE} style={glyphAt(within)} />
      )}
    </>
  )
}

// The glyph's place over a box centred `within` across, kept per size so a
// render hands the same style each time.
function glyphAt(within: number): ViewStyle {
  const known = glyphs.get(within)

  if (known !== undefined) {
    return known
  }

  const inset = (within - BOX_SIZE) / 2
  const style = { left: inset, position: 'absolute', top: inset } as const

  glyphs.set(within, style)
  return style
}

/**
 * What the box is painted in: its fill, its rule and the glyph's colour.
 * Where the page draws no fill or no rule it is the colour beside it made
 * clear rather than plain transparent black, so the box eases through its
 * own colour rather than through grey.
 */
function paintOf(
  { colors, stateLayerOpacity }: ResolvedTheme,
  {
    active,
    isDisabled,
    marked,
    tone,
  }: {
    readonly active: boolean
    readonly isDisabled: boolean
    readonly marked: boolean
    readonly tone: CheckboxTone
  },
) {
  const disabled = withOpacity(
    colors.onSurface,
    stateLayerOpacity.disabledContent,
  )

  if (marked) {
    const fill = isDisabled
      ? disabled
      : tone === 'error'
        ? colors.error
        : colors.primary
    const glyph = isDisabled
      ? colors.surface
      : tone === 'error'
        ? colors.onError
        : colors.onPrimary

    return { fill, glyph, rule: withOpacity(fill, 0) }
  }

  const rule = isDisabled
    ? disabled
    : tone === 'error'
      ? colors.error
      : active
        ? colors.onSurface
        : colors.onSurfaceVariant

  return { fill: withOpacity(rule, 0), glyph: colors.onPrimary, rule }
}

// The box's fill and rule, eased to as the state changes.
function useBoxColors({ fill, rule }: { fill: string; rule: string }) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const timing = {
    duration: motion.durationShort2,
    easing: Easing.bezier(...motion.easingStandard),
  }

  return useAnimatedStyle(() => {
    'worklet'
    return {
      backgroundColor: reduceMotion ? fill : withTiming(fill, timing),
      borderColor: reduceMotion ? rule : withTiming(rule, timing),
    }
  })
}

export type { CheckboxTone }

export { CheckboxBox }
