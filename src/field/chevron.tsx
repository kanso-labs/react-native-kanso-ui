import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { ChevronDownGlyph } from '../glyphs'
import { useTheme } from '../theme/scope'

// How far the chevron turns while the list is open: half a turn, against
// the clock as web's end chevron turns from pointing down to pointing up.
const OPEN_TURN = -180

/**
 * The chevron in the trailing slot of a field that opens a list, pointing
 * down at the list and turned to point up while it is open, on the step the
 * list arrives on, short3 on the standard curve, and at once under reduced
 * motion. It is the down chevron turned half a turn rather than web's end
 * chevron turned a quarter either way, which draws the same two states; the
 * down one does not mirror under right-to-left, so the turn needs no second
 * direction. It takes its colour and size from the slot.
 */
function FieldChevron({ isOpen }: { readonly isOpen: boolean }) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const turn = isOpen ? OPEN_TURN : 0
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
      <ChevronDownGlyph />
    </Animated.View>
  )
}

export { FieldChevron }
