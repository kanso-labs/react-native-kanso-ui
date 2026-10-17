import type { ComponentRef, ReactNode, Ref, RefObject } from 'react'
import type {
  GestureResponderEvent,
  HostInstance,
  PressableProps,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { Key, Node } from 'react-stately'
import type { TreeProps, TreeState } from 'react-stately/useTreeState'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  I18nManager,
  Text as NativeText,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useMenuTriggerState } from 'react-stately/useMenuTriggerState'
import { useTreeState } from 'react-stately/useTreeState'

import type { FabSize, FabTone } from '../../fab'
import type { IconStyle } from '../../glyphs/icon-style'

import { AnimatedPressable, buttonStyles } from '../../button'
import {
  FAB_ICON_SIZES,
  fabColorsOf,
  fabCornersOf,
  fabPalettesOf,
  fabShadowOf,
  fabSizesOf,
} from '../../fab'
import { CloseGlyph } from '../../glyphs'
import { IconStyleContext } from '../../glyphs/icon-style'
import { Overlay, useAnchoredPlacement } from '../../overlay'
import {
  DismissLayer,
  useBackToClose,
  useFocusOnPlaced,
  useReturnFocus,
} from '../../overlay/panel'
import { usePressFeedback } from '../../press'
import { refsOf } from '../../ref'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// kanso-ui's FabMenu: the FAB menu page's menu, a FAB that opens two to six
// related actions floating above it, in place of a speed dial. Open, the FAB
// becomes the menu's close button, the page's 56dp circle in the tone itself
// with a 20dp close mark, and the actions stand in a column 8dp above it,
// lined up on its trailing edge: each a 56dp pill on the tone's container
// pair with 24dp at either end, a 24dp icon 8dp before a title-medium label,
// 4dp apart and raised on the level 3 shadow, lifted to level 4 under a
// hovering pointer as Fab is. The three tones are the page's three colour
// sets: the close button takes the tone and the actions its container, so
// the two contrast as the page draws them.
//
// The FAB is the menu's own rather than a child the call site places, as on
// web, because what it draws depends on whether the menu is open. Closed, it
// is Fab at any of its sizes, from src/fab's metrics and colours. As the menu
// opens, its width, height, corner and container ease to the close button's
// over the medium1 duration on the emphasised curve, and back as it closes.
// The icon is swapped for the close mark at once, in the colour drawn on the
// container it is easing to. Under reduced motion the change is made at once.
//
// The actions are a collection, built by React Stately's tree state as
// Menu's items are, so `FabMenu.Item` renders nothing on its own. They are
// drawn in the overlay host above the screen with src/overlay's anchored
// placement, on the FAB's top side at its end, and rise 8dp into place over
// the short3 duration on the emphasised decelerating curve, at once under
// reduced motion. As on web, they leave at once.
//
// They are placed against the close button rather than against the FAB that
// opens them. A FAB opening a menu sits in its screen's bottom trailing
// corner, so the 80 and 96dp sizes shrink into that corner, and the actions
// stand 8dp above the 56dp circle they shrink to rather than above where the
// larger FAB was.
//
// A press outside the actions lands on the dismiss layer under them and
// closes the menu, as does a press on the close button, which that layer
// covers. Android's back gesture and VoiceOver's escape gesture close it
// too. A press on an action runs it and closes the menu. A screen reader is
// sent to the first action that takes a press once they are placed, and back
// to the FAB once they have gone, and the FAB reports whether its menu is
// expanded. Web's arrow keys between the actions need a hardware keyboard,
// which this pass leaves out, as Menu does. Web's forced-colours rules have
// no counterpart on iOS or Android and are not drawn.

// The close mark at the page's 20dp.
const CLOSE_SIZE = 20

// How far below its place the column starts as it arrives, web's keyframes'.
const RISE_FROM = 8

// React Native Web writes `aria-haspopup` onto the element, which React
// Native's types do not name.
const HAS_MENU: { readonly 'aria-haspopup': 'menu' } = {
  'aria-haspopup': 'menu',
}

// Hoisted so it is one stable element per render, which is what react-perf's
// no-jsx-as-prop is after.
const CLOSE = <CloseGlyph />

type FabMenuItemProps = Omit<
  PressableProps,
  'children' | 'disabled' | 'id' | 'role' | 'style'
> & {
  /** The action's name, drawn as its label. */
  readonly children: ReactNode
  /**
   * An icon before the label, which takes the label's colour at the page's
   * 24dp through `useIconStyle()`.
   */
  readonly icon?: ReactNode
  /**
   * The key the action is reported by. Give one to every action the call
   * site needs to tell apart.
   */
  readonly id?: Key
  /**
   * Draws the action disabled, without its shadow, and takes no presses on
   * it.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * Called when a press runs the action, in place of the menu's `onAction`
   * for this one.
   */
  readonly onAction?: () => void
  readonly ref?: Ref<HostInstance>
  readonly style?: StyleProp<ViewStyle>
  /**
   * The action's text, read off `children` when they are a plain string, so
   * an action whose label is an element passes it.
   */
  readonly textValue?: string
}

type FabMenuProps = {
  /**
   * What the FAB does, in words: an icon alone has no name, and the menu
   * takes its name from the FAB that opens it.
   */
  readonly 'aria-label': string
  /** The actions, as `FabMenu.Item`s. The page asks for two to six. */
  readonly children: ReactNode
  /**
   * Whether the menu starts open, when it keeps its own state.
   * @default false
   */
  readonly defaultOpen?: boolean
  /**
   * The FAB's icon while the menu is closed. The FAB hands it its colour and
   * the size's icon size through `useIconStyle()`.
   */
  readonly icon: ReactNode
  /** Whether the menu is open, when the call site holds the state. */
  readonly isOpen?: boolean
  /** Called with an action's `id` when a press runs it. */
  readonly onAction?: (key: Key) => void
  /** Called with the new state as the menu opens or closes. */
  readonly onOpenChange?: (isOpen: boolean) => void
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * The FAB's size while the menu is closed, as Fab's: `md` 56dp, `lg` 80dp
   * or `xl` 96dp. Open, it is the close button's 56dp whatever it was.
   * @default 'md'
   */
  readonly size?: FabSize
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
  /**
   * The page's three colour sets: the close button takes the tone and the
   * actions its container pair.
   * @default 'primary'
   */
  readonly tone?: FabTone
}

const styles = StyleSheet.create({
  // The icon sits in the middle of the FAB, and a row never squeezes it.
  base: {
    alignItems: 'center',
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

const stylesOf = themedStyles(({ radii, sizing, spacing }) =>
  StyleSheet.create({
    // An action: a pill as tall as the close button, its icon 8dp before the
    // label, 24dp in from either end. Its height is a floor, so a label the
    // device's text size enlarges grows the pill rather than spilling out.
    action: {
      alignItems: 'center',
      columnGap: spacing.sm,
      flexDirection: 'row',
      minHeight: sizing.controlLg,
      minWidth: sizing.controlLg,
      paddingHorizontal: spacing.xl,
    },
    corner: {
      borderRadius: radii.pill,
    },
    // The actions in a column on the FAB's trailing edge, 4dp apart.
    menu: {
      alignItems: 'flex-end',
      rowGap: spacing.xs,
    },
  }),
)

/**
 * A FAB that opens a column of related actions above it, and closes them
 * again. The actions are `FabMenu.Item`s.
 *
 * ```tsx
 * <FabMenu aria-label="Label" icon={<PlusIcon />}>
 *   <FabMenu.Item icon={<FirstIcon />} id="first">
 *     First item
 *   </FabMenu.Item>
 *   <FabMenu.Item icon={<SecondIcon />} id="second">
 *     Second item
 *   </FabMenu.Item>
 * </FabMenu>
 * ```
 *
 * `style`, `ref` and `testID` land on the FAB, which is what a call site
 * positions over its screen.
 */
function FabMenu({
  'aria-label': label,
  children,
  defaultOpen,
  icon,
  isOpen,
  onAction,
  onOpenChange,
  ref,
  size = 'md',
  style,
  testID,
  tone = 'primary',
}: FabMenuProps) {
  const theme = useTheme()
  const state = useMenuTriggerState({ defaultOpen, isOpen, onOpenChange })
  const open = state.isOpen
  const fab = useRef<HostInstance>(null)
  const anchor = useCloseButtonAnchor(fab, theme.sizing.controlLg)
  const { content } = fabColorsOf(theme)[open ? 'filled' : 'tonal'][tone]
  const feedback = usePressFeedback({ color: content })
  const morph = useCloseMorph(open, size, tone)
  const toggle = useCallback(() => {
    state.toggle()
  }, [state])
  const close = useCallback(() => {
    state.close()
  }, [state])

  useReturnFocus(open, false, fab)

  return (
    <>
      <AnimatedPressable
        {...HAS_MENU}
        aria-expanded={open}
        aria-label={label}
        role="button"
        testID={testID}
        {...feedback.handlers}
        onPress={toggle}
        ref={refsOf<HostInstance>(fab, ref)}
        style={composeStyles<AnimatedStyle<ViewStyle>>(
          styles.base,
          morph.container,
          fabShadowOf(feedback, false, theme),
          feedback.ring,
          style,
        )}
      >
        <Animated.View
          style={composeStyles<AnimatedStyle<ViewStyle>>(
            buttonStyles.clip,
            morph.clip,
          )}
        >
          {feedback.layer}
        </Animated.View>
        <View style={styles.icon}>
          <IconStyleContext
            value={iconStyleOf(
              content,
              open ? CLOSE_SIZE : FAB_ICON_SIZES[size],
            )}
          >
            {open ? CLOSE : icon}
          </IconStyleContext>
        </View>
      </AnimatedPressable>
      {open ? (
        <Overlay>
          <FabMenuPanel
            anchor={anchor}
            close={close}
            label={label}
            onAction={onAction}
            tone={tone}
          >
            {children}
          </FabMenuPanel>
        </Overlay>
      ) : null}
    </>
  )
}

/**
 * One action: a pill holding an icon and a label, on the menu's tone. A press
 * on it runs it and closes the menu.
 *
 * The menu draws it from its entry in the collection, so it renders nothing
 * on its own. `style`, `ref` and `testID` land on the pill.
 */
function FabMenuItem(_props: FabMenuItemProps): null {
  return null
}

// The entry the collection holds for an action, as React Stately's own
// `Item` gives one: keyed by the action's `id`, and carrying the props the
// pill is drawn from.
FabMenuItem.getCollectionNode = function* getCollectionNode(
  props: FabMenuItemProps,
) {
  yield {
    hasChildNodes: false,
    key: props.id,
    props,
    rendered: props.children,
    textValue:
      props.textValue ??
      (typeof props.children === 'string' ? props.children : ''),
    type: 'item',
  }
}

/** An action's pill, drawn from its entry in the collection. */
function FabMenuAction({
  activate,
  isDisabled,
  node,
  setFocusTarget,
  tone,
}: {
  readonly activate: (node: Node<object>) => void
  readonly isDisabled: boolean
  readonly node: Node<object>
  /** Keeps the pill a screen reader is sent to as the menu opens. */
  readonly setFocusTarget: ((target: HostInstance | null) => void) | undefined
  readonly tone: FabTone
}) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const role = useTypeRole('titleMedium')
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- a node carries the props its action was written with, which React Stately types as `any`
  const {
    children,
    icon,
    id: _id,
    isDisabled: _isDisabled,
    onAction: _onAction,
    onBlur,
    onFocus,
    onHoverIn,
    onHoverOut,
    onPress,
    onPressIn,
    onPressOut,
    ref,
    style,
    textValue: _textValue,
    ...props
  }: FabMenuItemProps = node.props
  const palettes = fabPalettesOf(theme)
  const colors = isDisabled ? palettes.disabled : palettes.tonal[tone]
  const feedback = usePressFeedback({
    color: colors.content,
    corners: own.corner,
    disabled: isDisabled,
    onBlur,
    onFocus,
    onHoverIn,
    onHoverOut,
    onPressIn,
    onPressOut,
  })

  return (
    <Pressable
      role="menuitem"
      {...props}
      {...feedback.handlers}
      disabled={isDisabled}
      onPress={pressThen(onPress, activate, node)}
      ref={refsOf(setFocusTarget, ref)}
      style={composeStyles<ViewStyle>(
        own.action,
        own.corner,
        colors.container,
        fabShadowOf(feedback, isDisabled, theme),
        feedback.ring,
        style,
      )}
    >
      {feedback.layer}
      {icon === undefined ? null : (
        <View style={styles.icon}>
          <IconStyleContext
            value={iconStyleOf(colors.content, FAB_ICON_SIZES.md)}
          >
            {icon}
          </IconStyleContext>
        </View>
      )}
      <NativeText
        numberOfLines={1}
        style={composeStyles<TextStyle>(role, styles.label, colors.label)}
      >
        {children}
      </NativeText>
    </Pressable>
  )
}

/**
 * The open menu: the dismiss layer, then the column of actions, placed above
 * the close button's end and risen into place once it has been.
 */
function FabMenuPanel({
  anchor,
  children,
  close,
  label,
  onAction,
  tone,
}: {
  readonly anchor: RefObject<Pick<HostInstance, 'measureInWindow'>>
  readonly children: ReactNode
  readonly close: () => void
  readonly label: string
  readonly onAction: ((key: Key) => void) | undefined
  readonly tone: FabTone
}) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const state = useTreeState<object>({
    // Each action builds its own entry in the collection; see
    // `FabMenuItem.getCollectionNode`. The collection skips what is not an
    // element, as a ReactNode may be, and asks any element for its entry.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    children: children as TreeProps<object>['children'],
  })
  const placement = useAnchoredPlacement({
    align: 'end',
    anchor,
    side: 'top',
    sideOffset: theme.spacing.sm,
  })
  const rise = useRiseIn(placement.placed)
  const [focusTarget, setFocusTarget] = useState<HostInstance | null>(null)
  const focusKey = firstActionKey(state)
  const activate = useCallback(
    (node: Node<object>) => {
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- a node carries the props its action was written with, which React Stately types as `any`
      const action: FabMenuItemProps = node.props

      if (action.onAction === undefined) {
        onAction?.(node.key)
      } else {
        action.onAction()
      }
      close()
    },
    [close, onAction],
  )

  useBackToClose(close, true)
  useFocusOnPlaced(placement.placed, focusTarget)

  return (
    <>
      <DismissLayer onPress={close} />
      <Animated.View
        aria-label={label}
        onAccessibilityEscape={close}
        onLayout={placement.onLayout}
        role="menu"
        style={composeStyles<AnimatedStyle<ViewStyle>>(
          own.menu,
          placement.style,
          rise,
        )}
      >
        {[...state.collection].map((node) => (
          <FabMenuAction
            activate={activate}
            isDisabled={state.selectionManager.isDisabled(node.key)}
            key={node.key}
            node={node}
            setFocusTarget={node.key === focusKey ? setFocusTarget : undefined}
            tone={tone}
          />
        ))}
      </Animated.View>
    </>
  )
}

/** The first action a press reaches, which a screen reader is sent to. */
function firstActionKey(state: TreeState<object>) {
  for (const key of state.collection.getKeys()) {
    if (!state.selectionManager.isDisabled(key)) {
      return key
    }
  }

  return null
}

function iconStyleOf(color: string, size: number): IconStyle {
  return { color, size }
}

/**
 * The press handler of an action: the call site's own `onPress`, then the
 * action's activation. Built by a call rather than written inline at the
 * prop, which is what react-perf's no-new-function-as-prop is after.
 */
function pressThen(
  onPress: PressableProps['onPress'],
  activate: (node: Node<object>) => void,
  node: Node<object>,
) {
  return (event: GestureResponderEvent) => {
    onPress?.(event)
    activate(node)
  }
}

/**
 * The close button the FAB becomes, for the actions to be placed against: a
 * square of the close button's edge in the FAB's bottom trailing corner, read
 * off the FAB wherever in its change it is when it is measured.
 */
function useCloseButtonAnchor(
  fab: RefObject<HostInstance | null>,
  edge: number,
) {
  return useMemo<RefObject<Pick<HostInstance, 'measureInWindow'>>>(
    () => ({
      current: {
        measureInWindow: (callback) => {
          fab.current?.measureInWindow((x, y, width, height) => {
            callback(
              I18nManager.isRTL ? x : x + width - edge,
              y + height - edge,
              edge,
              edge,
            )
          })
        },
      },
    }),
    [edge, fab],
  )
}

/**
 * The FAB's change into the close button and back: its width, height,
 * corner and container eased to the state's over medium1 on the emphasised
 * curve, at once under reduced motion. The corner is returned twice, for the
 * container and for the clip its press feedback is drawn in.
 */
function useCloseMorph(isOpen: boolean, size: FabSize, tone: FabTone) {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const { motion, sizing } = theme
  const edge = isOpen ? sizing.controlLg : fabSizesOf(theme)[size].width
  const corner = isOpen
    ? sizing.controlLg / 2
    : fabCornersOf(theme)[size].borderRadius
  const fill = fabColorsOf(theme)[isOpen ? 'filled' : 'tonal'][tone].container
  const timing = {
    duration: motion.durationMedium1,
    easing: Easing.bezier(...motion.easingEmphasized),
  }

  const container = useAnimatedStyle(() => {
    'worklet'
    return {
      backgroundColor: reduceMotion ? fill : withTiming(fill, timing),
      borderRadius: reduceMotion ? corner : withTiming(corner, timing),
      height: reduceMotion ? edge : withTiming(edge, timing),
      width: reduceMotion ? edge : withTiming(edge, timing),
    }
  })
  const clip = useAnimatedStyle(() => {
    'worklet'
    return {
      borderRadius: reduceMotion ? corner : withTiming(corner, timing),
    }
  })

  return { clip, container }
}

/**
 * The actions' arrival: they fade in and rise 8dp into place over short3 on
 * the emphasised decelerating curve once they have been placed, and stay
 * transparent until then. Under reduced motion they arrive at once.
 */
function useRiseIn(placed: boolean) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const shown = useSharedValue(0)

  useEffect(() => {
    if (!placed) {
      return
    }

    shown.set(
      reduceMotion
        ? 1
        : withTiming(1, {
            duration: motion.durationShort3,
            easing: Easing.bezier(...motion.easingEmphasizedDecelerate),
          }),
    )
  }, [motion, placed, reduceMotion, shown])

  return useAnimatedStyle(() => {
    'worklet'
    const progress = shown.get()

    return {
      opacity: progress,
      transform: [{ translateY: RISE_FROM * (1 - progress) }],
    }
  })
}

FabMenu.Item = FabMenuItem

export { FabMenu, FabMenuItem }
export type { FabMenuItemProps, FabMenuProps }
