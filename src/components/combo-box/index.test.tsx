import type { ComponentRef, ReactNode } from 'react'
import type {
  HostInstance,
  MeasureInWindowOnSuccessCallback,
  StyleProp,
  TextInput,
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
  Platform,
  StyleSheet,
  View,
} from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { ComboBoxProps, ComboBoxSelectionMode } from '.'

import { ComboBox } from '.'
import { ThemeScope } from '../../theme-scope'
import { scopeFor } from '../../theme/scope'
import { Button } from '../button'
import { Form } from '../form'
import { ListBox } from '../list-box'

// What Android's back gesture is handed to.
type BackListener = Parameters<typeof BackHandler.addEventListener>[1]

type Frame = readonly [x: number, y: number, width: number, height: number]

// An item a list of options is built from, by a call site holding them.
type Item = { readonly id: string; readonly name: string }

// What React Native's Jest preset draws a View as: a class component holding
// its props, with the native methods on its prototype.
type MockedView = Pick<HostInstance, 'measureInWindow'> & {
  readonly props: ViewProps
}

const { theme } = scopeFor('light', {})
const { colors, motion, radii, shadows, typography } = theme

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

// Where `measureInWindow` reports the box and the overlay layer, the only
// two views measured, filling a 400 by 800 window. A case that needs the box
// elsewhere moves it.
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
const SERVER_ERRORS = { item: REFUSED }

const ITEMS: readonly Item[] = [
  { id: 'first', name: 'First item' },
  { id: 'second', name: 'Second item' },
]

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

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// Refuses a choice of the first option.
function anyButFirst({ value }: { readonly value: unknown }) {
  return value === 'first' ? REFUSED : null
}

// The box, the view the list is placed under and draws its layer around.
function box(): TestInstance {
  let node: null | TestInstance = input()

  while (node !== null && node.props.focusable !== false) {
    node = node.parent
  }
  if (node === null) {
    throw new TypeError('expected the box around the input')
  }
  return node
}

// The chevron's button, named in React Aria's words before the label.
function chevron() {
  return screen.getByRole('button', { name: 'Show suggestions Label' })
}

// How far the chevron's glyph is turned, in degrees.
function chevronAngle(): number {
  const glyph = chevron()
    .queryAll((each) => each.type.startsWith('RNSVGSvgView'))
    .at(0)
  const turned = glyph?.parent

  if (turned === null || turned === undefined) {
    throw new TypeError('expected the chevron in the button')
  }
  const { transform }: { transform?: unknown } = getAnimatedStyle(turned)
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

// What the chevron tells a screen reader about whether the list is open.
function expanded() {
  const state: unknown = chevron().props.accessibilityState

  return typeof state === 'object' && state !== null && 'expanded' in state
    ? state.expanded
    : undefined
}

// The field's text control, named by its label.
function input() {
  return screen.getByLabelText('Label')
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

// The parts of the layer a press outside the list lands on, drawn just
// before it: one over the whole screen until the list is placed, then four
// around the box.
function layerParts(): TestInstance[] {
  const siblings = panel().parent?.children ?? []
  const before = siblings.at(siblings.indexOf(panel()) - 1)

  if (before === undefined || typeof before === 'string') {
    throw new TypeError('expected the layer before the list')
  }
  if (before.props.onClick !== undefined) {
    return [before]
  }
  return before.children.filter(
    (part): part is TestInstance => typeof part !== 'string',
  )
}

// The list of options, named for the field's label.
function list() {
  return screen.getByLabelText('Suggestions Label')
}

function listShown() {
  return screen.queryByLabelText('Suggestions Label') !== null
}

// An option, by its headline, inside the open list.
function optionOf(headline: string) {
  return within(list()).getByRole('button', { name: new RegExp(headline) })
}

// The headlines of the options the open list shows, in order.
function optionsShown() {
  return within(list())
    .getAllByRole('button')
    .map((option) => textOf(option))
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
// the line under the box with the input itself.
function queryShown(text: RegExp | string) {
  return screen.queryByText(text, { includeHiddenElements: true })
}

// Renders a combo box inside a theme, with three options unless told
// otherwise.
async function renderComboBox<
  M extends ComboBoxSelectionMode = 'single',
  T extends object = object,
>(props: Partial<ComboBoxProps<T, M>> = {}) {
  return render(
    <ThemeScope>
      <ComboBox<T, M>
        label="Label"
        options={THREE_OPTIONS}
        testID="combo-box"
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

// The test id of a view a call was made on or with.
function testIdOf(view: unknown) {
  return isMockedView(view) ? view.props.testID : undefined
}

// The text a view draws, all of it, in order.
function textOf(node: string | TestInstance): string {
  return typeof node === 'string' ? node : node.children.map(textOf).join('')
}

async function type(text: string) {
  await fireEvent(input(), 'focus', {})
  await fireEvent.changeText(input(), text)
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

  // The box takes no focus of its own, since its input does, which is what
  // tells it apart from the overlay layer.
  jest.spyOn(prototype, 'measureInWindow').mockImplementation(function measure(
    this: MockedView,
    callback: MeasureInWindowOnSuccessCallback,
  ) {
    callback(...(this.props.focusable === false ? frames.box : frames.layer))
  })
})

afterEach(() => {
  Dimensions.set(INITIAL)
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('ComboBox', () => {
  describe('the field', () => {
    it('is an input named by its label, with a chevron button saying whether the list is open', async () => {
      await renderComboBox()

      expect(input().type).toBe('TextInput')
      expect(expanded()).toBe(false)

      await fireEvent.press(chevron())

      expect(expanded()).toBe(true)
    })

    it('floats its label on what is typed', async () => {
      await renderComboBox({ menuTrigger: 'manual' })

      expect(labelSize()).toBe(typography.bodyLargeSize)

      await fireEvent.changeText(input(), 'Sec')
      await advance(motion.durationShort3)

      expect(labelSize()).toBe(typography.bodySmallSize)
    })

    it('floats its label while the list is open', async () => {
      await renderComboBox()

      await fireEvent.press(chevron())
      await advance(motion.durationShort3)

      expect(labelSize()).toBe(typography.bodySmallSize)
    })

    it('starts with the chosen option’s text in the input', async () => {
      await renderComboBox({ defaultValue: 'second' })

      expect(input().props.value).toBe('Second item')
    })

    it('reads its description as its hint, and its error in its place', async () => {
      await renderComboBox({ description: 'Supporting line' })

      expect(input().props.accessibilityHint).toBe('Supporting line')

      await screen.rerender(
        <ThemeScope>
          <ComboBox
            description="Supporting line"
            error="Enter a value."
            label="Label"
            options={THREE_OPTIONS}
          />
        </ThemeScope>,
      )

      expect(input().props.accessibilityHint).toBe('Enter a value.')
      expect(styleOf(shownText('Enter a value.')).color).toBe(colors.error)
    })

    it('lands style and ref on the field, and inputRef and testID on the input', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      const inputRef = createRef<ComponentRef<typeof TextInput>>()
      await renderComboBox({ inputRef, ref, style: CALL_SITE })

      expect(isMockedView(ref.current) && styleOf(ref.current)).toMatchObject(
        CALL_SITE,
      )
      expect(inputRef.current).not.toBeNull()
      expect(screen.getByTestId('combo-box')).toBe(input())
    })

    it('takes no input and opens nothing while disabled', async () => {
      await renderComboBox({ isDisabled: true })

      expect(input().props.editable).toBe(false)

      await fireEvent.press(chevron())

      expect(listShown()).toBe(false)
    })

    it('shows its value and opens nothing while read-only', async () => {
      await renderComboBox({ defaultValue: 'first', isReadOnly: true })

      expect(input().props.editable).toBe(false)
      expect(input().props.value).toBe('First item')

      await fireEvent.press(chevron())

      expect(listShown()).toBe(false)
    })
  })

  describe('typing', () => {
    it('opens the list, keeping the options holding what was typed', async () => {
      const onOpenChange = jest.fn()
      await renderComboBox({ onOpenChange })

      await type('ir')

      expect(optionsShown()).toEqual(['First item', 'Third item'])
      expect(onOpenChange.mock.calls).toEqual([[true, 'input']])

      await fireEvent.changeText(input(), 'thi')

      expect(optionsShown()).toEqual(['Third item'])
    })

    it('ignores case and accents', async () => {
      await renderComboBox()

      await type('SÉC')

      expect(optionsShown()).toEqual(['Second item'])
    })

    it('keeps what its defaultFilter keeps', async () => {
      await renderComboBox({
        defaultFilter: (text, typed) => text.endsWith(typed),
      })

      await type('item')

      expect(optionsShown()).toEqual([
        'First item',
        'Second item',
        'Third item',
      ])

      await fireEvent.changeText(input(), 'First')
      await advance(motion.durationShort2)

      expect(listShown()).toBe(false)
    })

    it('leaves the items it is handed to the call site to filter', async () => {
      await renderComboBox<'single', Item>({
        items: ITEMS,
        options: (item) => (
          <ListBox.Item id={item.id}>{item.name}</ListBox.Item>
        ),
      })

      await type('Sec')

      expect(optionsShown()).toEqual(['First item', 'Second item'])
    })

    it('closes once a search leaves nothing, unless it allows an empty list', async () => {
      await renderComboBox()

      await type('zzz')
      await advance(motion.durationShort2)

      expect(listShown()).toBe(false)

      await screen.rerender(
        <ThemeScope>
          <ComboBox
            allowsEmptyCollection
            label="Label"
            options={THREE_OPTIONS}
          />
        </ThemeScope>,
      )
      await fireEvent.changeText(input(), 'zz')

      expect(listShown()).toBe(true)
    })

    it('opens nothing on typing when told the chevron alone opens it', async () => {
      await renderComboBox({ menuTrigger: 'manual' })

      await type('Sec')

      expect(listShown()).toBe(false)
    })

    it('opens with every option as it takes focus, when told to', async () => {
      const onOpenChange = jest.fn()
      await renderComboBox({
        defaultInputValue: 'Sec',
        menuTrigger: 'focus',
        onOpenChange,
      })

      await fireEvent(input(), 'focus', {})

      expect(optionsShown()).toEqual([
        'First item',
        'Second item',
        'Third item',
      ])
      expect(onOpenChange.mock.calls).toEqual([[true, 'focus']])
    })

    it('reports what is typed', async () => {
      const onInputChange = jest.fn()
      await renderComboBox({ onInputChange })

      await type('Sec')

      expect(onInputChange.mock.calls).toEqual([['Sec']])
    })
  })

  describe('choosing', () => {
    it('takes the chosen option’s id and text, and closes', async () => {
      const onChange = jest.fn()
      const onOpenChange = jest.fn()
      await renderComboBox({ onChange, onOpenChange })

      await type('Sec')
      await laidOut()
      await choose('Second item')

      expect(onChange.mock.calls).toEqual([['second']])
      expect(input().props.value).toBe('Second item')
      expect(onOpenChange.mock.calls.at(-1)).toEqual([false, undefined])

      await advance(motion.durationShort2)

      expect(listShown()).toBe(false)
    })

    it('puts the text back as it loses focus, where it matches no option', async () => {
      await renderComboBox({ defaultValue: 'first' })

      await type('Fir')
      await fireEvent(input(), 'blur', {})

      expect(input().props.value).toBe('First item')
      expect(expanded()).toBe(false)
    })

    it('keeps text that matches no option, when it allows that', async () => {
      const onChange = jest.fn()
      await renderComboBox({
        allowsCustomValue: true,
        defaultValue: 'first',
        onChange,
      })

      await type('Custom')
      await fireEvent(input(), 'blur', {})

      expect(input().props.value).toBe('Custom')
      expect(onChange.mock.calls).toEqual([[null]])
    })

    it('shows the value the call site holds, and reports a choice', async () => {
      const onChange = jest.fn()
      await renderComboBox({ onChange, value: 'third' })

      expect(input().props.value).toBe('Third item')

      await fireEvent.press(chevron())
      await laidOut()
      await choose('First item')

      expect(onChange.mock.calls).toEqual([['first']])
      expect(input().props.value).toBe('Third item')
    })
  })

  describe('choosing several', () => {
    it('stays open as several are chosen, clearing what was typed', async () => {
      const onChange = jest.fn()
      await renderComboBox<'multiple'>({ onChange, selectionMode: 'multiple' })

      await type('ir')
      await laidOut()
      await choose('First item')

      expect(input().props.value).toBe('')

      await choose('Third item')
      await advance(motion.durationShort2)

      expect(onChange.mock.calls.at(-1)).toEqual([FIRST_AND_THIRD])
      expect(listShown()).toBe(true)
    })

    it('draws the chosen options before the input, as a list in the locale’s words', async () => {
      await renderComboBox<'multiple'>({
        defaultValue: FIRST_AND_THIRD,
        selectionMode: 'multiple',
      })

      const chosen = shownText('First item and Third item')

      expect(chosen.props.numberOfLines).toBe(1)
      expect(styleOf(chosen).color).toBe(colors.onSurface)
      expect(input().props.accessibilityHint).toBe('First item and Third item')
      expect(input().props.value).toBe('')
    })

    it('floats its label over the chosen options', async () => {
      await renderComboBox<'multiple'>({
        defaultValue: FIRST_AND_THIRD,
        selectionMode: 'multiple',
      })
      await advance(motion.durationShort3)

      expect(labelSize()).toBe(typography.bodySmallSize)
    })

    it('draws no line before the input while nothing is chosen', async () => {
      await renderComboBox<'multiple'>({ selectionMode: 'multiple' })

      expect(input().props.accessibilityHint).toBeUndefined()
      expect(labelSize()).toBe(typography.bodyLargeSize)
    })
  })

  describe('the chevron', () => {
    it('opens every option whatever was typed, and closes them again', async () => {
      const onOpenChange = jest.fn()
      await renderComboBox({ menuTrigger: 'manual', onOpenChange })

      await type('Sec')
      await fireEvent.press(chevron())

      expect(optionsShown()).toEqual([
        'First item',
        'Second item',
        'Third item',
      ])
      expect(onOpenChange.mock.calls).toEqual([[true, 'manual']])

      await fireEvent.press(chevron())

      expect(onOpenChange.mock.calls.at(-1)).toEqual([false, undefined])
    })

    it('moves the focus into the input', async () => {
      const inputRef = createRef<ComponentRef<typeof TextInput>>()
      await renderComboBox({ inputRef })
      const control = inputRef.current

      if (control === null) {
        throw new TypeError('expected the input')
      }
      const focus = jest.spyOn(control, 'focus')

      await fireEvent.press(chevron())

      expect(focus).toHaveBeenCalledTimes(1)
    })

    it('turns half a turn as the list opens', async () => {
      await renderComboBox()

      expect(chevronAngle()).toBe(0)

      await fireEvent.press(chevron())
      await advance(motion.durationShort3)

      expect(chevronAngle()).toBe(-180)
    })

    it('reaches the 48dp target from its 24dp icon', async () => {
      await renderComboBox()

      expect(styleOf(chevron())).toMatchObject({
        borderRadius: radii.circle,
        height: 24,
        width: 24,
      })
      expect(chevron().props.hitSlop).toEqual({
        bottom: 12,
        left: 12,
        right: 12,
        top: 12,
      })
    })
  })

  describe('the list', () => {
    it('opens under the box, as wide as it, from its start', async () => {
      await renderComboBox()

      await type('ir')
      await laidOut()

      expect(styleOf(panel())).toMatchObject({
        left: 20,
        position: 'absolute',
        top: 164,
        width: 320,
      })
    })

    it('opens above the box where the window has no room under it', async () => {
      frames.box = [20, 640, 320, 56]
      await renderComboBox()

      await type('ir')
      await laidOut()

      expect(styleOf(panel())).toMatchObject({ top: 464 })
    })

    it('is drawn on surface container low, with the extra-small corner and the second elevation', async () => {
      await renderComboBox()

      await type('ir')

      expect(styleOf(panel())).toMatchObject({
        backgroundColor: colors.surfaceContainerLow,
        borderRadius: radii.xs,
        boxShadow: shadows.elevation2,
        overflow: 'hidden',
      })
    })

    it('keeps the keyboard up for a tap on an option, and its rows from growing past its room', async () => {
      await renderComboBox()

      await type('ir')

      expect(list().props.keyboardShouldPersistTaps).toBe('handled')
      expect(styleOf(list()).flexGrow).toBe(0)
    })

    it('marks the chosen option selected', async () => {
      await renderComboBox({ defaultValue: 'second' })

      await fireEvent.press(chevron())

      expect(optionOf('Second item').props.accessibilityState).toMatchObject({
        selected: true,
      })
    })
  })

  describe('closing', () => {
    it('leaves the box out of the layer that closes it', async () => {
      await renderComboBox()

      await type('ir')

      expect(layerParts()).toHaveLength(1)

      await laidOut()

      const [above, below, start, end] = layerParts().map(styleOf)

      expect(above).toMatchObject({ height: 100, top: 0 })
      expect(below).toMatchObject({ bottom: 0, top: 156 })
      expect(start).toMatchObject({ height: 56, left: 0, top: 100, width: 20 })
      expect(end).toMatchObject({ height: 56, left: 340, right: 0, top: 100 })
    })

    it('stays open for a press on the box', async () => {
      await renderComboBox()

      await type('ir')
      await laidOut()
      await fireEvent.press(box())
      await advance(motion.durationShort2)

      expect(listShown()).toBe(true)
    })

    it('closes from a press outside, taking the focus out of the input', async () => {
      const inputRef = createRef<ComponentRef<typeof TextInput>>()
      await renderComboBox({ defaultValue: 'first', inputRef })
      const control = inputRef.current

      if (control === null) {
        throw new TypeError('expected the input')
      }
      const blur = jest.spyOn(control, 'blur')

      await type('Sec')
      await laidOut()
      await fireEvent.press(layerParts()[1] ?? box())
      await advance(motion.durationShort2)

      expect(blur).toHaveBeenCalledTimes(1)
      expect(listShown()).toBe(false)
      expect(input().props.value).toBe('First item')
    })

    it("closes from Android's back gesture", async () => {
      const listeners: BackListener[] = []
      jest
        .spyOn(BackHandler, 'addEventListener')
        .mockImplementation((_, listener) => {
          listeners.push(listener)
          return { remove: jest.fn() }
        })
      await renderComboBox()

      await type('ir')

      let handled: boolean | undefined = false
      await act(() => {
        handled = listeners.at(-1)?.(BACK_PRESS)
      })
      await advance(motion.durationShort2)

      expect(handled).toBe(true)
      expect(listShown()).toBe(false)
    })

    it("closes from VoiceOver's escape gesture", async () => {
      await renderComboBox()

      await type('ir')
      await fireEvent(panel(), 'accessibilityEscape')
      await advance(motion.durationShort2)

      expect(listShown()).toBe(false)
    })

    it('closes as the input loses focus', async () => {
      await renderComboBox()

      await type('ir')
      await fireEvent(input(), 'blur', {})
      await advance(motion.durationShort2)

      expect(listShown()).toBe(false)
    })

    it('stays open as the input loses focus under React Native Web, where a click on an option takes it', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await renderComboBox()

      await type('ir')
      await fireEvent(input(), 'blur', {})
      await advance(motion.durationShort2)

      expect(listShown()).toBe(true)
    })
  })

  describe('a screen reader', () => {
    it('stays in the input while typing opens and closes the list', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      await renderComboBox()

      await type('Sec')
      await laidOut()
      await choose('Second item')
      await advance(motion.durationShort2)

      expect(send).not.toHaveBeenCalled()
    })

    it('is sent to the chosen option as the chevron opens the list, and back to the input after', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      const option = createRef<HostInstance>()
      await renderComboBox({
        defaultValue: 'second',
        options: [
          <ListBox.Item id="first" key="first">
            First item
          </ListBox.Item>,
          <ListBox.Item id="second" key="second" ref={option}>
            Second item
          </ListBox.Item>,
        ],
      })

      await fireEvent.press(chevron())

      expect(send).not.toHaveBeenCalled()

      await laidOut()

      expect(option.current).not.toBeNull()
      expect(send.mock.calls).toEqual([[option.current, 'focus']])

      send.mockClear()
      await choose('First item')
      await advance(motion.durationShort2)

      expect(
        send.mock.calls.map(([view, event]) => [testIdOf(view), event]),
      ).toEqual([['combo-box', 'focus']])
    })

    it('hears how many options are listed as the list opens and as a search changes it', async () => {
      jest.replaceProperty(Platform, 'OS', 'android')
      await renderComboBox()

      expect(queryShown(/available/u)).toBeNull()

      await type('ir')

      const status = shownText('2 options available.')

      expect(status.parent?.props['aria-live']).toBe('polite')

      await fireEvent.changeText(input(), 'thi')

      expect(shownText('1 option available.')).toBeTruthy()

      await fireEvent(input(), 'blur', {})

      expect(queryShown(/available/u)).toBeNull()
    })

    it('hears it on iOS through AccessibilityInfo', async () => {
      jest.replaceProperty(Platform, 'OS', 'ios')
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation(() => undefined)
      // The preset's mock keeps what earlier cases said, so it starts clear.
      announce.mockClear()
      await renderComboBox()

      await fireEvent.press(chevron())

      expect(announce.mock.calls).toEqual([['3 options available.']])
    })
  })

  describe('in a form', () => {
    it("submits the chosen option's id under its name", async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <ComboBox
            defaultValue="second"
            label="Label"
            name="item"
            options={THREE_OPTIONS}
          />,
          { onSubmit },
        ),
      )

      await submit()

      expect(onSubmit).toHaveBeenCalledWith({ item: 'second' })
    })

    it('submits the text where told to, or where it allows a custom value', async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <>
            <ComboBox
              defaultValue="second"
              formValue="text"
              label="Label"
              name="named"
              options={THREE_OPTIONS}
            />
            <ComboBox
              allowsCustomValue
              defaultInputValue="Custom"
              label="Other"
              name="custom"
              options={THREE_OPTIONS}
            />
          </>,
          { onSubmit },
        ),
      )

      await submit()

      expect(onSubmit).toHaveBeenCalledWith({
        custom: 'Custom',
        named: 'Second item',
      })
    })

    it('submits the list of chosen ids when several are chosen', async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <ComboBox
            defaultValue={FIRST_AND_THIRD}
            formValue="text"
            label="Label"
            name="items"
            options={THREE_OPTIONS}
            selectionMode="multiple"
          />,
          { onSubmit },
        ),
      )

      await submit()

      expect(onSubmit).toHaveBeenCalledWith({ items: FIRST_AND_THIRD })
    })

    it('holds a native form back while a required field has nothing chosen', async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <ComboBox
            isRequired
            label="Label"
            name="item"
            options={THREE_OPTIONS}
          />,
          { onSubmit, validationBehavior: 'native' },
        ),
      )

      await submit()

      expect(onSubmit).not.toHaveBeenCalled()
      expect(shownText(REQUIRED)).toBeTruthy()

      await fireEvent.press(chevron())
      await laidOut()
      await choose('Second item')

      expect(queryShown(REQUIRED)).toBeNull()

      await submit()

      expect(onSubmit).toHaveBeenCalledWith({ item: 'second' })
    })

    it('holds a native form back while a required custom field has nothing typed', async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <ComboBox
            allowsCustomValue
            defaultValue="first"
            isRequired
            label="Label"
            name="item"
            options={THREE_OPTIONS}
          />,
          { onSubmit, validationBehavior: 'native' },
        ),
      )

      await type('')
      await fireEvent(input(), 'blur', {})
      await submit()

      expect(onSubmit).not.toHaveBeenCalled()
      expect(shownText(REQUIRED)).toBeTruthy()
    })

    it('lets a required custom field through with text that matches no option', async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <ComboBox
            allowsCustomValue
            isRequired
            label="Label"
            name="item"
            options={THREE_OPTIONS}
          />,
          { onSubmit, validationBehavior: 'native' },
        ),
      )

      await type('Custom')
      await submit()

      expect(onSubmit).toHaveBeenCalledWith({ item: 'Custom' })
    })

    it('lets a required field choosing several through with options chosen and nothing typed', async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <ComboBox
            defaultValue={FIRST_AND_THIRD}
            formValue="text"
            isRequired
            label="Label"
            name="items"
            options={THREE_OPTIONS}
            selectionMode="multiple"
          />,
          { onSubmit, validationBehavior: 'native' },
        ),
      )

      await submit()

      expect(onSubmit).toHaveBeenCalledWith({ items: FIRST_AND_THIRD })
    })

    it("shows a native form's error once a choice is made", async () => {
      await render(
        withForm(
          <ComboBox
            label="Label"
            options={THREE_OPTIONS}
            validate={anyButFirst}
          />,
          { validationBehavior: 'native' },
        ),
      )

      await fireEvent.press(chevron())
      await laidOut()
      await choose('First item')

      expect(shownText(REFUSED)).toBeTruthy()
    })

    it('focuses its input when it holds a native form back', async () => {
      const inputRef = createRef<ComponentRef<typeof TextInput>>()
      await render(
        withForm(
          <ComboBox
            inputRef={inputRef}
            isRequired
            label="Label"
            options={THREE_OPTIONS}
          />,
          { validationBehavior: 'native' },
        ),
      )
      const control = inputRef.current

      if (control === null) {
        throw new TypeError('expected the input')
      }
      const focus = jest.spyOn(control, 'focus')

      await submit()

      expect(focus).toHaveBeenCalledTimes(1)
    })

    it('clears the error the form has for its name once a choice is made', async () => {
      await render(
        withForm(
          <ComboBox label="Label" name="item" options={THREE_OPTIONS} />,
          { validationErrors: SERVER_ERRORS },
        ),
      )

      expect(shownText(REFUSED)).toBeTruthy()

      await fireEvent.press(chevron())
      await laidOut()
      await choose('Second item')

      expect(queryShown(REFUSED)).toBeNull()
    })

    it('clears the error the form has for its name as it is typed', async () => {
      await render(
        withForm(
          <ComboBox label="Label" name="item" options={THREE_OPTIONS} />,
          { validationErrors: SERVER_ERRORS },
        ),
      )

      await type('S')

      expect(queryShown(REFUSED)).toBeNull()
    })

    it('says what its validate says, handed the text and the choice', async () => {
      const validate = jest.fn(anyButFirst)
      await renderComboBox({ defaultValue: 'first', validate })

      expect(shownText(REFUSED)).toBeTruthy()
      expect(validate).toHaveBeenLastCalledWith({
        inputValue: 'First item',
        selectedKey: 'first',
        value: 'first',
      })

      await fireEvent.press(chevron())
      await laidOut()
      await choose('Second item')

      expect(queryShown(REFUSED)).toBeNull()
    })
  })
})
