import type { ComponentRef, ReactNode } from 'react'
import type {
  HostInstance,
  MeasureInWindowOnSuccessCallback,
  StyleProp,
  ViewProps,
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
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import { createRef, useState } from 'react'
import {
  AccessibilityInfo,
  DeviceEventEmitter,
  Dimensions,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

import type { SearchViewContentProps, SearchViewProps } from '.'

import { SearchView } from '.'
import { I18nProvider } from '../../i18n/provider'
import { ThemeScope } from '../../theme-scope'
import { scopeFor } from '../../theme/scope'
import { Button } from '../button'
import { ListBox } from '../list-box'

// What the next view the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

type Focusable = { readonly focus: () => void }

type Frame = readonly [x: number, y: number, width: number, height: number]

// What React Native's Jest preset draws a View as: a class component holding
// its props, with the native methods on its prototype.
type MockedView = Pick<HostInstance, 'measureInWindow'> & {
  readonly props: ViewProps
}

const { theme } = scopeFor('light', {})
const { colors, motion, radii, shadows, sizing, spacing, typography } = theme

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

// A phone held upright, and a tablet: either side of the medium window's
// 600dp.
const COMPACT = [412, 900] as const
const MEDIUM = [800, 1000] as const

const INSETS: EdgeInsets = { bottom: 16, left: 0, right: 0, top: 24 }

// The rows most cases search. A list reads its parts straight off its
// children, so they are an array of elements rather than a fragment.
const RESULTS = [
  <ListBox.Item id="first" key="first">
    First item
  </ListBox.Item>,
  <ListBox.Item id="second" key="second">
    Second item
  </ListBox.Item>,
  <ListBox.Item id="third" key="third">
    Third item
  </ListBox.Item>,
]

// Where `measureInWindow` reports each view: the trigger by its test id, and
// the overlay layer and the view itself, the only others measured, filling
// the window.
let frames: { layer: Frame; trigger: Frame } = {
  layer: [0, 0, 0, 0],
  trigger: [0, 0, 0, 0],
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

function backButton() {
  return screen.getByRole('button', { name: 'Back' })
}

function clearButton() {
  return screen.queryByRole('button', { name: 'Clear search' })
}

// What the trigger tells a screen reader about the view it opens.
function expanded() {
  const state: unknown = trigger().props.accessibilityState

  return typeof state === 'object' && state !== null && 'expanded' in state
    ? state.expanded
    : undefined
}

// The prototype every mocked TextInput shares, whose `focus` is one mock.
function focusOfInputs() {
  const prototype: unknown = Reflect.get(TextInput, 'prototype')

  if (!isFocusable(prototype)) {
    throw new TypeError('expected the TextInput the Jest preset mocks')
  }
  return jest.spyOn(prototype, 'focus')
}

// The header: the row the back button sits in.
function header() {
  const node = backButton().parent

  if (node === null) {
    throw new TypeError('expected the header around the back button')
  }
  return node
}

// The rows a search left, by their headlines, in order.
function headlines() {
  return within(screen.getByLabelText('Results'))
    .queryAllByRole('button')
    .map(textOf)
}

// A view whose open state the call site holds.
function Held() {
  const [isOpen, setOpen] = useState(true)

  return withScope(view({ isOpen, onOpenChange: setOpen }))
}

function input() {
  return screen.getByRole('searchbox', { name: 'Label' })
}

function isFocusable(value: unknown): value is Focusable {
  return typeof value === 'object' && value !== null && 'focus' in value
}

function isMockedView(value: unknown): value is MockedView {
  return (
    typeof value === 'object' && value !== null && 'measureInWindow' in value
  )
}

// Reports the view's size, which is what places the docked one.
async function laidOut(width = 360, height = 400) {
  await fireEvent(panel(), 'layout', {
    nativeEvent: { layout: { height, width, x: 0, y: 0 } },
  })
}

// The `Modal` the view is drawn in.
function modal(): TestInstance {
  let node: null | TestInstance = panel()

  while (node !== null && node.type !== 'Modal') {
    node = node.parent
  }
  if (node === null) {
    throw new TypeError('expected the Modal around the view')
  }
  return node
}

function panel() {
  return screen.getByTestId('panel')
}

// What a view handed to `sendAccessibilityEvent` was drawn with.
function propsOf(target: unknown): unknown {
  return typeof target === 'object' && target !== null && 'props' in target
    ? target.props
    : undefined
}

// A view with a trigger and a ListBox of three rows, the shape a call site
// draws.
async function renderView(
  props: Partial<SearchViewProps> = {},
  content: Partial<SearchViewContentProps> = {},
) {
  return render(withScope(view(props, content)))
}

function resize([width, height]: readonly [number, number], fontScale = 1) {
  const metrics = { fontScale, height, scale: 1, width }

  Dimensions.set({ screen: metrics, window: metrics })
  frames.layer = [0, 0, width, height]
}

function resultsOf() {
  const node = screen.getByLabelText('Results').parent

  if (node === null) {
    throw new TypeError('expected the view around the results')
  }
  return styleOf(node)
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function textOf(node: TestNode): string {
  return typeof node === 'string' ? node : node.children.map(textOf).join('')
}

function trigger() {
  return screen.getByTestId('trigger')
}

function view(
  props: Partial<SearchViewProps> = {},
  content: Partial<SearchViewContentProps> = {},
) {
  return (
    <SearchView {...props}>
      <Button testID="trigger" variant="outlined">
        Open search
      </Button>
      <SearchView.Content
        label="Label"
        placeholder="Supporting text"
        testID="panel"
        {...content}
      >
        <ListBox aria-label="Results" selectionMode="single">
          {RESULTS}
        </ListBox>
      </SearchView.Content>
    </SearchView>
  )
}

function withScope(children: ReactNode) {
  return <ThemeScope>{children}</ThemeScope>
}

beforeEach(() => {
  jest.useFakeTimers()
  frames = { layer: [0, 0, 0, 0], trigger: [24, 40, 120, 40] }
  resize(COMPACT)
  const prototype: unknown = View.prototype

  if (!isMockedView(prototype)) {
    throw new TypeError('expected the View the Jest preset mocks')
  }

  jest.spyOn(prototype, 'measureInWindow').mockImplementation(function measure(
    this: MockedView,
    callback: MeasureInWindowOnSuccessCallback,
  ) {
    callback(
      ...(this.props.testID === 'trigger' ? frames.trigger : frames.layer),
    )
  })
})

afterEach(() => {
  mockReducedMotion = false
  Dimensions.set(INITIAL)
  // A mocked TextInput's `focus` is one mock every instance shares, which
  // spyOn hands back as it is and restoring leaves holding its calls.
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('SearchView', () => {
  describe('opening and closing', () => {
    it('opens from its trigger, which says whether it is open', async () => {
      await renderView()

      expect(screen.queryByTestId('panel')).toBeNull()
      expect(expanded()).toBe(false)

      await fireEvent.press(trigger())

      expect(panel()).toBeTruthy()
      expect(expanded()).toBe(true)
    })

    it('closes from its back button', async () => {
      const onOpenChange = jest.fn()
      await renderView({ defaultOpen: true, onOpenChange })

      await fireEvent.press(backButton())
      await advance(motion.durationShort2)

      expect(onOpenChange).toHaveBeenCalledWith(false)
      expect(screen.queryByTestId('panel')).toBeNull()
    })

    it("closes from Android's back gesture and from Escape on web", async () => {
      await renderView({ defaultOpen: true })

      await fireEvent(modal(), 'requestClose')
      await advance(motion.durationShort2)

      expect(screen.queryByTestId('panel')).toBeNull()
    })

    it("closes from VoiceOver's escape gesture", async () => {
      await renderView({ defaultOpen: true })

      await fireEvent(panel(), 'accessibilityEscape')
      await advance(motion.durationShort2)

      expect(screen.queryByTestId('panel')).toBeNull()
    })

    it('closes the docked view from a press outside it', async () => {
      resize(MEDIUM)
      await renderView({ defaultOpen: true })
      await laidOut()

      const scrim = modal().children.at(0)

      if (scrim === undefined || typeof scrim === 'string') {
        throw new TypeError('expected the scrim under the view')
      }
      expect(scrim).not.toBe(panel())
      expect(styleOf(scrim).opacity).toBe(0)

      await fireEvent.press(scrim)
      await advance(motion.durationShort2)

      expect(screen.queryByTestId('panel')).toBeNull()
    })

    it('stays mounted until its exit has run', async () => {
      await renderView({ defaultOpen: true })

      await fireEvent.press(backButton())
      await advance(motion.durationShort2 - 1)

      expect(panel()).toBeTruthy()

      await advance(1)

      expect(screen.queryByTestId('panel')).toBeNull()
    })

    it('follows isOpen when the call site holds the state', async () => {
      await render(<Held />)

      expect(panel()).toBeTruthy()

      await fireEvent.press(backButton())
      await advance(motion.durationShort2)

      expect(screen.queryByTestId('panel')).toBeNull()
    })

    it('stays open while the call site holds it open', async () => {
      const onOpenChange = jest.fn()
      await renderView({ isOpen: true, onOpenChange })

      await fireEvent.press(backButton())
      await advance(motion.durationShort2)

      expect(onOpenChange).toHaveBeenCalledWith(false)
      expect(panel()).toBeTruthy()
    })

    it('is drawn inside SearchView', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {})

      await expect(
        render(withScope(<SearchView.Content label="Label" />)),
      ).rejects.toThrow('SearchView.Content is drawn inside SearchView.')
    })
  })

  describe('in a compact window', () => {
    it('fills the window, square, on surface container high', async () => {
      await renderView({ defaultOpen: true })

      expect(styleOf(panel())).toMatchObject({
        backgroundColor: colors.surfaceContainerHigh,
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      })
      expect(styleOf(panel()).borderRadius).toBeUndefined()
      expect(styleOf(panel()).boxShadow).toBeUndefined()
    })

    it('keeps its content inside the safe area', async () => {
      await render(
        <SafeAreaInsetsContext value={INSETS}>
          {withScope(view({ defaultOpen: true }))}
        </SafeAreaInsetsContext>,
      )

      expect(styleOf(panel())).toMatchObject({
        paddingBottom: INSETS.bottom,
        paddingTop: INSETS.top,
      })
    })

    it('draws a 72dp header', async () => {
      await renderView({ defaultOpen: true })

      expect(styleOf(header()).minHeight).toBe(72)
    })

    it('grows its header with the text size', async () => {
      resize(COMPACT, 2)
      await renderView({ defaultOpen: true })

      expect(styleOf(header()).minHeight).toBe(
        72 + typography.bodyLargeLineHeight,
      )
    })

    it('lets its results take what the header leaves', async () => {
      await renderView({ defaultOpen: true })

      expect(resultsOf()).toMatchObject({ flex: 1 })
    })

    it('stops its results at the top of the keyboard', async () => {
      await renderView({ defaultOpen: true })
      await laidOut(COMPACT[0], COMPACT[1])

      await act(() => {
        DeviceEventEmitter.emit('keyboardWillChangeFrame', {
          duration: 0,
          easing: 'keyboard',
          endCoordinates: {
            height: 300,
            screenX: 0,
            screenY: COMPACT[1] - 300,
            width: COMPACT[0],
          },
        })
      })

      expect(styleOf(panel()).paddingBottom).toBe(300)

      await act(() => {
        DeviceEventEmitter.emit('keyboardWillHide', {
          duration: 0,
          easing: 'keyboard',
          endCoordinates: {
            height: 0,
            screenX: 0,
            screenY: COMPACT[1],
            width: COMPACT[0],
          },
        })
      })

      expect(styleOf(panel()).paddingBottom).toBe(0)
    })

    it('shows at once, without waiting to be placed', async () => {
      await renderView({ defaultOpen: true })
      await advance(motion.durationShort3)

      expect(getAnimatedStyle(panel())).toMatchObject({
        opacity: 1,
        transform: [{ scale: 1 }],
      })
    })
  })

  describe('from a medium window up', () => {
    beforeEach(() => {
      resize(MEDIUM)
    })

    it('docks under its trigger, 28dp round at elevation 3', async () => {
      await renderView({ defaultOpen: true })
      await laidOut()

      expect(styleOf(panel())).toMatchObject({
        backgroundColor: colors.surfaceContainerHigh,
        borderRadius: radii.xl,
        boxShadow: shadows.elevation3,
        left: 24,
        position: 'absolute',
        top: 40 + 40 + spacing.sm,
      })
    })

    it('is as wide as its trigger, between 360dp and 720dp', async () => {
      await renderView({ defaultOpen: true })
      await laidOut()

      expect(styleOf(panel()).width).toBe(360)
    })

    it('takes the width of a wider trigger, up to 720dp', async () => {
      frames.trigger = [24, 40, 500, 40]
      await renderView({ defaultOpen: true })
      await laidOut()

      expect(styleOf(panel()).width).toBe(500)
    })

    it('takes no more than 720dp from a wider trigger still', async () => {
      frames.trigger = [24, 40, 760, 40]
      await renderView({ defaultOpen: true })
      await laidOut()

      expect(styleOf(panel()).width).toBe(720)
    })

    it('draws a 56dp header over results at least 240dp tall', async () => {
      await renderView({ defaultOpen: true })
      await laidOut()

      expect(styleOf(header()).minHeight).toBe(sizing.controlLg)
      expect(resultsOf()).toMatchObject({
        // Two thirds of the window, less the header and the divider.
        maxHeight: (MEDIUM[1] * 2) / 3 - sizing.controlLg - 1,
        minHeight: 240,
      })
    })

    it('fades and scales in from 95% once it is placed', async () => {
      await renderView({ defaultOpen: true })
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
  })

  describe('the header', () => {
    it('draws a 1dp divider under it in the outline role', async () => {
      await renderView({ defaultOpen: true })

      const siblings = header().parent?.children ?? []
      const divider = siblings.at(siblings.indexOf(header()) + 1)

      if (divider === undefined || typeof divider === 'string') {
        throw new TypeError('expected the divider under the header')
      }
      expect(styleOf(divider)).toMatchObject({
        backgroundColor: colors.outline,
        height: 1,
      })
    })

    it('holds a search box named by the label, which takes the keyboard', async () => {
      await renderView({ defaultOpen: true })

      expect(input().props).toMatchObject({
        autoFocus: true,
        placeholder: 'Supporting text',
        returnKeyType: 'search',
      })
      expect(screen.queryByText('Label')).toBeNull()
    })

    it('names its back and clear buttons in the locale’s words', async () => {
      await render(
        <ThemeScope>
          <I18nProvider locale="de-DE">
            {view({ defaultOpen: true })}
          </I18nProvider>
        </ThemeScope>,
      )

      await fireEvent.changeText(input(), 'Second')

      expect(screen.getByRole('button', { name: 'Zurück' })).toBeTruthy()
      expect(
        screen.getByRole('button', { name: 'Suche zurücksetzen' }),
      ).toBeTruthy()
    })

    it('takes names of its own for both buttons', async () => {
      await renderView(
        { defaultOpen: true },
        { backLabel: 'Close search', clearLabel: 'Empty' },
      )

      await fireEvent.changeText(input(), 'Second')

      expect(screen.getByRole('button', { name: 'Close search' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Empty' })).toBeTruthy()
    })

    it('shows a clear button only while there is text', async () => {
      await renderView({ defaultOpen: true })

      expect(clearButton()).toBeNull()

      await fireEvent.changeText(input(), 'Second')

      expect(clearButton()).not.toBeNull()

      await fireEvent.changeText(input(), '')

      expect(clearButton()).toBeNull()
    })

    it('empties the input from the clear button and hands it the keyboard', async () => {
      const focus = focusOfInputs()
      const onInputChange = jest.fn()
      await renderView({ defaultOpen: true }, { onInputChange })

      await fireEvent.changeText(input(), 'Second')
      await fireEvent.press(clearButton() ?? input())

      expect(onInputChange).toHaveBeenLastCalledWith('')
      expect(input().props.value).toBe('')
      expect(headlines()).toEqual(['First item', 'Second item', 'Third item'])
      expect(focus).toHaveBeenCalledTimes(1)
    })
  })

  describe('the results', () => {
    it('narrows a ListBox as the input is typed into', async () => {
      await renderView({ defaultOpen: true })

      expect(headlines()).toEqual(['First item', 'Second item', 'Third item'])

      await fireEvent.changeText(input(), 'sec')

      expect(headlines()).toEqual(['Second item'])
    })

    it('takes a filter of its own', async () => {
      await renderView(
        { defaultOpen: true },
        { filter: (textValue, search) => textValue.endsWith(search) },
      )

      await fireEvent.changeText(input(), 'item')

      expect(headlines()).toEqual(['First item', 'Second item', 'Third item'])

      await fireEvent.changeText(input(), 'First')

      expect(headlines()).toEqual([])
    })

    it('keeps its own from defaultInputValue, starting again as it opens', async () => {
      await renderView({}, { defaultInputValue: 'Third' })

      await fireEvent.press(trigger())

      expect(input().props.value).toBe('Third')
      expect(headlines()).toEqual(['Third item'])

      await fireEvent.changeText(input(), 'First')
      await fireEvent.press(backButton())
      await advance(motion.durationShort2)
      await fireEvent.press(trigger())

      expect(input().props.value).toBe('Third')
    })

    it('follows inputValue when the call site holds it', async () => {
      const onInputChange = jest.fn()
      await renderView(
        { defaultOpen: true },
        { inputValue: 'First', onInputChange },
      )

      await fireEvent.changeText(input(), 'Second')

      expect(onInputChange).toHaveBeenCalledWith('Second')
      expect(input().props.value).toBe('First')
      expect(headlines()).toEqual(['First item'])
    })

    it('keeps the keyboard up for a tap on a row', async () => {
      await renderView({ defaultOpen: true })

      expect(screen.getByLabelText('Results').props).toMatchObject({
        keyboardShouldPersistTaps: 'handled',
      })
    })
  })

  describe('semantics', () => {
    it('is a modal dialog named by its label, drawn in a Modal', async () => {
      await renderView({ defaultOpen: true })

      expect(panel().props).toMatchObject({
        'aria-label': 'Label',
        'aria-modal': true,
        role: 'dialog',
      })
      expect(modal().props.visible).toBe(true)
    })

    it("is named by React Native Web's Modal on web", async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await renderView({ defaultOpen: true })

      expect(modal().props['aria-label']).toBe('Label')
      expect(panel().props['aria-label']).toBeUndefined()
      expect(panel().props.role).toBeUndefined()
    })

    it("lands the call site's style, ref and testID on the surface", async () => {
      const ref = createRef<HostInstance>()
      await renderView(
        { defaultOpen: true },
        { ref, style: { borderWidth: 2 }, testID: 'panel' },
      )

      expect(styleOf(panel()).borderWidth).toBe(2)
      expect(ref.current).not.toBeNull()
    })
  })

  describe('focus', () => {
    it('sends the screen reader to the input as the full-screen view shows', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      await renderView()

      await fireEvent.press(trigger())

      expect(send).not.toHaveBeenCalled()

      await fireEvent(modal(), 'show')

      expect(send).toHaveBeenCalledTimes(1)
      expect(propsOf(send.mock.calls[0]?.[0])).toMatchObject({
        'aria-label': 'Label',
        role: 'searchbox',
      })
    })

    it('sends it to the input once the docked view is placed', async () => {
      resize(MEDIUM)
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      await renderView()

      await fireEvent.press(trigger())
      await fireEvent(modal(), 'show')

      expect(send).not.toHaveBeenCalled()

      await laidOut()

      expect(send).toHaveBeenCalledTimes(1)
      expect(propsOf(send.mock.calls[0]?.[0])).toMatchObject({
        role: 'searchbox',
      })
    })

    it('sends it back to the trigger once the view has gone', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        withScope(
          <SearchView>
            <Button ref={ref} testID="trigger">
              Open search
            </Button>
            <SearchView.Content label="Label" testID="panel">
              <ListBox aria-label="Results">{RESULTS}</ListBox>
            </SearchView.Content>
          </SearchView>,
        ),
      )

      await fireEvent.press(trigger())
      await fireEvent(modal(), 'show')
      send.mockClear()
      await fireEvent.press(backButton())

      expect(send).not.toHaveBeenCalled()

      await advance(motion.durationShort2)

      expect(ref.current).not.toBeNull()
      expect(send).toHaveBeenCalledTimes(1)
      expect(send).toHaveBeenCalledWith(ref.current, 'focus')
    })

    it("leaves focus to React Native Web's Modal on web", async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      await renderView()

      await fireEvent.press(trigger())
      await fireEvent(modal(), 'show')
      await fireEvent.press(backButton())
      await advance(motion.durationShort2)

      expect(send).not.toHaveBeenCalled()
    })

    it('leaves and arrives at once under reduced motion', async () => {
      mockReducedMotion = true
      await renderView({ defaultOpen: true })
      await advance(0)

      expect(getAnimatedStyle(panel())).toMatchObject({ opacity: 1 })

      await fireEvent.press(backButton())

      expect(screen.queryByTestId('panel')).toBeNull()
    })
  })
})
