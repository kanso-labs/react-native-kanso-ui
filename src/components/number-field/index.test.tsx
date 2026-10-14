import type { ComponentRef, ReactElement } from 'react'
import type {
  KeyboardTypeOptions,
  StyleProp,
  TextInput,
  TextStyle,
  ViewStyle,
} from 'react-native'

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
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { NumberFieldProps } from '.'
import type { FieldVariant } from '../../field'

import { NumberField } from '.'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const {
  colors,
  motion,
  radii,
  sizing,
  spacing,
  stateLayerOpacity,
  typography,
} = theme

const DISABLED_CONTENT = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContent,
)

// The device's text size under the suite: React Native's Jest preset reports
// a font scale of 2, so every line the box is built from is twice its token.
const FONT_SCALE = 2

const CALL_SITE = { marginTop: 4 }

// A press with no point on the page, on a stepper that measures nothing, so
// the ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// React Aria's timings for a stepper held by touch.
const SPIN_DELAY = 600
const SPIN_INTERVAL = 60

type Host = ReturnType<typeof screen.getByTestId>

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// The box: the pressable inside the field's root.
function box() {
  return hostsOf(hostsOf(screen.getByTestId('field'))[0])[0]
}

// The label and the control's column, which comes before the steppers.
function column() {
  return hostsOf(box()).at(-2) ?? missing('column')
}

function decrease(name = 'Label') {
  return screen.getByLabelText(`Decrease ${name}`)
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

// The field in a view the cases find it by.
function fieldOf(props: Partial<NumberFieldProps>): ReactElement {
  return (
    <View testID="field">
      <NumberField label="Label" locale="en-US" {...props} />
    </View>
  )
}

function flatStyleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle | ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

// What a stepper draws last: its glyph.
function glyphOf(stepper: Host) {
  return hostsOf(stepper).at(-1) ?? missing('glyph')
}

// An element's children that are elements, rather than text.
function hostsOf(element: Host | undefined): Host[] {
  if (element === undefined) {
    return missing('element')
  }
  return element.children.filter((child) => typeof child !== 'string')
}

function increase(name = 'Label') {
  return screen.getByLabelText(`Increase ${name}`)
}

function input() {
  return screen.getByLabelText('Label')
}

function isDisabled(element: Host) {
  const state: unknown = element.props.accessibilityState

  return (
    typeof state === 'object' &&
    state !== null &&
    'disabled' in state &&
    state.disabled === true
  )
}

// The label as it is drawn, which is hidden from screen readers.
function label() {
  return hostsOf(hostsOf(column())[0])[0]
}

function missing(what: string): never {
  throw new TypeError(`expected the field to draw its ${what}`)
}

async function renderField(
  props: Partial<NumberFieldProps> = {},
): Promise<{ rerender: (next: Partial<NumberFieldProps>) => Promise<void> }> {
  const view = await render(fieldOf(props))

  return {
    rerender: async (next) => {
      await view.rerender(fieldOf(next))
    },
  }
}

// Advances one spin interval at a time, rendering between them as the
// device does between two timers that far apart.
async function spin(intervals: number): Promise<void> {
  if (intervals === 0) {
    return
  }
  await advance(SPIN_INTERVAL)
  await spin(intervals - 1)
}

// The steppers, the last thing the box draws.
function steppers() {
  return hostsOf(box()).at(-1) ?? missing('steppers')
}

// What an element draws: its style, with what Reanimated drives on top.
function styleOf(element: Host): Record<string, unknown> {
  return { ...flatStyleOf(element), ...getAnimatedStyle(element) }
}

// Types into the field, as a keystroke does.
async function type(text: string) {
  await fireEvent.changeText(input(), text)
}

function valueOf() {
  return input().props.value as unknown
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  // The preset's AccessibilityInfo is a mock already, which spyOn hands back
  // as it is and restoring leaves holding its calls.
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('NumberField', () => {
  it('is a text input named by its label, holding its value formatted', async () => {
    await renderField({ defaultValue: 1234.5 })

    expect(input().type).toBe('TextInput')
    expect(valueOf()).toBe('1,234.5')
    expect(input().props).toMatchObject({
      autoComplete: 'off',
      autoCorrect: false,
      returnKeyType: 'done',
      spellCheck: false,
    })
  })

  it('formats what is typed once it loses focus, and reports the number', async () => {
    const onBlur = jest.fn()
    const onChange = jest.fn()
    await renderField({ onBlur, onChange })

    await fireEvent(input(), 'focus', {})
    await type('1234.5')
    expect(valueOf()).toBe('1234.5')
    expect(onChange).not.toHaveBeenCalled()

    await fireEvent(input(), 'blur', {})
    expect(valueOf()).toBe('1,234.5')
    expect(onChange).toHaveBeenCalledWith(1234.5)
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  it('commits on the return key, ahead of the handler it is given', async () => {
    const onChange = jest.fn()
    const values: unknown[] = []
    await renderField({
      onChange,
      onSubmitEditing: () => {
        values.push(onChange.mock.calls.length)
      },
    })

    await type('12.50')
    await fireEvent(input(), 'submitEditing', {})

    expect(valueOf()).toBe('12.5')
    expect(onChange).toHaveBeenCalledWith(12.5)
    expect(values).toEqual([1])
  })

  it('reads and writes the value in its locale', async () => {
    const onChange = jest.fn()
    await renderField({ defaultValue: 1, locale: 'de-DE', onChange })

    expect(valueOf()).toBe('1')
    await type('1.234,5')
    await fireEvent(input(), 'blur', {})

    expect(onChange).toHaveBeenCalledWith(1234.5)
    expect(valueOf()).toBe('1.234,5')
  })

  it.each<[string, Intl.NumberFormatOptions, number, string]>([
    ['a currency', { currency: 'EUR', style: 'currency' }, 1234.5, '€1,234.50'],
    ['a unit', { style: 'unit', unit: 'inch' }, 3, '3 in'],
    ['a percentage', { style: 'percent' }, 0.5, '50%'],
  ])(
    'writes %s as the format says',
    async (_name, formatOptions, defaultValue, text) => {
      await renderField({ defaultValue, formatOptions })

      expect(valueOf()).toBe(text)
    },
  )

  it('steps a percentage by a whole percent', async () => {
    await renderField({
      defaultValue: 0.5,
      formatOptions: { style: 'percent' },
    })

    await fireEvent.press(increase())
    expect(valueOf()).toBe('51%')
  })

  it('keeps a keystroke only where the text could still become a number', async () => {
    await renderField({ defaultValue: 3, minValue: 0 })

    await type('3a')
    expect(valueOf()).toBe('3')
    await type('1.2.3')
    expect(valueOf()).toBe('3')
    // No minus where the range does not reach below zero.
    await type('-')
    expect(valueOf()).toBe('3')
    await type('4.')
    expect(valueOf()).toBe('4.')
  })

  it('puts text that reads as no number back, and empties an empty field', async () => {
    const onChange = jest.fn()
    await renderField({ defaultValue: 3, onChange })

    await type('-')
    await fireEvent(input(), 'blur', {})
    expect(valueOf()).toBe('3')
    expect(onChange).not.toHaveBeenCalled()

    await type('')
    await fireEvent(input(), 'blur', {})
    expect(valueOf()).toBe('')
    expect(onChange).toHaveBeenCalledWith(Number.NaN)
  })

  it('clamps a committed value to its range, and snaps it to its step', async () => {
    const onChange = jest.fn()
    await renderField({ maxValue: 10, minValue: 2, onChange, step: 2 })

    await type('25')
    await fireEvent(input(), 'blur', {})
    expect(valueOf()).toBe('10')

    await type('1')
    await fireEvent(input(), 'blur', {})
    expect(valueOf()).toBe('2')

    await type('5')
    await fireEvent(input(), 'blur', {})
    expect(valueOf()).toBe('6')
    expect(onChange.mock.calls).toEqual([[10], [2], [6]])
  })

  it('shows the value it is given, reporting a change without keeping it', async () => {
    const onChange = jest.fn()
    const { rerender } = await renderField({ onChange, value: 5 })

    await fireEvent.press(increase())
    expect(onChange).toHaveBeenCalledWith(6)
    expect(valueOf()).toBe('5')

    await rerender({ onChange, value: 6 })
    expect(valueOf()).toBe('6')
  })

  it('puts the style and ref on the field, and hands inputRef the control', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    const inputRef = createRef<ComponentRef<typeof TextInput>>()
    await render(
      <NumberField
        inputRef={inputRef}
        label="Label"
        ref={ref}
        style={CALL_SITE}
        testID="control"
      />,
    )

    expect(screen.root?.props.style).toEqual(CALL_SITE)
    expect(ref.current).not.toBeNull()
    expect(inputRef.current).not.toBeNull()
    expect(screen.getByTestId('control')).toBe(input())
  })

  it('cannot be edited or stepped while disabled or read only', async () => {
    const { rerender } = await renderField({
      defaultValue: 3,
      isDisabled: true,
    })

    expect(input().props.editable).toBe(false)
    expect(isDisabled(increase())).toBe(true)
    expect(isDisabled(decrease())).toBe(true)

    await rerender({ defaultValue: 3, isReadOnly: true })
    expect(input().props.editable).toBe(false)
    expect(isDisabled(increase())).toBe(true)
    expect(isDisabled(decrease())).toBe(true)
  })

  it('hands the chrome its description, its error and its states', async () => {
    const { rerender } = await renderField({
      description: 'Supporting line',
      isRequired: true,
    })

    expect(input().props.accessibilityHint).toBe('Supporting line')
    expect(
      screen.getAllByText('Label*', { includeHiddenElements: true }),
    ).toHaveLength(1)

    await rerender({ description: 'Supporting line', error: 'Enter a number.' })
    await advance(motion.durationShort3)
    expect(input().props.accessibilityHint).toBe('Enter a number.')
    expect(styleOf(label())).toMatchObject({ color: eased(colors.error) })
  })

  it('floats the label over a value, and rests it in an empty box', async () => {
    await renderField({ defaultValue: 3 })
    expect(styleOf(label())).toMatchObject({
      fontSize: typography.bodySmallSize,
      top: 0,
    })

    await type('')
    await advance(motion.durationShort3)
    expect(styleOf(label())).toMatchObject({
      fontSize: typography.bodyLargeSize,
    })
  })

  it('keeps the label small at the top of an empty box, given floatingLabel={false}', async () => {
    const { rerender } = await renderField()
    expect(styleOf(label())).toMatchObject({
      fontSize: typography.bodyLargeSize,
    })

    await rerender({ floatingLabel: false })
    await advance(motion.durationShort3)
    expect(styleOf(label())).toMatchObject({
      fontSize: typography.labelMediumSize,
      top: 0,
    })
  })

  it('draws the value in tabular figures unless numeric is false', async () => {
    const { rerender } = await renderField({ defaultValue: 3 })
    expect(flatStyleOf(input())).toMatchObject({
      fontVariant: ['tabular-nums'],
    })

    await rerender({ defaultValue: 3, numeric: false })
    expect(flatStyleOf(input())).not.toHaveProperty('fontVariant')
  })

  describe('keyboard', () => {
    it.each<
      [
        string,
        'android' | 'ios',
        Partial<NumberFieldProps>,
        KeyboardTypeOptions,
      ]
    >([
      ['a range below zero, on iOS', 'ios', {}, 'numbers-and-punctuation'],
      ['a range below zero, on Android', 'android', {}, 'numeric'],
      ['a fraction and no negatives', 'ios', { minValue: 0 }, 'decimal-pad'],
      [
        'whole numbers and no negatives',
        'android',
        { formatOptions: { maximumFractionDigits: 0 }, minValue: 0 },
        'number-pad',
      ],
    ])('types %s', async (_name, os, props, keyboard) => {
      jest.replaceProperty(Platform, 'OS', os)
      await renderField(props)

      expect(input().props.keyboardType).toBe(keyboard)
    })
  })

  describe('steppers', () => {
    it('step the value by the step, each named by the field', async () => {
      const onChange = jest.fn()
      await renderField({ defaultValue: 10, onChange, step: 5 })

      await fireEvent.press(increase())
      expect(valueOf()).toBe('15')
      await fireEvent.press(decrease())
      await fireEvent.press(decrease())
      expect(valueOf()).toBe('5')
      expect(onChange.mock.calls).toEqual([[15], [10], [5]])
    })

    it('take the names they are given', async () => {
      await renderField({
        decrementLabel: 'Fewer',
        incrementLabel: 'More',
      })

      expect(screen.getByLabelText('More').props.role).toBe('button')
      expect(screen.getByLabelText('Fewer').props.role).toBe('button')
    })

    it('step from the text as typed, before it is committed', async () => {
      await renderField({ defaultValue: 1 })

      await type('41')
      await fireEvent.press(increase())
      expect(valueOf()).toBe('42')
    })

    it.each<[string, Partial<NumberFieldProps>, string]>([
      ['its minimum', { minValue: 3 }, '3'],
      ['zero', {}, '0'],
    ])('step an empty field from %s', async (_name, props, value) => {
      await renderField(props)

      await fireEvent.press(increase())
      expect(valueOf()).toBe(value)
    })

    it.each(['vertical', 'horizontal'] as const)(
      'disable the one that would pass the bound, %s',
      async (layout) => {
        const { rerender } = await renderField({
          defaultValue: 3,
          maxValue: 3,
          steppers: layout,
        })
        expect(isDisabled(increase())).toBe(true)
        expect(isDisabled(decrease())).toBe(false)

        await rerender({ defaultValue: 3, minValue: 3, steppers: layout })
        await fireEvent.press(decrease())
        expect(isDisabled(increase())).toBe(false)
        expect(isDisabled(decrease())).toBe(true)
        expect(valueOf()).toBe('3')
      },
    )

    it('keep stepping while held, and step nothing more on release', async () => {
      const onChange = jest.fn()
      await renderField({ defaultValue: 0, onChange })

      await fireEvent(increase(), 'pressIn', PRESS)
      await advance(SPIN_DELAY - 1)
      expect(valueOf()).toBe('0')
      await advance(1)
      expect(valueOf()).toBe('1')
      await spin(3)
      expect(valueOf()).toBe('4')

      await fireEvent(increase(), 'pressOut', {})
      await fireEvent.press(increase())
      await advance(SPIN_DELAY)
      expect(valueOf()).toBe('4')
      expect(onChange).toHaveBeenCalledTimes(4)

      // A tap after the hold steps as any tap does.
      await fireEvent(increase(), 'pressIn', PRESS)
      await fireEvent(increase(), 'pressOut', {})
      await fireEvent.press(increase())
      expect(valueOf()).toBe('5')
    })

    it('step once for a tap, and not at all for a press slid off', async () => {
      await renderField({ defaultValue: 0 })

      await fireEvent(decrease(), 'pressIn', PRESS)
      await fireEvent(decrease(), 'pressOut', {})
      await fireEvent.press(decrease())
      expect(valueOf()).toBe('-1')

      await fireEvent(decrease(), 'pressIn', PRESS)
      await fireEvent(decrease(), 'pressOut', {})
      await advance(SPIN_DELAY)
      expect(valueOf()).toBe('-1')
    })

    it('say nothing for a hold held on past the bound', async () => {
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation(() => undefined)
      await renderField({ defaultValue: 0, maxValue: 1 })

      await fireEvent(increase(), 'pressIn', PRESS)
      await advance(SPIN_DELAY)
      await spin(3)
      await fireEvent(increase(), 'pressOut', {})
      expect(announce.mock.calls).toEqual([['1']])

      // Nothing stepped since, so nothing typed is taken for a step's value.
      await type('0')
      expect(announce.mock.calls).toEqual([['1']])
    })

    it('stop a hold at the bound', async () => {
      await renderField({
        defaultValue: 0,
        maxValue: 2,
        steppers: 'horizontal',
      })

      await fireEvent(increase(), 'pressIn', PRESS)
      await advance(SPIN_DELAY)
      await spin(5)
      expect(valueOf()).toBe('2')
      expect(isDisabled(increase())).toBe(true)
    })

    it('say the value a press leaves, on iOS and Android alone', async () => {
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation(() => undefined)
      await renderField({ defaultValue: 1234.5 })

      await type('12')
      expect(announce).not.toHaveBeenCalled()
      await fireEvent.press(increase())
      expect(announce).toHaveBeenCalledWith('13')

      // Once: what is typed next is not said.
      announce.mockClear()
      await type('20')
      expect(announce).not.toHaveBeenCalled()

      jest.replaceProperty(Platform, 'OS', 'web')
      await fireEvent.press(increase())
      expect(valueOf()).toBe('21')
      expect(announce).not.toHaveBeenCalled()
    })

    it('show the box focused while one of them has focus', async () => {
      await renderField({ defaultValue: 3 })

      await fireEvent(increase(), 'focus', {})
      await advance(motion.durationShort3)
      expect(styleOf(label())).toMatchObject({ color: eased(colors.primary) })

      await fireEvent(increase(), 'blur', {})
      await advance(motion.durationShort3)
      expect(styleOf(label())).toMatchObject({
        color: eased(colors.onSurfaceVariant),
      })
    })

    it('come after the column, which ends 16dp before them', async () => {
      await renderField({ defaultValue: 3 })

      expect(hostsOf(steppers())).toEqual([increase(), decrease()])
      expect(flatStyleOf(box())).toMatchObject({ gap: spacing.lg })
    })
  })

  describe('stacked', () => {
    // A stepper's half of the box at the suite's text size.
    const FILLED_HALF =
      spacing.sm +
      ((typography.bodySmallLineHeight + typography.bodyLargeLineHeight) *
        FONT_SCALE) /
        2
    const OUTLINED_HALF =
      spacing.lg + (typography.bodyLargeLineHeight * FONT_SCALE) / 2

    it('reach out of the box padding to sit flush with its edges', async () => {
      const { rerender } = await renderField({ defaultValue: 3 })

      expect(flatStyleOf(steppers())).toMatchObject({
        alignSelf: 'stretch',
        marginEnd: -spacing.lg,
        marginStart: spacing.sm - spacing.lg,
        marginVertical: -spacing.sm,
      })

      await rerender({ defaultValue: 3, variant: 'outlined' })
      expect(flatStyleOf(steppers())).toMatchObject({
        marginVertical: -spacing.lg,
      })
    })

    it('are each half the column and 32dp wide, the plus over the minus', async () => {
      await renderField({ defaultValue: 3 })

      for (const stepper of [increase(), decrease()]) {
        expect(flatStyleOf(stepper)).toMatchObject({
          alignItems: 'center',
          flexBasis: 0,
          flexGrow: 1,
          justifyContent: 'center',
          width: 32,
        })
      }
      expect(glyphOf(increase()).props).toMatchObject({
        color: colors.onSurfaceVariant,
        height: 20,
        width: 20,
      })
    })

    it('take the box top-end corner, and the outlined box bottom-end one', async () => {
      const { rerender } = await renderField({ defaultValue: 3 })

      expect(flatStyleOf(increase())).toMatchObject({
        borderTopEndRadius: radii.xs,
      })
      expect(flatStyleOf(decrease()).borderBottomEndRadius).toBeUndefined()

      await rerender({ defaultValue: 3, variant: 'outlined' })
      expect(flatStyleOf(decrease())).toMatchObject({
        borderBottomEndRadius: radii.xs,
      })
    })

    it.each<[FieldVariant, number]>([
      ['filled', FILLED_HALF],
      ['outlined', OUTLINED_HALF],
    ])(
      'reach 48dp away from each other in the %s box',
      async (variant, half) => {
        await renderField({ defaultValue: 3, variant })
        const reach = Math.max(0, 48 - half)
        const across = (48 - 32) / 2

        expect(increase().props.hitSlop).toEqual({
          bottom: 0,
          left: across,
          right: across,
          top: reach,
        })
        expect(decrease().props.hitSlop).toEqual({
          bottom: reach,
          left: across,
          right: across,
          top: 0,
        })
      },
    )

    it('draw the glyph in on surface at the disabled opacity at the bound', async () => {
      await renderField({ defaultValue: 3, maxValue: 3 })

      expect(glyphOf(increase()).props).toMatchObject({
        color: DISABLED_CONTENT,
      })
      expect(glyphOf(decrease()).props).toMatchObject({
        color: colors.onSurfaceVariant,
      })
    })

    it('draw the ring inside the stepper', async () => {
      await renderField({ defaultValue: 3 })

      expect(flatStyleOf(increase()).outlineOffset).toBeUndefined()
      await fireEvent(increase(), 'focus', {})
      expect(flatStyleOf(increase())).toMatchObject({
        outlineColor: colors.primary,
        outlineOffset: -2,
      })
    })
  })

  describe('side by side', () => {
    it('sit 12dp from the end, 8dp apart, centred on the box', async () => {
      await renderField({ defaultValue: 3, steppers: 'horizontal' })

      expect(flatStyleOf(steppers())).toMatchObject({
        alignSelf: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        marginEnd: spacing.md - spacing.lg,
        marginStart: spacing.sm - spacing.lg,
        // The value's line in the box's height, whatever the buttons'.
        marginVertical:
          (typography.bodyLargeLineHeight * FONT_SCALE - sizing.controlXs) / 2,
      })
      // The minus, then the plus.
      expect(
        screen.getAllByLabelText(/^(?:Decrease|Increase) Label$/u),
      ).toEqual([decrease(), increase()])
    })
  })
})
