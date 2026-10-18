import type { ComponentRef, ReactNode } from 'react'
import type {
  HostInstance,
  MeasureInWindowOnSuccessCallback,
  StyleProp,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { EdgeInsets } from 'react-native-safe-area-context'
import type { TestInstance } from 'test-renderer'

import { CalendarDate, CalendarDateTime } from '@internationalized/date'
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
  BackHandler,
  Dimensions,
  Platform,
  StyleSheet,
  View,
} from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

import type { DatePickerProps } from '.'

import { DatePicker } from '.'
import { I18nProvider } from '../../i18n/provider'
import { ThemeScope } from '../../theme-scope'
import { scopeFor } from '../../theme/scope'
import { Button } from '../button'
import { Form } from '../form'

// What Android's back gesture is handed to.
type BackListener = Parameters<typeof BackHandler.addEventListener>[1]

type Frame = readonly [x: number, y: number, width: number, height: number]

// What React Native's Jest preset draws a View as: a class component holding
// its props, with the native methods on its prototype.
type MockedView = Pick<HostInstance, 'measureInWindow'> & {
  readonly props: ViewProps
}

const { theme } = scopeFor('light', {})
const { colors, motion, radii, shadows, spacing } = theme

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

// A fixed date, so every case reads the same whenever it runs, and a clock
// in another month, so no date the cases press is today.
const DATE = new CalendarDate(2026, 9, 15)
const NOW = new Date(2026, 9, 17, 12)

const AFTER = new CalendarDate(2027, 1, 1)
const BACK_PRESS = { timeStamp: 0, type: 'hardwareBackPress' }
const CALL_SITE = { marginTop: 4 }
const INSETS: EdgeInsets = { bottom: 34, left: 12, right: 8, top: 47 }
const MAX = new CalendarDate(2026, 9, 25)
const MIN = new CalendarDate(2026, 9, 8)
const TIME = new CalendarDateTime(2026, 9, 15, 9, 30)
const TWO_MONTHS = { months: 2 }

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

// The hidden input that takes the keys on iOS and Android, which holds one
// space.
function input() {
  return screen.getByDisplayValue(' ', {
    includeHiddenElements: true,
    normalizer: (text) => text,
  })
}

function isMockedView(value: unknown): value is MockedView {
  return (
    typeof value === 'object' && value !== null && 'measureInWindow' in value
  )
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

// Renders a picker inside a theme, whose host the docked calendar draws in.
async function renderPicker(
  props: Partial<DatePickerProps> = {},
  wrap?: (children: ReactNode) => ReactNode,
) {
  const picker = (
    <DatePicker
      defaultValue={DATE}
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

// The scrim, the first thing the `Modal` draws.
function scrim() {
  return child(modal().children[0])
}

function segmentOf(name: string) {
  return screen.getByLabelText(`${name}, Label`)
}

// What each segment shows, in the order they are drawn: a segment's text is
// its first child's.
function shown() {
  return screen
    .getAllByRole(Platform.OS === 'web' ? 'spinbutton' : 'adjustable')
    .map((segment) => {
      const text = child(segment.children.at(0)).children.at(0)
      return typeof text === 'string' ? text : undefined
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

// Types each key into the hidden input, as the keyboard hands them over one
// change at a time after the space it holds.
async function typeKeys(keys: string) {
  for (const key of keys) {
    // oxlint-disable-next-line no-await-in-loop -- each key is an act of its own, and two acts may not overlap
    await fireEvent.changeText(input(), ` ${key}`)
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

describe('DatePicker', () => {
  describe('the field', () => {
    it("draws the date in DateField's segments, and an empty picker's placeholders", async () => {
      await renderPicker()

      expect(shown()).toEqual(['9', '15', '2026'])

      await renderPicker({ defaultValue: undefined })

      expect(shown()).toEqual(['mm', 'dd', 'yyyy'])
    })

    it('stays editable, and a date typed there is the one the calendar holds', async () => {
      const onChange = jest.fn()

      await renderPicker({ onChange })
      await fireEvent.press(segmentOf('day'))
      await typeKeys('20')

      expect(shown()).toEqual(['9', '20', '2026'])
      expect(onChange).toHaveBeenLastCalledWith(new CalendarDate(2026, 9, 20))

      await fireEvent.press(calendarButton())

      expect(dateNamed('Sunday, September 20, 2026 selected')).toBeEnabled()
    })

    it('ends the box in a button naming the calendar and the label, saying whether it is open', async () => {
      await renderPicker()

      expect(calendarButton()).toBeEnabled()
      expect(calendarButton()).toBeCollapsed()
      expect(
        calendarButton().queryAll((node) => node.type === 'RNSVGSvgView'),
      ).toHaveLength(1)

      await fireEvent.press(calendarButton())

      expect(calendarButton()).toBeExpanded()
    })

    it('calls the button what triggerLabel says, before the label', async () => {
      await renderPicker({ triggerLabel: 'Pick a date' })

      expect(calendarButton('Pick a date Label')).toBeEnabled()
    })

    it("names the button and draws the calendar in the locale's words, the prop's or the provider's", async () => {
      await renderPicker({ defaultOpen: true, locale: 'de-DE' })

      expect(calendarButton('Kalender Label')).toBeEnabled()
      expect(dateNamed('Sonntag, 20. September 2026')).toBeEnabled()

      await renderPicker({ locale: undefined }, (children) => (
        <I18nProvider locale="ja-JP">{children}</I18nProvider>
      ))

      expect(calendarButton('カレンダー Label')).toBeEnabled()
    })

    it('disables the button while the picker is disabled or read only', async () => {
      await renderPicker({ isDisabled: true })

      expect(calendarButton()).toBeDisabled()

      await renderPicker({ isReadOnly: true })

      expect(calendarButton()).toBeDisabled()
    })

    it('takes no date from a calendar opened while the picker is disabled or read only', async () => {
      await renderPicker({ defaultOpen: true, isDisabled: true })

      expect(dateNamed('Sunday, September 20, 2026')).toBeDisabled()

      await renderPicker({ defaultOpen: true, isReadOnly: true })
      await laidOut()
      await fireEvent.press(dateNamed('Sunday, September 20, 2026'))

      expect(shown()).toEqual(['9', '15', '2026'])
    })

    it('puts style, ref and testID on the picker as a whole', async () => {
      const ref = createRef<ComponentRef<typeof View>>()

      await renderPicker({ ref, style: CALL_SITE })

      const picker = screen.getByTestId('picker')

      expect(styleOf(picker)).toMatchObject(CALL_SITE)
      expect(testIdOf(ref.current)).toBe('picker')
      expect(picker).toContainElement(calendarButton())
    })
  })

  describe('docked, from the medium window size up', () => {
    it('opens under the box as a dialog named like its button, on the calendar fill at the third elevation', async () => {
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
        transformOrigin: 'top',
      })
      expect(dateNamed('Tuesday, September 15, 2026 selected')).toBeEnabled()
    })

    it('fades in once placed, and goes once its exit has run', async () => {
      await renderPicker()

      await fireEvent.press(calendarButton())

      expect(getAnimatedStyle(surface())).toMatchObject({ opacity: 0 })

      await laidOut()
      await advance(motion.durationShort3)

      expect(getAnimatedStyle(surface())).toMatchObject({ opacity: 1 })

      await fireEvent.press(layer())

      expect(calendarButton()).toBeCollapsed()
      expect(surface()).toBeOnTheScreen()

      await advance(motion.durationShort2)

      expect(
        screen.queryByRole('button', { name: 'Tuesday, September 1, 2026' }),
      ).not.toBeOnTheScreen()
    })

    it('fills the segments with a date pressed in the calendar, and closes', async () => {
      const onChange = jest.fn()

      await renderPicker({ onChange })
      await fireEvent.press(calendarButton())
      await laidOut()
      await fireEvent.press(dateNamed('Sunday, September 20, 2026'))

      expect(shown()).toEqual(['9', '20', '2026'])
      expect(onChange).toHaveBeenCalledWith(new CalendarDate(2026, 9, 20))
      expect(calendarButton()).toBeCollapsed()
    })

    it('stays open on a pressed date when shouldCloseOnSelect is false', async () => {
      await renderPicker({ shouldCloseOnSelect: false })
      await fireEvent.press(calendarButton())
      await laidOut()
      await fireEvent.press(dateNamed('Sunday, September 20, 2026'))

      expect(shown()).toEqual(['9', '20', '2026'])
      expect(calendarButton()).toBeExpanded()
      expect(dateNamed('Sunday, September 20, 2026 selected')).toBeEnabled()
    })

    it('keeps the time the segments hold when a date is pressed', async () => {
      await renderPicker({ defaultValue: TIME, granularity: 'minute' })
      await fireEvent.press(calendarButton())
      await laidOut()
      await fireEvent.press(dateNamed('Sunday, September 20, 2026'))

      expect(shown()).toEqual(['9', '20', '2026', '9', '30', 'AM'])
      expect(calendarButton()).toBeCollapsed()
    })

    it("fills a time not yet typed from placeholderValue's", async () => {
      await renderPicker({
        defaultValue: undefined,
        granularity: 'minute',
        placeholderValue: TIME,
      })
      await fireEvent.press(calendarButton())
      await laidOut()
      await fireEvent.press(dateNamed('Sunday, September 20, 2026'))

      expect(shown()).toEqual(['9', '20', '2026', '9', '30', 'AM'])
    })

    it("opens an empty picker on placeholderValue's month", async () => {
      await renderPicker({ defaultValue: undefined, placeholderValue: AFTER })
      await fireEvent.press(calendarButton())

      expect(dateNamed('Friday, January 1, 2027')).toBeEnabled()
    })

    it('hands the calendar its name, the bounds, the first weekday, its menus and its months', async () => {
      await renderPicker({
        defaultOpen: true,
        firstDayOfWeek: 'mon',
        isDateUnavailable: (date) => date.day === 20,
        maxValue: MAX,
        minValue: MIN,
        showMonthYearMenus: true,
      })

      expect(screen.getByLabelText('Label, September 2026')).toBeOnTheScreen()
      expect(dateNamed('Monday, September 7, 2026')).toBeDisabled()
      expect(
        dateNamed('Tuesday, September 8, 2026, First available date'),
      ).toBeEnabled()
      expect(
        dateNamed('Friday, September 25, 2026, Last available date'),
      ).toBeEnabled()
      expect(dateNamed('Saturday, September 26, 2026')).toBeDisabled()
      expect(dateNamed('Sunday, September 20, 2026')).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Sep month' })).toBeEnabled()
      expect(
        screen.getAllByRole('button', { name: /^\w+day, / }).at(0),
      ).toHaveAccessibleName('Monday, August 31, 2026')

      await renderPicker({ defaultOpen: true, visibleDuration: TWO_MONTHS })

      expect(dateNamed('Thursday, October 15, 2026')).toBeEnabled()
    })

    it('closes on the back gesture and on VoiceOver’s escape gesture', async () => {
      const listeners: BackListener[] = []

      jest
        .spyOn(BackHandler, 'addEventListener')
        .mockImplementation((_, listener) => {
          listeners.push(listener)
          return { remove: jest.fn() }
        })
      await renderPicker()
      await fireEvent.press(calendarButton())
      await laidOut()

      await act(() => {
        expect(listeners.at(-1)?.(BACK_PRESS)).toBe(true)
      })

      expect(calendarButton()).toBeCollapsed()

      await advance(motion.durationShort2)
      await fireEvent.press(calendarButton())
      await laidOut()
      await fireEvent(surface(), 'accessibilityEscape')

      expect(calendarButton()).toBeCollapsed()
    })

    it('sends a screen reader to the date held once placed, and back to the button once it has gone', async () => {
      await renderPicker()
      await fireEvent.press(calendarButton())

      expect(focusSentTo()).toEqual([])

      await laidOut()

      expect(focusSentTo()).toEqual([
        'focus button Tuesday, September 15, 2026 selected',
      ])

      await fireEvent.press(layer())
      await advance(motion.durationShort2)

      expect(focusSentTo()).toEqual([
        'focus button Tuesday, September 15, 2026 selected',
        'focus button Calendar Label',
      ])
    })

    it('sends a screen reader to the date in its own month where two months show', async () => {
      await renderPicker({
        defaultValue: new CalendarDate(2026, 9, 28),
        visibleDuration: TWO_MONTHS,
      })
      await fireEvent.press(calendarButton())
      await laidOut()

      expect(focusSentTo()).toEqual([
        'focus button Monday, September 28, 2026 selected',
      ])
    })

    it('sends a screen reader to the date an empty picker opens on, and not again as the month moves', async () => {
      await renderPicker({
        defaultValue: undefined,
        placeholderValue: new CalendarDate(2026, 9, 10),
      })
      await fireEvent.press(calendarButton())
      await laidOut()
      await fireEvent.press(screen.getByRole('button', { name: 'Next' }))

      expect(dateNamed('Saturday, October 10, 2026')).toBeEnabled()
      expect(focusSentTo()).toEqual([
        'focus button Thursday, September 10, 2026',
      ])
    })
  })

  describe('modal, below the medium window size', () => {
    beforeEach(() => {
      resize(COMPACT)
    })

    it('opens in a Modal, centred over the scrim and 16dp inside the safe area', async () => {
      await renderPicker({}, (children) => (
        <SafeAreaInsetsContext value={INSETS}>{children}</SafeAreaInsetsContext>
      ))
      await fireEvent.press(calendarButton())

      expect(modal().props.visible).toBe(true)
      expect(surface().props).toMatchObject({
        'aria-label': 'Calendar Label',
        'aria-modal': true,
        role: 'dialog',
      })
      expect(styleOf(surface())).toMatchObject({
        backgroundColor: colors.surfaceContainerHigh,
        borderRadius: radii.lg,
        boxShadow: shadows.elevation3,
        maxWidth: '100%',
      })
      expect(styleOf(child(surface().parent ?? undefined))).toMatchObject({
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: INSETS.bottom + spacing.lg,
        paddingEnd: INSETS.right + spacing.lg,
        paddingStart: INSETS.left + spacing.lg,
        paddingTop: INSETS.top + spacing.lg,
      })
    })

    it('closes on a press on the scrim and on the back gesture, fading out with it', async () => {
      await renderPicker()
      await fireEvent.press(calendarButton())

      expect(getAnimatedStyle(scrim())).toMatchObject({ opacity: 0 })

      await advance(motion.durationShort3)

      expect(getAnimatedStyle(scrim())).toMatchObject({ opacity: 1 })

      await fireEvent.press(scrim())

      expect(calendarButton()).toBeCollapsed()

      await advance(motion.durationShort2)

      expect(
        screen.queryByRole('button', { name: 'Tuesday, September 1, 2026' }),
      ).not.toBeOnTheScreen()

      await fireEvent.press(calendarButton())
      await fireEvent(modal(), 'requestClose')

      expect(calendarButton()).toBeCollapsed()
    })

    it('sends a screen reader to the date held once the window shows, and back to the button once it has gone', async () => {
      await renderPicker()
      await fireEvent.press(calendarButton())
      await fireEvent(modal(), 'show')

      expect(focusSentTo()).toEqual([
        'focus button Tuesday, September 15, 2026 selected',
      ])

      await fireEvent.press(scrim())
      await advance(motion.durationShort2)

      expect(focusSentTo()).toEqual([
        'focus button Tuesday, September 15, 2026 selected',
        'focus button Calendar Label',
      ])
    })

    it('fills the segments with a date pressed in the calendar, and closes', async () => {
      await renderPicker()
      await fireEvent.press(calendarButton())
      await fireEvent.press(dateNamed('Sunday, September 20, 2026'))

      expect(shown()).toEqual(['9', '20', '2026'])
      expect(calendarButton()).toBeCollapsed()
    })

    it('fills a time with midnight where neither the value nor placeholderValue holds one', async () => {
      await renderPicker({ defaultValue: undefined, granularity: 'minute' })
      await fireEvent.press(calendarButton())
      await fireEvent.press(dateNamed('Tuesday, October 20, 2026'))

      expect(shown()).toEqual(['10', '20', '2026', '12', '00', 'AM'])
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

      expect(dateNamed('Tuesday, September 15, 2026 selected')).toBeEnabled()
    })

    it('shows the value it is handed in the segments and the calendar alike', async () => {
      await renderPicker({ defaultOpen: true, value: DATE })

      expect(shown()).toEqual(['9', '15', '2026'])
      expect(dateNamed('Tuesday, September 15, 2026 selected')).toBeEnabled()
    })
  })

  describe('in a form', () => {
    it('submits the date as ISO 8601 under its name', async () => {
      const onSubmit = jest.fn()

      await render(
        <ThemeScope>
          <Form onSubmit={onSubmit}>
            <DatePicker
              defaultValue={DATE}
              label="Label"
              locale="en-US"
              name="date"
            />
            <Button type="submit">Submit</Button>
          </Form>
        </ThemeScope>,
      )
      await submit()

      expect(onSubmit).toHaveBeenCalledWith({ date: '2026-09-15' })
    })

    it('holds a native form back while a required picker is empty', async () => {
      const onSubmit = jest.fn()

      await render(
        <ThemeScope>
          <Form onSubmit={onSubmit} validationBehavior="native">
            <DatePicker isRequired label="Label" locale="en-US" name="date" />
            <Button type="submit">Submit</Button>
          </Form>
        </ThemeScope>,
      )
      await submit()

      expect(onSubmit).not.toHaveBeenCalled()
      expect(
        screen.getByText('Fill out this field.', {
          includeHiddenElements: true,
        }),
      ).toBeOnTheScreen()
    })
  })
})
