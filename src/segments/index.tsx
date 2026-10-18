import type { Calendar } from '@internationalized/date'
import type {
  ComponentRef,
  Dispatch,
  Ref,
  RefObject,
  SetStateAction,
} from 'react'
import type {
  AccessibilityActionEvent,
  AccessibilityActionInfo,
  HostInstance,
  PressableProps,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
import type {
  DateFieldState,
  DateSegment,
  DateSegmentType,
} from 'react-stately/useDateFieldState'

import {
  CalendarDate,
  DateFormatter,
  toCalendar,
} from '@internationalized/date'
import {
  useEffect,
  useEffectEvent,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  I18nManager,
  Text as NativeText,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native'

import type { FieldDescriptionPart } from '../field'
import type { Focusable } from '../form'
import type { LibraryMessages } from '../i18n/messages'

import { startsWithIn } from '../autocomplete'
import { descriptionOf, FieldSegments } from '../field'
import { messagesFor } from '../i18n'
import { NumberParser } from '../number/parser'
import { useTheme } from '../theme/scope'
import { composeStyles } from '../theme/styles'
import { useTypeRole } from '../typography/roles'
import { segmentStylesOf } from './styles'

// The segments a date or a time is typed into, one part of the value each, as
// web's src/segments draws them. React Stately's date field state decides
// what the parts are, how many, in what order and what each may hold, from
// the locale and the granularity, so a field built on it draws them from that
// state rather than writing any of them out. What is here is how a person
// types into them and how a screen reader reads them, which is React Aria's
// useDateSegment ported, since React Aria does not run on native.
//
// **Typing is React Aria's, digit for digit.** A digit goes into the segment
// after the ones typed before it, and moves on to the next segment once no
// further digit could fit, so `9` in a month moves on and `1` waits for a
// second. A letter picks a day period or an era by the start of its name in
// the locale, backspace takes a digit off the end, and on an empty segment
// moves back to the one before it.
//
// **On iOS and Android one hidden input takes the keys.** A view cannot raise
// the keyboard, so a press on a segment makes it the one being typed and
// focuses a text input no one sees or reads, which holds one space and hands
// over each key typed after it. Its keyboard is a number pad for a segment of
// digits and the full one for a day period or an era. A screen reader reaches
// each segment as an adjustable element instead, which a swipe steps up or
// down, and which opens the keyboard when activated.
//
// **Under React Native Web each segment is its own focus stop**, as web's
// are, read as a spin button and typed into with the keys a browser hands
// it: digits and letters, backspace, the arrow keys up and down to step, and
// left and right to move between segments, which follow the direction the
// page reads in.
//
// **A drawing of their own replaces a field's line**, for segments that are
// not a field's: a box per part, the text inside it and the punctuation
// between them, each the caller's, as a time picker's modal draws its hour
// and minute. It names the parts it draws, and focus passes the others by,
// so a day period a selector beside the boxes stands for is never typed into.
// Punctuation is drawn only where it holds something to see, since a
// locale's literals carry bidirectional marks and spaces beside it.

type DateSegmentsProps = {
  /** What describes the field after the value it holds: the line under it. */
  readonly described: readonly FieldDescriptionPart[]
  /** How the segments are drawn where they are not a field's line. */
  readonly drawing?: SegmentDrawing
  /**
   * What the segments are read as holding, after their own names: the date
   * or the time written out, unless a range picker around them reads its
   * whole range here instead. `''` reads nothing.
   */
  readonly holding?: string
  /** Whether the field shows an error, which every segment then says. */
  readonly isInvalid: boolean
  /** The field's label, which each segment's name ends in. */
  readonly label: string
  /** The locale the field writes in: its `useLocaleOf`. */
  readonly locale: string
  /**
   * Called with the segment in focus as it changes, and with `null` as focus
   * leaves them.
   */
  readonly onActiveChange?: (type: DateSegmentType | null) => void
  /**
   * Called where focus would move back from the first segment, as a
   * backspace on it does, which a range picker sends on to the start's last.
   */
  readonly onBeforeStart?: () => void
  /** Called as focus leaves the segments, once they fill in what they can. */
  readonly onBlur?: () => void
  /** Called after each edit a person makes, typed or stepped. */
  readonly onEdit?: () => void
  /** Called as focus arrives in the segments from outside them. */
  readonly onFocus?: () => void
  /**
   * Called where focus would move on from the last segment, as a full one
   * does, which a range picker sends on to the end's first.
   */
  readonly onPastEnd?: () => void
  /** What focuses the segments: the first, or the last. */
  readonly ref?: Ref<SegmentsHandle>
  readonly state: DateFieldState
}

// What moving focus to a segment reaches for.
type Focusing = Pick<
  SegmentLineProps,
  'entered' | 'input' | 'nodes' | 'setActive' | 'state'
>

type Moves = {
  // Where focus goes from a segment that stops being drawn, as React Aria's
  // goes from one it removes: the one before it, or the one after it where it
  // was the first.
  readonly away: () => void
  readonly next: () => void
  readonly previous: () => void
}

/**
 * How segments are drawn in place of a field's line of body large text, each
 * style chosen for whether its part is the one in focus.
 */
type SegmentDrawing = {
  /** The box a part a person types into is drawn in. */
  readonly box: (
    type: DateSegmentType,
    isActive: boolean,
  ) => StyleProp<ViewStyle>
  /** The punctuation between two parts. */
  readonly literal: StyleProp<TextStyle>
  /** The parts drawn. The rest are left out, and focus passes them by. */
  readonly parts: ReadonlySet<DateSegmentType>
  /**
   * Whether a press on a part raises the keyboard on iOS and Android, as a
   * field's does, rather than only making it the one in focus.
   */
  readonly raisesKeyboard: boolean
  /** The text inside a part's box. */
  readonly text: (
    type: DateSegmentType,
    isActive: boolean,
  ) => StyleProp<TextStyle>
}

// The segments' own props, with what the component around them keeps for
// them: which one is being typed, what has been typed into it, whether focus
// is among them, the hidden input and each segment's element.
type SegmentLineProps = Omit<DateSegmentsProps, 'ref'> & {
  readonly active: DateSegmentType | null
  readonly entered: RefObject<string>
  readonly input: RefObject<ComponentRef<typeof TextInput> | null>
  readonly inside: RefObject<boolean>
  readonly nodes: RefObject<Map<DateSegmentType, HostInstance>>
  readonly setActive: Dispatch<SetStateAction<DateSegmentType | null>>
}

/**
 * What focuses a field's segments: `focus` the first, unless focus is among
 * them already, `focusLast` the last, and `focusOn` the one of `type`, with
 * the keyboard raised on iOS and Android or put away.
 */
type SegmentsHandle = Focusable & {
  readonly focusLast: () => void
  readonly focusOn: (type: DateSegmentType, keyboard: boolean) => void
}

// A step a spin button takes, each one a method of the field's state.
type Step =
  | 'decrement'
  | 'decrementPage'
  | 'decrementToMin'
  | 'increment'
  | 'incrementPage'
  | 'incrementToMax'

// What a segment is handed under React Native Web, which takes keys and focus
// on any element.
type WebSegmentProps = Pick<PressableProps, 'onBlur' | 'onFocus' | 'onKeyDown'>

// What a screen reader can ask of a segment: a step up, or a step down.
const ADJUSTABLE: readonly AccessibilityActionInfo[] = [
  { name: 'increment' },
  { name: 'decrement' },
]

// What a literal holds besides what it is drawn for: the spaces, and the
// marks a locale sets a direction with.
const INVISIBLE = /[\s\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu

// The text the hidden input holds, which a backspace has something to take
// from and which every key typed lands after.
const SENTINEL = ' '

// Where the hidden input's caret stays: after the space.
const AFTER_SENTINEL = { end: SENTINEL.length, start: SENTINEL.length }

// The segments a number is typed into, which the number pad serves.
const NUMERIC = new Set<DateSegmentType>([
  'day',
  'hour',
  'minute',
  'month',
  'second',
  'year',
])

const styles = StyleSheet.create({
  // The input no one sees, which is there to raise the keyboard and take its
  // keys. Still laid out, since an input with no size takes no focus.
  input: {
    height: 1,
    opacity: 0,
    position: 'absolute',
    start: 0,
    top: 0,
    width: 1,
  },
  // The date written out, in the document under React Native Web for the
  // first segment to point at, and drawn nowhere.
  notDrawn: {
    display: 'none',
  },
})

// What a screen reader's swipe up or down does to a segment.
function actionOf(line: SegmentLineProps, segment: DateSegment) {
  return (event: AccessibilityActionEvent) => {
    const { actionName } = event.nativeEvent
    if (actionName === 'increment' || actionName === 'decrement') {
      stepKey(line, segment, actionName)
    }
  }
}

// Where focus goes once a person is in the segments: what the field calls on
// arriving, which it hears once however many segments focus passes through.
function arrivedIn({ inside, onFocus }: SegmentLineProps) {
  if (!inside.current) {
    inside.current = true
    onFocus?.()
  }
}

// What the hidden input does with each change to its text: a shorter text is
// a backspace, and a longer one a key typed after the space.
function changedOf(line: SegmentLineProps) {
  return (text: string) => {
    const segment = line.state.segments.find(
      (each) => each.type === line.active,
    )

    if (segment === undefined) {
      return
    }

    if (text.length < SENTINEL.length) {
      eraseKey(line, segment)
      return
    }

    // One key at a time, the first typed after the space: a second handed
    // over in the same change would be written over by the first, since
    // both are set from the value this render holds.
    const point = text.replace(SENTINEL, '').codePointAt(0)

    if (point !== undefined) {
      typeKey(line, segment, String.fromCodePoint(point))
    }
  }
}

// The number of characters at the start of every one of `texts` that they
// share, which an era's name is typed after, as React Aria finds it.
function commonPrefixLength(texts: readonly string[]) {
  const sorted = texts.toSorted()
  const first = sorted.at(0) ?? ''
  const last = sorted.at(-1) ?? ''
  let length = 0

  while (length < first.length && first[length] === last[length]) {
    length++
  }

  return length
}

/**
 * A date or a time's segments, inside a field's box, from React Stately's
 * date field state: each part of the value typed or stepped on its own, the
 * one being typed drawn as a filled shape and the empty ones in their
 * placeholders, muted.
 */
function DateSegments({ onActiveChange, ref, ...props }: DateSegmentsProps) {
  const [active, setActive] = useState<DateSegmentType | null>(null)
  // What has been typed into the segment in focus since it took focus, which
  // the next digit is read after.
  const entered = useRef('')
  // Whether focus is in the segments, which a press on the box around them
  // leaves where it is.
  const inside = useRef(false)
  const input = useRef<ComponentRef<typeof TextInput>>(null)
  // Each segment's element under React Native Web, which focus moves to.
  const nodes = useRef(new Map<DateSegmentType, HostInstance>())
  const { drawing, state } = props
  const reportActive = useEffectEvent((type: DateSegmentType | null) => {
    onActiveChange?.(type)
  })

  useEffect(() => {
    reportActive(active)
  }, [active])

  useImperativeHandle(ref, () => ({
    focus: () => {
      const first = state.segments.find((segment) =>
        typedInto(drawing, segment),
      )
      if (!inside.current && first !== undefined) {
        focusTo({ entered, input, nodes, setActive, state }, first.type)
      }
    },
    focusLast: () => {
      const last = state.segments.findLast((segment) =>
        typedInto(drawing, segment),
      )
      if (last !== undefined) {
        focusTo({ entered, input, nodes, setActive, state }, last.type)
      }
    },
    focusOn: (type, keyboard) => {
      focusTo({ entered, input, nodes, setActive, state }, type, keyboard)
    },
  }))

  return (
    <SegmentLine
      {...props}
      active={active}
      entered={entered}
      input={input}
      inside={inside}
      nodes={nodes}
      setActive={setActive}
    />
  )
}

// What the locale calls the morning and the afternoon, which a key picks
// between by the start of each.
function dayPeriodsOf(locale: string): readonly [string, string] {
  const formatter = new DateFormatter(locale, { hour: 'numeric', hour12: true })
  const periodAt = (hours: number) => {
    const date = new Date()
    date.setHours(hours)
    return (
      formatter.formatToParts(date).find((part) => part.type === 'dayPeriod')
        ?.value ?? ''
    )
  }

  return [periodAt(0), periodAt(12)]
}

// Whether a segment is drawn: every one on a field's line, and in a drawing
// of its own the parts it names and the punctuation that holds something to
// see.
function drawn(drawing: SegmentDrawing | undefined, segment: DateSegment) {
  if (drawing === undefined) {
    return true
  }

  return segment.type === 'literal'
    ? segment.text.replaceAll(INVISIBLE, '') !== ''
    : drawing.parts.has(segment.type)
}

function edited({ onEdit }: SegmentLineProps, changed: boolean) {
  if (changed) {
    onEdit?.()
  }
}

// Takes a digit off the end of a segment, as backspace does in React Aria's,
// and clears a day period or an era outright. On a segment already empty it
// moves to the one before. Whether it changed the value.
function eraseFrom(
  state: DateFieldState,
  segment: DateSegment,
  locale: string,
  entered: RefObject<string>,
  moves: Moves,
): boolean {
  if (state.isDisabled || state.isReadOnly) {
    return false
  }

  if (segment.text === segment.placeholder) {
    moves.previous()
  }

  const parser = new NumberParser(locale, { maximumFractionDigits: 0 })

  if (parser.isValidPartialNumber(segment.text) && !segment.isPlaceholder) {
    const shortened = segment.text.slice(0, -1)
    const parsed = parser.parse(shortened)
    const kept = parsed === 0 ? '' : shortened

    if (kept === '') {
      state.clearSegment(segment.type)
    } else {
      state.setSegment(segment.type, parsed)
    }
    entered.current = kept
    return true
  }

  if (segment.type === 'dayPeriod' || segment.type === 'era') {
    state.clearSegment(segment.type)
    return true
  }

  return false
}

function eraseKey(line: SegmentLineProps, segment: DateSegment) {
  edited(
    line,
    eraseFrom(
      line.state,
      segment,
      line.locale,
      line.entered,
      movesFrom(line, segment.type),
    ),
  )
}

// The calendar's eras with the names a key picks them by: each era's name in
// the locale, less what every name begins with, so a calendar whose eras are
// ERA0 and ERA1 is typed with 0 and 1, as React Aria's is.
function erasOf(calendar: Calendar, locale: string) {
  const formatter = new DateFormatter(locale, {
    era: 'narrow',
    timeZone: 'UTC',
    year: 'numeric',
  })
  const first = toCalendar(new CalendarDate(1, 1, 1), calendar)
  const eras = calendar.getEras().map((era) => {
    const date = first.set({ day: 1, era, month: 1, year: 1 }).toDate('UTC')

    return {
      era,
      // An era with no name in the locale is typed by its identifier.
      formatted:
        formatter.formatToParts(date).find((part) => part.type === 'era')
          ?.value ?? era,
    }
  })
  const prefix = commonPrefixLength(eras.map((era) => era.formatted))

  return eras.map(({ era, formatted }) => ({
    era,
    formatted: formatted.slice(prefix),
  }))
}

// Moves focus to the segment of `type`: the segment's own element under React
// Native Web, and on iOS and Android the hidden input, with the segment made
// the one it types into. A read-only field raises no keyboard, and nor does a
// move that puts the keyboard away, which makes the segment the one in focus
// and takes focus off the input.
function focusTo(
  { entered, input, nodes, setActive, state }: Focusing,
  type: DateSegmentType,
  keyboard = true,
) {
  entered.current = ''

  if (Platform.OS === 'web') {
    nodes.current.get(type)?.focus()
    return
  }

  if (!keyboard) {
    setActive(type)
    input.current?.blur()
    return
  }

  if (state.isReadOnly) {
    return
  }

  setActive(type)
  input.current?.focus()
}

// Whether setting the era to `era` stops the era segment being drawn, which
// React Stately draws in a Gregorian calendar only while the date is BC.
function hidesEra(state: DateFieldState, era: string) {
  return state.calendar.identifier === 'gregory' && era !== 'BC'
}

// What the hidden input does on taking focus: types into the segment it was
// focused for, or the first where it was focused some other way.
function inputFocusedOf(line: SegmentLineProps) {
  return () => {
    const first =
      line.state.segments.find((segment) => typedInto(line.drawing, segment))
        ?.type ?? null
    line.setActive((current) => current ?? first)
    arrivedIn(line)
  }
}

// Keeps the hidden input, which focus is moved to on iOS and Android.
function inputOf({ input }: SegmentLineProps) {
  return (node: ComponentRef<typeof TextInput> | null) => {
    input.current = node
  }
}

// What focus leaving the segments does: fills in what the placeholder can,
// as React Aria's field does on blur, then tells the field.
function leftOf({
  entered,
  inside,
  onBlur,
  setActive,
  state,
}: SegmentLineProps) {
  return () => {
    inside.current = false
    entered.current = ''
    setActive(null)
    state.confirmPlaceholder()
    onBlur?.()
  }
}

// The segments on either side of the one of `type`, among those a person
// types into, which a full segment moves on to and a backspace back to. Past
// either end it is the field's to say, as a range picker's focus moves on
// from one date's segments to the other's.
function movesFrom(line: SegmentLineProps, type: DateSegmentType): Moves {
  const editable = line.state.segments.filter((segment) =>
    typedInto(line.drawing, segment),
  )
  const at = editable.findIndex((segment) => segment.type === type)
  const to = (index: number, beyond?: () => void) => () => {
    const segment = index < 0 ? undefined : editable.at(index)
    if (segment === undefined) {
      beyond?.()
    } else {
      focusTo(line, segment.type)
    }
  }

  return {
    away: to(at > 0 ? at - 1 : at + 1),
    next: to(at + 1, line.onPastEnd),
    previous: to(at - 1, line.onBeforeStart),
  }
}

// The name a segment of `type` is read by. A literal is never read, and is
// named as a day only to keep the lookup total.
function nameOf(
  type: DateSegmentType,
): keyof Omit<
  LibraryMessages['segments'],
  'empty' | 'selectedDate' | 'selectedTime'
> {
  return type === 'literal' ? 'day' : type
}

// Keeps each segment's element, which focus is moved to under React Native
// Web, for as long as it is drawn.
function nodeOf({ nodes }: SegmentLineProps, type: DateSegmentType) {
  return (node: HostInstance | null) => {
    if (node === null) {
      return undefined
    }

    nodes.current.set(type, node)
    return () => {
      nodes.current.delete(type)
    }
  }
}

// What a press on a segment does on iOS and Android: makes it the one typed
// into, and raises the keyboard, unless the drawing says a press only makes
// it the one in focus.
function pressOf(line: SegmentLineProps, type: DateSegmentType) {
  return () => {
    focusTo(line, type, line.drawing?.raisesKeyboard ?? true)
  }
}

// The element focus moved to, off a browser's blur event.
function relatedTargetOf(event: unknown): unknown {
  return typeof event === 'object' && event !== null && 'relatedTarget' in event
    ? event.relatedTarget
    : undefined
}

// The segments themselves, drawn from the field's state.
function SegmentLine(line: SegmentLineProps) {
  const { active, described, drawing, isInvalid, label, locale, state } = line
  const id = useId()
  const theme = useTheme()
  const own = segmentStylesOf(theme)
  const role = useTypeRole('bodyLarge')
  const words = messagesFor(locale).segments
  const first = state.segments.find((segment) => typedInto(drawing, segment))
  const value = line.holding ?? valueOf(state, words)
  const valueId = `${id}-value`
  const parts =
    value === '' ? described : [{ id: valueId, text: value }, ...described]
  const canEdit = !state.isDisabled && !state.isReadOnly

  return (
    <FieldSegments>
      {state.segments.map((segment, index) => {
        if (!drawn(drawing, segment)) {
          return null
        }

        if (!segment.isEditable) {
          return (
            <NativeText
              aria-hidden={segment.type === 'literal'}
              // A segment's place is its key, and a literal's its index, since
              // a locale can put the same punctuation between several.
              // oxlint-disable-next-line react/no-array-index-key -- see above
              key={`${segment.type}-${index}`}
              style={
                drawing === undefined
                  ? composeStyles<TextStyle>(
                      role,
                      segment.type === 'literal' ? undefined : own.segment,
                      state.isDisabled
                        ? own.textDisabled
                        : segment.type === 'literal'
                          ? own.textMuted
                          : own.text,
                    )
                  : drawing.literal
              }
            >
              {segment.text}
            </NativeText>
          )
        }

        const focused = segment.type === active
        // The field's description is said on the first segment alone, so it
        // is not heard again at every step, unless the field has an error.
        const describes = isInvalid || segment.type === first?.type

        return (
          <Pressable
            {...(Platform.OS === 'web' ? webPropsOf(line, segment) : undefined)}
            {...(describes ? descriptionOf(parts) : undefined)}
            {...webStateOf(isInvalid, state)}
            accessibilityActions={canEdit ? ADJUSTABLE : undefined}
            accessibilityRole={Platform.OS === 'web' ? undefined : 'adjustable'}
            aria-disabled={state.isDisabled}
            aria-label={`${words[nameOf(segment.type)]}, ${label}`}
            aria-valuemax={segment.maxValue}
            aria-valuemin={segment.minValue}
            aria-valuenow={segment.value ?? undefined}
            aria-valuetext={valueTextOf(segment, state, locale, words.empty)}
            disabled={state.isDisabled}
            key={segment.type}
            onAccessibilityAction={actionOf(line, segment)}
            onPress={
              Platform.OS === 'web' ? undefined : pressOf(line, segment.type)
            }
            ref={nodeOf(line, segment.type)}
            role={Platform.OS === 'web' ? 'spinbutton' : undefined}
            style={
              drawing === undefined
                ? composeStyles<ViewStyle>(
                    own.segment,
                    focused ? own.segmentFocused : undefined,
                  )
                : drawing.box(segment.type, focused)
            }
          >
            <NativeText
              style={
                drawing === undefined
                  ? composeStyles<TextStyle>(
                      role,
                      textStyleOf(own, segment, focused, state.isDisabled),
                    )
                  : drawing.text(segment.type, focused)
              }
            >
              {segment.text}
            </NativeText>
          </Pressable>
        )
      })}
      {Platform.OS === 'web' ? (
        value === '' ? null : (
          <NativeText id={valueId} style={styles.notDrawn}>
            {value}
          </NativeText>
        )
      ) : (
        <TextInput
          aria-hidden
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          caretHidden
          contextMenuHidden
          editable={canEdit}
          importantForAutofill="no"
          keyboardType={
            active === null || NUMERIC.has(active) ? 'number-pad' : 'default'
          }
          onBlur={leftOf(line)}
          onChangeText={changedOf(line)}
          onFocus={inputFocusedOf(line)}
          ref={inputOf(line)}
          selection={AFTER_SENTINEL}
          spellCheck={false}
          style={styles.input}
          value={SENTINEL}
        />
      )}
    </FieldSegments>
  )
}

// Steps a segment, as an arrow key or a swipe does, which starts what is
// typed into it again. Whether it changed the value.
function stepBy(
  state: DateFieldState,
  segment: DateSegment,
  by: Step,
  entered: RefObject<string>,
): boolean {
  if (state.isDisabled || state.isReadOnly) {
    return false
  }

  entered.current = ''
  state[by](segment.type)
  return true
}

function stepKey(line: SegmentLineProps, segment: DateSegment, by: Step) {
  const changed = stepBy(line.state, segment, by, line.entered)

  // A Gregorian era is drawn only while it is BC, so a step, which can only
  // take it to AD, takes the segment away, and focus with it where it is the
  // segment in focus. A screen reader's swipe moves no focus of ours, and
  // raises no keyboard.
  if (
    changed &&
    segment.type === 'era' &&
    line.active === 'era' &&
    hidesEra(line.state, 'AD')
  ) {
    movesFrom(line, 'era').away()
  }
  edited(line, changed)
}

function textStyleOf(
  own: ReturnType<typeof segmentStylesOf>,
  segment: DateSegment,
  focused: boolean,
  isDisabled: boolean,
) {
  if (isDisabled) {
    return own.textDisabled
  }

  if (focused) {
    return own.textFocused
  }

  return segment.isPlaceholder ? own.textMuted : own.text
}

// Whether a person types into `segment`: one they can edit, which the
// drawing, where there is one, draws.
function typedInto(drawing: SegmentDrawing | undefined, segment: DateSegment) {
  return segment.isEditable && drawn(drawing, segment)
}

// Types `key` into a segment, as React Aria's segment takes a key typed into
// it, and moves on once the segment can take no more. Whether it changed the
// value.
function typeInto(
  state: DateFieldState,
  segment: DateSegment,
  key: string,
  locale: string,
  entered: RefObject<string>,
  moves: Moves,
): boolean {
  if (state.isDisabled || state.isReadOnly) {
    return false
  }

  const startsWith = startsWithIn(locale)

  switch (segment.type) {
    case 'day':
    case 'hour':
    case 'minute':
    case 'month':
    case 'second':
    case 'year': {
      const parser = new NumberParser(locale, { maximumFractionDigits: 0 })
      const typed = entered.current + key

      if (!parser.isValidPartialNumber(typed)) {
        return false
      }

      const number = parser.parse(typed)

      if (Number.isNaN(number)) {
        return false
      }

      const { maxValue } = segment
      const over = maxValue !== undefined && number > maxValue

      // A number past the segment's largest starts again from the key alone,
      // so 13 in a month is a 3.
      state.setSegment(segment.type, over ? parser.parse(key) : number)

      if (
        maxValue !== undefined &&
        (Number(`${number}0`) > maxValue ||
          typed.length >= String(maxValue).length)
      ) {
        entered.current = ''
        moves.next()
      } else {
        entered.current = typed
      }
      return true
    }
    case 'dayPeriod': {
      const [am, pm] = dayPeriodsOf(locale)

      if (startsWith(am, key)) {
        state.setSegment('dayPeriod', 0)
      } else if (startsWith(pm, key)) {
        state.setSegment('dayPeriod', 1)
      } else {
        return false
      }
      moves.next()
      return true
    }
    case 'era': {
      const matched = erasOf(state.calendar, locale).find((era) =>
        startsWith(era.formatted, key),
      )

      if (matched === undefined) {
        return false
      }
      state.setSegment('era', matched.era)

      if (hidesEra(state, matched.era)) {
        moves.away()
      } else {
        moves.next()
      }
      return true
    }
    case 'literal':
    case 'timeZoneName': {
      break
    }
  }

  // A literal and a time zone are written by the locale and the value, and
  // nothing typed reaches them.
  return false
}

function typeKey(line: SegmentLineProps, segment: DateSegment, key: string) {
  edited(
    line,
    typeInto(
      line.state,
      segment,
      key,
      line.locale,
      line.entered,
      movesFrom(line, segment.type),
    ),
  )
}

// The date or the time a field holds, written out, which describes the
// field after its segments, as React Aria describes it. Nothing while the
// field is empty.
function valueOf(state: DateFieldState, words: LibraryMessages['segments']) {
  if (state.value === null) {
    return ''
  }

  const written = state.formatValue({ month: 'long' })

  return state.maxGranularity === 'hour'
    ? words.selectedTime.replace('{time}', written)
    : words.selectedDate.replace('{date}', written)
}

// What a segment's value reads as, as React Aria writes it: a month with its
// name beside its number, an hour with its day period, and an empty segment
// as empty.
function valueTextOf(
  segment: DateSegment,
  state: DateFieldState,
  locale: string,
  empty: string,
) {
  if (segment.isPlaceholder) {
    return empty
  }

  const { hour12, timeZone } = state.dateFormatter.resolvedOptions()

  if (segment.type === 'month') {
    const month = new DateFormatter(locale, { month: 'long', timeZone }).format(
      state.dateValue,
    )
    return month === segment.text ? month : `${segment.text} – ${month}`
  }

  if (segment.type === 'hour') {
    return new DateFormatter(locale, {
      hour: 'numeric',
      hour12,
      timeZone,
    }).format(state.dateValue)
  }

  return segment.text
}

// What a segment takes under React Native Web: focus, and the keys a browser
// hands it.
function webPropsOf(
  line: SegmentLineProps,
  segment: DateSegment,
): WebSegmentProps {
  const moves = movesFrom(line, segment.type)
  const step = (by: Step) => () => {
    stepKey(line, segment, by)
  }
  const erase = () => {
    eraseKey(line, segment)
  }
  // The arrow keys move along the line as it reads, so left is the next
  // segment in a right-to-left page.
  const keys = new Map<string, () => void>([
    ['ArrowDown', step('decrement')],
    ['ArrowLeft', I18nManager.isRTL ? moves.next : moves.previous],
    ['ArrowRight', I18nManager.isRTL ? moves.previous : moves.next],
    ['ArrowUp', step('increment')],
    ['Backspace', erase],
    ['Delete', erase],
    ['End', step('incrementToMax')],
    ['Home', step('decrementToMin')],
    ['PageDown', step('decrementPage')],
    ['PageUp', step('incrementPage')],
  ])

  return {
    // Focus moving to another segment stays in the field, and only focus
    // leaving the segments altogether is the field's blur.
    onBlur: (event) => {
      const to = relatedTargetOf(event.nativeEvent)
      if (![...line.nodes.current.values()].some((node) => node === to)) {
        leftOf(line)()
      }
    },
    onFocus: () => {
      line.entered.current = ''
      line.setActive(segment.type)
      arrivedIn(line)
    },
    onKeyDown: (event) => {
      const { altKey, ctrlKey, key, metaKey } = event.nativeEvent
      const handler = keys.get(key)

      if (handler !== undefined) {
        event.preventDefault()
        handler()
        return
      }

      // A key that types one character, rather than one held with a key that
      // makes it a shortcut, is typed into the segment.
      const point = key.codePointAt(0)

      if (
        point !== undefined &&
        String.fromCodePoint(point) === key &&
        !altKey &&
        !ctrlKey &&
        !metaKey
      ) {
        event.preventDefault()
        typeKey(line, segment, key)
      }
    },
  }
}

// What a browser reads off a segment that React Native has no prop for.
function webStateOf(isInvalid: boolean, state: DateFieldState) {
  if (Platform.OS !== 'web') {
    return undefined
  }

  return {
    ...(isInvalid ? { 'aria-invalid': true } : undefined),
    ...(state.isReadOnly ? { 'aria-readonly': true } : undefined),
    ...(state.isRequired ? { 'aria-required': true } : undefined),
  }
}

export { DateSegments }
export type { DateSegmentsProps, SegmentDrawing, SegmentsHandle }
