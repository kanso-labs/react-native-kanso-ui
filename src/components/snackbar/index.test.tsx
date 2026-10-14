import type { ComponentRef, ReactNode } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { EdgeInsets } from 'react-native-safe-area-context'
import type { TestInstance, TestNode } from 'test-renderer'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import {
  AccessibilityInfo,
  Dimensions,
  Platform,
  StyleSheet,
  View,
} from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

import type { SnackbarOptions, SnackbarProps, SnackbarQueue } from '.'

import { Snackbar } from '.'
import { ThemeScope } from '../../theme-scope'
import { scopeFor } from '../../theme/scope'

// What the next snackbar the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

const { theme } = scopeFor('light', {})
const { colors, motion, spacing } = theme

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

const INSETS: EdgeInsets = { bottom: 34, left: 12, right: 8, top: 47 }

const OFFSET = { marginBottom: 4 }

const STRIP_HEIGHT = 48

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// Shows a message, as a call site anywhere in the app would.
async function announce(
  queue: SnackbarQueue,
  message = 'Label',
  options: SnackbarOptions = {},
) {
  let key = ''
  await act(() => {
    key = queue.add(message, options)
  })
  return key
}

function child(node: TestNode | undefined): TestInstance {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

function colorOf(element: { props: { style?: StyleProp<TextStyle> } }) {
  return StyleSheet.flatten([element.props.style])?.color
}

// Lays the strip out at a single line's height, which is how far it rises.
async function layOutStrip() {
  await fireEvent(strip(), 'layout', {
    nativeEvent: { layout: { height: STRIP_HEIGHT, width: 320, x: 0, y: 0 } },
  })
  await advance(0)
}

// The region the snackbar draws its messages in.
function region() {
  return screen.getByTestId('region')
}

async function renderSnackbar(
  queue: SnackbarQueue,
  props: Partial<SnackbarProps> = {},
  insets?: EdgeInsets,
) {
  const snackbar = <Snackbar queue={queue} testID="region" {...props} />

  return render(
    <ThemeScope>
      {insets === undefined ? snackbar : withInsets(insets, snackbar)}
    </ThemeScope>,
  )
}

// The window as the platform reports it when it changes, which is what the
// size class follows.
function resize(width: number) {
  Dimensions.set({ ...INITIAL, window: { ...INITIAL.window, width } })
}

// Spies on what is said to VoiceOver and TalkBack.
function spyOnAnnouncements() {
  return jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions')
}

// The strip a message is drawn on, which is the region's one child while a
// message is up.
function strip() {
  return child(region().children[0])
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

// How far below its place an animated style puts the strip.
function translationOf(style: { transform?: unknown }) {
  const steps: readonly unknown[] = Array.isArray(style.transform)
    ? style.transform
    : []
  const [step] = steps

  return step !== null &&
    typeof step === 'object' &&
    'translateY' in step &&
    typeof step.translateY === 'number'
    ? step.translateY
    : undefined
}

function withInsets(insets: EdgeInsets, children: ReactNode) {
  return (
    <SafeAreaInsetsContext value={insets}>{children}</SafeAreaInsetsContext>
  )
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  mockReducedMotion = false
  Dimensions.set(INITIAL)
  jest.restoreAllMocks()
  jest.clearAllMocks()
  jest.useRealTimers()
})

describe('Snackbar', () => {
  describe('the queue', () => {
    it('draws nothing until a message is added', async () => {
      await renderSnackbar(new Snackbar.Queue())

      expect(region().children).toEqual([])
    })

    it('shows a message added once it is mounted', async () => {
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)

      await announce(queue, 'First item saved')

      expect(screen.getByText('First item saved')).toBeTruthy()
    })

    it('shows a message added before it was mounted', async () => {
      const queue = new Snackbar.Queue()
      queue.add('First item saved')

      await renderSnackbar(queue)

      expect(screen.getByText('First item saved')).toBeTruthy()
    })

    it('shows one message at a time, closing the one a newer replaces', async () => {
      const queue = new Snackbar.Queue()
      const first = jest.fn()
      await renderSnackbar(queue)

      await announce(queue, 'First item', { onClose: first })
      await announce(queue, 'Second item')

      expect(screen.queryByText('First item')).toBeNull()
      expect(screen.getByText('Second item')).toBeTruthy()
      expect(region().children).toHaveLength(1)
      expect(first).toHaveBeenCalledTimes(1)
    })

    it('never brings back a message a newer one replaced', async () => {
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)
      await announce(queue, 'First item')
      const second = await announce(queue, 'Second item')

      await act(() => {
        queue.close(second)
      })

      expect(region().children).toEqual([])
    })

    it('shows the next message once the first has closed', async () => {
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)
      const first = await announce(queue, 'First item')
      await act(() => {
        queue.close(first)
      })

      await announce(queue, 'Second item')

      expect(screen.getByText('Second item')).toBeTruthy()
    })

    it('closes a message by its key, running its onClose', async () => {
      const queue = new Snackbar.Queue()
      const onClose = jest.fn()
      await renderSnackbar(queue)
      const key = await announce(queue, 'Label', { onClose })

      await act(() => {
        queue.close(key)
      })

      expect(screen.queryByText('Label')).toBeNull()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('ignores the key of a message already gone', async () => {
      const queue = new Snackbar.Queue()
      const onClose = jest.fn()
      await renderSnackbar(queue)
      const first = await announce(queue, 'First item', { onClose })
      await announce(queue, 'Second item')

      await act(() => {
        queue.close(first)
      })

      expect(screen.getByText('Second item')).toBeTruthy()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('clears the message on screen, running its onClose', async () => {
      const queue = new Snackbar.Queue()
      const onClose = jest.fn()
      await renderSnackbar(queue)
      await announce(queue, 'Label', { onClose })

      await act(() => {
        queue.clear()
      })

      expect(region().children).toEqual([])
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('is empty by the time onClose runs, so it can add the next', async () => {
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)
      const key = await announce(queue, 'First item', {
        onClose: () => {
          queue.add('Second item')
        },
      })

      await act(() => {
        queue.close(key)
      })

      expect(screen.getByText('Second item')).toBeTruthy()
    })
  })

  describe('the announcement', () => {
    it.each(['ios', 'android'] as const)(
      'says each message on %s, after what is being said',
      async (os) => {
        jest.replaceProperty(Platform, 'OS', os)
        const said = spyOnAnnouncements()
        const queue = new Snackbar.Queue()
        await renderSnackbar(queue)

        await announce(queue, 'First item')
        await announce(queue, 'Second item')

        expect(said.mock.calls).toEqual([
          ['First item', { queue: true }],
          ['Second item', { queue: true }],
        ])
        expect(region().props['aria-live']).toBeUndefined()
      },
    )

    it('is a polite live region under React Native Web', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      const said = spyOnAnnouncements()
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)

      await announce(queue, 'First item')

      expect(region().props['aria-live']).toBe('polite')
      expect(said).not.toHaveBeenCalled()
    })

    it('says nothing while the queue is empty', async () => {
      const said = spyOnAnnouncements()
      await renderSnackbar(new Snackbar.Queue())

      expect(said).not.toHaveBeenCalled()
    })
  })

  describe('how long a message stays', () => {
    it('closes a message alone after five seconds', async () => {
      const queue = new Snackbar.Queue()
      const onClose = jest.fn()
      await renderSnackbar(queue)
      await announce(queue, 'Label', { onClose })

      await advance(4999)
      expect(screen.getByText('Label')).toBeTruthy()

      await advance(1)
      expect(screen.queryByText('Label')).toBeNull()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('closes a message after the timeout it was given', async () => {
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)
      await announce(queue, 'Label', { timeout: 2000 })

      await advance(1999)
      expect(screen.getByText('Label')).toBeTruthy()

      await advance(1)
      expect(screen.queryByText('Label')).toBeNull()
    })

    it('keeps a message with a timeout of 0 until it is closed', async () => {
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)
      await announce(queue, 'Label', { timeout: 0 })

      await advance(60_000)

      expect(screen.getByText('Label')).toBeTruthy()
    })

    it('times a newer message from when it arrived', async () => {
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)
      await announce(queue, 'First item')
      await advance(4000)

      await announce(queue, 'Second item')
      await advance(4000)

      expect(screen.getByText('Second item')).toBeTruthy()
    })

    it('keeps a message with an action past any timer, until the action closes it', async () => {
      const queue = new Snackbar.Queue()
      const onClose = jest.fn()
      const onPress = jest.fn()
      await renderSnackbar(queue)
      await announce(queue, 'Label', {
        action: { label: 'Undo', onPress },
        onClose,
      })

      await advance(60_000)
      expect(screen.getByText('Label')).toBeTruthy()

      await fireEvent.press(screen.getByRole('button', { name: 'Undo' }))

      expect(onPress).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onPress.mock.invocationCallOrder[0]).toBeLessThan(
        onClose.mock.invocationCallOrder[0],
      )
      expect(screen.queryByText('Label')).toBeNull()
    })

    it('holds the timer while a pointer is over the strip', async () => {
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)
      await announce(queue, 'Label')
      await advance(3000)

      await fireEvent(strip(), 'pointerEnter')
      await advance(10_000)
      expect(screen.getByText('Label')).toBeTruthy()

      await fireEvent(strip(), 'pointerLeave')
      await advance(1999)
      expect(screen.getByText('Label')).toBeTruthy()

      await advance(1)
      expect(screen.queryByText('Label')).toBeNull()
    })

    it('holds the timer while one of its controls has focus', async () => {
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)
      await announce(queue, 'Label', { showCloseButton: true })
      const close = screen.getByRole('button', { name: 'Close' })
      await advance(3000)

      await fireEvent(close, 'focus', {})
      await advance(10_000)
      expect(screen.getByText('Label')).toBeTruthy()

      await fireEvent(close, 'blur', {})
      await advance(1999)
      expect(screen.getByText('Label')).toBeTruthy()

      await advance(1)
      expect(screen.queryByText('Label')).toBeNull()
    })

    it("takes Android's recommended timeout for the reader", async () => {
      jest.replaceProperty(Platform, 'OS', 'android')
      const recommended = jest
        .spyOn(AccessibilityInfo, 'getRecommendedTimeoutMillis')
        .mockResolvedValueOnce(20_000)
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)
      await announce(queue, 'Label')

      await advance(19_999)
      expect(screen.getByText('Label')).toBeTruthy()

      await advance(1)
      expect(screen.queryByText('Label')).toBeNull()
      expect(recommended.mock.calls).toEqual([[5000]])
    })

    it('asks Android nothing for a message shown until closed', async () => {
      jest.replaceProperty(Platform, 'OS', 'android')
      const recommended = jest.spyOn(
        AccessibilityInfo,
        'getRecommendedTimeoutMillis',
      )
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)

      await announce(queue, 'Label', {
        action: { label: 'Undo', onPress() {} },
      })
      await advance(60_000)

      expect(recommended).not.toHaveBeenCalled()
      expect(screen.getByText('Label')).toBeTruthy()
    })
  })

  describe('the close button', () => {
    it('is drawn only when asked for', async () => {
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)

      await announce(queue, 'Label')

      expect(screen.queryByRole('button')).toBeNull()
    })

    it('is named Close by default', async () => {
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)

      await announce(queue, 'Label', { showCloseButton: true })

      expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    })

    it('closes the message, named by closeLabel, running onClose', async () => {
      const queue = new Snackbar.Queue()
      const onClose = jest.fn()
      await renderSnackbar(queue, { closeLabel: 'Dismiss' })
      await announce(queue, 'Label', { onClose, showCloseButton: true })

      await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }))

      expect(screen.queryByText('Label')).toBeNull()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('sits after the action', async () => {
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)

      await announce(queue, 'Label', {
        action: { label: 'Undo', onPress() {} },
        showCloseButton: true,
      })

      expect(screen.getAllByRole('button')).toEqual([
        screen.getByRole('button', { name: 'Undo' }),
        screen.getByRole('button', { name: 'Close' }),
      ])
    })
  })

  describe('placement', () => {
    it('sits on the bottom edge, 8dp in, outside a SafeAreaProvider', async () => {
      await renderSnackbar(new Snackbar.Queue())

      expect(styleOf(region())).toMatchObject({
        bottom: 0,
        left: 0,
        paddingBottom: spacing.sm,
        paddingLeft: spacing.sm,
        paddingRight: spacing.sm,
        paddingTop: spacing.sm,
        position: 'absolute',
        right: 0,
      })
    })

    it('keeps its margin clear of the safe area', async () => {
      await renderSnackbar(new Snackbar.Queue(), {}, INSETS)

      expect(styleOf(region())).toMatchObject({
        paddingBottom: spacing.sm + INSETS.bottom,
        paddingLeft: spacing.sm + INSETS.left,
        paddingRight: spacing.sm + INSETS.right,
        paddingTop: spacing.sm,
      })
    })

    it('passes a touch through wherever no message is drawn', async () => {
      await renderSnackbar(new Snackbar.Queue())

      expect(styleOf(region()).pointerEvents).toBe('box-none')
    })

    it('spans the window less its margins below 600dp', async () => {
      resize(599)
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)

      await announce(queue)

      expect(styleOf(strip())).toMatchObject({ width: '100%' })
      expect(styleOf(strip()).maxWidth).toBeUndefined()
      expect(styleOf(strip()).minWidth).toBeUndefined()
    })

    it('takes between 320 and 576dp, centred, from 600dp', async () => {
      resize(600)
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)

      await announce(queue)

      expect(styleOf(region()).alignItems).toBe('center')
      expect(styleOf(strip())).toMatchObject({
        maxWidth: 576,
        minWidth: 320,
        width: '100%',
      })
    })
  })

  describe('drawing', () => {
    it('draws the message on the inverse surface pair', async () => {
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)

      await announce(queue, 'Label')

      expect(styleOf(strip())).toMatchObject({
        backgroundColor: colors.inverseSurface,
        borderRadius: theme.radii.xs,
        boxShadow: theme.shadows.elevation3,
      })
      expect(colorOf(screen.getByText('Label'))).toBe(colors.inverseOnSurface)
    })

    it('draws the action label in inverse primary', async () => {
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)

      await announce(queue, 'Label', {
        action: { label: 'Undo', onPress() {} },
      })

      expect(colorOf(screen.getByText('Undo'))).toBe(colors.inversePrimary)
    })

    it('lets the controls drop beneath a message that needs the room', async () => {
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)

      await announce(queue, 'Label', { showCloseButton: true })
      const [message, controls] = strip().children.map(child)

      expect(styleOf(strip()).flexWrap).toBe('wrap')
      expect(styleOf(message)).toMatchObject({
        flexBasis: '50%',
        flexGrow: 1,
        minWidth: 0,
      })
      expect(styleOf(controls)).toMatchObject({
        flexShrink: 0,
        marginStart: 'auto',
      })
    })

    it('rises its own height and fades in over the medium duration', async () => {
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)
      await announce(queue)
      await layOutStrip()

      const start = getAnimatedStyle(strip())
      await advance(motion.durationMedium1 / 2)
      const midway = getAnimatedStyle(strip())
      await advance(motion.durationMedium1)
      const settled = getAnimatedStyle(strip())

      expect(start.opacity).toBeLessThan(0.1)
      expect(midway.opacity).toBeGreaterThan(0)
      expect(midway.opacity).toBeLessThan(1)
      expect(translationOf(midway)).toBeGreaterThan(0)
      expect(translationOf(midway)).toBeLessThan(STRIP_HEIGHT)
      expect(settled).toMatchObject({
        opacity: 1,
        transform: [{ translateY: 0 }],
      })
    })

    it('puts a message that was up before it mounted in place at once', async () => {
      const queue = new Snackbar.Queue()
      queue.add('First item')
      await renderSnackbar(queue)
      await layOutStrip()

      expect(getAnimatedStyle(strip())).toMatchObject({
        opacity: 1,
        transform: [{ translateY: 0 }],
      })

      await announce(queue, 'Second item')
      await layOutStrip()

      expect(getAnimatedStyle(strip()).opacity).toBeLessThan(0.1)
    })

    it('arrives settled under reduced motion', async () => {
      mockReducedMotion = true
      const queue = new Snackbar.Queue()
      await renderSnackbar(queue)
      await announce(queue)
      await layOutStrip()

      expect(getAnimatedStyle(strip())).toMatchObject({
        opacity: 1,
        transform: [{ translateY: 0 }],
      })
    })
  })

  it('lands style, ref and testID on the region', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await renderSnackbar(new Snackbar.Queue(), { ref, style: OFFSET })

    expect(styleOf(region())).toMatchObject(OFFSET)
    expect(ref.current).not.toBeNull()
  })
})
