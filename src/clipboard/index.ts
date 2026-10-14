import { useSyncExternalStore } from 'react'

type Clipboard = {
  readonly setStringAsync: (text: string) => Promise<boolean>
}

// expo-clipboard is an optional peer, so it is imported where its absence can
// be caught, as src/typography/fonts.ts imports expo-font: Metro takes an
// import inside a `try` as optional and bundles an app without it. Until the
// import settles the module is `undefined`, and `null` once it has failed,
// which is also what an app that installed it without rebuilding gets, since
// the package throws on import when its native half is missing.
let clipboard: Clipboard | null | undefined
let loading: Promise<Clipboard | null> | undefined
const listeners = new Set<() => void>()

async function load(): Promise<Clipboard | null> {
  try {
    return await import(/* @vite-ignore */ 'expo-clipboard')
  } catch {
    return null
  }
}

async function settle() {
  loading ??= load().then((settled) => {
    clipboard = settled

    for (const listener of listeners) {
      listener()
    }

    return settled
  })

  return loading
}

function snapshot() {
  void settle()
  return clipboard
}

function subscribe(listener: () => void) {
  void settle()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Whether expo-clipboard is there to write to: `false` once importing it has
 * failed, and `true` until then, so a control that copies draws at once in
 * the app that installed it rather than a moment after.
 */
function useClipboardAvailable(): boolean {
  return useSyncExternalStore(subscribe, snapshot) !== null
}

/**
 * Puts text on the clipboard, and rejects when it did not get there: when
 * expo-clipboard is not installed, or when its write says it failed. On iOS
 * and Android the write always lands. Under React Native Web it fails only
 * where the browser refuses its clipboard and its older copy command throws
 * as well, since expo-clipboard falls back to the second itself.
 */
async function writeClipboard(text: string): Promise<void> {
  const settled = await settle()

  if (settled === null) {
    throw new Error('expo-clipboard is not installed')
  }

  if (!(await settled.setStringAsync(text))) {
    throw new Error('The clipboard refused the write')
  }
}

export { useClipboardAvailable, writeClipboard }
