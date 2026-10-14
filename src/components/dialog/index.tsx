import type { ComponentRef, ReactNode, Ref } from 'react'
import type {
  GestureResponderEvent,
  HostInstance,
  LayoutChangeEvent,
  ModalProps,
  ScrollViewProps,
  StyleProp,
  TextProps,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { EdgeInsets } from 'react-native-safe-area-context'
import type { OverlayTriggerState } from 'react-stately/useOverlayTriggerState'

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AccessibilityInfo,
  Modal,
  Text as NativeText,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'
import { useOverlayTriggerState } from 'react-stately/useOverlayTriggerState'

import type { ButtonSlots } from '../../button/slots'
import type { ResolvedTheme } from '../../theme/scope'

import { AnimatedPressable } from '../../button'
import { ButtonSlotContext } from '../../button/slots'
import { useWindowSizeClass } from '../../hooks/useWindowSizeClass'
import { OverlayHost } from '../../overlay'
import { withOpacity } from '../../theme/color'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// The dialogs spec page's two dialogs, as kanso-ui's Dialog draws them: one
// component, since the page pairs them by window size rather than offering a
// choice. In a medium window or wider it is the basic dialog, a container on
// surface container high with the 28dp corner, between 280 and 560dp wide,
// centred over the scrim, with 24dp of padding all round, 16dp between the
// headline and the body and 24dp between the body and the actions. In a
// compact window, below 600dp, the same dialog fills the window as the page's
// full-screen dialog: square corners, a 56dp header with the headline in
// title large and a divider under it, and a 56dp action bar over a divider,
// both inside the device's safe area.
//
// An alert dialog, `role="alertdialog"`, is a question with two or three
// answers rather than a task, and stays the basic dialog at every width, as
// on web, where a question filling a phone read as a headline at the top of
// the screen and its answers at the bottom with nothing between them.
//
// **It is drawn in a React Native `Modal`**, which keeps React context, so
// the dialog keeps the `ThemeScope` around it, and which is a window of its
// own on iOS and Android, above the screen and its overlays. The `Modal`
// therefore hosts overlays of its own, so a snackbar or a popover raised from
// inside the dialog draws above it rather than under it.
//
// **It animates out as well as in**, from the motion tokens: the panel scales
// up from 90% on the emphasised decelerating curve, or rises 3% of the window
// when it fills it, and leaves on the emphasised accelerating one, while the
// scrim fades on the standard curve. Web only animates in, since React Aria
// keeps a closing surface mounted only while a CSS animation runs; here the
// dialog stays mounted until its exit has run. Under reduced motion the
// panel appears and leaves at once, and the scrim still fades, which is what
// says the dialog came and went.
//
// **A press on the scrim closes it**, unless `isDismissable` is false, and
// Android's back gesture and VoiceOver's escape gesture close it, unless
// `isKeyboardDismissDisabled`, the prop that keeps Escape from closing it on
// web, which is the key React Native Web's `Modal` hands the same handler.
// A button inside `Dialog` and outside its content opens it, and one given
// `slot="close"` inside the content closes it, through src/button's
// slots.ts.
//
// **Focus moves into the dialog and back.** On iOS and Android the screen
// reader is sent to the headline once the dialog shows, and back to the
// button that opened it once it has gone. React Native Web's `Modal` traps
// focus and restores it itself, and is the dialog element there, so on web it
// takes the dialog's name and the panel takes no role of its own. That
// `Modal` sets its role itself, so an alert dialog is announced as a dialog
// in the web Storybook; kanso-ui, the library for web apps, keeps the role.

// The panel's width bounds, the page's, and how far it travels as it
// arrives: it scales up from 90% as the basic dialog, or rises 3% of the
// window as the full-screen one, as web's keyframes have it.
const MIN_WIDTH = 280
const MAX_WIDTH = 560
const SCALE_FROM = 0.9
const RISE_FROM = 0.03

// The scrim is the scrim role at 32%, the opacity Material Design gives a
// modal's scrim and web mixes in.
const SCRIM_OPACITY = 0.32

// Outside a SafeAreaProvider the insets are unknown, and the window's own edge
// is the best bound there is.
const NO_INSETS = { bottom: 0, left: 0, right: 0, top: 0 }

// iOS presents a `Modal` in portrait alone unless told otherwise, which would
// turn an app held sideways round as the dialog opened.
const ORIENTATIONS: ModalProps['supportedOrientations'] = [
  'portrait',
  'portrait-upside-down',
  'landscape',
  'landscape-left',
  'landscape-right',
]

const NO_PARTS: Readonly<Record<DialogPart, number>> = {
  footer: 0,
  header: 0,
  title: 0,
}

const stylesOf = themedStyles(
  ({ colors, radii, shadows, sizing, spacing }: ResolvedTheme) =>
    StyleSheet.create({
      // The page's 24dp between the body and the actions, and 8dp between
      // the buttons. Actions that do not fit on one row wrap onto another,
      // still at the trailing edge.
      actions: {
        alignItems: 'center',
        flexDirection: 'row',
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: spacing.sm,
        justifyContent: 'flex-end',
        padding: spacing.xl,
      },
      // Full screen, the actions are the page's bottom action bar: 56dp at
      // least, over a divider, so an action whose label wraps grows the bar
      // rather than meeting the divider.
      actionsFull: {
        borderTopColor: colors.outlineVariant,
        borderTopWidth: 1,
        minHeight: sizing.rowSm,
        paddingVertical: spacing.xs,
      },
      // The text a body is handed as a string, in the page's body medium on
      // on-surface variant, which is what web's body sets for its text.
      bodyText: {
        color: colors.onSurfaceVariant,
      },
      // Both dialogs' container, whose corner, where it has one, clips the
      // body's scroll.
      container: {
        backgroundColor: colors.surfaceContainerHigh,
        overflow: 'hidden',
      },
      // The basic dialog's container, centred over the scrim and only as
      // tall as the room the scrim's padding leaves, so the body scrolls
      // rather than running off the screen.
      containerBasic: {
        borderRadius: radii.xl,
        boxShadow: shadows.elevation3,
        maxHeight: '100%',
        maxWidth: MAX_WIDTH,
        minWidth: MIN_WIDTH,
        width: '100%',
      },
      // Full screen, the container fills the window with square corners, and
      // its fill runs on under the safe area its content keeps out of.
      containerFull: {
        flex: 1,
      },
      // The page's 24dp above the headline and 16dp between it and the body,
      // with the headline beside whatever else the header holds, a close
      // button for one.
      header: {
        alignItems: 'center',
        flexDirection: 'row',
        flexShrink: 0,
        gap: spacing.md,
        justifyContent: 'space-between',
        paddingBottom: spacing.lg,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.xl,
      },
      // Full screen, the header is the page's own 56dp bar, at least, under
      // a divider.
      headerFull: {
        borderBottomColor: colors.outlineVariant,
        borderBottomWidth: 1,
        minHeight: sizing.rowSm,
        paddingBottom: spacing.xs,
        paddingTop: spacing.xs,
      },
      // The scrim centres the container, which is what makes the dialog a
      // dialog rather than a sheet. Full screen it has no room to give. It
      // takes no touches itself, so a press around the container reaches the
      // scrim under it.
      layout: {
        alignItems: 'center',
        bottom: 0,
        justifyContent: 'center',
        left: 0,
        padding: spacing.xl,
        pointerEvents: 'box-none',
        position: 'absolute',
        right: 0,
        top: 0,
      },
      layoutFull: {
        alignItems: 'stretch',
        padding: 0,
      },
      scrim: {
        backgroundColor: withOpacity(colors.scrim, SCRIM_OPACITY),
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      // The headline gives way to whatever shares its row.
      title: {
        color: colors.onSurface,
        flexShrink: 1,
      },
    }),
)

// What the content's parts read: which of the two dialogs is drawn, which
// parts are there, and the headline's name and node.
type DialogLayout = {
  readonly basic: boolean
  readonly parts: Readonly<Record<DialogPart, number>>
  readonly register: (part: DialogPart) => () => void
  readonly setTitle: (node: HostInstance | null) => void
  readonly titleId: string
}

type DialogPart = 'footer' | 'header' | 'title'

// What `Dialog` hands its content: the open state, and the button that last
// opened it, for focus to return to.
type DialogTrigger = {
  readonly state: OverlayTriggerState
  readonly trigger: HostInstance | null
}

const DialogLayoutContext = createContext<DialogLayout | null>(null)
const DialogTriggerContext = createContext<DialogTrigger | null>(null)

type DialogBodyProps = ScrollViewProps & {
  readonly ref?: Ref<ComponentRef<typeof ScrollView>>
}

type DialogContentProps = DialogOpenProps &
  Omit<ViewProps, 'children' | 'role' | 'style'> & {
    readonly children?: ReactNode
    /**
     * Whether a press on the scrim, outside the container, closes the
     * dialog. Android's back gesture is `isKeyboardDismissDisabled`'s, and
     * this says nothing about it, so a dialog that has to be answered from
     * one of its actions turns off both.
     * @default true
     */
    readonly isDismissable?: boolean
    /**
     * Keeps Android's back gesture, VoiceOver's escape gesture, and Escape on
     * web, from closing the dialog.
     * @default false
     */
    readonly isKeyboardDismissDisabled?: boolean
    readonly ref?: Ref<ComponentRef<typeof View>>
    /**
     * `alertdialog` for a dialog interrupting with something that has to be
     * answered before the app carries on. It also keeps the dialog the basic
     * one in a compact window, centred and sized to its content, where a
     * dialog of the default role fills the window.
     * @default 'dialog'
     */
    readonly role?: 'alertdialog' | 'dialog'
    readonly style?: StyleProp<ViewStyle>
  }

type DialogOpenProps = {
  /** Whether the dialog starts open, when it keeps its own state. */
  readonly defaultOpen?: boolean
  /** Whether the dialog is open, when the call site holds the state. */
  readonly isOpen?: boolean
  /** Called with the new state as the dialog opens or closes. */
  readonly onOpenChange?: (isOpen: boolean) => void
}

type DialogPartProps = ViewProps & {
  readonly ref?: Ref<ComponentRef<typeof View>>
}

type DialogProps = DialogOpenProps & {
  /** The button that opens the dialog, and `Dialog.Content`. */
  readonly children?: ReactNode
}

type DialogTitleProps = Omit<TextProps, 'role'> & {
  readonly ref?: Ref<HostInstance>
}

// The body's padding. The page's 24dp all round is spent by whichever part
// is at each end, so the body takes the top of it when no header is there
// and the bottom when no footer is. Full screen, it keeps 24dp under the
// header's divider as well, which is the content padding the page gives the
// full-screen dialog.
function bodyPaddingOf(
  { basic, parts }: DialogLayout,
  spacing: ResolvedTheme['spacing'],
): ViewStyle {
  return {
    gap: spacing.lg,
    paddingBottom: parts.footer > 0 ? 0 : spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: basic && parts.header > 0 ? 0 : spacing.xl,
  }
}

/**
 * A modal dialog centred over the screen, and the same dialog filling the
 * window in a compact window, the dialogs spec page's basic and full-screen
 * dialogs, paired by window size as the page pairs them. An alert dialog
 * stays the basic one at every width. Pass `isOpen` with `onOpenChange` to
 * hold the open state, or `defaultOpen` to let it keep its own.
 *
 * ```tsx
 * <Dialog>
 *   <Button>Open</Button>
 *   <Dialog.Content>
 *     <Dialog.Header>
 *       <Dialog.Title>Headline</Dialog.Title>
 *     </Dialog.Header>
 *     <Dialog.Body>Supporting text</Dialog.Body>
 *     <Dialog.Footer>
 *       <Button slot="close" variant="text">Cancel</Button>
 *     </Dialog.Footer>
 *   </Dialog.Content>
 * </Dialog>
 * ```
 *
 * Composed rather than configured by props, as web's is, since a dialog's
 * header, body and actions all take arbitrary content. A `Button` or
 * `IconButton` inside `Dialog` and outside its content opens it, and one
 * given `slot="close"` anywhere inside the content closes it. A dialog nothing on
 * the screen opens leaves `Dialog` out and passes `isOpen` and
 * `onOpenChange` to `Dialog.Content` instead.
 */
function Dialog({ children, defaultOpen, isOpen, onOpenChange }: DialogProps) {
  const state = useOverlayTriggerState({ defaultOpen, isOpen, onOpenChange })
  const [trigger, setTrigger] = useState<HostInstance | null>(null)
  const context = useMemo(() => ({ state, trigger }), [state, trigger])
  // The default slot a button inside `Dialog` fills: it records
  // itself as the button focus returns to, and opens the dialog. React
  // Native types the target as a bare view tag too, which focus cannot be
  // sent to, so such a press records nothing.
  const slots = useMemo<ButtonSlots>(
    () => ({
      default: (event: GestureResponderEvent) => {
        const target = event.currentTarget

        setTrigger(typeof target === 'number' ? null : target)
        state.open()
      },
    }),
    [state],
  )

  return (
    <DialogTriggerContext value={context}>
      <ButtonSlotContext value={slots}>{children}</ButtonSlotContext>
    </DialogTriggerContext>
  )
}

/**
 * What the dialog shows, as a body that scrolls when its content runs past
 * the room it has. A string is drawn in the page's body medium on on-surface
 * variant; anything else draws itself. `style`, `ref` and `testID` land on
 * the `ScrollView`.
 *
 * A body its content runs past takes focus, as web's is a tab stop, so a
 * keyboard can scroll it when nothing inside it takes focus; a call site's
 * own `focusable` still wins.
 */
function DialogBody({
  children,
  contentContainerStyle,
  onContentSizeChange,
  onLayout,
  ...props
}: DialogBodyProps) {
  const layout = useLayout('Dialog.Body')
  const theme = useTheme()
  const styles = stylesOf(theme)
  const text = useTypeRole('bodyMedium')
  const { spacing } = theme
  const [content, setContent] = useState(0)
  const [room, setRoom] = useState(0)
  const measureContent = useCallback(
    (width: number, height: number) => {
      setContent(height)
      onContentSizeChange?.(width, height)
    },
    [onContentSizeChange],
  )
  const measureRoom = useCallback(
    (event: LayoutChangeEvent) => {
      setRoom(event.nativeEvent.layout.height)
      onLayout?.(event)
    },
    [onLayout],
  )

  return (
    <ScrollView
      focusable={content > room}
      onContentSizeChange={measureContent}
      onLayout={measureRoom}
      {...props}
      contentContainerStyle={composeStyles<ViewStyle>(
        bodyPaddingOf(layout, spacing),
        contentContainerStyle,
      )}
    >
      {typeof children === 'string' ? (
        <NativeText style={composeStyles<TextStyle>(text, styles.bodyText)}>
          {children}
        </NativeText>
      ) : (
        children
      )}
    </ScrollView>
  )
}

/**
 * The dialog itself, and the scrim behind it. Everything the dialog shows
 * goes in here; the button that opens it stays outside it.
 *
 * Inside `Dialog`, the open state is the trigger's. On its own it is this
 * part's: `isOpen` with `onOpenChange` holds it, and a `slot="close"`
 * button, the scrim and the back gesture all report through `onOpenChange`.
 * `style`, `ref` and `testID` land on the container.
 */
function DialogContent({
  children,
  defaultOpen,
  isDismissable = true,
  isKeyboardDismissDisabled = false,
  isOpen,
  onOpenChange,
  role = 'dialog',
  style,
  ...props
}: DialogContentProps) {
  const outer = use(DialogTriggerContext)
  const own = useOverlayTriggerState({ defaultOpen, isOpen, onOpenChange })
  const state = outer?.state ?? own
  const theme = useTheme()
  const styles = stylesOf(theme)
  const insets = use(SafeAreaInsetsContext) ?? NO_INSETS
  const sizeClass = useWindowSizeClass()
  const basic = role === 'alertdialog' || sizeClass !== 'compact'
  const titleId = useId()
  const [parts, setParts] = useState(NO_PARTS)
  const [register] = useState(() => registerOf(setParts))
  const [title, setTitle] = useState<HostInstance | null>(null)
  const [present, setPresent] = useState(state.isOpen)
  const motion = useDialogMotion(state.isOpen, present, setPresent, basic)
  const close = useCallback(() => {
    state.close()
  }, [state])
  const slots = useMemo<ButtonSlots>(() => ({ close }), [close])
  const layout = useMemo<DialogLayout>(
    () => ({ basic, parts, register, setTitle, titleId }),
    [basic, parts, register, titleId],
  )

  // Mounted the moment it opens, and kept until its exit has run.
  if (state.isOpen && !present) {
    setPresent(true)
  }

  useReturnFocus(present, outer)

  if (!present) {
    return null
  }

  const labelledBy = parts.title > 0 ? titleId : undefined
  const web = Platform.OS === 'web'

  return (
    <Modal
      animationType="none"
      aria-labelledby={web ? labelledBy : undefined}
      navigationBarTranslucent
      onRequestClose={isKeyboardDismissDisabled ? ignore : close}
      onShow={focusOf(title)}
      statusBarTranslucent
      supportedOrientations={ORIENTATIONS}
      transparent
      visible
    >
      {/* Nothing in the window takes the trigger's slot, the overlays this
          one hosts included, so a button in a snackbar raised from the dialog
          opens nothing; only the panel's buttons take the close slot. */}
      <ButtonSlotContext value={null}>
        <OverlayHost>
          {/* A screen reader and a keyboard skip the scrim: the first closes
            the dialog with the back or escape gesture, the second with
            Escape. React Native Web's Pressable is a tab stop unless told
            otherwise, whatever `focusable` says. */}
          <AnimatedPressable
            accessible={false}
            aria-hidden
            focusable={false}
            onPress={isDismissable && state.isOpen ? close : undefined}
            style={composeStyles<AnimatedStyle<ViewStyle>>(
              styles.scrim,
              motion.scrim,
            )}
            tabIndex={-1}
          />
          <View
            style={composeStyles<ViewStyle>(
              styles.layout,
              basic ? undefined : styles.layoutFull,
            )}
          >
            <Animated.View
              {...(web ? undefined : panelRoleOf(role, labelledBy))}
              onAccessibilityEscape={
                isKeyboardDismissDisabled ? undefined : close
              }
              {...props}
              style={composeStyles<AnimatedStyle<ViewStyle>>(
                styles.container,
                basic ? styles.containerBasic : styles.containerFull,
                basic ? undefined : insetsOf(insets),
                motion.panel,
                style,
              )}
            >
              <DialogLayoutContext value={layout}>
                <ButtonSlotContext value={slots}>{children}</ButtonSlotContext>
              </DialogLayoutContext>
            </Animated.View>
          </View>
        </OverlayHost>
      </ButtonSlotContext>
    </Modal>
  )
}

/**
 * The dialog's actions, at the trailing edge and wrapping onto another row
 * when they do not fit on one. Full screen they are the page's bottom action
 * bar. `style`, `ref` and `testID` land on its view.
 */
function DialogFooter({ style, ...props }: DialogPartProps) {
  const layout = useLayout('Dialog.Footer')
  const styles = stylesOf(useTheme())
  const { register } = layout

  useLayoutEffect(() => register('footer'), [register])

  return (
    <View
      {...props}
      style={composeStyles<ViewStyle>(
        styles.actions,
        layout.basic ? undefined : styles.actionsFull,
        style,
      )}
    />
  )
}

/**
 * The dialog's header: its `Dialog.Title`, and anything beside it, such as a
 * close button. Full screen it is the page's header bar. `style`, `ref` and
 * `testID` land on its view.
 */
function DialogHeader({ style, ...props }: DialogPartProps) {
  const layout = useLayout('Dialog.Header')
  const styles = stylesOf(useTheme())
  const { register } = layout

  useLayoutEffect(() => register('header'), [register])

  return (
    <View
      {...props}
      style={composeStyles<ViewStyle>(
        styles.header,
        layout.basic ? undefined : styles.headerFull,
        style,
      )}
    />
  )
}

/**
 * Names the dialog: the container is labelled by it, and a screen reader is
 * sent to it once the dialog shows. In headline small as the basic dialog,
 * and title large as the full-screen one, where it shares a 56dp bar.
 * `style`, `ref` and `testID` land on React Native's own Text.
 */
function DialogTitle({ ref, style, ...props }: DialogTitleProps) {
  const layout = useLayout('Dialog.Title')
  const styles = stylesOf(useTheme())
  const role = useTypeRole(layout.basic ? 'headlineSmall' : 'titleLarge')
  const { register, setTitle } = layout

  useLayoutEffect(() => register('title'), [register])

  return (
    <NativeText
      {...props}
      nativeID={layout.titleId}
      ref={refsOf(setTitle, ref)}
      role="heading"
      style={composeStyles<TextStyle>(role, styles.title, style)}
    />
  )
}

// Sends the screen reader to the headline once the dialog has shown. React
// Native Web's `Modal` moves focus into itself.
function focusOf(title: HostInstance | null) {
  return () => {
    if (title !== null && Platform.OS !== 'web') {
      AccessibilityInfo.sendAccessibilityEvent(title, 'focus')
    }
  }
}

// What the back gesture does on a dialog it may not close: nothing, rather
// than leaving the handler out, which Android warns about.
function ignore() {}

function insetsOf(insets: EdgeInsets): ViewStyle {
  return {
    paddingBottom: insets.bottom,
    paddingLeft: insets.left,
    paddingRight: insets.right,
    paddingTop: insets.top,
  }
}

// The panel's role and name on iOS and Android. On web React Native Web's
// `Modal` is the dialog element, so the panel takes neither there.
function panelRoleOf(
  role: 'alertdialog' | 'dialog',
  labelledBy: string | undefined,
): Pick<ViewProps, 'aria-labelledby' | 'aria-modal' | 'role'> {
  return { 'aria-labelledby': labelledBy, 'aria-modal': true, role }
}

// Every ref a node is handed to, the part's own and the call site's.
function refsOf<T>(own: (node: null | T) => void, other: Ref<T> | undefined) {
  return (node: null | T) => {
    own(node)
    if (typeof other === 'function') {
      other(node)
    } else if (other !== null && other !== undefined) {
      other.current = node
    }
  }
}

// Counts each part as it mounts and unmounts, so the body knows which ends
// it has to pad.
function registerOf(
  setParts: (
    update: (
      parts: Readonly<Record<DialogPart, number>>,
    ) => Readonly<Record<DialogPart, number>>,
  ) => void,
) {
  return (part: DialogPart) => {
    setParts((parts) => ({ ...parts, [part]: parts[part] + 1 }))

    return () => {
      setParts((parts) => ({ ...parts, [part]: parts[part] - 1 }))
    }
  }
}

/**
 * The scrim's and the panel's motion, and the timer that unmounts the dialog
 * once its exit has run. The panel arrives over the medium duration on the
 * emphasised decelerating curve and leaves over the short one on the
 * accelerating curve, and the scrim fades over the short one on the standard
 * curve, both ways. Under reduced motion the panel arrives and leaves at once.
 */
function useDialogMotion(
  isOpen: boolean,
  present: boolean,
  setPresent: (present: boolean) => void,
  basic: boolean,
) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const { height } = useWindowDimensions()
  const panel = useSharedValue(0)
  const scrim = useSharedValue(0)

  useEffect(() => {
    const fade = {
      duration: motion.durationShort2,
      easing: Easing.bezier(...motion.easingStandard),
    }

    if (isOpen) {
      scrim.set(withTiming(1, fade))
      panel.set(
        reduceMotion
          ? 1
          : withTiming(1, {
              duration: motion.durationMedium1,
              easing: Easing.bezier(...motion.easingEmphasizedDecelerate),
            }),
      )
      return undefined
    }

    if (!present) {
      return undefined
    }

    scrim.set(withTiming(0, fade))
    panel.set(
      reduceMotion
        ? 0
        : withTiming(0, {
            duration: motion.durationShort3,
            easing: Easing.bezier(...motion.easingEmphasizedAccelerate),
          }),
    )
    const timer = setTimeout(
      () => {
        setPresent(false)
      },
      reduceMotion
        ? motion.durationShort2
        : Math.max(motion.durationShort2, motion.durationShort3),
    )

    return () => {
      clearTimeout(timer)
    }
  }, [isOpen, motion, panel, present, reduceMotion, scrim, setPresent])

  return {
    panel: useAnimatedStyle(() => {
      'worklet'
      const shown = panel.get()

      return basic
        ? {
            opacity: shown,
            transform: [{ scale: SCALE_FROM + (1 - SCALE_FROM) * shown }],
          }
        : {
            opacity: shown,
            transform: [{ translateY: (1 - shown) * RISE_FROM * height }],
          }
    }),
    scrim: useAnimatedStyle(() => {
      'worklet'
      return { opacity: scrim.get() }
    }),
  }
}

function useLayout(part: string) {
  const layout = use(DialogLayoutContext)

  if (layout === null) {
    throw new Error(`${part} is drawn inside Dialog.Content.`)
  }

  return layout
}

// Sends the screen reader back to the button that opened the dialog once the
// dialog has gone. React Native Web's `Modal` restores focus itself.
function useReturnFocus(present: boolean, outer: DialogTrigger | null) {
  const shown = useRef(present)

  useEffect(() => {
    const trigger = outer?.trigger ?? null
    const gone = shown.current && !present

    shown.current = present
    if (gone && trigger !== null && Platform.OS !== 'web') {
      AccessibilityInfo.sendAccessibilityEvent(trigger, 'focus')
    }
  }, [outer, present])
}

Dialog.Body = DialogBody
Dialog.Content = DialogContent
Dialog.Footer = DialogFooter
Dialog.Header = DialogHeader
Dialog.Title = DialogTitle

export {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
}
export type {
  DialogBodyProps,
  DialogContentProps,
  DialogPartProps,
  DialogProps,
  DialogTitleProps,
}
