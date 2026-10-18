import type { ComponentRef, ReactNode } from 'react'
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
  CalendarDate,
  CalendarDateTime,
  parseZonedDateTime,
} from '@internationalized/date'
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

import type { DateRangePickerProps } from '.'

import { DateRangePicker } from '.'
import { I18nProvider } from '../../i18n/provider'
import { ThemeScope } from '../../theme-scope'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'
import { Button } from '../button'
import { Form } from '../form'

type Frame = readonly [x: number, y: number, width: number, height: number]

// What React Native's Jest preset draws a View as: a class component holding
// its props, with the native methods on its prototype.
type MockedView = Pick<HostInstance, 'focus' | 'measureInWindow'> & {
  readonly props: ViewProps
}

const { theme } = scopeFor('light', {})
const { colors, motion, radii, shadows, spacing, stateLayerOpacity } = theme

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

// A phone held upright, below the medium bound, and a tablet, above it.
const COMPACT = 412
const MEDIUM = 800

// Where `measureInWindow` reports the box and the overlay layer, the two
// views a docked calendar is placed by, in a window 800 wide and tall.
const BOX: Frame = [20, 100, 320, 56]
const LAYER: Frame = [0, 0, MEDIUM, MEDIUM]

// A fixed range, so every case reads the same whenever it runs, and a clock
// in another month, so no date the cases press is today.
const RANGE = {
  end: new CalendarDate(2026, 9, 20),
  start: new CalendarDate(2026, 9, 15),
}
const NOW = new Date(2026, 9, 17, 12)

// How the calendar names each end of RANGE, and how the segments read it.
const SAID_RANGE =
  'Selected Range: Tuesday, September 15 to Sunday, September 20, 2026'
const HELD = 'Selected Range: September 15 to 20, 2026'

const AFTER = new CalendarDate(2027, 1, 1)
const CALL_SITE = { marginTop: 4 }
const MAX = new CalendarDate(2026, 9, 25)
const MIN = new CalendarDate(2026, 9, 8)
const TIMES = {
  end: new CalendarDateTime(2026, 9, 20, 17, 0),
  start: new CalendarDateTime(2026, 9, 15, 9, 30),
}
const SERVER = { end: 'Supporting line' }
const TWO_MONTHS = { months: 2 }
const ZONED = {
  end: parseZonedDateTime('2026-09-20T17:00[America/New_York]'),
  start: parseZonedDateTime('2026-09-15T09:30[America/New_York]'),
}

// The segments drawn as the one being typed, on the primary shape: a date's
// segment stays drawn so until its hidden input has lost focus.
function active() {
  return segments()
    .filter((segment) => styleOf(segment).backgroundColor === colors.primary)
    .map((segment) => nameOf(segment))
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

function calendarButton(name = 'Calendar Label') {
  return screen.getByRole('button', { name })
}

function child(node: TestInstance['children'][number] | undefined) {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

function dateNamed(name: string) {
  return screen.getByRole('button', { name })
}

// The label as the box draws it, its eased colour included.
function drawnLabel(): Record<string, unknown> {
  const label = screen.getByText(/^Label\*?$/u, { includeHiddenElements: true })
  return { ...styleOf(label), ...getAnimatedStyle(label) }
}

// A colour as Reanimated writes one it has eased to: `#rrggbb` comes out as
// `rgba(r, g, b, 1)`.
function eased(color: string) {
  const channels = /^#(?<r>[\da-f]{2})(?<g>[\da-f]{2})(?<b>[\da-f]{2})$/iu.exec(
    color,
  )?.groups

  return channels === undefined
    ? color
    : `rgba(${[channels.r, channels.g, channels.b]
        .map((channel) => String(Number.parseInt(channel, 16)))
        .join(', ')}, 1)`
}

// Whom focus was sent to, in turn, by role and name: a view says both through
// `role` and `aria-label`, or through what a pressable turns them into.
function focusSentTo() {
  // oxlint-disable-next-line typescript/unbound-method -- the preset's mock, which reads no `this`
  const { sendAccessibilityEvent } = AccessibilityInfo

  return jest.mocked(sendAccessibilityEvent).mock.calls.map(([view, event]) => {
    const props: Record<string, unknown> = isMockedView(view)
      ? { ...view.props }
      : {}
    const role = props.role ?? props.accessibilityRole
    const name = props['aria-label'] ?? props.accessibilityLabel

    return `${event} ${String(role)} ${String(name)}`
  })
}

// What a segment is read after its name and value.
function hintOf(name: string) {
  const hint: unknown = screen.getByLabelText(name).props.accessibilityHint
  return typeof hint === 'string' ? hint : undefined
}

// The hidden input that takes the keys on iOS and Android, one for each
// date, each holding one space.
function input(date: 'end' | 'start') {
  const inputs = screen.getAllByDisplayValue(' ', {
    includeHiddenElements: true,
    normalizer: (text) => text,
  })

  return inputs[date === 'start' ? 0 : 1] ?? missing('input')
}

function isMockedView(value: unknown): value is MockedView {
  return (
    typeof value === 'object' && value !== null && 'measureInWindow' in value
  )
}

function keyDown(key: string) {
  return { nativeEvent: { key }, preventDefault: jest.fn() }
}

// Reports the docked surface's size, which is what places it.
async function laidOut() {
  await fireEvent(surface(), 'layout', {
    nativeEvent: { layout: { height: 400, width: 360, x: 0, y: 0 } },
  })
}

// The layer a press outside the docked calendar lands on, drawn just before
// it.
function layer() {
  const siblings = surface().parent?.children ?? []

  return child(siblings.at(siblings.indexOf(surface()) - 1))
}

function message(text: string) {
  return screen.queryByText(text, { includeHiddenElements: true })
}

function missing(what: string): never {
  throw new TypeError(`expected the picker to draw its ${what}`)
}

// The `Modal` the modal calendar is drawn in.
function modal() {
  let node: null | TestInstance = surface()

  while (node !== null && !('onRequestClose' in node.props)) {
    node = node.parent
  }
  if (node === null) {
    throw new TypeError('expected the Modal around the calendar')
  }
  return node
}

// What a segment is named, which is what a case tells them apart by.
function nameOf(segment: TestInstance) {
  const label: unknown = segment.props.accessibilityLabel
  return typeof label === 'string' ? label : undefined
}

// Whether a date is the 23rd, which the cases rule out.
function onTheTwentyThird(date: { day: number }) {
  return date.day === 23
}

// Renders as React Native Web would be handed the picker.
async function renderOnWeb(props: Partial<DateRangePickerProps> = {}) {
  jest.replaceProperty(Platform, 'OS', 'web')
  await renderPicker(props)
}

// Renders a picker inside a theme, whose host the docked calendar draws in.
async function renderPicker(
  props: Partial<DateRangePickerProps> = {},
  wrap?: (children: ReactNode) => ReactNode,
) {
  const picker = (
    <DateRangePicker
      defaultValue={RANGE}
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

function resize(width: number) {
  const metrics = { fontScale: 1, height: MEDIUM, scale: 1, width }

  Dimensions.set({ screen: metrics, window: metrics })
}

function segmentOf(name: string, date: 'End' | 'Start' = 'Start') {
  return screen.getByLabelText(`${name}, ${date} Date, Label`)
}

// The segments a person types into, in the order they are drawn.
function segments() {
  return screen.getAllByRole(
    Platform.OS === 'web' ? 'spinbutton' : 'adjustable',
  )
}

// The dash between the two dates, which a screen reader is not handed.
function separator(text = '–') {
  return screen.getByText(text, { includeHiddenElements: true })
}

// What each segment shows, in the order they are drawn: a segment's text is
// its first child's.
function shown() {
  return segments().map((segment) => {
    const text = child(segment.children.at(0)).children.at(0)
    return typeof text === 'string' ? text : undefined
  })
}

// Spies on the focus every mocked View shares, and hands back the names of
// the views focus was moved to, which is how React Native Web moves it.
function spyOnFocus() {
  const prototype: unknown = View.prototype

  if (!isMockedView(prototype)) {
    throw new TypeError('expected the View the Jest preset mocks')
  }

  const moved: unknown[] = []
  jest.spyOn(prototype, 'focus').mockImplementation(function focus(
    this: MockedView,
  ) {
    moved.push(this.props.accessibilityLabel)
  })
  return moved
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle & ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

async function submit() {
  await fireEvent.press(screen.getByRole('button', { name: 'Submit' }))
}

// The surface the calendar is drawn on, which closes on VoiceOver's escape
// gesture.
function surface() {
  let node: null | TestInstance = dateNamed('Tuesday, September 1, 2026')

  while (node !== null && !('onAccessibilityEscape' in node.props)) {
    node = node.parent
  }
  if (node === null) {
    throw new TypeError('expected the surface around the calendar')
  }
  return node
}

// The test id of the view a ref was handed, which is how a case tells the
// instances the preset's View shares its mocks between apart.
function testIdOf(view: unknown) {
  return isMockedView(view) ? view.props.testID : undefined
}

// Types each key into a date's hidden input, as the keyboard hands them over
// one change at a time after the space it holds.
async function typeKeys(date: 'end' | 'start', keys: string) {
  for (const key of keys) {
    // oxlint-disable-next-line no-await-in-loop -- each key is an act of its own, and two acts may not overlap
    await fireEvent.changeText(input(date), ` ${key}`)
  }
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW })
  resize(MEDIUM)
  const prototype: unknown = View.prototype

  if (!isMockedView(prototype)) {
    throw new TypeError('expected the View the Jest preset mocks')
  }

  // The overlay layer is the one view placed absolutely over the window.
  jest.spyOn(prototype, 'measureInWindow').mockImplementation(function measure(
    this: MockedView,
    callback: MeasureInWindowOnSuccessCallback,
  ) {
    callback(
      ...(StyleSheet.flatten([this.props.style])?.position === 'absolute'
        ? LAYER
        : BOX),
    )
  })
})

afterEach(() => {
  Dimensions.set(INITIAL)
  // The preset's AccessibilityInfo is a mock already, which a spy hands back
  // as it is, so its calls are cleared rather than restored.
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('DateRangePicker', () => {
  describe('the field', () => {
    it("draws both dates in DateField's segments, and an empty picker's placeholders", async () => {
      await renderPicker()

      expect(shown()).toEqual(['9', '15', '2026', '9', '20', '2026'])

      await renderPicker({ defaultValue: undefined })

      expect(shown()).toEqual(['mm', 'dd', 'yyyy', 'mm', 'dd', 'yyyy'])
    })

    it('writes both dates as granularity, hourCycle and shouldForceLeadingZeros ask', async () => {
      await renderPicker({
        defaultValue: TIMES,
        granularity: 'hour',
        hourCycle: 24,
        shouldForceLeadingZeros: true,
      })

      expect(shown()).toEqual([
        '09',
        '15',
        '2026',
        '09',
        '09',
        '20',
        '2026',
        '17',
      ])
    })

    it('draws the time zone of zoned dates, unless it is hidden', async () => {
      await renderPicker({ defaultValue: ZONED })

      expect(screen.queryAllByText('EDT')).toHaveLength(2)

      await renderPicker({ defaultValue: ZONED, hideTimeZone: true })

      expect(screen.queryAllByText('EDT')).toHaveLength(0)
    })

    it('steps an empty date from where placeholderValue says', async () => {
      await renderPicker({ defaultValue: undefined, placeholderValue: AFTER })
      await fireEvent(segmentOf('year', 'End'), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      })

      expect(shown()).toEqual(['mm', 'dd', 'yyyy', 'mm', 'dd', '2027'])
    })

    it('names each segment for its date before the label', async () => {
      await renderPicker()

      expect(segments().map((segment) => nameOf(segment))).toEqual([
        'month, Start Date, Label',
        'day, Start Date, Label',
        'year, Start Date, Label',
        'month, End Date, Label',
        'day, End Date, Label',
        'year, End Date, Label',
      ])
    })

    it('draws the dash between the dates in the muted role, hidden from a screen reader', async () => {
      await renderPicker()

      expect(separator().props['aria-hidden']).toBe(true)
      expect(styleOf(separator())).toMatchObject({
        color: colors.onSurfaceVariant,
        marginHorizontal: spacing.sm,
      })
      expect(screen.queryByText('–')).toBeNull()

      await renderPicker({ isDisabled: true, separator: 'to' })

      expect(styleOf(separator('to'))).toMatchObject({
        color: withOpacity(colors.onSurface, stateLayerOpacity.disabledContent),
      })
    })

    it('clears the label once for both dates, on the line around them', async () => {
      await renderPicker()

      const line = child(segmentOf('month').parent ?? undefined).parent
      const own = child(segmentOf('month').parent ?? undefined)

      expect(styleOf(child(line ?? undefined)).marginTop).toBeGreaterThan(0)
      expect(styleOf(own).marginTop).toBeUndefined()
    })

    it("reads the whole range on each date's first segment once both are filled", async () => {
      await renderPicker()

      expect(hintOf('month, Start Date, Label')).toBe(HELD)
      expect(hintOf('month, End Date, Label')).toBe(HELD)
      expect(hintOf('day, Start Date, Label')).toBeUndefined()

      await renderPicker({ defaultValue: undefined })

      expect(hintOf('month, Start Date, Label')).toBeUndefined()

      await fireEvent.press(segmentOf('month'))
      await typeKeys('start', '9152026')

      expect(hintOf('month, Start Date, Label')).toBeUndefined()
    })

    it('runs on from the start’s last segment to the end’s first as each fills, and calls onChange once both have', async () => {
      const onChange = jest.fn()

      await renderPicker({ defaultValue: undefined, onChange })
      await fireEvent.press(segmentOf('month'))
      await typeKeys('start', '9152026')

      expect(active()).toEqual([
        'year, Start Date, Label',
        'month, End Date, Label',
      ])
      expect(onChange).not.toHaveBeenCalled()

      await fireEvent(input('start'), 'blur')
      await fireEvent(input('end'), 'focus')

      expect(active()).toEqual(['month, End Date, Label'])

      await typeKeys('end', '9202026')

      expect(shown()).toEqual(['9', '15', '2026', '9', '20', '2026'])
      expect(onChange).toHaveBeenLastCalledWith(RANGE)
    })

    it('goes back from the end’s first segment to the start’s last on a backspace there', async () => {
      await renderPicker({ defaultValue: undefined })
      await fireEvent.press(segmentOf('month', 'End'))
      await fireEvent.changeText(input('end'), '')
      await fireEvent(input('end'), 'blur')

      expect(active()).toEqual(['year, Start Date, Label'])
    })

    it('moves across the dates on the arrow keys under React Native Web', async () => {
      const moved = spyOnFocus()

      await renderOnWeb()
      await fireEvent(segmentOf('year'), 'keyDown', keyDown('ArrowRight'))
      await fireEvent(
        segmentOf('month', 'End'),
        'keyDown',
        keyDown('ArrowLeft'),
      )

      expect(moved).toEqual([
        'month, End Date, Label',
        'year, Start Date, Label',
      ])
    })

    it('marks both dates disabled, read only or required for a browser, as the picker is', async () => {
      await renderOnWeb({ isReadOnly: true, isRequired: true })

      expect(segmentOf('day', 'End').props).toMatchObject({
        'aria-readonly': true,
        'aria-required': true,
      })

      await renderPicker({ isDisabled: true })

      expect(segmentOf('day', 'End').props.accessibilityState).toMatchObject({
        disabled: true,
      })
    })

    it('tells the call site once as focus arrives and once as it leaves both dates', async () => {
      const onBlur = jest.fn()
      const onFocus = jest.fn()

      await renderPicker({ onBlur, onFocus })
      await fireEvent.press(segmentOf('year'))
      await fireEvent(input('start'), 'focus')
      await fireEvent(input('start'), 'blur')
      await fireEvent(input('end'), 'focus')
      await advance(0)

      expect(onFocus).toHaveBeenCalledTimes(1)
      expect(onBlur).not.toHaveBeenCalled()

      await fireEvent(input('end'), 'blur')

      expect(onBlur).not.toHaveBeenCalled()

      await advance(0)

      expect(onBlur).toHaveBeenCalledTimes(1)
      expect(onFocus).toHaveBeenCalledTimes(1)

      await fireEvent(input('end'), 'focus')

      expect(onFocus).toHaveBeenCalledTimes(2)
    })

    it('draws itself focused while either date is, and through the move between them', async () => {
      await renderPicker()
      await fireEvent(input('start'), 'focus')
      await advance(motion.durationShort3)

      expect(drawnLabel()).toMatchObject({ color: eased(colors.primary) })

      await fireEvent(input('start'), 'blur')
      await fireEvent(input('end'), 'focus')
      await advance(motion.durationShort3)

      expect(drawnLabel()).toMatchObject({ color: eased(colors.primary) })

      await fireEvent(input('end'), 'blur')
      await advance(0)
      await advance(motion.durationShort3)

      expect(drawnLabel()).toMatchObject({
        color: eased(colors.onSurfaceVariant),
      })
    })

    it('leaves focus where it is when the box is pressed while a date has it', async () => {
      await renderPicker()
      await fireEvent.press(segmentOf('day', 'End'))
      await fireEvent(input('end'), 'focus')
      await fireEvent.press(child(screen.getByTestId('picker').children.at(0)))

      expect(active()).toEqual(['day, End Date, Label'])
    })

    it('ends the box in a button naming the calendar and the label, saying whether it is open', async () => {
      await renderPicker()

      expect(calendarButton()).toBeCollapsed()

      await fireEvent.press(calendarButton())

      expect(calendarButton()).toBeExpanded()
    })

    it("names the dates, the button and the calendar in the locale's words, the prop's or the provider's", async () => {
      await renderPicker({ locale: 'de-DE', triggerLabel: undefined })

      expect(calendarButton('Kalender Label')).toBeEnabled()
      expect(shown()).toEqual(['15', '9', '2026', '20', '9', '2026'])
      expect(screen.getByLabelText('Monat, Startdatum, Label')).toBeEnabled()
      expect(screen.getByLabelText('Monat, Enddatum, Label')).toBeEnabled()

      await renderPicker({ locale: undefined }, (children) => (
        <I18nProvider locale="ja-JP">{children}</I18nProvider>
      ))

      expect(calendarButton('カレンダー Label')).toBeEnabled()

      await renderPicker({ triggerLabel: 'Pick dates' })

      expect(calendarButton('Pick dates Label')).toBeEnabled()
    })

    it('disables both dates and the button while disabled, and the button while read only', async () => {
      await renderPicker({ isDisabled: true })

      expect(calendarButton()).toBeDisabled()
      expect(segmentOf('month', 'End')).toBeDisabled()

      await renderPicker({ isReadOnly: true })

      expect(calendarButton()).toBeDisabled()
    })

    it('puts style, ref and testID on the picker as a whole', async () => {
      const ref = createRef<ComponentRef<typeof View>>()

      await renderPicker({ ref, style: CALL_SITE })

      const picker = screen.getByTestId('picker')

      expect(styleOf(picker)).toMatchObject(CALL_SITE)
      expect(testIdOf(ref.current)).toBe('picker')
      expect(picker).toContainElement(calendarButton())
      expect(picker).toContainElement(segmentOf('year', 'End'))
    })
  })

  describe('in error', () => {
    it('says what error says under the field, after the range on each first segment', async () => {
      await renderPicker({ error: 'Supporting line' })

      expect(message('Supporting line')).not.toBeNull()
      expect(hintOf('month, End Date, Label')).toBe(`${HELD} Supporting line`)
      expect(hintOf('day, Start Date, Label')).toBe(`${HELD} Supporting line`)
    })

    it('says a range whose start is after its end is reversed', async () => {
      await renderPicker({
        defaultValue: { end: RANGE.start, start: RANGE.end },
      })

      expect(message('Start date must be before end date.')).not.toBeNull()
    })

    it('says a date before minValue is out of bounds', async () => {
      await renderPicker({ minValue: new CalendarDate(2026, 9, 18) })

      expect(message('Value must be 9/18/2026 or later.')).not.toBeNull()
    })

    it('says what validate says', async () => {
      await renderPicker({
        validate: (range) =>
          range.end.compare(range.start) > 3 ? 'Supporting line' : null,
      })

      expect(message('Supporting line')).not.toBeNull()
    })
  })

  describe('docked, from the medium window size up', () => {
    it('opens under the box as a dialog named like its button, holding the range', async () => {
      await renderPicker()
      await fireEvent.press(calendarButton())
      await laidOut()

      expect(surface().props).toMatchObject({
        'aria-label': 'Calendar Label',
        role: 'dialog',
      })
      expect(styleOf(surface())).toMatchObject({
        backgroundColor: colors.surfaceContainerHigh,
        borderRadius: radii.lg,
        boxShadow: shadows.elevation3,
        left: BOX[0],
        top: BOX[1] + BOX[3] + spacing.sm,
      })
      expect(
        dateNamed(`${SAID_RANGE}, Tuesday, September 15, 2026 selected`),
      ).toBeEnabled()
      expect(dateNamed('Thursday, September 17, 2026 selected')).toBeEnabled()
    })

    it('fills both dates with the two presses that pick a range, and closes', async () => {
      const onChange = jest.fn()

      await renderPicker({ onChange })
      await fireEvent.press(calendarButton())
      await laidOut()
      await fireEvent.press(dateNamed('Monday, September 21, 2026'))

      expect(shown()).toEqual(['9', '15', '2026', '9', '20', '2026'])
      expect(calendarButton()).toBeExpanded()

      await fireEvent.press(dateNamed('Friday, September 25, 2026'))

      expect(shown()).toEqual(['9', '21', '2026', '9', '25', '2026'])
      expect(onChange).toHaveBeenCalledWith({
        end: new CalendarDate(2026, 9, 25),
        start: new CalendarDate(2026, 9, 21),
      })
      expect(calendarButton()).toBeCollapsed()
    })

    it('stays open on a picked range when shouldCloseOnSelect is false', async () => {
      await renderPicker({ shouldCloseOnSelect: false })
      await fireEvent.press(calendarButton())
      await laidOut()
      await fireEvent.press(dateNamed('Monday, September 21, 2026'))
      await fireEvent.press(dateNamed('Friday, September 25, 2026'))

      expect(shown()).toEqual(['9', '21', '2026', '9', '25', '2026'])
      expect(calendarButton()).toBeExpanded()
    })

    it('keeps the times the segments hold when a range is picked', async () => {
      await renderPicker({ defaultValue: TIMES, granularity: 'minute' })
      await fireEvent.press(calendarButton())
      await laidOut()
      await fireEvent.press(dateNamed('Monday, September 21, 2026'))
      await fireEvent.press(dateNamed('Friday, September 25, 2026'))

      expect(shown()).toEqual([
        '9',
        '21',
        '2026',
        '9',
        '30',
        'AM',
        '9',
        '25',
        '2026',
        '5',
        '00',
        'PM',
      ])
    })

    it('holds a range typed into the segments in the calendar too', async () => {
      await renderPicker()
      await fireEvent.press(segmentOf('day', 'End'))
      await typeKeys('end', '22')
      await fireEvent.press(calendarButton())

      expect(dateNamed('Monday, September 21, 2026 selected')).toBeEnabled()
    })

    it("opens an empty picker on placeholderValue's month, holding no range", async () => {
      await renderPicker({ defaultValue: undefined, placeholderValue: AFTER })
      await fireEvent.press(calendarButton())

      expect(dateNamed('Friday, January 1, 2027')).toBeEnabled()
      expect(screen.queryByRole('button', { name: /selected$/u })).toBeNull()
    })

    it('opens a half-typed picker holding no range', async () => {
      await renderPicker({ defaultValue: undefined })
      await fireEvent.press(segmentOf('month'))
      await typeKeys('start', '9152026')
      await fireEvent.press(calendarButton())

      expect(screen.queryByRole('button', { name: /selected$/u })).toBeNull()
    })

    it('hands the calendar its name, the bounds, the first weekday, its menus and its months', async () => {
      await renderPicker({
        defaultOpen: true,
        firstDayOfWeek: 'mon',
        isDateUnavailable: (date) => date.day === 22,
        maxValue: MAX,
        minValue: MIN,
        showMonthYearMenus: true,
      })

      expect(screen.getByLabelText('Label, September 2026')).toBeOnTheScreen()
      expect(dateNamed('Monday, September 7, 2026')).toBeDisabled()
      expect(dateNamed('Saturday, September 26, 2026')).toBeDisabled()
      expect(dateNamed('Tuesday, September 22, 2026')).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Sep month' })).toBeEnabled()
      expect(
        screen.getAllByRole('button', { name: /^\w+day, / }).at(0),
      ).toHaveAccessibleName('Monday, August 31, 2026')

      await renderPicker({ defaultOpen: true, visibleDuration: TWO_MONTHS })

      expect(dateNamed('Thursday, October 15, 2026')).toBeEnabled()
    })

    it('picks a range across an unavailable date only where allowsNonContiguousRanges says', async () => {
      await renderPicker({ isDateUnavailable: onTheTwentyThird })
      await fireEvent.press(calendarButton())
      await laidOut()
      await fireEvent.press(dateNamed('Monday, September 21, 2026'))

      expect(dateNamed('Friday, September 25, 2026')).toBeDisabled()

      await renderPicker({
        allowsNonContiguousRanges: true,
        isDateUnavailable: onTheTwentyThird,
      })
      await fireEvent.press(calendarButton())
      await laidOut()
      await fireEvent.press(dateNamed('Monday, September 21, 2026'))

      expect(dateNamed('Friday, September 25, 2026')).toBeEnabled()
    })

    it('takes no range from a calendar opened while disabled or read only', async () => {
      await renderPicker({ defaultOpen: true, isDisabled: true })

      expect(dateNamed('Monday, September 21, 2026')).toBeDisabled()

      await renderPicker({ defaultOpen: true, isReadOnly: true })
      await laidOut()
      await fireEvent.press(dateNamed('Monday, September 21, 2026'))
      await fireEvent.press(dateNamed('Friday, September 25, 2026'))

      expect(shown()).toEqual(['9', '15', '2026', '9', '20', '2026'])
    })

    it('closes on a press outside it', async () => {
      await renderPicker()
      await fireEvent.press(calendarButton())
      await laidOut()
      await fireEvent.press(layer())

      expect(calendarButton()).toBeCollapsed()
    })

    it('sends a screen reader to the range’s start once placed, and back to the button once it has gone', async () => {
      await renderPicker()
      await fireEvent.press(calendarButton())
      await laidOut()

      expect(focusSentTo()).toEqual([
        `focus button ${SAID_RANGE}, Tuesday, September 15, 2026 selected`,
      ])

      await fireEvent.press(layer())
      await advance(motion.durationShort2)

      expect(focusSentTo()).toEqual([
        `focus button ${SAID_RANGE}, Tuesday, September 15, 2026 selected`,
        'focus button Calendar Label',
      ])
    })
  })

  describe('modal, below the medium window size', () => {
    beforeEach(() => {
      resize(COMPACT)
    })

    it('opens in a Modal over the scrim, and sends a screen reader to the range’s start once it shows', async () => {
      await renderPicker()
      await fireEvent.press(calendarButton())
      await fireEvent(modal(), 'show')

      expect(modal().props.visible).toBe(true)
      expect(surface().props).toMatchObject({
        'aria-label': 'Calendar Label',
        'aria-modal': true,
        role: 'dialog',
      })
      expect(focusSentTo()).toEqual([
        `focus button ${SAID_RANGE}, Tuesday, September 15, 2026 selected`,
      ])
    })

    it('fills both dates with the two presses that pick a range, and closes', async () => {
      await renderPicker({ defaultValue: undefined })
      await fireEvent.press(calendarButton())
      await fireEvent.press(dateNamed('Wednesday, October 21, 2026'))
      await fireEvent.press(dateNamed('Monday, October 19, 2026'))

      expect(shown()).toEqual(['10', '19', '2026', '10', '21', '2026'])
      expect(calendarButton()).toBeCollapsed()
    })
  })

  describe('held by the call site', () => {
    it('opens and closes as isOpen says, and reports what it asks for', async () => {
      const onOpenChange = jest.fn()

      await renderPicker({ isOpen: false, onOpenChange })
      await fireEvent.press(calendarButton())

      expect(onOpenChange).toHaveBeenCalledWith(true)
      expect(calendarButton()).toBeCollapsed()

      await renderPicker({ isOpen: true, onOpenChange })

      expect(
        dateNamed(`${SAID_RANGE}, Tuesday, September 15, 2026 selected`),
      ).toBeEnabled()
    })

    it('shows the range it is handed in the segments and the calendar alike', async () => {
      await renderPicker({ defaultOpen: true, value: RANGE })

      expect(shown()).toEqual(['9', '15', '2026', '9', '20', '2026'])
      expect(
        dateNamed(`${SAID_RANGE}, Sunday, September 20, 2026 selected`),
      ).toBeEnabled()
    })
  })

  describe('in a form', () => {
    it('submits each date as ISO 8601 under its own name', async () => {
      const onSubmit = jest.fn()

      await render(
        <ThemeScope>
          <Form onSubmit={onSubmit}>
            <DateRangePicker
              defaultValue={RANGE}
              endName="end"
              label="Label"
              locale="en-US"
              startName="start"
            />
            <Button type="submit">Submit</Button>
          </Form>
        </ThemeScope>,
      )
      await submit()

      expect(onSubmit).toHaveBeenCalledWith({
        end: '2026-09-20',
        start: '2026-09-15',
      })
    })

    it('submits an empty date as empty, and nothing while disabled', async () => {
      const onSubmit = jest.fn()
      const form = (isDisabled: boolean) => (
        <ThemeScope>
          <Form onSubmit={onSubmit}>
            <DateRangePicker
              endName="end"
              isDisabled={isDisabled}
              label="Label"
              locale="en-US"
              startName="start"
            />
            <Button type="submit">Submit</Button>
          </Form>
        </ThemeScope>
      )

      await render(form(false))
      await submit()

      expect(onSubmit).toHaveBeenLastCalledWith({ end: '', start: '' })

      await render(form(true))
      await submit()

      expect(onSubmit).toHaveBeenLastCalledWith({})
    })

    it('shows what the form says under either name', async () => {
      await render(
        <ThemeScope>
          <Form validationErrors={SERVER}>
            <DateRangePicker
              defaultValue={RANGE}
              endName="end"
              label="Label"
              locale="en-US"
              startName="start"
            />
          </Form>
        </ThemeScope>,
      )

      expect(message('Supporting line')).not.toBeNull()
    })

    it('shows a native form what an edit broke as the date edited loses focus', async () => {
      await render(
        <ThemeScope>
          <Form validationBehavior="native">
            <DateRangePicker
              defaultValue={RANGE}
              label="Label"
              locale="en-US"
            />
          </Form>
        </ThemeScope>,
      )
      await fireEvent.press(segmentOf('day', 'End'))
      await typeKeys('end', '10')

      expect(message('Start date must be before end date.')).toBeNull()

      await fireEvent(input('end'), 'blur')

      expect(message('Start date must be before end date.')).not.toBeNull()
    })

    it('holds a native form back while a required picker is missing a date', async () => {
      const onSubmit = jest.fn()

      await render(
        <ThemeScope>
          <Form onSubmit={onSubmit} validationBehavior="native">
            <DateRangePicker
              endName="end"
              isRequired
              label="Label"
              locale="en-US"
              startName="start"
            />
            <Button type="submit">Submit</Button>
          </Form>
        </ThemeScope>,
      )
      await fireEvent.press(segmentOf('month'))
      await typeKeys('start', '9152026')
      await submit()

      expect(onSubmit).not.toHaveBeenCalled()
      expect(message('Fill out this field.')).not.toBeNull()
    })
  })
})
