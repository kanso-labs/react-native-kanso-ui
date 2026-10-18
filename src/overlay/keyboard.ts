import type { KeyboardEvent, KeyboardMetrics } from 'react-native'

import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

// A keyboard reported with no height covers nothing.
function topOf(metrics: KeyboardMetrics | null | undefined): null | number {
  return metrics === undefined || metrics === null || metrics.height === 0
    ? null
    : metrics.screenY
}

/**
 * Where the software keyboard's top edge is in the window, in dp, or null
 * while no keyboard is shown, for a surface that has to stay above it. A
 * field's list opens while its keyboard is up, and the keyboard is drawn
 * over the window rather than shrinking it, so the window's own edge would
 * put the bottom of the list under the keys.
 */
function useKeyboardTop(): null | number {
  const [top, setTop] = useState(() =>
    Platform.OS === 'web' ? null : topOf(Keyboard.metrics()),
  )

  useEffect(() => watchKeyboard(setTop), [])

  return top
}

/**
 * Hands `listener` where the software keyboard's top edge is, or null, each
 * time the keyboard moves, and returns what stops it. iOS reports a frame as
 * the keyboard starts to move, and Android once it has arrived or gone,
 * which is all either reports. React Native Web has no keyboard to report,
 * and reports nothing.
 */
function watchKeyboard(listener: (top: null | number) => void): () => void {
  const moved = (event: KeyboardEvent) => {
    listener(topOf(event.endCoordinates))
  }
  const hidden = () => {
    listener(null)
  }
  const subscriptions =
    Platform.OS === 'ios'
      ? [
          Keyboard.addListener('keyboardWillChangeFrame', moved),
          Keyboard.addListener('keyboardWillHide', hidden),
        ]
      : [
          Keyboard.addListener('keyboardDidShow', moved),
          Keyboard.addListener('keyboardDidHide', hidden),
        ]

  return () => {
    for (const subscription of subscriptions) {
      subscription.remove()
    }
  }
}

export { useKeyboardTop, watchKeyboard }
