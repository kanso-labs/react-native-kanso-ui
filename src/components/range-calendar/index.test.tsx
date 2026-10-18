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
import { fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { Dimensions, I18nManager, StyleSheet, View } from 'react-native'

import { RangeCalendar } from '.'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'
import { breakpoints } from '../../tokens/defaults'

const { theme } = scopeFor('light', {})
const { colors, radii, spacing, stateLayerOpacity } = theme

const DISABLED_CONTENT = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContent,
)

// The range most cases hold, a week of September 2026, and a range running
// across the month's end into October.
const RANGE = {
  end: new CalendarDate(2026, 9, 15),
  start: new CalendarDate(2026, 9, 8),
}
const ACROSS = {
  end: new CalendarDate(2026, 10, 6),
  start: new CalendarDate(2026, 9, 24),
}

// A range of one day, which is both its ends.
const ONE_DAY = {
  end: new CalendarDate(2026, 9, 10),
  start: new CalendarDate(2026, 9, 10),
}

// A duration under a month, which shows one.
const NO_MONTHS = { months: 0 }

const TWO_MONTHS = { months: 2 }

const CALL_SITE = StyleSheet.create({ calendar: { marginTop: 4 } }).calendar

// The day the clock reads, after both months, so no case holds an outline it
// did not ask for.
const NOW = new Date(2026, 10, 20, 12)

type Range = { readonly end: DateValue; readonly start: DateValue }

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

// What the name of either end of RANGE opens with.
const SAID_RANGE =
  'Selected Range: Tuesday, September 8 to Tuesday, September 15, 2026'

// The calendar, which is the element rendered.
function calendarOf() {
  const root = screen.root
  if (root?.props.role !== 'group') {
    throw new TypeError('expected the calendar')
  }
  return root
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

// What a screen reader hints a date's press does.
function hintOf(element: TestInstance) {
  const hint: unknown = element.props.accessibilityHint
  return typeof hint === 'string' ? hint : undefined
}

function isWeekend(date: DateValue) {
  const day = getDayOfWeek(date, 'en-US')
  return day === 0 || day === 6
}

// The state layer a date draws, under the view that clips it to the date.
function layerOf(date: TestInstance) {
  return child(surfaceOf(date).children.at(0))
}

// The grids' row or column, the view the header sits beside.
function monthsOf() {
  return child(calendarOf().children.at(1))
}

function resize(width: number) {
  Dimensions.set({ ...INITIAL, window: { ...INITIAL.window, width } })
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

// The view that clips a date's state layer to the date's corners.
function surfaceOf(date: TestInstance) {
  return child(date.children.at(0))
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

beforeEach(() => {
  jest.useFakeTimers({ now: NOW })
})

afterEach(() => {
  Dimensions.set(INITIAL)
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('RangeCalendar', () => {
  describe('semantics', () => {
    it('is a group named by its label and the month it shows', async () => {
      await render(
        <RangeCalendar
          aria-label="Label"
          defaultValue={RANGE}
          locale="en-US"
        />,
      )

      expect(calendarOf().props['aria-label']).toBe('Label, September 2026')
      expect(screen.getByRole('heading')).toHaveTextContent('September 2026')
    })

    it('is named by the month alone without a label', async () => {
      await render(<RangeCalendar defaultValue={RANGE} locale="en-US" />)

      expect(calendarOf().props['aria-label']).toBe('September 2026')
    })

    it('opens each end’s name with the whole range', async () => {
      await render(<RangeCalendar defaultValue={RANGE} locale="en-US" />)

      expect(
        dateNamed(`${SAID_RANGE}, Tuesday, September 8, 2026 selected`),
      ).toBeOnTheScreen()
      expect(
        dateNamed(`${SAID_RANGE}, Tuesday, September 15, 2026 selected`),
      ).toBeOnTheScreen()
    })

    it('names a day inside the range as selected, and one outside it plainly', async () => {
      await render(<RangeCalendar defaultValue={RANGE} locale="en-US" />)

      expect(dateNamed('Friday, September 11, 2026 selected')).toBeOnTheScreen()
      expect(dateNamed('Wednesday, September 16, 2026')).toBeOnTheScreen()
    })

    it('says a one-day range as that day', async () => {
      await render(<RangeCalendar defaultValue={ONE_DAY} locale="en-US" />)

      expect(
        dateNamed(
          'Selected Date: Thursday, September 10, 2026, Thursday, September 10, 2026 selected',
        ),
      ).toBeOnTheScreen()
    })

    it('hints that a press starts a range, and once started that one ends it', async () => {
      await render(<RangeCalendar defaultValue={RANGE} locale="en-US" />)

      expect(hintOf(dateNamed('Monday, September 21, 2026'))).toBe(
        'Click to start selecting date range',
      )

      await fireEvent.press(dateNamed('Monday, September 21, 2026'))

      expect(hintOf(dateNamed('Tuesday, September 22, 2026'))).toBe(
        'Click to finish selecting date range',
      )
    })

    it('hints nothing where a press does nothing', async () => {
      await render(
        <RangeCalendar
          defaultValue={RANGE}
          isDateUnavailable={isWeekend}
          locale="en-US"
          minValue={new CalendarDate(2026, 9, 5)}
        />,
      )

      expect(hintOf(dateNamed('Friday, September 4, 2026'))).toBeUndefined()
      expect(hintOf(dateNamed('Sunday, September 20, 2026'))).toBeUndefined()
    })

    it('hints nothing while read-only', async () => {
      await render(
        <RangeCalendar defaultValue={RANGE} isReadOnly locale="en-US" />,
      )

      expect(hintOf(dateNamed('Monday, September 21, 2026'))).toBeUndefined()
    })
  })

  describe('picking a range', () => {
    it('starts a range on one press and ends it on the next, reporting it', async () => {
      const onChange = jest.fn<(value: Range) => void>()
      await render(
        <RangeCalendar
          defaultValue={RANGE}
          locale="en-US"
          onChange={onChange}
        />,
      )

      await fireEvent.press(dateNamed('Monday, September 21, 2026'))

      expect(onChange).not.toHaveBeenCalled()

      await fireEvent.press(dateNamed('Friday, September 25, 2026'))

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange.mock.calls[0]?.[0]).toEqual({
        end: new CalendarDate(2026, 9, 25),
        start: new CalendarDate(2026, 9, 21),
      })
      expect(
        dateNamed('Wednesday, September 23, 2026 selected'),
      ).toBeOnTheScreen()
    })

    it('puts the earlier of the two dates first, whichever came first', async () => {
      const onChange = jest.fn<(value: Range) => void>()
      await render(<RangeCalendar locale="en-US" onChange={onChange} />)

      await fireEvent.press(dateNamed('Friday, November 27, 2026'))
      await fireEvent.press(dateNamed('Monday, November 23, 2026'))

      expect(onChange.mock.calls[0]?.[0]).toEqual({
        end: new CalendarDate(2026, 11, 27),
        start: new CalendarDate(2026, 11, 23),
      })
    })

    it('holds only the first date while a range is started', async () => {
      await render(<RangeCalendar defaultValue={RANGE} locale="en-US" />)

      await fireEvent.press(dateNamed('Monday, September 21, 2026'))

      expect(dateNamed('Monday, September 21, 2026 selected')).toBeOnTheScreen()
      expect(dateNamed('Friday, September 11, 2026')).toBeOnTheScreen()
      // The range it held until the press still names nothing.
      expect(dateNamed('Tuesday, September 8, 2026')).toBeOnTheScreen()
      expect(dateNamed('Tuesday, September 15, 2026')).toBeOnTheScreen()
    })

    it('draws a started range as far as the date a pointer is over', async () => {
      await render(<RangeCalendar defaultValue={RANGE} locale="en-US" />)

      await fireEvent.press(dateNamed('Monday, September 21, 2026'))
      await fireEvent(dateNamed('Thursday, September 24, 2026'), 'hoverIn', {})

      expect(
        dateNamed('Wednesday, September 23, 2026 selected'),
      ).toBeOnTheScreen()
      expect(
        styleOf(dateNamed('Thursday, September 24, 2026 selected'))
          .backgroundColor,
      ).toBe(colors.primary)
    })

    it('draws nothing under a pointer before a range is started', async () => {
      await render(<RangeCalendar defaultValue={RANGE} locale="en-US" />)

      await fireEvent(dateNamed('Thursday, September 24, 2026'), 'hoverIn', {})

      expect(dateNamed('Thursday, September 24, 2026')).toBeOnTheScreen()
    })

    it('holds a controlled value until the call site moves it', async () => {
      const onChange = jest.fn()
      await render(
        <RangeCalendar locale="en-US" onChange={onChange} value={RANGE} />,
      )

      await fireEvent.press(dateNamed('Monday, September 21, 2026'))
      await fireEvent.press(dateNamed('Friday, September 25, 2026'))

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(
        dateNamed(`${SAID_RANGE}, Tuesday, September 8, 2026 selected`),
      ).toBeOnTheScreen()
    })

    it('takes no press while read-only', async () => {
      const onChange = jest.fn()
      await render(
        <RangeCalendar
          defaultValue={RANGE}
          isReadOnly
          locale="en-US"
          onChange={onChange}
        />,
      )

      await fireEvent.press(dateNamed('Monday, September 21, 2026'))
      await fireEvent.press(dateNamed('Friday, September 25, 2026'))

      expect(onChange).not.toHaveBeenCalled()
    })

    it('disables every date while disabled', async () => {
      await render(
        <RangeCalendar defaultValue={RANGE} isDisabled locale="en-US" />,
      )

      expect(dateNamed('Monday, September 21, 2026')).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    })
  })

  describe('bounds', () => {
    it('disables the dates outside its bounds', async () => {
      await render(
        <RangeCalendar
          defaultValue={RANGE}
          locale="en-US"
          maxValue={new CalendarDate(2026, 9, 24)}
          minValue={new CalendarDate(2026, 9, 5)}
        />,
      )

      expect(dateNamed('Friday, September 4, 2026')).toBeDisabled()
      expect(dateNamed('Friday, September 25, 2026')).toBeDisabled()
      expect(
        dateNamed('Thursday, September 24, 2026, Last available date'),
      ).toBeEnabled()
    })

    it('strikes an unavailable day through and lets no range run over it, naming the dates either side the first and last available', async () => {
      await render(
        <RangeCalendar
          defaultValue={RANGE}
          isDateUnavailable={isWeekend}
          locale="en-US"
        />,
      )

      expect(
        textStyleOf(textOf(dateNamed('Saturday, September 19, 2026'))),
      ).toMatchObject({
        color: colors.onSurface,
        textDecorationLine: 'line-through',
      })

      await fireEvent.press(dateNamed('Tuesday, September 22, 2026'))

      expect(
        dateNamed('Monday, September 21, 2026, First available date'),
      ).toBeEnabled()
      expect(
        dateNamed('Friday, September 25, 2026, Last available date'),
      ).toBeEnabled()
      expect(dateNamed('Monday, September 28, 2026')).toBeDisabled()
      expect(dateNamed('Friday, September 18, 2026')).toBeDisabled()
    })

    it('lets a range run over an unavailable day with allowsNonContiguousRanges, leaving that day out of the band', async () => {
      const onChange = jest.fn<(value: Range) => void>()
      await render(
        <RangeCalendar
          allowsNonContiguousRanges
          isDateUnavailable={isWeekend}
          locale="en-US"
          onChange={onChange}
        />,
      )

      await fireEvent.press(dateNamed('Thursday, November 12, 2026'))
      await fireEvent.press(dateNamed('Tuesday, November 17, 2026'))

      expect(onChange.mock.calls[0]?.[0]).toEqual({
        end: new CalendarDate(2026, 11, 17),
        start: new CalendarDate(2026, 11, 12),
      })
      expect(dateNamed('Monday, November 16, 2026 selected')).toBeOnTheScreen()

      const weekend = dateNamed('Saturday, November 14, 2026')

      expect(styleOf(weekend).backgroundColor).toBeUndefined()
      expect(textStyleOf(textOf(weekend)).textDecorationLine).toBe(
        'line-through',
      )
    })
  })

  describe('the header and the weekdays', () => {
    it('draws the month and the year as menu buttons with showMonthYearMenus', async () => {
      await render(
        <RangeCalendar
          defaultValue={RANGE}
          locale="en-US"
          showMonthYearMenus
        />,
      )

      expect(screen.getByRole('button', { name: 'Sep month' })).toBeEnabled()
      expect(screen.getByRole('button', { name: '2026 year' })).toBeEnabled()
      expect(screen.queryByRole('heading')).toBe(null)
    })

    it('starts its week on the day firstDayOfWeek names', async () => {
      await render(
        <RangeCalendar
          defaultValue={RANGE}
          firstDayOfWeek="mon"
          locale="en-US"
        />,
      )

      expect(weekdaysOf()).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
    })
  })

  describe('two months', () => {
    it('names both months, as a heading and in its name', async () => {
      await render(
        <RangeCalendar
          aria-label="Label"
          defaultValue={ACROSS}
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
    })

    it('shows one month for a duration under one', async () => {
      await render(
        <RangeCalendar
          aria-label="Label"
          defaultValue={RANGE}
          locale="en-US"
          visibleDuration={NO_MONTHS}
        />,
      )

      expect(calendarOf().props['aria-label']).toBe('Label, September 2026')
      expect(screen.getByRole('heading')).toHaveTextContent('September 2026')
    })

    it('draws a grid for each, a range running from one into the other', async () => {
      await render(
        <RangeCalendar
          defaultValue={ACROSS}
          locale="en-US"
          visibleDuration={TWO_MONTHS}
        />,
      )

      expect(
        dateNamed('Wednesday, September 30, 2026 selected'),
      ).toBeOnTheScreen()
      expect(dateNamed('Friday, October 2, 2026 selected')).toBeOnTheScreen()
    })

    it('disables a date its grid shows from the next month, which the next grid holds', async () => {
      await render(
        <RangeCalendar
          defaultValue={ACROSS}
          locale="en-US"
          visibleDuration={TWO_MONTHS}
        />,
      )

      // In the range, so October's grid names it selected, and September's
      // does not, since a disabled date is never selected.
      expect(dateNamed('Saturday, October 3, 2026')).toBeDisabled()
      expect(dateNamed('Saturday, October 3, 2026 selected')).toBeEnabled()
    })

    it('moves both months at once', async () => {
      await render(
        <RangeCalendar
          defaultValue={ACROSS}
          locale="en-US"
          visibleDuration={TWO_MONTHS}
        />,
      )

      await fireEvent.press(screen.getByRole('button', { name: 'Next' }))

      expect(screen.getByRole('heading')).toHaveTextContent(
        'November – December 2026',
      )
    })

    it('draws the plain header whatever showMonthYearMenus says', async () => {
      await render(
        <RangeCalendar
          defaultValue={ACROSS}
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

    it('stacks them below the expanded window size, at the page’s width', async () => {
      resize(breakpoints.expanded - 1)
      await render(
        <RangeCalendar
          defaultValue={ACROSS}
          locale="en-US"
          testID="calendar"
          visibleDuration={TWO_MONTHS}
        />,
      )

      expect(styleOf(screen.getByTestId('calendar')).width).toBe(360)
      expect(styleOf(monthsOf())).toEqual({ gap: spacing.xl })
    })

    it('sets them side by side from the expanded window size, widening to hold them', async () => {
      resize(breakpoints.expanded)
      await render(
        <RangeCalendar
          defaultValue={ACROSS}
          locale="en-US"
          testID="calendar"
          visibleDuration={TWO_MONTHS}
        />,
      )

      expect(styleOf(screen.getByTestId('calendar')).width).toBe(
        48 * 7 * 2 + spacing.xl + spacing.md * 2,
      )
      expect(styleOf(monthsOf())).toEqual({
        flexDirection: 'row',
        gap: spacing.xl,
      })
      expect(
        monthsOf().children.map((month) => styleOf(child(month)).width),
      ).toEqual([48 * 7, 48 * 7])
    })

    it('keeps one month at the page’s width in an expanded window', async () => {
      resize(breakpoints.expanded)
      await render(
        <RangeCalendar defaultValue={RANGE} locale="en-US" testID="calendar" />,
      )

      expect(styleOf(screen.getByTestId('calendar')).width).toBe(360)
    })
  })

  describe('style', () => {
    it('lays the band across the days between the ends, in secondary container', async () => {
      await render(<RangeCalendar defaultValue={RANGE} locale="en-US" />)

      const inside = dateNamed('Friday, September 11, 2026 selected')

      expect(styleOf(inside)).toMatchObject({
        backgroundColor: colors.secondaryContainer,
        borderRadius: 0,
        height: 40,
        width: '100%',
      })
      expect(styleOf(inside)).not.toHaveProperty('borderTopStartRadius')
      expect(styleOf(inside)).not.toHaveProperty('borderTopEndRadius')
      expect(textStyleOf(textOf(inside)).color).toBe(
        colors.onSecondaryContainer,
      )
      expect(inside).toHaveProp('hitSlop', {
        bottom: 4,
        left: 0,
        right: 0,
        top: 4,
      })
    })

    it('fills the two ends in primary, each round on its outer side', async () => {
      await render(<RangeCalendar defaultValue={RANGE} locale="en-US" />)

      const first = dateNamed(
        `${SAID_RANGE}, Tuesday, September 8, 2026 selected`,
      )
      const last = dateNamed(
        `${SAID_RANGE}, Tuesday, September 15, 2026 selected`,
      )

      expect(styleOf(first)).toMatchObject({
        backgroundColor: colors.primary,
        borderBottomStartRadius: radii.circle,
        borderRadius: 0,
        borderTopStartRadius: radii.circle,
        width: '100%',
      })
      expect(styleOf(first)).not.toHaveProperty('borderTopEndRadius')
      expect(styleOf(last)).toMatchObject({
        backgroundColor: colors.primary,
        borderBottomEndRadius: radii.circle,
        borderTopEndRadius: radii.circle,
      })
      expect(styleOf(last)).not.toHaveProperty('borderTopStartRadius')
      expect(textStyleOf(textOf(first)).color).toBe(colors.onPrimary)
      expect(textStyleOf(textOf(last)).color).toBe(colors.onPrimary)
    })

    it('rounds both sides of a one-day range', async () => {
      await render(<RangeCalendar defaultValue={ONE_DAY} locale="en-US" />)

      const only = dateNamed(
        'Selected Date: Thursday, September 10, 2026, Thursday, September 10, 2026 selected',
      )

      expect(styleOf(only)).toMatchObject({
        borderBottomEndRadius: radii.circle,
        borderBottomStartRadius: radii.circle,
        borderTopEndRadius: radii.circle,
        borderTopStartRadius: radii.circle,
      })
    })

    it('rounds the ends by their logical sides, which a right-to-left layout turns over', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(<RangeCalendar defaultValue={RANGE} locale="en-US" />)

      const first = styleOf(
        dateNamed(`${SAID_RANGE}, Tuesday, September 8, 2026 selected`),
      )

      expect(first.borderTopStartRadius).toBe(radii.circle)
      expect(first).not.toHaveProperty('borderTopLeftRadius')
      expect(first).not.toHaveProperty('borderTopRightRadius')
    })

    it('draws a day outside the range as Calendar draws a date', async () => {
      await render(<RangeCalendar defaultValue={RANGE} locale="en-US" />)

      const outside = dateNamed('Wednesday, September 16, 2026')

      expect(styleOf(outside)).toMatchObject({
        borderRadius: radii.circle,
        width: 40,
      })
      expect(styleOf(outside).backgroundColor).toBeUndefined()
      expect(textStyleOf(textOf(outside)).color).toBe(colors.onSurface)
    })

    it('fades the days its grid shows from the months either side', async () => {
      await render(<RangeCalendar defaultValue={RANGE} locale="en-US" />)

      expect(
        textStyleOf(textOf(dateNamed('Thursday, October 1, 2026'))).color,
      ).toBe(DISABLED_CONTENT)
    })

    it('draws each state layer for the ground under it, clipped to the date’s corners', async () => {
      await render(<RangeCalendar defaultValue={RANGE} locale="en-US" />)

      const first = dateNamed(
        `${SAID_RANGE}, Tuesday, September 8, 2026 selected`,
      )
      const inside = dateNamed('Friday, September 11, 2026 selected')
      const outside = dateNamed('Wednesday, September 16, 2026')

      expect(styleOf(layerOf(first)).backgroundColor).toBe(colors.onPrimary)
      expect(styleOf(layerOf(inside)).backgroundColor).toBe(
        colors.onPrimaryContainer,
      )
      expect(styleOf(layerOf(outside)).backgroundColor).toBe(colors.onSurface)
      expect(styleOf(surfaceOf(first))).toMatchObject({
        borderBottomStartRadius: radii.circle,
        borderRadius: 0,
        borderTopStartRadius: radii.circle,
      })
      expect(styleOf(surfaceOf(first))).not.toHaveProperty('width')
      expect(styleOf(surfaceOf(outside))).not.toHaveProperty('marginVertical')
    })

    it('sits on the high surface container, and hands its ref the container', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        <RangeCalendar
          defaultValue={RANGE}
          locale="en-US"
          ref={ref}
          style={CALL_SITE}
          testID="calendar"
        />,
      )

      expect(styleOf(screen.getByTestId('calendar'))).toMatchObject({
        backgroundColor: colors.surfaceContainerHigh,
        marginTop: 4,
        width: 360,
      })
      expect(ref.current).not.toBeNull()
    })
  })

  describe('locales', () => {
    it('words the range in the locale', async () => {
      await render(<RangeCalendar defaultValue={RANGE} locale="de-DE" />)

      expect(
        screen
          .getAllByRole('button')
          .some((button) =>
            String(button.props.accessibilityLabel).startsWith(
              'Ausgewählter Bereich:',
            ),
          ),
      ).toBe(true)
    })
  })
})
