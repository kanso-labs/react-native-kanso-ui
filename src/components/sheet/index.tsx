import type { ComponentRef, ReactNode, Ref } from 'react'
import type {
  HostInstance,
  LayoutChangeEvent,
  ScrollViewProps,
  StyleProp,
  TextProps,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { GestureType } from 'react-native-gesture-handler'
import type { AnimatedStyle, SharedValue } from 'react-native-reanimated'
import type { EdgeInsets } from 'react-native-safe-area-context'

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import {
  I18nManager,
  Text as NativeText,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

import type { ButtonSlots } from '../../button/slots'
import type { ModalOpenProps, ModalTrigger } from '../../modal'
import type { ResolvedTheme } from '../../theme/scope'

import { ButtonSlotContext } from '../../button/slots'
import { useWindowSizeClass } from '../../hooks/useWindowSizeClass'
import { useMessages } from '../../i18n/provider'
import {
  insetsOf,
  ModalWindow,
  NO_INSETS,
  panelRoleOf,
  useModalState,
  useModalTrigger,
} from '../../modal'
import { usePressFeedback } from '../../press'
import { refsOf } from '../../ref'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// The bottom sheets and side sheets spec pages' modal sheets, as kanso-ui's
// Sheet draws them: one component, which is a bottom sheet in a compact
// window, below 600dp, and a side sheet from the medium window up. Both sit on
// surface container low at the first elevation level, over the scrim. The
// bottom sheet spans the window, with the 28dp corner on its top two corners,
// and stops 72dp short of the window's top, the page's top margin, so a long
// body scrolls. The side sheet is 400dp wide and as tall as the window, along
// the end edge, with the 16dp corner on its two start corners, and turns over
// with the layout under right-to-left.
//
// **The bottom sheet drags**, which web's does not: the spec page draws a
// sheet that is dragged between heights and swiped down to go, and web
// records leaving it out as a departure that native need not repeat. A sheet
// taller than half the window opens at half its height, as Android's modal
// bottom sheet does, and is dragged up to the whole of it and back; one no
// taller opens whole. Let go, it settles on the nearest of those heights, or
// one height on in the direction of a fling, and below the lowest it goes,
// unless `isDismissable` is false, which holds it at the lowest. The drag is
// Gesture Handler's pan, through the builder API both its 2.x and its 3
// export. While the sheet is at half height its body does not scroll, so a
// drag on it raises the sheet; once whole, a body with more than it can show
// scrolls, and the sheet is dragged by the handle, header and actions. At
// half height the actions are below the fold, where the drag brings them.
//
// **The handle is a control where the sheet has two heights**, as Android's
// drag handle is: a press moves the sheet to the other one, and it says which
// it is at as expanded or collapsed. It takes the press feedback every control
// does, over a 48dp target, and is named "Drag handle" in the `I18nProvider`'s
// locale, or the device's outside one, unless `aria-label` says otherwise. A sheet with one height has nothing for
// it to do, and draws it as web does, as a mark the screen reader skips. The
// side sheet draws no handle.
//
// **It is drawn in a React Native `Modal`**, through src/modal, as `Dialog`
// is, so it keeps the `ThemeScope` around it, hosts its own overlays, and
// takes its scrim, its back gesture and its focus handling from there. The
// sheet's own panel is a Gesture Handler root, which Android needs for a
// gesture inside a `Modal`'s window.
//
// **It animates out as well as in**, from the motion tokens: it arrives from
// its edge over the medium duration on the emphasised decelerating curve and
// leaves over the short one on the accelerating curve, while the scrim fades
// on the standard one. Web only animates in, since React Aria keeps a closing
// surface mounted only while a CSS animation runs. The side sheet fades as it
// travels, as web's does; the bottom sheet does not, since its position is
// also the drag's. Under reduced motion the sheet appears and leaves at once,
// and the scrim still fades.
//
// **Its content sits inside the safe area** while its fill runs on under it:
// the bottom sheet's above the home indicator and inside the side insets of a
// phone held sideways, and the side sheet's under the status bar and over the
// home indicator, inside the inset on its own edge.

// The side sheet's width, web's and the side sheets page's.
const SIDE_WIDTH = 400

// The bottom sheet's top margin once whole, the page's 72dp.
const TOP_MARGIN = 72

// How much of the window a sheet with two heights shows at the lower one.
const PARTIAL = 0.5

// How far a press travels before it is a drag, so a tap on the sheet's
// content stays a tap.
const DRAG_SLOP = 8

// A release faster than this, in dp a second, is a fling, which moves the
// sheet one height on rather than to the nearest. Android's bottom sheet
// takes the same speed as the one that hides it.
const FLING = 500

// The handle's bar and the room above and below it, web's 32 by 4 with 22dp
// either side, which with 8dp at its ends makes the 48dp target.
const BAR_WIDTH = 32
const BAR_HEIGHT = 4
const BAR_SPACE = 22
const BAR_SIDE = 8

const stylesOf = themedStyles(
  ({ colors, radii, shadows, spacing }: ResolvedTheme) =>
    StyleSheet.create({
      // The handle's bar, on on-surface variant.
      bar: {
        backgroundColor: colors.onSurfaceVariant,
        borderRadius: radii.pill,
        height: BAR_HEIGHT,
        width: BAR_WIDTH,
      },
      // The body's padding, web's: 24dp at the sides, 16dp at either end
      // and between whatever it holds.
      body: {
        gap: spacing.lg,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
      },
      // The text a body is handed as a string, in body medium on on-surface
      // variant, as the stories on web set theirs.
      bodyText: {
        color: colors.onSurfaceVariant,
      },
      // Both sheets' container, whose corners clip the body's scroll.
      container: {
        backgroundColor: colors.surfaceContainerLow,
        boxShadow: shadows.elevation1,
        overflow: 'hidden',
      },
      // The bottom sheet's container: the window's width, rounded on top.
      containerBottom: {
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        width: '100%',
      },
      // The side sheet's container, as tall as the window and rounded on the
      // corners that face the screen it covers.
      containerSide: {
        borderBottomStartRadius: radii.lg,
        borderTopStartRadius: radii.lg,
        flex: 1,
      },
      // The actions, web's: leading, wrapping onto another row when they do
      // not fit on one, over a divider, in a bar 72dp tall at least.
      footer: {
        alignItems: 'center',
        borderTopColor: colors.outlineVariant,
        borderTopWidth: 1,
        flexDirection: 'row',
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: spacing.sm,
        justifyContent: 'flex-start',
        minHeight: 72,
        paddingBottom: spacing.xl,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
      },
      // The handle's 48dp target, centred along the sheet's top edge.
      handle: {
        alignItems: 'center',
        alignSelf: 'center',
        borderRadius: radii.pill,
        flexShrink: 0,
        paddingHorizontal: BAR_SIDE,
        paddingVertical: BAR_SPACE,
      },
      // The headline and whatever shares its row, a close button for one,
      // over a divider.
      header: {
        alignItems: 'center',
        borderBottomColor: colors.outlineVariant,
        borderBottomWidth: 1,
        flexDirection: 'row',
        flexShrink: 0,
        gap: spacing.md,
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
      },
      // Where each sheet sits in the window. The panel is a Gesture Handler
      // root of its own, the size of the sheet, so a press beside it reaches
      // the scrim.
      rootBottom: {
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
      },
      rootSide: {
        bottom: 0,
        end: 0,
        maxWidth: '100%',
        position: 'absolute',
        top: 0,
        width: SIDE_WIDTH,
      },
      // The headline gives way to whatever shares its row.
      title: {
        color: colors.onSurfaceVariant,
        flexShrink: 1,
        minWidth: 0,
      },
    }),
)

// What the content's parts read: which sheet is drawn, whether it is at its
// whole height, the drag a scrolling body holds off, and the headline.
type SheetLayout = {
  readonly bottom: boolean
  readonly expanded: boolean
  // Gesture Handler 3 deprecates its gesture builder, and this type, for hooks
  // that version 2 does not have, and the peer range admits both, so the sheet
  // keeps the builder while it does.
  // oxlint-disable-next-line typescript/no-deprecated -- see above
  readonly pan: GestureType
  readonly setTitle: (node: HostInstance | null) => void
  readonly titleId: string
  /** What a press on the handle does, where the sheet has two heights. */
  readonly toggle: (() => void) | undefined
}

const SheetLayoutContext = createContext<null | SheetLayout>(null)
const SheetTriggerContext = createContext<ModalTrigger | null>(null)

type SheetBodyProps = ScrollViewProps & {
  readonly ref?: Ref<ComponentRef<typeof ScrollView>>
}

type SheetContentProps = Omit<ViewProps, 'children' | 'style'> &
  SheetOpenProps & {
    readonly children?: ReactNode
    /**
     * Whether a press on the scrim, outside the sheet, and a swipe down past
     * its lowest height close it. Android's back gesture is
     * `isKeyboardDismissDisabled`'s, and this says nothing about it.
     * @default true
     */
    readonly isDismissable?: boolean
    /**
     * Keeps Android's back gesture, VoiceOver's escape gesture, and Escape on
     * web, from closing the sheet.
     * @default false
     */
    readonly isKeyboardDismissDisabled?: boolean
    readonly ref?: Ref<ComponentRef<typeof View>>
    readonly style?: StyleProp<ViewStyle>
  }

type SheetHandleProps = Omit<ViewProps, 'children'> & {
  readonly ref?: Ref<ComponentRef<typeof View>>
}

type SheetOpenProps = ModalOpenProps & {
  /** Whether the sheet starts open, when it keeps its own state. */
  readonly defaultOpen?: boolean
  /** Whether the sheet is open, when the call site holds the state. */
  readonly isOpen?: boolean
  /** Called with the new state as the sheet opens or closes. */
  readonly onOpenChange?: (isOpen: boolean) => void
}

type SheetPartProps = ViewProps & {
  readonly ref?: Ref<ComponentRef<typeof View>>
}

type SheetProps = SheetOpenProps & {
  /** The button that opens the sheet, and `Sheet.Content`. */
  readonly children?: ReactNode
}

type SheetTitleProps = Omit<TextProps, 'role'> & {
  readonly ref?: Ref<HostInstance>
}

// What the window draws once the sheet is open, and what it needs from the
// part that keeps the open state.
type SheetWindowProps = Omit<
  SheetContentProps,
  'defaultOpen' | 'isOpen' | 'onOpenChange'
> & {
  readonly close: () => void
  readonly isDismissable: boolean
  readonly isKeyboardDismissDisabled: boolean
  readonly isOpen: boolean
  readonly setPresent: (present: boolean) => void
  readonly slots: ButtonSlots
}

// The heights a bottom sheet rests at, as how far its panel is moved down:
// whole, at half the window where it is taller than that, and gone.
type Stops = {
  /** The lower height, where the sheet has two. */
  readonly partial: null | number
  /** Every height a release can settle on, highest first. */
  readonly settles: readonly number[]
}

// The bottom sheet's room and padding: no taller than the window less the top
// margin, or less the status bar where that is the taller, and its content
// above the home indicator and inside the side insets.
function bottomBoundsOf(insets: EdgeInsets, height: number): ViewStyle {
  return {
    ...insetsOf(insets),
    maxHeight: height - Math.max(TOP_MARGIN, insets.top),
    paddingTop: 0,
  }
}

/**
 * Where a bottom sheet let go comes to rest: one height on in the direction of
 * a fling, and the nearest height otherwise. Heights are how far the panel is
 * moved down, highest first, and the highest is always the whole sheet, 0.
 */
function settleOf(at: number, velocity: number, settles: readonly number[]) {
  if (velocity > FLING) {
    return settles.find((stop) => stop > at) ?? settles.at(-1) ?? 0
  }

  if (velocity < -FLING) {
    return settles.findLast((stop) => stop < at) ?? 0
  }

  return settles.reduce(
    (nearest, stop) =>
      Math.abs(stop - at) < Math.abs(nearest - at) ? stop : nearest,
    0,
  )
}

/**
 * A modal sheet along an edge of the screen, the bottom sheets and side sheets
 * spec pages' modal sheets, paired by window size as kanso-ui's are: a bottom
 * sheet in a compact window, dragged between heights and swiped down to go,
 * and a side sheet along the end edge from the medium window up. Pass
 * `isOpen` with `onOpenChange` to hold the open state, or `defaultOpen` to let
 * it keep its own.
 *
 * ```tsx
 * <Sheet>
 *   <Button>Open</Button>
 *   <Sheet.Content>
 *     <Sheet.Handle />
 *     <Sheet.Header>
 *       <Sheet.Title>Headline</Sheet.Title>
 *     </Sheet.Header>
 *     <Sheet.Body>Supporting text</Sheet.Body>
 *     <Sheet.Footer>
 *       <Button slot="close">Done</Button>
 *     </Sheet.Footer>
 *   </Sheet.Content>
 * </Sheet>
 * ```
 *
 * Composed rather than configured by props, as web's is. A `Button` or
 * `IconButton` inside `Sheet` and outside its content opens it, and one given
 * `slot="close"` anywhere inside the content closes it. A sheet nothing on the
 * screen opens leaves `Sheet` out and passes `isOpen` and `onOpenChange` to
 * `Sheet.Content` instead.
 */
function Sheet({ children, defaultOpen, isOpen, onOpenChange }: SheetProps) {
  const { context, slots } = useModalTrigger({
    defaultOpen,
    isOpen,
    onOpenChange,
  })

  return (
    <SheetTriggerContext value={context}>
      <ButtonSlotContext value={slots}>{children}</ButtonSlotContext>
    </SheetTriggerContext>
  )
}

/**
 * What the sheet shows, as a body that scrolls when its content runs past the
 * room it has. A string is drawn in body medium on on-surface variant;
 * anything else draws itself. `style`, `ref` and `testID` land on the
 * `ScrollView`.
 *
 * A body its content runs past takes focus, as web's is a tab stop, so a
 * keyboard can scroll it when nothing inside it takes focus; a call site's
 * own `focusable` still wins. A bottom sheet's body scrolls only once the
 * sheet is at its whole height, and holds the sheet's drag off while it does.
 */
function SheetBody({
  children,
  contentContainerStyle,
  onContentSizeChange,
  onLayout,
  scrollEnabled = true,
  ...props
}: SheetBodyProps) {
  const layout = useLayout('Sheet.Body')
  const styles = stylesOf(useTheme())
  const text = useTypeRole('bodyMedium')
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
  const scrolls = scrollEnabled && layout.expanded
  const overflows = content > room
  // oxlint-disable-next-line react/capitalized-calls, typescript/no-deprecated -- a builder named after its gesture, not a component; see SheetLayout
  const native = Gesture.Native()
    .enabled(scrolls && overflows)
    .blocksExternalGesture(layout.pan)

  return (
    <GestureDetector gesture={native}>
      <ScrollView
        focusable={scrolls && overflows}
        onContentSizeChange={measureContent}
        onLayout={measureRoom}
        {...props}
        contentContainerStyle={composeStyles<ViewStyle>(
          styles.body,
          contentContainerStyle,
        )}
        scrollEnabled={scrolls}
      >
        {typeof children === 'string' ? (
          <NativeText style={composeStyles<TextStyle>(text, styles.bodyText)}>
            {children}
          </NativeText>
        ) : (
          children
        )}
      </ScrollView>
    </GestureDetector>
  )
}

/**
 * The sheet itself, and the scrim behind it. Everything the sheet shows goes
 * in here; the button that opens it stays outside it.
 *
 * Inside `Sheet`, the open state is the trigger's. On its own it is this
 * part's: `isOpen` with `onOpenChange` holds it, and a `slot="close"` button,
 * the scrim, the swipe and the back gesture all report through
 * `onOpenChange`. `style`, `ref` and `testID` land on the container, and
 * `testID` names the drag `<testID>-drag` for Gesture Handler's test helpers.
 */
function SheetContent({
  defaultOpen,
  isDismissable = true,
  isKeyboardDismissDisabled = false,
  isOpen,
  onOpenChange,
  ...props
}: SheetContentProps) {
  const outer = use(SheetTriggerContext)
  const { close, present, setPresent, slots, state } = useModalState(outer, {
    defaultOpen,
    isOpen,
    onOpenChange,
  })

  if (!present) {
    return null
  }

  return (
    <SheetWindow
      {...props}
      close={close}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={isKeyboardDismissDisabled}
      isOpen={state.isOpen}
      setPresent={setPresent}
      slots={slots}
    />
  )
}

/**
 * The sheet's actions, leading and wrapping onto another row when they do not
 * fit on one, over a divider. On a bottom sheet at half height they are below
 * the fold until the sheet is raised. `style`, `ref` and `testID` land on its
 * view.
 */
function SheetFooter({ style, ...props }: SheetPartProps) {
  useLayout('Sheet.Footer')
  const styles = stylesOf(useTheme())

  return (
    <View {...props} style={composeStyles<ViewStyle>(styles.footer, style)} />
  )
}

/**
 * The bottom sheet's drag handle, a 32 by 4dp bar centred along its top edge.
 * Where the sheet has two heights it is a button moving it to the other one,
 * named "Drag handle" in the `I18nProvider`'s locale, or the device's outside
 * one, unless `aria-label` says otherwise; elsewhere it is a mark a screen reader skips. A side sheet draws
 * none. `style`, `ref` and `testID` land on its view.
 */
function SheetHandle({
  'aria-label': label,
  style,
  ...props
}: SheetHandleProps) {
  const layout = useLayout('Sheet.Handle')
  const theme = useTheme()
  const styles = stylesOf(theme)
  const { colors, radii } = theme
  const feedback = usePressFeedback({
    color: colors.onSurfaceVariant,
    corners: { borderRadius: radii.pill },
  })
  const { toggle } = layout
  const messages = useMessages()

  if (!layout.bottom) {
    return null
  }

  if (toggle === undefined) {
    return (
      <View
        aria-hidden
        {...props}
        style={composeStyles<ViewStyle>(styles.handle, style)}
      >
        <View style={styles.bar} />
      </View>
    )
  }

  return (
    <Pressable
      aria-expanded={layout.expanded}
      aria-label={label ?? messages.dragHandle}
      role="button"
      {...props}
      {...feedback.handlers}
      onPress={toggle}
      style={composeStyles<ViewStyle>(styles.handle, feedback.ring, style)}
    >
      {feedback.layer}
      <View style={styles.bar} />
    </Pressable>
  )
}

/**
 * The sheet's header: its `Sheet.Title`, and anything beside it, such as a
 * close button, over a divider. `style`, `ref` and `testID` land on its view.
 */
function SheetHeader({ style, ...props }: SheetPartProps) {
  useLayout('Sheet.Header')
  const styles = stylesOf(useTheme())

  return (
    <View {...props} style={composeStyles<ViewStyle>(styles.header, style)} />
  )
}

/**
 * Names the sheet: the container is labelled by it, and a screen reader is
 * sent to it once the sheet shows. In title large on on-surface variant.
 * `style`, `ref` and `testID` land on React Native's own Text.
 */
function SheetTitle({ ref, style, ...props }: SheetTitleProps) {
  const layout = useLayout('Sheet.Title')
  const styles = stylesOf(useTheme())
  const role = useTypeRole('titleLarge')

  return (
    <NativeText
      {...props}
      nativeID={layout.titleId}
      ref={refsOf(layout.setTitle, ref)}
      role="heading"
      style={composeStyles<TextStyle>(role, styles.title, style)}
    />
  )
}

/**
 * The open sheet, mounted from the moment it opens until its exit has run, so
 * each opening starts from its edge and at its first height.
 */
function SheetWindow({
  children,
  close,
  isDismissable,
  isKeyboardDismissDisabled,
  isOpen,
  onLayout,
  setPresent,
  slots,
  style,
  testID,
  ...props
}: SheetWindowProps) {
  const styles = stylesOf(useTheme())
  const insets = use(SafeAreaInsetsContext) ?? NO_INSETS
  const { height } = useWindowDimensions()
  const bottom = useWindowSizeClass() === 'compact'
  const titleId = useId()
  const [title, setTitle] = useState<HostInstance | null>(null)
  // The panel's height as laid out, before any drag moves it, and whether a
  // sheet with two heights is at the higher one.
  const [full, setFull] = useState<null | number>(null)
  const [expanded, setExpanded] = useState(false)
  const stops = stopsOf(bottom, full, height, isDismissable)
  const twoHeights = stops.partial !== null
  const rest = stops.partial !== null && !expanded ? stops.partial : 0
  const motion = useSheetMotion({ bottom, full, isOpen, rest, setPresent })
  const pan = useSheetDrag({
    close,
    enabled: bottom && isOpen && stops.settles.length > 1,
    expanded,
    full,
    isDismissable,
    offset: motion.offset,
    rest,
    setExpanded,
    stops,
    testID,
  })
  const toggle = useCallback(() => {
    setExpanded((was) => !was)
  }, [])
  const layout = useMemo<SheetLayout>(
    () => ({
      bottom,
      expanded: !twoHeights || expanded,
      pan,
      setTitle,
      titleId,
      toggle: twoHeights ? toggle : undefined,
    }),
    [bottom, expanded, pan, titleId, toggle, twoHeights],
  )
  const measure = useCallback(
    (event: LayoutChangeEvent) => {
      setFull(event.nativeEvent.layout.height)
      onLayout?.(event)
    },
    [onLayout],
  )
  const labelledBy = title === null ? undefined : titleId

  return (
    <ModalWindow
      isKeyboardDismissDisabled={isKeyboardDismissDisabled}
      labelledBy={labelledBy}
      onClose={close}
      onScrimPress={isDismissable && isOpen ? close : undefined}
      scrim={motion.scrim}
      title={title}
    >
      <GestureHandlerRootView
        style={bottom ? styles.rootBottom : styles.rootSide}
      >
        <GestureDetector gesture={pan}>
          <Animated.View
            {...panelRoleOf('dialog', labelledBy)}
            onAccessibilityEscape={
              isKeyboardDismissDisabled ? undefined : close
            }
            {...props}
            onLayout={measure}
            style={composeStyles<AnimatedStyle<ViewStyle>>(
              styles.container,
              bottom ? styles.containerBottom : styles.containerSide,
              bottom ? bottomBoundsOf(insets, height) : sideInsetsOf(insets),
              motion.panel,
              style,
            )}
            testID={testID}
          >
            <SheetLayoutContext value={layout}>
              <ButtonSlotContext value={slots}>{children}</ButtonSlotContext>
            </SheetLayoutContext>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </ModalWindow>
  )
}

// The side sheet's padding: its content under the status bar, over the home
// indicator and inside the inset on its own edge. Its start edge faces the
// screen it covers, which has none.
function sideInsetsOf(insets: EdgeInsets): ViewStyle {
  return { ...insetsOf(insets), paddingStart: 0 }
}

function stopsOf(
  bottom: boolean,
  full: null | number,
  height: number,
  isDismissable: boolean,
): Stops {
  if (!bottom || full === null) {
    return { partial: null, settles: [0] }
  }

  const lower = full - height * PARTIAL
  const partial = lower > 0 ? lower : null

  return {
    partial,
    settles: [
      0,
      ...(partial === null ? [] : [partial]),
      ...(isDismissable ? [full] : []),
    ],
  }
}

function useLayout(part: string) {
  const layout = use(SheetLayoutContext)

  if (layout === null) {
    throw new Error(`${part} is drawn inside Sheet.Content.`)
  }

  return layout
}

/**
 * The bottom sheet's drag. The panel follows the finger, no higher than its
 * whole height and no lower than gone, or than its lowest height when it may
 * not be dismissed, and once let go it settles where `settleOf` says: below
 * the lowest height it closes, and at another height it moves the sheet there.
 */
function useSheetDrag({
  close,
  enabled,
  expanded,
  full,
  isDismissable,
  offset,
  rest,
  setExpanded,
  stops,
  testID,
}: {
  readonly close: () => void
  readonly enabled: boolean
  readonly expanded: boolean
  readonly full: null | number
  readonly isDismissable: boolean
  readonly offset: SharedValue<number>
  readonly rest: number
  readonly setExpanded: (expanded: boolean) => void
  readonly stops: Stops
  readonly testID: string | undefined
}) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  // Where the panel stood when the drag was recognised. Gesture Handler
  // measures its translation from there, past the slop.
  const origin = useSharedValue(0)
  const lowest = stops.settles.at(-1) ?? 0

  function follow(translation: number) {
    offset.set(Math.min(lowest, Math.max(0, origin.get() + translation)))
  }

  function settle(target: number) {
    if (isDismissable && target === full) {
      close()
      return
    }

    const higher = target === 0
    if (stops.partial !== null && higher !== expanded) {
      setExpanded(higher)
      return
    }

    offset.set(
      reduceMotion
        ? target
        : withTiming(target, {
            duration: motion.durationMedium1,
            easing: Easing.bezier(...motion.easingEmphasizedDecelerate),
          }),
    )
  }

  // oxlint-disable-next-line react/capitalized-calls, typescript/no-deprecated -- a builder named after its gesture, not a component; see SheetLayout
  const pan = Gesture.Pan()
    .activeOffsetY([-DRAG_SLOP, DRAG_SLOP])
    .enabled(enabled)
    .runOnJS(true)
    .onStart(({ translationY }) => {
      origin.set(offset.get())
      follow(translationY)
    })
    .onUpdate(({ translationY }) => {
      follow(translationY)
    })
    .onEnd(({ velocityY }, success) => {
      settle(success ? settleOf(offset.get(), velocityY, stops.settles) : rest)
    })

  return testID === undefined ? pan : pan.withTestId(`${testID}-drag`)
}

/**
 * The scrim's and the panel's motion, and the timer that unmounts the sheet
 * once its exit has run. The bottom sheet's position is how far its panel is
 * moved down, which the drag sets too; it starts below the window and rises
 * to its height once that is measured. The side sheet's is how far it has
 * come in from its edge, which is the end edge, and so the left one under
 * right-to-left.
 */
function useSheetMotion({
  bottom,
  full,
  isOpen,
  rest,
  setPresent,
}: {
  readonly bottom: boolean
  readonly full: null | number
  readonly isOpen: boolean
  readonly rest: number
  readonly setPresent: (present: boolean) => void
}) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const { height } = useWindowDimensions()
  const offset = useSharedValue(height)
  const shown = useSharedValue(0)
  const scrim = useSharedValue(0)
  // A translation is not mirrored under a right-to-left layout, though the
  // side sheet's edge is, so it travels the other way there.
  const direction = I18nManager.isRTL ? -1 : 1

  useEffect(() => {
    const fade = {
      duration: motion.durationShort2,
      easing: Easing.bezier(...motion.easingStandard),
    }
    const enter = {
      duration: motion.durationMedium1,
      easing: Easing.bezier(...motion.easingEmphasizedDecelerate),
    }
    const exit = {
      duration: motion.durationShort3,
      easing: Easing.bezier(...motion.easingEmphasizedAccelerate),
    }

    if (isOpen) {
      scrim.set(withTiming(1, fade))
      if (!bottom) {
        shown.set(reduceMotion ? 1 : withTiming(1, enter))
        return undefined
      }
      if (full === null) {
        return undefined
      }
      // It rises from its own height below where it rests, not from the
      // bottom of the window, so it shows from the first frame.
      if (offset.get() > full) {
        offset.set(full)
      }
      offset.set(reduceMotion ? rest : withTiming(rest, enter))
      return undefined
    }

    scrim.set(withTiming(0, fade))
    if (bottom) {
      const gone = full ?? height
      offset.set(reduceMotion ? gone : withTiming(gone, exit))
    } else {
      shown.set(reduceMotion ? 0 : withTiming(0, exit))
    }
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
  }, [
    bottom,
    full,
    height,
    isOpen,
    motion,
    offset,
    reduceMotion,
    rest,
    scrim,
    setPresent,
    shown,
  ])

  return {
    offset,
    panel: useAnimatedStyle(() => {
      'worklet'
      if (bottom) {
        return { transform: [{ translateY: offset.get() }] }
      }

      const progress = shown.get()
      return {
        opacity: progress,
        transform: [{ translateX: (1 - progress) * SIDE_WIDTH * direction }],
      }
    }),
    scrim: useAnimatedStyle(() => {
      'worklet'
      return { opacity: scrim.get() }
    }),
  }
}

Sheet.Body = SheetBody
Sheet.Content = SheetContent
Sheet.Footer = SheetFooter
Sheet.Handle = SheetHandle
Sheet.Header = SheetHeader
Sheet.Title = SheetTitle

export {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHandle,
  SheetHeader,
  SheetTitle,
}
export type {
  SheetBodyProps,
  SheetContentProps,
  SheetHandleProps,
  SheetPartProps,
  SheetProps,
  SheetTitleProps,
}
