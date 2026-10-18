import type { ComponentRef, ReactNode } from 'react'
import type { StyleProp, TextStyle, ViewProps, ViewStyle } from 'react-native'

import {
  CalendarDate,
  CalendarDateTime,
  createCalendar,
  isWeekend,
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
  I18nManager,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'
import { useDateFieldState } from 'react-stately/useDateFieldState'

import type { DateFieldProps } from '.'

import { DateField } from '.'
import { I18nProvider } from '../../i18n/provider'
import { DateSegments } from '../../segments'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'
import { Button } from '../button'
import { Form } from '../form'

// What React Native's Jest preset draws a View as: a class component holding
// its props, with the native methods on its prototype.
type MockedView = {
  readonly focus: () => void
  readonly props: ViewProps
}

const { theme } = scopeFor('light', {})
const { colors, motion, stateLayerOpacity, typography } = theme

const DISABLED_CONTENT = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContent,
)

const CALL_SITE = { marginTop: 4 }

// A fixed date, so every case reads the same whenever it runs.
const DATE = new CalendarDate(2026, 9, 15)

// What describes a field that has neither a description nor an error.
const NOTHING: readonly [] = []

const REQUIRED = 'Fill out this field.'

// A date and a time, for the segments a granularity of minutes adds.
const TIME = new CalendarDateTime(2026, 9, 15, 9, 30)

// A key a browser hands a segment under React Native Web, and whether it was
// kept from the browser.
function keyDown(key: string, modifiers: Record<string, boolean> = {}) {
  return { nativeEvent: { key, ...modifiers }, preventDefault: jest.fn() }
}

afterEach(() => {
  jest.restoreAllMocks()
})

// The segment drawn as the one being typed: the one on the primary shape.
function active() {
  return segments().find(
    (segment) => styleOf(segment).backgroundColor === colors.primary,
  )
}

// Runs the box's eased transitions to their end, on fake timers.
async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// What the label is drawn as, with what Reanimated drives on top: the box's
// own label, which is hidden from screen readers, since each segment says it.
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

// The first of an element's children that is an element rather than text.
function firstHostOf(element: ReturnType<typeof segmentOf>, what: string) {
  const child = element.children.at(0)

  if (child === undefined || typeof child === 'string') {
    return missing(what)
  }
  return child
}

// The hidden input that takes the keys on iOS and Android, which holds one
// space.
function input() {
  return screen.getByDisplayValue(' ', {
    includeHiddenElements: true,
    normalizer: (text) => text,
  })
}

function isMockedView(value: unknown): value is MockedView {
  return typeof value === 'object' && value !== null && 'focus' in value
}

// The punctuation between the segments, which a screen reader is not handed.
function literals() {
  return screen.getAllByText('/', { includeHiddenElements: true })
}

// The line under the field holding `text`, which is hidden from VoiceOver on
// iOS, since each segment reads it out as its hint.
function message(text: string) {
  return screen.queryByText(text, { includeHiddenElements: true })
}

function missing(what: string): never {
  throw new TypeError(`expected the field to draw its ${what}`)
}

// What a segment is named, which is what a case tells them apart by.
function nameOf(segment: ReturnType<typeof segmentOf>) {
  const label: unknown = segment.props.accessibilityLabel
  return typeof label === 'string' ? label : undefined
}

async function renderField(props: Partial<DateFieldProps> = {}) {
  await render(<DateField label="Label" locale="en-US" {...props} />)
}

// Renders as React Native Web would be handed the field.
async function renderOnWeb(props: Partial<DateFieldProps> = {}) {
  jest.replaceProperty(Platform, 'OS', 'web')
  await renderField(props)
}

// The segment names in the order they are drawn.
function segmentNames() {
  return segments().map((segment) => nameOf(segment))
}

function segmentOf(name: string) {
  return screen.getByLabelText(`${name}, Label`)
}

// The segments a person types into, in the order they are drawn.
function segments() {
  return screen.queryAllByRole(
    Platform.OS === 'web' ? 'spinbutton' : 'adjustable',
  )
}

// What each segment shows, its placeholder while it is empty.
function shown() {
  return segments().map((segment) => textOf(segment))
}

// Spies on the focus every mocked View shares, and hands back the names of
// the views focus was moved to.
function spyOnFocus() {
  const prototype: unknown = View.prototype

  if (!isMockedView(prototype)) {
    throw new TypeError('expected the View the Jest preset mocks')
  }

  const moved: (string | undefined)[] = []
  const views: unknown[] = []
  jest.spyOn(prototype, 'focus').mockImplementation(function focus(
    this: MockedView,
  ) {
    const label: unknown = this.props.accessibilityLabel
    moved.push(typeof label === 'string' ? label : undefined)
    views.push(this)
  })
  return { moved, views }
}

// Spies on the focus every mocked TextInput shares, cleared of what earlier
// cases called it with, since the preset's mock outlives a restore.
function spyOnInputFocus() {
  return jest.spyOn(TextInput.prototype, 'focus').mockClear()
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle & ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

async function submit() {
  await fireEvent.press(screen.getByRole('button', { name: 'Submit' }))
}

// What a segment draws as its text, and the text element itself.
function textElementOf(segment: ReturnType<typeof segmentOf>) {
  return firstHostOf(segment, 'segment text')
}

function textOf(segment: ReturnType<typeof segmentOf>) {
  const text = textElementOf(segment).children.at(0)
  return typeof text === 'string' ? text : undefined
}

// The segments a time field draws, whose largest unit is the hour, which
// DateField has no prop for.
function TimeSegments() {
  const state = useDateFieldState({
    createCalendar,
    defaultValue: TIME,
    granularity: 'minute',
    locale: 'en-US',
    maxGranularity: 'hour',
  })

  return (
    <DateSegments
      described={NOTHING}
      isInvalid={false}
      label="Label"
      locale="en-US"
      state={state}
    />
  )
}

// Types each key into the hidden input, as the keyboard hands them over one
// change at a time after the space it holds.
async function typeKeys(keys: string) {
  for (const key of keys) {
    // oxlint-disable-next-line no-await-in-loop -- each key is an act of its own, and two acts may not overlap
    await fireEvent.changeText(input(), ` ${key}`)
  }
}

function withForm(children: ReactNode, props = {}) {
  return (
    <Form {...props}>
      {children}
      <Button type="submit">Submit</Button>
    </Form>
  )
}

describe('DateField', () => {
  describe('segments', () => {
    it("draws one per part, in the locale's order, each showing its placeholder", async () => {
      await renderField()

      expect(segmentNames()).toStrictEqual([
        'month, Label',
        'day, Label',
        'year, Label',
      ])
      expect(shown()).toStrictEqual(['mm', 'dd', 'yyyy'])
    })

    it('puts the day first under a locale that writes it first', async () => {
      await renderField({ locale: 'en-GB' })

      expect(segmentNames()).toStrictEqual([
        'day, Label',
        'month, Label',
        'year, Label',
      ])
    })

    it('puts the year first under a locale that writes it first', async () => {
      await renderField({ defaultValue: DATE, locale: 'ja-JP' })

      expect(shown()).toStrictEqual(['2026', '9', '15'])
    })

    it("takes the I18nProvider's locale where it names none", async () => {
      await render(
        <I18nProvider locale="de-DE">
          <DateField label="Label" />
        </I18nProvider>,
      )

      expect(segmentNames()).toStrictEqual([
        'Tag, Label',
        'Monat, Label',
        'Jahr, Label',
      ])
      expect(shown()).toStrictEqual(['tt', 'mm', 'jjjj'])
    })

    it("adds the time's segments for a granularity below a day", async () => {
      await renderField({
        defaultValue: TIME,
        granularity: 'minute',
      })

      expect(segmentNames()).toStrictEqual([
        'month, Label',
        'day, Label',
        'year, Label',
        'hour, Label',
        'minute, Label',
        'AM/PM, Label',
      ])
      expect(shown()).toStrictEqual(['9', '15', '2026', '9', '30', 'AM'])
    })

    it('shows the value it is handed, and hands an edit back rather than keep it', async () => {
      const onChange = jest.fn()
      await renderField({ onChange, value: DATE })

      await fireEvent(segmentOf('month'), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      })
      expect(onChange).toHaveBeenCalledWith(new CalendarDate(2026, 10, 15))
      expect(shown()).toStrictEqual(['9', '15', '2026'])

      await screen.rerender(
        <DateField
          label="Label"
          locale="en-US"
          onChange={onChange}
          value={new CalendarDate(2027, 1, 2)}
        />,
      )
      expect(shown()).toStrictEqual(['1', '2', '2027'])
    })

    it('mutes the placeholders and the punctuation, and draws a value on surface', async () => {
      await renderField({ defaultValue: DATE })
      expect(styleOf(textElementOf(segmentOf('month'))).color).toBe(
        colors.onSurface,
      )
      expect(styleOf(literals()[0]).color).toBe(colors.onSurfaceVariant)

      await renderField()
      expect(styleOf(textElementOf(segmentOf('month'))).color).toBe(
        colors.onSurfaceVariant,
      )
    })

    it('hides the punctuation from a screen reader', async () => {
      await renderField()

      expect(screen.queryByText('/')).toBeNull()
      expect(literals()).toHaveLength(2)
    })

    it('reads each as a value a swipe steps, with the date said once', async () => {
      await renderField({ defaultValue: DATE, description: 'Supporting line' })

      expect(segmentOf('month').props.accessibilityValue).toStrictEqual({
        max: 12,
        min: 1,
        now: 9,
        text: '9 – September',
      })
      expect(segmentOf('year').props.accessibilityValue).toMatchObject({
        now: 2026,
        text: '2026',
      })
      expect(segmentOf('month').props.accessibilityHint).toBe(
        'Selected Date: September 15, 2026 Supporting line',
      )
      expect(segmentOf('day').props.accessibilityHint).toBeUndefined()
      expect(segmentOf('month').props.accessibilityActions).toStrictEqual([
        { name: 'increment' },
        { name: 'decrement' },
      ])
    })

    it('reads an empty segment as empty, and says no date', async () => {
      await renderField()

      expect(segmentOf('month').props.accessibilityValue).toMatchObject({
        text: 'Empty',
      })
      expect(segmentOf('month').props.accessibilityHint).toBeUndefined()
    })

    it('says the time where the field holds only a time', async () => {
      await render(<TimeSegments />)

      expect(segmentOf('hour').props.accessibilityHint).toBe(
        'Selected Time: 9:30 AM',
      )
      expect(segmentOf('hour').props.accessibilityValue).toMatchObject({
        text: '9 AM',
      })
    })

    it('describes every segment while the field has an error', async () => {
      await renderField({ defaultValue: DATE, error: 'Supporting line' })

      expect(segmentOf('day').props.accessibilityHint).toBe(
        'Selected Date: September 15, 2026 Supporting line',
      )
      expect(segmentOf('year').props.accessibilityHint).toBe(
        'Selected Date: September 15, 2026 Supporting line',
      )
    })
  })

  describe('on iOS and Android', () => {
    it('raises the keyboard on a press, typing into the segment pressed', async () => {
      const focus = spyOnInputFocus()
      await renderField()

      await fireEvent.press(segmentOf('day'))

      expect(focus).toHaveBeenCalledTimes(1)
      expect(active()).toBe(segmentOf('day'))
      expect(styleOf(textElementOf(segmentOf('day'))).color).toBe(
        colors.onPrimary,
      )
    })

    it('types a date a digit at a time, moving on once a segment is full', async () => {
      const onChange = jest.fn()
      await renderField({ onChange })
      await fireEvent.press(segmentOf('month'))

      await typeKeys('9')
      expect(textOf(segmentOf('month'))).toBe('9')
      expect(active()).toBe(segmentOf('day'))

      await typeKeys('15')
      expect(active()).toBe(segmentOf('year'))

      await typeKeys('2026')
      expect(onChange).toHaveBeenLastCalledWith(DATE)
      expect(shown()).toStrictEqual(['9', '15', '2026'])
    })

    it('waits for a second digit where one could follow', async () => {
      await renderField()
      await fireEvent.press(segmentOf('month'))

      await typeKeys('1')
      expect(textOf(segmentOf('month'))).toBe('1')
      expect(active()).toBe(segmentOf('month'))

      await typeKeys('2')
      expect(textOf(segmentOf('month'))).toBe('12')
      expect(active()).toBe(segmentOf('day'))
    })

    it('starts again from the key alone past the largest the segment takes', async () => {
      await renderField()
      await fireEvent.press(segmentOf('month'))

      await typeKeys('13')

      expect(textOf(segmentOf('month'))).toBe('3')
      expect(active()).toBe(segmentOf('day'))
    })

    it('moves on once a segment holds as many digits as its largest', async () => {
      await renderField({ defaultValue: TIME, granularity: 'minute' })
      await fireEvent.press(segmentOf('minute'))

      await typeKeys('00')

      expect(textOf(segmentOf('minute'))).toBe('00')
      expect(active()).toBe(segmentOf('AM/PM'))
    })

    it('ignores a separator between two digits', async () => {
      await renderField()
      await fireEvent.press(segmentOf('month'))

      await typeKeys('1.2')

      expect(textOf(segmentOf('month'))).toBe('12')
    })

    it('ignores what is not a digit in a segment of digits', async () => {
      const onChange = jest.fn()
      await renderField({ defaultValue: DATE, onChange })
      await fireEvent.press(segmentOf('month'))

      await typeKeys('x')

      expect(textOf(segmentOf('month'))).toBe('9')
      expect(onChange).not.toHaveBeenCalled()
    })

    it('starts each segment afresh as it is pressed', async () => {
      await renderField()
      await fireEvent.press(segmentOf('month'))
      await typeKeys('1')

      await fireEvent.press(segmentOf('day'))
      await typeKeys('2')

      expect(textOf(segmentOf('month'))).toBe('1')
      expect(textOf(segmentOf('day'))).toBe('2')
    })

    it('takes a digit off with backspace, and moves back from an empty segment', async () => {
      await renderField({ defaultValue: DATE })
      await fireEvent.press(segmentOf('day'))

      await fireEvent.changeText(input(), '')
      expect(textOf(segmentOf('day'))).toBe('1')

      await fireEvent.changeText(input(), '')
      expect(textOf(segmentOf('day'))).toBe('dd')
      expect(active()).toBe(segmentOf('day'))

      await fireEvent.changeText(input(), '')
      expect(active()).toBe(segmentOf('month'))
      expect(textOf(segmentOf('month'))).toBe('9')
    })

    it('keeps typing after what backspace leaves', async () => {
      const onChange = jest.fn()
      await renderField({ defaultValue: DATE, onChange })
      await fireEvent.press(segmentOf('year'))

      await fireEvent.changeText(input(), '')
      await typeKeys('5')

      expect(onChange).toHaveBeenLastCalledWith(new CalendarDate(2025, 9, 15))
    })

    it('empties a segment once backspace leaves only a zero', async () => {
      await renderField({ defaultValue: TIME, granularity: 'minute' })
      await fireEvent.press(segmentOf('minute'))

      await fireEvent.changeText(input(), '')
      expect(textOf(segmentOf('minute'))).toBe('03')

      await fireEvent.changeText(input(), '')
      expect(segmentOf('minute').props.accessibilityValue).toMatchObject({
        text: 'Empty',
      })
    })

    it('picks a day period by its first letter, on the full keyboard', async () => {
      await renderField({
        defaultValue: TIME,
        granularity: 'minute',
      })
      expect(input().props.keyboardType).toBe('number-pad')

      await fireEvent.press(segmentOf('AM/PM'))
      expect(input().props.keyboardType).toBe('default')

      await typeKeys('p')
      expect(textOf(segmentOf('AM/PM'))).toBe('PM')

      await fireEvent.press(segmentOf('AM/PM'))
      await typeKeys('x')
      expect(textOf(segmentOf('AM/PM'))).toBe('PM')

      await typeKeys('a')
      expect(textOf(segmentOf('AM/PM'))).toBe('AM')
    })

    it('empties a day period with backspace', async () => {
      await renderField({
        granularity: 'hour',
        placeholderValue: new CalendarDateTime(2026, 9, 15, 9),
      })
      await fireEvent.press(segmentOf('AM/PM'))
      await typeKeys('p')
      await fireEvent.press(segmentOf('AM/PM'))

      await fireEvent.changeText(input(), '')

      expect(textOf(segmentOf('AM/PM'))).toBe('AM')
      expect(segmentOf('AM/PM').props.accessibilityValue).toMatchObject({
        text: 'Empty',
      })
    })

    it('picks an era by the start of its name', async () => {
      const onChange = jest.fn()
      await renderField({
        defaultValue: new CalendarDate('BC', 100, 1, 1),
        onChange,
      })
      await fireEvent.press(segmentOf('era'))

      await typeKeys('x')
      expect(onChange).not.toHaveBeenCalled()

      await typeKeys('B')
      expect(textOf(segmentOf('era'))).toBe('BC')
      expect(active()).toBe(segmentOf('era'))

      await typeKeys('A')

      // The era is shown only before the common era, so it goes once the
      // date is in it.
      expect(onChange).toHaveBeenLastCalledWith(new CalendarDate(100, 1, 1))
      expect(screen.queryByLabelText('era, Label')).toBeNull()
      expect(active()).toBe(segmentOf('year'))
    })

    it('moves on from an era in a calendar that always draws one', async () => {
      await renderField({ defaultValue: DATE, locale: 'ja-JP-u-ca-japanese' })
      const [era, year] = segments()

      await fireEvent.press(era)
      await typeKeys('H')

      // Heisei, whose eighth year is 1996.
      expect(shown()).toStrictEqual(['H', '8', '9', '15'])
      expect(active()).toBe(year)
    })

    it('picks an era by what its name adds to what every name begins with', async () => {
      await renderField({
        defaultValue: DATE,
        locale: 'en-US-u-ca-ethiopic',
      })
      await fireEvent.press(segmentOf('era'))

      await typeKeys('A')
      expect(textOf(segmentOf('era'))).toBe('AA')

      await typeKeys('M')
      expect(textOf(segmentOf('era'))).toBe('AM')
    })

    it('raises no keyboard when a swipe takes the era away', async () => {
      const focus = spyOnInputFocus()
      await renderField({ defaultValue: new CalendarDate('BC', 100, 1, 1) })

      await fireEvent(segmentOf('era'), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      })

      expect(screen.queryByLabelText('era, Label')).toBeNull()
      expect(focus).not.toHaveBeenCalled()
    })

    it('steps a segment with a swipe up or down', async () => {
      const onChange = jest.fn()
      await renderField({ defaultValue: DATE, onChange })

      await fireEvent(segmentOf('month'), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      })
      expect(onChange).toHaveBeenLastCalledWith(new CalendarDate(2026, 10, 15))

      await fireEvent(segmentOf('month'), 'accessibilityAction', {
        nativeEvent: { actionName: 'decrement' },
      })
      await fireEvent(segmentOf('month'), 'accessibilityAction', {
        nativeEvent: { actionName: 'decrement' },
      })
      expect(onChange).toHaveBeenLastCalledWith(new CalendarDate(2026, 8, 15))

      await fireEvent(segmentOf('month'), 'accessibilityAction', {
        nativeEvent: { actionName: 'activate' },
      })
      expect(onChange).toHaveBeenCalledTimes(3)
    })

    it('fills in a date that cannot be once focus leaves', async () => {
      const onChange = jest.fn()
      await renderField({ locale: 'en-GB', onChange })
      await fireEvent.press(segmentOf('day'))
      await fireEvent(input(), 'focus')

      await typeKeys('3102')
      await typeKeys('2026')
      expect(onChange).not.toHaveBeenCalled()

      await fireEvent(input(), 'blur')
      expect(onChange).toHaveBeenCalledWith(new CalendarDate(2026, 2, 28))
      expect(active()).toBeUndefined()
    })

    it('tells the call site once as focus arrives and once as it leaves', async () => {
      const onBlur = jest.fn()
      const onFocus = jest.fn()
      await renderField({ onBlur, onFocus })

      await fireEvent.press(segmentOf('month'))
      await fireEvent(input(), 'focus')
      await fireEvent.press(segmentOf('day'))
      await fireEvent(input(), 'focus')
      expect(onFocus).toHaveBeenCalledTimes(1)
      expect(onBlur).not.toHaveBeenCalled()

      await fireEvent(input(), 'blur')
      expect(onBlur).toHaveBeenCalledTimes(1)
    })

    it('types into the first segment when the input is focused some other way', async () => {
      await renderField()

      await fireEvent(input(), 'focus')

      expect(active()).toBe(segmentOf('month'))
    })

    it('hides the input from a screen reader', async () => {
      await renderField()

      expect(screen.queryByDisplayValue(' ', { normalizer: (t) => t })).toBe(
        null,
      )
      expect(input().props.caretHidden).toBe(true)
    })

    it('focuses the first segment when the box is pressed', async () => {
      const focus = spyOnInputFocus()
      await render(
        <View testID="field">
          <DateField label="Label" locale="en-US" />
        </View>,
      )
      const root = firstHostOf(screen.getByTestId('field'), 'root')

      await fireEvent.press(firstHostOf(root, 'box'))

      expect(focus).toHaveBeenCalledTimes(1)
      expect(active()).toBe(segmentOf('month'))
    })

    it('leaves the segment being typed where it is when the box is pressed', async () => {
      await render(
        <View testID="field">
          <DateField label="Label" locale="en-US" />
        </View>,
      )
      const root = firstHostOf(screen.getByTestId('field'), 'root')
      await fireEvent.press(segmentOf('year'))
      await fireEvent(input(), 'focus')
      expect(active()).toBe(segmentOf('year'))

      await fireEvent.press(firstHostOf(root, 'box'))

      expect(active()).toBe(segmentOf('year'))
    })
  })

  describe('the box', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('marks the label of a field that must be filled', async () => {
      await renderField({ isRequired: true })

      expect(
        screen.getAllByText('Label*', { includeHiddenElements: true }),
      ).toHaveLength(1)
    })

    it('floats the label over the placeholders, or keeps it small at the top', async () => {
      await renderField()
      expect(drawnLabel()).toMatchObject({
        fontSize: typography.bodySmallSize,
        letterSpacing: typography.bodySmallTracking,
        top: 0,
      })

      await screen.rerender(
        <DateField floatingLabel={false} label="Label" locale="en-US" />,
      )
      await advance(motion.durationShort3)
      expect(drawnLabel()).toMatchObject({
        fontSize: typography.labelMediumSize,
        letterSpacing: typography.labelMediumTracking,
        top: 0,
      })
    })

    it('draws itself focused while a segment is', async () => {
      await renderField()

      await fireEvent.press(segmentOf('month'))
      await fireEvent(input(), 'focus')
      await advance(motion.durationShort3)
      expect(drawnLabel()).toMatchObject({ color: eased(colors.primary) })

      await fireEvent(input(), 'blur')
      await advance(motion.durationShort3)
      expect(drawnLabel()).toMatchObject({
        color: eased(colors.onSurfaceVariant),
      })
    })

    it('draws itself in error under one', async () => {
      await renderField({ error: 'Supporting line' })
      await advance(motion.durationShort3)

      expect(drawnLabel()).toMatchObject({ color: eased(colors.error) })
    })
  })

  describe('disabled', () => {
    it('takes no press, no step and no key, and fades every part', async () => {
      const focus = spyOnInputFocus()
      const onChange = jest.fn()
      await renderField({ defaultValue: DATE, isDisabled: true, onChange })

      await fireEvent.press(segmentOf('month'))
      await fireEvent(segmentOf('month'), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      })

      expect(focus).not.toHaveBeenCalled()
      expect(onChange).not.toHaveBeenCalled()
      expect(segmentOf('month').props.accessibilityState).toMatchObject({
        disabled: true,
      })
      expect(segmentOf('month').props.accessibilityActions).toBeUndefined()
      expect(input().props.editable).toBe(false)
      expect(styleOf(textElementOf(segmentOf('month'))).color).toBe(
        DISABLED_CONTENT,
      )
      expect(styleOf(literals()[0]).color).toBe(DISABLED_CONTENT)
    })
  })

  describe('read only', () => {
    it('shows the value and takes no input', async () => {
      const focus = spyOnInputFocus()
      const onChange = jest.fn()
      await renderField({ defaultValue: DATE, isReadOnly: true, onChange })

      await fireEvent.press(segmentOf('month'))
      await fireEvent(segmentOf('month'), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      })
      await fireEvent(input(), 'focus')
      await typeKeys('1')
      await fireEvent.changeText(input(), '')

      expect(focus).not.toHaveBeenCalled()
      expect(onChange).not.toHaveBeenCalled()
      expect(shown()).toStrictEqual(['9', '15', '2026'])
      expect(segmentOf('month').props.accessibilityActions).toBeUndefined()
      expect(input().props.editable).toBe(false)
    })

    it("keeps the form's error through keys that edit nothing", async () => {
      await render(
        withForm(
          <DateField
            defaultValue={DATE}
            isReadOnly
            label="Label"
            locale="en-US"
            name="date"
          />,
          { validationErrors: { date: 'Supporting line' } },
        ),
      )
      jest.replaceProperty(Platform, 'OS', 'web')
      await screen.rerender(
        withForm(
          <DateField
            defaultValue={DATE}
            isReadOnly
            label="Label"
            locale="en-US"
            name="date"
          />,
          { validationErrors: { date: 'Supporting line' } },
        ),
      )

      for (const key of ['ArrowUp', 'Backspace', '1']) {
        // oxlint-disable-next-line no-await-in-loop -- each key is an act of its own, and two acts may not overlap
        await fireEvent(segmentOf('month'), 'keyDown', keyDown(key))
      }

      expect(message('Supporting line')).not.toBeNull()
      expect(shown()).toStrictEqual(['9', '15', '2026'])
    })
  })

  describe('validation', () => {
    it("says a date outside the bounds is, in React Stately's words", async () => {
      await renderField({
        defaultValue: DATE,
        minValue: new CalendarDate(2026, 9, 20),
      })

      expect(message('Value must be 9/20/2026 or later.')).not.toBeNull()
      expect(segmentOf('year').props.accessibilityHint).toBe(
        'Selected Date: September 15, 2026 Value must be 9/20/2026 or later.',
      )
    })

    it('says a date ruled out is unavailable', async () => {
      await renderField({
        defaultValue: new CalendarDate(2026, 9, 19),
        isDateUnavailable: (date) => isWeekend(date, 'en-US'),
      })

      expect(message('Selected date unavailable.')).not.toBeNull()
    })

    it('puts what validate says ahead of the bounds', async () => {
      await renderField({
        defaultValue: DATE,
        minValue: new CalendarDate(2026, 9, 20),
        validate: () => 'Supporting line',
      })

      expect(message('Supporting line')).not.toBeNull()
      expect(message('Value must be 9/20/2026 or later.')).toBeNull()
    })

    it('shows error over everything else', async () => {
      await renderField({
        defaultValue: DATE,
        error: 'Supporting line',
        minValue: new CalendarDate(2026, 9, 20),
        validate: () => 'Another line',
      })

      expect(message('Supporting line')).not.toBeNull()
      expect(message('Another line')).toBeNull()
    })

    it('submits the date as ISO 8601 under its name', async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <DateField
            defaultValue={DATE}
            label="Label"
            locale="en-US"
            name="date"
          />,
          { onSubmit },
        ),
      )

      await submit()

      expect(onSubmit).toHaveBeenCalledWith({ date: '2026-09-15' })
    })

    it('holds a native form back while a required field is empty', async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <DateField isRequired label="Label" locale="en-US" name="date" />,
          { onSubmit, validationBehavior: 'native' },
        ),
      )

      await submit()

      expect(onSubmit).not.toHaveBeenCalled()
      expect(message(REQUIRED)).not.toBeNull()
    })

    it('shows a bound broken by an edit once focus leaves, in a native form', async () => {
      await render(
        withForm(
          <DateField
            defaultValue={DATE}
            label="Label"
            locale="en-US"
            maxValue={DATE}
          />,
          { validationBehavior: 'native' },
        ),
      )
      await fireEvent(segmentOf('day'), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      })
      expect(message('Value must be 9/15/2026 or earlier.')).toBeNull()

      await fireEvent(input(), 'blur')

      expect(message('Value must be 9/15/2026 or earlier.')).not.toBeNull()
    })
  })

  describe('under React Native Web', () => {
    it('makes each segment a spin button, said after the field it is in', async () => {
      await renderOnWeb({ defaultValue: DATE, description: 'Supporting line' })
      const month = segmentOf('month')
      const ids = String(month.props['aria-describedby']).split(' ')
      const [value, description] = ids

      expect(segments()).toHaveLength(3)
      expect(month.props['aria-valuetext']).toBe('9 – September')
      expect(month.props['aria-valuenow']).toBe(9)
      expect(segmentOf('day').props['aria-describedby']).toBeUndefined()
      expect(
        screen.getByText('Selected Date: September 15, 2026', {
          includeHiddenElements: true,
        }).props.id,
      ).toBe(value)
      expect(message('Supporting line')?.props.id).toBe(description)
    })

    it("reports the field's state, which React Native has no prop for", async () => {
      await renderOnWeb({
        error: 'Supporting line',
        isReadOnly: true,
        isRequired: true,
      })

      expect(segmentOf('month').props).toMatchObject({
        'aria-invalid': true,
        'aria-readonly': true,
        'aria-required': true,
      })
    })

    it("steps the segment in focus with React Aria's keys", async () => {
      const onChange = jest.fn()
      await renderOnWeb({ defaultValue: DATE, onChange })
      const steps: [string, CalendarDate][] = [
        ['ArrowUp', new CalendarDate(2026, 10, 15)],
        ['ArrowDown', new CalendarDate(2026, 9, 15)],
        ['PageUp', new CalendarDate(2026, 11, 15)],
        ['PageDown', new CalendarDate(2026, 9, 15)],
        ['End', new CalendarDate(2026, 12, 15)],
        ['Home', new CalendarDate(2026, 1, 15)],
      ]

      for (const [key, date] of steps) {
        const event = keyDown(key)
        // oxlint-disable-next-line no-await-in-loop -- each key is an act of its own, and two acts may not overlap
        await fireEvent(segmentOf('month'), 'keyDown', event)
        expect(event.preventDefault).toHaveBeenCalled()
        expect(onChange).toHaveBeenLastCalledWith(date)
      }
    })

    it('moves between segments along the line, and no further than its ends', async () => {
      const focus = spyOnFocus()
      await renderOnWeb()

      await fireEvent(segmentOf('day'), 'keyDown', keyDown('ArrowRight'))
      await fireEvent(segmentOf('day'), 'keyDown', keyDown('ArrowLeft'))
      await fireEvent(segmentOf('month'), 'keyDown', keyDown('ArrowLeft'))
      expect(focus.moved).toStrictEqual(['year, Label', 'month, Label'])
    })

    it('turns the arrow keys over on a page read right to left', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      const focus = spyOnFocus()
      await renderOnWeb()

      await fireEvent(segmentOf('day'), 'keyDown', keyDown('ArrowRight'))
      await fireEvent(segmentOf('day'), 'keyDown', keyDown('ArrowLeft'))

      expect(focus.moved).toStrictEqual(['month, Label', 'year, Label'])
    })

    it('types a digit into the segment, moving on once it is full', async () => {
      const focus = spyOnFocus()
      await renderOnWeb()
      await fireEvent(segmentOf('month'), 'focus')

      const event = keyDown('9')
      await fireEvent(segmentOf('month'), 'keyDown', event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(textOf(segmentOf('month'))).toBe('9')
      expect(focus.moved).toStrictEqual(['day, Label'])
    })

    it('leaves a shortcut and a key that types nothing to the browser', async () => {
      await renderOnWeb()
      const keys = [
        keyDown('a', { ctrlKey: true }),
        keyDown('1', { metaKey: true }),
        keyDown('1', { altKey: true }),
        keyDown('Tab'),
        keyDown('Enter'),
      ]

      for (const event of keys) {
        // oxlint-disable-next-line no-await-in-loop -- each key is an act of its own, and two acts may not overlap
        await fireEvent(segmentOf('month'), 'keyDown', event)
        expect(event.preventDefault).not.toHaveBeenCalled()
      }
      expect(textOf(segmentOf('month'))).toBe('mm')
    })

    it('takes a digit off with Backspace or Delete', async () => {
      await renderOnWeb({ defaultValue: DATE })
      await fireEvent(segmentOf('year'), 'focus')

      await fireEvent(segmentOf('year'), 'keyDown', keyDown('Backspace'))
      expect(textOf(segmentOf('year'))).toBe('202')

      await fireEvent(segmentOf('year'), 'keyDown', keyDown('Delete'))
      expect(textOf(segmentOf('year'))).toBe('20')
    })

    it('draws the segment focus is on, and starts it afresh', async () => {
      await renderOnWeb()

      await fireEvent(segmentOf('month'), 'focus')
      await fireEvent(segmentOf('month'), 'keyDown', keyDown('1'))
      await fireEvent(segmentOf('day'), 'focus')
      await fireEvent(segmentOf('day'), 'keyDown', keyDown('1'))

      expect(active()).toBe(segmentOf('day'))
      expect(textOf(segmentOf('month'))).toBe('1')
      expect(textOf(segmentOf('day'))).toBe('1')
    })

    it('blurs the field only once focus leaves its segments', async () => {
      const focus = spyOnFocus()
      const onBlur = jest.fn()
      const onFocus = jest.fn()
      await renderOnWeb({ onBlur, onFocus })
      await fireEvent(segmentOf('month'), 'focus')
      await fireEvent(segmentOf('month'), 'keyDown', keyDown('ArrowRight'))
      const [day] = focus.views

      await fireEvent(segmentOf('month'), 'blur', {
        nativeEvent: { relatedTarget: day },
      })
      await fireEvent(segmentOf('day'), 'focus')
      expect(onBlur).not.toHaveBeenCalled()
      expect(onFocus).toHaveBeenCalledTimes(1)

      await fireEvent(segmentOf('day'), 'blur', {
        nativeEvent: { relatedTarget: null },
      })
      expect(onBlur).toHaveBeenCalledTimes(1)
      expect(active()).toBeUndefined()
    })

    it('moves focus to the year when a step takes the era away', async () => {
      const focus = spyOnFocus()
      await renderOnWeb({ defaultValue: new CalendarDate('BC', 100, 1, 1) })
      await fireEvent(segmentOf('era'), 'focus')

      await fireEvent(segmentOf('era'), 'keyDown', keyDown('ArrowUp'))

      expect(screen.queryByLabelText('era, Label')).toBeNull()
      expect(focus.moved).toStrictEqual(['year, Label'])
    })

    it('focuses the first segment when the field is focused from outside', async () => {
      const focus = spyOnFocus()
      await render(
        withForm(
          <DateField isRequired label="Label" locale="en-US" name="date" />,
          { validationBehavior: 'native' },
        ),
      )
      jest.replaceProperty(Platform, 'OS', 'web')

      await submit()

      expect(focus.moved).toStrictEqual(['month, Label'])
    })

    it('draws no hidden input', async () => {
      await renderOnWeb()

      expect(
        screen.queryByDisplayValue(' ', {
          includeHiddenElements: true,
          normalizer: (text) => text,
        }),
      ).toBeNull()
    })
  })

  it('puts style, ref and testID on the field as a whole', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await renderField({ ref, style: CALL_SITE, testID: 'field' })
    const root = screen.getByTestId('field')

    expect(styleOf(root)).toMatchObject(CALL_SITE)
    expect(ref.current).not.toBeNull()
    expect(root.props).toMatchObject({ 'aria-label': 'Label', role: 'group' })
  })
})
