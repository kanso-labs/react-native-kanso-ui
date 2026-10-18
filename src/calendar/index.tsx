import type { CalendarDate } from '@internationalized/date'
import type { ComponentRef, ReactNode, RefObject } from 'react'
import type {
  HostInstance,
  ListRenderItemInfo,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
import type { CalendarState } from 'react-stately/useCalendarState'
import type { RangeCalendarState } from 'react-stately/useRangeCalendarState'

import {
  DateFormatter,
  endOfMonth,
  isSameDay,
  isSameMonth,
  isSameYear,
  isToday,
  startOfMonth,
  startOfWeek,
  toCalendarDate,
  today,
} from '@internationalized/date'
import { useLayoutEffect, useRef, useState } from 'react'
import {
  FlatList,
  I18nManager,
  Text as NativeText,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import type { ResolvedTheme } from '../theme/scope'

import { IconButton } from '../components/icon-button'
import { ArrowDropDownGlyph, CheckGlyph, ChevronEndGlyph } from '../glyphs'
import { useWindowSizeClass } from '../hooks/useWindowSizeClass'
import { messagesFor } from '../i18n'
import { useFocusOnPlaced, useReturnFocus } from '../overlay/panel'
import { hitSlop, usePressFeedback } from '../press'
import { withOpacity } from '../theme/color'
import { useTheme } from '../theme/scope'
import { composeStyles } from '../theme/styles'
import { useTypeRole } from '../typography/roles'
import {
  rootWidthOf,
  SLIDE_DISTANCE,
  styles,
  stylesOf,
  WEEKS_HELD,
} from './styles'

// The parts Calendar and RangeCalendar both draw inside their container: the
// row that moves the month, the weekday row, the weeks and the date cell, and
// the month and year lists that take the grid's place. Apart from either
// component so the two cannot drift, and so each directory under
// src/components holds one component, as kanso-ui keeps its own in
// src/calendar.

/** One entry of a month or year list. */
type ListEntry = {
  readonly date: CalendarDate
  readonly formatted: string
  readonly id: number
}

/** A month's distance from the first one a calendar shows. */
type MonthOffset = { readonly months: number }

type OpenList = 'month' | 'year'

type PartProps = {
  readonly locale: string
  readonly state: SomeCalendarState
}

/** The state of either calendar, one date's or a range's. */
type SomeCalendarState = CalendarState | RangeCalendarState

/** The day a locale's week starts on, where the call site names one. */
type Weekday = 'fri' | 'mon' | 'sat' | 'sun' | 'thu' | 'tue' | 'wed'

// How many years the open year list holds: a century either side of the year
// shown, and that year, as kanso-ui's does. The bounds cut it short where they
// fall inside.
const LISTED_YEARS = 201

// An open list holds the weekday row and six weeks of room, seven rows, and
// opens with the entry shown in the middle one, three rows from the top.
const ROWS_ABOVE_SHOWN = WEEKS_HELD / 2

/**
 * What a calendar draws inside its container: the header, and a grid for each
 * month it shows. With `showMonthYearMenus` the header is the date pickers
 * page's docked one, the month and the year as menu buttons, and while either
 * is open its list takes the grid's place.
 *
 * The menus are for one month. They name and pick the first month alone, so
 * a second grid beside it would have no month or year of its own; with more
 * than one the header is the plain one, whose heading names every month
 * shown, both years where they are two, as web's does.
 */
function CalendarFrame({
  firstDayOfWeek,
  locale,
  months,
  showMonthYearMenus,
  state,
}: PartProps & {
  readonly firstDayOfWeek: undefined | Weekday
  /** How many months the calendar shows. */
  readonly months: number
  readonly showMonthYearMenus: boolean
}) {
  const own = stylesOf(useTheme())
  const sideBySide = useSideBySide(months)
  const grids = (
    <View style={sideBySide ? own.monthsSideBySide : own.months}>
      {offsetsOf(months).map((offset) => (
        <View
          key={offset.months}
          style={sideBySide ? own.monthSideBySide : undefined}
        >
          <MonthGrid
            firstDayOfWeek={firstDayOfWeek}
            locale={locale}
            offset={offset}
            state={state}
          />
        </View>
      ))}
    </View>
  )

  if (showMonthYearMenus && months <= 1) {
    return (
      <CalendarMenus locale={locale} state={state}>
        {grids}
      </CalendarMenus>
    )
  }

  return (
    <>
      <CalendarHeader locale={locale} state={state} />
      {grids}
    </>
  )
}

/** The two chevrons with the month and year between them. */
function CalendarHeader({ locale, state }: PartProps) {
  const own = stylesOf(useTheme())
  const role = useTypeRole('labelLarge')

  return (
    <View style={own.header}>
      <Chevron direction="previous" locale={locale} state={state} />
      <NativeText
        aria-live="polite"
        role="heading"
        style={composeStyles<TextStyle>(role, own.heading)}
      >
        {visibleRangeOf(state, locale)}
      </NativeText>
      <Chevron direction="next" locale={locale} state={state} />
    </View>
  )
}

/**
 * The docked header: the month's menu button between the chevrons that step
 * it, and the year's after them. A press opens the button's list in the
 * grid's place, where the page draws it, rather than in a menu over it; a
 * calendar inside a picker is already in one. While a list is open the
 * chevrons give way to the room they took and the other button is disabled,
 * and choosing an entry, or pressing the one already checked, closes the
 * list and sends the screen reader back to its button.
 *
 * The month list names the months in full where the button names the month
 * short, as the page does. The year list runs a century either side of the
 * year shown, and `minValue` and `maxValue` cut it short; a month with no day
 * inside them is disabled.
 */
function CalendarMenus({
  children,
  locale,
  state,
}: PartProps & { readonly children: ReactNode }) {
  const own = stylesOf(useTheme())
  const words = messagesFor(locale).calendar
  const [open, setOpen] = useState<null | OpenList>(null)
  const monthButton = useRef<ComponentRef<typeof View>>(null)
  const yearButton = useRef<ComponentRef<typeof View>>(null)
  const shownMonth = state.focusedDate.month - 1

  useReturnFocus(open === 'month', false, monthButton)
  useReturnFocus(open === 'year', false, yearButton)

  return (
    <>
      <View style={own.header}>
        <View style={own.headerGroup}>
          {open === null ? (
            <Chevron direction="previous" locale={locale} state={state} />
          ) : (
            <View style={own.chevronRoom} />
          )}
          <MenuButton
            buttonRef={monthButton}
            expanded={open === 'month'}
            isDisabled={state.isDisabled || open === 'year'}
            label={monthsOf(state, locale, 'short')[shownMonth]?.formatted}
            name={words.month}
            onPress={toggleThen(setOpen, 'month')}
          />
          {open === null ? (
            <Chevron direction="next" locale={locale} state={state} />
          ) : (
            <View style={own.chevronRoom} />
          )}
        </View>
        <MenuButton
          buttonRef={yearButton}
          expanded={open === 'year'}
          isDisabled={state.isDisabled || open === 'month'}
          label={yearOf(state, locale)}
          name={words.year}
          onPress={toggleThen(setOpen, 'year')}
        />
      </View>
      {open === null ? children : null}
      {open === 'month' ? (
        <MonthList locale={locale} setOpen={setOpen} state={state} />
      ) : null}
      {open === 'year' ? (
        <YearList locale={locale} setOpen={setOpen} state={state} />
      ) : null}
    </>
  )
}

/**
 * A chevron that moves the month, the icon buttons page's standard 40dp
 * button. Disabled where the month it would move to is outside `minValue`
 * and `maxValue`, or the whole calendar is disabled.
 */
function Chevron({
  direction,
  locale,
  state,
}: PartProps & { readonly direction: 'next' | 'previous' }) {
  const own = stylesOf(useTheme())
  const previous = direction === 'previous'
  const outside = previous
    ? state.isPreviousVisibleRangeInvalid()
    : state.isNextVisibleRangeInvalid()

  return (
    <IconButton
      aria-label={messagesFor(locale).calendar[direction]}
      isDisabled={state.isDisabled || outside}
      onPress={pageThen(state, direction)}
      style={own.chevron}
    >
      <ChevronEndGlyph style={previous ? previousGlyphStyle() : undefined} />
    </IconButton>
  )
}

// Chooses an entry of the open list and closes it. The entry already shown
// closes it without moving anything.
function chooseThen(
  state: SomeCalendarState,
  setOpen: (open: null | OpenList) => void,
  shown: number,
) {
  return (entry: ListEntry) => {
    if (entry.id !== shown) {
      state.setFocusedDate(entry.date)
    }
    setOpen(null)
  }
}

// The corners of a date's shape, which its state layer and ripple clip to.
// The corners alone: the shape's size and margins are the date's, and on the
// layer, which fills the date, the margins would move it off the circle.
function cornersOf(shape: StyleProp<ViewStyle>) {
  const {
    borderBottomEndRadius,
    borderBottomStartRadius,
    borderRadius,
    borderTopEndRadius,
    borderTopStartRadius,
  }: ViewStyle = StyleSheet.flatten(shape) ?? {}

  return {
    borderBottomEndRadius,
    borderBottomStartRadius,
    borderRadius,
    borderTopEndRadius,
    borderTopStartRadius,
  }
}

/**
 * One date: the page's 40dp circle in its 48dp square, which `hitSlop` makes
 * the press target. Its name is the date in full, with today, the selection
 * and the first or last date the bounds allow said as web says them, and it
 * reports itself disabled where it cannot be picked, as a date of the months
 * either side of its grid's is.
 *
 * In a range calendar a selected day is the band instead, as wide as its
 * column, with the two ends filled and round on their outer side, and the
 * state layers follow the ground under them: on primary over an end, on
 * primary container over the band, on surface elsewhere. While a range is
 * started, a pointer over a date draws the range as far as it, as web's
 * does; a touch has no such preview, and the second press ends the range.
 */
function DateCell({
  date,
  locale,
  month,
  state,
}: PartProps & {
  readonly date: CalendarDate
  /** The first day of the month the date's grid shows. */
  readonly month: CalendarDate
}) {
  const theme = useTheme()
  const { colors, sizing } = theme
  const own = stylesOf(theme)
  const role = useTypeRole('bodyLarge')
  const isDisabled = state.isCellDisabled(date) || !isSameMonth(date, month)
  const isUnavailable = state.isCellUnavailable(date)
  const selectable = !isDisabled && !isUnavailable
  const isSelected = selectable && state.isSelected(date)
  const isCurrent = isToday(date, state.timeZone)
  const range = rangeOf(state, date, isSelected)
  const isFilled = range === null ? isSelected : range.isEnd
  const shape = composeStyles<ViewStyle>(
    own.date,
    range === null ? undefined : own.dateInRange,
    range?.isFirst === true ? own.dateRangeStart : undefined,
    range?.isLast === true ? own.dateRangeEnd : undefined,
  )
  const feedback = usePressFeedback({
    color: isFilled
      ? colors.onPrimary
      : range === null
        ? colors.onSurface
        : colors.onPrimaryContainer,
    corners: cornersOf(shape),
    disabled: !selectable,
    onHoverIn: highlightThen(state, date),
  })

  return (
    <Pressable
      accessibilityHint={promptOf(state, locale, selectable)}
      aria-label={dateLabelOf(date, state, locale, isCurrent, isSelected)}
      hitSlop={hitSlop(
        sizing.controlSm,
        range === null ? sizing.controlSm : undefined,
      )}
      onPress={selectThen(state, date)}
      role="button"
      {...feedback.handlers}
      disabled={!selectable}
      style={composeStyles<ViewStyle>(
        shape,
        isCurrent ? own.dateToday : undefined,
        isFilled ? own.dateSelected : undefined,
        feedback.ring,
      )}
    >
      {feedback.layer}
      <NativeText
        style={composeStyles<TextStyle>(
          role,
          own.dateText,
          isCurrent ? own.dateTextToday : undefined,
          range === null ? undefined : own.dateTextInRange,
          isFilled ? own.dateTextSelected : undefined,
          isUnavailable ? own.dateTextUnavailable : undefined,
          isDisabled ? own.dateTextDisabled : undefined,
        )}
      >
        {dayOf(date, state, locale)}
      </NativeText>
    </Pressable>
  )
}

// A date's name: the date in full, as today or as the one held where it is
// either, then as the first or last date the bounds allow where it is that.
// A range's two ends open with the whole range, once one is chosen. React
// Aria's own wording, from its calendar dictionary.
function dateLabelOf(
  date: CalendarDate,
  state: SomeCalendarState,
  locale: string,
  isCurrent: boolean,
  isSelected: boolean,
) {
  const words = messagesFor(locale).calendar
  const full = `${rangeNameOf(state, date, locale)}${new DateFormatter(locale, {
    day: 'numeric',
    era: eraOf(date),
    month: 'long',
    timeZone: state.timeZone,
    weekday: 'long',
    year: 'numeric',
  }).format(date.toDate(state.timeZone))}`
  const said = isCurrent
    ? (isSelected ? words.todayDateSelected : words.todayDate).replace(
        '{date}',
        full,
      )
    : isSelected
      ? words.dateSelected.replace('{date}', full)
      : full

  if (state.minValue != null && isSameDay(date, state.minValue)) {
    return `${said}, ${words.minimumDate}`
  }

  if (state.maxValue != null && isSameDay(date, state.maxValue)) {
    return `${said}, ${words.maximumDate}`
  }

  return said
}

// The date's number in the grid, in the locale's digits: the day alone out of
// a formatted date, as React Aria takes it, so a locale that writes a unit
// after the day, as Japanese does, draws the number alone.
function dayOf(date: CalendarDate, state: SomeCalendarState, locale: string) {
  return (
    new DateFormatter(locale, {
      calendar: date.calendar.identifier,
      day: 'numeric',
      timeZone: state.timeZone,
    })
      .formatToParts(date.toDate(state.timeZone))
      .find((part) => part.type === 'day')?.value ?? String(date.day)
  )
}

// The era is written only where a Gregorian date falls before the common era,
// as React Aria writes it.
function eraOf(date: CalendarDate) {
  return date.calendar.identifier === 'gregory' && date.era === 'BC'
    ? ('short' as const)
    : undefined
}

// Draws a started range as far as the date a pointer is over, as web's does.
// Nothing in a calendar of one date; before a range is started, React
// Stately's own `highlightDate` does nothing.
function highlightThen(state: SomeCalendarState, date: CalendarDate) {
  if (!('highlightDate' in state)) {
    return undefined
  }

  return () => {
    state.highlightDate(date)
  }
}

// The row a list's row occupies, which is every row's 48dp, so the list can
// open scrolled to the entry shown without laying out the rows before it.
function layoutOf(height: number) {
  return (_data: ArrayLike<ListEntry> | null | undefined, index: number) => ({
    index,
    length: height,
    offset: height * index,
  })
}

function listKeyOf(entry: ListEntry) {
  return String(entry.id)
}

/**
 * The month or the year as the page's menu button, opening its list. Named
 * by what it shows and then by what it is, "Sep month", which keeps the
 * visible text the start of the name.
 */
function MenuButton({
  buttonRef,
  expanded,
  isDisabled,
  label,
  name,
  onPress,
}: {
  readonly buttonRef: RefObject<ComponentRef<typeof View> | null>
  readonly expanded: boolean
  readonly isDisabled: boolean
  readonly label: string | undefined
  readonly name: string
  readonly onPress: () => void
}) {
  const theme = useTheme()
  const { colors, sizing, stateLayerOpacity } = theme
  const own = stylesOf(theme)
  const role = useTypeRole('labelLarge')
  const feedback = usePressFeedback({
    color: colors.onSurfaceVariant,
    corners: own.menuButton,
    disabled: isDisabled,
  })

  return (
    <Pressable
      aria-expanded={expanded}
      aria-label={`${label ?? ''} ${name}`}
      hitSlop={hitSlop(sizing.controlSm)}
      onPress={onPress}
      ref={buttonRef}
      role="button"
      {...feedback.handlers}
      disabled={isDisabled}
      style={composeStyles<ViewStyle>(own.menuButton, feedback.ring)}
    >
      {feedback.layer}
      <NativeText
        style={composeStyles<TextStyle>(
          role,
          own.menuButtonText,
          isDisabled ? own.dateTextDisabled : undefined,
        )}
      >
        {label}
      </NativeText>
      <ArrowDropDownGlyph
        color={
          isDisabled
            ? withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)
            : colors.onSurfaceVariant
        }
        size={18}
        style={expanded ? own.arrowExpanded : undefined}
      />
    </Pressable>
  )
}

/**
 * An open month or year list, in the grid's place: a list of radio rows, the
 * entry shown checked, opening scrolled so that entry sits in the middle with
 * the entries either side of it in view. The screen reader is sent to it as
 * it opens.
 */
function MenuList({
  disabled,
  entries,
  name,
  onChoose,
  shown,
}: {
  readonly disabled: ReadonlySet<number>
  readonly entries: readonly ListEntry[]
  readonly name: string
  readonly onChoose: (entry: ListEntry) => void
  readonly shown: number
}) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const [checked, setChecked] = useState<HostInstance | null>(null)

  useFocusOnPlaced(true, checked)

  return (
    <FlatList
      aria-label={name}
      data={entries}
      getItemLayout={layoutOf(theme.sizing.controlMd)}
      initialScrollIndex={Math.max(
        0,
        Math.min(shown - ROWS_ABOVE_SHOWN, entries.length - (WEEKS_HELD + 1)),
      )}
      keyExtractor={listKeyOf}
      renderItem={rowOf({ disabled, onChoose, setChecked, shown })}
      role="radiogroup"
      style={own.list}
    />
  )
}

/**
 * The weekday row and one month's weeks, held at six weeks of room so the
 * calendar keeps its height from month to month. The weeks slide in from the
 * side the new month comes from.
 */
function MonthGrid({
  firstDayOfWeek,
  locale,
  offset,
  state,
}: PartProps & {
  readonly firstDayOfWeek: undefined | Weekday
  /** How far the month is from the first one the calendar shows. */
  readonly offset: MonthOffset
}) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const role = useTypeRole('bodyLarge')
  const start = state.visibleRange.start.add(offset)
  const slide = useMonthSlide(start, theme)
  const rowStyle = composeStyles<ViewStyle>(styles.row, own.rowHeight)

  return (
    <View style={own.grid}>
      <View aria-hidden style={rowStyle}>
        {weekdaysOf(state, locale, firstDayOfWeek).map((weekday) => (
          <View key={weekday.key} style={styles.column}>
            <NativeText style={composeStyles<TextStyle>(role, own.weekday)}>
              {weekday.label}
            </NativeText>
          </View>
        ))}
      </View>
      <Animated.View style={slide}>
        {weeksOf(state, start).map((week) => (
          <View key={week.key} style={rowStyle}>
            {week.days.map((day) => (
              <View key={day.key} style={styles.column}>
                {day.date === null ? null : (
                  <DateCell
                    date={day.date}
                    locale={locale}
                    month={start}
                    state={state}
                  />
                )}
              </View>
            ))}
          </View>
        ))}
      </Animated.View>
    </View>
  )
}

/** The open month list: the months of the year shown, named in full. */
function MonthList({
  locale,
  setOpen,
  state,
}: PartProps & { readonly setOpen: (open: null | OpenList) => void }) {
  const months = monthsOf(state, locale, 'long')
  const shown = state.focusedDate.month - 1

  return (
    <MenuList
      disabled={outsideBounds(state, months)}
      entries={months}
      name={messagesFor(locale).calendar.month}
      onChoose={chooseThen(state, setOpen, shown)}
      shown={shown}
    />
  )
}

// The months of the year shown, named short for the header's button or in
// full for the open list. Some calendar systems, such as the Hebrew, have
// more months in some years than in others.
function monthsOf(
  state: SomeCalendarState,
  locale: string,
  format: 'long' | 'short',
): readonly ListEntry[] {
  const { focusedDate, timeZone } = state
  const formatter = new DateFormatter(locale, {
    calendar: focusedDate.calendar.identifier,
    month: format,
    timeZone,
  })

  return Array.from(
    { length: focusedDate.calendar.getMonthsInYear(focusedDate) },
    (_unused, index) => {
      const date = focusedDate.set({ month: index + 1 })
      const shown = date.calendar.getFormattableMonth?.(date) ?? date

      return {
        date,
        formatted: formatter.format(shown.toDate(timeZone)),
        id: index,
      }
    },
  )
}

// One offset per month a calendar shows, the first month's none.
function offsetsOf(months: number): readonly MonthOffset[] {
  return Array.from({ length: Math.max(1, months) }, (_unused, index) => ({
    months: index,
  }))
}

// The months the bounds leave no day of.
function outsideBounds(
  state: SomeCalendarState,
  months: readonly ListEntry[],
): ReadonlySet<number> {
  const { maxValue, minValue } = state

  return new Set(
    months
      .filter(
        ({ date }) =>
          (maxValue != null && startOfMonth(date).compare(maxValue) > 0) ||
          (minValue != null && endOfMonth(date).compare(minValue) < 0),
      )
      .map(({ id }) => id),
  )
}

function pageThen(state: SomeCalendarState, direction: 'next' | 'previous') {
  return () => {
    if (direction === 'next') {
      state.focusNextPage()
    } else {
      state.focusPreviousPage()
    }
  }
}

function previousGlyphStyle() {
  return I18nManager.isRTL
    ? styles.previousGlyphRightToLeft
    : styles.previousGlyph
}

// What pressing a date in a range calendar does, as the screen reader's hint
// on it: start a range, or end the one started. React Aria says it at the date
// focused, which on a device is the one the screen reader is on. Nothing in a
// calendar of one date, or where the press would do nothing.
function promptOf(
  state: SomeCalendarState,
  locale: string,
  selectable: boolean,
) {
  if (!('anchorDate' in state) || state.isReadOnly || !selectable) {
    return undefined
  }

  const words = messagesFor(locale).calendar

  return state.anchorDate === null
    ? words.startRangeSelectionPrompt
    : words.finishRangeSelectionPrompt
}

// What the two ends of the range a range calendar holds say before the date:
// the range, or the day where it is one, as React Aria opens their names with
// it. Nothing while a range is started, which holds nothing yet, or for any
// other date.
function rangeNameOf(
  state: SomeCalendarState,
  date: CalendarDate,
  locale: string,
) {
  if (
    !('highlightedRange' in state) ||
    state.value === null ||
    state.anchorDate !== null ||
    state.highlightedRange === null ||
    (!isSameDay(date, state.value.start) && !isSameDay(date, state.value.end))
  ) {
    return ''
  }

  const { end, start } = state.highlightedRange
  const { timeZone } = state
  const words = messagesFor(locale).calendar
  const formatter = new DateFormatter(locale, {
    day: 'numeric',
    era: eraOf(start) ?? eraOf(end),
    month: 'long',
    timeZone,
    weekday: 'long',
    year: 'numeric',
  })
  const said = isSameDay(start, end)
    ? words.selectedDateDescription.replace(
        '{date}',
        formatter.format(start.toDate(timeZone)),
      )
    : words.selectedRangeDescription.replace(
        '{dateRange}',
        spokenRangeOf(formatter, locale, start, end, timeZone),
      )

  return `${said}, `
}

// Where a selected date sits in a range calendar's range: its first or last
// day, either of which is an end, or between them. Null in a calendar of one
// date, and for a date outside the range.
function rangeOf(
  state: SomeCalendarState,
  date: CalendarDate,
  isSelected: boolean,
) {
  if (
    !isSelected ||
    !('highlightedRange' in state) ||
    state.highlightedRange === null
  ) {
    return null
  }

  const isFirst = isSameDay(date, state.highlightedRange.start)
  const isLast = isSameDay(date, state.highlightedRange.end)

  return { isEnd: isFirst || isLast, isFirst, isLast }
}

/**
 * One row of an open list: the check where the row is the entry shown, the
 * room it takes where it is not, then the month or the year, in body large.
 */
function Row({
  entry,
  isChecked,
  isDisabled,
  onChoose,
  setChecked,
}: {
  readonly entry: ListEntry
  readonly isChecked: boolean
  readonly isDisabled: boolean
  readonly onChoose: (entry: ListEntry) => void
  readonly setChecked: (row: HostInstance | null) => void
}) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const role = useTypeRole('bodyLarge')
  const feedback = usePressFeedback({
    color: theme.colors.onSurface,
    disabled: isDisabled,
  })

  return (
    <Pressable
      aria-checked={isChecked}
      onPress={rowPressThen(onChoose, entry)}
      ref={isChecked ? setChecked : undefined}
      role="radio"
      {...feedback.handlers}
      disabled={isDisabled}
      style={composeStyles<ViewStyle>(
        own.listRow,
        isChecked ? own.listRowSelected : undefined,
        feedback.ring,
      )}
    >
      {feedback.layer}
      <View style={own.listCheck}>
        {isChecked ? <CheckGlyph color={theme.colors.onSurface} /> : null}
      </View>
      <NativeText
        style={composeStyles<TextStyle>(
          role,
          own.listText,
          isDisabled ? own.listTextDisabled : undefined,
        )}
      >
        {entry.formatted}
      </NativeText>
    </Pressable>
  )
}

function rowOf({
  disabled,
  onChoose,
  setChecked,
  shown,
}: {
  readonly disabled: ReadonlySet<number>
  readonly onChoose: (entry: ListEntry) => void
  readonly setChecked: (row: HostInstance | null) => void
  readonly shown: number
}) {
  return ({ item }: ListRenderItemInfo<ListEntry>) => (
    <Row
      entry={item}
      isChecked={item.id === shown}
      isDisabled={disabled.has(item.id)}
      onChoose={onChoose}
      setChecked={setChecked}
    />
  )
}

function rowPressThen(onChoose: (entry: ListEntry) => void, entry: ListEntry) {
  return () => {
    onChoose(entry)
  }
}

// Picks a date and moves the calendar's focus to it, as a press on one does
// on web. A read-only or disabled calendar's state ignores the pick.
function selectThen(state: SomeCalendarState, date: CalendarDate) {
  return () => {
    state.selectDate(date)
    state.setFocusedDate(date)
  }
}

// Two dates as a range in the calendar's `dateRange` words, each written as
// much as the other leaves out, "September 8 to 15, 2026". React Aria splits
// the formatted range at the last literal its two halves share before the
// end begins, and so does this.
function spokenRangeOf(
  formatter: DateFormatter,
  locale: string,
  start: CalendarDate,
  end: CalendarDate,
  timeZone: string,
) {
  const parts = formatter.formatRangeToParts(
    start.toDate(timeZone),
    end.toDate(timeZone),
  )
  let separator = -1

  for (const [index, part] of parts.entries()) {
    if (part.source === 'endRange') {
      break
    }
    if (part.source === 'shared' && part.type === 'literal') {
      separator = index
    }
  }

  return messagesFor(locale)
    .calendar.dateRange.replace(
      '{startDate}',
      textOf(parts.slice(0, Math.max(0, separator))),
    )
    .replace('{endDate}', textOf(parts.slice(separator + 1)))
}

function textOf(parts: readonly Intl.DateTimeFormatPart[]) {
  return parts.map((part) => part.value).join('')
}

function toggleThen(
  setOpen: (update: (open: null | OpenList) => null | OpenList) => void,
  list: OpenList,
) {
  return () => {
    setOpen((open) => (open === list ? null : list))
  }
}

/**
 * Slides the weeks in from the side the new month comes from as the month
 * moves, 30dp over the medium duration on the emphasised decelerating curve,
 * fading in as they come: Material Design's shared axis transition for an
 * incoming page. The side follows the writing direction, so a later month
 * arrives from the end. Under reduced motion the month changes at once.
 */
function useMonthSlide(start: CalendarDate, { motion }: ResolvedTheme) {
  const reduceMotion = useReducedMotion()
  const offset = useSharedValue(0)
  const opacity = useSharedValue(1)
  const shown = useRef(start)

  useLayoutEffect(() => {
    const travel = start.compare(shown.current)

    shown.current = start
    if (travel === 0 || reduceMotion) {
      return
    }

    const timing = {
      duration: motion.durationMedium2,
      easing: Easing.bezier(...motion.easingEmphasizedDecelerate),
    }
    const side = (travel > 0 ? 1 : -1) * (I18nManager.isRTL ? -1 : 1)

    offset.set(side * SLIDE_DISTANCE)
    offset.set(withTiming(0, timing))
    opacity.set(0)
    opacity.set(withTiming(1, timing))
  }, [motion, offset, opacity, reduceMotion, start])

  return useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: opacity.get(),
      transform: [{ translateX: offset.get() }],
    }
  })
}

/**
 * The container's style for the months a calendar shows: the page's 360dp,
 * or as wide as its months side by side with the room between them.
 */
function useRootStyle(months: number) {
  const theme = useTheme()
  const own = stylesOf(theme)

  return useSideBySide(months)
    ? composeStyles<ViewStyle>(own.root, {
        width: rootWidthOf(theme, months),
      })
    : own.root
}

// Whether a calendar's months sit side by side, which they do from the
// expanded window size up, as web's do; below it they stack.
function useSideBySide(months: number) {
  const sizeClass = useWindowSizeClass()

  return months > 1 && sizeClass !== 'compact' && sizeClass !== 'medium'
}

// The months the calendar shows, which the plain header draws between its
// chevrons and the calendar's name ends with: one month and its year, or the
// first and last of several as a range, which `spoken` writes in React Aria's
// words for a screen reader, as React Aria writes the two.
function visibleRangeOf(
  state: SomeCalendarState,
  locale: string,
  spoken = false,
) {
  const { end, start } = state.visibleRange
  const { timeZone } = state
  const formatter = new DateFormatter(locale, {
    calendar: start.calendar.identifier,
    era: eraOf(start) ?? eraOf(end),
    month: 'long',
    timeZone,
    year: 'numeric',
  })
  const first = start.calendar.getFormattableMonth?.(start) ?? start

  if (isSameMonth(start, end)) {
    return formatter.format(first.toDate(timeZone))
  }

  const last = end.calendar.getFormattableMonth?.(end) ?? end

  return spoken
    ? spokenRangeOf(formatter, locale, first, last, timeZone)
    : formatter.formatRange(first.toDate(timeZone), last.toDate(timeZone))
}

// The weekday row, in the locale's narrow names from the day its week starts
// on, or the day `firstDayOfWeek` names.
function weekdaysOf(
  state: SomeCalendarState,
  locale: string,
  firstDayOfWeek: undefined | Weekday,
) {
  const first = startOfWeek(today(state.timeZone), locale, firstDayOfWeek)
  const formatter = new DateFormatter(locale, {
    timeZone: state.timeZone,
    weekday: 'narrow',
  })

  return Array.from({ length: 7 }, (_unused, index) => {
    const date = first.add({ days: index })

    return {
      key: date.toString(),
      label: formatter.format(date.toDate(state.timeZone)),
    }
  })
}

// The weeks of the month a grid shows, from the first day of that month, each
// seven days from the locale's first day of the week. A day a calendar system
// lacks is a gap.
function weeksOf(state: SomeCalendarState, start: CalendarDate) {
  return Array.from(
    { length: state.getWeeksInMonth(start) },
    (_unused, week) => {
      const key = start.add({ weeks: week }).toString()

      return {
        days: state.getDatesInWeek(week, start).map((date, day) => ({
          date,
          key: date?.toString() ?? `${key}+${String(day)}`,
        })),
        key,
      }
    },
  )
}

/** The open year list: the years either side of the one shown. */
function YearList({
  locale,
  setOpen,
  state,
}: PartProps & { readonly setOpen: (open: null | OpenList) => void }) {
  const { entries, shown } = yearsOf(state, locale)

  return (
    <MenuList
      disabled={NONE}
      entries={entries}
      name={messagesFor(locale).calendar.year}
      onChoose={chooseThen(state, setOpen, shown)}
      shown={shown}
    />
  )
}

// The year shown, which the header's year button names.
function yearOf(state: SomeCalendarState, locale: string) {
  const { focusedDate, timeZone } = state

  return new DateFormatter(locale, {
    calendar: focusedDate.calendar.identifier,
    era: eraOf(focusedDate),
    timeZone,
    year: 'numeric',
  }).format(focusedDate.toDate(timeZone))
}

// The years the open list holds, as React Aria's year picker lists them: as
// many either side of the year shown as `LISTED_YEARS` allows, shifted to
// stay inside `minValue` and `maxValue` and cut short where those are nearer.
// An entry's id is its place in the list, since in some calendars, such as
// the Japanese, the era changes as well as the year.
function yearsOf(state: SomeCalendarState, locale: string) {
  const { focusedDate, maxValue, minValue, timeZone } = state
  const formatter = new DateFormatter(locale, {
    calendar: focusedDate.calendar.identifier,
    era: eraOf(focusedDate),
    timeZone,
    year: 'numeric',
  })
  let first = focusedDate.subtract({ years: Math.floor(LISTED_YEARS / 2) })
  let last = focusedDate.add({ years: Math.ceil(LISTED_YEARS / 2) - 1 })

  if (maxValue != null && last.compare(maxValue) > 0) {
    last = toCalendarDate(maxValue)
    first = last.subtract({ years: LISTED_YEARS - 1 })
  }

  if (minValue != null && first.compare(minValue) < 0) {
    first = toCalendarDate(minValue)
    last = first.add({ years: LISTED_YEARS - 1 })
    if (maxValue != null && last.compare(maxValue) > 0) {
      last = toCalendarDate(maxValue)
    }
  }

  const entries: ListEntry[] = []
  let shown = 0

  for (
    let date = first;
    date.compare(last) <= 0 || isSameYear(date, last);
    date = date.add({ years: 1 })
  ) {
    const entry = date.compare(last) > 0 ? last : date

    if (isSameYear(entry, focusedDate)) {
      shown = entries.length
    }
    entries.push({
      date: entry,
      formatted: formatter.format(entry.toDate(timeZone)),
      id: entries.length,
    })
  }

  return { entries, shown }
}

const NONE: ReadonlySet<number> = new Set()

export { CalendarFrame, useRootStyle, visibleRangeOf }
export type { Weekday }
