import type {
  GestureResponderEvent,
  LayoutChangeEvent,
  PressableProps,
} from 'react-native'
import type { SharedValue } from 'react-native-reanimated'

import { use, useState } from 'react'
import { Platform, Pressable, StyleSheet } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import type { ResolvedTheme } from '../theme/scope'

import { FormContext } from '../form'
import { useOpenLink } from '../router'
import { useTheme } from '../theme/scope'

// What every button does past its own styles, shared by Button and
// IconButton as web's src/button is: the three forms a button takes, the
// toggle's state and how it is announced, what a press does after the call
// site's own `onPress`, a submit button's included, the corner that eases
// between shapes, and the metrics
// the two components' pages give alike, since the two share their five
// heights so that they line up in a row.

/**
 * A plain button, a link, or a toggle, of which a call site writes exactly
 * one. Each form names the props of the other two as `never`, so a toggle
 * given `href` is a compile error rather than a prop that silently does
 * nothing.
 */
type ButtonLinkForm = {
  readonly defaultSelected?: never
  /**
   * Where the button leads. Given one, a press opens it through the
   * `RouterProvider` around the button, or through the platform for a URL
   * with a scheme of its own, and the button is announced as a link.
   */
  readonly href: string
  readonly isSelected?: never
  readonly onChange?: never
  readonly type?: never
}

type ButtonPressForm = {
  readonly defaultSelected?: never
  readonly href?: never
  readonly isSelected?: never
  readonly onChange?: never
  /**
   * What a press does past `onPress`. `submit` submits the `Form` the button
   * is in, as a submit button does on web; `button` does nothing more.
   * @default 'button'
   */
  readonly type?: 'button' | 'submit'
}

type ButtonToggleForm = {
  /**
   * Whether a toggle starts selected, when it keeps its own state. Passing
   * this, `isSelected` or `onChange` is what makes the button a toggle.
   */
  readonly defaultSelected?: boolean
  readonly href?: never
  /**
   * Whether a toggle is selected, when the call site holds the state. Pass
   * it with `onChange`; passing this, `defaultSelected` or `onChange` is what
   * makes the button a toggle.
   */
  readonly isSelected?: boolean
  /**
   * Called with the new state when a toggle is pressed, after `onPress`.
   * Passing this, `isSelected` or `defaultSelected` is what makes the button
   * a toggle.
   */
  readonly onChange?: (isSelected: boolean) => void
  readonly type?: never
}

/** The five control heights both pages give, by the names both props take. */
type ControlSize = 'lg' | 'md' | 'xl' | 'xs' | 'xxl'

/** How a toggle reports its state to a screen reader. */
type ToggleState = {
  readonly 'aria-pressed'?: boolean
  readonly 'aria-selected'?: boolean
}

// The control height each size reads: the page's XS, S, M, L and XL, which
// the theme's sizing scale names one step apart from this prop.
const HEIGHTS = {
  lg: 'controlLg',
  md: 'controlSm',
  xl: 'controlXl',
  xs: 'controlXs',
  xxl: 'controlXxl',
} as const satisfies Record<ControlSize, keyof ResolvedTheme['sizing']>

// The outlined rule thickens with the size, as the buttons page's size tokens
// have it: 1dp up to M, 2dp at L, 3dp at XL. The icon buttons page keeps its
// widths in a token set its widget will not open, so the icon button takes
// these, which a 96dp icon button beside a 96dp outlined button needs anyway.
const OUTLINE_WIDTHS: Readonly<Record<ControlSize, number>> = {
  lg: 1,
  md: 1,
  xl: 2,
  xs: 1,
  xxl: 3,
}

// The corner each size presses to, which both pages give alike.
const PRESSED_CORNERS = {
  lg: 'md',
  md: 'sm',
  xl: 'lg',
  xs: 'sm',
  xxl: 'lg',
} as const satisfies Record<ControlSize, keyof ResolvedTheme['radii']>

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

// Web's toggle reports `aria-pressed`, which React Native Web writes onto the
// element. React Native has no pressed state to report, and reports the
// selected one instead, which VoiceOver and TalkBack both read out.
const toggleState = Platform.select<(selected: boolean) => ToggleState>({
  default: (selected) => ({ 'aria-selected': selected }),
  web: (selected) => ({ 'aria-pressed': selected }),
})

const buttonStyles = StyleSheet.create({
  // Clips the state layer and the ripple to the corner as it morphs, and
  // takes no touches.
  clip: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
  },
})

// Records the button's height for the corner, then calls the call site's own
// `onLayout`. Built by a call rather than declared in a component, which is
// what react-perf's jsx-no-new-function-as-prop is after; the React Compiler
// memoises the result on its inputs.
function measureThen(
  height: SharedValue<number>,
  onLayout: PressableProps['onLayout'],
) {
  return (event: LayoutChangeEvent) => {
    height.set(event.nativeEvent.layout.height)
    onLayout?.(event)
  }
}

// The call site's own `onPress`, then what the button does with the press.
// Built by a call for the reason `measureThen` is.
function pressThen(onPress: PressableProps['onPress'], then: () => void) {
  return (event: GestureResponderEvent) => {
    onPress?.(event)
    then()
  }
}

/**
 * What a press does, and whether a toggle is selected. A press calls the call
 * site's own `onPress` first, then opens the link, changes the toggle's state
 * or submits the form the button is in, which is the order web reports them
 * in. A toggle keeps its own state from `defaultSelected` unless the call
 * site holds it in `isSelected`. A submit button outside a form submits
 * nothing, as on web.
 */
function useButtonAction({
  defaultSelected,
  href,
  isSelected,
  isToggle,
  onChange,
  onPress,
  type,
}: {
  readonly defaultSelected: boolean | undefined
  readonly href: string | undefined
  readonly isSelected: boolean | undefined
  readonly isToggle: boolean
  readonly onChange: ((isSelected: boolean) => void) | undefined
  readonly onPress: PressableProps['onPress']
  readonly type: 'button' | 'submit' | undefined
}) {
  const openLink = useOpenLink()
  const form = use(FormContext)
  const [ownSelected, setOwnSelected] = useState(defaultSelected ?? false)
  const selected = isToggle && (isSelected ?? ownSelected)

  function follow() {
    if (href !== undefined) {
      openLink(href)
    } else if (isToggle) {
      setOwnSelected(!selected)
      onChange?.(!selected)
    } else if (type === 'submit') {
      form?.requestSubmit()
    }
  }

  return { onPress: pressThen(onPress, follow), selected }
}

/**
 * The corner a button eases to, over the motion tokens' short duration on the
 * emphasised curve, and at once for a reader who asks the device for reduced
 * motion. The pill is the radius scale's `pill`, far larger than any button,
 * so the ease runs from half the button's measured height rather than from
 * that: otherwise the corner would hold the pill for most of the ease and
 * jump at its end. The `onLayout` it hands back measures the button, then
 * calls the call site's own.
 */
function useCorner(radius: number, onLayout: PressableProps['onLayout']) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const height = useSharedValue(0)
  const timing = {
    duration: motion.durationShort2,
    easing: Easing.bezier(...motion.easingEmphasized),
  }
  const corner = useAnimatedStyle(() => {
    'worklet'
    const measured = height.get()
    const target = measured > 0 ? Math.min(radius, measured / 2) : radius

    return {
      borderRadius: reduceMotion ? target : withTiming(target, timing),
    }
  })

  return { corner, onLayout: measureThen(height, onLayout) }
}

export {
  AnimatedPressable,
  buttonStyles,
  HEIGHTS,
  OUTLINE_WIDTHS,
  PRESSED_CORNERS,
  toggleState,
  useButtonAction,
  useCorner,
}
export type { ButtonLinkForm, ButtonPressForm, ButtonToggleForm, ControlSize }
