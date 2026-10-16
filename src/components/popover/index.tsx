import type { ReactNode, Ref, RefObject } from 'react'
import type {
  HostInstance,
  StyleProp,
  TextProps,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { OverlayTriggerState } from 'react-stately/useOverlayTriggerState'

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Text as NativeText, ScrollView, StyleSheet } from 'react-native'
import Animated from 'react-native-reanimated'
import { useOverlayTriggerState } from 'react-stately/useOverlayTriggerState'

import type { ButtonSlots } from '../../button/slots'
import type { OverlayAlign, OverlaySide } from '../../overlay'
import type { ResolvedTheme } from '../../theme/scope'

import { ButtonSlotContext } from '../../button/slots'
import { ModalWindow, panelRoleOf } from '../../modal'
import { Overlay, useAnchoredPlacement } from '../../overlay'
import {
  DismissLayer,
  PANEL_ORIGINS,
  useBackToClose,
  useFocusOnPlaced,
  usePanelMotion,
  useReturnFocus,
} from '../../overlay/panel'
import { refsOf } from '../../ref'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// kanso-ui's Popover, a panel anchored to the control that opened it. It has
// no Material Design page of its own, so it follows the tooltips page's rich
// tooltip, as web's does: a panel on surface container with the 12dp corner
// and the second elevation, inset 12dp above, 8dp below and 16dp at the
// sides, holding a subhead in title small over supporting text in body
// medium, both in on-surface variant, with no caret drawn between it and its
// anchor. It is as wide as its content, up to 320dp at `md` and 240dp at
// `sm`.
//
// **It is placed by src/overlay's anchored placement**: on `side`, lined up
// by `align`, flipped to the opposite side at the edge of the window and kept
// inside the safe area, with `start` and `end` following a right-to-left
// layout. Its content scrolls when it runs past the room on the side it
// opened on.
//
// **A non-modal popover, the default, draws in the overlay host** above the
// screen, and a screen reader can leave it for the screen around it. A press
// outside it lands on src/overlay's dismiss layer, drawn under it and hidden
// from a screen reader, which closes it. The press goes no further, so a press on the trigger
// closes it rather than opening it again, as on web. Android's back gesture
// and VoiceOver's escape gesture close it too. **A modal popover draws in a
// `Modal`**, through src/modal, as a dialog does, which keeps a screen reader
// inside it until it closes, over a scrim that draws nothing.
//
// **`trigger="hover"` opens once a pointer has rested on the trigger** for
// `delay`, an iPad's pointer or an Android mouse, and closes `closeDelay`
// after the pointer has left both the trigger and the panel, so the panel's
// own buttons stay in reach. Touch has no hover, so a press held for `delay`
// opens it too, and a popover opened that way stays open until a press
// outside it or on its trigger. A hovered popover is always non-modal, as on
// web, and one a pointer opened draws no layer under it, which would take
// the pointer off the trigger.
//
// **It fades and scales in and out**, from 95% and from the edge facing its
// anchor: in over the short3 duration on the emphasised decelerating curve,
// once it has been placed, and out over short2 on the accelerating one, as
// src/overlay's panel moves every anchored panel. Web only animates in, since
// React Aria keeps a closing surface mounted only while a CSS animation runs;
// here the panel stays mounted until its exit has run. Under reduced motion it
// appears and leaves at once, as web's does.
//
// **A screen reader follows a press.** Opened by a press, or by a press held
// on a hover trigger, it is sent to the title, or to the panel without one,
// once the panel is placed, and back to the trigger once it has gone. A
// pointer resting on the trigger moves nothing.

// How long a pointer rests on a hover trigger before the popover opens, and
// how long it has to be gone before it closes, React Aria's own defaults,
// which web's spells out.
const DEFAULT_HOVER_DELAY = 600
const DEFAULT_HOVER_CLOSE_DELAY = 200

// The widest each size draws, web's.
const WIDTHS = { md: 320, sm: 240 } as const satisfies Record<
  PopoverSize,
  number
>

// A modal popover's scrim takes presses and draws nothing.
const UNSEEN: ViewStyle = { opacity: 0 }

const stylesOf = themedStyles(
  ({ colors, radii, shadows, spacing }: ResolvedTheme) =>
    StyleSheet.create({
      // The rich tooltip's inset: 12dp above, 8dp below and 16dp at the
      // sides.
      content: {
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
      },
      description: {
        color: colors.onSurfaceVariant,
      },
      // Only as tall as its content until the panel's room runs out, where
      // it scrolls.
      scroll: {
        flexGrow: 0,
      },
      surface: {
        backgroundColor: colors.surfaceContainer,
        borderRadius: radii.md,
        boxShadow: shadows.elevation2,
        overflow: 'hidden',
      },
      title: {
        color: colors.onSurfaceVariant,
      },
    }),
)

// How a hovered popover is opened and closed by a pointer, and how it was
// opened last.
type HoverTrigger = ReturnType<typeof useHoverTrigger>

type PanelProps = Omit<PopoverContentProps, 'triggerRef'> & {
  readonly anchor: RefObject<HostInstance | null>
  /** Whether a pointer resting on the trigger opened it. */
  readonly byPointer: boolean
  readonly close: () => void
  /** Whether a press outside it lands on a layer that closes it. */
  readonly dismissable: boolean
  readonly hover: HoverTrigger
  readonly isOpen: boolean
  readonly labelledBy: string | undefined
  readonly modal: boolean
  readonly setPresent: (present: boolean) => void
  readonly size: PopoverSize
  /** The headline, which a screen reader is sent to once the panel shows. */
  readonly title: HostInstance | null
  readonly titled: PopoverTitle
}

/** Where the panel sits along the side it opens on. */
type PopoverAlign = OverlayAlign

type PopoverContentProps = Omit<ViewProps, 'children' | 'role' | 'style'> & {
  /**
   * Where the panel sits along the side it opens on. On `top` and `bottom`,
   * `start` and `end` follow a right-to-left layout.
   * @default 'center'
   */
  readonly align?: PopoverAlign
  /** Moves the panel along that side, in dp: right or down when positive. */
  readonly alignOffset?: number
  readonly children?: ReactNode
  readonly ref?: Ref<HostInstance>
  /**
   * Which side of the trigger the panel opens on. It flips to the opposite
   * side when there is no room.
   * @default 'bottom'
   */
  readonly side?: PopoverSide
  /**
   * The gap between the trigger and the panel, in dp.
   * @default spacing.sm
   */
  readonly sideOffset?: number
  readonly style?: StyleProp<ViewStyle>
  /** A view to place the panel beside other than the trigger. */
  readonly triggerRef?: RefObject<HostInstance | null>
}

type PopoverDescriptionProps = TextProps & {
  readonly ref?: Ref<HostInstance>
}

type PopoverProps = {
  /** The button that opens the popover, and `Popover.Content`. */
  readonly children?: ReactNode
  /**
   * How long the pointer has to be gone from a hovered popover's trigger
   * and panel before it closes, in milliseconds. Ignored by a pressed one.
   * @default 200
   */
  readonly closeDelay?: number
  /** Whether the popover starts open, when it keeps its own state. */
  readonly defaultOpen?: boolean
  /**
   * How long a pointer rests on a hover trigger, or a press is held on it,
   * before the popover opens, in milliseconds. Ignored by a pressed one.
   * @default 600
   */
  readonly delay?: number
  /** Whether the popover is open, when the call site holds the state. */
  readonly isOpen?: boolean
  /**
   * Keeps a screen reader inside the panel while it is open, as a dialog
   * does. Off by default: a popover leaves the screen in reach, which is the
   * difference from `Sheet`. A hovered popover is never modal.
   * @default false
   */
  readonly modal?: boolean
  /** Called with the new state as the popover opens or closes. */
  readonly onOpenChange?: (isOpen: boolean) => void
  /**
   * The panel's width: `sm` caps it at 240dp, `md` at 320dp. Either way it is
   * only as wide as its content.
   * @default 'md'
   */
  readonly size?: PopoverSize
  /**
   * What opens the panel: a press on the trigger, or a pointer resting on
   * it. `hover` is the tooltips page's rich tooltip, and on touch it opens
   * on a press held for `delay`.
   * @default 'press'
   */
  readonly trigger?: PopoverTrigger
}

// What the content reads from the root.
type PopoverRoot = {
  /** The trigger's node, which the panel is placed beside. */
  readonly anchor: RefObject<HostInstance | null>
  readonly close: () => void
  readonly hover: HoverTrigger
  readonly isOpen: boolean
  /** Whether the panel keeps a screen reader inside it. */
  readonly modal: boolean
  readonly size: PopoverSize
}

/** Which side of the trigger the panel opens on. */
type PopoverSide = OverlaySide

type PopoverSize = 'md' | 'sm'

// What the panel's parts read: the headline's id, and where its node goes.
type PopoverTitle = {
  readonly id: string
  readonly setTitle: (node: HostInstance | null) => void
}

type PopoverTitleProps = Omit<TextProps, 'role'> & {
  readonly ref?: Ref<HostInstance>
}

type PopoverTrigger = 'hover' | 'press'

const PopoverContext = createContext<null | PopoverRoot>(null)
const TitleContext = createContext<null | PopoverTitle>(null)

/**
 * A panel anchored to the control that opened it, as the tooltips spec
 * page's rich tooltip draws one. Pass `isOpen` with `onOpenChange` to hold
 * the open state, or `defaultOpen` to let it keep its own.
 *
 * ```tsx
 * <Popover>
 *   <Button variant="outlined">Open</Button>
 *   <Popover.Content>
 *     <Popover.Title>Headline</Popover.Title>
 *     <Popover.Description>Supporting text</Popover.Description>
 *   </Popover.Content>
 * </Popover>
 * ```
 *
 * Non-modal by default, which leaves the screen in reach of a screen reader,
 * and `modal` keeps one inside it. A press outside the panel and a button
 * given `slot="close"` inside it close it, and a press on its trigger
 * toggles it. Composed rather than configured by props, as web's is: a
 * `Button` or `IconButton` placed directly inside `Popover` is its trigger,
 * and the panel is placed beside it.
 */
function Popover({
  children,
  closeDelay = DEFAULT_HOVER_CLOSE_DELAY,
  defaultOpen,
  delay = DEFAULT_HOVER_DELAY,
  isOpen,
  modal = false,
  onOpenChange,
  size = 'md',
  trigger = 'press',
}: PopoverProps) {
  const state = useOverlayTriggerState({ defaultOpen, isOpen, onOpenChange })
  const anchor = useRef<HostInstance>(null)
  const hover = useHoverTrigger(state, delay, closeDelay)
  const hovering = trigger === 'hover'
  const close = useCallback(() => {
    state.close()
  }, [state])
  const slots = useMemo<ButtonSlots>(
    () =>
      hovering
        ? {
            default: hover.press,
            trigger: {
              delayLongPress: delay,
              expanded: state.isOpen,
              onHoverIn: hover.enter,
              onHoverOut: hover.leave,
              onLongPress: hover.longPress,
              ref: anchor,
            },
          }
        : {
            default: () => {
              state.toggle()
            },
            trigger: { expanded: state.isOpen, ref: anchor },
          },
    [delay, hover, hovering, state],
  )
  const root = useMemo<PopoverRoot>(
    () => ({
      anchor,
      close,
      hover,
      isOpen: state.isOpen,
      modal: modal && !hovering,
      size,
    }),
    [close, hover, hovering, modal, size, state.isOpen],
  )

  return (
    <PopoverContext value={root}>
      <ButtonSlotContext value={slots}>{children}</ButtonSlotContext>
    </PopoverContext>
  )
}

/**
 * The panel itself. Everything the popover shows goes in here; the trigger
 * stays outside it. Its content scrolls when it runs past the room the
 * window leaves on the side it opened on.
 *
 * `style`, `ref` and `testID` land on the panel.
 */
function PopoverContent({ triggerRef, ...props }: PopoverContentProps) {
  const root = use(PopoverContext)

  if (root === null) {
    throw new Error('Popover.Content is drawn inside Popover.')
  }

  const { anchor, close, hover, isOpen, modal, size } = root
  const [present, setPresent] = useState(isOpen)
  const [title, setTitle] = useState<HostInstance | null>(null)
  const [byPointer, setByPointer] = useState(hover.byPointer)
  const id = useId()
  const titled = useMemo(() => ({ id, setTitle }), [id])

  // Mounted the moment it opens, and kept until its exit has run.
  if (isOpen && !present) {
    setPresent(true)
  }

  // Whether a pointer opened it, kept until it has gone, after the root has
  // forgotten.
  if (isOpen && byPointer !== hover.byPointer) {
    setByPointer(hover.byPointer)
  }

  useReturnFocus(present, byPointer, triggerRef ?? anchor)

  if (!present) {
    return null
  }

  const labelledBy = title === null ? undefined : id
  const panel = (
    <PopoverPanel
      {...props}
      anchor={triggerRef ?? anchor}
      byPointer={byPointer}
      close={close}
      dismissable={!modal && !byPointer && isOpen}
      hover={hover}
      isOpen={isOpen}
      labelledBy={labelledBy}
      modal={modal}
      setPresent={setPresent}
      size={size}
      title={title}
      titled={titled}
    />
  )

  if (!modal) {
    return <Overlay>{panel}</Overlay>
  }

  return (
    <ModalWindow
      isKeyboardDismissDisabled={false}
      labelledBy={labelledBy}
      onClose={close}
      onScrimPress={isOpen ? close : undefined}
      scrim={UNSEEN}
      title={null}
    >
      {panel}
    </ModalWindow>
  )
}

/**
 * Supporting text under the title, in body medium on on-surface variant.
 * `style`, `ref` and `testID` land on React Native's own Text.
 */
function PopoverDescription({ style, ...props }: PopoverDescriptionProps) {
  const styles = stylesOf(useTheme())
  const role = useTypeRole('bodyMedium')

  return (
    <NativeText
      {...props}
      style={composeStyles<TextStyle>(role, styles.description, style)}
    />
  )
}

// The panel, drawn where the popover's host is: in the overlay host above the
// screen, or in the `Modal` of a modal one, so the placement measures the
// layer the panel is drawn in.
function PopoverPanel({
  align,
  alignOffset,
  anchor,
  byPointer,
  children,
  close,
  dismissable,
  hover,
  isOpen,
  labelledBy,
  modal,
  ref,
  setPresent,
  side,
  sideOffset,
  size,
  style,
  title,
  titled,
  ...props
}: PanelProps) {
  const styles = stylesOf(useTheme())
  const placement = useAnchoredPlacement({
    align,
    alignOffset,
    anchor,
    side,
    sideOffset,
  })
  const [panel, setPanel] = useState<HostInstance | null>(null)
  const motion = usePanelMotion(isOpen, placement.placed, setPresent)
  const slots = useMemo<ButtonSlots>(() => ({ close }), [close])

  useBackToClose(close, !modal && isOpen)
  useFocusOnPlaced(placement.placed && !byPointer, title ?? panel)

  return (
    <>
      {dismissable ? <DismissLayer onPress={close} /> : null}
      <Animated.View
        {...(modal
          ? panelRoleOf('dialog', labelledBy)
          : { 'aria-labelledby': labelledBy, role: 'dialog' as const })}
        onAccessibilityEscape={close}
        onPointerEnter={hover.panelEnter}
        onPointerLeave={hover.panelLeave}
        {...props}
        onLayout={placement.onLayout}
        ref={refsOf(setPanel, ref)}
        style={composeStyles<AnimatedStyle<ViewStyle>>(
          styles.surface,
          { maxWidth: WIDTHS[size] },
          placement.style,
          { transformOrigin: PANEL_ORIGINS[placement.side] },
          motion,
          style,
        )}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          style={styles.scroll}
        >
          <TitleContext value={titled}>
            <ButtonSlotContext value={slots}>{children}</ButtonSlotContext>
          </TitleContext>
        </ScrollView>
      </Animated.View>
    </>
  )
}

/**
 * Names the popover: the panel is labelled by it, and a screen reader is
 * sent to it once a pressed popover shows. In title small on on-surface
 * variant, the rich tooltip's subhead. `style`, `ref` and `testID` land on
 * React Native's own Text.
 */
function PopoverTitle({ ref, style, ...props }: PopoverTitleProps) {
  const titled = use(TitleContext)
  const styles = stylesOf(useTheme())
  const role = useTypeRole('titleSmall')

  if (titled === null) {
    throw new Error('Popover.Title is drawn inside Popover.Content.')
  }

  return (
    <NativeText
      {...props}
      nativeID={titled.id}
      ref={refsOf(titled.setTitle, ref)}
      role="heading"
      style={composeStyles<TextStyle>(role, styles.title, style)}
    />
  )
}

/**
 * How a hovered popover opens and closes. A pointer resting on the trigger
 * for `delay` opens it, and once the pointer has left both the trigger and
 * the panel for `closeDelay` it closes again. A press held for `delay` opens
 * it as well, and a popover opened that way stays open until a press outside
 * it or on the trigger. `byPointer` says whether a pointer opened it, which
 * is forgotten as it closes, however it closed.
 */
function useHoverTrigger(
  state: OverlayTriggerState,
  delay: number,
  closeDelay: number,
) {
  const [byPointer, setByPointer] = useState(false)
  const [wasOpen, setWasOpen] = useState(state.isOpen)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pointer = useRef({ onPanel: false, onTrigger: false })

  if (wasOpen !== state.isOpen) {
    setWasOpen(state.isOpen)
    if (!state.isOpen) {
      setByPointer(false)
    }
  }

  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [],
  )

  function after(milliseconds: number, then: () => void) {
    clearTimeout(timer.current)
    timer.current = setTimeout(then, milliseconds)
  }

  function closeOnceGone() {
    after(closeDelay, () => {
      if (!pointer.current.onPanel && !pointer.current.onTrigger) {
        state.close()
      }
    })
  }

  return {
    byPointer,
    enter: () => {
      pointer.current.onTrigger = true
      if (state.isOpen) {
        clearTimeout(timer.current)
        return
      }
      after(delay, () => {
        setByPointer(true)
        state.open()
      })
    },
    leave: () => {
      pointer.current.onTrigger = false
      if (!state.isOpen) {
        clearTimeout(timer.current)
      } else if (byPointer) {
        closeOnceGone()
      }
    },
    longPress: () => {
      clearTimeout(timer.current)
      setByPointer(false)
      state.open()
    },
    panelEnter: () => {
      pointer.current.onPanel = true
      clearTimeout(timer.current)
    },
    panelLeave: () => {
      pointer.current.onPanel = false
      if (byPointer) {
        closeOnceGone()
      }
    },
    press: () => {
      clearTimeout(timer.current)
      if (state.isOpen) {
        state.close()
      }
    },
  }
}

Popover.Content = PopoverContent
Popover.Description = PopoverDescription
Popover.Title = PopoverTitle

export { Popover, PopoverContent, PopoverDescription, PopoverTitle }
export type {
  PopoverAlign,
  PopoverContentProps,
  PopoverDescriptionProps,
  PopoverProps,
  PopoverSide,
  PopoverSize,
  PopoverTitleProps,
  PopoverTrigger,
}
