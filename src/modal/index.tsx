import type { ReactNode } from 'react'
import type {
  GestureResponderEvent,
  HostInstance,
  ModalProps,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { EdgeInsets } from 'react-native-safe-area-context'
import type { OverlayTriggerState } from 'react-stately/useOverlayTriggerState'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  I18nManager,
  Modal,
  Platform,
  StyleSheet,
} from 'react-native'
import { useOverlayTriggerState } from 'react-stately/useOverlayTriggerState'

import type { ButtonSlots } from '../button/slots'
import type { ResolvedTheme } from '../theme/scope'

import { AnimatedPressable } from '../button'
import { ButtonSlotContext, ButtonTooltipContext } from '../button/slots'
import { OverlayHost } from '../overlay'
import { SeparatorOrientationContext } from '../separator'
import { withOpacity } from '../theme/color'
import { useTheme } from '../theme/scope'
import { composeStyles, themedStyles } from '../theme/styles'

// The window a modal surface is drawn in, and what a dialog and a sheet share
// around it: the trigger that opens it, the open state, the scrim, and where
// focus goes as it shows and once it has gone. Internal: nothing here is
// exported from the package.
//
// **It is a React Native `Modal`**, which keeps React context, so the surface
// keeps the `ThemeScope` around it, and which is a window of its own on iOS
// and Android, above the screen and its overlays. The window therefore hosts
// overlays of its own, so a snackbar or a popover raised from inside it draws
// above it rather than under it.

// Outside a SafeAreaProvider the insets are unknown, and the window's own edge
// is the best bound there is.
const NO_INSETS: EdgeInsets = { bottom: 0, left: 0, right: 0, top: 0 }

// iOS presents a `Modal` in portrait alone unless told otherwise, which would
// turn an app held sideways round as the surface opened.
const ORIENTATIONS: ModalProps['supportedOrientations'] = [
  'portrait',
  'portrait-upside-down',
  'landscape',
  'landscape-left',
  'landscape-right',
]

// The scrim is the scrim role at 32%, the opacity Material Design gives a
// modal's scrim and web mixes in.
const SCRIM_OPACITY = 0.32

const stylesOf = themedStyles(({ colors }: ResolvedTheme) =>
  StyleSheet.create({
    scrim: {
      backgroundColor: withOpacity(colors.scrim, SCRIM_OPACITY),
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
  }),
)

/** Whether a modal surface is open, and who holds that state. */
type ModalOpenProps = {
  readonly defaultOpen?: boolean
  readonly isOpen?: boolean
  readonly onOpenChange?: (isOpen: boolean) => void
}

/**
 * What a surface's trigger part hands its content: the open state, and the
 * button that last opened it, for focus to return to.
 */
type ModalTrigger = {
  readonly state: OverlayTriggerState
  readonly trigger: HostInstance | null
}

type ModalWindowProps = {
  readonly children?: ReactNode
  /** Whether Android's back gesture and Escape on web leave it open. */
  readonly isKeyboardDismissDisabled: boolean
  /** The headline's id, which names the window on web. */
  readonly labelledBy: string | undefined
  /** What the back gesture and Escape call. */
  readonly onClose: () => void
  /** What a press on the scrim calls, or nothing where it closes nothing. */
  readonly onScrimPress: (() => void) | undefined
  /** The scrim's motion. */
  readonly scrim: AnimatedStyle<ViewStyle>
  /** The headline, which a screen reader is sent to once the window shows. */
  readonly title: HostInstance | null
}

// Sends the screen reader to the headline once the window has shown. React
// Native Web's `Modal` moves focus into itself.
function focusOf(title: HostInstance | null) {
  return () => {
    if (title !== null && Platform.OS !== 'web') {
      AccessibilityInfo.sendAccessibilityEvent(title, 'focus')
    }
  }
}

// What the back gesture does on a surface it may not close: nothing, rather
// than leaving the handler out, which Android warns about.
function ignore() {}

// The safe area as padding. The insets are physical edges, and React Native
// swaps a left and a right style under a right-to-left layout, so they are
// handed over as the start and end they are in the direction the layout runs.
function insetsOf(insets: EdgeInsets): ViewStyle {
  const rtl = I18nManager.isRTL

  return {
    paddingBottom: insets.bottom,
    paddingEnd: rtl ? insets.left : insets.right,
    paddingStart: rtl ? insets.right : insets.left,
    paddingTop: insets.top,
  }
}

/**
 * The window a modal surface is drawn in: the `Modal`, the overlays it hosts,
 * and the scrim, with the surface itself as its children.
 */
function ModalWindow({
  children,
  isKeyboardDismissDisabled,
  labelledBy,
  onClose,
  onScrimPress,
  scrim,
  title,
}: ModalWindowProps) {
  const styles = stylesOf(useTheme())

  return (
    <Modal
      animationType="none"
      aria-labelledby={Platform.OS === 'web' ? labelledBy : undefined}
      navigationBarTranslucent
      onRequestClose={isKeyboardDismissDisabled ? ignore : onClose}
      onShow={focusOf(title)}
      statusBarTranslucent
      supportedOrientations={ORIENTATIONS}
      transparent
      visible
    >
      {/* Nothing in the window takes the trigger's slot, the overlays it
          hosts included, so a button in a snackbar raised from the surface
          opens nothing; only the surface's buttons take the close slot. Nor
          does a button in it take the tooltip of the one that opened it, nor
          a rule in it run the way the toolbar that opened it set. */}
      <ButtonSlotContext value={null}>
        <ButtonTooltipContext value={null}>
          <SeparatorOrientationContext value={null}>
            <OverlayHost>
              {/* A screen reader and a keyboard skip the scrim: the first
              closes the surface with the back or escape gesture, the second
              with Escape. React Native Web's Pressable is a tab stop unless
              told otherwise, whatever `focusable` says. */}
              <AnimatedPressable
                accessible={false}
                aria-hidden
                focusable={false}
                onPress={onScrimPress}
                style={composeStyles<AnimatedStyle<ViewStyle>>(
                  styles.scrim,
                  scrim,
                )}
                tabIndex={-1}
              />
              {children}
            </OverlayHost>
          </SeparatorOrientationContext>
        </ButtonTooltipContext>
      </ButtonSlotContext>
    </Modal>
  )
}

// The surface's role and name on iOS and Android. On web React Native Web's
// `Modal` is the dialog element, so the surface takes neither there.
function panelRoleOf(
  role: 'alertdialog' | 'dialog',
  labelledBy: string | undefined,
): Pick<ViewProps, 'aria-labelledby' | 'aria-modal' | 'role'> {
  if (Platform.OS === 'web') {
    return {}
  }

  return { 'aria-labelledby': labelledBy, 'aria-modal': true, role }
}

// Counts each part as it mounts and unmounts, so the parts around it know
// which of them are there.
function registerOf<Part extends string>(
  setParts: (
    update: (
      parts: Readonly<Record<Part, number>>,
    ) => Readonly<Record<Part, number>>,
  ) => void,
) {
  return (part: Part) => {
    setParts((parts) => ({ ...parts, [part]: parts[part] + 1 }))

    return () => {
      setParts((parts) => ({ ...parts, [part]: parts[part] - 1 }))
    }
  }
}

/**
 * The open state a surface's content part reads: its trigger's, inside one,
 * and its own otherwise. `present` stays true from the moment it opens until
 * the call site's exit has run and set it false, and the close slot and the
 * scrim close it through `close`.
 */
function useModalState(outer: ModalTrigger | null, props: ModalOpenProps) {
  const own = useOverlayTriggerState(props)
  const state = outer?.state ?? own
  const [present, setPresent] = useState(state.isOpen)
  const close = useCallback(() => {
    state.close()
  }, [state])
  const slots = useMemo<ButtonSlots>(() => ({ close }), [close])

  // Mounted the moment it opens, and kept until its exit has run.
  if (state.isOpen && !present) {
    setPresent(true)
  }

  useReturnFocus(present, outer)

  return { close, present, setPresent, slots, state }
}

/**
 * The open state a surface's trigger part holds, and the default slot a
 * button inside it fills: it records itself as the button focus returns to,
 * and opens the surface. React Native types the target as a bare view tag
 * too, which focus cannot be sent to, so such a press records nothing.
 */
function useModalTrigger(props: ModalOpenProps) {
  const state = useOverlayTriggerState(props)
  const [trigger, setTrigger] = useState<HostInstance | null>(null)
  const context = useMemo<ModalTrigger>(
    () => ({ state, trigger }),
    [state, trigger],
  )
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

  return { context, slots }
}

// Sends the screen reader back to the button that opened the surface once it
// has gone. React Native Web's `Modal` restores focus itself.
function useReturnFocus(present: boolean, outer: ModalTrigger | null) {
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

export {
  insetsOf,
  ModalWindow,
  NO_INSETS,
  panelRoleOf,
  registerOf,
  useModalState,
  useModalTrigger,
}
export type { ModalOpenProps, ModalTrigger }
