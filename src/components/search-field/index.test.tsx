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
import { Platform, StyleSheet, View } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { SearchFieldProps } from '.'
import type { KuiTheme } from '../../tokens/defaults'

import { SearchField } from '.'
import { ThemeScope } from '../../theme-scope'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

// What the next field the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

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

const DISABLED_CONTAINER = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContainer,
)
const DISABLED_CONTENT = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContent,
)

// The device's text size under the suite: React Native's Jest preset reports
// a font scale of 2, so the value's line is twice its token.
const FONT_SCALE = 2

const CALL_SITE = { marginTop: 4 }

// A scheme whose padding and line differ from the control height, as a
// demo scheme's do.
const ROOMY: KuiTheme = {
  '--kui-sizing-control-lg': '60px',
  '--kui-spacing-lg': '22px',
  '--kui-typography-body-large-line-height': '26px',
}

type Host = ReturnType<typeof screen.getByTestId>

// What the field's key handler reads of an event.
type KeyHandler = (event: { nativeEvent: { key: string } }) => void

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// The bar: the pressable inside the field's root.
function bar() {
  return hostsOf(root())[0]
}

function clearButton() {
  return screen.queryByLabelText('Clear search')
}

// A colour as Reanimated hands it back once eased: the same channels, opaque.
function eased(color: string) {
  const channels = /^#(?<r>[\da-f]{2})(?<g>[\da-f]{2})(?<b>[\da-f]{2})$/iu.exec(
    color,
  )?.groups
  if (channels === undefined) {
    return missing(`hex colour, not ${color}`)
  }
  const { b = '', g = '', r = '' } = channels

  return `rgba(${String(Number.parseInt(r, 16))}, ${String(Number.parseInt(g, 16))}, ${String(Number.parseInt(b, 16))}, 1)`
}

// The field in a view the cases find it by.
function fieldOf(props: Partial<SearchFieldProps>): ReactElement {
  return (
    <View testID="field">
      <SearchField label="Label" placeholder="Supporting text" {...props} />
    </View>
  )
}

function flatStyleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}) {
  return StyleSheet.flatten([element.props.style])
}

// The magnifier, the first thing drawn after the layer and the ring.
function glyph() {
  return hostsOf(bar())[2]
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

function isKeyHandler(value: unknown): value is KeyHandler {
  return typeof value === 'function'
}

// The state layer, inside the surface that clips it to the pill.
function layer() {
  return hostsOf(hostsOf(bar())[0])[0]
}

function missing(what: string): never {
  throw new TypeError(`expected the field to draw its ${what}`)
}

async function renderField(
  props: Partial<SearchFieldProps> = {},
): Promise<{ rerender: (next: Partial<SearchFieldProps>) => Promise<void> }> {
  const view = await render(fieldOf(props))

  return {
    rerender: async (next) => {
      await view.rerender(fieldOf(next))
    },
  }
}

// The ring, over the bar.
function ring() {
  return hostsOf(bar())[1]
}

function root() {
  return hostsOf(screen.getByTestId('field'))[0]
}

// What an element draws: its style, with what Reanimated drives on top.
function styleOf(element: Host): Record<string, unknown> {
  return { ...flatStyleOf(element), ...getAnimatedStyle(element) }
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  mockReducedMotion = false
  // A mocked TextInput's `focus` is one mock every instance shares, which
  // spyOn hands back as it is and restoring leaves holding its calls.
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('SearchField', () => {
  it('is a search box named by its label, which is never drawn', async () => {
    await renderField()

    expect(screen.getByRole('searchbox', { name: 'Label' })).toBe(input())
    expect(screen.queryByText('Label')).toBeNull()
    expect(input().props).toMatchObject({
      placeholder: 'Supporting text',
      placeholderTextColor: colors.onSurfaceVariant,
      returnKeyType: 'search',
    })
  })

  it('keeps what is typed, and reports it, given defaultValue', async () => {
    const onChange = jest.fn()
    await renderField({ defaultValue: 'Keyword', onChange })

    expect(input().props.value).toBe('Keyword')
    await fireEvent.changeText(input(), 'Edited')

    expect(onChange).toHaveBeenCalledWith('Edited')
    expect(input().props.value).toBe('Edited')
  })

  it('shows the value it is given, reporting an edit without keeping it', async () => {
    const onChange = jest.fn()
    const { rerender } = await renderField({ onChange, value: 'Keyword' })

    await fireEvent.changeText(input(), 'Edited')

    expect(onChange).toHaveBeenCalledWith('Edited')
    expect(input().props.value).toBe('Keyword')
    await rerender({ onChange, value: 'Edited' })
    expect(input().props.value).toBe('Edited')
  })

  it('submits the value on the search key, and calls the handler it is given', async () => {
    const onSubmit = jest.fn()
    const onSubmitEditing = jest.fn()
    await renderField({ defaultValue: 'Keyword', onSubmit, onSubmitEditing })

    await fireEvent(input(), 'submitEditing', { nativeEvent: { text: '' } })

    expect(onSubmit).toHaveBeenCalledWith('Keyword')
    expect(onSubmitEditing).toHaveBeenCalledTimes(1)
  })

  it('calls the focus and blur handlers it is given', async () => {
    const onBlur = jest.fn()
    const onFocus = jest.fn()
    await renderField({ onBlur, onFocus })

    await fireEvent(input(), 'focus', {})
    await fireEvent(input(), 'blur', {})

    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  it('puts the style and ref on the field, and testID on the control', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await renderField({ ref, style: CALL_SITE, testID: 'control' })

    expect(styleOf(root())).toMatchObject(CALL_SITE)
    expect(ref.current).not.toBeNull()
    expect(screen.getByTestId('control')).toBe(input())
  })

  it('hands inputRef the control, which a press anywhere on the bar focuses', async () => {
    const inputRef = createRef<TextInput>()
    await renderField({ inputRef })
    const control = inputRef.current ?? missing('control')
    const focus = jest.spyOn(control, 'focus')

    await fireEvent.press(bar())

    expect(focus).toHaveBeenCalledTimes(1)
  })

  describe('clear button', () => {
    it('shows only while the field holds something', async () => {
      await renderField()
      expect(clearButton()).toBeNull()

      await fireEvent.changeText(input(), 'Keyword')
      expect(clearButton()).not.toBeNull()

      await fireEvent.changeText(input(), '')
      expect(clearButton()).toBeNull()
    })

    it('empties the field, reports it, and hands focus back', async () => {
      const inputRef = createRef<TextInput>()
      const onChange = jest.fn()
      const onClear = jest.fn()
      await renderField({
        defaultValue: 'Keyword',
        inputRef,
        onChange,
        onClear,
      })
      const focus = jest.spyOn(inputRef.current ?? missing('control'), 'focus')

      await fireEvent.press(clearButton() ?? missing('clear button'))

      expect(input().props.value).toBe('')
      expect(onChange).toHaveBeenCalledWith('')
      expect(onClear).toHaveBeenCalledTimes(1)
      expect(focus).toHaveBeenCalledTimes(1)
      expect(clearButton()).toBeNull()
    })

    it('takes its name from clearLabel', async () => {
      await renderField({ clearLabel: 'Clear', defaultValue: 'Keyword' })

      expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy()
      expect(clearButton()).toBeNull()
    })

    it('sits 4dp in from the padding', async () => {
      await renderField({ defaultValue: 'Keyword' })

      expect(styleOf(clearButton() ?? missing('clear button'))).toMatchObject({
        marginEnd: spacing.xs,
      })
    })

    it('empties the field on Escape, and leaves an empty one alone', async () => {
      const onClear = jest.fn()
      const onKeyPress = jest.fn()
      await renderField({ defaultValue: 'Keyword', onClear, onKeyPress })

      await fireEvent(input(), 'keyPress', { nativeEvent: { key: 'a' } })
      expect(input().props.value).toBe('Keyword')

      await fireEvent(input(), 'keyPress', { nativeEvent: { key: 'Escape' } })
      expect(input().props.value).toBe('')
      expect(onClear).toHaveBeenCalledTimes(1)

      await fireEvent(input(), 'keyPress', { nativeEvent: { key: 'Escape' } })
      expect(onClear).toHaveBeenCalledTimes(1)
      expect(onKeyPress).toHaveBeenCalledTimes(3)
    })
  })

  describe('bar', () => {
    it('draws the page bar: a pill on surface container high', async () => {
      await renderField()

      expect(styleOf(bar())).toMatchObject({
        alignItems: 'center',
        backgroundColor: colors.surfaceContainerHigh,
        borderRadius: radii.pill,
        flexDirection: 'row',
        gap: spacing.lg,
        maxWidth: 720,
        paddingEnd: spacing.lg,
        paddingStart: spacing.lg + spacing.md,
      })
    })

    it('is no stop of its own for a screen reader or the keyboard', async () => {
      await renderField()

      expect(bar().props).toMatchObject({ accessible: false, focusable: false })
    })

    it('is the large control height, and grows with the text size', async () => {
      await renderField()

      // 56dp at the default size, and as much again as the value's line
      // grows by.
      expect(styleOf(bar()).minHeight).toBe(
        sizing.controlLg + typography.bodyLargeLineHeight * (FONT_SCALE - 1),
      )
    })

    it('reads its height from the sizing token, not the padding around the line', async () => {
      await render(<ThemeScope theme={ROOMY}>{fieldOf({})}</ThemeScope>)

      expect(styleOf(bar()).minHeight).toBe(60 + 26 * (FONT_SCALE - 1))
    })

    it('draws the magnifier at the start in the muted role', async () => {
      await renderField()

      expect(glyph().props).toMatchObject({
        color: colors.onSurfaceVariant,
        height: 24,
        width: 24,
      })
    })

    it('draws the state layer under a pointer and while pressed', async () => {
      await renderField()
      expect(styleOf(hostsOf(bar())[0])).toMatchObject({
        borderRadius: radii.pill,
        overflow: 'hidden',
      })
      // The layer alone, with no ripple beside it.
      expect(hostsOf(hostsOf(bar())[0])).toHaveLength(1)
      expect(styleOf(layer())).toMatchObject({
        backgroundColor: colors.onSurface,
        opacity: 0,
      })

      await fireEvent(bar(), 'hoverIn', {})
      expect(styleOf(layer())).toMatchObject({
        opacity: stateLayerOpacity.hover,
      })

      await fireEvent(bar(), 'pressIn', { nativeEvent: {} })
      expect(styleOf(layer())).toMatchObject({
        opacity: stateLayerOpacity.pressed,
      })

      await fireEvent(bar(), 'pressOut', {})
      await fireEvent(bar(), 'hoverOut', {})
      expect(styleOf(layer())).toMatchObject({ opacity: 0 })
    })

    it('draws no ring at rest, and a 2dp primary one while focused', async () => {
      await renderField()

      expect(styleOf(ring())).toMatchObject({
        borderRadius: radii.pill,
        borderWidth: 0,
      })

      await fireEvent(input(), 'focus', {})
      await advance(motion.durationShort2)
      // The colour holds, since the ring is primary whether or not it shows.
      expect(styleOf(ring())).toMatchObject({
        borderColor: colors.primary,
        borderWidth: 2,
      })

      await fireEvent(input(), 'blur', {})
      await advance(motion.durationShort2)
      expect(styleOf(ring())).toMatchObject({ borderWidth: 0 })
    })

    it('draws the ring over the whole bar, hidden, and taking no touches', async () => {
      await renderField()

      expect(ring().props['aria-hidden']).toBe(true)
      expect(styleOf(ring())).toMatchObject({
        bottom: 0,
        left: 0,
        pointerEvents: 'none',
        position: 'absolute',
        right: 0,
        top: 0,
      })
    })

    it('eases the ring in', async () => {
      await renderField()

      await fireEvent(input(), 'focus', {})
      await advance(motion.durationShort2 / 2)

      const { borderWidth } = styleOf(ring())
      expect(borderWidth).toBeGreaterThan(0)
      expect(borderWidth).toBeLessThan(2)
    })

    it('draws the ring at once under reduced motion', async () => {
      mockReducedMotion = true
      await renderField()

      await fireEvent(input(), 'focus', {})
      await advance(0)

      expect(styleOf(ring())).toMatchObject({
        borderColor: colors.primary,
        borderWidth: 2,
      })
    })

    it('rings an invalid bar in the error role, 1dp and 2dp once focused', async () => {
      await renderField({ error: 'Enter a keyword.' })

      expect(styleOf(ring())).toMatchObject({
        borderColor: colors.error,
        borderWidth: 1,
      })
      expect(input().props).toMatchObject({
        cursorColor: colors.error,
        selectionColor: colors.error,
      })

      await fireEvent(input(), 'focus', {})
      await advance(motion.durationShort2)
      expect(styleOf(ring())).toMatchObject({
        borderColor: colors.error,
        borderWidth: 2,
      })
    })

    it('eases the ring to the error role when an error arrives', async () => {
      const { rerender } = await renderField()
      await fireEvent(input(), 'focus', {})
      await advance(motion.durationShort2)

      await rerender({ error: 'Enter a keyword.' })
      await advance(motion.durationShort2)

      expect(styleOf(ring())).toMatchObject({
        borderColor: eased(colors.error),
        borderWidth: 2,
      })
    })

    it('draws disabled in the page colours, and takes no input', async () => {
      const inputRef = createRef<TextInput>()
      await renderField({
        defaultValue: 'Keyword',
        error: 'Enter a keyword.',
        inputRef,
        isDisabled: true,
      })
      const focus = jest.spyOn(inputRef.current ?? missing('control'), 'focus')

      expect(styleOf(bar())).toMatchObject({
        backgroundColor: DISABLED_CONTAINER,
      })
      // No ring, the error's included.
      expect(styleOf(ring())).toMatchObject({ borderWidth: 0 })
      expect(glyph().props).toMatchObject({ color: DISABLED_CONTENT })
      expect(styleOf(input())).toMatchObject({ color: DISABLED_CONTENT })
      expect(input().props).toMatchObject({
        'aria-disabled': true,
        editable: false,
        placeholderTextColor: DISABLED_CONTENT,
      })
      expect(clearButton()?.props.accessibilityState).toMatchObject({
        disabled: true,
      })

      await fireEvent.press(bar())
      expect(focus).not.toHaveBeenCalled()
    })

    it('drops the pointer and the focus once disabled under them', async () => {
      mockReducedMotion = true
      const { rerender } = await renderField({ defaultValue: 'Keyword' })
      await fireEvent(bar(), 'hoverIn', {})
      await fireEvent(input(), 'focus', {})

      await rerender({ defaultValue: 'Keyword', isDisabled: true })
      await advance(0)

      expect(styleOf(layer())).toMatchObject({ opacity: 0 })
      expect(styleOf(ring())).toMatchObject({ borderWidth: 0 })
      // Nor does Escape empty it. React Native Web draws a disabled control
      // read-only rather than inert, so it still takes a key press; Testing
      // Library drops events on a control that is not editable, so the
      // handler is called as the browser would.
      const onKeyPress: unknown = input().props.onKeyPress
      if (!isKeyHandler(onKeyPress)) {
        missing('key handler')
      }
      await act(() => {
        onKeyPress({ nativeEvent: { key: 'Escape' } })
      })
      expect(input().props.value).toBe('Keyword')
    })
  })

  describe('supporting line', () => {
    it('describes the control by its description on iOS and Android', async () => {
      await renderField({ description: 'Supporting line' })

      expect(input().props.accessibilityHint).toBe('Supporting line')
      // Read as the hint, so not read again where it is drawn.
      expect(screen.queryByText('Supporting line')).toBeNull()
      expect(
        screen.getByText('Supporting line', { includeHiddenElements: true }),
      ).toBeTruthy()
    })

    it('replaces the description with the error', async () => {
      await renderField({
        description: 'Supporting line',
        error: 'Enter a keyword.',
      })

      expect(input().props.accessibilityHint).toBe('Enter a keyword.')
      expect(
        screen.queryByText('Supporting line', { includeHiddenElements: true }),
      ).toBeNull()
      expect(
        flatStyleOf(
          screen.getByText('Enter a keyword.', { includeHiddenElements: true }),
        ),
      ).toMatchObject({ color: colors.error })
    })
  })

  describe('on the web', () => {
    it('marks the control invalid, and points it at the error', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await renderField({ error: 'Enter a keyword.' })

      expect(input().props['aria-invalid']).toBe(true)
      const ids = String(input().props['aria-describedby']).split(' ')
      expect(ids).toHaveLength(1)
      expect(
        screen.root?.queryAll((node) => node.props.id === ids[0])[0]?.children,
      ).toEqual(['Enter a keyword.'])
    })
  })
})
