import type { ColorValue } from 'react-native'

import { useEffect } from 'react'
import { I18nManager } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { ChevronEndGlyph } from '../glyphs'
import { useTheme } from '../theme/scope'

/**
 * The chevron of something that opens in place, a Disclosure's header or a
 * Tree's row, pointing at what it opens and turned a quarter to point down
 * once it is open, on short3 and the standard curve, and at once under
 * reduced motion. The glyph mirrors itself under right-to-left, so the turn
 * goes the other way there to point it down too. It takes its size from the
 * slot it sits in, and its colour too unless given one.
 */
function ExpandChevron({
  color,
  isExpanded,
}: {
  readonly color?: ColorValue
  readonly isExpanded: boolean
}) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const turn = isExpanded ? (I18nManager.isRTL ? -90 : 90) : 0
  const angle = useSharedValue(turn)

  useEffect(() => {
    angle.set(
      reduceMotion
        ? turn
        : withTiming(turn, {
            duration: motion.durationShort3,
            easing: Easing.bezier(...motion.easingStandard),
          }),
    )
  }, [angle, motion, reduceMotion, turn])

  const turned = useAnimatedStyle(() => {
    'worklet'
    return { transform: [{ rotate: `${angle.get()}deg` }] }
  })

  return (
    <Animated.View style={turned}>
      <ChevronEndGlyph color={color} />
    </Animated.View>
  )
}

export { ExpandChevron }
