import type { ComponentRef, ReactNode, Ref } from 'react'
import type {
  PressableProps,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'

import { Text as NativeText, StyleSheet, View } from 'react-native'

import type { ButtonLinkForm, ButtonPressForm } from '../../button'
import type { FabSize, FabTone, FabVariant } from '../../fab'
import type { IconStyle } from '../../glyphs/icon-style'

import {
  AnimatedPressable,
  buttonStyles,
  useButtonAction,
  useSlotTrigger,
} from '../../button'
import {
  EXTENDED_FAB_ROLES,
  extendedFabSizesOf,
  FAB_ICON_SIZES,
  fabCornersOf,
  fabPalettesOf,
  fabShadowOf,
  fabSizesOf,
} from '../../fab'
import { IconStyleContext } from '../../glyphs/icon-style'
import { usePressFeedback } from '../../press'
import { useTheme } from '../../theme/scope'
import { composeStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// kanso-ui's Fab: the FAB page's floating action button, and the extended
// FAB page's form of it with a label. A screen's primary action, raised over
// the content on the pages' level 3 shadow and lifted to level 4 under a
// hovering pointer, which is an iPad's or an Android mouse's, since a finger
// never hovers.
//
// Three sizes, the pages' FAB, medium FAB and large FAB: `md` is 56dp with a
// 24dp icon and a 16dp corner, `lg` 80dp with 28dp and 20dp, and `xl` 96dp
// with 36dp and 28dp. The extended form keeps the size's height and corner
// and sets a label after the icon in the size's type role, title medium,
// title large and headline small, with 16dp, 26dp and 28dp of padding and
// 8dp, 12dp and 16dp before the label. The 80dp size, the 20dp corner and
// the 26dp and 28dp paddings fall between steps of their scales and are
// written out. The pages' small FAB is gone from the newer set, so there is
// no `xs`.
//
// Six colour pairs, by `tone` and `variant`: `tonal` draws the tone's
// container pair, primary container being the pages' default, and `filled`
// the tone itself, as Button's two variants of those names do.
//
// The hover, focus and pressed layers and the ripple are src/press's, in the
// icon's colour over the container, as Button's are. The pages give no
// disabled FAB; a disabled one takes the container every disabled button
// takes, on-surface at the two disabled opacities, and drops its shadow.
//
// Unlike Button, the corner does not morph: the pages draw the FAB at one
// shape in every state, as web does. Web's forced-colours rule has no
// counterpart on iOS or Android and is not drawn.
//
// It is placed as any view is. A column stretches the extended form as it
// does a Button, so a FAB floating over a screen takes its place from the
// call site's `style`.
//
// What a press does, the link form and the slot it fills in an overlay are
// src/button's, shared with Button and IconButton. The metrics and colours
// are src/fab's, shared with FabMenu's FAB.

type FabNaming =
  | {
      /**
       * What the FAB does, in words. A FAB without a `label` is an icon
       * alone, which has no name of its own, so it needs this; with a
       * `label` the label is its name.
       */
      readonly 'aria-label': string
      readonly label?: never
    }
  | {
      readonly 'aria-label'?: string
      /**
       * A label after the icon, which makes this the extended FAB: as tall
       * as the size, as wide as what it holds.
       */
      readonly label: ReactNode
    }

// A plain button's form, without the pending state web's FAB leaves out.
// The two are named `never`, so a FAB given them does not compile.
type FabPressForm = Omit<ButtonPressForm, 'isPending' | 'pendingLabel'> & {
  readonly isPending?: never
  readonly pendingLabel?: never
}

type FabProps = (ButtonLinkForm | FabPressForm) &
  FabNaming &
  Omit<PressableProps, 'aria-label' | 'children' | 'disabled' | 'style'> & {
    /**
     * The FAB's icon. The FAB hands it its colour and the size's icon size
     * through `useIconStyle()`.
     */
    readonly children?: ReactNode
    /**
     * Draws no press ripple. The state layers are unaffected.
     * @default false
     */
    readonly disableRipple?: boolean
    /**
     * Draws the FAB disabled, without its shadow, and takes no presses.
     * @default false
     */
    readonly isDisabled?: boolean
    readonly ref?: Ref<ComponentRef<typeof View>>
    /**
     * The pages' three sizes: `md` the FAB at 56dp, `lg` the medium FAB at
     * 80dp and `xl` the large FAB at 96dp.
     * @default 'md'
     */
    readonly size?: FabSize
    readonly style?: StyleProp<ViewStyle>
    /**
     * The colour role the FAB is drawn in.
     * @default 'primary'
     */
    readonly tone?: FabTone
    /**
     * `tonal` draws the tone's container pair, the pages' default; `filled`
     * draws the tone itself.
     * @default 'tonal'
     */
    readonly variant?: FabVariant
  }

const styles = StyleSheet.create({
  // The icon and the label sit in the middle of the container, and a row
  // never squeezes it.
  base: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    justifyContent: 'center',
  },
  icon: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
  },
})

/**
 * A screen's primary action, raised over its content. Its icon is its
 * children; given a `label` it is the extended FAB, with the label after the
 * icon. Given `href` it is a link with the same appearance.
 *
 * ```tsx
 * <Fab aria-label="Label">
 *   <PlusIcon />
 * </Fab>
 * ```
 *
 * Without a `label` it is an icon alone, so `aria-label` is required there.
 * `style`, `ref` and `testID` land on the `Pressable`, which is what a call
 * site positions over its screen.
 */
function Fab({
  accessibilityHint,
  children,
  delayLongPress,
  disableRipple = false,
  href,
  isDisabled = false,
  label,
  onBlur,
  onFocus,
  onHoverIn,
  onHoverOut,
  onLongPress,
  onPress,
  onPressIn,
  onPressOut,
  ref,
  size = 'md',
  slot,
  style,
  tone = 'primary',
  type,
  variant = 'tonal',
  ...props
}: FabProps) {
  const theme = useTheme()
  const role = useTypeRole(EXTENDED_FAB_ROLES[size])
  const action = useButtonAction({
    defaultSelected: undefined,
    href,
    isSelected: undefined,
    isToggle: false,
    onChange: undefined,
    onPress,
    slot: slot ?? 'default',
    type,
  })
  const {
    onHoverIn: hoverIn,
    onHoverOut: hoverOut,
    onLongPress: longPress,
    onPressIn: pressIn,
    onPressOut: pressOut,
    ...triggerProps
  } = useSlotTrigger({
    accessibilityHint,
    delayLongPress,
    href,
    onHoverIn,
    onHoverOut,
    onLongPress,
    onPressIn,
    onPressOut,
    ref,
    slot,
  })
  const palettes = fabPalettesOf(theme)
  const colors = isDisabled ? palettes.disabled : palettes[variant][tone]
  const feedback = usePressFeedback({
    color: colors.content,
    disabled: isDisabled,
    disableRipple,
    onBlur,
    onFocus,
    onHoverIn: hoverIn,
    onHoverOut: hoverOut,
    onPressIn: pressIn,
    onPressOut: pressOut,
  })
  const corner = fabCornersOf(theme)[size]
  const isExtended = label !== undefined

  return (
    <AnimatedPressable
      role={href === undefined ? 'button' : 'link'}
      {...props}
      {...triggerProps}
      {...feedback.handlers}
      disabled={isDisabled}
      onLongPress={longPress}
      onPress={action.onPress}
      style={composeStyles<AnimatedStyle<ViewStyle>>(
        styles.base,
        isExtended ? extendedFabSizesOf(theme)[size] : fabSizesOf(theme)[size],
        corner,
        colors.container,
        fabShadowOf(feedback, isDisabled, theme),
        feedback.ring,
        style,
      )}
    >
      <View style={composeStyles<ViewStyle>(buttonStyles.clip, corner)}>
        {feedback.layer}
      </View>
      {children === undefined ? null : (
        <View style={styles.icon}>
          <IconStyleContext value={iconStyleOf(colors.content, size)}>
            {children}
          </IconStyleContext>
        </View>
      )}
      {isExtended ? (
        <NativeText
          style={composeStyles<TextStyle>(role, styles.label, colors.label)}
        >
          {label}
        </NativeText>
      ) : null}
    </AnimatedPressable>
  )
}

function iconStyleOf(color: string, size: FabSize): IconStyle {
  return { color, size: FAB_ICON_SIZES[size] }
}

export { Fab }
export type { FabProps, FabSize, FabTone, FabVariant }
