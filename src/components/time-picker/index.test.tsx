import type { ComponentRef, ReactNode } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { TestInstance } from 'test-renderer'

import { CalendarDateTime, Time } from '@internationalized/date'
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
import { Platform, StyleSheet, TextInput, View } from 'react-native'
import { State } from 'react-native-gesture-handler'
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils'

import type { TimePickerProps } from '.'

import { TimePicker } from '.'
import { I18nProvider } from '../../i18n/provider'
import { ThemeScope } from '../../theme-scope'
import { scopeFor } from '../../theme/scope'

type Point = readonly [x: number, y: number]

const { theme } = scopeFor('light', {})
const { colors, motion } = theme

const CALL_SITE = { marginTop: 4 }

// A fixed time, so every case reads the same whenever it runs.
const TIME = new Time(9, 30)

// Places on the dial, in its own coordinates: the outer ring and the inner
// one at three, six and twelve o'clock.
const OUTER_THREE: Point = [229, 128]
const OUTER_SIX: Point = [128, 229]
const OUTER_TWELVE: Point = [128, 27]
const INNER_THREE: Point = [192, 128]
const INNER_TWELVE: Point = [128, 64]
// Seven minutes past, between two of the minute labels.
const SEVEN_PAST: Point = [
  128 + 101 * Math.sin((7 / 60) * 2 * Math.PI),
  128 - 101 * Math.cos((7 / 60) * 2 * Math.PI),
]

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// The modal's boxes, by the part each stands for.
function boxOf(part: 'hour' | 'minute') {
  return within(container()).getByLabelText(`${part}, Label`)
}

function child(node: TestInstance['children'][number] | undefined) {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

function clockButton(name = 'Select time Label') {
  return screen.getByRole('button', { name })
}

// The modal's container, which closes on VoiceOver's escape gesture.
function container() {
  return screen.getByTestId('picker-modal')
}

// The dial, which a screen reader is not shown.
function dial() {
  return screen.getByTestId('picker-dial', { includeHiddenElements: true })
}

// What the dial's labels say, in turn round each ring.
function dialLabels() {
  return findAll(dial(), (node) => node.type === 'Text').map((node) =>
    node.children
      .map((each) => (typeof each === 'string' ? each : ''))
      .join(''),
  )
}

// A pan on the dial, carried through to its end: begun at the first place,
// moved through the rest, and let go at the last.
async function drag(...along: readonly Point[]) {
  const [first = OUTER_TWELVE] = along
  const last = along.at(-1) ?? first
  await act(() => {
    fireGestureHandler(getByGestureTestId('picker-dial-pan'), [
      { state: State.BEGAN, x: first[0], y: first[1] },
      ...along.map(([x, y]) => ({ state: State.ACTIVE, x, y })),
      { state: State.END, x: last[0], y: last[1] },
    ])
  })
}

// The field's own segments, outside the modal, by what each shows.
function fieldShows() {
  return screen
    .getAllByRole(Platform.OS === 'web' ? 'spinbutton' : 'adjustable')
    .filter((segment) => !isIn(segment, 'picker-modal'))
    .map(textOf)
}

function findAll(
  node: TestInstance['children'][number],
  matches: (node: TestInstance) => boolean,
): TestInstance[] {
  if (typeof node === 'string') {
    return []
  }
  return [
    ...(matches(node) ? [node] : []),
    ...node.children.flatMap((each) => findAll(each, matches)),
  ]
}

// Where the hand's handle sits, the circle the size of a label's square.
function handle() {
  const found = findAll(
    dial(),
    (node) => node.type === 'RNSVGCircle' && Number(node.props.r) === 24,
  )
  return found.map((node) => [Number(node.props.cx), Number(node.props.cy)])[0]
}

// The hidden input the boxes take their keys through on iOS and Android.
function input() {
  return within(container()).getByDisplayValue(' ', {
    includeHiddenElements: true,
    normalizer: (text) => text,
  })
}

function isIn(node: TestInstance, testID: string) {
  let at: null | TestInstance = node

  while (at !== null) {
    if (at.props.testID === testID) {
      return true
    }
    at = at.parent
  }
  return false
}

// The `Modal` the picker's modal is drawn in.
function modal() {
  let node: null | TestInstance = container()

  while (node !== null && !('onRequestClose' in node.props)) {
    node = node.parent
  }
  if (node === null) {
    throw new TypeError('expected the Modal around the container')
  }
  return node
}

async function open() {
  await fireEvent.press(clockButton())
}

async function renderPicker(
  props: Partial<TimePickerProps> = {},
  wrap?: (children: ReactNode) => ReactNode,
) {
  const picker = (
    <TimePicker
      defaultValue={TIME}
      label="Label"
      locale="en-US"
      testID="picker"
      {...props}
    />
  )

  return render(
    <ThemeScope>{wrap === undefined ? picker : wrap(picker)}</ThemeScope>,
  )
}

// The scrim, the first thing the `Modal` draws.
function scrim() {
  return child(modal().children[0])
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle & ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

async function tap([x, y]: Point) {
  await act(() => {
    fireGestureHandler(getByGestureTestId('picker-dial-tap'), [
      { state: State.BEGAN, x, y },
      { state: State.ACTIVE, x, y },
      { state: State.END, x, y },
    ])
  })
}

// A segment's or a box's text, its first child's.
function textOf(segment: TestInstance) {
  const text = child(segment.children.at(0)).children.at(0)
  return typeof text === 'string' ? text : undefined
}

// Types each key into the boxes' hidden input, as the keyboard hands them
// over one change at a time after the space it holds.
async function typeKeys(keys: string) {
  for (const key of keys) {
    // oxlint-disable-next-line no-await-in-loop -- each key is an act of its own, and two acts may not overlap
    await fireEvent.changeText(input(), ` ${key}`)
  }
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('TimePicker', () => {
  describe('the field', () => {
    it("draws the time in TimeField's segments, and an empty picker's placeholders", async () => {
      await renderPicker()

      expect(fieldShows()).toEqual(['9', '30', 'AM'])

      await renderPicker({ defaultValue: undefined })

      expect(fieldShows()).toEqual(['––', '––', 'AM'])
    })

    it('ends the box in a clock button naming the label, saying whether it is open', async () => {
      await renderPicker()

      expect(clockButton()).toBeEnabled()
      expect(clockButton()).toBeCollapsed()
      expect(
        clockButton().queryAll((node) => node.type === 'RNSVGSvgView'),
      ).toHaveLength(1)

      await open()

      expect(clockButton()).toBeExpanded()
    })

    it('disables the button while the field is disabled or read only', async () => {
      await renderPicker({ isDisabled: true })

      expect(clockButton()).toBeDisabled()

      await renderPicker({ isReadOnly: true })

      expect(clockButton()).toBeDisabled()
    })

    it('puts style, ref and testID on the field as a whole', async () => {
      const ref = createRef<ComponentRef<typeof View>>()

      await renderPicker({ ref, style: CALL_SITE })

      expect(screen.getByTestId('picker')).toHaveStyle(CALL_SITE)
      expect(ref.current).not.toBeNull()
    })
  })

  describe('the modal', () => {
    it("opens on the dial, headed by the page's words, with the field's time in the boxes", async () => {
      await renderPicker()
      await open()

      expect(
        within(container()).getByRole('heading', { name: 'Select time' }),
      ).toBeOnTheScreen()
      expect(textOf(boxOf('hour'))).toBe('09')
      expect(textOf(boxOf('minute'))).toBe('30')
      expect(dialLabels()).toEqual([
        '12',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
        '11',
      ])
    })

    it('names itself by its headline and the label on iOS and Android', async () => {
      await renderPicker()
      await open()

      expect(container()).toHaveProp('aria-label', 'Select time, Label')
      expect(container()).toHaveProp('role', 'dialog')
    })

    it('marks the box the dial sets as selected, the hour first', async () => {
      await renderPicker()
      await open()

      expect(styleOf(boxOf('hour')).backgroundColor).toBe(
        colors.primaryContainer,
      )
      expect(styleOf(child(boxOf('hour').children[0])).color).toBe(
        colors.onPrimaryContainer,
      )
      expect(styleOf(boxOf('minute')).backgroundColor).toBe(
        colors.surfaceContainerHighest,
      )
      expect(styleOf(child(boxOf('minute').children[0])).color).toBe(
        colors.onSurface,
      )
    })

    it('opens on an empty field at the placeholder, else at midnight', async () => {
      await renderPicker({
        defaultValue: undefined,
        placeholderValue: new Time(14, 5),
      })
      await open()

      expect(textOf(boxOf('hour'))).toBe('02')
      expect(textOf(boxOf('minute'))).toBe('05')

      await renderPicker({ defaultValue: undefined })
      await open()

      expect(textOf(boxOf('hour'))).toBe('12')
      expect(textOf(boxOf('minute'))).toBe('00')
    })

    it('draws the colon between the boxes, and no day period box', async () => {
      await renderPicker()
      await open()

      expect(within(container()).queryByLabelText('AM/PM, Label')).toBeNull()
      const colon = within(container()).getByText(':', {
        includeHiddenElements: true,
      })

      expect(styleOf(colon)).toMatchObject({
        color: colors.onSurface,
        textAlign: 'center',
      })
      // The space before the day period is left out with it.
      expect(
        boxOf('hour').parent?.children.flatMap((each) =>
          typeof each !== 'string' && each.type === 'Text' ? each.children : [],
        ),
      ).toEqual([':'])
    })

    it('hides the dial from a screen reader', async () => {
      await renderPicker()
      await open()

      expect(dial()).toHaveProp('aria-hidden', true)
    })

    it('lays the dial out left to right, where its labels are placed', async () => {
      await renderPicker()
      await open()

      let square = dial().parent

      while (square !== null && styleOf(square).width === undefined) {
        square = square.parent
      }

      expect(square).toHaveStyle({ direction: 'ltr' })
    })
  })

  describe('the dial', () => {
    it('sets the hour where a drag lets go, then moves on to the minutes', async () => {
      await renderPicker()
      await open()
      await drag(OUTER_TWELVE, OUTER_SIX, OUTER_THREE)

      expect(textOf(boxOf('hour'))).toBe('03')
      expect(styleOf(boxOf('minute')).backgroundColor).toBe(
        colors.primaryContainer,
      )
      expect(dialLabels()).toEqual([
        '00',
        '05',
        '10',
        '15',
        '20',
        '25',
        '30',
        '35',
        '40',
        '45',
        '50',
        '55',
      ])
    })

    it('sets the minute where a tap lands, to the minute', async () => {
      await renderPicker()
      await open()
      await fireEvent.press(boxOf('minute'))
      await tap(OUTER_THREE)

      expect(textOf(boxOf('minute'))).toBe('15')

      await tap(SEVEN_PAST)

      expect(textOf(boxOf('minute'))).toBe('07')
    })

    it('draws the label under the handle in on primary, and a dot on the handle between labels', async () => {
      await renderPicker()
      await open()

      const label = within(dial()).getByText('9', {
        includeHiddenElements: true,
      })

      expect(styleOf(label).color).toBe(colors.onPrimary)
      expect(
        styleOf(
          within(dial()).getByText('10', {
            includeHiddenElements: true,
          }),
        ).color,
      ).toBe(colors.onSurface)

      await fireEvent.press(boxOf('minute'))

      expect(
        styleOf(within(dial()).getByText('30', { includeHiddenElements: true }))
          .color,
      ).toBe(colors.onPrimary)

      // The dot is the one circle smaller than the hand's centre.
      const dots = () =>
        findAll(
          dial(),
          (node) => node.type === 'RNSVGCircle' && Number(node.props.r) < 4,
        )

      expect(dots()).toHaveLength(0)

      await tap(SEVEN_PAST)

      expect(dots().length).toBeGreaterThan(0)
    })

    it('keeps the half of the day on a twelve-hour clock', async () => {
      await renderPicker({ defaultValue: new Time(21, 30) })
      await open()
      await tap(OUTER_THREE)

      expect(textOf(boxOf('hour'))).toBe('03')
      expect(
        within(container()).getByRole('radio', { name: 'PM' }),
      ).toBeChecked()
    })

    it("puts a twenty-four hour clock's second half on an inner ring", async () => {
      await renderPicker({ hourCycle: 24 })
      await open()

      expect(dialLabels()).toHaveLength(24)
      expect(dialLabels().slice(12, 14)).toEqual(['12', '13'])

      await tap(INNER_THREE)

      expect(textOf(boxOf('hour'))).toBe('15')

      await fireEvent.press(boxOf('hour'))
      await tap(OUTER_TWELVE)

      expect(textOf(boxOf('hour'))).toBe('00')

      await fireEvent.press(boxOf('hour'))
      await tap(INNER_TWELVE)

      expect(textOf(boxOf('hour'))).toBe('12')
    })

    it("draws the handle on the ring of the hour's label", async () => {
      await renderPicker({ defaultValue: new Time(15), hourCycle: 24 })
      await open()

      expect(handle()).toEqual([192, 128])

      await renderPicker({ defaultValue: new Time(3), hourCycle: 24 })
      await open()

      expect(handle()).toEqual([229, 128])
    })

    it('stays on the hours when the field shows no minutes', async () => {
      await renderPicker({ granularity: 'hour' })
      await open()
      await tap(OUTER_THREE)

      expect(textOf(boxOf('hour'))).toBe('03')
      expect(within(container()).queryByLabelText('minute, Label')).toBeNull()
      expect(dialLabels()[0]).toBe('12')
    })

    it('follows the box pressed, without raising the keyboard', async () => {
      await renderPicker()
      await open()
      const focus = jest.spyOn(TextInput.prototype, 'focus').mockClear()

      await fireEvent.press(boxOf('minute'))

      expect(dialLabels()[0]).toBe('00')
      expect(focus).not.toHaveBeenCalled()

      await fireEvent.press(boxOf('hour'))

      expect(dialLabels()[0]).toBe('12')
    })
  })

  describe('the period selector', () => {
    it("offers the locale's two words as radios, the one the time is in checked", async () => {
      await renderPicker()
      await open()

      const group = within(container()).getByLabelText('AM/PM')

      expect(group).toHaveProp('role', 'radiogroup')

      expect(within(group).getByRole('radio', { name: 'AM' })).toBeChecked()
      expect(within(group).getByRole('radio', { name: 'PM' })).not.toBeChecked()
    })

    it('moves the time into the other half of the day, and leaves it on the same one', async () => {
      await renderPicker()
      await open()
      await fireEvent.press(
        within(container()).getByRole('radio', { name: 'PM' }),
      )

      expect(
        within(container()).getByRole('radio', { name: 'PM' }),
      ).toBeChecked()
      expect(dialLabels()[0]).toBe('12')

      await fireEvent.press(screen.getByRole('button', { name: 'OK' }))
      await advance(motion.durationShort2)

      expect(fieldShows()).toEqual(['9', '30', 'PM'])

      await open()
      await fireEvent.press(
        within(container()).getByRole('radio', { name: 'PM' }),
      )
      await fireEvent.press(screen.getByRole('button', { name: 'OK' }))

      expect(fieldShows()).toEqual(['9', '30', 'PM'])

      await advance(motion.durationShort2)
      await open()
      await fireEvent.press(
        within(container()).getByRole('radio', { name: 'AM' }),
      )
      await fireEvent.press(screen.getByRole('button', { name: 'OK' }))

      expect(fieldShows()).toEqual(['9', '30', 'AM'])
    })

    it('draws the chosen half on tertiary container', async () => {
      await renderPicker()
      await open()

      expect(
        styleOf(within(container()).getByRole('radio', { name: 'AM' }))
          .backgroundColor,
      ).toBe(colors.tertiaryContainer)
      expect(
        styleOf(within(container()).getByRole('radio', { name: 'PM' }))
          .backgroundColor,
      ).toBeUndefined()
      expect(
        styleOf(
          within(container()).getByText('AM', { includeHiddenElements: true }),
        ).color,
      ).toBe(colors.onTertiaryContainer)
      expect(
        styleOf(
          within(container()).getByText('PM', { includeHiddenElements: true }),
        ).color,
      ).toBe(colors.onSurfaceVariant)
    })

    it('is not drawn on a twenty-four hour clock', async () => {
      await renderPicker({ hourCycle: 24 })
      await open()

      expect(within(container()).queryByLabelText('AM/PM')).toBeNull()
    })
  })

  describe('the input variant', () => {
    it('swaps the dial for boxes to type into, each named under it', async () => {
      await renderPicker()
      await open()
      await fireEvent.press(screen.getByRole('button', { name: 'Enter time' }))

      expect(
        within(container()).getByRole('heading', { name: 'Enter time' }),
      ).toBeOnTheScreen()
      expect(
        screen.queryByTestId('picker-dial', { includeHiddenElements: true }),
      ).toBeNull()
      expect(
        within(container()).getByText('Hour', {
          includeHiddenElements: true,
        }),
      ).toBeOnTheScreen()
      expect(
        within(container()).getByText('Minute', {
          includeHiddenElements: true,
        }),
      ).toBeOnTheScreen()
    })

    it('raises the keyboard on the box the dial set, and takes the time typed', async () => {
      await renderPicker()
      await open()
      const focus = jest.spyOn(TextInput.prototype, 'focus').mockClear()

      await fireEvent.press(screen.getByRole('button', { name: 'Enter time' }))

      expect(focus).toHaveBeenCalled()

      await typeKeys('11')

      expect(textOf(boxOf('hour'))).toBe('11')
      expect(styleOf(boxOf('minute')).backgroundColor).toBe(
        colors.primaryContainer,
      )

      await typeKeys('45')

      expect(textOf(boxOf('minute'))).toBe('45')
      // Focus stays on the minute, passing the day period by.
      expect(styleOf(boxOf('minute')).borderWidth).toBe(2)
    })

    it('opens on the input variant where defaultMode says, and switches back to the dial', async () => {
      await renderPicker({ defaultMode: 'input', defaultOpen: true })

      expect(
        screen.queryByTestId('picker-dial', { includeHiddenElements: true }),
      ).toBeNull()

      const focus = jest.spyOn(TextInput.prototype, 'focus').mockClear()
      const blur = jest.spyOn(TextInput.prototype, 'blur').mockClear()

      await fireEvent.press(screen.getByRole('button', { name: 'Select time' }))

      expect(focus).not.toHaveBeenCalled()
      expect(blur).toHaveBeenCalled()

      expect(dial()).toBeOnTheScreen()
      expect(
        within(container()).queryByText('Hour', {
          includeHiddenElements: true,
        }),
      ).toBeNull()
    })

    it('outlines the box being typed into', async () => {
      await renderPicker({ defaultMode: 'input' })
      await open()
      await fireEvent.press(boxOf('minute'))

      expect(styleOf(boxOf('minute'))).toMatchObject({
        backgroundColor: colors.primaryContainer,
        borderColor: colors.primary,
        borderWidth: 2,
      })
      expect(styleOf(boxOf('hour')).borderWidth).toBeUndefined()
    })
  })

  describe('closing', () => {
    it('writes the picked time back on OK, and closes', async () => {
      const onChange = jest.fn()
      const onOpenChange = jest.fn()

      await renderPicker({ onChange, onOpenChange })
      await open()
      await tap(OUTER_THREE)
      await tap(OUTER_SIX)
      await fireEvent.press(screen.getByRole('button', { name: 'OK' }))

      expect(onChange).toHaveBeenLastCalledWith(new Time(3, 30))
      expect(onOpenChange).toHaveBeenLastCalledWith(false)
      expect(fieldShows()).toEqual(['3', '30', 'AM'])

      await advance(motion.durationShort2)

      expect(screen.queryByTestId('picker-modal')).toBeNull()
    })

    it("keeps a date and time's date", async () => {
      const onChange = jest.fn()

      await renderPicker({
        defaultValue: new CalendarDateTime(2026, 9, 15, 9, 30),
        onChange,
      })
      await open()
      await tap(OUTER_THREE)
      await fireEvent.press(screen.getByRole('button', { name: 'OK' }))

      expect(onChange).toHaveBeenLastCalledWith(
        new CalendarDateTime(2026, 9, 15, 3, 30),
      )
    })

    it('leaves the field as it was on Cancel, and opens again from its time', async () => {
      const onChange = jest.fn()

      await renderPicker({ onChange })
      await open()
      await tap(OUTER_THREE)
      await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }))

      expect(onChange).not.toHaveBeenCalled()
      expect(fieldShows()).toEqual(['9', '30', 'AM'])

      await advance(motion.durationShort2)
      await open()

      expect(textOf(boxOf('hour'))).toBe('09')
      expect(dialLabels()[0]).toBe('12')
    })

    it('starts again from the field when opened again while its exit runs', async () => {
      await renderPicker()
      await open()
      await tap(OUTER_THREE)
      await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }))
      await open()

      expect(textOf(boxOf('hour'))).toBe('09')
    })

    it('closes on a press on the scrim and on the back gesture, writing nothing', async () => {
      const onChange = jest.fn()
      await renderPicker({ onChange })
      await open()
      await fireEvent.press(scrim())
      await advance(motion.durationShort2)

      expect(screen.queryByTestId('picker-modal')).toBeNull()

      await open()
      await fireEvent(modal(), 'requestClose')

      expect(clockButton()).toBeCollapsed()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('closes on VoiceOver’s escape gesture', async () => {
      await renderPicker()
      await open()
      await fireEvent(container(), 'accessibilityEscape')

      expect(clockButton()).toBeCollapsed()
    })

    it('reports and follows an open state the call site holds', async () => {
      const onOpenChange = jest.fn()

      await renderPicker({ isOpen: false, onOpenChange })
      await open()

      expect(onOpenChange).toHaveBeenLastCalledWith(true)
      expect(screen.queryByTestId('picker-modal')).toBeNull()

      await renderPicker({ isOpen: true })

      expect(container()).toBeOnTheScreen()
    })
  })

  describe('words', () => {
    it('says what the props say', async () => {
      await renderPicker({
        cancelLabel: 'Leave',
        confirmLabel: 'Keep',
        defaultOpen: true,
        enterTimeLabel: 'Type it',
        selectTimeLabel: 'Pick it',
      })

      expect(clockButton('Pick it Label')).toBeExpanded()
      expect(
        within(container()).getByRole('heading', { name: 'Pick it' }),
      ).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: 'Type it' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Leave' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Keep' })).toBeEnabled()
    })

    it("speaks the locale's words, the prop's or the provider's", async () => {
      await renderPicker({ defaultOpen: true, locale: 'de-DE' })

      expect(clockButton('Uhrzeit auswählen Label')).toBeExpanded()
      expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeEnabled()
      expect(within(container()).queryByLabelText('AM/PM')).toBeNull()

      await renderPicker({ defaultOpen: true, locale: undefined }, (picker) => (
        <I18nProvider locale="pt-BR">{picker}</I18nProvider>
      ))

      expect(clockButton('Selecione o horário Label')).toBeExpanded()

      await fireEvent.press(
        screen.getByRole('button', { name: 'Digite o horário' }),
      )

      expect(
        within(container()).getByText('Hora', {
          includeHiddenElements: true,
        }),
      ).toBeOnTheScreen()
    })
  })

  it('scrolls the container only when its content runs past the room it has', async () => {
    await renderPicker({ defaultOpen: true })

    const scroll = child(container().children[0])

    expect(scroll.props.scrollEnabled).toBe(false)

    await fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { height: 300, width: 328, x: 0, y: 0 } },
    })
    await fireEvent(scroll, 'contentSizeChange', 328, 520)

    expect(scroll.props.scrollEnabled).toBe(true)

    await fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { height: 520, width: 328, x: 0, y: 0 } },
    })

    expect(scroll.props.scrollEnabled).toBe(false)
  })
})
