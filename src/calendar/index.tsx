import type { CalendarDate } from '@internationalized/date'
import type { ComponentRef, ReactNode, RefObject } from 'react'
import type {
  HostInstance,
  ListRenderItemInfo,
  TextStyle,
  ViewStyle,
} from 'react-native'
import type { CalendarState } from 'react-stately/useCalendarState'

import {
  DateFormatter,
  endOfMonth,
  isSameDay,
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
import { messagesFor } from '../i18n'
import { useFocusOnPlaced, useReturnFocus } from '../overlay/panel'
import { hitSlop, usePressFeedback } from '../press'
import { withOpacity } from '../theme/color'
import { useTheme } from '../theme/scope'
import { composeStyles } from '../theme/styles'
import { useTypeRole } from '../typography/roles'
import { SLIDE_DISTANCE, styles, stylesOf, WEEKS_HELD } from './styles'

// The parts a calendar draws inside its container: the row that moves the
// month, the weekday row, the weeks, and the month and year lists that take
// the grid's place. Apart from src/components/calendar so a calendar is the
// one thing that directory holds, as kanso-ui keeps its own in src/calendar.

/** One entry of a month or year list. */
type ListEntry = {
  readonly date: CalendarDate
  readonly formatted: string
  readonly id: number
}

type OpenList = 'month' | 'year'

type PartProps = {
  readonly locale: string
  readonly state: CalendarState
}

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
 * What a calendar draws inside its container. With `showMonthYearMenus` the
 * header is the date pickers page's docked one, the month and the year as
 * menu buttons, and while either is open its list takes the grid's place.
 */
function CalendarFrame({
  firstDayOfWeek,
  locale,
  showMonthYearMenus,
  state,
}: PartProps & {
  readonly firstDayOfWeek: undefined | Weekday
  readonly showMonthYearMenus: boolean
}) {
  const grid = (
    <MonthGrid firstDayOfWeek={firstDayOfWeek} locale={locale} state={state} />
  )

  if (showMonthYearMenus) {
    return (
      <CalendarMenus locale={locale} state={state}>
        {grid}
      </CalendarMenus>
    )
  }

  return (
    <>
      <CalendarHeader locale={locale} state={state} />
      {grid}
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
        {visibleMonthOf(state, locale)}
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
  state: CalendarState,
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

/**
 * One date: the page's 40dp circle in its 48dp square, which `hitSlop` makes
 * the press target. Its name is the date in full, with today, the selection
 * and the first or last date the bounds allow said as web says them, and it
 * reports itself disabled where it cannot be picked.
 */
function DateCell({ date, locale, state }: PartProps & { date: CalendarDate }) {
  const theme = useTheme()
  const { colors, sizing } = theme
  const own = stylesOf(theme)
  const role = useTypeRole('bodyLarge')
  const isDisabled = state.isCellDisabled(date)
  const isUnavailable = state.isCellUnavailable(date)
  const selectable = !isDisabled && !isUnavailable
  const isSelected = selectable && state.isSelected(date)
  const isCurrent = isToday(date, state.timeZone)
  const feedback = usePressFeedback({
    color: isSelected ? colors.onPrimary : colors.onSurface,
    corners: own.date,
    disabled: !selectable,
  })

  return (
    <Pressable
      aria-label={dateLabelOf(date, state, locale, isCurrent, isSelected)}
      hitSlop={hitSlop(sizing.controlSm, sizing.controlSm)}
      onPress={selectThen(state, date)}
      role="button"
      {...feedback.handlers}
      disabled={!selectable}
      style={composeStyles<ViewStyle>(
        own.date,
        isCurrent ? own.dateToday : undefined,
        isSelected ? own.dateSelected : undefined,
        feedback.ring,
      )}
    >
      {feedback.layer}
      <NativeText
        style={composeStyles<TextStyle>(
          role,
          own.dateText,
          isCurrent ? own.dateTextToday : undefined,
          isSelected ? own.dateTextSelected : undefined,
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
// React Aria's own wording, from its calendar dictionary.
function dateLabelOf(
  date: CalendarDate,
  state: CalendarState,
  locale: string,
  isCurrent: boolean,
  isSelected: boolean,
) {
  const words = messagesFor(locale).calendar
  const full = new DateFormatter(locale, {
    day: 'numeric',
    era: eraOf(date),
    month: 'long',
    timeZone: state.timeZone,
    weekday: 'long',
    year: 'numeric',
  }).format(date.toDate(state.timeZone))
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
function dayOf(date: CalendarDate, state: CalendarState, locale: string) {
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
 * The weekday row and the month's weeks, held at six weeks of room so the
 * calendar keeps its height from month to month. The weeks slide in from the
 * side the new month comes from.
 */
function MonthGrid({
  firstDayOfWeek,
  locale,
  state,
}: PartProps & { readonly firstDayOfWeek: undefined | Weekday }) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const role = useTypeRole('bodyLarge')
  const start = state.visibleRange.start
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
        {weeksOf(state).map((week) => (
          <View key={week.key} style={rowStyle}>
            {week.days.map((day) => (
              <View key={day.key} style={styles.column}>
                {day.date === null ? null : (
                  <DateCell date={day.date} locale={locale} state={state} />
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
  state: CalendarState,
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

// The months the bounds leave no day of.
function outsideBounds(
  state: CalendarState,
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

function pageThen(state: CalendarState, direction: 'next' | 'previous') {
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
function selectThen(state: CalendarState, date: CalendarDate) {
  return () => {
    state.selectDate(date)
    state.setFocusedDate(date)
  }
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

// The month and year the grid shows, which the plain header draws between
// its chevrons.
function visibleMonthOf(state: CalendarState, locale: string) {
  const { start } = state.visibleRange

  return new DateFormatter(locale, {
    calendar: start.calendar.identifier,
    era: eraOf(start),
    month: 'long',
    timeZone: state.timeZone,
    year: 'numeric',
  }).format(start.toDate(state.timeZone))
}

// The weekday row, in the locale's narrow names from the day its week starts
// on, or the day `firstDayOfWeek` names.
function weekdaysOf(
  state: CalendarState,
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

// The weeks of the month shown, each seven days from the locale's first day
// of the week. A day a calendar system lacks is a gap.
function weeksOf(state: CalendarState) {
  const { start } = state.visibleRange

  return Array.from({ length: state.getWeeksInMonth() }, (_unused, week) => {
    const key = start.add({ weeks: week }).toString()

    return {
      days: state.getDatesInWeek(week).map((date, day) => ({
        date,
        key: date?.toString() ?? `${key}+${String(day)}`,
      })),
      key,
    }
  })
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
function yearOf(state: CalendarState, locale: string) {
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
function yearsOf(state: CalendarState, locale: string) {
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

export { CalendarFrame, visibleMonthOf }
export type { Weekday }
