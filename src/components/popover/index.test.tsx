import type { ComponentRef, ReactNode } from 'react'
import type {
  HostInstance,
  MeasureInWindowOnSuccessCallback,
  StyleProp,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { TestInstance, TestNode } from 'test-renderer'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native'
import { createRef, useCallback, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  BackHandler,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { PopoverContentProps, PopoverProps } from '.'

import { Popover } from '.'
import { PersonGlyph } from '../../glyphs'
import { ThemeScope } from '../../theme-scope'
import { scopeFor } from '../../theme/scope'
import { Button } from '../button'
import { IconButton } from '../icon-button'

// What the next popover the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

// What Android's back gesture is handed to.
type BackListener = Parameters<typeof BackHandler.addEventListener>[1]

type Frame = readonly [x: number, y: number, width: number, height: number]

// What React Native's Jest preset draws a View as: a class component holding
// its props, with the native methods on its prototype.
type MockedView = Pick<HostInstance, 'measureInWindow'> & {
  readonly props: ViewProps
}

const { theme } = scopeFor('light', {})
const { colors, motion, radii, shadows, spacing, typography } = theme

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

// Where `measureInWindow` reports each view: the trigger and the other
// anchor by their test ids, and the overlay layer, the only other view
// measured, filling a 400 by 800 window.
const FRAMES: Readonly<Record<string, Frame>> = {
  elsewhere: [20, 600, 60, 20],
  trigger: [180, 300, 40, 40],
}
const LAYER: Frame = [0, 0, 400, 800]

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

function child(node: TestNode | undefined): TestInstance {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

// A popover whose trigger lives elsewhere: the panel is placed beside the
// view `triggerRef` names.
function Elsewhere() {
  const anchor = useRef<ComponentRef<typeof View>>(null)

  return (
    <ThemeScope>
      <View ref={anchor} testID="elsewhere" />
      <Popover defaultOpen>
        <Button testID="trigger">Open</Button>
        <Popover.Content testID="panel" triggerRef={anchor}>
          <Popover.Title>Headline</Popover.Title>
        </Popover.Content>
      </Popover>
    </ThemeScope>
  )
}

// What the trigger tells a screen reader about the popover it opens.
function expanded() {
  const state: unknown = trigger().props.accessibilityState

  return typeof state === 'object' && state !== null && 'expanded' in state
    ? state.expanded
    : undefined
}

// A popover whose open state the call site holds, opened from a press on
// something other than its trigger.
function Held() {
  const [isOpen, setOpen] = useState(false)
  const open = useCallback(() => {
    setOpen(true)
  }, [])

  return (
    <ThemeScope>
      <Text onPress={open}>Elsewhere</Text>
      <Popover isOpen={isOpen} onOpenChange={setOpen}>
        <Button>Open</Button>
        <Popover.Content testID="panel">
          <Popover.Title>Headline</Popover.Title>
        </Popover.Content>
      </Popover>
    </ThemeScope>
  )
}

function isMockedView(value: unknown): value is MockedView {
  return (
    typeof value === 'object' && value !== null && 'measureInWindow' in value
  )
}

// Reports the panel's size, which is what places it.
async function laidOut(width = 200, height = 100) {
  await fireEvent(panel(), 'layout', {
    nativeEvent: { layout: { height, width, x: 0, y: 0 } },
  })
}

// The layer a press outside the panel lands on, drawn just before it.
function layer() {
  const siblings = panel().parent?.children ?? []

  return child(siblings[siblings.indexOf(panel()) - 1])
}

function panel() {
  return screen.getByTestId('panel')
}

// Renders a popover with a trigger, a title, a description and a button that
// closes it, the shape a call site draws.
async function renderPopover(
  props: Partial<PopoverProps> = {},
  content: Partial<PopoverContentProps> = {},
) {
  return render(
    <ThemeScope>
      <Popover {...props}>
        <Button testID="trigger" variant="outlined">
          Open
        </Button>
        <Popover.Content testID="panel" {...content}>
          <Popover.Title>Headline</Popover.Title>
          <Popover.Description>Supporting line</Popover.Description>
          <Button slot="close" variant="text">
            Dismiss
          </Button>
        </Popover.Content>
      </Popover>
    </ThemeScope>,
  )
}

function resize(width: number, height: number) {
  const metrics = { fontScale: 1, height, scale: 1, width }

  Dimensions.set({ screen: metrics, window: metrics })
}

// A user whose presses advance the fake clock.
function setUpUser() {
  return userEvent.setup({
    advanceTimers: (delay) => {
      jest.advanceTimersByTime(delay)
    },
  })
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function textStyleOf(element: {
  props: { style?: StyleProp<TextStyle> }
}): TextStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function trigger() {
  return screen.getByTestId('trigger')
}

function withScope(children: ReactNode) {
  return <ThemeScope>{children}</ThemeScope>
}

beforeEach(() => {
  jest.useFakeTimers()
  resize(400, 800)
  const prototype: unknown = View.prototype

  if (!isMockedView(prototype)) {
    throw new TypeError('expected the View the Jest preset mocks')
  }

  jest.spyOn(prototype, 'measureInWindow').mockImplementation(function measure(
    this: MockedView,
    callback: MeasureInWindowOnSuccessCallback,
  ) {
    const testID = this.props.testID ?? ''

    callback(...(FRAMES[testID] ?? LAYER))
  })
})

afterEach(() => {
  mockReducedMotion = false
  Dimensions.set(INITIAL)
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('Popover', () => {
  describe('opening and closing', () => {
    it('opens from its trigger and shows its title and description', async () => {
      await renderPopover()

      expect(screen.queryByTestId('panel')).toBe(null)

      await fireEvent.press(trigger())

      expect(panel().props.role).toBe('dialog')
      expect(screen.getByText('Headline')).toBeTruthy()
      expect(screen.getByText('Supporting line')).toBeTruthy()
    })

    it('closes from a press outside the panel', async () => {
      await renderPopover({ defaultOpen: true })

      await fireEvent.press(layer())
      await advance(motion.durationShort2)

      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it('closes from a second press on its trigger', async () => {
      const onOpenChange = jest.fn()
      await renderPopover({ onOpenChange })

      await fireEvent.press(trigger())
      await fireEvent.press(trigger())

      expect(onOpenChange.mock.calls).toEqual([[true], [false]])

      await advance(motion.durationShort2)

      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it('closes from a button given slot="close"', async () => {
      await renderPopover({ defaultOpen: true })
      await laidOut()

      await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }))
      await advance(motion.durationShort2)

      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it('opens nothing from a button inside the panel', async () => {
      const onOpenChange = jest.fn()
      await render(
        withScope(
          <Popover defaultOpen onOpenChange={onOpenChange}>
            <Button>Open</Button>
            <Popover.Content testID="panel">
              <Popover.Title>Headline</Popover.Title>
              <Button>Inside</Button>
            </Popover.Content>
          </Popover>,
        ),
      )
      await laidOut()

      await fireEvent.press(screen.getByRole('button', { name: 'Inside' }))

      expect(onOpenChange).not.toHaveBeenCalled()
      expect(panel()).toBeTruthy()
    })

    it("closes from Android's back gesture", async () => {
      const listeners: BackListener[] = []
      jest
        .spyOn(BackHandler, 'addEventListener')
        .mockImplementation((_, listener) => {
          listeners.push(listener)
          return { remove: jest.fn() }
        })
      await renderPopover({ defaultOpen: true })

      let handled: boolean | undefined = false
      await act(() => {
        handled = listeners.at(-1)?.({
          timeStamp: 0,
          type: 'hardwareBackPress',
        })
      })
      await advance(motion.durationShort2)

      expect(handled).toBe(true)
      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it("closes from VoiceOver's escape gesture", async () => {
      await renderPopover({ defaultOpen: true })

      await fireEvent(panel(), 'accessibilityEscape')
      await advance(motion.durationShort2)

      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it('follows isOpen when the call site holds the state', async () => {
      await render(<Held />)

      await fireEvent.press(screen.getByText('Elsewhere'))

      expect(panel()).toBeTruthy()
    })

    it('stays mounted until its exit has run', async () => {
      await renderPopover({ defaultOpen: true })

      await fireEvent.press(layer())
      await advance(motion.durationShort2 - 1)

      expect(panel()).toBeTruthy()

      await advance(1)

      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it('takes presses through once it starts to close', async () => {
      await renderPopover({ defaultOpen: true })

      await fireEvent.press(layer())

      expect(panel().parent?.children).toHaveLength(1)
    })

    it('is drawn inside Popover', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {})

      await expect(
        render(withScope(<Popover.Content>Supporting line</Popover.Content>)),
      ).rejects.toThrow('Popover.Content is drawn inside Popover.')
    })

    it('draws its title inside Popover.Content', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {})

      await expect(
        render(withScope(<Popover.Title>Headline</Popover.Title>)),
      ).rejects.toThrow('Popover.Title is drawn inside Popover.Content.')
    })
  })

  describe('the trigger', () => {
    it('says whether the popover is open', async () => {
      await renderPopover()

      expect(expanded()).toBe(false)

      await fireEvent.press(trigger())

      expect(expanded()).toBe(true)
    })

    it("keeps the call site's own press and ref", async () => {
      const onPress = jest.fn()
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        withScope(
          <Popover>
            <Button onPress={onPress} ref={ref} testID="trigger">
              Open
            </Button>
            <Popover.Content testID="panel">
              <Popover.Title>Headline</Popover.Title>
            </Popover.Content>
          </Popover>,
        ),
      )

      await fireEvent.press(trigger())

      expect(onPress).toHaveBeenCalledTimes(1)
      expect(ref.current).not.toBe(null)
      expect(panel()).toBeTruthy()
    })

    it('opens from an IconButton too', async () => {
      await render(
        withScope(
          <Popover>
            <IconButton aria-label="Label" testID="trigger">
              <PersonGlyph />
            </IconButton>
            <Popover.Content testID="panel">
              <Popover.Title>Headline</Popover.Title>
            </Popover.Content>
          </Popover>,
        ),
      )

      expect(expanded()).toBe(false)

      await fireEvent.press(trigger())

      expect(panel()).toBeTruthy()
    })

    it('leaves a link inside it out of the slot', async () => {
      await render(
        withScope(
          <Popover>
            <Button href="https://example.com" testID="trigger">
              Open
            </Button>
            <Popover.Content testID="panel">
              <Popover.Title>Headline</Popover.Title>
            </Popover.Content>
          </Popover>,
        ),
      )

      expect(expanded()).toBe(undefined)
    })

    it('leaves a button outside a popover untouched', async () => {
      await render(<Button testID="trigger">Open</Button>)

      expect(expanded()).toBe(undefined)
      expect(trigger().props.delayLongPress).toBe(undefined)
    })
  })

  describe('trigger="hover"', () => {
    it('opens on a press held for delay', async () => {
      const user = setUpUser()
      await renderPopover({ trigger: 'hover' })

      await user.longPress(trigger(), { duration: 500 })

      expect(screen.queryByTestId('panel')).toBe(null)

      await user.longPress(trigger(), { duration: 600 })

      expect(panel()).toBeTruthy()
    })

    it('takes its own delay', async () => {
      const user = setUpUser()
      await renderPopover({ delay: 1000, trigger: 'hover' })

      await user.longPress(trigger(), { duration: 900 })

      expect(screen.queryByTestId('panel')).toBe(null)

      await user.longPress(trigger(), { duration: 1000 })

      expect(panel()).toBeTruthy()
    })

    it('stays open after a long press until a press outside', async () => {
      const user = setUpUser()
      await renderPopover({ trigger: 'hover' })

      await user.longPress(trigger(), { duration: 600 })
      await advance(1000)

      expect(panel()).toBeTruthy()

      await fireEvent.press(layer())
      await advance(motion.durationShort2)

      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it('opens once a pointer has rested on the trigger for delay', async () => {
      await renderPopover({ trigger: 'hover' })

      await fireEvent(trigger(), 'hoverIn')
      await advance(599)

      expect(screen.queryByTestId('panel')).toBe(null)

      await advance(1)

      expect(panel()).toBeTruthy()
    })

    it('opens nothing for a pointer that leaves before delay', async () => {
      await renderPopover({ trigger: 'hover' })

      await fireEvent(trigger(), 'hoverIn')
      await advance(300)
      await fireEvent(trigger(), 'hoverOut')
      await advance(600)

      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it('closes closeDelay after the pointer leaves', async () => {
      await renderPopover({ closeDelay: 300, trigger: 'hover' })

      await fireEvent(trigger(), 'hoverIn')
      await advance(600)
      await fireEvent(trigger(), 'hoverOut')
      await advance(299)

      expect(expanded()).toBe(true)

      await advance(1)

      expect(expanded()).toBe(false)
    })

    it('stays open while the pointer is over the panel', async () => {
      await renderPopover({ trigger: 'hover' })

      await fireEvent(trigger(), 'hoverIn')
      await advance(600)
      await fireEvent(trigger(), 'hoverOut')
      await fireEvent(panel(), 'pointerEnter')
      await advance(1000)

      expect(expanded()).toBe(true)

      await fireEvent(panel(), 'pointerLeave')
      await advance(200)

      expect(expanded()).toBe(false)
    })

    it('draws no layer under a panel a pointer opened', async () => {
      await renderPopover({ trigger: 'hover' })

      await fireEvent(trigger(), 'hoverIn')
      await advance(600)

      expect(panel().parent?.children).toHaveLength(1)
    })

    it('closes from a press on the trigger, and opens nothing from one', async () => {
      const onOpenChange = jest.fn()
      await renderPopover({ onOpenChange, trigger: 'hover' })

      await fireEvent.press(trigger())

      expect(onOpenChange).not.toHaveBeenCalled()

      await fireEvent(trigger(), 'hoverIn')
      await advance(600)
      await fireEvent.press(trigger())

      expect(onOpenChange.mock.calls).toEqual([[true], [false]])
    })

    it('is never modal', async () => {
      await renderPopover({ defaultOpen: true, modal: true, trigger: 'hover' })

      expect(panel().props['aria-modal']).toBe(undefined)
    })
  })

  describe('placement', () => {
    it('sits below its trigger, centred on it, spacing.sm away', async () => {
      await renderPopover({ defaultOpen: true })
      await laidOut()

      expect(styleOf(panel())).toMatchObject({
        left: 100,
        position: 'absolute',
        top: 340 + spacing.sm,
      })
    })

    it('takes the side, the alignment and the offsets', async () => {
      await renderPopover(
        { defaultOpen: true },
        { align: 'start', alignOffset: 4, side: 'top', sideOffset: 20 },
      )
      await laidOut()

      expect(styleOf(panel())).toMatchObject({ left: 184, top: 180 })
    })

    it('grows from the edge facing its trigger', async () => {
      await renderPopover({ defaultOpen: true }, { side: 'right' })
      await laidOut()

      expect(styleOf(panel()).transformOrigin).toBe('left')
    })

    it('flips to the other side when there is no room', async () => {
      await renderPopover({ defaultOpen: true }, { side: 'top' })
      await laidOut(200, 320)

      expect(styleOf(panel())).toMatchObject({
        top: 340 + spacing.sm,
        transformOrigin: 'top',
      })
    })

    it('is placed beside triggerRef when given one', async () => {
      await render(<Elsewhere />)
      await laidOut(100, 40)

      expect(styleOf(panel())).toMatchObject({ top: 620 + spacing.sm })
    })

    it('is hidden until it is placed', async () => {
      await renderPopover({ defaultOpen: true })

      expect(styleOf(panel())).toMatchObject({ opacity: 0 })
    })
  })

  describe('appearance', () => {
    it('is the rich tooltip: surface container, the 12dp corner, the second elevation', async () => {
      await renderPopover({ defaultOpen: true })

      expect(styleOf(panel())).toMatchObject({
        backgroundColor: colors.surfaceContainer,
        borderRadius: radii.md,
        boxShadow: shadows.elevation2,
      })
    })

    it('is inset 12dp above, 8dp below and 16dp at the sides', async () => {
      await renderPopover({ defaultOpen: true })

      const scroll: {
        props: { contentContainerStyle?: StyleProp<ViewStyle> }
      } = child(panel().children[0])

      expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toEqual({
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
      })
    })

    it('is at most 320dp wide at md and 240dp at sm', async () => {
      await renderPopover({ defaultOpen: true })

      expect(styleOf(panel()).maxWidth).toBe(320)

      await screen.rerender(withScope(null))
      await renderPopover({ defaultOpen: true, size: 'sm' })

      expect(styleOf(panel()).maxWidth).toBe(240)
    })

    it('draws its title in title small and its description in body medium', async () => {
      await renderPopover({ defaultOpen: true })

      expect(textStyleOf(screen.getByText('Headline'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.titleSmallSize,
      })
      expect(textStyleOf(screen.getByText('Supporting line'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.bodyMediumSize,
      })
    })

    it("lands the call site's style on the panel", async () => {
      await renderPopover({ defaultOpen: true }, { style: { minWidth: 120 } })

      expect(styleOf(panel()).minWidth).toBe(120)
    })
  })

  describe('semantics', () => {
    it('is a non-modal dialog named by its title', async () => {
      await renderPopover({ defaultOpen: true })

      const title = screen.getByText('Headline')

      expect(panel().props.role).toBe('dialog')
      expect(panel().props['aria-modal']).toBe(undefined)
      expect(panel().props['aria-labelledby']).toBe(title.props.nativeID)
      expect(screen.getByRole('heading', { name: 'Headline' })).toBe(title)
    })

    it('keeps the layer from screen readers and the keyboard', async () => {
      await renderPopover({ defaultOpen: true })

      expect(layer().props).toMatchObject({
        accessible: false,
        'aria-hidden': true,
        focusable: false,
        tabIndex: -1,
      })
    })

    it('is drawn in a Modal and keeps a screen reader inside when modal', async () => {
      await renderPopover({ defaultOpen: true, modal: true })

      expect(panel().props).toMatchObject({
        'aria-modal': true,
        role: 'dialog',
      })
      expect(panel().parent?.type).toBe('Modal')
      expect(panel().parent?.props.visible).toBe(true)
    })

    it('draws a modal scrim that takes presses and shows nothing', async () => {
      await renderPopover({ defaultOpen: true, modal: true })

      const scrim = child(panel().parent?.children[0])

      expect(styleOf(scrim).opacity).toBe(0)

      await fireEvent.press(scrim)
      await advance(motion.durationShort2)

      expect(screen.queryByTestId('panel')).toBe(null)
    })
  })

  describe('motion', () => {
    it('fades and scales in from 95% once it is placed', async () => {
      await renderPopover({ defaultOpen: true })
      await advance(motion.durationShort3)

      expect(getAnimatedStyle(panel())).toMatchObject({
        opacity: 0,
        transform: [{ scale: 0.95 }],
      })

      await laidOut()
      await advance(motion.durationShort3)

      expect(getAnimatedStyle(panel())).toMatchObject({
        opacity: 1,
        transform: [{ scale: 1 }],
      })
    })

    it('appears and leaves at once under reduced motion', async () => {
      mockReducedMotion = true
      await renderPopover({ defaultOpen: true })
      await laidOut()
      await advance(0)

      expect(getAnimatedStyle(panel())).toMatchObject({ opacity: 1 })

      await fireEvent.press(layer())

      expect(screen.queryByTestId('panel')).toBe(null)
    })
  })

  describe('focus', () => {
    it('sends the screen reader to the title once it is placed', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      const ref = createRef<ComponentRef<typeof Text>>()
      await render(
        withScope(
          <Popover>
            <Button testID="trigger">Open</Button>
            <Popover.Content testID="panel">
              <Popover.Title ref={ref}>Headline</Popover.Title>
            </Popover.Content>
          </Popover>,
        ),
      )

      await fireEvent.press(trigger())

      expect(send).not.toHaveBeenCalled()

      await laidOut()

      expect(ref.current).not.toBe(null)
      expect(send).toHaveBeenCalledWith(ref.current, 'focus')
    })

    it('sends it to the panel when it has no title', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      const ref = createRef<HostInstance>()
      await render(
        withScope(
          <Popover>
            <Button testID="trigger">Open</Button>
            <Popover.Content ref={ref} testID="panel">
              <Popover.Description>Supporting line</Popover.Description>
            </Popover.Content>
          </Popover>,
        ),
      )

      await fireEvent.press(trigger())
      await laidOut()

      expect(ref.current).not.toBe(null)
      expect(send).toHaveBeenCalledWith(ref.current, 'focus')
    })

    it('sends it back to the trigger once it has gone', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      await renderPopover()

      await fireEvent.press(trigger())
      await laidOut()
      send.mockClear()
      await fireEvent.press(layer())
      await advance(motion.durationShort2)

      expect(send).toHaveBeenCalledTimes(1)
      expect(send).toHaveBeenCalledWith(expect.anything(), 'focus')
    })

    it('moves nothing for a popover a pointer opened', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      await renderPopover({ trigger: 'hover' })

      await fireEvent(trigger(), 'hoverIn')
      await advance(600)
      await laidOut()
      await fireEvent(trigger(), 'hoverOut')
      await advance(200 + motion.durationShort2)

      expect(send).not.toHaveBeenCalled()
    })

    it('leaves focus alone on web', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      await renderPopover()

      await fireEvent.press(trigger())
      await laidOut()
      await fireEvent.press(layer())
      await advance(motion.durationShort2)

      expect(send).not.toHaveBeenCalled()
    })
  })
})
