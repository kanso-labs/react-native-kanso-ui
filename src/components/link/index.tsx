import type { ComponentRef, ReactElement, ReactNode, Ref } from 'react'
import type {
  GestureResponderEvent,
  TextProps as NativeTextProps,
  StyleProp,
  TextStyle,
} from 'react-native'

import { isValidElement, useState } from 'react'
import {
  Text as NativeText,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native'

import { hitSlop } from '../../press'
import { stylesOf as ringStylesOf } from '../../press/styles'
import { useLinkPress } from '../../router'
import { withOpacity } from '../../theme/color'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTextLine } from '../../typography/size'

// No Material Design page draws an inline link, so this takes web's reading:
// the text button's label, the primary role on no container, with the
// disabled treatment every page gives content, and a rule under it to say it
// can be followed. That rule is 70% of the primary role, or the outline role
// under `inherit`, and turns fully primary under a pointer. 70% is web's
// figure, the least that keeps the rule at 3:1 against the surface in every
// scheme the library is shown in.
//
// It is a nested Text, so it sets no type of its own and takes the size and
// face of the sentence around it, as web's takes them from its paragraph. A
// nested Text has no frame of its own, so it takes no `hitSlop` either.
//
// Where it departs from web, the platform is the reason:
//
// - The disabled colour is on-surface at the `disabledContent` opacity,
//   translucent over whatever the sentence sits on. Web mixes the two over
//   the surface role, and React Native has no `color-mix()`.
// - Android draws the rule in the text's own colour, since it has no
//   `textDecorationColor`, and every platform draws it at its own thickness
//   and offset, which React Native has no properties for.
// - Hover, the focus ring and the Enter key are the web's alone: a phone has
//   no pointer to hover with and focuses no span inside a sentence, so on
//   native `hover` draws no rule at all. The colour changes at once rather
//   than over a transition.
// - iOS's own pressed highlight is off, since web's link draws no pressed
//   state; `suppressHighlighting={false}` turns it back on.
//
// **A link that is the whole of its Text is drawn as that Text.** Android
// gives a span a node of its own only when it covers part of the text, so a
// lone link, such as one of a row of footer links, was read as plain text.
// The library's Text hands such a link its own props, and the link draws one
// native Text: the sentence's type under the link's colour and rule. Android
// gives a Text no click a screen reader can run, so on iOS and Android the
// role, the name and the press sit on a view around that Text, which reaches
// out to 48dp tall through `hitSlop`, as the library's other controls do. It
// reaches up and down alone, so a press beside it is never taken for it. A
// link that takes no press, one nested in a sentence, and the web's keep
// them on the Text, with no reach.

type LinkProps = Omit<NativeTextProps, 'disabled'> & {
  /**
   * Where the link leads. A press opens it through the `RouterProvider`
   * around the link, or through the platform for a URL with a scheme of its
   * own, after the call site's own `onPress`.
   */
  readonly href?: string
  /**
   * Fades the link to the disabled content colour, and takes no press. It is
   * still announced as a link, a disabled one.
   */
  readonly isDisabled?: boolean
  readonly ref?: Ref<ComponentRef<typeof NativeText>>
  /**
   * Which colour role to render in. `primary` marks the link out from the
   * text around it; `inherit` takes the colour of the Text around it and
   * leans on the underline alone, for a link in a place already understood
   * to be links, such as a footer.
   * @default 'primary'
   */
  readonly tone?: LinkTone
  /**
   * When to draw the rule. Leave it at `always` in prose: without it, colour
   * is the only thing separating the link from the sentence, which some
   * readers cannot see. `hover` and `none` are for links whose position
   * already announces them, such as a row of footer links. A phone has no
   * pointer, so `hover` draws no rule there.
   * @default 'always'
   */
  readonly underline?: LinkUnderline
}

type LinkTone = 'inherit' | 'primary'

type LinkUnderline = 'always' | 'hover' | 'none'

// What React Native Web hands a link's span, which React Native's own Text
// declares little of: the browser's pointer, focus and key events, each typed
// by the fields the link reads, and whether the span takes the Tab key. The
// pointer's type is read off the native event, which is where React Native's
// own pointer events carry it.
type WebProps = {
  readonly focusable: boolean
  readonly onBlur: () => void
  readonly onFocus: (event: {
    readonly currentTarget: { readonly matches: (selector: string) => boolean }
  }) => void
  readonly onKeyDown: (event: {
    readonly currentTarget: { readonly click: () => void }
    readonly key: string
    readonly repeat: boolean
  }) => void
  readonly onPointerEnter: (event: {
    readonly nativeEvent: { readonly pointerType: string }
  }) => void
  readonly onPointerLeave: () => void
}

// React Native's underline is off unless a style turns it on, and a nested
// Text inherits its sentence's, so `hover` and `none` say `none` outright, as
// web's do over an anchor's own underline.
const underlines = StyleSheet.create({
  always: { textDecorationLine: 'underline' },
  hover: { textDecorationLine: 'none' },
  none: { textDecorationLine: 'none' },
})

// The view a lone link reaches out from shrinks in a row, as the Text it
// holds would, so a long link still wraps there.
const own = StyleSheet.create({
  reach: {
    flexShrink: 1,
  },
})

const stylesOf = themedStyles(({ colors, radii, stateLayerOpacity }) => {
  const disabledContent = withOpacity(
    colors.onSurface,
    stateLayerOpacity.disabledContent,
  )

  return StyleSheet.create({
    // The ring's corner on web, where an outline follows it. A nested Text
    // draws no frame on native, so there it draws nothing.
    base: {
      borderRadius: radii.xs,
    },
    disabled: {
      color: disabledContent,
      textDecorationColor: disabledContent,
    },
    // Under a pointer, either tone turns its text and its rule fully primary.
    hovered: {
      color: colors.primary,
      textDecorationColor: colors.primary,
    },
    // No colour, so the Text around it lends its own.
    inherit: {
      textDecorationColor: colors.outline,
    },
    primary: {
      color: colors.primary,
      textDecorationColor: withOpacity(colors.primary, 0.7),
    },
  })
})

/**
 * A run of text that leads somewhere, inside the sentence it belongs to.
 *
 * ```tsx
 * <Text variant="bodyLarge">
 *   Supporting copy with <Link href="/first">a link inside it</Link>.
 * </Text>
 * ```
 *
 * It is React Native's Text with the link role, nested in the library's
 * Text, so it flows and wraps with the words around it and takes their type.
 * Given no Text around it, it draws in the platform's default face rather
 * than the theme's, so a link standing on its own, such as one of a row of
 * footer links, is a Text holding one link.
 *
 * `onPress` fires for a tap, a click and the Enter key alike, then `href` is
 * followed, through the `RouterProvider` around the link or the platform.
 * `style`, `ref` and `testID` land on React Native's own Text.
 */
function Link(props: LinkProps) {
  return <NativeText {...useLink(props).text} />
}

/**
 * A link drawn as the Text that holds it: the Text's own props and style
 * under the link's, and the link's children as the Text has wrapped them.
 */
function LoneLink({
  children,
  link,
  ...sentence
}: NativeTextProps & {
  readonly children: ReactNode
  readonly link: LinkProps
  readonly ref?: Ref<ComponentRef<typeof NativeText>>
}) {
  const { fontScale } = useWindowDimensions()
  const nested = useTextLine() !== undefined
  const { press, text } = useLink(link, sentence.style)

  if (Platform.OS === 'web' || nested || press === undefined) {
    return (
      <NativeText {...sentence} {...text}>
        {children}
      </NativeText>
    )
  }

  const lineHeight = StyleSheet.flatten(sentence.style)?.lineHeight ?? 0

  // The view is the link, so the Text inside it only draws.
  return (
    <Pressable
      accessibilityLabel={
        text.accessibilityLabel ?? sentence.accessibilityLabel
      }
      aria-label={text['aria-label'] ?? sentence['aria-label']}
      hitSlop={hitSlop(lineHeight * fontScale)}
      onPress={press}
      role="link"
      style={own.reach}
    >
      <NativeText
        {...sentence}
        {...text}
        accessibilityLabel={undefined}
        aria-disabled={undefined}
        aria-label={undefined}
        onPress={undefined}
        role={undefined}
      >
        {children}
      </NativeText>
    </Pressable>
  )
}

/**
 * The link a Text holds as its only child, which it then draws as itself, or
 * `undefined` for any other children.
 */
function loneLinkOf(children: ReactNode): ReactElement<LinkProps> | undefined {
  return isValidElement<LinkProps>(children) && children.type === Link
    ? children
    : undefined
}

/**
 * A link's press, `undefined` while it takes none, and the props its native
 * Text is drawn with, over the type of the sentence it stands for when it is
 * the whole of one.
 */
function useLink(
  {
    href,
    isDisabled = false,
    onPress,
    style,
    suppressHighlighting = true,
    tone = 'primary',
    underline = 'always',
    ...props
  }: LinkProps,
  sentence?: StyleProp<TextStyle>,
): {
  readonly press: ((event: GestureResponderEvent) => void) | undefined
  readonly text: NativeTextProps & {
    readonly ref?: Ref<ComponentRef<typeof NativeText>>
  }
} {
  const theme = useTheme()
  const press = useLinkPress(href, onPress)
  const [hoveredState, setHovered] = useState(false)
  const [ringShown, setRingShown] = useState(false)

  const styles = stylesOf(theme)
  const hovered = !isDisabled && hoveredState
  const pressable = !isDisabled && (href !== undefined || onPress != null)
  const web =
    Platform.OS === 'web'
      ? webPropsOf(isDisabled, setHovered, setRingShown)
      : undefined

  return {
    press: pressable ? press : undefined,
    text: {
      ...props,
      ...web,
      'aria-disabled': isDisabled,
      onPress: pressable ? press : undefined,
      role: 'link',
      style: composeStyles<TextStyle>(
        sentence,
        styles.base,
        styles[tone],
        underlines[underline],
        hovered && styles.hovered,
        hovered && underline === 'hover' && underlines.always,
        isDisabled && styles.disabled,
        !isDisabled && ringShown && ringStylesOf(theme).ring,
        style,
      ),
      suppressHighlighting,
    },
  }
}

// The browser's events, read into the link's two states. Hover counts a mouse
// or a pen and never a touch, which leaves a tapped link's emulated pointer
// over it, as React Aria's hover does on web. The ring follows the browser's
// own `:focus-visible`, the rule web's ring is drawn under, read as focus
// arrives. Enter clicks the span, which is what a browser does for an
// anchor and what React Native Web hands to `onPress`; a key held down
// follows the link once.
function webPropsOf(
  isDisabled: boolean,
  setHovered: (hovered: boolean) => void,
  setRingShown: (shown: boolean) => void,
): WebProps {
  return {
    focusable: !isDisabled,
    onBlur: () => {
      setRingShown(false)
    },
    onFocus: (event) => {
      setRingShown(event.currentTarget.matches(':focus-visible'))
    },
    onKeyDown: (event) => {
      if (!isDisabled && event.key === 'Enter' && !event.repeat) {
        event.currentTarget.click()
      }
    },
    onPointerEnter: (event) => {
      setHovered(event.nativeEvent.pointerType !== 'touch')
    },
    onPointerLeave: () => {
      setHovered(false)
    },
  }
}

export type { LinkProps, LinkTone, LinkUnderline }

export { Link, LoneLink, loneLinkOf }
