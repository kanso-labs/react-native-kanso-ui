import type { ComponentRef, ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { Color } from 'react-stately'
import type { TestInstance } from 'test-renderer'

import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { parseColor } from 'react-stately'

import type { ColorSwatchPickerProps } from '.'

import { ColorSwatchPicker } from '.'
import { I18nProvider } from '../../i18n/provider'
import { ThemeScope } from '../../theme-scope'
import { scopeFor } from '../../theme/scope'
import { ColorSwatch } from '../color-swatch'

const { theme } = scopeFor('light', {})
const { colors, radii, spacing, stateLayerOpacity } = theme

const PURPLE = '#6750A4'
const GREY = '#625B71'
const PINK = '#7D5260'

// What React Stately calls the three, in English and in Brazilian Portuguese.
const NAMES = {
  [GREY]: 'dark grayish purple',
  [PINK]: 'dark grayish pink',
  [PURPLE]: 'dark purple',
}

// A scheme that squares every corner.
const SQUARE = { '--kui-radius-xs': '0px' }

// A style a call site hands the picker or an item.
const CALL_SITE = { marginTop: 4 }

// A press with no point on the page, on a control that measures nothing.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// The picker, which is the element rendered. A container is never an
// accessibility element of its own, since iOS would then read it as one and
// hide its swatches, so it is not one Testing Library finds by role.
function group() {
  const root = screen.root
  if (root?.props.role !== 'radiogroup') {
    throw new TypeError('expected the group')
  }
  return root
}

function hexOf(color: Color | undefined) {
  return color?.toString('hex')
}

function labelOf(element: { props: { accessibilityLabel?: string } }) {
  return element.props.accessibilityLabel
}

// The colour painted on the swatch an item draws.
function paintOf(name: string) {
  const painted = views(radio(name))
    .at(0)
    ?.queryAll(
      (each) =>
        each.type === 'View' && styleOf(each).backgroundColor !== undefined,
    )
    .at(0)
  return painted === undefined ? undefined : styleOf(painted).backgroundColor
}

function Picker({
  children,
  ...props
}: ColorSwatchPickerProps & { readonly children?: ReactNode }) {
  return (
    <ColorSwatchPicker {...props}>
      {children ?? (
        <>
          <ColorSwatchPicker.Item color={PURPLE} />
          <ColorSwatchPicker.Item color={GREY} />
          <ColorSwatchPicker.Item color={PINK} />
        </>
      )}
    </ColorSwatchPicker>
  )
}

function radio(name: string) {
  return screen.getByRole('radio', { name })
}

// The ring an item draws around its swatch, which is the view after the one
// holding what it draws.
function ringOf(name: string) {
  return views(radio(name)).at(1)
}

// The style of that ring, for an item that draws one.
function ringStyleOf(name: string) {
  const ring = ringOf(name)
  if (ring === undefined) {
    throw new TypeError('expected a ring')
  }
  return styleOf(ring)
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function views(element: TestInstance) {
  return element.children.filter(
    (each): each is TestInstance => typeof each !== 'string',
  )
}

describe('ColorSwatchPicker', () => {
  describe('the roles and names', () => {
    it('is a radio group of swatches, each named by its colour', async () => {
      await render(<Picker defaultValue={GREY} />)

      expect(group().props['aria-label']).toBe('Color swatches')
      expect(screen.getAllByRole('radio').map(labelOf)).toStrictEqual([
        NAMES[PURPLE],
        NAMES[GREY],
        NAMES[PINK],
      ])
      expect(
        screen.getAllByRole('radio', { checked: true }).map(labelOf),
      ).toStrictEqual([NAMES[GREY]])
    })

    it("speaks the provider's locale", async () => {
      await render(
        <I18nProvider locale="pt-BR">
          <Picker />
        </I18nProvider>,
      )

      expect(group().props['aria-label']).toBe('Amostras de cores')
      expect(radio('escuro roxo')).toBeTruthy()
    })

    it('takes its name from aria-label, and leaves it to aria-labelledby', async () => {
      const { rerender } = await render(<Picker aria-label="Label" />)

      expect(group().props['aria-label']).toBe('Label')

      await rerender(<Picker aria-labelledby="heading" />)

      expect(group().props['aria-label']).toBeUndefined()
    })

    it('names a transparent swatch by the word, and an item by its own aria-label', async () => {
      await render(
        <Picker>
          <ColorSwatchPicker.Item />
          <ColorSwatchPicker.Item aria-label="Brand" color={PURPLE} />
        </Picker>,
      )

      expect(radio('transparent')).toBeTruthy()
      expect(radio('Brand')).toBeTruthy()
    })

    it('hides what an item draws from a screen reader', async () => {
      await render(<Picker />)

      expect(screen.queryByRole('img')).toBeNull()
      expect(
        screen.getAllByRole('img', { includeHiddenElements: true }),
      ).toHaveLength(3)
    })
  })

  describe('the value', () => {
    it('chooses a swatch when pressed, and tells onChange its colour', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      const onPress = jest.fn()
      await render(
        <Picker defaultValue={PURPLE} onChange={onChange}>
          <ColorSwatchPicker.Item color={PURPLE} />
          <ColorSwatchPicker.Item color={GREY} onPress={onPress} />
        </Picker>,
      )

      await fireEvent.press(radio(NAMES[GREY]), PRESS)

      expect(onPress).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(hexOf(onChange.mock.calls[0]?.[0])).toBe(GREY)
      expect(radio(NAMES[GREY])).toBeChecked()
      expect(radio(NAMES[PURPLE])).not.toBeChecked()
    })

    it('leaves the chosen swatch chosen, and says nothing, when it is pressed again', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      await render(<Picker defaultValue={PURPLE} onChange={onChange} />)

      await fireEvent.press(radio(NAMES[PURPLE]), PRESS)

      expect(onChange).not.toHaveBeenCalled()
      expect(radio(NAMES[PURPLE])).toBeChecked()
    })

    it('follows a value the call site holds', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      const { rerender } = await render(
        <Picker onChange={onChange} value={PURPLE} />,
      )

      await fireEvent.press(radio(NAMES[PINK]), PRESS)

      expect(hexOf(onChange.mock.calls[0]?.[0])).toBe(PINK)
      expect(radio(NAMES[PURPLE])).toBeChecked()

      await rerender(<Picker onChange={onChange} value={parseColor(PINK)} />)

      expect(radio(NAMES[PINK])).toBeChecked()
      expect(radio(NAMES[PURPLE])).not.toBeChecked()
    })

    it('reads two spellings of one colour as one choice, its alpha included', async () => {
      await render(
        <Picker defaultValue={parseColor('rgb(103, 80, 164)')}>
          <ColorSwatchPicker.Item aria-label="First item" color={PURPLE} />
          <ColorSwatchPicker.Item aria-label="Second item" color="#6750A480" />
          <ColorSwatchPicker.Item aria-label="Third item" color={GREY} />
        </Picker>,
      )

      expect(radio('First item')).toBeChecked()
      expect(radio('Second item')).not.toBeChecked()
      expect(radio('Third item')).not.toBeChecked()
    })

    it('starts on black when given no value, as React Aria does', async () => {
      await render(
        <Picker>
          <ColorSwatchPicker.Item aria-label="Black" color="#000000" />
          <ColorSwatchPicker.Item color={PURPLE} />
        </Picker>,
      )

      expect(radio('Black')).toBeChecked()
    })

    it('rules out a disabled swatch', async () => {
      const onChange = jest.fn<(value: Color) => void>()
      await render(
        <Picker defaultValue={PURPLE} onChange={onChange}>
          <ColorSwatchPicker.Item color={PURPLE} />
          <ColorSwatchPicker.Item color={GREY} isDisabled />
        </Picker>,
      )

      await fireEvent.press(radio(NAMES[GREY]), PRESS)

      expect(onChange).not.toHaveBeenCalled()
      expect(
        screen.getByRole('radio', { disabled: true, name: NAMES[GREY] }),
      ).toBeTruthy()
      expect(styleOf(radio(NAMES[GREY]))).toMatchObject({
        opacity: stateLayerOpacity.disabledContent,
      })
      expect(styleOf(radio(NAMES[PURPLE])).opacity).toBeUndefined()
    })
  })

  describe('the rings', () => {
    it('rings the chosen swatch in primary, 2dp clear of it, and no other', async () => {
      await render(<Picker defaultValue={GREY} />)

      expect(ringStyleOf(NAMES[GREY])).toStrictEqual({
        borderColor: colors.primary,
        borderRadius: radii.xs + Math.min(radii.xs, 4),
        borderWidth: 2,
        bottom: -4,
        left: -4,
        pointerEvents: 'none',
        position: 'absolute',
        right: -4,
        top: -4,
      })
      expect(ringOf(NAMES[PURPLE])).toBeUndefined()
      expect(ringOf(NAMES[PINK])).toBeUndefined()
    })

    it('keeps the corner square where a scheme squares the swatch', async () => {
      await render(
        <ThemeScope theme={SQUARE}>
          <Picker defaultValue={PURPLE} />
        </ThemeScope>,
      )

      expect(ringStyleOf(NAMES[PURPLE]).borderRadius).toBe(0)
    })

    it('rings a swatch in outline variant under a pointer, and outline while pressed', async () => {
      await render(<Picker defaultValue={PURPLE} />)

      await fireEvent(radio(NAMES[GREY]), 'hoverIn')

      expect(ringStyleOf(NAMES[GREY])).toMatchObject({
        borderColor: colors.outlineVariant,
      })

      await fireEvent(radio(NAMES[GREY]), 'pressIn', PRESS)

      expect(ringStyleOf(NAMES[GREY])).toMatchObject({
        borderColor: colors.outline,
      })

      await fireEvent(radio(NAMES[GREY]), 'pressOut', PRESS)
      await fireEvent(radio(NAMES[GREY]), 'hoverOut')

      expect(ringOf(NAMES[GREY])).toBeUndefined()
    })

    it('keeps the chosen ring under a pointer', async () => {
      await render(<Picker defaultValue={PURPLE} />)

      await fireEvent(radio(NAMES[PURPLE]), 'hoverIn')
      await fireEvent(radio(NAMES[PURPLE]), 'pressIn', PRESS)

      expect(ringStyleOf(NAMES[PURPLE])).toMatchObject({
        borderColor: colors.primary,
      })
    })

    it('rings a disabled swatch for nothing', async () => {
      await render(
        <Picker defaultValue={PURPLE}>
          <ColorSwatchPicker.Item color={PURPLE} />
          <ColorSwatchPicker.Item color={GREY} isDisabled />
        </Picker>,
      )

      await fireEvent(radio(NAMES[GREY]), 'hoverIn')

      expect(ringOf(NAMES[GREY])).toBeUndefined()
    })

    it('drops the ring of a swatch ruled out under a pointer', async () => {
      const { rerender } = await render(
        <Picker defaultValue={PURPLE}>
          <ColorSwatchPicker.Item color={PURPLE} />
          <ColorSwatchPicker.Item color={GREY} />
        </Picker>,
      )

      await fireEvent(radio(NAMES[GREY]), 'hoverIn')
      await rerender(
        <Picker defaultValue={PURPLE}>
          <ColorSwatchPicker.Item color={PURPLE} />
          <ColorSwatchPicker.Item color={GREY} isDisabled />
        </Picker>,
      )

      expect(ringOf(NAMES[GREY])).toBeUndefined()
    })

    it('outlines a swatch focused from a key, 6dp out, beside its ring', async () => {
      await render(<Picker defaultValue={PURPLE} />)

      expect(styleOf(radio(NAMES[PURPLE])).outlineWidth).toBeUndefined()

      await fireEvent(radio(NAMES[PURPLE]), 'focus')

      expect(styleOf(radio(NAMES[PURPLE]))).toMatchObject({
        outlineColor: colors.primary,
        outlineOffset: 6,
        outlineStyle: 'solid',
        outlineWidth: 2,
      })
      expect(ringOf(NAMES[PURPLE])).toBeDefined()
    })
  })

  describe('the layout', () => {
    it('wraps the swatches onto rows', async () => {
      await render(<Picker testID="picker" />)

      expect(styleOf(screen.getByTestId('picker'))).toStrictEqual({
        alignItems: 'flex-start',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
      })
    })

    it('lines them up in one column as a stack', async () => {
      await render(<Picker layout="stack" testID="picker" />)

      expect(styleOf(screen.getByTestId('picker'))).toMatchObject({
        flexDirection: 'column',
        gap: spacing.sm,
      })
    })
  })

  describe('what an item draws', () => {
    it('draws a swatch of its colour, rounded as the swatch is', async () => {
      await render(<Picker />)

      expect(paintOf(NAMES[PURPLE])).toBe('rgba(103, 80, 164, 1)')
      expect(paintOf(NAMES[PINK])).toBe('rgba(125, 82, 96, 1)')
      expect(styleOf(radio(NAMES[PURPLE]))).toMatchObject({
        borderRadius: radii.xs,
      })
    })

    it('hands its colour to a swatch drawn in it with none of its own', async () => {
      await render(
        <Picker>
          <ColorSwatchPicker.Item color={GREY}>
            <ColorSwatch style={CALL_SITE} />
          </ColorSwatchPicker.Item>
          <ColorSwatchPicker.Item aria-label="Second item" color={PINK}>
            <ColorSwatch color={PURPLE} />
          </ColorSwatchPicker.Item>
        </Picker>,
      )

      expect(paintOf(NAMES[GREY])).toBe('rgba(98, 91, 113, 1)')
      expect(paintOf('Second item')).toBe('rgba(103, 80, 164, 1)')
    })

    it('draws what it is given instead', async () => {
      await render(
        <Picker>
          <ColorSwatchPicker.Item color={GREY}>
            <Text>Label</Text>
          </ColorSwatchPicker.Item>
        </Picker>,
      )

      expect(
        screen.getByText('Label', { includeHiddenElements: true }),
      ).toBeTruthy()
      expect(paintOf(NAMES[GREY])).toBeUndefined()
    })

    it('is drawn inside a picker, and says so otherwise', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(
        render(<ColorSwatchPicker.Item color={PURPLE} />),
      ).rejects.toThrow(
        'A ColorSwatchPicker.Item is drawn inside a ColorSwatchPicker',
      )

      jest.restoreAllMocks()
    })
  })

  describe('the call site', () => {
    it("lands the picker's style, ref and testID on the set", async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(<Picker ref={ref} style={CALL_SITE} testID="picker" />)

      expect(styleOf(screen.getByTestId('picker'))).toMatchObject(CALL_SITE)
      expect(ref.current).not.toBeNull()
    })

    it("lands an item's style, ref and testID on the item, and brings it up to a 48dp target", async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        <Picker>
          <ColorSwatchPicker.Item
            color={PURPLE}
            ref={ref}
            style={CALL_SITE}
            testID="item"
          />
        </Picker>,
      )

      expect(screen.getByTestId('item')).toBe(radio(NAMES[PURPLE]))
      expect(styleOf(radio(NAMES[PURPLE]))).toMatchObject(CALL_SITE)
      expect(radio(NAMES[PURPLE]).props.hitSlop).toStrictEqual({
        bottom: 4,
        left: 4,
        right: 4,
        top: 4,
      })
      expect(ref.current).not.toBeNull()
    })
  })
})
