import type { ComponentRef, ReactNode } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'

import { parseZonedDateTime, Time } from '@internationalized/date'
import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { Platform, StyleSheet, View } from 'react-native'

import type { TimeFieldProps } from '.'

import { TimeField } from '.'
import { I18nProvider } from '../../i18n/provider'
import { Button } from '../button'
import { Form } from '../form'

const CALL_SITE = { marginTop: 4 }

// A fixed time, so every case reads the same whenever it runs.
const TIME = new Time(9, 30)

afterEach(() => {
  jest.restoreAllMocks()
})

// The first of an element's children that is an element rather than text.
function firstHostOf(element: ReturnType<typeof segmentOf>) {
  const child = element.children.at(0)

  if (child === undefined || typeof child === 'string') {
    throw new TypeError('expected the segment to draw its text')
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

// The line under the field holding `text`, which is hidden from VoiceOver on
// iOS, since each segment reads it out as its hint.
function message(text: string) {
  return screen.queryByText(text, { includeHiddenElements: true })
}

// What a segment is named, which is what a case tells them apart by.
function nameOf(segment: ReturnType<typeof segmentOf>) {
  const label: unknown = segment.props.accessibilityLabel
  return typeof label === 'string' ? label : undefined
}

async function renderField(props: Partial<TimeFieldProps> = {}) {
  await render(<TimeField label="Label" locale="en-US" {...props} />)
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

async function step(name: string, actionName: 'decrement' | 'increment') {
  await fireEvent(segmentOf(name), 'accessibilityAction', {
    nativeEvent: { actionName },
  })
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle & ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

async function submit() {
  await fireEvent.press(screen.getByRole('button', { name: 'Submit' }))
}

function textOf(segment: ReturnType<typeof segmentOf>) {
  const text = firstHostOf(segment).children.at(0)
  return typeof text === 'string' ? text : undefined
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

describe('TimeField', () => {
  describe('segments', () => {
    it('draws an hour, a minute and a day period on a twelve-hour locale', async () => {
      await renderField({ defaultValue: TIME })

      expect(segmentNames()).toStrictEqual([
        'hour, Label',
        'minute, Label',
        'AM/PM, Label',
      ])
      expect(shown()).toStrictEqual(['9', '30', 'AM'])
    })

    it('draws no day period on a twenty-four-hour locale', async () => {
      await renderField({ defaultValue: TIME, locale: 'en-GB' })

      expect(segmentNames()).toStrictEqual(['hour, Label', 'minute, Label'])
      expect(segmentOf('hour').props.accessibilityValue).toMatchObject({
        max: 23,
        min: 0,
        now: 9,
      })
    })

    it("takes the I18nProvider's clock where it names no locale", async () => {
      await render(
        <I18nProvider locale="en-GB">
          <TimeField defaultValue={TIME} label="Label" />
        </I18nProvider>,
      )

      expect(segmentNames()).toStrictEqual(['hour, Label', 'minute, Label'])
    })

    it('sets the clock whatever the locale through hourCycle', async () => {
      await renderField({ defaultValue: TIME, hourCycle: 24 })
      expect(segmentNames()).toStrictEqual(['hour, Label', 'minute, Label'])

      await renderField({ defaultValue: TIME, hourCycle: 12, locale: 'en-GB' })
      expect(segmentNames()).toStrictEqual([
        'hour, Label',
        'minute, Label',
        'AM/PM, Label',
      ])
    })

    it('goes down to seconds, or up to hours, as the granularity asks', async () => {
      await renderField({ defaultValue: TIME, granularity: 'second' })
      expect(segmentNames()).toStrictEqual([
        'hour, Label',
        'minute, Label',
        'second, Label',
        'AM/PM, Label',
      ])
      expect(shown()).toStrictEqual(['9', '30', '00', 'AM'])

      await renderField({ defaultValue: TIME, granularity: 'hour' })
      expect(segmentNames()).toStrictEqual(['hour, Label', 'AM/PM, Label'])
    })

    it('shows the placeholders while it is empty', async () => {
      await renderField()

      expect(shown()).toStrictEqual(['––', '––', 'AM'])
      expect(segmentOf('hour').props.accessibilityValue).toMatchObject({
        text: 'Empty',
      })
    })

    it('steps an empty segment from where placeholderValue says', async () => {
      await renderField({ placeholderValue: new Time(14) })

      await step('hour', 'increment')

      expect(textOf(segmentOf('hour'))).toBe('2')
    })

    it('writes a leading zero on the hour where it is asked to', async () => {
      await renderField({ defaultValue: TIME, shouldForceLeadingZeros: true })

      expect(shown()).toStrictEqual(['09', '30', 'AM'])
    })

    it('draws the time zone of a zoned time, unless it is hidden', async () => {
      const zoned = parseZonedDateTime('2026-09-15T09:30[America/New_York]')

      await renderField({ defaultValue: zoned })
      expect(screen.queryByText('EDT')).not.toBeNull()

      await renderField({ defaultValue: zoned, hideTimeZone: true })
      expect(screen.queryByText('EDT')).toBeNull()
      expect(shown()).toStrictEqual(['9', '30', 'AM'])
    })

    it('says the time once, as a time', async () => {
      await renderField({ defaultValue: TIME, description: 'Supporting line' })

      expect(segmentOf('hour').props.accessibilityHint).toBe(
        'Selected Time: 9:30 AM Supporting line',
      )
      expect(segmentOf('minute').props.accessibilityHint).toBeUndefined()
    })
  })

  describe('the value', () => {
    it('hands back a time, and shows the value it is handed', async () => {
      const onChange = jest.fn()
      await renderField({ onChange, value: TIME })

      await step('hour', 'increment')
      expect(onChange).toHaveBeenCalledWith(new Time(10, 30))
      expect(shown()).toStrictEqual(['9', '30', 'AM'])

      await screen.rerender(
        <TimeField
          label="Label"
          locale="en-US"
          onChange={onChange}
          value={new Time(14, 5)}
        />,
      )
      expect(shown()).toStrictEqual(['2', '05', 'PM'])
    })

    it('keeps its own value from defaultValue', async () => {
      const onChange = jest.fn()
      await renderField({ defaultValue: TIME, onChange })

      await step('minute', 'decrement')

      expect(onChange).toHaveBeenCalledWith(new Time(9, 29))
      expect(shown()).toStrictEqual(['9', '29', 'AM'])
    })

    it('types a time a digit at a time on iOS and Android', async () => {
      const onChange = jest.fn()
      await renderField({ onChange })

      await fireEvent.press(segmentOf('hour'))
      await typeKeys('230')
      await fireEvent.press(segmentOf('AM/PM'))
      await typeKeys('p')

      expect(shown()).toStrictEqual(['2', '30', 'PM'])
      expect(onChange).toHaveBeenLastCalledWith(new Time(14, 30))
    })

    it("turns the day period between the locale's words for the two", async () => {
      const onChange = jest.fn()
      await renderField({ defaultValue: TIME, onChange })

      await step('AM/PM', 'increment')
      expect(onChange).toHaveBeenLastCalledWith(new Time(21, 30))
      expect(textOf(segmentOf('AM/PM'))).toBe('PM')

      await renderField({ defaultValue: TIME, locale: 'ko-KR' })
      const period = segments().find((segment) => textOf(segment) === '오전')
      if (period === undefined) {
        throw new TypeError("expected the locale's word for the morning")
      }
      await fireEvent(period, 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      })
      expect(shown()).toContain('오후')
    })

    it('takes no step while it is disabled or read only', async () => {
      const onChange = jest.fn()
      await renderField({ defaultValue: TIME, isDisabled: true, onChange })
      expect(segmentOf('hour').props.accessibilityState).toMatchObject({
        disabled: true,
      })
      await step('hour', 'increment')

      await renderField({ defaultValue: TIME, isReadOnly: true, onChange })
      await step('hour', 'increment')

      expect(onChange).not.toHaveBeenCalled()
      expect(shown()).toStrictEqual(['9', '30', 'AM'])
    })
  })

  describe('validation', () => {
    it("says a time outside the bounds is, in React Stately's words", async () => {
      await renderField({ defaultValue: TIME, minValue: new Time(10) })
      expect(message('Value must be 10:00 AM or later.')).not.toBeNull()

      await renderField({ defaultValue: TIME, maxValue: new Time(9) })
      expect(message('Value must be 9:00 AM or earlier.')).not.toBeNull()
    })

    it('puts what validate says ahead of the bounds', async () => {
      await renderField({
        defaultValue: TIME,
        minValue: new Time(10),
        validate: (time) => (time.hour < 12 ? 'Supporting line' : null),
      })

      expect(message('Supporting line')).not.toBeNull()
      expect(message('Value must be 10:00 AM or later.')).toBeNull()
    })

    it('submits the time alone under its name, and nothing while empty', async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <>
            <TimeField
              defaultValue={TIME}
              label="Label"
              locale="en-US"
              name="time"
            />
            <TimeField label="Other" locale="en-US" name="empty" />
          </>,
          { onSubmit },
        ),
      )

      await submit()

      expect(onSubmit).toHaveBeenCalledWith({ empty: '', time: '09:30:00' })
    })

    it('holds a native form back while a required field is empty', async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <TimeField isRequired label="Label" locale="en-US" name="time" />,
          { onSubmit, validationBehavior: 'native' },
        ),
      )

      await submit()

      expect(onSubmit).not.toHaveBeenCalled()
      expect(message('Fill out this field.')).not.toBeNull()
      expect(
        screen.getByText('Label*', { includeHiddenElements: true }),
      ).toBeTruthy()
    })

    it('holds nothing back while read only, and submits nothing while disabled', async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <>
            <TimeField
              isReadOnly
              isRequired
              label="Label"
              locale="en-US"
              name="read"
            />
            <TimeField
              defaultValue={TIME}
              isDisabled
              label="Other"
              locale="en-US"
              name="disabled"
            />
          </>,
          { onSubmit, validationBehavior: 'native' },
        ),
      )

      await submit()

      expect(onSubmit).toHaveBeenCalledWith({ read: '' })
    })

    it('marks each segment required for React Native Web only where it is', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')

      await renderField({ isRequired: true })
      expect(segmentOf('hour').props).toMatchObject({ 'aria-required': true })

      await renderField()
      expect(segmentOf('hour').props['aria-required']).toBeUndefined()
    })
  })

  it('draws the icons it is handed at either end of the box', async () => {
    await renderField({
      leadingIcon: <View testID="leading" />,
      trailingIcon: <View testID="trailing" />,
    })

    expect(screen.getByTestId('leading')).toBeTruthy()
    expect(screen.getByTestId('trailing')).toBeTruthy()
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
