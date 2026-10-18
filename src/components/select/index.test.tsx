import type { ComponentRef, ReactNode, RefObject } from 'react'
import type {
  HostInstance,
  MeasureInWindowOnSuccessCallback,
  StyleProp,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { TestInstance } from 'test-renderer'

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
import { createRef } from 'react'
import {
  AccessibilityInfo,
  BackHandler,
  Dimensions,
  FlatList,
  StyleSheet,
  View,
} from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { SelectProps } from '.'

import { Select } from '.'
import { I18nProvider } from '../../i18n/provider'
import { ThemeScope } from '../../theme-scope'
import { scopeFor } from '../../theme/scope'
import { Button } from '../button'
import { Form } from '../form'
import { ListBox } from '../list-box'

// What the next select the device draws is told about reduced motion.
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

// What `scrollToIndex` hands `onScrollToIndexFailed`, when it has one.
type ScrollFailure = {
  readonly averageItemLength: number
  readonly highestMeasuredFrameIndex: number
  readonly index: number
}

const { theme } = scopeFor('light', {})
const { colors, motion, radii, shadows, spacing, typography } = theme

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

// Where `measureInWindow` reports the box, by its test id, and the overlay
// layer, the only other view measured, filling a 400 by 800 window. A case
// that needs the box elsewhere moves it.
const frames: { box: Frame; layer: Frame } = {
  box: [20, 100, 320, 56],
  layer: [0, 0, 400, 800],
}

const REQUIRED = 'Fill out this field.'

// What a choice of `first` is refused with by `validate`.
const REFUSED = 'Choose another item.'

// Hoisted so each is one stable value per render, which is what react-perf's
// rules are after.
const BACK_PRESS = { timeStamp: 0, type: 'hardwareBackPress' }
const CALL_SITE = { marginTop: 4 }
const FIRST_AND_THIRD = ['first', 'third']
const NONE: readonly string[] = []
const SECOND_DISABLED = ['second']
const SERVER_ERRORS = { item: REFUSED }
const FIRST_DISABLED = ['first']

// A press with no point on the page, on an option that measures nothing, so
// the ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

const THREE_OPTIONS = [
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

const GROUPED = [
  <ListBox.Section header="First group" id="first-group" key="first-group">
    <ListBox.Item id="first">First item</ListBox.Item>
    <ListBox.Item id="second">Second item</ListBox.Item>
  </ListBox.Section>,
  <ListBox.Section header="Second group" id="second-group" key="second-group">
    <ListBox.Item id="third">Third item</ListBox.Item>
  </ListBox.Section>,
]

// Twenty options, more than a list draws before it is laid out.
const MANY_OPTIONS = Array.from({ length: 20 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0')

  return (
    <ListBox.Item id={`item-${number}`} key={number}>
      {`Item ${number}`}
    </ListBox.Item>
  )
})

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// Refuses a choice of the first option.
function anyButFirst(value: unknown) {
  return value === 'first' ? REFUSED : null
}

function box() {
  return screen.getByTestId('select')
}

// The chevron in the box: the view turning the glyph.
function chevron(): TestInstance {
  const glyph = box()
    .queryAll((each) => each.type.startsWith('RNSVGSvgView'))
    .at(0)
  const turned = glyph?.parent

  if (turned === null || turned === undefined) {
    throw new TypeError('expected the chevron in the box')
  }
  return turned
}

// How far the chevron is turned, in degrees.
function chevronAngle(): number {
  const { transform }: { transform?: unknown } = getAnimatedStyle(chevron())
  const turn: unknown = Array.isArray(transform) ? transform.at(0) : undefined

  if (
    typeof turn !== 'object' ||
    turn === null ||
    !('rotate' in turn) ||
    typeof turn.rotate !== 'string'
  ) {
    throw new TypeError('expected the chevron to be turned')
  }
  return Number.parseFloat(turn.rotate)
}

// Presses the option `headline` names, in the open list.
async function choose(headline: string) {
  await fireEvent.press(optionOf(headline), PRESS)
}

// What the box tells a screen reader about whether its list is open.
function expanded() {
  const state: unknown = box().props.accessibilityState

  return typeof state === 'object' && state !== null && 'expanded' in state
    ? state.expanded
    : undefined
}

function isMockedView(value: unknown): value is MockedView {
  return (
    typeof value === 'object' && value !== null && 'measureInWindow' in value
  )
}

// The size the label is drawn at, with what Reanimated drives on top.
function labelSize() {
  const label = shownText('Label')

  return { ...styleOf(label), ...getAnimatedStyle(label) }.fontSize
}

// Reports the panel's size, which is what places it.
async function laidOut(width = 320, height = 168) {
  await fireEvent(panel(), 'layout', {
    nativeEvent: { layout: { height, width, x: 0, y: 0 } },
  })
}

// The layer a press outside the list lands on, drawn just before it.
function layer(): TestInstance {
  const siblings = panel().parent?.children ?? []
  const before = siblings.at(siblings.indexOf(panel()) - 1)

  if (before === undefined || typeof before === 'string') {
    throw new TypeError('expected the layer before the list')
  }
  return before
}

// The list of options, named by the field's label.
function list() {
  return screen.getByLabelText('Label')
}

// Reports the list's own size, which is what a FlatList scrolls against.
async function listLaidOut() {
  await fireEvent(list(), 'layout', {
    nativeEvent: { layout: { height: 168, width: 320, x: 0, y: 0 } },
  })
}

// An option, by its headline, inside the open list.
function optionOf(headline: string) {
  return within(list()).getByRole('button', { name: new RegExp(headline) })
}

// Two options, each handing its row to a ref, as a call site's own ref does.
function optionsWith(
  first: RefObject<HostInstance | null>,
  second: RefObject<HostInstance | null>,
) {
  return [
    <ListBox.Item id="first" key="first" ref={first}>
      First item
    </ListBox.Item>,
    <ListBox.Item id="second" key="second" ref={second}>
      Second item
    </ListBox.Item>,
  ]
}

// The surface the list is drawn on: the nearest view around it that closes
// on VoiceOver's escape gesture.
function panel(): TestInstance {
  let node: null | TestInstance = list()

  while (node !== null && !('onAccessibilityEscape' in node.props)) {
    node = node.parent
  }
  if (node === null) {
    throw new TypeError('expected the surface around the list')
  }
  return node
}

// Text the field draws, which a screen reader is kept from, since it reads
// the value and the line under the box with the box itself.
function queryShown(text: string) {
  return screen.queryByText(text, { includeHiddenElements: true })
}

// Renders a select inside a theme, with three options unless told otherwise.
async function renderSelect<M extends 'multiple' | 'single' = 'single'>(
  props: Partial<SelectProps<M>> = {},
) {
  return render(
    <ThemeScope>
      <Select<M>
        label="Label"
        options={THREE_OPTIONS}
        testID="select"
        {...props}
      />
    </ThemeScope>,
  )
}

function resize(width: number, height: number) {
  const metrics = { fontScale: 1, height, scale: 1, width }

  Dimensions.set({ screen: metrics, window: metrics })
}

function shownText(text: string) {
  return screen.getByText(text, { includeHiddenElements: true })
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle & ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

async function submit() {
  await fireEvent.press(screen.getByRole('button', { name: 'Submit' }))
}

// The test id of a view a call was made on or with, which is how a case tells
// the instances the preset's View shares its mocks between apart.
function testIdOf(view: unknown) {
  return isMockedView(view) ? view.props.testID : undefined
}

function withForm(children: ReactNode, props = {}) {
  return (
    <ThemeScope>
      <Form {...props}>
        {children}
        <Button type="submit">Submit</Button>
      </Form>
    </ThemeScope>
  )
}

beforeEach(() => {
  jest.useFakeTimers()
  frames.box = [20, 100, 320, 56]
  resize(400, 800)
  const prototype: unknown = View.prototype

  if (!isMockedView(prototype)) {
    throw new TypeError('expected the View the Jest preset mocks')
  }

  jest.spyOn(prototype, 'measureInWindow').mockImplementation(function measure(
    this: MockedView,
    callback: MeasureInWindowOnSuccessCallback,
  ) {
    callback(...(this.props.testID === 'select' ? frames.box : frames.layer))
  })
})

afterEach(() => {
  mockReducedMotion = false
  Dimensions.set(INITIAL)
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('Select', () => {
  describe('the box', () => {
    it('is a button named by its label and what it shows, saying whether its list is open', async () => {
      await renderSelect()

      expect(screen.getByRole('button', { name: 'Label Select an item' })).toBe(
        box(),
      )
      expect(expanded()).toBe(false)

      await fireEvent.press(box())

      expect(expanded()).toBe(true)
    })

    it('shows the placeholder, out of sight until the label floats', async () => {
      await renderSelect()

      expect(styleOf(shownText('Select an item')).color).toBe('transparent')

      await screen.rerender(
        <ThemeScope>
          <Select
            floatingLabel={false}
            label="Label"
            options={THREE_OPTIONS}
            testID="select"
          />
        </ThemeScope>,
      )

      expect(styleOf(shownText('Select an item')).color).toBe(
        colors.onSurfaceVariant,
      )
    })

    it('floats its label while the list is open, and rests it once it closes', async () => {
      await renderSelect()

      expect(labelSize()).toBe(typography.bodyLargeSize)

      await fireEvent.press(box())
      await advance(motion.durationShort3)

      expect(labelSize()).toBe(typography.bodySmallSize)
      expect(styleOf(shownText('Select an item')).color).toBe(
        colors.onSurfaceVariant,
      )

      await fireEvent.press(box())
      await advance(motion.durationShort3)

      expect(labelSize()).toBe(typography.bodyLargeSize)
    })

    it('floats its label while something is chosen', async () => {
      await renderSelect({ defaultValue: 'second' })

      expect(labelSize()).toBe(typography.bodySmallSize)
    })

    it('floats its label while the box has focus', async () => {
      await renderSelect()

      await fireEvent(box(), 'focus')
      await advance(motion.durationShort3)

      expect(labelSize()).toBe(typography.bodySmallSize)

      await fireEvent(box(), 'blur')
      await advance(motion.durationShort3)

      expect(labelSize()).toBe(typography.bodyLargeSize)
    })

    it('shows the placeholder it is given', async () => {
      await renderSelect({ placeholder: 'Placeholder' })

      expect(shownText('Placeholder')).toBeTruthy()
      expect(queryShown('Select an item')).toBeNull()
      expect(
        screen.getByRole('button', { name: 'Label Placeholder' }),
      ).toBeTruthy()
    })

    it('says the placeholder in the locale’s words', async () => {
      await render(
        <ThemeScope>
          <I18nProvider locale="de-DE">
            <Select label="Label" options={THREE_OPTIONS} testID="select" />
          </I18nProvider>
        </ThemeScope>,
      )

      expect(shownText('Element wählen')).toBeTruthy()
    })

    it('shows the chosen option in the on-surface role', async () => {
      await renderSelect({ defaultValue: 'second' })

      expect(styleOf(shownText('Second item')).color).toBe(colors.onSurface)
      expect(screen.getByRole('button', { name: 'Label Second item' })).toBe(
        box(),
      )
    })

    it('joins several chosen options into a list in the locale’s words', async () => {
      await renderSelect<'multiple'>({
        defaultValue: FIRST_AND_THIRD,
        selectionMode: 'multiple',
      })

      expect(shownText('First item and Third item')).toBeTruthy()

      await screen.rerender(
        <ThemeScope>
          <I18nProvider locale="de-DE">
            <Select
              defaultValue={FIRST_AND_THIRD}
              label="Label"
              options={THREE_OPTIONS}
              selectionMode="multiple"
            />
          </I18nProvider>
        </ThemeScope>,
      )

      expect(shownText('First item und Third item')).toBeTruthy()
    })

    it('joins them with a comma where the device has no list format', async () => {
      const { ListFormat } = Intl
      Reflect.deleteProperty(Intl, 'ListFormat')

      try {
        await renderSelect<'multiple'>({
          defaultValue: FIRST_AND_THIRD,
          selectionMode: 'multiple',
        })

        expect(shownText('First item, Third item')).toBeTruthy()
      } finally {
        Reflect.set(Intl, 'ListFormat', ListFormat)
      }
    })

    it('reads its description as its hint, and shows it under the box', async () => {
      await renderSelect({ description: 'Supporting line' })

      expect(box().props.accessibilityHint).toBe('Supporting line')
      expect(shownText('Supporting line')).toBeTruthy()
    })

    it('reads its error in place of the description', async () => {
      await renderSelect({
        description: 'Supporting line',
        error: 'Choose an item.',
      })

      expect(box().props.accessibilityHint).toBe('Choose an item.')
      expect(shownText('Choose an item.')).toBeTruthy()
      expect(queryShown('Supporting line')).toBeNull()
    })

    it('lands style and ref on the field, and testID on the box', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await renderSelect({ ref, style: CALL_SITE })
      const field: unknown = ref.current

      if (!isMockedView(field)) {
        throw new TypeError('expected the field')
      }

      expect(StyleSheet.flatten([field.props.style])).toEqual(CALL_SITE)
      expect(field.props.testID).toBeUndefined()
      expect(box().props.role).toBe('button')
    })
  })

  describe('opening and closing', () => {
    it('opens from a press on the box, and a choice closes it', async () => {
      const onChange = jest.fn()
      const onOpenChange = jest.fn()
      await renderSelect({ onChange, onOpenChange })

      expect(screen.queryByLabelText('Label')).toBeNull()

      await fireEvent.press(box())
      await laidOut()
      await choose('Second item')

      expect(onChange.mock.calls).toEqual([['second']])
      expect(onOpenChange.mock.calls).toEqual([[true], [false]])
      expect(box().props.accessibilityLabel).toBe('Label Second item')

      await advance(motion.durationShort2)

      expect(screen.queryByLabelText('Label')).toBeNull()
    })

    it('stays open as several are chosen', async () => {
      const onChange = jest.fn()
      await renderSelect<'multiple'>({ onChange, selectionMode: 'multiple' })

      await fireEvent.press(box())
      await laidOut()
      await choose('First item')
      await choose('Third item')
      await advance(motion.durationShort2)

      expect(onChange.mock.calls.at(-1)).toEqual([FIRST_AND_THIRD])
      expect(list()).toBeOnTheScreen()
    })

    it('closes from a second press on the box', async () => {
      const onOpenChange = jest.fn()
      await renderSelect({ onOpenChange })

      await fireEvent.press(box())
      await fireEvent.press(box())

      expect(onOpenChange.mock.calls).toEqual([[true], [false]])
    })

    it('closes from a press outside the list', async () => {
      await renderSelect({ defaultOpen: true })
      await laidOut()

      await fireEvent.press(layer())
      await advance(motion.durationShort2)

      expect(screen.queryByLabelText('Label')).toBeNull()
    })

    it("closes from Android's back gesture", async () => {
      const listeners: BackListener[] = []
      jest
        .spyOn(BackHandler, 'addEventListener')
        .mockImplementation((_, listener) => {
          listeners.push(listener)
          return { remove: jest.fn() }
        })
      await renderSelect({ defaultOpen: true })

      let handled: boolean | undefined = false
      await act(() => {
        handled = listeners.at(-1)?.(BACK_PRESS)
      })
      await advance(motion.durationShort2)

      expect(handled).toBe(true)
      expect(screen.queryByLabelText('Label')).toBeNull()
    })

    it("closes from VoiceOver's escape gesture", async () => {
      await renderSelect({ defaultOpen: true })

      await fireEvent(panel(), 'accessibilityEscape')
      await advance(motion.durationShort2)

      expect(screen.queryByLabelText('Label')).toBeNull()
    })

    it('stays mounted until its exit has run', async () => {
      await renderSelect({ defaultOpen: true })
      await laidOut()

      await fireEvent.press(layer())
      await advance(motion.durationShort2 - 1)

      expect(list()).toBeOnTheScreen()

      await advance(1)

      expect(screen.queryByLabelText('Label')).toBeNull()
    })

    it('opens nothing while disabled', async () => {
      const onOpenChange = jest.fn()
      await renderSelect({ isDisabled: true, onOpenChange })

      await fireEvent.press(box())

      expect(onOpenChange).not.toHaveBeenCalled()
      expect(screen.queryByLabelText('Label')).toBeNull()
    })

    it('opens nothing with no options, unless it allows an empty list', async () => {
      await renderSelect({ options: NONE })

      await fireEvent.press(box())

      expect(screen.queryByLabelText('Label')).toBeNull()

      await screen.rerender(
        <ThemeScope>
          <Select
            allowsEmptyCollection
            label="Label"
            options={NONE}
            testID="select"
          />
        </ThemeScope>,
      )
      await fireEvent.press(box())

      expect(within(list()).getByText('No results')).toBeTruthy()
    })

    it('follows isOpen when the call site holds it', async () => {
      await renderSelect({ isOpen: true })

      expect(list()).toBeOnTheScreen()
      expect(expanded()).toBe(true)
    })

    it('reports a choice and shows the value the call site holds', async () => {
      const onChange = jest.fn()
      await renderSelect({ defaultOpen: true, onChange, value: 'first' })
      await laidOut()

      await choose('Second item')

      expect(onChange).toHaveBeenCalledWith('second')
      expect(box().props.accessibilityLabel).toBe('Label First item')
    })

    it('keeps a closed list closed on a choice when told to', async () => {
      await renderSelect({ defaultOpen: true, shouldCloseOnSelect: false })
      await laidOut()

      await choose('Second item')
      await advance(motion.durationShort2)

      expect(list()).toBeOnTheScreen()
    })
  })

  describe('the chevron', () => {
    it('points down while closed, and turns half a turn over short3 as the list opens', async () => {
      await renderSelect()

      expect(chevronAngle()).toBe(0)

      await fireEvent.press(box())
      await advance(motion.durationShort3 / 2)

      expect(chevronAngle()).toBeLessThan(0)
      expect(chevronAngle()).toBeGreaterThan(-180)

      await advance(motion.durationShort3 / 2)

      expect(chevronAngle()).toBe(-180)

      await fireEvent.press(box())
      await advance(motion.durationShort3)

      expect(chevronAngle()).toBe(0)
    })

    it('turns at once under reduced motion', async () => {
      mockReducedMotion = true
      await renderSelect()

      await fireEvent.press(box())
      await advance(0)

      expect(chevronAngle()).toBe(-180)
    })

    it('starts turned when the list starts open', async () => {
      await renderSelect({ defaultOpen: true })

      expect(chevronAngle()).toBe(-180)
    })
  })

  describe('the list', () => {
    it('opens under the box, as wide as it, from its start', async () => {
      await renderSelect({ defaultOpen: true })

      expect(styleOf(panel())).toMatchObject({ opacity: 0 })

      await laidOut()

      expect(styleOf(panel())).toMatchObject({
        left: 20,
        top: 156 + spacing.sm,
        transformOrigin: 'top',
        width: 320,
      })
    })

    it("lines its start up with the box's", async () => {
      await renderSelect({ defaultOpen: true })

      await laidOut(200)

      expect(styleOf(panel())).toMatchObject({ left: 20 })
    })

    it('opens above the box where the window has no room under it', async () => {
      frames.box = [20, 700, 320, 56]
      await renderSelect({ defaultOpen: true })

      await laidOut()

      expect(styleOf(panel())).toMatchObject({
        top: 700 - spacing.sm - 168,
        transformOrigin: 'bottom',
      })
    })

    it('is drawn on surface container low, with the extra-small corner and the second elevation', async () => {
      await renderSelect({ defaultOpen: true })

      expect(styleOf(panel())).toMatchObject({
        backgroundColor: colors.surfaceContainerLow,
        borderRadius: radii.xs,
        boxShadow: shadows.elevation2,
        overflow: 'hidden',
      })
    })

    it('keeps the list from growing past its room', async () => {
      await renderSelect({ defaultOpen: true })

      expect(styleOf(list()).flexGrow).toBe(0)
    })

    it('marks the chosen option selected', async () => {
      await renderSelect({ defaultOpen: true, defaultValue: 'second' })

      expect(
        within(list()).getByRole('button', {
          name: /Second item/,
          selected: true,
        }),
      ).toBeOnTheScreen()
      expect(
        within(list()).getByRole('button', {
          name: /First item/,
          selected: false,
        }),
      ).toBeOnTheScreen()
    })

    it('heads its sections', async () => {
      await renderSelect({ defaultOpen: true, options: GROUPED })

      expect(
        within(list()).getByRole('heading', { name: 'Second group' }),
      ).toBeTruthy()
      expect(optionOf('Third item')).toBeOnTheScreen()
    })

    it('leaves a disabled option unchosen', async () => {
      const onChange = jest.fn()
      await renderSelect({
        defaultOpen: true,
        disabledKeys: SECOND_DISABLED,
        onChange,
      })
      await laidOut()

      await choose('Second item')

      expect(onChange).not.toHaveBeenCalled()
      expect(list()).toBeOnTheScreen()
    })
  })

  describe('a screen reader', () => {
    it('is sent to the chosen option once the list is placed', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      const first = createRef<HostInstance>()
      const second = createRef<HostInstance>()
      await renderSelect({
        defaultValue: 'second',
        options: optionsWith(first, second),
      })

      await fireEvent.press(box())

      expect(send).not.toHaveBeenCalled()

      await laidOut()

      expect(second.current).not.toBeNull()
      expect(send.mock.calls).toEqual([[second.current, 'focus']])
    })

    it('is sent to the first option a press reaches where none is chosen', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      const first = createRef<HostInstance>()
      const second = createRef<HostInstance>()
      await renderSelect({
        disabledKeys: FIRST_DISABLED,
        options: optionsWith(first, second),
      })

      await fireEvent.press(box())
      await laidOut()

      expect(second.current).not.toBeNull()
      expect(send.mock.calls).toEqual([[second.current, 'focus']])
    })

    it('finds that option inside a section', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      const ref = createRef<HostInstance>()
      await renderSelect({
        disabledKeys: FIRST_DISABLED,
        options: (
          <ListBox.Section header="First group" id="first-group">
            <ListBox.Item id="first">First item</ListBox.Item>
            <ListBox.Item id="second" ref={ref}>
              Second item
            </ListBox.Item>
          </ListBox.Section>
        ),
      })

      await fireEvent.press(box())
      await laidOut()

      expect(ref.current).not.toBeNull()
      expect(send.mock.calls).toEqual([[ref.current, 'focus']])
    })

    it('is sent to the list where no option takes a press', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      await renderSelect({ disabledKeys: FIRST_AND_THIRD, options: GROUPED })

      await fireEvent.press(box())
      await laidOut()

      expect(send).toHaveBeenCalledTimes(1)
      expect(send.mock.calls.at(0)?.[1]).toBe('focus')
    })

    it('is sent back to the box once the list has gone', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      await renderSelect()

      await fireEvent.press(box())
      await laidOut()
      send.mockClear()
      await choose('First item')
      await advance(motion.durationShort2)

      expect(
        send.mock.calls.map(([view, event]) => [testIdOf(view), event]),
      ).toEqual([['select', 'focus']])
    })
  })

  describe('scrolling to the choice', () => {
    it('opens scrolled to the chosen option, once, after the list is placed', async () => {
      const scroll = jest
        .spyOn(FlatList.prototype, 'scrollToIndex')
        .mockImplementation(() => {})
      await renderSelect({ defaultOpen: true, defaultValue: 'third' })

      await listLaidOut()

      expect(scroll).not.toHaveBeenCalled()

      await laidOut()
      await listLaidOut()
      await listLaidOut()

      expect(scroll.mock.calls).toEqual([
        [{ animated: false, index: 2, viewPosition: 1 }],
      ])
    })

    it('scrolls nothing for the first option', async () => {
      const scroll = jest
        .spyOn(FlatList.prototype, 'scrollToIndex')
        .mockImplementation(() => {})
      await renderSelect({ defaultOpen: true, defaultValue: 'first' })

      await laidOut()
      await listLaidOut()

      expect(scroll).not.toHaveBeenCalled()
    })

    it('draws the rows down to the chosen one from the start', async () => {
      await renderSelect({
        defaultOpen: true,
        defaultValue: 'item-15',
        options: MANY_OPTIONS,
      })

      expect(optionOf('Item 15')).toBeOnTheScreen()
    })

    it('scrolls near a row the list has not measured', async () => {
      const offsets = jest
        .spyOn(FlatList.prototype, 'scrollToOffset')
        .mockImplementation(() => {})
      jest
        .spyOn(FlatList.prototype, 'scrollToIndex')
        .mockImplementation(function fail(
          this: FlatList,
          { index }: { readonly index: number },
        ) {
          const failure: ScrollFailure = {
            averageItemLength: 56,
            highestMeasuredFrameIndex: 0,
            index,
          }

          this.props.onScrollToIndexFailed?.(failure)
        })
      await renderSelect({ defaultOpen: true, defaultValue: 'third' })

      await laidOut()
      await listLaidOut()

      expect(offsets.mock.calls).toEqual([[{ animated: false, offset: 112 }]])
    })
  })

  describe('in a form', () => {
    it("submits the chosen option's id under its name", async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <Select
            defaultValue="second"
            label="Label"
            name="item"
            options={THREE_OPTIONS}
            testID="select"
          />,
          { onSubmit },
        ),
      )

      await submit()

      expect(onSubmit).toHaveBeenCalledWith({ item: 'second' })
    })

    it('submits an empty string while nothing is chosen', async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <Select
            label="Label"
            name="item"
            options={THREE_OPTIONS}
            testID="select"
          />,
          { onSubmit },
        ),
      )

      await submit()

      expect(onSubmit).toHaveBeenCalledWith({ item: '' })
    })

    it('submits the list of chosen ids when several are chosen', async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <Select
            defaultValue={FIRST_AND_THIRD}
            label="Label"
            name="items"
            options={THREE_OPTIONS}
            selectionMode="multiple"
            testID="select"
          />,
          { onSubmit },
        ),
      )

      await submit()

      expect(onSubmit).toHaveBeenCalledWith({ items: FIRST_AND_THIRD })
    })

    it('holds a native form back while a required select has nothing chosen', async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <Select
            isRequired
            label="Label"
            name="item"
            options={THREE_OPTIONS}
            testID="select"
          />,
          { onSubmit, validationBehavior: 'native' },
        ),
      )

      expect(queryShown(REQUIRED)).toBeNull()

      await submit()

      expect(onSubmit).not.toHaveBeenCalled()
      expect(shownText(REQUIRED)).toBeTruthy()
      expect(box().props.accessibilityHint).toBe(REQUIRED)

      await fireEvent.press(box())
      await laidOut()
      await choose('Second item')

      expect(queryShown(REQUIRED)).toBeNull()

      await submit()

      expect(onSubmit).toHaveBeenCalledWith({ item: 'second' })
    })

    it('focuses its box when it holds a native form back', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        withForm(
          <Select
            isRequired
            label="Label"
            options={THREE_OPTIONS}
            ref={ref}
            testID="select"
          />,
          { validationBehavior: 'native' },
        ),
      )
      // The preset's View shares one mock `focus` between instances, so the
      // call's `this` says which was focused. Shared across tests too, so
      // cleared of what earlier ones focused.
      const view = ref.current

      if (view === null) {
        throw new TypeError('expected the field')
      }
      const focus = jest.spyOn(view, 'focus')
      focus.mockClear()

      await submit()

      expect(focus.mock.contexts.map(testIdOf)).toEqual(['select'])
    })

    it("shows a native form's error once a choice is made", async () => {
      await render(
        withForm(
          <Select
            label="Label"
            options={THREE_OPTIONS}
            testID="select"
            validate={anyButFirst}
          />,
          { validationBehavior: 'native' },
        ),
      )

      await fireEvent.press(box())
      await laidOut()
      await choose('First item')

      expect(shownText(REFUSED)).toBeTruthy()
    })

    it('clears the error the form has for its name once a choice is made', async () => {
      await render(
        withForm(
          <Select
            label="Label"
            name="item"
            options={THREE_OPTIONS}
            testID="select"
          />,
          { validationErrors: SERVER_ERRORS },
        ),
      )

      expect(shownText(REFUSED)).toBeTruthy()

      await fireEvent.press(box())
      await laidOut()
      await choose('Second item')

      expect(queryShown(REFUSED)).toBeNull()
    })

    it('says what its validate says about the choice', async () => {
      await renderSelect({ defaultValue: 'first', validate: anyButFirst })

      expect(shownText(REFUSED)).toBeTruthy()

      await fireEvent.press(box())
      await laidOut()
      await choose('Second item')

      expect(queryShown(REFUSED)).toBeNull()
    })
  })
})
