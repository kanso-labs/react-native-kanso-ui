import type { KeyboardEvent, KeyboardMetrics } from 'react-native'

import { useEffect, useState } from 'react'
import { Dimensions, Keyboard, Platform } from 'react-native'

type Controller = typeof import('react-native-keyboard-controller')

// Android reports the keyboard to React Native's `Keyboard` only from the
// app's own window, and a sheet, a dialog or a popover is a `Modal`, which is
// a window of its own: a field focused there moves the keyboard and reports
// nothing. react-native-keyboard-controller reports it from every window,
// once the app mounts its `KeyboardProvider`. It is an optional peer, so it
// is imported where its absence can be caught, as src/clipboard/index.ts
// imports expo-clipboard, and an app without it keeps React Native's reports
// alone. The import settles once, and to `null` once it has failed.
let loading: Promise<Controller | null> | undefined

// Where the keyboard's top edge is now, as far as React Native has heard.
function currentTop(): null | number {
  return Platform.OS === 'web' ? null : topOf(Keyboard.metrics())
}

async function load(): Promise<Controller | null> {
  try {
    return await import(/* @vite-ignore */ 'react-native-keyboard-controller')
  } catch {
    return null
  }
}

async function loadController(): Promise<Controller | null> {
  loading ??= load()
  return loading
}

// A keyboard reported with no height covers nothing.
function topOf(metrics: KeyboardMetrics | null | undefined): null | number {
  return metrics === undefined || metrics === null || metrics.height === 0
    ? null
    : metrics.screenY
}

/**
 * How far the software keyboard reaches up over a window that fills the
 * screen, in dp, or 0 while no keyboard is shown. A sheet or a dialog pads
 * its content's bottom by this much, so what it holds stays above the
 * keyboard. `enabled` false watches nothing and answers 0.
 */
function useKeyboardInset(enabled = true): number {
  const top = useKeyboardTop(enabled)

  return top === null ? 0 : Math.max(0, Dimensions.get('screen').height - top)
}

/**
 * Where the software keyboard's top edge is on the screen, in dp, or null
 * while no keyboard is shown. `enabled` false watches nothing and answers
 * null.
 */
function useKeyboardTop(enabled = true): null | number {
  const [top, setTop] = useState(() => (enabled ? currentTop() : null))
  const [watching, setWatching] = useState(enabled)

  // Nothing is heard while it is not watched, so it starts again from where
  // the keyboard is now.
  if (watching !== enabled) {
    setWatching(enabled)
    setTop(enabled ? currentTop() : null)
  }

  useEffect(() => (enabled ? watchKeyboard(setTop) : undefined), [enabled])

  return top
}

/**
 * Hands `listener` where the software keyboard's top edge is on the screen,
 * or null, each time the keyboard moves, and returns what stops it. iOS
 * reports a frame as the keyboard starts to move, and Android once it has
 * arrived or gone. On Android react-native-keyboard-controller reports it as
 * well, from whichever window holds the focused field, and where both report
 * a keyboard the higher edge wins. React Native Web has no keyboard to
 * report, and reports nothing.
 */
function watchKeyboard(listener: (top: null | number) => void): () => void {
  let native: null | number = null
  let controlled: null | number = null
  let stopped = false

  const report = () => {
    const tops = [native, controlled].filter((top) => top !== null)
    listener(tops.length === 0 ? null : Math.min(...tops))
  }
  const moved = (event: KeyboardEvent) => {
    native = topOf(event.endCoordinates)
    report()
  }
  const hidden = () => {
    native = null
    report()
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

  // The controller sees every window, so its keyboard going away is the
  // keyboard gone, whatever React Native last heard from the app's own.
  const shown = ({ height }: { readonly height: number }) => {
    controlled = height > 0 ? Dimensions.get('screen').height - height : null
    native = controlled === null ? null : native
    report()
  }
  const gone = () => {
    controlled = null
    native = null
    report()
  }
  const listen = async () => {
    const controller = await loadController()

    if (controller === null || stopped) {
      return
    }

    // A controller installed without its native half throws as it is read,
    // which leaves React Native's reports alone.
    try {
      subscriptions.push(
        controller.KeyboardEvents.addListener('keyboardWillShow', shown),
        controller.KeyboardEvents.addListener('keyboardDidShow', shown),
        controller.KeyboardEvents.addListener('keyboardWillHide', gone),
        controller.KeyboardEvents.addListener('keyboardDidHide', gone),
      )
    } catch {
      // Nothing to watch.
    }
  }

  if (Platform.OS === 'android') {
    void listen()
  }

  return () => {
    stopped = true

    for (const subscription of subscriptions) {
      subscription.remove()
    }
  }
}

export { useKeyboardInset, useKeyboardTop, watchKeyboard }
