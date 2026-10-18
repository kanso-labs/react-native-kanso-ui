import type { ComponentRef, ReactNode, Ref, RefObject } from 'react'
import type { HostInstance, View, ViewStyle } from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { EdgeInsets } from 'react-native-safe-area-context'

import { use, useEffect, useEffectEvent, useState } from 'react'
import {
  AccessibilityInfo,
  View as NativeView,
  Platform,
  StyleSheet,
} from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

import type { ResolvedTheme } from '../theme/scope'

import { CalendarFocusContext } from '../calendar'
import { IconButton } from '../components/icon-button'
import { CalendarGlyph } from '../glyphs'
import { useWindowSizeClass } from '../hooks/useWindowSizeClass'
import { insetsOf, ModalWindow, NO_INSETS, panelRoleOf } from '../modal'
import { Overlay, useAnchoredPlacement } from '../overlay'
import {
  DismissLayer,
  PANEL_ORIGINS,
  useBackToClose,
  usePanelShown,
  usePanelStyle,
  useReturnFocus,
} from '../overlay/panel'
import { useTheme } from '../theme/scope'
import { composeStyles, themedStyles } from '../theme/styles'

// What a date picker and a date range picker draw in common: the button in
// the field's trailing slot that opens the calendar, and the surface the
// calendar opens on, as kanso-ui's src/styles/picker.ts holds the two for
// web's pickers. Both pickers put the same two on screen, and a docked
// picker and a range picker that disagreed about where the modal sits would
// be two bugs rather than one. Internal: nothing here is exported from the
// package.
//
// **The surface is docked from the medium window size up and modal below
// it**, the pairing the date pickers page draws: in a compact window the
// picker is a dialog, centred over the scrim with 16dp of room around it,
// and from 600dp up it hangs under the field, placed by src/overlay as every
// anchored panel here is, and flipped above it where the window has no room
// below. Docked, a 360dp calendar anchored to a field is out of reach on a
// phone; modal, a centred calendar on a tablet covers a form for no reason.
//
// **The surface is the calendar's own fill and corner**, surface container
// high at the large corner, at the third elevation, the docked and the modal
// picker's level alike, so the calendar inside it draws no second edge.
//
// **It fades and scales in and out** as every anchored panel here does, from
// the edge facing the field docked and from its own centre modal, and the
// scrim fades with it, both ways. Under reduced motion both arrive and leave
// at once.
//
// **A screen reader goes to the date the calendar is on as it opens**, the
// date held or else the one the calendar opens on, as web's focus does,
// through the calendar's CalendarFocusContext. A surface holding no calendar
// sends it to the surface itself.

type PickerPopupProps = {
  /** The field's box, which a docked surface is placed under. */
  readonly anchor: RefObject<HostInstance | null>
  /** The calendar. */
  readonly children?: ReactNode
  readonly close: () => void
  readonly isOpen: boolean
  /** The surface's name, which is the trigger's. */
  readonly label: string
  /** The trigger, which a screen reader goes back to once the surface has gone. */
  readonly trigger: HostInstance | null
}

type PickerSurfaceProps = Omit<PickerPopupProps, 'trigger'> & {
  readonly setPresent: (present: boolean) => void
}

type PickerTriggerProps = {
  readonly isDisabled: boolean
  /** Whether the calendar is open, which the button reports. */
  readonly isOpen: boolean
  /** The button's name: what opens the calendar, then the field's label. */
  readonly label: string
  readonly onPress: () => void
  readonly ref?: Ref<ComponentRef<typeof View>>
}

const stylesOf = themedStyles(({ colors, radii, shadows }: ResolvedTheme) =>
  StyleSheet.create({
    // The modal surface's room: centred in the window, its padding 16dp
    // clear of every edge inside the safe area. It takes no touches itself,
    // so a press around the surface reaches the scrim under it.
    layout: {
      alignItems: 'center',
      bottom: 0,
      justifyContent: 'center',
      left: 0,
      pointerEvents: 'box-none',
      position: 'absolute',
      right: 0,
      top: 0,
    },
    // As wide as the calendar, and no wider than the room the layout leaves,
    // which a calendar narrows to.
    modal: {
      maxHeight: '100%',
      maxWidth: '100%',
      transformOrigin: 'center',
    },
    // The page's docked container: the calendar's own fill and corner, at
    // the third elevation, clipping the calendar to the corner.
    surface: {
      backgroundColor: colors.surfaceContainerHigh,
      borderRadius: radii.lg,
      boxShadow: shadows.elevation3,
      overflow: 'hidden',
    },
  }),
)

// The surface docked under the field, in the overlay host above the screen:
// placed at the field's start edge, flipped above it at the window's edge,
// over a layer a press outside it lands on.
function PickerDocked({
  anchor,
  children,
  close,
  isOpen,
  label,
  setPresent,
}: PickerSurfaceProps) {
  const styles = stylesOf(useTheme())
  const placement = useAnchoredPlacement({ align: 'start', anchor })
  const shown = usePanelShown(isOpen, placement.placed, setPresent)
  const motion = usePanelStyle(shown)
  const [panel, setPanel] = useState<HostInstance | null>(null)
  const [cell, setCell] = useState<HostInstance | null>(null)

  useBackToClose(close, isOpen)
  useFocusOnceReady(isOpen && placement.placed, cell ?? panel)

  return (
    <>
      {isOpen ? <DismissLayer onPress={close} /> : null}
      <Animated.View
        aria-label={label}
        onAccessibilityEscape={close}
        onLayout={placement.onLayout}
        ref={setPanel}
        role="dialog"
        style={composeStyles<AnimatedStyle<ViewStyle>>(
          styles.surface,
          placement.style,
          { transformOrigin: PANEL_ORIGINS[placement.side] },
          motion,
        )}
      >
        <CalendarFocusContext value={setCell}>{children}</CalendarFocusContext>
      </Animated.View>
    </>
  )
}

// The surface as the page's modal picker: in a `Modal`, through src/modal,
// centred over the scrim, which fades with it. A press on the scrim, the back
// gesture and VoiceOver's escape gesture close it.
function PickerModal({
  children,
  close,
  isOpen,
  label,
  setPresent,
}: PickerSurfaceProps) {
  const theme = useTheme()
  const { spacing } = theme
  const styles = stylesOf(theme)
  const insets = use(SafeAreaInsetsContext) ?? NO_INSETS
  const shown = usePanelShown(isOpen, true, setPresent)
  const motion = usePanelStyle(shown)
  const scrim = useAnimatedStyle(() => {
    'worklet'
    return { opacity: shown.get() }
  })
  const [panel, setPanel] = useState<HostInstance | null>(null)
  const [cell, setCell] = useState<HostInstance | null>(null)

  return (
    <ModalWindow
      isKeyboardDismissDisabled={false}
      label={label}
      labelledBy={undefined}
      onClose={close}
      onScrimPress={isOpen ? close : undefined}
      scrim={scrim}
      title={cell ?? panel}
    >
      <NativeView
        style={composeStyles<ViewStyle>(
          styles.layout,
          insetsOf(roomOf(insets, spacing.lg)),
        )}
      >
        <Animated.View
          {...panelRoleOf('dialog', undefined)}
          aria-label={Platform.OS === 'web' ? undefined : label}
          onAccessibilityEscape={close}
          ref={setPanel}
          style={composeStyles<AnimatedStyle<ViewStyle>>(
            styles.surface,
            styles.modal,
            motion,
          )}
        >
          <CalendarFocusContext value={setCell}>
            {children}
          </CalendarFocusContext>
        </Animated.View>
      </NativeView>
    </ModalWindow>
  )
}

/**
 * The calendar's surface while it is open and while its exit runs: mounted
 * the moment the picker opens, and kept until it has faded out, docked under
 * the field or modal in the middle of the window by the window's size. A
 * screen reader goes back to the trigger once it has gone.
 */
function PickerPopup({ trigger, ...props }: PickerPopupProps) {
  const [present, setPresent] = useState(props.isOpen)
  const modal = useWindowSizeClass() === 'compact'

  // Mounted the moment it opens, and kept until its exit has run.
  if (props.isOpen && !present) {
    setPresent(true)
  }

  useReturnFocus(present, false, { current: trigger })

  if (!present) {
    return null
  }

  return modal ? (
    <PickerModal {...props} setPresent={setPresent} />
  ) : (
    <Overlay>
      <PickerDocked {...props} setPresent={setPresent} />
    </Overlay>
  )
}

/**
 * The button in the field's trailing slot that opens the calendar: the icon
 * buttons page's 40dp standard button holding the calendar icon, reporting
 * whether the calendar is open. A disabled or read-only field disables it,
 * since neither takes a date from the calendar either.
 */
function PickerTrigger({
  isDisabled,
  isOpen,
  label,
  onPress,
  ref,
}: PickerTriggerProps) {
  return (
    <IconButton
      aria-expanded={isOpen}
      aria-label={label}
      isDisabled={isDisabled}
      onPress={onPress}
      ref={ref}
    >
      <CalendarGlyph />
    </IconButton>
  )
}

// The safe area with `room` more on every side, which the modal surface
// keeps clear of the window's edges.
function roomOf(insets: EdgeInsets, room: number): EdgeInsets {
  return {
    bottom: insets.bottom + room,
    left: insets.left + room,
    right: insets.right + room,
    top: insets.top + room,
  }
}

// Sends a screen reader to `target` as the docked surface is placed, once
// each time it opens. The date the calendar is on moves with the month shown
// and with a date pressed while the surface stays open, and a reader on the
// next month's button stays there rather than being sent after it.
function useFocusOnceReady(ready: boolean, target: HostInstance | null) {
  const sendFocus = useEffectEvent(() => {
    if (target !== null && Platform.OS !== 'web') {
      AccessibilityInfo.sendAccessibilityEvent(target, 'focus')
    }
  })

  useEffect(() => {
    if (ready) {
      sendFocus()
    }
  }, [ready])
}

export { PickerPopup, PickerTrigger, roomOf }
export type { PickerPopupProps, PickerTriggerProps }
