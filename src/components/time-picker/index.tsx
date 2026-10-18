import type { CalendarDateTime, ZonedDateTime } from '@internationalized/date'
import type {
  HostInstance,
  LayoutChangeEvent,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { DateSegmentType } from 'react-stately/useDateFieldState'
import type { OverlayTriggerState } from 'react-stately/useOverlayTriggerState'
import type { TimeFieldState, TimeValue } from 'react-stately/useTimeFieldState'

import {
  DateFormatter,
  getLocalTimeZone,
  Time,
  toCalendarDateTime,
  today,
} from '@internationalized/date'
import { use, useCallback, useId, useRef, useState } from 'react'
import {
  Text as NativeText,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'
import Svg, { Circle, Line } from 'react-native-svg'
import { useOverlayTriggerState } from 'react-stately/useOverlayTriggerState'
import { useTimeFieldState } from 'react-stately/useTimeFieldState'

import type {
  DateSegmentsProps,
  SegmentDrawing,
  SegmentsHandle,
} from '../../segments'
import type { ResolvedTheme } from '../../theme/scope'
import type { TimeFieldProps } from '../time-field'

import { ButtonSlotContext } from '../../button/slots'
import { ClockGlyph, KeyboardGlyph } from '../../glyphs'
import { messagesFor } from '../../i18n'
import { useLocaleOf } from '../../i18n/provider'
import {
  insetsOf,
  ModalWindow,
  NO_INSETS,
  panelRoleOf,
  useModalState,
} from '../../modal'
import { usePanelShown, usePanelStyle } from '../../overlay/panel'
import { roomOf } from '../../picker'
import { usePressFeedback } from '../../press'
import { DateSegments } from '../../segments'
import { SegmentedField } from '../../segments/field'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'
import { Button } from '../button'
import { IconButton } from '../icon-button'

// kanso-ui's TimePicker, the time pickers page's picker: TimeField's
// segments, with a clock button in the field's trailing slot that opens the
// page's modal over a scrim. A time is typed into the field or picked in the
// modal, and the modal's OK is what writes a picked time back.
//
// **Modal at every width.** The page has no docked time picker, so unlike
// DatePicker nothing here changes with the window's size: the container is
// centred over the scrim on a phone and on a tablet alike, in a React Native
// `Modal` through src/modal, as Dialog's is.
//
// **The modal is the page's vertical layout, in both of its variants.** The
// dial: a label medium headline on surface variant, then the time selector,
// an hour and a minute box, 96 by 80dp at the small corner in display large,
// on surface container highest and on primary container once selected, with
// 24dp for the colon between, and beside them the period selector, 52 by
// 80dp, outlined, its chosen half on tertiary container. Under them, 36dp
// down, the 256dp dial on surface container highest: labels in body large,
// the 48dp handle and 2dp hand in primary, an 8dp centre, and the label under
// the handle in on primary. The input variant drops the dial and draws the
// boxes as text fields, 96 by 72dp in display medium, the focused one on
// primary container with a 2dp primary outline, each named underneath in
// body small, and the period selector at the same 72dp. Both put the
// keyboard or clock toggle at the actions' start and the text buttons at
// their end, inside a container on surface container high at the
// extra-large corner, level 3, with 24dp of padding. A window too short for
// the dial scrolls the container rather than squeezing it.
//
// **The boxes are a time field of their own**, a second React Stately state
// drawn through src/segments, so they are typed into, stepped and read as
// TimeField's segments are, in both variants, which differ in how the boxes
// are drawn rather than in what they are. On the dial a press on a box picks
// which part the dial sets, without raising the keyboard; in the input
// variant it raises the number pad, as a field's segment does. The day
// period stays a part of that state but is not drawn, and the period
// selector beside the boxes stands in for it, as a radio group of the
// locale's two words for it. The dial is a pointer affordance over the boxes
// and is hidden from a screen reader, as web's is: everything it sets, the
// boxes set too.
//
// **The dial does not mirror.** A clock face is the same in either writing
// direction, so it is drawn and read in screen coordinates, three o'clock on
// the right, whatever direction the layout around it runs. The row above it
// follows the layout's own direction, so in a right-to-left layout the
// period selector sits on the left.
//
// Twenty-four hours put the day's second half on an inner ring, 12 at its
// top and 00 at the outer ring's, with no period selector, and whether there
// is one at all is the locale's or `hourCycle`'s, as it is in TimeField.

// The dial's geometry in dp, which is also its own coordinates: the radius
// of the outer and inner rings of labels and of the handle that sits on
// them. The inner ring sits far enough in that a handle on it clears the
// outer ring's labels.
const DIAL = 256
const CENTRE = DIAL / 2
const OUTER_RING = 101
const INNER_RING = 64
const HANDLE = 24

// The page's measurements that are its own rather than the scale's: the
// container's width, which is the 280dp time selector and the padding either
// side, the dial variant's box height, the colon's width, the period
// selector's width, and the gaps over the dial and under the headline.
const WIDTH = 328
const BOX_HEIGHT = 80
const COLON = 24
const PERIOD_WIDTH = 52
const DIAL_GAP = 36
const HEADLINE_GAP = 20

// The dot centring the hand, and the one on the handle between two of the
// minute labels.
const CENTRE_DOT = 4
const BETWEEN_DOT = 2

// How far a press moves before it is a drag rather than a tap: Gesture
// Handler's own default distance for a pan, as the slider's.
const SLOP = 10

// The parts the boxes draw. The day period is the period selector's.
const BOX_PARTS: ReadonlySet<DateSegmentType> = new Set(['hour', 'minute'])

// What describes the boxes after their value: nothing, since no line sits
// under them.
const UNDESCRIBED: DateSegmentsProps['described'] = []

const stylesOf = themedStyles(
  ({ colors, radii, shadows, sizing, spacing }: ResolvedTheme) =>
    StyleSheet.create({
      actions: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        justifyContent: 'space-between',
        marginTop: spacing.xl,
      },
      // An hour or a minute box.
      box: {
        alignItems: 'center',
        backgroundColor: colors.surfaceContainerHighest,
        borderRadius: radii.sm,
        height: BOX_HEIGHT,
        justifyContent: 'center',
        width: sizing.controlXl,
      },
      // The input variant's box: the text field the page draws there, which
      // is shorter.
      boxInput: {
        height: sizing.rowMd,
      },
      // The focused text field's outline, drawn inside the box.
      boxInputFocused: {
        borderColor: colors.primary,
        borderWidth: 2,
      },
      boxSelected: {
        backgroundColor: colors.primaryContainer,
      },
      boxText: {
        color: colors.onSurface,
        fontVariant: ['tabular-nums'],
      },
      boxTextSelected: {
        color: colors.onPrimaryContainer,
      },
      buttons: {
        flexDirection: 'row',
        gap: spacing.sm,
      },
      caption: {
        color: colors.onSurfaceVariant,
        width: sizing.controlXl,
      },
      captions: {
        flexDirection: 'row',
        gap: COLON,
        marginTop: spacing.sm,
      },
      // The colon between the boxes, in the boxes' type.
      colon: {
        color: colors.onSurface,
        textAlign: 'center',
        width: COLON,
      },
      // The page's container: its fill, corner and level, as wide as the
      // page's vertical layout and no wider or taller than the room it is
      // given.
      container: {
        backgroundColor: colors.surfaceContainerHigh,
        borderRadius: radii.xl,
        boxShadow: shadows.elevation3,
        maxHeight: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
        transformOrigin: 'center',
        width: WIDTH,
      },
      content: {
        padding: spacing.xl,
      },
      // The dial's square, its labels placed in screen coordinates. iOS and
      // Android turn a left into a right under a right-to-left layout, so
      // the square is laid out left to right there; a browser keeps a left
      // where it is and has no such style.
      dial: {
        alignSelf: 'center',
        ...(Platform.OS === 'web' ? undefined : { direction: 'ltr' }),
        height: DIAL,
        marginTop: DIAL_GAP,
        width: DIAL,
      },
      // A label's square, the handle's size, centred on its place on a ring.
      dialLabel: {
        alignItems: 'center',
        height: HANDLE * 2,
        justifyContent: 'center',
        position: 'absolute',
        width: HANDLE * 2,
      },
      dialLabels: {
        ...StyleSheet.absoluteFill,
        pointerEvents: 'none',
      },
      dialText: {
        color: colors.onSurface,
      },
      dialTextSelected: {
        color: colors.onPrimary,
      },
      headline: {
        color: colors.onSurfaceVariant,
        marginBottom: HEADLINE_GAP,
      },
      // The ring a focused half takes, drawn inside the selector, which
      // clips anything drawn past its edge.
      insetRing: {
        outlineOffset: -2,
      },
      // The container's room: centred in the window, clear of every edge
      // inside the safe area. It takes no touches itself, so a press around
      // the container reaches the scrim under it.
      layout: {
        alignItems: 'center',
        bottom: 0,
        justifyContent: 'center',
        left: 0,
        pointerEvents: 'box-none',
        position: 'absolute',
        right: 0,
        top: 0,
      },
      notDrawn: {
        display: 'none',
      },
      // The period selector: two halves stacked in one outlined box, the
      // locale's morning word above its afternoon one.
      period: {
        borderColor: colors.outline,
        borderRadius: radii.sm,
        borderWidth: 1,
        height: BOX_HEIGHT,
        overflow: 'hidden',
        width: PERIOD_WIDTH,
      },
      periodDivider: {
        borderTopColor: colors.outline,
        borderTopWidth: 1,
      },
      periodHalf: {
        alignItems: 'center',
        flexBasis: 0,
        flexGrow: 1,
        justifyContent: 'center',
      },
      periodInput: {
        height: sizing.rowMd,
      },
      periodSelected: {
        backgroundColor: colors.tertiaryContainer,
      },
      periodText: {
        color: colors.onSurfaceVariant,
      },
      periodTextSelected: {
        color: colors.onTertiaryContainer,
      },
      row: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: spacing.md,
        justifyContent: 'center',
      },
    }),
)

// One label on the dial, placed on its ring.
type DialLabel = {
  readonly isSelected: boolean
  readonly key: string
  readonly text: string
  readonly x: number
  readonly y: number
}

type DialProps = {
  readonly draft: TimeValue
  readonly locale: string
  /** Called with a press's place, in the dial's coordinates. */
  readonly onPick: (x: number, y: number) => void
  /** Called as a press that picked lets go. */
  readonly onRelease: () => void
  /** The part the dial sets. */
  readonly part: TimePart
  readonly testID: string | undefined
  readonly twelveHour: boolean
}

// What the modal's content is handed by the modal around it.
type ModalContentProps = {
  readonly cancelLabel: string
  readonly confirmLabel: string
  readonly defaultMode: TimePickerMode
  readonly enterTimeLabel: string
  /** The field's state, which the modal reads its time from and writes it to. */
  readonly field: TimeFieldState
  readonly fieldLabel: string
  readonly granularity: TimePart
  readonly headlineId: string
  readonly hourCycle: 12 | 24 | undefined
  readonly labelId: string
  readonly locale: string
  readonly motion: AnimatedStyle<ViewStyle>
  readonly onClose: () => void
  readonly placeholderValue: TimeValue | undefined
  readonly selectTimeLabel: string
  readonly setHeadline: (node: HostInstance | null) => void
  readonly testID: string | undefined
}

type ModalProps = Omit<
  ModalContentProps,
  'headlineId' | 'labelId' | 'motion' | 'onClose' | 'setHeadline'
> & {
  /** The picker's open state. */
  readonly state: OverlayTriggerState
  /** The clock button, which a screen reader goes back to once it has gone. */
  readonly trigger: HostInstance | null
}

type PeriodHalfProps = {
  readonly isAfternoon: boolean
  readonly isSelected: boolean
  readonly onChoose: (afternoon: boolean) => void
  readonly text: string
}

// The parts of a time the dial and the boxes set.
type TimePart = 'hour' | 'minute'

/** Which of the time pickers page's two variants the modal shows. */
type TimePickerMode = 'dial' | 'input'

type TimePickerProps<T extends TimeValue = TimeValue> = Omit<
  TimeFieldProps<T>,
  'trailingIcon'
> & {
  /**
   * What the modal's dismissing action says. Left out, it is the word for it
   * in the locale, "Cancel" in English.
   */
  readonly cancelLabel?: string
  /**
   * What the modal's confirming action says. Left out, it is the word for it
   * in the locale, "OK" in English.
   */
  readonly confirmLabel?: string
  /**
   * Which variant the modal opens on: the dial, or the boxes as text fields
   * to type into. The button at the modal's start switches between them.
   * @default 'dial'
   */
  readonly defaultMode?: TimePickerMode
  /** Whether the modal starts open, when it keeps its own state. */
  readonly defaultOpen?: boolean
  /**
   * The input variant's headline, which also names the button that switches
   * the dial to it. Left out, it is the locale's, "Enter time" in English.
   */
  readonly enterTimeLabel?: string
  /** Whether the modal is open, when the call site holds the state. */
  readonly isOpen?: boolean
  /** Called with the modal's new state as it opens or closes. */
  readonly onOpenChange?: (isOpen: boolean) => void
  /**
   * The dial's headline, which also names the clock button that opens the
   * modal, before the field's label, and the button that switches the input
   * variant back. Left out, it is the locale's, "Select time" in English.
   */
  readonly selectTimeLabel?: string
}

/**
 * A picked time as the field's state takes it, which is always a date and
 * time: a bare time is put on today, and the field takes the date off again
 * on the way out.
 */
function asDateTime(time: TimeValue): CalendarDateTime | ZonedDateTime {
  return 'day' in time
    ? time
    : toCalendarDateTime(today(getLocalTimeZone()), time)
}

// The clock button for the box's trailing slot. A call rather than JSX
// written at the prop, which is what react-perf's jsx-no-jsx-as-prop is
// after.
function clockOf({
  isDisabled,
  isOpen,
  label,
  onPress,
  ref,
}: {
  readonly isDisabled: boolean
  readonly isOpen: boolean
  readonly label: string
  readonly onPress: () => void
  readonly ref: (node: HostInstance | null) => void
}) {
  return (
    <IconButton
      aria-expanded={isOpen}
      aria-label={label}
      isDisabled={isDisabled}
      onPress={onPress}
      ref={ref}
    >
      <ClockGlyph />
    </IconButton>
  )
}

// The dial: the face, the hand and its handle in react-native-svg, and the
// labels over them, driven by a pan and a tap.
function Dial({
  draft,
  locale,
  onPick,
  onRelease,
  part,
  testID,
  twelveHour,
}: DialProps) {
  const theme = useTheme()
  const { colors } = theme
  const styles = stylesOf(theme)
  const role = useTypeRole('bodyLarge')
  const gesture = useDialGesture({ onPick, onRelease, testID })
  const labels = labelsFor(part, draft, locale, twelveHour)
  const between = part === 'minute' && draft.minute % 5 !== 0
  const handle =
    part === 'minute'
      ? polar(draft.minute / 60, OUTER_RING)
      : polar(
          (draft.hour % 12) / 12,
          !twelveHour && draft.hour >= 12 ? INNER_RING : OUTER_RING,
        )

  return (
    <GestureHandlerRootView style={styles.dial}>
      <GestureDetector gesture={gesture}>
        <View
          aria-hidden
          testID={testID === undefined ? undefined : `${testID}-dial`}
        >
          <Svg height={DIAL} viewBox={`0 0 ${DIAL} ${DIAL}`} width={DIAL}>
            <Circle
              cx={CENTRE}
              cy={CENTRE}
              fill={colors.surfaceContainerHighest}
              r={CENTRE}
            />
            <Line
              stroke={colors.primary}
              strokeWidth={2}
              x1={CENTRE}
              x2={handle.x}
              y1={CENTRE}
              y2={handle.y}
            />
            <Circle
              cx={CENTRE}
              cy={CENTRE}
              fill={colors.primary}
              r={CENTRE_DOT}
            />
            <Circle
              cx={handle.x}
              cy={handle.y}
              fill={colors.primary}
              r={HANDLE}
            />
            {between ? (
              <Circle
                cx={handle.x}
                cy={handle.y}
                fill={colors.onPrimary}
                r={BETWEEN_DOT}
              />
            ) : null}
          </Svg>
          <View style={styles.dialLabels}>
            {labels.map((label) => (
              <View
                key={label.key}
                style={composeStyles<ViewStyle>(
                  styles.dialLabel,
                  placeOf(label),
                )}
              >
                <NativeText
                  style={composeStyles<TextStyle>(
                    role,
                    label.isSelected
                      ? styles.dialTextSelected
                      : styles.dialText,
                  )}
                >
                  {label.text}
                </NativeText>
              </View>
            ))}
          </View>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  )
}

/** One label, placed a fraction of a turn round a ring. */
function dialLabel(
  key: string,
  text: string,
  isSelected: boolean,
  turn: number,
  radius: number,
): DialLabel {
  const { x, y } = polar(turn, radius)
  return { isSelected, key, text, x, y }
}

// How the boxes are drawn: the page's boxes in place of a field's line, the
// one selected on primary container, which on the dial is the part the dial
// sets and in the input variant the box being typed into, outlined besides.
function drawingOf(
  styles: ReturnType<typeof stylesOf>,
  role: StyleProp<TextStyle>,
  isDial: boolean,
  shown: TimePart,
): SegmentDrawing {
  const selected = (type: DateSegmentType, isActive: boolean) =>
    isDial ? type === shown : isActive

  return {
    box: (type, isActive) =>
      composeStyles<ViewStyle>(
        styles.box,
        isDial ? undefined : styles.boxInput,
        selected(type, isActive) ? styles.boxSelected : undefined,
        !isDial && isActive ? styles.boxInputFocused : undefined,
      ),
    literal: composeStyles<TextStyle>(role, styles.colon),
    parts: BOX_PARTS,
    raisesKeyboard: !isDial,
    text: (type, isActive) =>
      composeStyles<TextStyle>(
        role,
        styles.boxText,
        selected(type, isActive) ? styles.boxTextSelected : undefined,
      ),
  }
}

/** A part's name as the locale writes it, opening with a capital. */
function fieldName(name: string, locale: string) {
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1)
}

/**
 * The time the modal opens on: the field's own, else its placeholder, else
 * midnight. A date and time keeps its date, so the field gets back what it
 * holds.
 */
function initialTime(
  field: TimeFieldState,
  placeholderValue: TimeValue | undefined,
): TimeValue {
  const held = field.value
  if (held !== null && 'hour' in held) {
    return held
  }
  return placeholderValue ?? new Time()
}

/** The labels the dial draws for one part, in the locale's digits. */
function labelsFor(
  part: TimePart,
  time: TimeValue,
  locale: string,
  twelveHour: boolean,
): DialLabel[] {
  const steps = Array.from({ length: 12 }, (_, step) => step)

  if (part === 'minute') {
    const digits = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 })
    return steps.map((step) =>
      dialLabel(
        `m${step}`,
        digits.format(step * 5),
        time.minute === step * 5,
        step / 12,
        OUTER_RING,
      ),
    )
  }

  const hours = new DateFormatter(locale, {
    hour: 'numeric',
    hour12: twelveHour,
  })
  if (twelveHour) {
    return steps.map((step) =>
      dialLabel(
        `h${step}`,
        partOf(hours, step, 'hour'),
        time.hour % 12 === step,
        step / 12,
        OUTER_RING,
      ),
    )
  }
  return [
    ...steps.map((step) =>
      dialLabel(
        `h${step}`,
        partOf(hours, step, 'hour'),
        time.hour === step,
        step / 12,
        OUTER_RING,
      ),
    ),
    ...steps.map((step) =>
      dialLabel(
        `h${step + 12}`,
        partOf(hours, step + 12, 'hour'),
        time.hour === step + 12,
        step / 12,
        INNER_RING,
      ),
    ),
  ]
}

// The modal's content, mounted each time it opens: the time it was opened
// with is its draft until OK writes the draft into the field, or the modal
// closes without it.
function ModalContent({
  cancelLabel,
  confirmLabel,
  defaultMode,
  enterTimeLabel,
  field,
  fieldLabel,
  granularity,
  headlineId,
  hourCycle,
  labelId,
  locale,
  motion,
  onClose,
  placeholderValue,
  selectTimeLabel,
  setHeadline,
  testID,
}: ModalContentProps) {
  const theme = useTheme()
  const styles = stylesOf(theme)
  const headlineRole = useTypeRole('labelMedium')
  const captionRole = useTypeRole('bodySmall')
  const dialRole = useTypeRole('displayLarge')
  const inputRole = useTypeRole('displayMedium')
  const words = messagesFor(locale).segments
  const [draft, setDraft] = useState(() => initialTime(field, placeholderValue))
  const [mode, setMode] = useState(defaultMode)
  const [part, setPart] = useState<TimePart>('hour')
  const [content, setContent] = useState(0)
  const [room, setRoom] = useState(0)
  const boxes = useRef<SegmentsHandle>(null)
  const twelveHour = usesTwelveHours(locale, hourCycle)
  const showsMinutes = granularity === 'minute'
  const isDial = mode === 'dial'
  const isAfternoon = draft.hour >= 12
  const headline = isDial ? selectTimeLabel : enterTimeLabel
  const periods = new DateFormatter(locale, { hour: 'numeric', hour12: true })
  const state = useTimeFieldState({
    granularity,
    hideTimeZone: true,
    hourCycle,
    locale,
    onChange: (next: null | TimeValue) => {
      if (next !== null) {
        setDraft(next)
      }
    },
    shouldForceLeadingZeros: true,
    value: draft,
  })

  // Which part the dial sets, taken from the box in focus: a press on a box,
  // or the boxes moving on once an hour is typed.
  const follow = useCallback((type: DateSegmentType | null) => {
    if (type === 'hour' || type === 'minute') {
      setPart(type)
    }
  }, [])

  // A press on the dial sets the part it shows from where it lands: a
  // fraction of a turn clockwise from twelve, and on a 24-hour clock the
  // ring nearer it.
  const pick = useCallback(
    (x: number, y: number) => {
      const across = x - CENTRE
      const down = y - CENTRE
      const turn = (Math.atan2(across, -down) / (2 * Math.PI) + 1) % 1

      if (part === 'minute') {
        setDraft((time) => time.set({ minute: Math.round(turn * 60) % 60 }))
        return
      }
      const step = Math.round(turn * 12) % 12
      if (twelveHour) {
        setDraft((time) =>
          time.set({ hour: step + (time.hour >= 12 ? 12 : 0) }),
        )
        return
      }
      const inner = Math.hypot(across, down) < (OUTER_RING + INNER_RING) / 2
      setDraft((time) => time.set({ hour: inner ? step + 12 : step }))
    },
    [part, twelveHour],
  )

  // An hour picked on the dial moves on to the minutes, as the page does.
  const release = useCallback(() => {
    if (part === 'hour' && showsMinutes) {
      setPart('minute')
      boxes.current?.focusOn('minute', false)
    }
  }, [part, showsMinutes])

  // The other variant, with the box the dial sets in focus: typed into, with
  // the keyboard raised, or set on the dial, with it put away.
  const switchMode = useCallback(() => {
    setMode(isDial ? 'input' : 'dial')
    boxes.current?.focusOn(part, isDial)
  }, [isDial, part])

  // A half of the day keeps the hour on the clock's face, and choosing the
  // half the time is already in leaves it as it was.
  const choosePeriod = useCallback((afternoon: boolean) => {
    setDraft((time) =>
      time.set({ hour: (time.hour % 12) + (afternoon ? 12 : 0) }),
    )
  }, [])

  // OK writes the draft through the field's state, and its `slot` closes the
  // modal after.
  const confirm = useCallback(() => {
    field.setValue(asDateTime(draft))
  }, [draft, field])

  // The content's height against the room the container leaves it, so it
  // scrolls only when it does not fit, and a drag on the dial is never taken
  // for a scroll otherwise.
  const measureContent = useCallback((_: number, height: number) => {
    setContent(height)
  }, [])
  const measureRoom = useCallback((event: LayoutChangeEvent) => {
    setRoom(event.nativeEvent.layout.height)
  }, [])

  return (
    <Animated.View
      {...panelRoleOf('dialog', undefined)}
      aria-label={
        Platform.OS === 'web' ? undefined : `${headline}, ${fieldLabel}`
      }
      onAccessibilityEscape={onClose}
      style={composeStyles<AnimatedStyle<ViewStyle>>(styles.container, motion)}
      testID={testID === undefined ? undefined : `${testID}-modal`}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        onContentSizeChange={measureContent}
        onLayout={measureRoom}
        scrollEnabled={content > room}
      >
        <NativeText
          nativeID={headlineId}
          ref={setHeadline}
          role="heading"
          style={composeStyles<TextStyle>(headlineRole, styles.headline)}
        >
          {headline}
        </NativeText>
        {Platform.OS === 'web' ? (
          <NativeText nativeID={labelId} style={styles.notDrawn}>
            {fieldLabel}
          </NativeText>
        ) : null}
        <View style={styles.row}>
          <View>
            <DateSegments
              described={UNDESCRIBED}
              drawing={drawingOf(
                styles,
                isDial ? dialRole : inputRole,
                isDial,
                part,
              )}
              isInvalid={false}
              label={fieldLabel}
              locale={locale}
              onActiveChange={follow}
              ref={boxes}
              state={state}
            />
            {isDial ? null : (
              <View aria-hidden style={styles.captions}>
                <NativeText
                  style={composeStyles<TextStyle>(captionRole, styles.caption)}
                >
                  {fieldName(words.hour, locale)}
                </NativeText>
                {showsMinutes ? (
                  <NativeText
                    style={composeStyles<TextStyle>(
                      captionRole,
                      styles.caption,
                    )}
                  >
                    {fieldName(words.minute, locale)}
                  </NativeText>
                ) : null}
              </View>
            )}
          </View>
          {twelveHour ? (
            <View
              aria-label={words.dayPeriod}
              role="radiogroup"
              style={composeStyles<ViewStyle>(
                styles.period,
                isDial ? undefined : styles.periodInput,
              )}
            >
              <PeriodHalf
                isAfternoon={false}
                isSelected={!isAfternoon}
                onChoose={choosePeriod}
                text={partOf(periods, 9, 'dayPeriod')}
              />
              <PeriodHalf
                isAfternoon
                isSelected={isAfternoon}
                onChoose={choosePeriod}
                text={partOf(periods, 21, 'dayPeriod')}
              />
            </View>
          ) : null}
        </View>
        {isDial ? (
          <Dial
            draft={draft}
            locale={locale}
            onPick={pick}
            onRelease={release}
            part={part}
            testID={testID}
            twelveHour={twelveHour}
          />
        ) : null}
        <View style={styles.actions}>
          <IconButton
            aria-label={isDial ? enterTimeLabel : selectTimeLabel}
            onPress={switchMode}
          >
            {isDial ? <KeyboardGlyph /> : <ClockGlyph />}
          </IconButton>
          <View style={styles.buttons}>
            <Button slot="close" variant="text">
              {cancelLabel}
            </Button>
            <Button onPress={confirm} slot="close" variant="text">
              {confirmLabel}
            </Button>
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  )
}

/** The part of a formatted time a formatter writes for one hour of the day. */
function partOf(
  format: DateFormatter,
  hour: number,
  type: 'dayPeriod' | 'hour',
) {
  return (
    format
      .formatToParts(new Date(2000, 0, 1, hour))
      .find((each) => each.type === type)?.value ?? String(hour)
  )
}

// A half of the period selector: a radio of the selector's group, the
// afternoon's drawing the rule between the two.
function PeriodHalf({
  isAfternoon,
  isSelected,
  onChoose,
  text,
}: PeriodHalfProps) {
  const theme = useTheme()
  const styles = stylesOf(theme)
  const role = useTypeRole('titleMedium')
  const feedback = usePressFeedback({
    color: isSelected
      ? theme.colors.onTertiaryContainer
      : theme.colors.onSurfaceVariant,
  })
  const choose = useCallback(() => {
    onChoose(isAfternoon)
  }, [isAfternoon, onChoose])

  return (
    <Pressable
      aria-checked={isSelected}
      role="radio"
      {...feedback.handlers}
      onPress={choose}
      style={composeStyles<ViewStyle>(
        styles.periodHalf,
        isAfternoon ? styles.periodDivider : undefined,
        isSelected ? styles.periodSelected : undefined,
        feedback.ring,
        feedback.ring === undefined ? undefined : styles.insetRing,
      )}
    >
      {feedback.layer}
      <NativeText
        style={composeStyles<TextStyle>(
          role,
          isSelected ? styles.periodTextSelected : styles.periodText,
        )}
      >
        {text}
      </NativeText>
    </Pressable>
  )
}

// A label's square, its centre on the label's place.
function placeOf({ x, y }: DialLabel): ViewStyle {
  return { left: x - HANDLE, top: y - HANDLE }
}

/** Where a fraction of a turn clockwise from twelve lands on a ring. */
function polar(turn: number, radius: number) {
  const angle = turn * 2 * Math.PI
  return {
    x: CENTRE + radius * Math.sin(angle),
    y: CENTRE - radius * Math.cos(angle),
  }
}

/**
 * A time typed into a field, or picked in a modal behind the clock button at
 * the field's end: on a dial, or typed into the modal's larger boxes. The
 * value is an `@internationalized/date` value, as on web: pass `value` with
 * `onChange` to control it, or `defaultValue` to let it keep its own.
 *
 * ```tsx
 * import { Time } from '@internationalized/date'
 *
 * <TimePicker defaultValue={new Time(9, 30)} label="Label" />
 * ```
 *
 * The field is TimeField's, so `granularity`, `hourCycle`, `minValue` and
 * `maxValue` behave as they do there. The modal sets hours and minutes and
 * keeps the seconds a value already has; a time it writes back is checked
 * against the bounds as a typed one is. Whether it shows a twelve or
 * twenty-four hour clock is the locale's, through the `I18nProvider`, unless
 * `hourCycle` says otherwise.
 *
 * `style`, `ref` and `testID` land on the field as a whole.
 */
function TimePicker<T extends TimeValue = TimeValue>({
  cancelLabel,
  confirmLabel,
  defaultMode = 'dial',
  defaultOpen,
  enterTimeLabel,
  isDisabled = false,
  isOpen,
  isReadOnly = false,
  isRequired = false,
  locale,
  onOpenChange,
  selectTimeLabel,
  ...props
}: TimePickerProps<T>) {
  const writtenIn = useLocaleOf(locale)
  const words = messagesFor(writtenIn)
  const [trigger, setTrigger] = useState<HostInstance | null>(null)
  const state = useOverlayTriggerState({ defaultOpen, isOpen, onOpenChange })
  const field = useTimeFieldState<T>({
    ...props,
    isDisabled,
    isReadOnly,
    isRequired,
    locale: writtenIn,
  })
  const selectTime = selectTimeLabel ?? words.selectTime
  // oxlint-disable-next-line typescript/unbound-method -- React Stately's setters are callbacks, and read no `this`
  const { open } = state

  return (
    <>
      <SegmentedField
        {...props}
        errors={field.realtimeValidation.validationErrors}
        isDisabled={isDisabled}
        isEmpty={field.value === null}
        isReadOnly={isReadOnly}
        isRequired={isRequired}
        locale={writtenIn}
        state={field}
        // The time alone, as TimeField submits it.
        submitted={field.value === null ? '' : field.timeValue.toString()}
        trailingIcon={clockOf({
          isDisabled: isDisabled || isReadOnly,
          isOpen: state.isOpen,
          label: `${selectTime} ${props.label}`,
          onPress: open,
          ref: setTrigger,
        })}
      />
      <TimePickerModal
        cancelLabel={cancelLabel ?? words.cancel}
        confirmLabel={confirmLabel ?? words.confirm}
        defaultMode={defaultMode}
        enterTimeLabel={enterTimeLabel ?? words.enterTime}
        field={field}
        fieldLabel={props.label}
        granularity={props.granularity === 'hour' ? 'hour' : 'minute'}
        hourCycle={props.hourCycle}
        locale={writtenIn}
        placeholderValue={props.placeholderValue}
        selectTimeLabel={selectTime}
        state={state}
        testID={props.testID}
        trigger={trigger}
      />
    </>
  )
}

// The modal while it is open and while its exit runs: the window, the scrim
// and the container, centred in the room the safe area leaves. Its content
// is mounted afresh each time it opens.
function TimePickerModal({ state, trigger, ...props }: ModalProps) {
  const theme = useTheme()
  const styles = stylesOf(theme)
  const insets = use(SafeAreaInsetsContext) ?? NO_INSETS
  const headlineId = useId()
  const labelId = useId()
  const [headline, setHeadline] = useState<HostInstance | null>(null)
  const [opened, setOpened] = useState({ count: 0, isOpen: state.isOpen })
  const { close, present, setPresent, slots } = useModalState(
    { state, trigger },
    {},
  )
  const shown = usePanelShown(state.isOpen, true, setPresent)
  const motion = usePanelStyle(shown)
  const scrim = useAnimatedStyle(() => {
    'worklet'
    return { opacity: shown.get() }
  })

  // Counts each opening, which the content is keyed by, so a modal opened
  // again while its exit still runs starts from the field's time again.
  if (opened.isOpen !== state.isOpen) {
    setOpened({
      count: opened.count + (state.isOpen ? 1 : 0),
      isOpen: state.isOpen,
    })
  }

  if (!present) {
    return null
  }

  return (
    <ModalWindow
      isKeyboardDismissDisabled={false}
      labelledBy={`${headlineId} ${labelId}`}
      onClose={close}
      onScrimPress={state.isOpen ? close : undefined}
      scrim={scrim}
      title={headline}
    >
      <View
        style={composeStyles<ViewStyle>(
          styles.layout,
          insetsOf(roomOf(insets, theme.spacing.sm)),
        )}
      >
        <ButtonSlotContext value={slots}>
          <ModalContent
            {...props}
            headlineId={headlineId}
            key={opened.count}
            labelId={labelId}
            motion={motion}
            onClose={close}
            setHeadline={setHeadline}
          />
        </ButtonSlotContext>
      </View>
    </ModalWindow>
  )
}

// The dial's gestures: a drag that sets the part as it moves and moves on
// as it lets go, and a tap that does both where it lands. Each lets go to
// the other, as the slider's track does.
function useDialGesture({
  onPick,
  onRelease,
  testID,
}: Pick<DialProps, 'onPick' | 'onRelease' | 'testID'>) {
  // Gesture Handler 3 deprecates these builders for hooks that version 2 does
  // not have, and the peer range admits both, so the builders stay while it
  // does.
  // oxlint-disable-next-line react/capitalized-calls, typescript/no-deprecated -- a builder named after its gesture, not a component; see above
  const pan = Gesture.Pan()
    .runOnJS(true)
    .onStart(({ x, y }) => {
      onPick(x, y)
    })
    .onUpdate(({ x, y }) => {
      onPick(x, y)
    })
    .onEnd(() => {
      onRelease()
    })
  // oxlint-disable-next-line react/capitalized-calls, typescript/no-deprecated -- as above
  const tap = Gesture.Tap()
    .maxDistance(SLOP)
    .runOnJS(true)
    .onEnd(({ x, y }, success) => {
      if (success) {
        onPick(x, y)
        onRelease()
      }
    })

  // oxlint-disable-next-line react/capitalized-calls, typescript/no-deprecated -- as above
  return Gesture.Race(
    testID === undefined ? pan : pan.withTestId(`${testID}-dial-pan`),
    testID === undefined ? tap : tap.withTestId(`${testID}-dial-tap`),
  )
}

/**
 * Whether the clock has twelve hours. `hourCycle` decides when it is given,
 * as it does for the segments; otherwise the locale does.
 */
function usesTwelveHours(locale: string, hourCycle: 12 | 24 | undefined) {
  if (hourCycle !== undefined) {
    return hourCycle === 12
  }
  return (
    new DateFormatter(locale, { hour: 'numeric' }).resolvedOptions().hour12 ??
    false
  )
}

export type { TimePickerMode, TimePickerProps }

export { TimePicker }
