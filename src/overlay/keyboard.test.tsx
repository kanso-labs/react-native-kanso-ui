import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { act, render, screen } from '@testing-library/react-native'
import {
  DeviceEventEmitter,
  Dimensions,
  Keyboard,
  Platform,
  Text,
} from 'react-native'

import { useKeyboardInset, useKeyboardTop } from './keyboard'

type Listener = (event: { readonly height: number }) => void

// What the controller's listeners are, by event, as an app's native half
// would call them.
const mockListeners = new Map<string, Set<Listener>>()

// The app has react-native-keyboard-controller installed in this file, since
// the import is settled once per file.
jest.mock(
  'react-native-keyboard-controller',
  () => ({
    KeyboardEvents: {
      addListener: (name: string, listener: Listener) => {
        const listeners = mockListeners.get(name) ?? new Set<Listener>()

        listeners.add(listener)
        mockListeners.set(name, listeners)

        return { remove: () => listeners.delete(listener) }
      },
    },
  }),
  { virtual: true },
)

const SCREEN = 800

async function controller(name: string, height: number) {
  await act(() => {
    for (const listener of mockListeners.get(name) ?? []) {
      listener({ height })
    }
  })
}

function listening() {
  return [...mockListeners.values()].reduce((sum, set) => sum + set.size, 0)
}

// The controller's import settles on a later tick.
async function loaded() {
  await act(async () => {
    await new Promise((resolve) => {
      setImmediate(resolve)
    })
  })
}

async function native(
  name: string,
  screenY: number,
  height = SCREEN - screenY,
) {
  await act(() => {
    DeviceEventEmitter.emit(name, {
      duration: 0,
      easing: 'keyboard',
      endCoordinates: { height, screenX: 0, screenY, width: 400 },
    })
  })
}

// Writes out what the two hooks answer, which `seen` reads back.
function Probe({ enabled = true }: { readonly enabled?: boolean }) {
  const inset = useKeyboardInset(enabled)
  const top = useKeyboardTop(enabled)

  return (
    <>
      <Text testID="inset">{inset}</Text>
      <Text testID="top">{top ?? 'none'}</Text>
    </>
  )
}

function seen(): { inset: number; top: null | number } {
  const top = written('top')

  return {
    inset: Number(written('inset')),
    top: top === 'none' ? null : Number(top),
  }
}

// What the probe wrote under `testID`.
function written(testID: string): string {
  return String(screen.getByTestId(testID).props.children)
}

beforeEach(() => {
  const metrics = { fontScale: 1, height: SCREEN, scale: 1, width: 400 }

  Dimensions.set({ screen: metrics, window: metrics })
  mockListeners.clear()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('the keyboard on Android', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android')
  })

  it('hears the controller, which reports from every window', async () => {
    await render(<Probe />)
    await loaded()

    await controller('keyboardWillShow', 300)

    expect(seen()).toEqual({ inset: 300, top: 500 })

    await controller('keyboardDidHide', 0)

    expect(seen()).toEqual({ inset: 0, top: null })
  })

  it("hears React Native's own reports beside it", async () => {
    await render(<Probe />)
    await loaded()

    await native('keyboardDidShow', 520)

    expect(seen()).toEqual({ inset: 280, top: 520 })

    await native('keyboardDidHide', SCREEN, 0)

    expect(seen()).toEqual({ inset: 0, top: null })
  })

  it('takes the higher edge where both report a keyboard', async () => {
    await render(<Probe />)
    await loaded()

    await native('keyboardDidShow', 520)
    await controller('keyboardDidShow', 320)

    expect(seen().top).toBe(480)
  })

  it('reads the keyboard gone once the controller says so', async () => {
    await render(<Probe />)
    await loaded()

    await native('keyboardDidShow', 520)
    await controller('keyboardDidShow', 280)
    // A modal's keyboard closing tells the app's own window nothing.
    await controller('keyboardWillHide', 0)

    expect(seen().top).toBeNull()
  })

  it('stops listening once it unmounts', async () => {
    const { unmount } = await render(<Probe />)

    await loaded()

    // Four events for each of the probe's two hooks.
    expect(listening()).toBe(8)

    await unmount()

    expect(listening()).toBe(0)
  })

  it('adds nothing when it unmounts before the import settles', async () => {
    const { unmount } = await render(<Probe />)

    await unmount()
    await loaded()

    expect(listening()).toBe(0)
  })

  it('watches nothing while it is not enabled', async () => {
    const { rerender } = await render(<Probe enabled={false} />)

    await loaded()

    expect(listening()).toBe(0)

    await controller('keyboardDidShow', 300)
    await native('keyboardDidShow', 500)

    expect(seen()).toEqual({ inset: 0, top: null })

    jest
      .spyOn(Keyboard, 'metrics')
      .mockReturnValue({ height: 300, screenX: 0, screenY: 500, width: 400 })
    await rerender(<Probe />)

    // Enabled again, it starts from where the keyboard is now.
    expect(seen()).toEqual({ inset: 300, top: 500 })
  })
})

describe('the keyboard on iOS', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'ios')
  })

  it('hears the frame as the keyboard starts to move', async () => {
    await render(<Probe />)

    await native('keyboardWillChangeFrame', 460)

    expect(seen()).toEqual({ inset: 340, top: 460 })

    await native('keyboardWillHide', SCREEN, 0)

    expect(seen()).toEqual({ inset: 0, top: null })
  })

  it('asks nothing of the controller', async () => {
    await render(<Probe />)
    await loaded()

    expect(listening()).toBe(0)
  })

  it('starts from a keyboard already up', async () => {
    jest
      .spyOn(Keyboard, 'metrics')
      .mockReturnValue({ height: 336, screenX: 0, screenY: 464, width: 400 })

    await render(<Probe />)

    expect(seen()).toEqual({ inset: 336, top: 464 })
  })
})
