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
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { TextFieldProps } from '.'

import { TextField } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
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
const { colors, motion, radii, spacing, stateLayerOpacity, typography } = theme

const DISABLED_CONTAINER = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContainer,
)
const DISABLED_CONTENT = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContent,
)

// The device's text size under the suite: React Native's Jest preset reports
// a font scale of 2, so every line the box is built from is twice its token.
const FONT_SCALE = 2

const CALL_SITE = { marginTop: 4 }

type Host = ReturnType<typeof screen.getByTestId>

// The label's place and type, as each case reads them.
type Place = Readonly<Record<string, number | string>>

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

// The field in a view the cases find it by.
function fieldOf(props: Partial<TextFieldProps>): ReactElement {
  return (
    <View testID="field">
      <TextField label="Label" {...props} />
    </View>
  )
}

// The filled box's indicator, the last thing drawn before the column.
function indicator() {
  return hostsOf(box()).at(-2) ?? missing('indicator')
}

function input() {
  return screen.getByLabelText('Label')
}

// The label as it is drawn, which is hidden from screen readers.
function label() {
  return hostsOf(hostsOf(column())[0])[0]
}

// The filled box's state layer, inside the surface that clips it to the box's
// corners, which is the first thing the box draws.
function layer() {
  return hostsOf(hostsOf(box())[0])[0]
}

function missing(what: string): never {
  throw new TypeError(`expected the field to draw its ${what}`)
}

// The outlined box's three pieces, each clipping a box that draws the
// outline, and the box inside each.
function outline() {
  return hostsOf(hostsOf(box())[0]).map((piece) => ({
    drawn: hostsOf(piece)[0],
    piece,
  }))
}

// The label as at rest or floated, in the type and place the field gives it.
function placeOf(
  role: 'bodyLarge' | 'bodySmall' | 'labelMedium',
  top: number,
): Place {
  return {
    fontSize: typography[`${role}Size`],
    letterSpacing: typography[`${role}Tracking`],
    lineHeight: typography[`${role}LineHeight`],
    top,
  }
}

async function renderField(
  props: Partial<TextFieldProps> = {},
): Promise<{ rerender: (next: Partial<TextFieldProps>) => Promise<void> }> {
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
  mockReducedMotion = false
  // The preset's AccessibilityInfo is a mock already, which spyOn hands back
  // as it is and restoring leaves holding its calls.
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('TextField', () => {
  it('is a text input named by its label, which is not read again', async () => {
    await renderField()

    expect(input().props['aria-label']).toBe('Label')
    // The label drawn over the box is the same words, so it is hidden.
    expect(screen.queryByText('Label')).toBeNull()
  })

  it('keeps what is typed, and reports it, given defaultValue', async () => {
    const onChange = jest.fn()
    await renderField({ defaultValue: 'Value', onChange })

    expect(input().props.value).toBe('Value')
    await fireEvent.changeText(input(), 'Edited')

    expect(onChange).toHaveBeenCalledWith('Edited')
    expect(input().props.value).toBe('Edited')
  })

  it('shows the value it is given, reporting an edit without keeping it', async () => {
    const onChange = jest.fn()
    const { rerender } = await renderField({ onChange, value: 'Value' })

    await fireEvent.changeText(input(), 'Edited')

    expect(onChange).toHaveBeenCalledWith('Edited')
    expect(input().props.value).toBe('Value')
    await rerender({ onChange, value: 'Edited' })
    expect(input().props.value).toBe('Edited')
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

  describe('label', () => {
    it('rests on the value line while empty, and floats on focus', async () => {
      await renderField()

      expect(styleOf(label())).toMatchObject({
        ...placeOf(
          'bodyLarge',
          (typography.bodySmallLineHeight * FONT_SCALE) / 2,
        ),
        color: colors.onSurfaceVariant,
      })

      await fireEvent(input(), 'focus', {})
      await advance(motion.durationShort3)

      expect(styleOf(label())).toMatchObject({
        ...placeOf('bodySmall', 0),
        color: eased(colors.primary),
      })

      await fireEvent(input(), 'blur', {})
      await advance(motion.durationShort3)

      expect(styleOf(label())).toMatchObject(
        placeOf('bodyLarge', (typography.bodySmallLineHeight * FONT_SCALE) / 2),
      )
    })

    it('floats while the field holds a value', async () => {
      await renderField({ defaultValue: 'Value' })

      expect(styleOf(label())).toMatchObject(placeOf('bodySmall', 0))
    })

    it('stays small at the top in label medium given floatingLabel false', async () => {
      await renderField({ floatingLabel: false })

      expect(styleOf(label())).toMatchObject(placeOf('labelMedium', 0))
      await fireEvent(input(), 'focus', {})
      await advance(motion.durationShort3)
      expect(styleOf(label())).toMatchObject(placeOf('labelMedium', 0))
    })

    it('floats onto the outline of the outlined box', async () => {
      await renderField({ variant: 'outlined' })

      expect(styleOf(label())).toMatchObject(placeOf('bodyLarge', 0))
      await fireEvent(input(), 'focus', {})
      await advance(motion.durationShort3)

      // Centred on the box's top edge: up past the box's padding and half
      // its own line.
      expect(styleOf(label())).toMatchObject(
        placeOf(
          'bodySmall',
          -(spacing.lg + (typography.bodySmallLineHeight * FONT_SCALE) / 2),
        ),
      )
    })

    it('eases to its floated place', async () => {
      await renderField()
      await fireEvent(input(), 'focus', {})
      await advance(motion.durationShort3 / 2)

      const halfway = styleOf(label()).top
      expect(halfway).toBeGreaterThan(0)
      expect(halfway).toBeLessThan(
        (typography.bodySmallLineHeight * FONT_SCALE) / 2,
      )
    })

    it('moves at once under reduced motion', async () => {
      mockReducedMotion = true
      await renderField()
      await fireEvent(input(), 'focus', {})
      await advance(0)

      expect(styleOf(label())).toMatchObject(placeOf('bodySmall', 0))
    })

    it('marks a required field with an asterisk', async () => {
      await renderField({ isRequired: true })

      expect(
        screen.getAllByText('Label*', { includeHiddenElements: true }),
      ).toHaveLength(1)
    })

    it('starts the label at the start of the column, as wide as its text', async () => {
      await renderField()

      expect(styleOf(hostsOf(column())[0])).toMatchObject({
        alignItems: 'flex-start',
        end: 0,
        position: 'absolute',
        start: 0,
      })
    })
  })

  describe('box', () => {
    it('grows with the text size from the page height', async () => {
      await renderField()

      // The page's 56dp at the default text size: 8dp above and below the
      // label's line and the value's.
      expect(styleOf(box()).minHeight).toBe(
        2 * spacing.sm +
          (typography.bodySmallLineHeight + typography.bodyLargeLineHeight) *
            FONT_SCALE,
      )
      expect(styleOf(input()).minHeight).toBe(
        typography.bodyLargeLineHeight * FONT_SCALE,
      )
      // The control clears the label's line at the top of a filled box.
      expect(styleOf(input()).marginTop).toBe(
        typography.bodySmallLineHeight * FONT_SCALE,
      )
    })

    it('grows with the text size from the outlined page height', async () => {
      await renderField({ variant: 'outlined' })

      expect(styleOf(box()).minHeight).toBe(
        2 * spacing.lg + typography.bodyLargeLineHeight * FONT_SCALE,
      )
      expect(styleOf(input()).marginTop).toBeUndefined()
    })

    it('draws the filled box, its indicator 1dp in the outline role at rest', async () => {
      await renderField()

      expect(styleOf(box())).toMatchObject({
        backgroundColor: colors.surfaceContainerHighest,
      })
      expect(styleOf(indicator())).toMatchObject({
        borderColor: colors.outline,
        borderTopWidth: 1,
      })
    })

    it('thickens the indicator to 2dp in primary while focused', async () => {
      await renderField()
      await fireEvent(input(), 'focus', {})
      await advance(motion.durationShort2)

      expect(styleOf(indicator())).toMatchObject({
        borderColor: eased(colors.primary),
        borderTopWidth: 2,
      })
    })

    it('draws the state layer and an on surface indicator under a pointer', async () => {
      await renderField()
      expect(styleOf(hostsOf(box())[0])).toMatchObject({
        borderTopEndRadius: radii.xs,
        borderTopStartRadius: radii.xs,
        overflow: 'hidden',
      })
      // The layer alone, with no ripple beside it.
      expect(hostsOf(hostsOf(box())[0])).toHaveLength(1)
      expect(styleOf(layer())).toMatchObject({ opacity: 0 })

      await fireEvent(box(), 'hoverIn', {})
      await advance(motion.durationShort2)

      expect(styleOf(layer())).toMatchObject({
        backgroundColor: colors.onSurface,
        opacity: stateLayerOpacity.hover,
      })
      expect(styleOf(indicator())).toMatchObject({
        borderColor: eased(colors.onSurface),
      })

      await fireEvent(box(), 'hoverOut', {})
      expect(styleOf(layer())).toMatchObject({ opacity: 0 })
    })

    it('takes the error role, and on error container under a pointer', async () => {
      await renderField({ error: 'Enter a value.' })

      expect(styleOf(indicator())).toMatchObject({
        borderColor: colors.error,
        borderTopWidth: 1,
      })
      expect(styleOf(label())).toMatchObject({ color: colors.error })

      await fireEvent(box(), 'hoverIn', {})
      await advance(motion.durationShort2)
      expect(styleOf(indicator())).toMatchObject({
        borderColor: eased(colors.onErrorContainer),
      })

      await fireEvent(input(), 'focus', {})
      await advance(motion.durationShort2)
      expect(styleOf(indicator())).toMatchObject({
        borderColor: eased(colors.error),
        borderTopWidth: 2,
      })
      expect(input().props).toMatchObject({
        cursorColor: colors.error,
        selectionColor: colors.error,
      })
    })

    it('carries the caret in primary', async () => {
      await renderField()

      expect(input().props).toMatchObject({
        cursorColor: colors.primary,
        selectionColor: colors.primary,
        underlineColorAndroid: 'transparent',
      })
    })

    it('draws disabled in the page colours, and takes no input or pointer', async () => {
      await renderField({ defaultValue: 'Value', isDisabled: true })

      expect(styleOf(box())).toMatchObject({
        backgroundColor: DISABLED_CONTAINER,
      })
      expect(styleOf(indicator())).toMatchObject({
        borderColor: DISABLED_CONTAINER,
        borderTopWidth: 1,
      })
      expect(styleOf(label())).toMatchObject({ color: DISABLED_CONTENT })
      expect(styleOf(input())).toMatchObject({ color: DISABLED_CONTENT })
      expect(input().props).toMatchObject({
        'aria-disabled': true,
        editable: false,
      })

      await fireEvent(box(), 'hoverIn', {})
      expect(styleOf(layer())).toMatchObject({ opacity: 0 })
    })

    it('drops the pointer and the focus once disabled under them', async () => {
      // At once, so the translucent colour is the one the token writes rather
      // than the one an easing rounds it to.
      mockReducedMotion = true
      const { rerender } = await renderField()
      await fireEvent(box(), 'hoverIn', {})
      await fireEvent(input(), 'focus', {})
      await advance(0)
      expect(styleOf(indicator())).toMatchObject({
        borderColor: colors.primary,
        borderTopWidth: 2,
      })

      await rerender({ isDisabled: true })
      await advance(0)
      expect(styleOf(layer())).toMatchObject({ opacity: 0 })
      expect(styleOf(indicator())).toMatchObject({
        borderColor: DISABLED_CONTAINER,
        borderTopWidth: 1,
      })
      expect(styleOf(label())).toMatchObject({ color: DISABLED_CONTENT })
    })

    it('shows a read-only value as it is, taking no input', async () => {
      await renderField({ defaultValue: 'Value', isReadOnly: true })

      expect(input().props).toMatchObject({
        'aria-disabled': false,
        editable: false,
      })
      expect(styleOf(input())).toMatchObject({ color: colors.onSurface })
    })

    it('draws the outlined box 1dp in the outline role, 2dp in primary while focused', async () => {
      await renderField({ variant: 'outlined' })

      expect(styleOf(box()).backgroundColor).toBe('transparent')
      for (const { drawn } of outline()) {
        expect(styleOf(drawn)).toMatchObject({
          borderColor: colors.outline,
          borderWidth: 1,
        })
      }

      await fireEvent(box(), 'hoverIn', {})
      await advance(motion.durationShort2)
      for (const { drawn } of outline()) {
        expect(styleOf(drawn)).toMatchObject({
          borderColor: eased(colors.onSurface),
        })
      }

      await fireEvent(input(), 'focus', {})
      await advance(motion.durationShort2)
      for (const { drawn } of outline()) {
        expect(styleOf(drawn)).toMatchObject({
          borderColor: eased(colors.primary),
          borderWidth: 2,
        })
      }
    })

    it('draws the outlined box in the error and disabled colours', async () => {
      // At once, so the translucent colour is the one the token writes rather
      // than the one an easing rounds it to.
      mockReducedMotion = true
      const { rerender } = await renderField({
        error: 'Enter a value.',
        variant: 'outlined',
      })

      for (const { drawn } of outline()) {
        expect(styleOf(drawn)).toMatchObject({ borderColor: colors.error })
      }

      await rerender({ isDisabled: true, variant: 'outlined' })
      await advance(motion.durationShort2)
      for (const { drawn } of outline()) {
        expect(styleOf(drawn)).toMatchObject({
          borderColor: DISABLED_CONTAINER,
        })
      }
      // No fill, disabled or not.
      expect(styleOf(box()).backgroundColor).toBe('transparent')
    })

    it('cuts the notch as wide as the measured label once it floats', async () => {
      const { rerender } = await renderField({ variant: 'outlined' })
      const measure = hostsOf(hostsOf(column())[1])[0]
      await fireEvent(measure, 'layout', {
        nativeEvent: { layout: { height: 16, width: 40, x: 0, y: 0 } },
      })

      const [start, notch, end] = outline()
      // The page's 16dp to the label, less the notch's own 4dp beside it.
      expect(styleOf(start.piece).width).toBe(spacing.lg - spacing.xs)
      expect(styleOf(end.piece).minWidth).toBe(spacing.lg - spacing.xs)
      // Closed while the label rests in the box.
      expect(styleOf(notch.piece).width).toBe(0)

      await rerender({ defaultValue: 'Value', variant: 'outlined' })
      await fireEvent(input(), 'focus', {})

      expect(styleOf(outline()[1].piece).width).toBe(40)
    })

    it('starts the outline past an icon at either end', async () => {
      await renderField({
        leadingIcon: LEADING,
        trailingIcon: TRAILING,
        variant: 'outlined',
      })

      const [start, , end] = outline()
      const inset = spacing.md + 24 + spacing.lg - spacing.xs
      expect(styleOf(start.piece).width).toBe(inset)
      expect(styleOf(end.piece).minWidth).toBe(inset)
    })
  })

  describe('icons', () => {
    it('hands each slot the page icon in the muted role', async () => {
      await renderField({ leadingIcon: LEADING, trailingIcon: TRAILING })

      expect(screen.getByTestId('leading')).toHaveTextContent(
        `${colors.onSurfaceVariant} 24`,
      )
      expect(screen.getByTestId('trailing')).toHaveTextContent(
        `${colors.onSurfaceVariant} 24`,
      )
    })

    it('turns the trailing icon to the error role while there is an error', async () => {
      await renderField({
        error: 'Enter a value.',
        leadingIcon: LEADING,
        trailingIcon: TRAILING,
      })

      expect(screen.getByTestId('leading')).toHaveTextContent(
        `${colors.onSurfaceVariant} 24`,
      )
      expect(screen.getByTestId('trailing')).toHaveTextContent(
        `${colors.error} 24`,
      )
    })

    it('draws both icons in the disabled colour', async () => {
      await renderField({
        error: 'Enter a value.',
        isDisabled: true,
        leadingIcon: LEADING,
        trailingIcon: TRAILING,
      })

      expect(screen.getByTestId('leading')).toHaveTextContent(
        `${DISABLED_CONTENT} 24`,
      )
      expect(screen.getByTestId('trailing')).toHaveTextContent(
        `${DISABLED_CONTENT} 24`,
      )
    })
  })

  describe('value line', () => {
    it('writes a number in the mono face with tabular figures, given numeric', async () => {
      await renderField({ numeric: true })

      expect(styleOf(input())).toMatchObject({
        fontVariant: ['tabular-nums'],
      })
    })

    it('fades the prefix and suffix in once the label has floated', async () => {
      await renderField({ prefix: 'Prefix', suffix: 'Suffix' })

      expect(styleOf(screen.getByText('Prefix'))).toMatchObject({
        color: colors.onSurfaceVariant,
        opacity: 0,
      })
      expect(styleOf(screen.getByText('Suffix'))).toMatchObject({ opacity: 0 })

      await fireEvent(input(), 'focus', {})
      await advance(motion.durationShort3)

      expect(styleOf(screen.getByText('Prefix'))).toMatchObject({ opacity: 1 })
      expect(styleOf(screen.getByText('Suffix'))).toMatchObject({ opacity: 1 })
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
        error: 'Enter a value.',
      })

      expect(input().props.accessibilityHint).toBe('Enter a value.')
      expect(
        screen.queryByText('Supporting line', { includeHiddenElements: true }),
      ).toBeNull()
      expect(
        styleOf(
          screen.getByText('Enter a value.', { includeHiddenElements: true }),
        ),
      ).toMatchObject({ color: colors.error })
    })

    it('reads the prefix and suffix ahead of the description', async () => {
      await renderField({
        description: 'Supporting line',
        prefix: 'Prefix',
        suffix: 'Suffix',
      })

      expect(input().props.accessibilityHint).toBe(
        'Prefix Suffix Supporting line',
      )
    })

    it('says the limit once, after the description', async () => {
      const { rerender } = await renderField({
        description: 'Supporting line',
        maxLength: 20,
      })

      expect(input().props.accessibilityHint).toBe(
        'Supporting line Up to 20 characters',
      )

      await rerender({ maxLength: 1 })
      expect(input().props.accessibilityHint).toBe('Up to 1 character')

      await rerender({
        characterLimitLabel: 'Bis zu 20 Zeichen',
        maxLength: 20,
      })
      expect(input().props.accessibilityHint).toBe('Bis zu 20 Zeichen')
    })

    it('has no hint and no line with nothing to say', async () => {
      await renderField()

      expect(input().props.accessibilityHint).toBeUndefined()
      const line = hostsOf(hostsOf(screen.getByTestId('field'))[0])[1]
      expect(styleOf(line)).toMatchObject({
        position: 'absolute',
      })
    })

    it('counts the characters against maxLength, out of screen readers', async () => {
      await renderField({
        characterCount: true,
        defaultValue: 'Value',
        maxLength: 20,
      })

      expect(screen.queryByText('5/20')).toBeNull()
      expect(
        screen.getByText('5/20', { includeHiddenElements: true }),
      ).toBeTruthy()

      await fireEvent.changeText(input(), 'Values')

      expect(
        screen.getByText('6/20', { includeHiddenElements: true }),
      ).toBeTruthy()
    })

    it('counts the characters alone without a maxLength', async () => {
      await renderField({ characterCount: true, defaultValue: 'Value' })

      expect(
        screen.getByText('5', { includeHiddenElements: true }),
      ).toBeTruthy()
    })

    it('announces an error as it arrives on iOS, and not one it opened with', async () => {
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation(() => undefined)
      const { rerender } = await renderField({ error: 'Enter a value.' })

      expect(announce).not.toHaveBeenCalled()

      await rerender({})
      await rerender({ error: 'Enter a value.' })
      await rerender({ error: 'Enter a value.' })

      expect(announce).toHaveBeenCalledTimes(1)
      expect(announce).toHaveBeenCalledWith('Enter a value.')
      // VoiceOver hears it through the announcement and the hint, so the
      // message itself is hidden.
      expect(screen.queryByText('Enter a value.')).toBeNull()
    })

    it('leaves an error in a polite live region on Android', async () => {
      jest.replaceProperty(Platform, 'OS', 'android')
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation(() => undefined)
      const { rerender } = await renderField()

      await rerender({ error: 'Enter a value.' })

      expect(announce).not.toHaveBeenCalled()
      expect(
        screen.getByText('Enter a value.').parent?.props['aria-live'],
      ).toBe('polite')
    })
  })

  describe('on the web', () => {
    it('points the control at what describes it, and drops the hint', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await renderField({
        description: 'Supporting line',
        maxLength: 20,
        prefix: 'Prefix',
      })

      const ids = String(input().props['aria-describedby']).split(' ')
      expect(input().props.accessibilityHint).toBeUndefined()
      expect(
        ids.map(
          (id): unknown =>
            screen.root?.queryAll((element) => element.props.id === id)[0]
              ?.props.children,
        ),
      ).toEqual(['Prefix', 'Supporting line', 'Up to 20 characters'])
      // The description is read where it is drawn.
      expect(screen.getByText('Supporting line')).toBeTruthy()
    })

    it('marks the control invalid and required', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await renderField({ error: 'Enter a value.', isRequired: true })

      expect(input().props).toMatchObject({
        'aria-invalid': true,
        'aria-required': true,
      })
      expect(screen.getByText('Enter a value.').parent?.props).toMatchObject({
        'aria-atomic': true,
        'aria-live': 'polite',
      })
    })

    it('leaves the control the direction of the page around it', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await renderField()

      expect(input().props).toHaveProperty('dir', null)
    })

    it('leaves the direction and the states alone on iOS and Android', async () => {
      await renderField({ error: 'Enter a value.', isRequired: true })

      expect(input().props).not.toHaveProperty('dir')
      expect(input().props).not.toHaveProperty('aria-invalid')
      expect(input().props).not.toHaveProperty('aria-required')
    })
  })
})
