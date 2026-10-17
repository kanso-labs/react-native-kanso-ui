import type { ComponentRef, ReactElement } from 'react'
import type { StyleProp, TextInput, TextStyle, ViewStyle } from 'react-native'

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
import { Platform, StyleSheet, Text, View } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { TextAreaProps } from '.'

import { TextArea } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { scopeFor } from '../../theme/scope'
import { Button } from '../button'
import { Form } from '../form'

const { theme } = scopeFor('light', {})
const { colors, motion, spacing, typography } = theme

// React Native's Jest preset reports a font scale of 2, so every line the
// field is built from is twice its token.
const FONT_SCALE = 2

const LINE = typography.bodyLargeLineHeight * FONT_SCALE

const THREE_LINES = 'First line.\nSecond line.\nThird line.'

const CALL_SITE = { marginTop: 4 }

// Hoisted so the form is handed the same object on every render, which is
// what react-perf's no-new-object-as-prop is after.
const SERVER_ERRORS = { note: 'Shorten the note.' }

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

// The label and the control's column, which ends the box when it has no
// trailing icon.
function column() {
  return hostsOf(box()).at(-1) ?? missing('column')
}

// The field in a view the cases find it by.
function fieldOf(props: Partial<TextAreaProps>): ReactElement {
  return (
    <View testID="field">
      <TextArea label="Label" {...props} />
    </View>
  )
}

function flatStyleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle | ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

// An element's children that are elements, rather than text.
function hostsOf(element: Host | undefined): Host[] {
  if (element === undefined) {
    return missing('element')
  }
  return element.children.filter((child) => typeof child !== 'string')
}

// An icon of the app's own, which writes the colour and size its slot hands
// it, as `colour size`.
function IconProbe({ testID }: { readonly testID: string }) {
  const { color, size } = useIconStyle()

  return <Text testID={testID}>{`${String(color)} ${String(size)}`}</Text>
}

// Hoisted so each is one stable element per render, which is what
// react-perf's no-jsx-as-prop is after.
const LEADING = <IconProbe testID="leading" />
const TRAILING = <IconProbe testID="trailing" />

function input() {
  return screen.getByLabelText('Label')
}

// The label as it is drawn, which is hidden from screen readers.
function label() {
  return hostsOf(hostsOf(column())[0])[0]
}

function missing(what: string): never {
  throw new TypeError(`expected the field to draw its ${what}`)
}

async function renderField(
  props: Partial<TextAreaProps> = {},
): Promise<{ rerender: (next: Partial<TextAreaProps>) => Promise<void> }> {
  const view = await render(fieldOf(props))

  return {
    rerender: async (next) => {
      await view.rerender(fieldOf(next))
    },
  }
}

// What an element draws: its style, with what Reanimated drives on top.
function styleOf(element: Host): Record<string, unknown> {
  return { ...flatStyleOf(element), ...getAnimatedStyle(element) }
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('TextArea', () => {
  it('is a multi-line text input named by its label, which is not read again', async () => {
    await renderField()

    expect(input().props).toMatchObject({
      'aria-label': 'Label',
      multiline: true,
    })
    expect(screen.queryByText('Label')).toBeNull()
  })

  it('keeps what is typed, and reports it, given defaultValue', async () => {
    const onChange = jest.fn()
    await renderField({ defaultValue: THREE_LINES, onChange })

    expect(input().props.value).toBe(THREE_LINES)
    await fireEvent.changeText(input(), `${THREE_LINES}\nFourth line.`)

    expect(onChange).toHaveBeenCalledWith(`${THREE_LINES}\nFourth line.`)
    expect(input().props.value).toBe(`${THREE_LINES}\nFourth line.`)
  })

  it('shows the value it is given, reporting an edit without keeping it', async () => {
    const onChange = jest.fn()
    await renderField({ onChange, value: 'First line.' })

    await fireEvent.changeText(input(), 'Edited')

    expect(onChange).toHaveBeenCalledWith('Edited')
    expect(input().props.value).toBe('First line.')
  })

  it('takes no input disabled or read-only', async () => {
    const { rerender } = await renderField({ isDisabled: true })

    expect(input().props.editable).toBe(false)
    await rerender({ isReadOnly: true })
    expect(input().props.editable).toBe(false)
    await rerender({})
    expect(input().props.editable).toBe(true)
  })

  it('puts the style and ref on the field, and testID on the control', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await renderField({ ref, style: CALL_SITE, testID: 'control' })

    const root = hostsOf(screen.getByTestId('field'))[0]
    expect(styleOf(root)).toMatchObject(CALL_SITE)
    expect(ref.current).not.toBeNull()
    expect(screen.getByTestId('control')).toBe(input())
  })

  it('hands inputRef the control, which a press anywhere on the box focuses', async () => {
    const inputRef = createRef<ComponentRef<typeof TextInput>>()
    await renderField({ inputRef })
    const control = inputRef.current ?? missing('control')
    const focus = jest.spyOn(control, 'focus')

    await fireEvent.press(box())

    expect(focus).toHaveBeenCalledTimes(1)
  })

  describe('height', () => {
    it('shows three lines at the least, from the top, and leaves the rest to grow', async () => {
      await renderField()

      const style = styleOf(input())
      expect(style.minHeight).toBe(3 * LINE)
      expect(style.textAlignVertical).toBe('top')
      // iOS and Android grow a multi-line input with what it holds while
      // nothing sets its height.
      expect(style).not.toHaveProperty('height')
      // No line count reaches the input either, which Android would hold it
      // to.
      expect(input().props).not.toHaveProperty('numberOfLines')
      expect(input().props).not.toHaveProperty('rows')
    })

    it('takes its least height from rows', async () => {
      await renderField({ rows: 5 })

      expect(styleOf(input()).minHeight).toBe(5 * LINE)
    })

    it('holds at rows and scrolls with autosize off', async () => {
      await renderField({ autosize: false, rows: 2 })

      const style = styleOf(input())
      expect(style.height).toBe(2 * LINE)
      expect(style).not.toHaveProperty('minHeight')
    })

    it('grows the box from the page height, its padding and the label line kept', async () => {
      await renderField()

      expect(styleOf(box())).toMatchObject({
        minHeight:
          2 * spacing.sm +
          (typography.bodySmallLineHeight + typography.bodyLargeLineHeight) *
            FONT_SCALE,
        paddingVertical: spacing.sm,
      })
      expect(styleOf(box())).not.toHaveProperty('height')
      expect(styleOf(input()).marginTop).toBe(
        typography.bodySmallLineHeight * FONT_SCALE,
      )
    })

    it('grows the outlined box from its page height, the text clear of no label', async () => {
      await renderField({ variant: 'outlined' })

      expect(styleOf(box()).minHeight).toBe(
        2 * spacing.lg + typography.bodyLargeLineHeight * FONT_SCALE,
      )
      expect(styleOf(input()).marginTop).toBeUndefined()
    })

    it('keeps the icons centred in the box as it grows', async () => {
      await renderField({ leadingIcon: LEADING, trailingIcon: TRAILING })

      for (const icon of ['leading', 'trailing']) {
        const slot = screen.getByTestId(icon).parent ?? missing('slot')
        expect(styleOf(slot).alignSelf).toBe('center')
      }
    })
  })

  describe('on the web', () => {
    it('lies the control over a copy of its text, which takes the height', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await renderField({ defaultValue: THREE_LINES })

      const control = input()
      const line = control.parent ?? missing('line')
      const copy = hostsOf(line)[0]
      expect(styleOf(control)).toMatchObject({
        bottom: 0,
        overflow: 'hidden',
        position: 'absolute',
        top: 0,
      })
      expect(styleOf(control)).not.toHaveProperty('minHeight')
      expect(copy.props['aria-hidden']).toBe(true)
      expect(copy.props.children).toBe(`${THREE_LINES} `)
      expect(styleOf(copy)).toMatchObject({
        lineHeight: typography.bodyLargeLineHeight,
        minHeight: 3 * LINE,
        opacity: 0,
      })
      // The line clears the label, where the control would on its own.
      expect(styleOf(line).marginTop).toBe(
        typography.bodySmallLineHeight * FONT_SCALE,
      )
      expect(styleOf(control).marginTop).toBeUndefined()

      await fireEvent.changeText(control, `${THREE_LINES}\n`)

      expect(copy.props.children).toBe(`${THREE_LINES}\n `)
    })

    it('needs no copy with autosize off', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await renderField({ autosize: false })

      expect(styleOf(input())).toMatchObject({ height: 3 * LINE })
      expect(styleOf(input())).not.toHaveProperty('position')
    })
  })

  describe('label', () => {
    it('rests on the first line while empty, and floats on focus', async () => {
      await renderField()

      expect(styleOf(label())).toMatchObject({
        fontSize: typography.bodyLargeSize,
        top: (typography.bodySmallLineHeight * FONT_SCALE) / 2,
      })

      await fireEvent(input(), 'focus', {})
      await advance(motion.durationShort3)

      expect(styleOf(label())).toMatchObject({
        fontSize: typography.bodySmallSize,
        top: 0,
      })
    })

    it('floats while the field holds a value, and stays small with floatingLabel off', async () => {
      const { rerender } = await renderField({ defaultValue: THREE_LINES })

      expect(styleOf(label()).fontSize).toBe(typography.bodySmallSize)

      await rerender({ floatingLabel: false })
      await advance(motion.durationShort3)

      expect(styleOf(label()).fontSize).toBe(typography.labelMediumSize)
    })
  })

  describe('supporting line', () => {
    it('describes the control by its description, and replaces it with the error', async () => {
      const { rerender } = await renderField({ description: 'Supporting line' })

      expect(input().props.accessibilityHint).toBe('Supporting line')

      await rerender({
        description: 'Supporting line',
        error: 'Enter a value.',
      })

      expect(input().props.accessibilityHint).toBe('Enter a value.')
      expect(
        styleOf(
          screen.getByText('Enter a value.', { includeHiddenElements: true }),
        ),
      ).toMatchObject({ color: colors.error })
    })

    it('shows what validate says as the value changes', async () => {
      await renderField({
        validate: (value) => (value.length < 3 ? 'Enter 3 or more.' : null),
      })

      await fireEvent.changeText(input(), 'Fi')

      expect(input().props.accessibilityHint).toBe('Enter 3 or more.')
    })

    it('counts the characters against maxLength, saying the limit once', async () => {
      await renderField({
        characterCount: true,
        defaultValue: 'First',
        maxLength: 200,
      })

      expect(input().props.accessibilityHint).toBe('Up to 200 characters')
      expect(screen.queryByText('5/200')).toBeNull()
      expect(
        screen.getByText('5/200', { includeHiddenElements: true }),
      ).toBeTruthy()

      await fireEvent.changeText(input(), 'First line.\nSecond')

      expect(
        screen.getByText('18/200', { includeHiddenElements: true }),
      ).toBeTruthy()
    })
  })

  describe('in a form', () => {
    it('submits its value under its name', async () => {
      const onSubmit = jest.fn()
      await render(
        <Form onSubmit={onSubmit}>
          <TextArea defaultValue="First line." label="Label" name="note" />
          <Button type="submit">Submit</Button>
        </Form>,
      )

      await fireEvent.changeText(input(), THREE_LINES)
      await fireEvent.press(screen.getByRole('button', { name: 'Submit' }))

      expect(onSubmit).toHaveBeenCalledWith({ note: THREE_LINES })
    })

    it('shows the error the form has for its name', async () => {
      await render(
        <Form validationErrors={SERVER_ERRORS}>
          <TextArea label="Label" name="note" />
        </Form>,
      )

      expect(input().props.accessibilityHint).toBe('Shorten the note.')
    })
  })
})
