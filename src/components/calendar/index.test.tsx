import type { DateValue } from '@internationalized/date'
import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { TestInstance, TestNode } from 'test-renderer'

import { CalendarDate, getDayOfWeek } from '@internationalized/date'
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
import { AccessibilityInfo, I18nManager, StyleSheet, View } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import { Calendar } from '.'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

// What the next calendar the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

const { theme } = scopeFor('light', {})
const { colors, motion, radii, spacing, stateLayerOpacity, typography } = theme

const DISABLED_CONTENT = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContent,
)

// The month every case shows, and bounds inside it. September 2026 opens on a
// Tuesday, so an English week starting on Sunday begins in August.
const SEPTEMBER = new CalendarDate(2026, 9, 15)
const MAX = new CalendarDate(2026, 9, 24)
const MIN = new CalendarDate(2026, 9, 8)

// The day the clock reads, outside September so no case's month holds an
// outline it did not ask for.
const NOW = new Date(2026, 9, 17, 12)

// How many months the cases showing more than one show.
const TWO_MONTHS = { months: 2 }

// A duration under a month, which shows one.
const NO_MONTHS = { months: 0 }

const CALL_SITE = StyleSheet.create({ calendar: { marginTop: 4 } }).calendar

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// How a menu button's arrow is drawn: turned over while its list is open.
function arrowOf(name: string) {
  return styleOf(glyphOf(screen.getByRole('button', { name })))
}

// The calendar, which is the element rendered. A container is never an
// accessibility element of its own, since iOS would then read it as one and
// hide its dates, so it is not one Testing Library finds by role.
function calendarOf() {
  const root = screen.root
  if (root?.props.role !== 'group') {
    throw new TypeError('expected the calendar')
  }
  return root
}

// How a chevron's glyph is drawn: turned around or over, or neither.
function chevronOf(name: 'Next' | 'Previous') {
  return styleOf(glyphOf(screen.getByRole('button', { name })))
}

function child(node: null | TestNode | undefined): TestInstance {
  if (node === null || node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

function dateNamed(name: string) {
  return screen.getByRole('button', { name })
}

// Every date the grid draws, in the order it draws them: the buttons that
// draw no glyph, which a chevron and a menu button both do.
function datesOf() {
  return screen
    .getAllByRole('button')
    .filter(
      (button) =>
        button.queryAll((each) => each.type.startsWith('RNSVGSvgView'))
          .length === 0,
    )
}

// The glyph a chevron draws, which a screen reader is not sent to.
function glyphOf(button: TestInstance): TestInstance {
  return child(
    button.queryAll((each) => each.type.startsWith('RNSVGSvgView'))[0],
  )
}

function isWeekend(date: DateValue) {
  const day = getDayOfWeek(date, 'en-US')
  return day === 0 || day === 6
}

// The open month or year list, the scroll view holding its rows, which is a
// container as the calendar is.
function listOf() {
  return screen.root?.queryAll((each) => each.props.role === 'radiogroup')[0]
}

// What a screen reader calls an element, which is where a pressable puts the
// name it is given.
function nameOf(element: TestInstance) {
  const name: unknown = element.props.accessibilityLabel
  return typeof name === 'string' ? name : ''
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

// A date's number, which is the one text inside its button.
function textOf(button: TestInstance): TestInstance {
  return child(
    button.children.find(
      (node) => typeof node !== 'string' && node.type === 'Text',
    ),
  )
}

function textStyleOf(element: {
  props: { style?: StyleProp<TextStyle> }
}): TextStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

// The weekday row's letters. The row is hidden from a screen reader, since
// every date names its weekday, so these are the texts a query finds only
// when it asks for hidden elements too.
function weekdaysOf() {
  const shown = new Set(screen.getAllByText(/./))
  return screen
    .getAllByText(/./, { includeHiddenElements: true })
    .filter((text) => !shown.has(text))
    .map((text): unknown => text.props.children)
}

// Where the weeks are as they slide in: the view holding them, which is the
// week row's parent above any date's column.
async function weeksAt() {
  await act(() => {
    jest.advanceTimersByTime(0)
  })
  const column = child(datesOf()[0]?.parent)
  const weeks = child(child(column.parent).parent)
  const style = getAnimatedStyle(weeks)
  const transform: unknown = style.transform
  const shift: unknown = Array.isArray(transform) ? transform.at(0) : undefined
  const translateX: unknown =
    typeof shift === 'object' && shift !== null && 'translateX' in shift
      ? shift.translateX
      : undefined
  // Not a number reads as no number at all to every comparison below, so a
  // slide that lost its transform cannot pass for one standing still.
  return {
    opacity: style.opacity,
    translateX: typeof translateX === 'number' ? translateX : Number.NaN,
  }
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW })
})

afterEach(() => {
  mockReducedMotion = false
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('Calendar', () => {
  describe('semantics', () => {
    it('is a group named by its label and the month it shows', async () => {
      await render(
        <Calendar aria-label="Label" defaultValue={SEPTEMBER} locale="en-US" />,
      )

      expect(calendarOf().props['aria-label']).toBe('Label, September 2026')
      expect(
        screen.getByRole('heading', { name: 'September 2026' }),
      ).toBeTruthy()
    })

    it('is named by the month alone without a label', async () => {
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      expect(calendarOf().props['aria-label']).toBe('September 2026')
    })

    it('names each date in full, and the one it holds as selected', async () => {
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      expect(dateNamed('Tuesday, September 15, 2026 selected')).toBeEnabled()
      expect(dateNamed('Wednesday, September 16, 2026')).toBeEnabled()
    })

    it('names its chevrons by where they go', async () => {
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    })

    it('hides the weekday row from a screen reader, since each date names its day', async () => {
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      expect(weekdaysOf()).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S'])
    })

    it('draws six weeks of a month that takes five, the rest in the months either side', async () => {
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      const names = datesOf().map(nameOf)

      expect(names).toHaveLength(35)
      expect(names[0]).toBe('Sunday, August 30, 2026')
      expect(names.at(-1)).toBe('Saturday, October 3, 2026')
    })

    it('disables the dates of the months either side', async () => {
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      expect(dateNamed('Sunday, August 30, 2026')).toBeDisabled()
      expect(dateNamed('Thursday, October 1, 2026')).toBeDisabled()
      expect(dateNamed('Tuesday, September 1, 2026')).toBeEnabled()
      expect(dateNamed('Wednesday, September 30, 2026')).toBeEnabled()
    })

    it('names today as today, and as selected where it is held', async () => {
      jest.setSystemTime(new Date(2026, 8, 10, 12))
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      expect(dateNamed('Today, Thursday, September 10, 2026')).toBeEnabled()

      await fireEvent.press(dateNamed('Today, Thursday, September 10, 2026'))

      expect(
        dateNamed('Today, Thursday, September 10, 2026 selected'),
      ).toBeEnabled()
    })

    it('names the first and last dates the bounds allow', async () => {
      await render(
        <Calendar
          defaultValue={SEPTEMBER}
          locale="en-US"
          maxValue={MAX}
          minValue={MIN}
        />,
      )

      expect(
        dateNamed('Tuesday, September 8, 2026, First available date'),
      ).toBeEnabled()
      expect(
        dateNamed('Thursday, September 24, 2026, Last available date'),
      ).toBeEnabled()
    })
  })

  describe('picking a date', () => {
    it('selects the date pressed and reports it', async () => {
      const onChange = jest.fn()
      await render(
        <Calendar
          defaultValue={SEPTEMBER}
          locale="en-US"
          onChange={onChange}
        />,
      )

      await fireEvent.press(dateNamed('Tuesday, September 22, 2026'))

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(new CalendarDate(2026, 9, 22))
      expect(dateNamed('Tuesday, September 22, 2026 selected')).toBeEnabled()
      expect(dateNamed('Tuesday, September 15, 2026')).toBeEnabled()
    })

    it('holds a controlled value until the call site moves it', async () => {
      const onChange = jest.fn()
      await render(
        <Calendar locale="en-US" onChange={onChange} value={SEPTEMBER} />,
      )

      await fireEvent.press(dateNamed('Tuesday, September 22, 2026'))

      expect(onChange).toHaveBeenCalledWith(new CalendarDate(2026, 9, 22))
      expect(dateNamed('Tuesday, September 15, 2026 selected')).toBeEnabled()
      expect(dateNamed('Tuesday, September 22, 2026')).toBeEnabled()
    })

    it('opens on the month of the date it holds, and on today without one', async () => {
      await render(<Calendar locale="en-US" />)

      expect(screen.getByRole('heading', { name: 'October 2026' })).toBeTruthy()
      expect(dateNamed('Today, Saturday, October 17, 2026')).toBeEnabled()
    })

    it('disables the dates outside its bounds', async () => {
      const onChange = jest.fn()
      await render(
        <Calendar
          defaultValue={SEPTEMBER}
          locale="en-US"
          maxValue={MAX}
          minValue={MIN}
          onChange={onChange}
        />,
      )

      expect(dateNamed('Monday, September 7, 2026')).toBeDisabled()
      expect(dateNamed('Friday, September 25, 2026')).toBeDisabled()

      await fireEvent.press(dateNamed('Monday, September 7, 2026'))

      expect(onChange).not.toHaveBeenCalled()
    })

    it('disables the dates isDateUnavailable rules out', async () => {
      const onChange = jest.fn()
      await render(
        <Calendar
          defaultValue={SEPTEMBER}
          isDateUnavailable={isWeekend}
          locale="en-US"
          onChange={onChange}
        />,
      )

      expect(dateNamed('Saturday, September 12, 2026')).toBeDisabled()
      expect(dateNamed('Sunday, September 13, 2026')).toBeDisabled()
      expect(dateNamed('Monday, September 14, 2026')).toBeEnabled()

      await fireEvent.press(dateNamed('Saturday, September 12, 2026'))

      expect(onChange).not.toHaveBeenCalled()
    })

    it('takes no press while read-only', async () => {
      const onChange = jest.fn()
      await render(
        <Calendar
          defaultValue={SEPTEMBER}
          isReadOnly
          locale="en-US"
          onChange={onChange}
        />,
      )

      await fireEvent.press(dateNamed('Tuesday, September 22, 2026'))

      expect(onChange).not.toHaveBeenCalled()
      expect(dateNamed('Tuesday, September 15, 2026 selected')).toBeEnabled()
    })

    it('disables every date and both chevrons while disabled', async () => {
      await render(
        <Calendar defaultValue={SEPTEMBER} isDisabled locale="en-US" />,
      )

      expect(datesOf()).toHaveLength(35)
      for (const date of datesOf()) {
        expect(date).toBeDisabled()
      }
      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    })
  })

  describe('moving the month', () => {
    it('steps a month either way with its chevrons', async () => {
      const onFocusChange = jest.fn()
      await render(
        <Calendar
          aria-label="Label"
          defaultValue={SEPTEMBER}
          locale="en-US"
          onFocusChange={onFocusChange}
        />,
      )

      await fireEvent.press(screen.getByRole('button', { name: 'Next' }))

      expect(screen.getByRole('heading', { name: 'October 2026' })).toBeTruthy()
      expect(calendarOf().props['aria-label']).toBe('Label, October 2026')
      expect(dateNamed('Thursday, October 15, 2026')).toBeEnabled()

      await fireEvent.press(screen.getByRole('button', { name: 'Previous' }))
      await fireEvent.press(screen.getByRole('button', { name: 'Previous' }))

      expect(screen.getByRole('heading', { name: 'August 2026' })).toBeTruthy()
      expect(onFocusChange).toHaveBeenLastCalledWith(
        new CalendarDate(2026, 8, 15),
      )
    })

    it('disables a chevron whose month is outside its bounds', async () => {
      await render(
        <Calendar
          defaultValue={SEPTEMBER}
          locale="en-US"
          maxValue={new CalendarDate(2026, 10, 24)}
          minValue={MIN}
        />,
      )

      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()

      await fireEvent.press(screen.getByRole('button', { name: 'Next' }))

      expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    })

    it('slides a later month in from the end', async () => {
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      expect(await weeksAt()).toEqual({ opacity: 1, translateX: 0 })

      await fireEvent.press(screen.getByRole('button', { name: 'Next' }))
      const arriving = await weeksAt()

      expect(arriving.translateX).toBeGreaterThan(0)
      expect(arriving.translateX).toBeLessThanOrEqual(30)
      expect(arriving.opacity).toBeLessThan(1)

      await advance(motion.durationMedium2 / 2)
      const midway = await weeksAt()

      expect(midway.translateX).toBeGreaterThan(0)
      expect(midway.translateX).toBeLessThan(arriving.translateX)

      await advance(motion.durationMedium2)

      expect(await weeksAt()).toEqual({ opacity: 1, translateX: 0 })
    })

    it('slides an earlier month in from the start', async () => {
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      await fireEvent.press(screen.getByRole('button', { name: 'Previous' }))
      const arriving = await weeksAt()

      expect(arriving.translateX).toBeLessThan(0)
      expect(arriving.translateX).toBeGreaterThanOrEqual(-30)
    })

    it('slides a later month in from the left under a right-to-left layout', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      await fireEvent.press(screen.getByRole('button', { name: 'Next' }))

      expect((await weeksAt()).translateX).toBeLessThan(0)
    })

    it('changes the month at once under reduced motion', async () => {
      mockReducedMotion = true
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      await fireEvent.press(screen.getByRole('button', { name: 'Next' }))

      expect(await weeksAt()).toEqual({ opacity: 1, translateX: 0 })
    })

    it('does not slide when a date in the month shown is picked', async () => {
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      await fireEvent.press(dateNamed('Tuesday, September 22, 2026'))

      expect(await weeksAt()).toEqual({ opacity: 1, translateX: 0 })
    })
  })

  describe('more than one month', () => {
    it('shows one month for a duration under one', async () => {
      await render(
        <Calendar
          aria-label="Label"
          defaultValue={SEPTEMBER}
          locale="en-US"
          visibleDuration={NO_MONTHS}
        />,
      )

      expect(calendarOf().props['aria-label']).toBe('Label, September 2026')
      expect(screen.getByRole('heading')).toHaveTextContent('September 2026')
    })

    it('shows as many months as visibleDuration asks, its heading naming them', async () => {
      await render(
        <Calendar
          aria-label="Label"
          defaultValue={SEPTEMBER}
          locale="en-US"
          visibleDuration={TWO_MONTHS}
        />,
      )

      expect(screen.getByRole('heading')).toHaveTextContent(
        'September – October 2026',
      )
      expect(calendarOf().props['aria-label']).toBe(
        'Label, September to October 2026',
      )
      expect(dateNamed('Friday, October 16, 2026')).toBeEnabled()
    })

    it('moves by as many months as it shows', async () => {
      await render(
        <Calendar
          defaultValue={SEPTEMBER}
          locale="en-US"
          visibleDuration={TWO_MONTHS}
        />,
      )

      await fireEvent.press(screen.getByRole('button', { name: 'Previous' }))

      expect(screen.getByRole('heading')).toHaveTextContent(
        'July – August 2026',
      )
    })

    it('draws the plain header whatever showMonthYearMenus says', async () => {
      await render(
        <Calendar
          defaultValue={SEPTEMBER}
          locale="en-US"
          showMonthYearMenus
          visibleDuration={TWO_MONTHS}
        />,
      )

      expect(screen.getByRole('heading')).toBeOnTheScreen()
      expect(
        screen.queryByRole('button', { name: 'Sep month' }),
      ).not.toBeOnTheScreen()
    })
  })

  describe('the month and year menus', () => {
    it('draws the month and the year as menu buttons between the chevrons', async () => {
      await render(
        <Calendar defaultValue={SEPTEMBER} locale="en-US" showMonthYearMenus />,
      )

      const month = screen.getByRole('button', { name: 'Sep month' })
      const year = screen.getByRole('button', { name: '2026 year' })

      expect(month).toBeCollapsed()
      expect(year).toBeCollapsed()
      expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
      expect(screen.queryByRole('heading')).toBe(null)
    })

    it('opens the month list in the grid’s place, the month shown checked', async () => {
      await render(
        <Calendar defaultValue={SEPTEMBER} locale="en-US" showMonthYearMenus />,
      )

      await fireEvent.press(screen.getByRole('button', { name: 'Sep month' }))

      expect(listOf()?.props['aria-label']).toBe('month')
      expect(screen.getByRole('radio', { name: 'September' })).toBeChecked()
      expect(screen.getByRole('radio', { name: 'October' })).not.toBeChecked()
      expect(screen.getByRole('button', { name: 'Sep month' })).toBeExpanded()
      expect(screen.getByRole('button', { name: '2026 year' })).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Previous' })).toBe(null)
      expect(screen.queryByRole('button', { name: 'Next' })).toBe(null)
      expect(datesOf()).toHaveLength(0)
    })

    it('moves to the month chosen and closes the list', async () => {
      const onFocusChange = jest.fn()
      await render(
        <Calendar
          aria-label="Label"
          defaultValue={SEPTEMBER}
          locale="en-US"
          onFocusChange={onFocusChange}
          showMonthYearMenus
        />,
      )

      await fireEvent.press(screen.getByRole('button', { name: 'Sep month' }))
      await fireEvent.press(screen.getByRole('radio', { name: 'December' }))

      expect(onFocusChange).toHaveBeenCalledWith(new CalendarDate(2026, 12, 15))
      expect(listOf()).toBeUndefined()
      expect(screen.getByRole('button', { name: 'Dec month' })).toBeEnabled()
      expect(calendarOf().props['aria-label']).toBe('Label, December 2026')
      expect(dateNamed('Tuesday, December 15, 2026')).toBeEnabled()
    })

    it('moves to the year chosen and closes the list', async () => {
      await render(
        <Calendar
          aria-label="Label"
          defaultValue={SEPTEMBER}
          locale="en-US"
          showMonthYearMenus
        />,
      )

      await fireEvent.press(screen.getByRole('button', { name: '2026 year' }))

      expect(listOf()?.props['aria-label']).toBe('year')
      expect(screen.getByRole('radio', { name: '2026' })).toBeChecked()
      expect(screen.getByRole('button', { name: 'Sep month' })).toBeDisabled()

      await fireEvent.press(screen.getByRole('radio', { name: '2030' }))

      expect(listOf()).toBeUndefined()
      expect(screen.getByRole('button', { name: '2030 year' })).toBeEnabled()
      expect(calendarOf().props['aria-label']).toBe('Label, September 2030')
    })

    it('closes without moving on the entry already shown, or on its button', async () => {
      const onFocusChange = jest.fn()
      await render(
        <Calendar
          defaultValue={SEPTEMBER}
          locale="en-US"
          onFocusChange={onFocusChange}
          showMonthYearMenus
        />,
      )

      await fireEvent.press(screen.getByRole('button', { name: 'Sep month' }))
      await fireEvent.press(screen.getByRole('radio', { name: 'September' }))

      expect(listOf()).toBeUndefined()

      await fireEvent.press(screen.getByRole('button', { name: 'Sep month' }))
      await fireEvent.press(screen.getByRole('button', { name: 'Sep month' }))

      expect(listOf()).toBeUndefined()
      expect(onFocusChange).not.toHaveBeenCalled()
      expect(dateNamed('Tuesday, September 15, 2026 selected')).toBeEnabled()
    })

    it('disables the months its bounds leave no day of, and lists only the years they allow', async () => {
      await render(
        <Calendar
          defaultValue={SEPTEMBER}
          locale="en-US"
          maxValue={MAX}
          minValue={MIN}
          showMonthYearMenus
        />,
      )

      await fireEvent.press(screen.getByRole('button', { name: 'Sep month' }))

      expect(screen.getByRole('radio', { name: 'September' })).toBeEnabled()
      expect(screen.getByRole('radio', { name: 'October' })).toBeDisabled()

      await fireEvent.press(screen.getByRole('radio', { name: 'October' }))

      expect(listOf()?.props['aria-label']).toBe('month')

      await fireEvent.press(screen.getByRole('radio', { name: 'September' }))
      await fireEvent.press(screen.getByRole('button', { name: '2026 year' }))

      expect(screen.getAllByRole('radio')).toHaveLength(1)
      expect(screen.getByRole('radio', { name: '2026' })).toBeChecked()
    })

    it('sends the screen reader to the entry shown, and back to its button once closed', async () => {
      // The preset's own mock, which keeps the calls of every case before.
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      send.mockClear()
      await render(
        <Calendar defaultValue={SEPTEMBER} locale="en-US" showMonthYearMenus />,
      )

      await fireEvent.press(screen.getByRole('button', { name: 'Sep month' }))

      expect(send).toHaveBeenCalledTimes(1)
      expect(send).toHaveBeenLastCalledWith(expect.anything(), 'focus')

      await fireEvent.press(screen.getByRole('radio', { name: 'December' }))

      expect(send).toHaveBeenCalledTimes(2)
      expect(send).toHaveBeenLastCalledWith(expect.anything(), 'focus')
    })

    it('turns its arrow over while its list is open', async () => {
      await render(
        <Calendar defaultValue={SEPTEMBER} locale="en-US" showMonthYearMenus />,
      )

      expect(arrowOf('Sep month').transform).toBeUndefined()

      await fireEvent.press(screen.getByRole('button', { name: 'Sep month' }))

      expect(arrowOf('Sep month').transform).toEqual([{ rotate: '180deg' }])
    })
  })

  describe('locales', () => {
    it.each([
      {
        first: 'Sunday, August 30, 2026',
        locale: 'en-US',
        number: '30',
        selected: 'Tuesday, September 15, 2026 selected',
        weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
      },
      {
        first: 'Montag, 31. August 2026',
        locale: 'de-DE',
        number: '31',
        selected: 'Dienstag, 15. September 2026 ausgewählt',
        weekdays: ['M', 'D', 'M', 'D', 'F', 'S', 'S'],
      },
      {
        first: 'السبت، ٢٩ أغسطس ٢٠٢٦',
        locale: 'ar-EG',
        number: '٢٩',
        selected: 'الثلاثاء، ١٥ سبتمبر ٢٠٢٦ المحدد',
        weekdays: ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'],
      },
      {
        first: '2026年8月30日日曜日',
        locale: 'ja-JP',
        number: '30',
        selected: '2026年9月15日火曜日 を選択',
        weekdays: ['日', '月', '火', '水', '木', '金', '土'],
      },
    ])(
      'starts the week, names its dates and draws its digits as $locale does',
      async ({ first, locale, number, selected, weekdays }) => {
        await render(<Calendar defaultValue={SEPTEMBER} locale={locale} />)

        const dates = datesOf()

        expect(weekdaysOf()).toEqual(weekdays)
        expect(nameOf(child(dates[0]))).toBe(first)
        expect(textOf(child(dates[0]))).toHaveTextContent(number)
        expect(dateNamed(selected)).toBeEnabled()
      },
    )

    it('names the month and its chevrons in the locale', async () => {
      await render(<Calendar defaultValue={SEPTEMBER} locale="ar-EG" />)

      expect(screen.getByRole('heading', { name: 'سبتمبر ٢٠٢٦' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'السابق' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'التالي' })).toBeEnabled()
    })

    it('names its menu buttons in the locale', async () => {
      await render(
        <Calendar defaultValue={SEPTEMBER} locale="de-DE" showMonthYearMenus />,
      )

      expect(screen.getByRole('button', { name: 'Sep Monat' })).toBeEnabled()
      expect(screen.getByRole('button', { name: '2026 Jahr' })).toBeEnabled()
    })

    it('starts the week on the day firstDayOfWeek names', async () => {
      await render(
        <Calendar
          defaultValue={SEPTEMBER}
          firstDayOfWeek="mon"
          locale="en-US"
        />,
      )

      expect(weekdaysOf()).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
      expect(nameOf(child(datesOf()[0]))).toBe('Monday, August 31, 2026')
    })
  })

  describe('style', () => {
    it('sits on the high surface container, 360dp across or its container’s width', async () => {
      await render(
        <Calendar
          defaultValue={SEPTEMBER}
          locale="en-US"
          style={CALL_SITE}
          testID="calendar"
        />,
      )

      expect(styleOf(screen.getByTestId('calendar'))).toMatchObject({
        backgroundColor: colors.surfaceContainerHigh,
        borderRadius: radii.lg,
        gap: spacing.md,
        marginTop: 4,
        maxWidth: '100%',
        padding: spacing.md,
        width: 360,
      })
    })

    it('hands its ref the container', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        <Calendar
          defaultValue={SEPTEMBER}
          locale="en-US"
          ref={ref}
          testID="calendar"
        />,
      )

      expect(ref.current).not.toBeNull()
    })

    it('draws a date as a 40dp circle reaching a 48dp target, its number in body large', async () => {
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      const date = dateNamed('Wednesday, September 16, 2026')

      expect(styleOf(date)).toMatchObject({
        borderRadius: radii.circle,
        height: 40,
        marginVertical: 4,
        width: 40,
      })
      expect(styleOf(date).backgroundColor).toBeUndefined()
      expect(date).toHaveProp('hitSlop', {
        bottom: 4,
        left: 4,
        right: 4,
        top: 4,
      })
      expect(textStyleOf(textOf(date))).toMatchObject({
        color: colors.onSurface,
        fontSize: typography.bodyLargeSize,
      })
    })

    it('clips a date’s state layer to its circle, which the date’s room does not move', async () => {
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      const surface = styleOf(
        child(dateNamed('Wednesday, September 16, 2026').children.at(0)),
      )

      expect(surface.borderRadius).toBe(radii.circle)
      expect(surface).not.toHaveProperty('marginVertical')
      expect(surface).not.toHaveProperty('height')
    })

    it('fills the date it holds in primary, its number in on primary', async () => {
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      const date = dateNamed('Tuesday, September 15, 2026 selected')

      expect(styleOf(date).backgroundColor).toBe(colors.primary)
      expect(textStyleOf(textOf(date)).color).toBe(colors.onPrimary)
    })

    it('outlines today in primary, and fills it once it is held', async () => {
      jest.setSystemTime(new Date(2026, 8, 10, 12))
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      const today = dateNamed('Today, Thursday, September 10, 2026')

      expect(styleOf(today)).toMatchObject({
        borderColor: colors.primary,
        borderWidth: 1,
      })
      expect(styleOf(today).backgroundColor).toBeUndefined()
      expect(textStyleOf(textOf(today)).color).toBe(colors.primary)

      await fireEvent.press(today)
      const held = dateNamed('Today, Thursday, September 10, 2026 selected')

      expect(styleOf(held).backgroundColor).toBe(colors.primary)
      expect(textStyleOf(textOf(held)).color).toBe(colors.onPrimary)
    })

    it('fades a disabled date to 38% and strikes an unavailable one through', async () => {
      await render(
        <Calendar
          defaultValue={SEPTEMBER}
          isDateUnavailable={isWeekend}
          locale="en-US"
          minValue={MIN}
        />,
      )

      const outside = textStyleOf(
        textOf(dateNamed('Monday, September 7, 2026')),
      )
      const other = textStyleOf(textOf(dateNamed('Sunday, August 30, 2026')))
      const unavailable = textStyleOf(
        textOf(dateNamed('Saturday, September 12, 2026')),
      )

      expect(outside.color).toBe(DISABLED_CONTENT)
      expect(outside.textDecorationLine).toBeUndefined()
      expect(other.color).toBe(DISABLED_CONTENT)
      expect(unavailable).toMatchObject({
        color: colors.onSurface,
        textDecorationLine: 'line-through',
      })
    })

    it('turns the previous chevron around', async () => {
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      expect(chevronOf('Previous').transform).toEqual([{ scaleX: -1 }])
      expect(chevronOf('Next').transform).toBeUndefined()
    })

    it('turns both over under a right-to-left layout', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(<Calendar defaultValue={SEPTEMBER} locale="en-US" />)

      expect(chevronOf('Previous').transform).toEqual([{ scaleX: 1 }])
      expect(chevronOf('Next').transform).toEqual([{ scaleX: -1 }])
    })

    it('draws the menu buttons as 40dp pills in label large on surface variant', async () => {
      await render(
        <Calendar defaultValue={SEPTEMBER} locale="en-US" showMonthYearMenus />,
      )

      const month = screen.getByRole('button', { name: 'Sep month' })

      expect(styleOf(month)).toMatchObject({
        borderRadius: radii.pill,
        height: 40,
      })
      expect(month).toHaveProp('hitSlop', {
        bottom: 4,
        left: 0,
        right: 0,
        top: 4,
      })
      expect(textStyleOf(textOf(month))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.labelLargeSize,
      })
    })

    it('fills the open list’s checked row in surface variant', async () => {
      await render(
        <Calendar defaultValue={SEPTEMBER} locale="en-US" showMonthYearMenus />,
      )

      await fireEvent.press(screen.getByRole('button', { name: 'Sep month' }))

      expect(
        styleOf(screen.getByRole('radio', { name: 'September' })),
      ).toMatchObject({ backgroundColor: colors.surfaceVariant, height: 48 })
      expect(
        styleOf(screen.getByRole('radio', { name: 'October' })).backgroundColor,
      ).toBeUndefined()
    })
  })
})
