import type { ComponentRef, ReactElement } from 'react'
import type { StyleProp, TextInput, TextStyle, ViewStyle } from 'react-native'
import type { TokenFieldSegment, TokenSegment } from 'react-stately'

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
import { TokenFieldValue } from 'react-stately'

import type { TokenFieldProps } from '.'

import { TokenField } from '.'
import { I18nProvider } from '../../i18n/provider'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const { colors, motion, sizing, spacing, stateLayerOpacity, typography } = theme

// React Native's Jest preset reports a font scale of 2, so every line the
// field is built from is twice its token.
const FONT_SCALE = 2

const CALL_SITE = { marginTop: 4 }

// A value whose tokens are words beginning with a hash, once a space follows
// them, as a call site decides what counts as one.
class TaggedValue extends TokenFieldValue {
  protected override tokenize(text: string): TokenFieldSegment[] {
    return text
      .split(/(#[\w-]+)(?=\s)/u)
      .map((part, index): TokenFieldSegment =>
        index % 2 === 1
          ? { text: part, type: 'token' }
          : { text: part, type: 'text' },
      )
      .filter((segment) => segment.text.length > 0)
  }
}

const TAGGED: readonly TokenFieldSegment[] = [
  { text: '#first', type: 'token' },
  { text: ' and ', type: 'text' },
  { text: '#second', type: 'token' },
]

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

// The view the control sits in on the line after the pills.
function controlRoom() {
  return hostsOf(line()).at(-1) ?? missing('control')
}

function fieldOf(props: Partial<TokenFieldProps>): ReactElement {
  return (
    <View testID="field">
      <TokenField label="Label" {...props} />
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

function input() {
  return screen.getByLabelText('Label')
}

// A handler a host was handed for its key presses, as the control's own.
function isKeyHandler(
  handler: unknown,
): handler is (event: { nativeEvent: { key: string } }) => void {
  return typeof handler === 'function'
}

// The label as it is drawn, which is hidden from screen readers.
function label() {
  return hostsOf(hostsOf(column())[0])[0]
}

// The line the pills and the control wrap on, after the label.
function line() {
  return hostsOf(column()).at(-1) ?? missing('line')
}

function missing(what: string): never {
  throw new TypeError(`expected the field to draw its ${what}`)
}

// The value a call to `onChange` was handed, as its segments.
function onChangeSegments(onChange: jest.Mock, call = 0) {
  const [value] = onChange.mock.calls.at(call) ?? missing('change')
  return segmentsOf(value)
}

// What a pill draws with: the chip's fill and rule as Reanimated drives them.
function paintOf(element: Host) {
  const style = getAnimatedStyle(element)
  return { fill: same(style.backgroundColor), rule: same(style.borderColor) }
}

function pill(name: string, selected?: boolean) {
  return screen.getByRole(
    'button',
    selected === undefined ? { name } : { name, selected },
  )
}

async function pressBackspace() {
  await fireEvent(input(), 'keyPress', { nativeEvent: { key: 'Backspace' } })
}

// Backspace, handed straight to the control's handler, since Testing Library
// fires no event at a control that takes no input.
function pressBackspaceDirectly() {
  const handler: unknown = input().props.onKeyPress
  if (!isKeyHandler(handler)) {
    missing('key handler')
  }
  handler({ nativeEvent: { key: 'Backspace' } })
}

async function renderField(props: Partial<TokenFieldProps> = {}): Promise<{
  rerender: (next: Partial<TokenFieldProps>) => Promise<void>
}> {
  const view = await render(fieldOf(props))

  return {
    rerender: async (next) => {
      await view.rerender(fieldOf(next))
    },
  }
}

// A colour as the ease writes it, since an eased colour comes back as rgba
// whatever it was given as.
function same(color: unknown) {
  if (typeof color !== 'string') {
    throw new TypeError('expected a colour')
  }
  return withOpacity(color, 1)
}

function segmentsOf(value: unknown) {
  if (!(value instanceof TokenFieldValue)) {
    return missing('value')
  }
  return value.segments
}

// What renderToken draws: the token's text, shouted.
function shout(segment: TokenSegment) {
  return <Text testID="drawn">{segment.text.toUpperCase()}</Text>
}

// What an element draws: its style, with what Reanimated drives on top.
function styleOf(element: Host): Record<string, unknown> {
  return { ...flatStyleOf(element), ...getAnimatedStyle(element) }
}

function tagged(segments: readonly TokenFieldSegment[] = TAGGED) {
  return new TaggedValue(segments)
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('TokenField', () => {
  it('draws each token as a pill named by its text, and the text between them as words', async () => {
    await renderField({ defaultValue: tagged() })

    expect(pill('#first')).toBeTruthy()
    expect(pill('#second')).toBeTruthy()
    // The spaces at the text's ends are the line's gaps.
    expect(screen.getByText('and')).toBeTruthy()
    expect(screen.queryByText('Label')).toBeNull()
    expect(input().props.value).toBe('')
  })

  it('draws no text that is only spaces', async () => {
    await renderField({
      defaultValue: tagged([
        { text: '#first', type: 'token' },
        { text: '  ', type: 'text' },
        { text: '#second', type: 'token' },
      ]),
    })

    // Two pills and the control's room, with nothing between the pills.
    expect(hostsOf(line())).toHaveLength(3)
  })

  it('holds the text after the last pill in the control', async () => {
    await renderField({
      defaultValue: tagged([
        ...TAGGED,
        { text: ' rest', type: 'text' },
        { text: ' more', type: 'text' },
      ]),
    })

    expect(input().props.value).toBe(' rest more')
    expect(screen.queryByText('rest')).toBeNull()
  })

  it('holds the whole value in the control while it has no token', async () => {
    await renderField({
      defaultValue: tagged([{ text: 'First item', type: 'text' }]),
    })

    expect(input().props.value).toBe('First item')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('opens empty with no value', async () => {
    await renderField()

    expect(input().props.value).toBe('')
    await fireEvent.changeText(input(), 'First')
    expect(input().props.value).toBe('First')
  })

  describe('typing', () => {
    it('hands what is typed to tokenize, keeping its own value', async () => {
      const onChange = jest.fn()
      await renderField({ defaultValue: tagged([]), onChange })

      await fireEvent.changeText(input(), '#tag')
      expect(screen.queryAllByRole('button')).toHaveLength(0)

      await fireEvent.changeText(input(), '#tag ')

      expect(pill('#tag')).toBeTruthy()
      expect(input().props.value).toBe(' ')
      const [value] = onChange.mock.calls.at(-1) ?? missing('change')
      expect(value).toBeInstanceOf(TaggedValue)
      expect(segmentsOf(value)).toEqual([
        { text: '#tag', type: 'token' },
        { text: ' ', type: 'text' },
      ])
    })

    it('replaces everything after the last pill, and keeps the pills before', async () => {
      const onChange = jest.fn()
      await renderField({
        defaultValue: tagged([
          ...TAGGED,
          { text: ' a', type: 'text' },
          { text: 'b', type: 'text' },
        ]),
        onChange,
      })

      await fireEvent.changeText(input(), ' abc')

      expect(onChangeSegments(onChange)).toEqual([
        ...TAGGED,
        { text: ' abc', type: 'text' },
      ])
    })

    it('types after a value that ends in a pill', async () => {
      const onChange = jest.fn()
      await renderField({ defaultValue: tagged(), onChange })

      await fireEvent.changeText(input(), ' x')

      expect(onChangeSegments(onChange)).toEqual([
        ...TAGGED,
        { text: ' x', type: 'text' },
      ])
    })

    it('makes nothing a token with the plain value', async () => {
      await renderField({ defaultValue: new TokenFieldValue([]) })

      await fireEvent.changeText(input(), '#tag ')

      expect(screen.queryAllByRole('button')).toHaveLength(0)
      expect(input().props.value).toBe('#tag ')
    })

    it('shows the value it is given, reporting an edit without keeping it', async () => {
      const onChange = jest.fn()
      await renderField({ onChange, value: tagged() })

      await fireEvent.changeText(input(), '#tag ')

      expect(onChangeSegments(onChange)).toEqual([
        ...TAGGED,
        { text: '#tag', type: 'token' },
        { text: ' ', type: 'text' },
      ])
      expect(screen.queryByRole('button', { name: '#tag' })).toBeNull()
      expect(input().props.value).toBe('')
    })
  })

  describe('backspace', () => {
    it('selects the last pill in an empty control, and removes it with a second', async () => {
      const onChange = jest.fn()
      await renderField({ defaultValue: tagged(), onChange })

      expect(pill('#second', false)).toBeTruthy()
      await pressBackspace()

      expect(pill('#second', true)).toBeTruthy()
      expect(pill('#first', false)).toBeTruthy()
      expect(onChange).not.toHaveBeenCalled()

      await pressBackspace()

      // The text before it comes back into the control.
      expect(onChangeSegments(onChange)).toEqual([
        { text: '#first', type: 'token' },
        { text: ' and ', type: 'text' },
      ])
      expect(screen.queryByRole('button', { name: '#second' })).toBeNull()
      expect(input().props.value).toBe(' and ')
      expect(pill('#first', false)).toBeTruthy()
    })

    it('leaves the pills alone while the control holds text', async () => {
      const onChange = jest.fn()
      await renderField({
        defaultValue: tagged([...TAGGED, { text: ' x', type: 'text' }]),
        onChange,
      })

      await pressBackspace()

      expect(pill('#second', false)).toBeTruthy()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('does nothing in a field with no pill', async () => {
      const onChange = jest.fn()
      await renderField({ defaultValue: tagged([]), onChange })

      await pressBackspace()

      expect(onChange).not.toHaveBeenCalled()
    })

    it('ignores every other key', async () => {
      await renderField({ defaultValue: tagged() })

      await fireEvent(input(), 'keyPress', { nativeEvent: { key: 'a' } })

      expect(pill('#second', false)).toBeTruthy()
    })

    it('hands the key to the call site after', async () => {
      const onKeyPress = jest.fn()
      await renderField({ defaultValue: tagged(), onKeyPress })

      await pressBackspace()

      expect(onKeyPress).toHaveBeenCalledWith(
        expect.objectContaining({ nativeEvent: { key: 'Backspace' } }),
      )
    })

    it('takes nothing out of a field that takes no input', async () => {
      // A read-only control still hears its keys under React Native Web,
      // which leaves an input that cannot be edited focusable.
      const onChange = jest.fn()
      const { rerender } = await renderField({
        defaultValue: tagged(),
        isReadOnly: true,
        onChange,
      })

      await act(() => {
        pressBackspaceDirectly()
        pressBackspaceDirectly()
      })
      await rerender({ defaultValue: tagged(), isDisabled: true, onChange })
      await act(() => {
        pressBackspaceDirectly()
      })

      expect(onChange).not.toHaveBeenCalled()
      expect(pill('#first', false)).toBeTruthy()
      expect(pill('#second', false)).toBeTruthy()

      await act(() => {
        pressBackspaceDirectly()
      })

      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('a pill', () => {
    it('is selected by a press, which moves focus to the control, and let go by another', async () => {
      const inputRef = createRef<ComponentRef<typeof TextInput>>()
      await renderField({ defaultValue: tagged(), inputRef })
      const focus = jest.spyOn(inputRef.current ?? missing('control'), 'focus')

      await fireEvent.press(pill('#first'))

      expect(pill('#first', true)).toBeTruthy()
      expect(pill('#second', false)).toBeTruthy()
      expect(focus).toHaveBeenCalledTimes(1)

      await fireEvent.press(pill('#first'))

      expect(pill('#first', false)).toBeTruthy()
      expect(focus).toHaveBeenCalledTimes(2)
    })

    it('is removed by Backspace once selected, the text either side joining', async () => {
      const onChange = jest.fn()
      await renderField({
        defaultValue: tagged([{ text: 'One ', type: 'text' }, ...TAGGED]),
        onChange,
      })

      await fireEvent.press(pill('#first'))
      await pressBackspace()

      expect(onChangeSegments(onChange)).toEqual([
        { text: 'One  and ', type: 'text' },
        { text: '#second', type: 'token' },
      ])
      expect(screen.queryByRole('button', { name: '#first' })).toBeNull()
      expect(screen.getByText('One  and')).toBeTruthy()
      expect(pill('#second', false)).toBeTruthy()
    })

    it('is let go by typing, and by leaving the field', async () => {
      const onBlur = jest.fn()
      await renderField({ defaultValue: tagged(), onBlur })

      await fireEvent.press(pill('#first'))
      await fireEvent.changeText(input(), 'x')
      expect(pill('#first', false)).toBeTruthy()

      await fireEvent.changeText(input(), '')
      await fireEvent.press(pill('#first'))
      await fireEvent(input(), 'blur', {})

      expect(pill('#first', false)).toBeTruthy()
      expect(onBlur).toHaveBeenCalledTimes(1)
    })

    it('selects nothing once the value it was selected in has moved', async () => {
      const onChange = jest.fn()
      const { rerender } = await renderField({ onChange, value: tagged() })

      await fireEvent.press(pill('#second'))
      await rerender({ onChange, value: tagged(TAGGED.slice(0, 1)) })

      expect(pill('#first', false)).toBeTruthy()

      // Nothing selected, so the first Backspace selects rather than removes.
      await pressBackspace()

      expect(onChange).not.toHaveBeenCalled()
      expect(pill('#first', true)).toBeTruthy()
    })

    it('offers a screen reader a remove action, in the locale', async () => {
      const onChange = jest.fn()
      await renderField({ defaultValue: tagged(), onChange })

      expect(pill('#first').props.accessibilityActions).toEqual([
        { label: 'Remove', name: 'remove' },
      ])

      await fireEvent(pill('#first'), 'accessibilityAction', {
        nativeEvent: { actionName: 'activate' },
      })
      expect(onChange).not.toHaveBeenCalled()

      await fireEvent(pill('#first'), 'accessibilityAction', {
        nativeEvent: { actionName: 'remove' },
      })
      expect(onChangeSegments(onChange)).toEqual([
        { text: ' and ', type: 'text' },
        { text: '#second', type: 'token' },
      ])
    })

    it('names the action in the provider’s locale', async () => {
      await render(
        <I18nProvider locale="de-DE">
          <TokenField defaultValue={tagged()} label="Label" />
        </I18nProvider>,
      )

      expect(pill('#first').props.accessibilityActions).toEqual([
        { label: 'Entfernen', name: 'remove' },
      ])
    })

    it('holds what renderToken draws, and is still named by its text', async () => {
      await renderField({ defaultValue: tagged(), renderToken: shout })

      expect(screen.getAllByTestId('drawn')).toHaveLength(2)
      expect(screen.getByText('#FIRST')).toBeTruthy()
      expect(screen.getByText('#SECOND')).toBeTruthy()
      expect(screen.queryByText('#first')).toBeNull()
      expect(pill('#first')).toBeTruthy()
    })

    it('draws the chip unselected at rest, and the selected chip once selected', async () => {
      await renderField({ defaultValue: tagged() })
      await advance(motion.durationShort2)

      expect(paintOf(pill('#first'))).toEqual({
        fill: same(withOpacity(colors.secondaryContainer, 0)),
        rule: same(colors.outlineVariant),
      })

      await fireEvent.press(pill('#first'))
      await advance(motion.durationShort2)

      expect(paintOf(pill('#first'))).toEqual({
        fill: same(colors.secondaryContainer),
        rule: same(withOpacity(colors.outlineVariant, 0)),
      })
      expect(styleOf(pill('#first'))).toMatchObject({
        borderRadius: theme.radii.sm,
        minHeight: sizing.controlXs,
      })
    })

    it('reaches half the gap between lines, and across to the target size once measured', async () => {
      await renderField({ defaultValue: tagged() })
      const half = spacing.sm / 2

      expect(pill('#first').props.hitSlop).toEqual({
        bottom: half,
        left: 0,
        right: 0,
        top: half,
      })

      await fireEvent(pill('#first'), 'layout', {
        nativeEvent: { layout: { height: 32, width: 20, x: 0, y: 0 } },
      })

      expect(pill('#first').props.hitSlop).toEqual({
        bottom: half,
        left: 14,
        right: 14,
        top: half,
      })
    })
  })

  describe('disabled or read-only', () => {
    it('takes no input disabled or read-only', async () => {
      const { rerender } = await renderField({ isDisabled: true })

      expect(input().props.editable).toBe(false)
      await rerender({ isReadOnly: true })
      expect(input().props.editable).toBe(false)
      await rerender({})
      expect(input().props.editable).toBe(true)
    })

    it('draws its pills disabled, taking no press and offering no action', async () => {
      await renderField({ defaultValue: tagged(), isDisabled: true })
      await advance(motion.durationShort2)

      // The pill itself, and not only the box around it, since a touch
      // reaches a Pressable inside a disabled one on a device.
      expect(pill('#first').props.accessibilityState).toMatchObject({
        disabled: true,
      })
      expect(pill('#first').props.accessibilityActions).toBeUndefined()
      await fireEvent.press(pill('#first'))
      expect(pill('#first', false)).toBeTruthy()
      expect(paintOf(pill('#first')).rule).toBe(
        same(
          withOpacity(colors.onSurface, stateLayerOpacity.disabledContainer),
        ),
      )
      expect(styleOf(screen.getByText('and'))).toMatchObject({
        color: withOpacity(colors.onSurface, stateLayerOpacity.disabledContent),
      })
    })

    it('draws read-only pills as their text, which nothing presses or removes', async () => {
      await renderField({ defaultValue: tagged(), isReadOnly: true })

      expect(screen.queryAllByRole('button')).toHaveLength(0)
      const first = screen.getByLabelText('#first')
      expect(first).not.toBeDisabled()
      expect(first.props.accessibilityActions).toBeUndefined()

      await fireEvent.press(first)
      await advance(motion.durationShort2)

      expect(paintOf(first).fill).toBe(
        same(withOpacity(colors.secondaryContainer, 0)),
      )
    })
  })

  describe('label', () => {
    it('rests on the value’s line while empty, and floats on focus', async () => {
      await renderField({
        defaultValue: tagged([{ text: '', type: 'text' }]),
      })

      expect(styleOf(label())).toMatchObject({
        fontSize: typography.bodyLargeSize,
      })

      await fireEvent(input(), 'focus', {})
      await advance(motion.durationShort3)

      expect(styleOf(label())).toMatchObject({
        fontSize: typography.bodySmallSize,
      })
    })

    it('floats while the field holds a token', async () => {
      await renderField({
        defaultValue: tagged([{ text: '#first', type: 'token' }]),
      })

      expect(styleOf(label()).fontSize).toBe(typography.bodySmallSize)
    })

    it('floats while the field holds text alone', async () => {
      await renderField({
        defaultValue: tagged([{ text: 'First item', type: 'text' }]),
      })

      expect(styleOf(label()).fontSize).toBe(typography.bodySmallSize)
    })

    it('stays small with floatingLabel off', async () => {
      await renderField({ floatingLabel: false })

      expect(styleOf(label()).fontSize).toBe(typography.labelMediumSize)
    })
  })

  describe('line', () => {
    it('wraps the pills and the control, clearing the label once, a pill tall at the least', async () => {
      await renderField({ defaultValue: tagged() })

      expect(styleOf(line())).toMatchObject({
        columnGap: spacing.xs,
        flexWrap: 'wrap',
        marginTop: typography.bodySmallLineHeight * FONT_SCALE,
        minHeight: sizing.controlXs,
        rowGap: spacing.sm,
      })
      expect(styleOf(input()).marginTop).toBeUndefined()
    })

    it('clears no label in the outlined box', async () => {
      await renderField({ defaultValue: tagged(), variant: 'outlined' })

      expect(styleOf(line()).marginTop).toBeUndefined()
    })

    it('keeps the control three characters wide after the last pill, growing from nothing', async () => {
      await renderField({ defaultValue: tagged() })

      expect(styleOf(controlRoom())).toMatchObject({
        flexBasis: 0,
        flexGrow: 1,
        minWidth: 3 * typography.bodyLargeSize * FONT_SCALE,
      })
    })

    it('lets text before the last pill give way to its line', async () => {
      await renderField({ defaultValue: tagged() })

      expect(styleOf(screen.getByText('and'))).toMatchObject({
        color: colors.onSurface,
        flexShrink: 1,
        fontSize: typography.bodyLargeSize,
      })
    })
  })

  describe('supporting line', () => {
    it('describes the control by its description, and replaces it with the error', async () => {
      const { rerender } = await renderField({ description: 'Supporting line' })

      expect(input().props.accessibilityHint).toBe('Supporting line')

      await rerender({
        description: 'Supporting line',
        error: 'Add at least one tag',
      })

      expect(input().props.accessibilityHint).toBe('Add at least one tag')
      expect(
        styleOf(
          screen.getByText('Add at least one tag', {
            includeHiddenElements: true,
          }),
        ),
      ).toMatchObject({ color: colors.error })
    })

    it('reports the error on the control under React Native Web', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await renderField({ error: 'Add at least one tag' })

      expect(input().props['aria-invalid']).toBe(true)
    })

    it('points the control at its description under React Native Web, and drops the hint', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await renderField({ description: 'Supporting line' })

      const id = String(input().props['aria-describedby'])
      expect(input().props.accessibilityHint).toBeUndefined()
      expect(
        screen.root?.queryAll((element) => element.props.id === id)[0]?.props
          .children,
      ).toBe('Supporting line')
    })
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
    const focus = jest.spyOn(inputRef.current ?? missing('control'), 'focus')

    await fireEvent.press(box())

    expect(focus).toHaveBeenCalledTimes(1)
  })
})
