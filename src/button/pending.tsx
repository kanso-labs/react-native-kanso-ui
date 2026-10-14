import type { ReactNode } from 'react'
import type { ColorValue } from 'react-native'

import { useEffect, useRef } from 'react'
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native'

import type { IconStyle } from '../glyphs/icon-style'

import { ProgressIndicator } from '../components/progress-indicator'
import { IconStyleContext } from '../glyphs/icon-style'
import { messagesFor } from '../i18n'

// What a pending button draws and says, shared by Button and IconButton as
// web's ButtonBase draws it for both: the content hidden in place, the ring
// over it, and the announcement that the button has gone pending.

const pendingStyles = StyleSheet.create({
  // The label and the icon while the ring shows: still laid out, so the
  // button keeps its width, which is what stops a form jumping the moment it
  // is submitted, and not drawn.
  hidden: {
    opacity: 0,
  },
  // The ring sits over the hidden content, centred in the button, and takes
  // no touches.
  ring: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
    top: 0,
  },
})

// What a pending button reports to a screen reader, spread before the call
// site's own props, so an `aria-busy` of its own still wins, as on web.
const BUSY = { 'aria-busy': true } as const

// What takes the hidden content out of what a screen reader reads, so the
// button is named by the ring while it shows.
const CONCEALED = { 'aria-hidden': true } as const

/**
 * The icon a button draws, in a view that hides it in place while the button
 * is pending. The view is there whether or not the button is, so an icon
 * keeps its state when the button goes pending and comes back.
 */
function PendingContent({
  children,
  isPending,
}: {
  readonly children: ReactNode
  readonly isPending: boolean
}) {
  return (
    <View
      {...(isPending ? CONCEALED : undefined)}
      style={isPending ? pendingStyles.hidden : undefined}
    >
      {children}
    </View>
  )
}

/**
 * The indeterminate ring a pending button draws over its content, in the
 * button's content colour rather than the progress page's primary, which on a
 * filled button is the fill itself. `diameter` is what the content it
 * replaces measures, the label's type size on Button and the icon on
 * IconButton, which is what web's `1em` reads in each.
 */
function PendingRing({
  color,
  diameter,
  label,
}: {
  readonly color: ColorValue
  readonly diameter: number
  readonly label: string
}) {
  return (
    <View style={pendingStyles.ring}>
      <IconStyleContext value={slotOf(color, diameter)}>
        <ProgressIndicator
          aria-label={label}
          diameter={`${diameter}px`}
          isIndeterminate
          tone="inherit"
          variant="circular"
        />
      </IconStyleContext>
    </View>
  )
}

function slotOf(color: ColorValue, size: number): IconStyle {
  return { color, size }
}

/**
 * The ring's name, and the announcement a button makes as it goes pending.
 * The name is `pendingLabel`, or the word for loading in the device's locale.
 *
 * On iOS and Android the change is said through VoiceOver and TalkBack, as
 * web's is said through React Aria's live announcer, since a ring appearing
 * under them is not reliably read. Web says it only to a reader whose focus
 * is on the button; a screen reader's focus is not something a component
 * here can read, so it is said whatever has focus. A button pending as it
 * mounts says nothing, as on web, which announces a change. React Native Web
 * has no announcer, so there the ring is read when the button next is.
 */
function usePending(isPending: boolean, pendingLabel: string | undefined) {
  const label = pendingLabel ?? messagesFor().loading
  const was = useRef(isPending)

  useEffect(() => {
    if (
      isPending &&
      !was.current &&
      (Platform.OS === 'ios' || Platform.OS === 'android')
    ) {
      AccessibilityInfo.announceForAccessibility(label)
    }
    was.current = isPending
  }, [isPending, label])

  return label
}

export {
  BUSY,
  CONCEALED,
  PendingContent,
  PendingRing,
  pendingStyles,
  usePending,
}
