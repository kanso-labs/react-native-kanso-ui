import type { ComponentRef, ReactNode, Ref } from 'react'
import type {
  ColorValue,
  PressableProps,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'

import { createContext, use, useEffect } from 'react'
import { Text as NativeText, Pressable, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import type { IconStyle } from '../glyphs/icon-style'
import type { ResolvedTheme } from '../theme/scope'

import { Badge } from '../badge'
import { IconStyleContext } from '../glyphs/icon-style'
import { hitSlop, usePressFeedback } from '../press'
import { withOpacity } from '../theme/color'
import { useTheme } from '../theme/scope'
import { composeStyles } from '../theme/styles'
import { useTypeRole } from '../typography/roles'
import { INDICATOR, PILL_HEIGHT, styles, stylesOf } from './styles'

// The destination NavigationBar draws, in the two forms its page gives it,
// as kanso-ui's src/navigation draws it. Apart from the bar, so the forms it
// shares with a rail cannot drift.
//
// A vertical destination puts its icon in the page's 56dp by 32dp active
// indicator with the label 4dp under it, in label medium. A horizontal one is
// a 40dp pill holding the icon and the label side by side, 16dp in at either
// end with 4dp between the two, in label medium too. Which one a destination
// draws is the bar's to say, through the context it hands them.
//
// The current destination's indicator is the secondary container, with its
// icon in on secondary container and, under the indicator, its label in
// secondary; every other is on surface variant. A label set inside the pill,
// as a horizontal destination sets it, takes on secondary container instead,
// as on web: secondary over secondary container is not a pair a scheme is
// held to, and on secondary container is.
//
// **The indicator grows** when its destination becomes current, and shrinks
// back when another does: from 40% of its width to the whole of it from its
// centre over `durationLong2` on the emphasized curve, fading in over the
// first fifth of that, as Material's Android components draw it. Web draws it
// at once. Under reduced motion it does here too.
//
// The state layer, the ripple and the focus ring are src/press's, in on
// secondary container, drawn on the pill: the indicator in a vertical
// destination, which its ripple grows from the centre of wherever it is
// pressed, and the whole destination in a horizontal one. A horizontal pill's
// press reaches 4dp above and below it, to the 48dp target; a vertical
// destination is the bar's full height already. A disabled one draws its icon
// and label on surface at the disabled content opacity, with no layer.
//
// A destination is a `tab`, reporting whether it is the selected one, and is
// named by its label, or by `aria-label` where that is given: the badge on
// its icon is hidden from a screen reader, so what it says belongs there.
//
// **The label comes first in the tree and is drawn after the icon**, through
// a reversed column or row, so the text inside a destination starts with its
// name. A badge's count is text, hidden from a screen reader but still
// written inside the destination under React Native Web, and first in the
// tree it put the count ahead of the name: a destination named "Second item,
// 3 new" read "3 Second item", which is not what a speech-input user would
// say, and is what axe's label-in-name check fails. src/badge sets the count
// apart from the label with a space for the same reason.

/** What a bar hands each of its destinations. */
type NavigationContextValue = {
  readonly form: NavigationForm
  /**
   * Whether the destinations are being drawn off screen to measure the
   * horizontal form, which draws each one's content and nothing else.
   */
  readonly measuring: boolean
  /** The route of the current destination, matched against an `href`. */
  readonly selectedRoute?: string | undefined
}

type NavigationDestinationProps = Omit<
  PressableProps,
  'children' | 'disabled' | 'style'
> & {
  /**
   * A badge on the icon: `true` for the badges page's small dot, a number
   * for the large badge holding it. The badge is hidden from a screen
   * reader, so say what it says in the destination's `aria-label` too:
   * "First item, 3 new".
   */
  readonly badge?: boolean | number | undefined
  /** The destination's name, drawn as its label. */
  readonly children?: ReactNode
  /**
   * The destination's icon, at the page's 24dp, which the destination hands
   * its colour and size through `useIconStyle()`.
   */
  readonly icon?: ReactNode
  /**
   * Draws the destination disabled, and it takes no press.
   * @default false
   */
  readonly isDisabled?: boolean
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
}

/**
 * Which of the page's two forms a destination draws: the label under the
 * icon, or beside it.
 */
type NavigationForm = 'horizontal' | 'vertical'

// The indicator's width when it starts to grow, as a share of its whole
// width, and the share of the move it fades in over.
const GROWN_FROM = 0.4
const FADE_SHARE = 0.2

const ICON_SIZE = 24

const NavigationContext = createContext<NavigationContextValue>({
  form: 'vertical',
  measuring: false,
})

/**
 * The active indicator's fill, which grows from its centre while its
 * destination is current and shrinks back once it is not.
 */
function ActiveIndicator({ selected }: { readonly selected: boolean }) {
  const theme = useTheme()
  const { colors, motion } = theme
  const reduceMotion = useReducedMotion()
  const progress = useSharedValue(selected ? 1 : 0)

  useEffect(() => {
    const target = selected ? 1 : 0

    progress.set(
      reduceMotion
        ? target
        : withTiming(target, {
            duration: motion.durationLong2,
            easing: Easing.bezier(...motion.easingEmphasized),
          }),
    )
  }, [motion, progress, reduceMotion, selected])

  const motionStyle = useAnimatedStyle(() => {
    'worklet'
    const grown = progress.get()

    return {
      opacity: Math.min(1, grown / FADE_SHARE),
      transform: [{ scaleX: GROWN_FROM + (1 - GROWN_FROM) * grown }],
    }
  })

  return (
    <Animated.View
      style={composeStyles<AnimatedStyle<ViewStyle>>(
        styles.fill,
        stylesOf(theme).pill,
        { backgroundColor: colors.secondaryContainer },
        motionStyle,
      )}
    />
  )
}

/**
 * What a destination draws over its indicator: the icon and its badge, and
 * in a horizontal destination the label before them in the tree, which the
 * pill's reversed row draws after them.
 */
function DestinationContent({
  badge,
  form,
  icon,
  isDisabled,
  label,
  selected,
}: {
  readonly badge: boolean | number | undefined
  readonly form: NavigationForm
  readonly icon: ReactNode
  readonly isDisabled: boolean
  readonly label: ReactNode
  readonly selected: boolean
}) {
  const theme = useTheme()
  const horizontal = form === 'horizontal'

  return (
    <>
      {horizontal ? (
        <Label form={form} isDisabled={isDisabled} selected={selected}>
          {label}
        </Label>
      ) : null}
      <View style={styles.icon}>
        <IconStyleContext
          value={iconStyleOf(iconColorOf(theme, isDisabled, selected))}
        >
          {badge === undefined || badge === false ? (
            icon
          ) : (
            <Badge
              count={badge === true ? undefined : badge}
              inFlow={horizontal}
            >
              {icon}
            </Badge>
          )}
        </IconStyleContext>
      </View>
    </>
  )
}

/** The colour a destination draws its icon in. */
function iconColorOf(
  { colors, stateLayerOpacity }: ResolvedTheme,
  isDisabled: boolean,
  selected: boolean,
): string {
  if (isDisabled) {
    return withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)
  }
  return selected ? colors.onSecondaryContainer : colors.onSurfaceVariant
}

// Built by a call rather than written inline at the prop, which is what
// react-perf's jsx-no-new-object-as-prop is after; the React Compiler
// memoises the result on its inputs.
function iconStyleOf(color: ColorValue): IconStyle {
  return { color, size: ICON_SIZE }
}

/** A destination's label, on one line, in label medium. */
function Label({
  children,
  form,
  isDisabled,
  selected,
}: {
  readonly children: ReactNode
  readonly form: NavigationForm
  readonly isDisabled: boolean
  readonly selected: boolean
}) {
  const theme = useTheme()
  const role = useTypeRole('labelMedium')

  return (
    <NativeText
      numberOfLines={1}
      style={composeStyles<TextStyle>(role, styles.label, {
        color: labelColorOf(theme, form, isDisabled, selected),
      })}
    >
      {children}
    </NativeText>
  )
}

/** The colour a destination draws its label in, which its form decides. */
function labelColorOf(
  theme: ResolvedTheme,
  form: NavigationForm,
  isDisabled: boolean,
  selected: boolean,
): string {
  return selected && !isDisabled && form === 'vertical'
    ? theme.colors.secondary
    : iconColorOf(theme, isDisabled, selected)
}

// A label that is a string names its destination; anything else leaves the
// name to `aria-label`.
function nameOf(children: ReactNode): string | undefined {
  return typeof children === 'string' ? children : undefined
}

/**
 * One destination, in the form the bar around it asks for: an icon and a
 * label, and the active indicator behind the icon while it is current. A
 * `tab` reporting whether it is selected.
 */
function NavigationDestination({
  'aria-label': ariaLabel,
  badge,
  children,
  icon,
  isDisabled = false,
  onBlur,
  onFocus,
  onHoverIn,
  onHoverOut,
  onPressIn,
  onPressOut,
  selected,
  style,
  ...props
}: NavigationDestinationProps & { readonly selected: boolean }) {
  const theme = useTheme()
  const { form, measuring } = use(NavigationContext)
  const own = stylesOf(theme)
  const horizontal = form === 'horizontal'
  const feedback = usePressFeedback({
    area: horizontal ? undefined : INDICATOR,
    color: theme.colors.onSecondaryContainer,
    corners: own.pill,
    disabled: isDisabled,
    onBlur,
    onFocus,
    onHoverIn,
    onHoverOut,
    onPressIn,
    onPressOut,
  })
  const content = (
    <DestinationContent
      badge={badge}
      form={form}
      icon={icon}
      isDisabled={isDisabled}
      label={children}
      selected={selected}
    />
  )

  if (measuring) {
    return <View style={own.horizontal}>{content}</View>
  }

  if (horizontal) {
    return (
      <Pressable
        aria-label={ariaLabel ?? nameOf(children)}
        aria-selected={selected}
        hitSlop={hitSlop(PILL_HEIGHT)}
        role="tab"
        {...props}
        {...feedback.handlers}
        disabled={isDisabled}
        style={composeStyles<ViewStyle>(own.horizontal, feedback.ring, style)}
      >
        <ActiveIndicator selected={selected} />
        {feedback.layer}
        {content}
      </Pressable>
    )
  }

  return (
    <Pressable
      aria-label={ariaLabel ?? nameOf(children)}
      aria-selected={selected}
      role="tab"
      {...props}
      {...feedback.handlers}
      disabled={isDisabled}
      style={composeStyles<ViewStyle>(own.vertical, style)}
    >
      <Label form={form} isDisabled={isDisabled} selected={selected}>
        {children}
      </Label>
      <View style={composeStyles<ViewStyle>(own.indicator, feedback.ring)}>
        <ActiveIndicator selected={selected} />
        {feedback.layer}
        {content}
      </View>
    </Pressable>
  )
}

export type {
  NavigationContextValue,
  NavigationDestinationProps,
  NavigationForm,
}

export { iconColorOf, labelColorOf, NavigationContext, NavigationDestination }
