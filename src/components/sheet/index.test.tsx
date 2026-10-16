import type { ReactNode } from 'react'
import type {
  HostInstance,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
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
import { createRef, useCallback, useState } from 'react'
import {
  AccessibilityInfo,
  Dimensions,
  I18nManager,
  StyleSheet,
} from 'react-native'
import { State } from 'react-native-gesture-handler'
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils'
import { getAnimatedStyle } from 'react-native-reanimated'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

import type { SheetContentProps } from '.'

import { Sheet } from '.'
import { CloseGlyph } from '../../glyphs'
import { scopeFor } from '../../theme/scope'
import { Button } from '../button'
import { IconButton } from '../icon-button'

// What the next sheet the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

const { theme } = scopeFor('light', {})
const { colors, motion, radii, shadows, spacing, typography } = theme

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

// A phone held upright, below the medium bound, and a tablet, above it, both
// 800dp tall, so a sheet taller than 400dp has two heights.
const COMPACT = 412
const MEDIUM = 800
const HEIGHT = 800

// A sheet shorter than half the window, which has one height, and one taller,
// which rests at half the window first.
const SHORT = 300
const TALL = 600

const INSETS: EdgeInsets = { bottom: 34, left: 12, right: 8, top: 47 }

// How long the sheet takes to arrive, and to leave: the longer of the panel's
// exit and the scrim's fade.
const ENTER = motion.durationMedium1
const EXIT = Math.max(motion.durationShort2, motion.durationShort3)

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

// A drag on the sheet carried through to its end with Gesture Handler's own
// helper: moved through each of `along` and let go at the last, at
// `velocity`.
async function drag(along: readonly number[], velocity = 0) {
  const last = along.at(-1) ?? 0
  await act(() => {
    fireGestureHandler(getByGestureTestId('panel-drag'), [
      { state: State.BEGAN, translationY: 0 },
      ...along.map((translationY) => ({ state: State.ACTIVE, translationY })),
      { state: State.END, translationY: last, velocityY: velocity },
    ])
  })
}

// A sheet whose open state the call site holds, with the change it reports.
function Held({
  onOpenChange,
  ...props
}: Partial<SheetContentProps> & {
  readonly onOpenChange: (isOpen: boolean) => void
}) {
  const [isOpen, setOpen] = useState(true)
  const change = useCallback(
    (next: boolean) => {
      onOpenChange(next)
      setOpen(next)
    },
    [onOpenChange],
  )

  return (
    <Sheet.Content
      isOpen={isOpen}
      onOpenChange={change}
      testID="panel"
      {...props}
    >
      <Sheet.Handle testID="handle" />
      <Sheet.Body testID="body">Supporting text</Sheet.Body>
    </Sheet.Content>
  )
}

// Lays the panel out at `height`, as the platform reports it once the sheet
// has drawn.
async function layOut(height: number) {
  await fireEvent(screen.getByTestId('panel'), 'layout', {
    nativeEvent: { layout: { height, width: COMPACT, x: 0, y: 0 } },
  })
}

// The `Modal` the sheet is drawn in, two hosts above the panel: the Gesture
// Handler root sits between.
function modal() {
  return parentOf(root())
}

// How far the bottom sheet's panel is moved down, as it stands.
function offset() {
  return transformOf(screen.getByTestId('panel')).translateY
}

function parentOf(node: TestInstance): TestInstance {
  const parent = node.parent
  if (parent === null) {
    throw new TypeError('expected a parent')
  }
  return parent
}

// Renders a sheet with a trigger, a handle, a header, a body and two actions,
// the shape a call site draws.
async function renderSheet(
  props: Partial<SheetContentProps> = {},
  {
    body = 'Supporting text',
    defaultOpen = false,
    insets,
  }: { body?: ReactNode; defaultOpen?: boolean; insets?: EdgeInsets } = {},
) {
  const sheet = (
    <Sheet defaultOpen={defaultOpen}>
      <Button variant="outlined">Open</Button>
      <Sheet.Content testID="panel" {...props}>
        <Sheet.Handle testID="handle" />
        <Sheet.Header testID="header">
          <Sheet.Title>Headline</Sheet.Title>
          <IconButton aria-label="Close" slot="close">
            <CloseGlyph />
          </IconButton>
        </Sheet.Header>
        <Sheet.Body testID="body">{body}</Sheet.Body>
        <Sheet.Footer testID="footer">
          <Button slot="close">Confirm</Button>
          <Button slot="close" variant="outlined">
            Cancel
          </Button>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet>
  )

  return render(
    insets === undefined ? (
      sheet
    ) : (
      <SafeAreaInsetsContext value={insets}>{sheet}</SafeAreaInsetsContext>
    ),
  )
}

// The window as the platform reports it when it changes, which is what the
// size class and the sheet's heights follow.
function resize(width: number) {
  Dimensions.set({
    ...INITIAL,
    window: { ...INITIAL.window, height: HEIGHT, width },
  })
}

// The Gesture Handler root the panel is drawn in, which places it.
function root() {
  return parentOf(screen.getByTestId('panel'))
}

// The scrim, the first thing the `Modal` draws.
function scrim() {
  return child(modal().children[0])
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

// The panel's translation and opacity, as its animated style has them.
function transformOf(panel: TestInstance) {
  const style: { opacity?: unknown; transform?: unknown } =
    getAnimatedStyle(panel)
  const steps: unknown[] = Array.isArray(style.transform) ? style.transform : []
  const merged: Record<string, unknown> = {}
  for (const step of steps) {
    Object.assign(merged, step)
  }

  return {
    opacity: style.opacity,
    translateX: merged.translateX,
    translateY: merged.translateY,
  }
}

beforeEach(() => {
  jest.useFakeTimers()
  resize(COMPACT)
})

afterEach(() => {
  mockReducedMotion = false
  Dimensions.set(INITIAL)
  // The preset's AccessibilityInfo is a mock already, which a spy hands
  // back as it is, so its calls are cleared rather than restored.
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('Sheet', () => {
  describe('semantics', () => {
    it('opens from its trigger as a modal dialog named by its title', async () => {
      await renderSheet()

      expect(screen.queryByTestId('panel')).toBeNull()

      await fireEvent.press(screen.getByText('Open'))

      const panel = screen.getByTestId('panel')
      const title = screen.getByRole('heading', { name: 'Headline' })

      expect(panel.props.role).toBe('dialog')
      expect(panel.props['aria-modal']).toBe(true)
      expect(panel.props['aria-labelledby']).toBe(title.props.nativeID)
      expect(title.props.nativeID).toEqual(expect.any(String))
    })

    it('names nothing when it has no title', async () => {
      await render(
        <Sheet.Content defaultOpen testID="panel">
          <Sheet.Body>Supporting text</Sheet.Body>
        </Sheet.Content>,
      )

      expect(screen.getByTestId('panel').props['aria-labelledby']).toBe(
        undefined,
      )
    })

    it('sends the screen reader to the title once it shows', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      const ref = createRef<HostInstance>()
      await render(
        <Sheet.Content defaultOpen testID="panel">
          <Sheet.Header>
            <Sheet.Title ref={ref}>Headline</Sheet.Title>
          </Sheet.Header>
        </Sheet.Content>,
      )

      await fireEvent(modal(), 'show')

      expect(ref.current).not.toBe(null)
      expect(send).toHaveBeenCalledWith(ref.current, 'focus')
    })

    it('sends it back to the button that opened it once it has gone', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      await renderSheet()

      await fireEvent.press(screen.getByText('Open'))
      await fireEvent.press(screen.getByText('Cancel'))

      expect(send).not.toHaveBeenCalled()

      await advance(EXIT)

      expect(send).toHaveBeenCalledWith(expect.anything(), 'focus')
    })

    it('says where each part belongs when drawn outside the content', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(render(<Sheet.Title>Headline</Sheet.Title>)).rejects.toThrow(
        'Sheet.Title is drawn inside Sheet.Content.',
      )
    })
  })

  describe('the bottom sheet', () => {
    it('spans a compact window along its bottom edge', async () => {
      await renderSheet({}, { defaultOpen: true })

      expect(styleOf(root())).toMatchObject({
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
      })
      expect(styleOf(screen.getByTestId('panel'))).toMatchObject({
        backgroundColor: colors.surfaceContainerLow,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        boxShadow: shadows.elevation1,
        maxHeight: HEIGHT - 72,
        width: '100%',
      })
    })

    it('keeps its content above the home indicator and inside the side insets', async () => {
      await renderSheet({}, { defaultOpen: true, insets: INSETS })

      expect(styleOf(screen.getByTestId('panel'))).toMatchObject({
        maxHeight: HEIGHT - 72,
        paddingBottom: INSETS.bottom,
        paddingEnd: INSETS.right,
        paddingStart: INSETS.left,
        paddingTop: 0,
      })
    })

    it('stops short of a status bar taller than its top margin', async () => {
      await renderSheet(
        {},
        { defaultOpen: true, insets: { ...INSETS, top: 90 } },
      )

      expect(styleOf(screen.getByTestId('panel')).maxHeight).toBe(HEIGHT - 90)
    })

    it('draws the handle as a mark when it has one height', async () => {
      await renderSheet({}, { defaultOpen: true })
      await layOut(SHORT)

      const handle = screen.getByTestId('handle', {
        includeHiddenElements: true,
      })

      expect(handle.props['aria-hidden']).toBe(true)
      expect(handle.props.role).toBeUndefined()
      expect(styleOf(handle)).toMatchObject({
        paddingHorizontal: 8,
        paddingVertical: 22,
      })
      expect(styleOf(child(handle.children[0]))).toMatchObject({
        backgroundColor: colors.onSurfaceVariant,
        borderRadius: radii.pill,
        height: 4,
        width: 32,
      })
    })
  })

  describe('the side sheet', () => {
    beforeEach(() => {
      resize(MEDIUM)
    })

    it('runs the height of a medium window along its end edge', async () => {
      await renderSheet({}, { defaultOpen: true })

      expect(styleOf(root())).toMatchObject({
        bottom: 0,
        end: 0,
        position: 'absolute',
        top: 0,
        width: 400,
      })
      expect(styleOf(screen.getByTestId('panel'))).toMatchObject({
        backgroundColor: colors.surfaceContainerLow,
        borderBottomStartRadius: radii.lg,
        borderTopStartRadius: radii.lg,
        boxShadow: shadows.elevation1,
      })
    })

    it('keeps its content inside the insets on its own edge', async () => {
      await renderSheet({}, { defaultOpen: true, insets: INSETS })

      expect(styleOf(screen.getByTestId('panel'))).toMatchObject({
        paddingBottom: INSETS.bottom,
        paddingEnd: INSETS.right,
        paddingStart: 0,
        paddingTop: INSETS.top,
      })
    })

    it('draws no handle', async () => {
      await renderSheet({}, { defaultOpen: true })

      expect(screen.queryByTestId('handle')).toBeNull()
    })

    it('slides in from the end edge, fading as it comes', async () => {
      await renderSheet({}, { defaultOpen: true })

      expect(transformOf(screen.getByTestId('panel'))).toEqual({
        opacity: 0,
        translateX: 400,
        translateY: undefined,
      })

      await advance(ENTER)

      expect(transformOf(screen.getByTestId('panel'))).toMatchObject({
        opacity: 1,
        translateX: 0,
      })
    })

    it('slides in from the left under right-to-left', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await renderSheet({}, { defaultOpen: true, insets: INSETS })

      expect(transformOf(screen.getByTestId('panel')).translateX).toBe(-400)
      expect(styleOf(screen.getByTestId('panel'))).toMatchObject({
        paddingEnd: INSETS.left,
        paddingStart: 0,
      })
    })

    it('takes no drag', async () => {
      await renderSheet({}, { defaultOpen: true })
      await layOut(SHORT)

      expect(getByGestureTestId('panel-drag').config).toMatchObject({
        enabled: false,
      })
    })

    it('turns into the bottom sheet as the window narrows', async () => {
      await renderSheet({}, { defaultOpen: true })

      await act(() => {
        resize(COMPACT)
      })

      expect(styleOf(root()).width).toBeUndefined()
      expect(
        screen.getByTestId('handle', { includeHiddenElements: true }),
      ).toBeTruthy()
    })
  })

  describe('parts', () => {
    it('draws its title in title large on on-surface variant', async () => {
      await renderSheet({}, { defaultOpen: true })

      expect(textStyleOf(screen.getByText('Headline'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.titleLargeSize,
      })
    })

    it('rules the header off from the body and the actions from it', async () => {
      await renderSheet({}, { defaultOpen: true })

      expect(styleOf(screen.getByTestId('header'))).toMatchObject({
        borderBottomColor: colors.outlineVariant,
        borderBottomWidth: 1,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
      })
      expect(styleOf(screen.getByTestId('footer'))).toMatchObject({
        borderTopColor: colors.outlineVariant,
        borderTopWidth: 1,
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        minHeight: 72,
      })
    })

    it('draws a string body in body medium on on-surface variant', async () => {
      await renderSheet({}, { defaultOpen: true })

      expect(textStyleOf(screen.getByText('Supporting text'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.bodyMediumSize,
      })
    })

    it('takes focus when its content runs past its room', async () => {
      await renderSheet({}, { defaultOpen: true })
      await layOut(SHORT)

      const body = screen.getByTestId('body')

      expect(body.props.focusable).toBe(false)

      await fireEvent(body, 'layout', {
        nativeEvent: { layout: { height: 100, width: COMPACT, x: 0, y: 0 } },
      })
      await fireEvent(body, 'contentSizeChange', COMPACT, 400)

      expect(screen.getByTestId('body').props.focusable).toBe(true)
    })
  })

  describe('motion', () => {
    it('waits below the window until it is laid out, then rises', async () => {
      await renderSheet({}, { defaultOpen: true })

      expect(offset()).toBe(HEIGHT)

      await layOut(SHORT)
      await advance(0)

      expect(offset()).toBe(SHORT)

      await advance(ENTER / 2)

      expect(offset()).toBeGreaterThan(0)
      expect(offset()).toBeLessThan(SHORT)

      await advance(ENTER)

      expect(offset()).toBe(0)
    })

    it('fades the scrim in and out', async () => {
      await renderSheet({}, { defaultOpen: true })
      await layOut(SHORT)

      expect(getAnimatedStyle(scrim())).toMatchObject({ opacity: 0 })

      await advance(ENTER)

      expect(getAnimatedStyle(scrim())).toMatchObject({ opacity: 1 })
    })

    it('leaves down its own height, and unmounts once it has', async () => {
      await renderSheet({}, { defaultOpen: true })
      await layOut(SHORT)
      await advance(ENTER)

      await fireEvent.press(screen.getByText('Cancel'))
      await advance(EXIT - 1)

      expect(offset()).toBeGreaterThan(0)
      expect(screen.getByTestId('panel')).toBeTruthy()

      await advance(1)

      expect(screen.queryByTestId('panel')).toBeNull()
    })

    it('arrives and leaves at once under reduced motion', async () => {
      mockReducedMotion = true
      await renderSheet({}, { defaultOpen: true })
      await layOut(SHORT)
      await advance(0)

      expect(offset()).toBe(0)

      await fireEvent.press(screen.getByText('Cancel'))
      await advance(0)

      expect(offset()).toBe(SHORT)

      await advance(motion.durationShort2)

      expect(screen.queryByTestId('panel')).toBeNull()
    })

    it('opens at its first height each time', async () => {
      await renderSheet()
      await fireEvent.press(screen.getByText('Open'))
      await layOut(TALL)
      await fireEvent.press(screen.getByTestId('handle'))
      await advance(ENTER)

      expect(offset()).toBe(0)

      await fireEvent.press(screen.getByText('Cancel'))
      await advance(EXIT)
      await fireEvent.press(screen.getByText('Open'))
      await layOut(TALL)
      await advance(ENTER)

      expect(offset()).toBe(TALL - HEIGHT / 2)
    })
  })

  describe('the drag', () => {
    it('closes on a swipe down past half its height', async () => {
      const onOpenChange = jest.fn<(isOpen: boolean) => void>()
      await render(<Held onOpenChange={onOpenChange} />)
      await layOut(SHORT)
      await advance(ENTER)

      await drag([60, 120, 180])

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('settles back after a short one', async () => {
      const onOpenChange = jest.fn<(isOpen: boolean) => void>()
      await render(<Held onOpenChange={onOpenChange} />)
      await layOut(SHORT)
      await advance(ENTER)

      await drag([60, 120])

      expect(offset()).toBe(120)

      await advance(ENTER)

      expect(onOpenChange).not.toHaveBeenCalled()
      expect(offset()).toBe(0)
    })

    it('closes on a short fling down', async () => {
      const onOpenChange = jest.fn<(isOpen: boolean) => void>()
      await render(<Held onOpenChange={onOpenChange} />)
      await layOut(SHORT)
      await advance(ENTER)

      await drag([40], 1200)

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('goes no higher than its whole height', async () => {
      await render(<Held onOpenChange={jest.fn()} />)
      await layOut(SHORT)
      await advance(ENTER)

      await act(() => {
        fireGestureHandler(getByGestureTestId('panel-drag'), [
          { state: State.BEGAN, translationY: 0 },
          { state: State.ACTIVE, translationY: -80 },
        ])
      })

      expect(offset()).toBe(0)
    })

    it('holds at its lowest height when it may not be dismissed', async () => {
      const onOpenChange = jest.fn<(isOpen: boolean) => void>()
      await render(<Held isDismissable={false} onOpenChange={onOpenChange} />)
      await layOut(TALL)
      await advance(ENTER)

      await drag([100, 300], 1200)

      expect(offset()).toBe(TALL - HEIGHT / 2)

      await advance(ENTER)

      expect(onOpenChange).not.toHaveBeenCalled()
      expect(offset()).toBe(TALL - HEIGHT / 2)
    })

    it('takes no drag when it has one height and may not be dismissed', async () => {
      await render(<Held isDismissable={false} onOpenChange={jest.fn()} />)
      await layOut(SHORT)

      expect(getByGestureTestId('panel-drag').config).toMatchObject({
        enabled: false,
      })
    })
  })

  describe('two heights', () => {
    it('opens at half the window when it is taller than that', async () => {
      await renderSheet({}, { defaultOpen: true })
      await layOut(TALL)
      await advance(ENTER)

      expect(offset()).toBe(TALL - HEIGHT / 2)
      expect(screen.getByTestId('body').props.scrollEnabled).toBe(false)
    })

    it('rises to its whole height on a drag up', async () => {
      await renderSheet({}, { defaultOpen: true })
      await layOut(TALL)
      await advance(ENTER)

      await drag([-60, -150])
      await advance(ENTER)

      expect(offset()).toBe(0)
      expect(screen.getByTestId('body').props.scrollEnabled).toBe(true)
      expect(
        screen.getByRole('button', { expanded: true, name: 'Drag handle' }),
      ).toBeTruthy()
    })

    it('drops back to half the window on a drag down from whole', async () => {
      await renderSheet({}, { defaultOpen: true })
      await layOut(TALL)
      await fireEvent.press(screen.getByTestId('handle'))
      await advance(ENTER)

      await drag([60, 180])
      await advance(ENTER)

      expect(offset()).toBe(TALL - HEIGHT / 2)
    })

    it('closes on a swipe down past half its lower height', async () => {
      const onOpenChange = jest.fn<(isOpen: boolean) => void>()
      await render(<Held onOpenChange={onOpenChange} />)
      await layOut(TALL)
      await advance(ENTER)

      await drag([100, 250])

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('moves between them from a handle that says which it is at', async () => {
      await renderSheet({}, { defaultOpen: true })
      await layOut(TALL)
      await advance(ENTER)

      await fireEvent.press(
        screen.getByRole('button', { expanded: false, name: 'Drag handle' }),
      )
      await advance(ENTER)

      expect(offset()).toBe(0)
      expect(
        screen.getByRole('button', { expanded: true, name: 'Drag handle' }),
      ).toBeTruthy()

      await fireEvent.press(screen.getByTestId('handle'))
      await advance(ENTER)

      expect(offset()).toBe(TALL - HEIGHT / 2)
    })

    it('names the handle as the call site says', async () => {
      await render(
        <Sheet.Content defaultOpen testID="panel">
          <Sheet.Handle aria-label="Resize" />
          <Sheet.Body>Supporting text</Sheet.Body>
        </Sheet.Content>,
      )
      await layOut(TALL)

      expect(screen.getByRole('button', { name: 'Resize' })).toBeTruthy()
    })

    it('holds the drag off a body that scrolls, once whole', async () => {
      await renderSheet({}, { defaultOpen: true })
      await layOut(TALL)
      await fireEvent(screen.getByTestId('body'), 'layout', {
        nativeEvent: { layout: { height: 100, width: COMPACT, x: 0, y: 0 } },
      })
      await fireEvent(screen.getByTestId('body'), 'contentSizeChange', 0, 400)

      expect(screen.getByTestId('body').props.focusable).toBe(false)

      await fireEvent.press(screen.getByTestId('handle'))

      expect(screen.getByTestId('body').props.focusable).toBe(true)
    })
  })

  describe('closing', () => {
    it('closes on a press on the scrim', async () => {
      const onOpenChange = jest.fn<(isOpen: boolean) => void>()
      await render(<Held onOpenChange={onOpenChange} />)

      await fireEvent.press(scrim())

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('stays open on a press on the scrim when it may not be dismissed', async () => {
      const onOpenChange = jest.fn<(isOpen: boolean) => void>()
      await render(<Held isDismissable={false} onOpenChange={onOpenChange} />)

      await fireEvent.press(scrim())

      expect(onOpenChange).not.toHaveBeenCalled()
    })

    it("closes on Android's back gesture", async () => {
      const onOpenChange = jest.fn<(isOpen: boolean) => void>()
      await render(<Held onOpenChange={onOpenChange} />)

      await fireEvent(modal(), 'requestClose')

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('ignores the back gesture when keyboard dismissal is off', async () => {
      const onOpenChange = jest.fn<(isOpen: boolean) => void>()
      await render(
        <Held isKeyboardDismissDisabled onOpenChange={onOpenChange} />,
      )

      await fireEvent(modal(), 'requestClose')

      expect(onOpenChange).not.toHaveBeenCalled()
    })

    it("closes on VoiceOver's escape gesture", async () => {
      const onOpenChange = jest.fn<(isOpen: boolean) => void>()
      await render(<Held onOpenChange={onOpenChange} />)

      await fireEvent(screen.getByTestId('panel'), 'accessibilityEscape')

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('closes from a button in its close slot', async () => {
      await renderSheet({}, { defaultOpen: true })

      await fireEvent.press(screen.getByRole('button', { name: 'Close' }))
      await advance(EXIT)

      expect(screen.queryByTestId('panel')).toBeNull()
    })
  })
})
