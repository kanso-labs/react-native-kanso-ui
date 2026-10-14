import type { ReactNode, Ref } from 'react'
import type {
  PressableProps,
  StyleProp,
  ViewProps,
  ViewStyle,
} from 'react-native'

import { Pressable, StyleSheet, View } from 'react-native'

import { usePressFeedback } from '../../press'
import { useLinkPress } from '../../router'
import { withOpacity } from '../../theme/color'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// The cards spec page's three variants, as kanso-ui's Card draws them. They
// differ only in how they separate themselves from the page: elevated casts
// the level 1 shadow over the low container, filled sits on the highest
// container, and outlined draws an outline-variant rule over the surface. The
// corner is the page's 12dp, the medium shape, and content runs 16dp in from
// it unless `padding` is `none`.
//
// An interactive card draws the state layers, the ripple and the focus ring
// from src/press, in on-surface, the colour web mixes over its container.
// They lie over the card's content rather than under it, so a child that
// fills the card, an image or a row with a fill of its own, still shows the
// press. Under a pointer the elevated card rises to level 2 and settles back
// to 1 while pressed, as the page and web have it, and switches at once, since
// web's runs no transition either; the other two stay flat. A phone has no
// pointer, so there the press itself is what shows.
//
// Disabled is the page's: each container at 38%, the outlined card's rule
// in the outline role at 12%, what the card holds faded to 38%, and the
// elevated card flat. A card's content is the call site's, so no colour role
// reaches all of it, and an opacity is the one fade that does.

type CardBaseProps = {
  readonly children?: ReactNode
  /**
   * Turns an interactive card off: it fades as the cards page draws a
   * disabled card, and takes no press. It is still announced, as disabled.
   * Has no effect on a card that is not `interactive`, which cannot be
   * pressed to begin with.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * `none` removes the card's own padding, for a card whose children run to
   * its edges, such as a list of rows separated by rules.
   * @default 'default'
   */
  readonly padding?: 'default' | 'none'
  readonly ref?: Ref<View>
  readonly style?: StyleProp<ViewStyle>
  /**
   * How the card separates itself from the page: `elevated` casts a shadow,
   * `filled` sits on a darker surface, `outlined` draws a border.
   * @default 'elevated'
   */
  readonly variant?: CardVariant
}

type CardProps = CardBaseProps & (InteractiveCardForm | StaticCardForm)

type CardVariant = 'elevated' | 'filled' | 'outlined'

/**
 * A card that presses as a whole: a `Pressable` announced as a button, or as
 * a link given `href`.
 */
type InteractiveCardForm = Omit<
  PressableProps,
  'children' | 'disabled' | 'style'
> & {
  /**
   * Where the card leads. A press opens it through the `RouterProvider`
   * around the card, or through the platform for a URL with a scheme of its
   * own, after the call site's own `onPress`, and the card is announced as a
   * link.
   */
  readonly href?: string
  /**
   * Makes the card the thing you press: it ripples, draws the state layers,
   * lifts under a pointer and takes a focus ring. Leave it off for a card
   * that merely holds content, including one holding buttons of its own.
   */
  readonly interactive: true
}

/** A card that holds content and takes no press: a `View` with no role. */
type StaticCardForm = Omit<ViewProps, 'children' | 'style'> & {
  readonly href?: never
  readonly interactive?: false
  readonly onPress?: never
}

const paddings = themedStyles(({ spacing }) =>
  StyleSheet.create({
    default: { padding: spacing.lg },
    none: { padding: 0 },
  }),
)

const stylesOf = themedStyles(({ colors, radii, shadows }) =>
  StyleSheet.create({
    // The corner clips what the card holds, so a child running to the edges
    // is rounded with it. The shadow and the focus ring are drawn outside the
    // card and are not clipped.
    base: {
      borderRadius: radii.md,
      overflow: 'hidden',
    },
    elevated: {
      backgroundColor: colors.surfaceContainerLow,
    },
    filled: {
      backgroundColor: colors.surfaceContainerHighest,
    },
    // Under a pointer, the elevated card's level 2.
    lifted: {
      boxShadow: shadows.elevation2,
    },
    outlined: {
      backgroundColor: colors.surface,
      borderColor: colors.outlineVariant,
      borderWidth: 1,
    },
    // The elevated card's level 1, which no other variant casts.
    resting: {
      boxShadow: shadows.elevation1,
    },
  }),
)

const disabledStylesOf = themedStyles(({ colors, stateLayerOpacity }) =>
  StyleSheet.create({
    content: {
      opacity: stateLayerOpacity.disabledContent,
    },
    elevated: {
      backgroundColor: withOpacity(
        colors.surfaceContainerLow,
        stateLayerOpacity.disabledContent,
      ),
    },
    filled: {
      backgroundColor: withOpacity(
        colors.surfaceContainerHighest,
        stateLayerOpacity.disabledContent,
      ),
    },
    outlined: {
      borderColor: withOpacity(
        colors.outline,
        stateLayerOpacity.disabledContainer,
      ),
    },
  }),
)

const styles = StyleSheet.create({
  // What an interactive card's children sit in, filling a card stretched
  // taller than them, as a static card's children are laid out in the card
  // itself. It is what fades while disabled, apart from the container.
  content: {
    flexGrow: 1,
  },
})

/**
 * A surface holding related content.
 *
 * ```tsx
 * <Card interactive onPress={open}>
 *   <Text variant="titleMedium">Headline</Text>
 * </Card>
 * ```
 *
 * A card is a `View` with no role, unless it is `interactive`: then it is a
 * `Pressable` announced as a button, or as a link given `href`, which presses
 * as a whole. Web's `render` has no counterpart, since native has no element
 * to choose, and `href` is how a card leads somewhere instead. The press
 * props belong to an interactive card alone, so a static card given
 * `onPress` is a compile error rather than a press that never fires.
 *
 * A card fills the column it sits in, as any view in a React Native column
 * does. `style`, `ref` and `testID` land on the card's own view.
 */
function Card(props: CardProps) {
  return props.interactive === true ? (
    <InteractiveCard {...props} />
  ) : (
    <StaticCard {...props} />
  )
}

function InteractiveCard({
  children,
  href,
  interactive: _interactive,
  isDisabled = false,
  onBlur,
  onFocus,
  onHoverIn,
  onHoverOut,
  onPress,
  onPressIn,
  onPressOut,
  padding = 'default',
  style,
  variant = 'elevated',
  ...props
}: CardBaseProps & InteractiveCardForm) {
  const theme = useTheme()
  const press = useLinkPress(href, onPress)
  const feedback = usePressFeedback({
    color: theme.colors.onSurface,
    disabled: isDisabled,
    onBlur,
    onFocus,
    onHoverIn,
    onHoverOut,
    onPressIn,
    onPressOut,
  })

  const own = stylesOf(theme)
  const disabled = disabledStylesOf(theme)
  const lifted = feedback.hovered && !feedback.pressed

  return (
    <Pressable
      role={href === undefined ? 'button' : 'link'}
      {...props}
      {...feedback.handlers}
      disabled={isDisabled}
      onPress={press}
      style={composeStyles<ViewStyle>(
        own.base,
        own[variant],
        paddings(theme)[padding],
        variant === 'elevated' && !isDisabled
          ? own[lifted ? 'lifted' : 'resting']
          : undefined,
        isDisabled && disabled[variant],
        feedback.ring,
        style,
      )}
    >
      <View
        style={composeStyles<ViewStyle>(
          styles.content,
          isDisabled && disabled.content,
        )}
      >
        {children}
      </View>
      {feedback.layer}
    </Pressable>
  )
}

function StaticCard({
  interactive: _interactive,
  isDisabled: _isDisabled,
  padding = 'default',
  style,
  variant = 'elevated',
  ...props
}: CardBaseProps & StaticCardForm) {
  const theme = useTheme()
  const own = stylesOf(theme)

  return (
    <View
      {...props}
      style={composeStyles<ViewStyle>(
        own.base,
        own[variant],
        variant === 'elevated' ? own.resting : undefined,
        paddings(theme)[padding],
        style,
      )}
    />
  )
}

export type { CardProps, CardVariant }

export { Card }
