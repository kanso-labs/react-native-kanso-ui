import type { ComponentRef, ReactElement, ReactNode } from 'react'
import type {
  KeyboardTypeOptions,
  StyleProp,
  TextInput,
  TextStyle,
} from 'react-native'
import type { Color, ColorChannel, ColorSpace } from 'react-stately'

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
import { StyleSheet, View } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'
import { parseColor } from 'react-stately'

import type { ColorFieldProps } from '.'

import { ColorField } from '.'
import { I18nProvider } from '../../i18n/provider'
import { scopeFor } from '../../theme/scope'
import { Button } from '../button'
import { ColorSwatch } from '../color-swatch'
import { Form } from '../form'

const { theme } = scopeFor('light', {})
const { colors, motion, typography } = theme

const PURPLE = '#6750A4'
const GREEN = '#386A20'
const TRANSLUCENT = 'rgba(0, 170, 255, 0.6)'

const CALL_SITE = { marginTop: 4 }
// Hoisted, which is what react-perf's no-jsx-as-prop is after.
const SWATCH = <ColorSwatch color={PURPLE} />
const TRAILING = <View testID="trailing" />

type Host = ReturnType<typeof screen.getByTestId>

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

async function blur() {
  await fireEvent(input(), 'blur', {})
}

// The box: the pressable inside the field's root.
function box() {
  return hostsOf(hostsOf(screen.getByTestId('field'))[0])[0]
}

// A spy for the colour the field reports.
function changes() {
  return jest.fn<(value: Color | null) => void>()
}

// The label and the control's column, the last thing a box with no icons
// draws.
function column() {
  return hostsOf(box()).at(-1)
}

// A colour as Reanimated writes one it has eased to: `#rrggbb` comes out as
// `rgba(r, g, b, 1)`.
function eased(color: string) {
  const rgb = parseColor(color).toFormat('rgb')
  const channels = (['red', 'green', 'blue'] as const).map((channel) =>
    String(rgb.getChannelValue(channel)),
  )

  return `rgba(${channels.join(', ')}, 1)`
}

// The field in a view the cases find it by.
function fieldOf(props: Partial<ColorFieldProps>): ReactElement {
  return (
    <View testID="field">
      <ColorField label="Label" {...props} />
    </View>
  )
}

function hexOf(color: Color | null | undefined) {
  return color?.toString('hex')
}

// An element's children that are elements, rather than text.
function hostsOf(element: Host | undefined): Host[] {
  if (element === undefined) {
    throw new TypeError('expected the field to draw the element')
  }
  return element.children.filter((child) => typeof child !== 'string')
}

function input() {
  return screen.getByLabelText('Label')
}

// The label as it is drawn, which is hidden from screen readers.
function label() {
  return hostsOf(hostsOf(column())[0])[0]
}

// The last colour the field reported.
function lastColor(onChange: ReturnType<typeof changes>) {
  return onChange.mock.calls.at(-1)?.[0]
}

// A validate saying every colour is wrong, which a native form shows late.
function refuseAnyColour(color: Color | null) {
  return color === null ? true : 'Supporting line'
}

async function renderField(
  props: Partial<ColorFieldProps> = {},
): Promise<{ rerender: (next: Partial<ColorFieldProps>) => Promise<void> }> {
  const view = await render(fieldOf(props))

  return {
    rerender: async (next) => {
      await view.rerender(fieldOf(next))
    },
  }
}

// What an element draws: its style, with what Reanimated drives on top.
function styleOf(element: {
  props: { style?: StyleProp<TextStyle> }
}): Record<string, unknown> {
  return {
    ...StyleSheet.flatten([element.props.style]),
    ...getAnimatedStyle(element),
  }
}

async function submit() {
  await fireEvent.press(screen.getByRole('button', { name: 'Submit' }))
}

// Types into the field, as a keystroke does.
async function type(text: string) {
  await fireEvent.changeText(input(), text)
}

function valueOf() {
  return input().props.value as unknown
}

function withForm(children: ReactNode, props = {}) {
  return (
    <Form {...props}>
      {children}
      <Button type="submit">Submit</Button>
    </Form>
  )
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('ColorField', () => {
  describe('holding a colour', () => {
    it('is a text input named by its label, holding the colour as hex', async () => {
      await renderField({ defaultValue: PURPLE })

      expect(input().type).toBe('TextInput')
      expect(valueOf()).toBe(PURPLE)
      expect(input().props).toMatchObject({
        autoCapitalize: 'none',
        autoComplete: 'off',
        autoCorrect: false,
        keyboardType: 'default',
        returnKeyType: 'done',
        spellCheck: false,
      })
    })

    it('writes a colour given in another notation as hex', async () => {
      await renderField({ defaultValue: 'hsl(200, 100%, 50%)' })

      expect(valueOf()).toBe('#00AAFF')
    })

    it('reads a colour typed once it loses focus, and reports it', async () => {
      const onBlur = jest.fn()
      const onChange = changes()
      await renderField({ defaultValue: PURPLE, onBlur, onChange })

      await fireEvent(input(), 'focus', {})
      await type('#386a20')
      expect(valueOf()).toBe('#386a20')
      expect(onChange).not.toHaveBeenCalled()

      await blur()
      expect(valueOf()).toBe(GREEN)
      expect(hexOf(lastColor(onChange))).toBe(GREEN)
      expect(onBlur).toHaveBeenCalledTimes(1)
    })

    it('reads hex typed without its hash', async () => {
      const onChange = changes()
      await renderField({ onChange })

      await type('386A20')
      await blur()

      expect(valueOf()).toBe(GREEN)
      expect(hexOf(lastColor(onChange))).toBe(GREEN)
    })

    it('commits on the return key, ahead of the handler it is given', async () => {
      const onChange = changes()
      const calls: number[] = []
      await renderField({
        onChange,
        onSubmitEditing: () => {
          calls.push(onChange.mock.calls.length)
        },
      })

      await type(GREEN)
      await fireEvent(input(), 'submitEditing', {})

      expect(hexOf(lastColor(onChange))).toBe(GREEN)
      expect(calls).toEqual([1])
    })

    it('keeps a keystroke only where the text could still be hex', async () => {
      await renderField({ defaultValue: PURPLE })

      await type('not a colour')
      expect(valueOf()).toBe(PURPLE)
      await type('#386A20F')
      expect(valueOf()).toBe(PURPLE)
      await type('#38')
      expect(valueOf()).toBe('#38')
    })

    it('puts back text that reads as no colour, and empties an empty field', async () => {
      const onChange = changes()
      await renderField({ defaultValue: PURPLE, onChange })

      await type('#38')
      await blur()
      expect(valueOf()).toBe(PURPLE)
      expect(onChange).not.toHaveBeenCalled()

      await type('')
      await blur()
      expect(valueOf()).toBe('')
      expect(onChange).toHaveBeenCalledWith(null)
    })

    it('shows the colour it is given, reporting a change without keeping it', async () => {
      const onChange = changes()
      const { rerender } = await renderField({ onChange, value: PURPLE })

      await type(GREEN)
      await blur()
      expect(hexOf(lastColor(onChange))).toBe(GREEN)
      expect(valueOf()).toBe(PURPLE)

      await rerender({ onChange, value: GREEN })
      expect(valueOf()).toBe(GREEN)
    })
  })

  describe('holding a channel', () => {
    it.each<[ColorChannel, ColorSpace | undefined, string, string]>([
      ['hue', 'hsl', PURPLE, '256°'],
      ['saturation', 'hsl', PURPLE, '34%'],
      ['lightness', 'hsl', PURPLE, '48%'],
      ['brightness', 'hsb', PURPLE, '64%'],
      ['red', undefined, PURPLE, '103'],
      ['alpha', undefined, TRANSLUCENT, '60%'],
    ])(
      'writes %s in its own format',
      async (channel, colorSpace, defaultValue, text) => {
        await renderField({ channel, colorSpace, defaultValue })

        expect(valueOf()).toBe(text)
      },
    )

    it('reads a number typed, and reports the colour with that channel changed', async () => {
      const onChange = changes()
      await renderField({
        channel: 'hue',
        colorSpace: 'hsl',
        defaultValue: PURPLE,
        onChange,
      })

      await type('120')
      expect(onChange).not.toHaveBeenCalled()
      await blur()

      const color = lastColor(onChange)
      expect(color?.getColorSpace()).toBe('hsl')
      expect(color?.getChannelValue('hue')).toBe(120)
      expect(color?.getChannelValue('saturation')).toBeCloseTo(34.4, 1)
      expect(color?.getChannelValue('lightness')).toBeCloseTo(47.8, 1)
      expect(valueOf()).toBe('120°')
    })

    it('reads a percentage typed as the channel it is a share of', async () => {
      const onChange = changes()
      await renderField({
        channel: 'saturation',
        colorSpace: 'hsl',
        defaultValue: PURPLE,
        onChange,
      })

      await type('50')
      await blur()

      expect(lastColor(onChange)?.getChannelValue('saturation')).toBe(50)
      expect(valueOf()).toBe('50%')
    })

    it('reads alpha typed as a percentage of a whole', async () => {
      const onChange = changes()
      await renderField({
        channel: 'alpha',
        defaultValue: TRANSLUCENT,
        onChange,
      })

      await type('25')
      await blur()

      expect(lastColor(onChange)?.getChannelValue('alpha')).toBe(0.25)
      expect(valueOf()).toBe('25%')
    })

    it('clamps a number to the channel range, and snaps it to its step', async () => {
      const onChange = changes()
      await renderField({
        channel: 'hue',
        colorSpace: 'hsl',
        defaultValue: PURPLE,
        onChange,
      })

      await type('400')
      await blur()
      expect(valueOf()).toBe('360°')

      await type('12.6')
      await blur()
      expect(valueOf()).toBe('13°')
      expect(
        onChange.mock.calls.map(([color]) => color?.getChannelValue('hue')),
      ).toEqual([360, 13])
    })

    it('keeps no minus, since no channel reaches below zero', async () => {
      await renderField({ channel: 'red', defaultValue: PURPLE })

      await type('-')
      expect(valueOf()).toBe('103')
    })

    it('puts back text that reads as no number, and empties an empty field', async () => {
      const onChange = changes()
      await renderField({ channel: 'red', defaultValue: PURPLE, onChange })

      await type('.')
      await blur()
      expect(valueOf()).toBe('103')
      expect(onChange).not.toHaveBeenCalled()

      await type('')
      await blur()
      expect(valueOf()).toBe('')
      expect(onChange).toHaveBeenCalledWith(null)
    })

    it('opens empty for no colour, and reads a number typed against black', async () => {
      const onChange = changes()
      await renderField({ channel: 'red', defaultValue: null, onChange })
      expect(valueOf()).toBe('')

      await type('200')
      await blur()

      expect(hexOf(lastColor(onChange))).toBe('#C80000')
      expect(valueOf()).toBe('200')
    })

    it('shows the colour it is given, reporting a change without keeping it', async () => {
      const onChange = changes()
      const { rerender } = await renderField({
        channel: 'red',
        onChange,
        value: PURPLE,
      })

      await type('200')
      await blur()
      expect(hexOf(lastColor(onChange))).toBe('#C850A4')
      expect(valueOf()).toBe('103')

      await rerender({ channel: 'red', onChange, value: '#C850A4' })
      expect(valueOf()).toBe('200')
    })

    it('reads and writes the channel in the provider locale', async () => {
      const onChange = changes()
      await render(
        <I18nProvider locale="de-DE">
          <ColorField
            channel="hue"
            colorSpace="hsl"
            defaultValue={PURPLE}
            label="Label"
            onChange={onChange}
          />
        </I18nProvider>,
      )
      expect(valueOf()).toBe('256°')

      await type('12,6')
      await blur()
      expect(lastColor(onChange)?.getChannelValue('hue')).toBe(13)
    })

    it.each<[ColorChannel, ColorSpace | undefined, KeyboardTypeOptions]>([
      ['hue', 'hsl', 'decimal-pad'],
      ['saturation', 'hsl', 'number-pad'],
      ['red', undefined, 'decimal-pad'],
      ['alpha', undefined, 'number-pad'],
    ])(
      'types %s on the keyboard its format asks for',
      async (channel, colorSpace, keyboard) => {
        await renderField({ channel, colorSpace, defaultValue: PURPLE })

        expect(input().props.keyboardType).toBe(keyboard)
      },
    )
  })

  describe('the field chrome', () => {
    it('takes a swatch at the start of the box, and an icon at its end', async () => {
      await renderField({
        defaultValue: PURPLE,
        leadingIcon: SWATCH,
        trailingIcon: TRAILING,
      })

      expect(screen.getByRole('img').props['aria-label']).toBe('dark purple')
      expect(screen.getByTestId('trailing')).toBeTruthy()
    })

    it('draws the filled box, or the outlined one', async () => {
      const { rerender } = await renderField({ defaultValue: PURPLE })
      expect(styleOf(box())).toMatchObject({
        backgroundColor: colors.surfaceContainerHighest,
      })

      await rerender({ defaultValue: PURPLE, variant: 'outlined' })
      expect(styleOf(box())).toMatchObject({ backgroundColor: 'transparent' })
    })

    it('shows the box focused while the control has focus', async () => {
      await renderField({ defaultValue: PURPLE })

      await fireEvent(input(), 'focus', {})
      await advance(motion.durationShort3)
      expect(styleOf(label())).toMatchObject({ color: eased(colors.primary) })
    })

    it('hands the chrome its description, its error and its states', async () => {
      const { rerender } = await renderField({
        defaultValue: PURPLE,
        description: 'Supporting line',
        isRequired: true,
      })

      expect(input().props.accessibilityHint).toBe('Supporting line')
      expect(
        screen.getAllByText('Label*', { includeHiddenElements: true }),
      ).toHaveLength(1)

      await rerender({
        defaultValue: PURPLE,
        description: 'Supporting line',
        error: 'Enter a colour.',
      })
      await advance(motion.durationShort3)
      expect(input().props.accessibilityHint).toBe('Enter a colour.')
      // Drawn under the box, and hidden there, since the control reads it.
      expect(
        screen.getAllByText('Enter a colour.', { includeHiddenElements: true }),
      ).toHaveLength(1)
      expect(styleOf(label())).toMatchObject({ color: eased(colors.error) })
    })

    it('floats the label over a colour, and rests it in an empty box', async () => {
      const { rerender } = await renderField({ defaultValue: PURPLE })
      expect(styleOf(label())).toMatchObject({
        fontSize: typography.bodySmallSize,
        top: 0,
      })

      await rerender({ channel: 'red', defaultValue: null })
      await advance(motion.durationShort3)
      expect(styleOf(label())).toMatchObject({
        fontSize: typography.bodyLargeSize,
      })
    })

    it.each<[string, Partial<ColorFieldProps>]>([
      ['a colour', {}],
      ['a channel', { channel: 'red' }],
    ])(
      'cannot be edited while disabled or read only, holding %s',
      async (_name, props) => {
        const { rerender } = await renderField({
          ...props,
          defaultValue: PURPLE,
          isDisabled: true,
        })
        expect(input().props.editable).toBe(false)

        await rerender({ ...props, defaultValue: PURPLE, isReadOnly: true })
        expect(input().props.editable).toBe(false)

        await rerender({ ...props, defaultValue: PURPLE })
        expect(input().props.editable).toBe(true)
      },
    )

    it('puts the style and ref on the field, and hands inputRef the control', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      const inputRef = createRef<ComponentRef<typeof TextInput>>()
      await render(
        <ColorField
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
  })

  describe('in a form', () => {
    it('submits the hex it shows, and a channel number, under their names', async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <>
            <ColorField defaultValue={PURPLE} label="Colour" name="color" />
            <ColorField
              channel="alpha"
              defaultValue={TRANSLUCENT}
              label="Alpha"
              name="alpha"
            />
            <ColorField
              channel="red"
              defaultValue={null}
              label="Red"
              name="red"
            />
            <ColorField defaultValue={null} label="Empty" name="empty" />
          </>,
          { onSubmit },
        ),
      )

      await submit()

      expect(onSubmit).toHaveBeenCalledWith({
        alpha: '0.6',
        color: PURPLE,
        empty: '',
        red: '',
      })
    })

    it.each<[string, Partial<ColorFieldProps>]>([
      ['a colour', {}],
      ['a channel', { channel: 'red' }],
    ])(
      'hands validate the colour, null for an empty field, holding %s',
      async (_name, props) => {
        const validate = jest.fn((color: Color | null) =>
          color === null ? 'Enter a colour.' : true,
        )
        await renderField({ ...props, defaultValue: PURPLE, validate })
        expect(input().props.accessibilityHint).toBeUndefined()
        expect(hexOf(validate.mock.calls.at(-1)?.[0])).toBe(PURPLE)

        await type('')
        await blur()
        expect(input().props.accessibilityHint).toBe('Enter a colour.')
      },
    )

    it.each<[string, Partial<ColorFieldProps>, string]>([
      ['a colour', {}, '#38'],
      ['a channel', { channel: 'red' }, '20'],
    ])(
      "shows the form's error under its name until it is edited, holding %s",
      async (_name, props, typed) => {
        await render(
          withForm(
            <ColorField
              {...props}
              defaultValue={PURPLE}
              label="Label"
              name="color"
            />,
            { validationErrors: { color: 'Supporting line' } },
          ),
        )
        expect(input().props.accessibilityHint).toBe('Supporting line')

        await type(typed)
        expect(input().props.accessibilityHint).toBeUndefined()
      },
    )

    it.each<[string, Partial<ColorFieldProps>, string]>([
      ['a colour', {}, GREEN],
      ['a channel', { channel: 'red' }, '200'],
    ])(
      'shows what validate says once it loses focus after an edit, under native validation, holding %s',
      async (_name, props, typed) => {
        await render(
          withForm(
            <ColorField
              {...props}
              defaultValue={null}
              label="Label"
              name="color"
              validate={refuseAnyColour}
            />,
            { validationBehavior: 'native' },
          ),
        )

        await type(typed)
        expect(input().props.accessibilityHint).toBeUndefined()

        await blur()
        expect(input().props.accessibilityHint).toBe('Supporting line')
      },
    )

    it.each<[string, Partial<ColorFieldProps>, string, string]>([
      ['a colour', {}, GREEN, GREEN],
      ['a channel', { channel: 'red' }, '200', '200'],
    ])(
      'holds a native form back while a required field is empty, holding %s',
      async (_name, props, typed, submitted) => {
        const onSubmit = jest.fn()
        await render(
          withForm(
            <ColorField
              {...props}
              defaultValue={null}
              isRequired
              label="Label"
              name="color"
            />,
            { onSubmit, validationBehavior: 'native' },
          ),
        )

        await submit()
        expect(onSubmit).not.toHaveBeenCalled()

        await type(typed)
        await blur()
        await submit()
        expect(onSubmit).toHaveBeenCalledWith({ color: submitted })
      },
    )
  })
})
