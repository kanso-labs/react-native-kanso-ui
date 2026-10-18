import type { ComponentRef, ReactNode } from 'react'
import type {
  HostInstance,
  MeasureInWindowOnSuccessCallback,
  StyleProp,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { Color } from 'react-stately'
import type { TestInstance } from 'test-renderer'

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
import { AccessibilityInfo, Dimensions, StyleSheet, View } from 'react-native'
import { parseColor } from 'react-stately'

import type { ColorPickerProps } from '.'

import { ColorPicker } from '.'
import { I18nProvider } from '../../i18n/provider'
import { ThemeScope } from '../../theme-scope'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'
import { ColorArea } from '../color-area'
import { ColorField } from '../color-field'
import { ColorSlider } from '../color-slider'
import { ColorSwatch } from '../color-swatch'
import { ColorSwatchPicker } from '../color-swatch-picker'
import { ColorWheel } from '../color-wheel'

type Frame = readonly [x: number, y: number, width: number, height: number]

// What React Native's Jest preset draws a View as: a class component holding
// its props, with the native methods on its prototype.
type MockedView = Pick<HostInstance, 'measureInWindow'> & {
  readonly props: ViewProps
}

const { theme } = scopeFor('light', {})
const { colors, motion, radii, spacing, stateLayerOpacity, typography } = theme

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

// A phone held upright, below the medium bound, and a tablet, above it.
const COMPACT = 412
const MEDIUM = 800

// Where `measureInWindow` reports the trigger and the overlay layer, the two
// views a docked surface is placed by, in a window 800 wide and tall.
const BOX: Frame = [20, 100, 160, 40]
const LAYER: Frame = [0, 0, MEDIUM, MEDIUM]

const CALL_SITE = { marginTop: 4 }
// What a press hands a pressable's own handler, which the swatch picker's
// items read.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}
const PURPLE = '#6750A4'
const RED = '#FF0000'

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// Asks a slider for an action, as a screen reader does.
async function ask(name: string, actionName: string) {
  await fireEvent(screen.getByRole('slider', { name }), 'accessibilityAction', {
    nativeEvent: { actionName },
  })
}

// What the surface holds when the picker arranges it, found from the field
// it ends on.
function body() {
  const found = field().parent
  let node: null | TestInstance = found

  while (node !== null && styleOf(node).width !== 280) {
    node = node.parent
  }
  if (node === null) {
    throw new TypeError('expected the column the surface stacks')
  }
  return node
}

function changes() {
  return jest.fn<(value: Color) => void>()
}

function child(node: TestInstance['children'][number] | undefined) {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

// The field on the surface, which is named by the picker's label, as the
// surface is.
function field() {
  const fields = screen
    .getAllByLabelText('Label')
    .filter((each) => each.props.onChangeText !== undefined)
  const found = fields.at(0)

  if (found === undefined || fields.length > 1) {
    throw new TypeError('expected one field named Label')
  }
  return found
}

// The colour a swatch is filled with, which its first view draws.
function fillOf(swatch: TestInstance) {
  return styleOf(child(swatch.children[0])).backgroundColor
}

// Every colour the views inside a node are filled with, the node's own first.
function fillsIn(node: TestInstance): unknown[] {
  const fill = styleOf(node).backgroundColor

  return [
    ...(fill === undefined ? [] : [fill]),
    ...node.children.flatMap((part) =>
      typeof part === 'string' ? [] : fillsIn(part),
    ),
  ]
}

function hexOf(color: Color | undefined) {
  return color?.toString('hex')
}

function isMockedView(value: unknown): value is MockedView {
  return (
    typeof value === 'object' && value !== null && 'measureInWindow' in value
  )
}

// Reports the docked surface's size, which is what places it.
async function laidOut() {
  await fireEvent(surface(), 'layout', {
    nativeEvent: { layout: { height: 400, width: 280, x: 0, y: 0 } },
  })
}

// The layer a press outside the docked surface lands on, drawn just before
// it.
function layer() {
  const siblings = surface().parent?.children ?? []

  return child(siblings.at(siblings.indexOf(surface()) - 1))
}

// The `Modal` the modal surface is drawn in.
function modal() {
  let node: null | TestInstance = surface()

  while (node !== null && !('onRequestClose' in node.props)) {
    node = node.parent
  }
  if (node === null) {
    throw new TypeError('expected the Modal around the surface')
  }
  return node
}

// What a colour is called in English, which the trigger says after its label.
function nameOf(color: string) {
  return parseColor(color).getColorName('en-US')
}

// A handler writing each colour it is handed into `calls`, under whose
// handler it is.
function recordInto(calls: string[], whose: string) {
  return (color: Color) => {
    calls.push(`${whose} ${String(hexOf(color))}`)
  }
}

// Renders a picker inside a theme, whose host the docked surface draws in.
async function renderPicker(
  props: Partial<ColorPickerProps> = {},
  wrap?: (children: ReactNode) => ReactNode,
) {
  const picker = (
    <ColorPicker
      defaultValue={PURPLE}
      label="Label"
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

function sliderNames() {
  return screen
    .queryAllByRole('slider')
    .map((slider) => slider.props['aria-label'] as unknown)
}

// The trigger's state layer, which its press feedback draws first.
function stateLayer() {
  return child(child(trigger().children.at(0)).children.at(0))
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle & ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

// The surface the controls are drawn on, which closes on VoiceOver's escape
// gesture.
function surface() {
  let node: null | TestInstance = screen.getByTestId('inside', {
    includeHiddenElements: true,
  })

  while (node !== null && !('onAccessibilityEscape' in node.props)) {
    node = node.parent
  }
  if (node === null) {
    throw new TypeError('expected the surface around the controls')
  }
  return node
}

function trigger(name = `Label, ${nameOf(PURPLE)}`) {
  return screen.getByRole('button', { name })
}

beforeEach(() => {
  jest.useFakeTimers()
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
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('ColorPicker', () => {
  describe('the trigger', () => {
    it('is a button named by its label and then its colour, a swatch beside the label on a pill', async () => {
      await renderPicker()

      expect(nameOf(PURPLE)).not.toBe('')
      expect(trigger()).toBeEnabled()
      expect(styleOf(trigger())).toMatchObject({
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: colors.surfaceContainerLow,
        borderRadius: radii.pill,
        boxSizing: 'border-box',
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      })
      expect(
        styleOf(screen.getByRole('img', { name: nameOf(PURPLE) })),
      ).toMatchObject({ height: 24, width: 24 })
      expect(fillOf(screen.getByRole('img', { name: nameOf(PURPLE) }))).toBe(
        parseColor(PURPLE).toString('css'),
      )
      expect(styleOf(screen.getByText('Label'))).toMatchObject({
        color: colors.onSurface,
        fontSize: typography.labelLargeSize,
        fontWeight: typography.labelLargeWeight,
      })
    })

    it('gives its hit area room to reach 48dp around the 24dp swatch', async () => {
      await renderPicker()

      expect(trigger().props.hitSlop).toEqual({
        bottom: (48 - (24 + 2 * spacing.sm)) / 2,
        left: 0,
        right: 0,
        top: (48 - (24 + 2 * spacing.sm)) / 2,
      })
    })

    it('shows the colour the picker holds, and follows it', async () => {
      const view = await renderPicker({
        defaultValue: undefined,
        value: PURPLE,
      })

      expect(trigger()).toBeOnTheScreen()

      await view.rerender(
        <ThemeScope>
          <ColorPicker label="Label" testID="picker" value={RED} />
        </ThemeScope>,
      )

      expect(trigger(`Label, ${nameOf(RED)}`)).toBeOnTheScreen()
      expect(screen.getByRole('img', { name: nameOf(RED) })).toBeOnTheScreen()
    })

    it('calls a colour with no alpha left transparent', async () => {
      await renderPicker({ defaultValue: 'rgba(103, 80, 164, 0)' })

      expect(trigger('Label, transparent')).toBeOnTheScreen()
    })

    it('keeps the surface closed until it is pressed, and says whether it is open', async () => {
      await renderPicker()

      expect(trigger()).toBeCollapsed()
      expect(sliderNames()).toEqual([])

      await fireEvent.press(trigger())

      expect(trigger()).toBeExpanded()
      expect(sliderNames()).toHaveLength(3)
    })

    it('opens nothing while disabled, and draws the disabled container and label', async () => {
      await renderPicker({ isDisabled: true })

      await fireEvent.press(trigger())

      expect(trigger()).toBeDisabled()
      expect(sliderNames()).toEqual([])
      expect(styleOf(trigger()).backgroundColor).toBe(
        withOpacity(colors.onSurface, stateLayerOpacity.disabledContainer),
      )
      expect(styleOf(screen.getByText('Label')).color).toBe(
        withOpacity(colors.onSurface, stateLayerOpacity.disabledContent),
      )
    })

    it('draws its state layer in on surface under a pointer, and drops it once disabled', async () => {
      const { rerender } = await renderPicker()

      await fireEvent(trigger(), 'hoverIn', {})

      expect(styleOf(stateLayer())).toMatchObject({
        backgroundColor: colors.onSurface,
        opacity: stateLayerOpacity.hover,
      })

      await rerender(
        <ThemeScope>
          <ColorPicker
            defaultValue={PURPLE}
            isDisabled
            label="Label"
            testID="picker"
          />
        </ThemeScope>,
      )

      expect(styleOf(stateLayer()).opacity).toBe(0)
    })

    it('disables what it opens, not only the trigger', async () => {
      await renderPicker({ alpha: true, defaultOpen: true, isDisabled: true })

      for (const slider of screen.getAllByRole('slider')) {
        expect(slider).toBeDisabled()
      }
      expect(screen.getAllByRole('slider')).toHaveLength(4)
      expect(field().props.editable).toBe(false)
    })

    it('enables what it opens while enabled', async () => {
      await renderPicker({ alpha: true, defaultOpen: true })

      for (const slider of screen.getAllByRole('slider')) {
        expect(slider).toBeEnabled()
      }
      expect(field().props.editable).toBe(true)
    })

    it('puts the style, the ref and the test id on the trigger', async () => {
      const ref = createRef<ComponentRef<typeof View>>()

      await renderPicker({ ref, style: CALL_SITE })

      expect(screen.getByTestId('picker')).toBe(trigger())
      expect(styleOf(trigger())).toMatchObject({
        ...CALL_SITE,
        backgroundColor: colors.surfaceContainerLow,
      })
      expect(isMockedView(ref.current) && ref.current.props.testID).toBe(
        'picker',
      )
    })
  })

  describe('what it opens', () => {
    it('composes the plane, the hue strip and the field, named by its label', async () => {
      await renderPicker({ defaultOpen: true })

      expect(sliderNames()).toEqual([
        'Label, Saturation',
        'Label, Lightness',
        'Hue',
      ])
      expect(field().props.value).toBe(PURPLE)
    })

    it('adds the alpha strip under the hue one only when asked', async () => {
      await renderPicker({ alpha: true, defaultOpen: true })

      expect(sliderNames()).toEqual([
        'Label, Saturation',
        'Label, Lightness',
        'Hue',
        'Alpha',
      ])
    })

    it('names the strips and the colour in the locale it is given', async () => {
      await renderPicker({ alpha: true, defaultOpen: true }, (children) => (
        <I18nProvider locale="pt-BR">{children}</I18nProvider>
      ))

      expect(sliderNames()).toEqual([
        'Label, Saturação',
        'Label, Luminosidade',
        'Matiz',
        'Alfa',
      ])
      expect(
        trigger(`Label, ${parseColor(PURPLE).getColorName('pt-BR')}`),
      ).toBeOnTheScreen()
    })

    it('stacks them in a 280dp column inside the large spacing step', async () => {
      await renderPicker({ defaultOpen: true })

      expect(styleOf(body())).toEqual({
        boxSizing: 'border-box',
        gap: spacing.md,
        maxWidth: '100%',
        padding: spacing.lg,
        width: 280,
      })
    })

    it('takes the arrangement a call site gives it instead', async () => {
      await renderPicker({
        children: <ColorSwatch testID="inside" />,
        defaultOpen: true,
      })

      expect(sliderNames()).toEqual([])
      expect(screen.queryByDisplayValue(PURPLE)).not.toBeOnTheScreen()
      expect(fillOf(screen.getByTestId('inside'))).toBe(
        parseColor(PURPLE).toString('css'),
      )
    })
  })

  describe('docked, from the medium window size up', () => {
    it('opens under the trigger as a dialog named by its label', async () => {
      await renderPicker({ children: <View testID="inside" /> })

      await fireEvent.press(trigger())
      await laidOut()

      expect(surface().props).toMatchObject({
        'aria-label': 'Label',
        role: 'dialog',
      })
      expect(styleOf(surface())).toMatchObject({
        left: BOX[0],
        top: BOX[1] + BOX[3] + spacing.sm,
      })
    })

    it('closes on a press outside it, saying so on the trigger', async () => {
      const onOpenChange = jest.fn<(isOpen: boolean) => void>()

      await renderPicker({ children: <View testID="inside" />, onOpenChange })
      await fireEvent.press(trigger())
      await laidOut()
      await fireEvent.press(layer())

      expect(trigger()).toBeCollapsed()
      expect(onOpenChange.mock.calls).toEqual([[true], [false]])

      await advance(motion.durationShort2)

      expect(
        screen.queryByTestId('inside', { includeHiddenElements: true }),
      ).not.toBeOnTheScreen()
    })

    it('sends a screen reader back to the trigger once it has gone', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      const ref = createRef<ComponentRef<typeof View>>()

      await renderPicker({ children: <View testID="inside" />, ref })
      await fireEvent.press(trigger())
      await laidOut()
      await fireEvent.press(layer())
      await advance(motion.durationShort2)

      expect(ref.current).not.toBe(null)
      expect(send).toHaveBeenLastCalledWith(ref.current, 'focus')
    })
  })

  describe('modal, below the medium window size', () => {
    beforeEach(() => {
      resize(COMPACT)
    })

    it('opens in a Modal as a modal dialog named by its label', async () => {
      await renderPicker({ children: <View testID="inside" /> })
      await fireEvent.press(trigger())

      expect(modal().props.visible).toBe(true)
      expect(surface().props).toMatchObject({
        'aria-label': 'Label',
        'aria-modal': true,
        role: 'dialog',
      })
    })

    it('closes on the back gesture', async () => {
      await renderPicker({ children: <View testID="inside" /> })
      await fireEvent.press(trigger())
      await fireEvent(modal(), 'requestClose')

      expect(trigger()).toBeCollapsed()
    })
  })

  describe('opening it from outside', () => {
    it('starts open when asked', async () => {
      await renderPicker({ defaultOpen: true })

      expect(trigger()).toBeExpanded()
      expect(sliderNames()).toHaveLength(3)
    })

    it('stays as a call site holding it says, and reports a press', async () => {
      const onOpenChange = jest.fn<(isOpen: boolean) => void>()

      await renderPicker({ isOpen: false, onOpenChange })
      await fireEvent.press(trigger())

      expect(onOpenChange).toHaveBeenCalledWith(true)
      expect(trigger()).toBeCollapsed()
      expect(sliderNames()).toEqual([])
    })
  })

  describe('the value', () => {
    it('takes a hex, which its own plane and hue strip would refuse, and reads them in HSL', async () => {
      await renderPicker({ defaultOpen: true })

      expect(screen.getByRole('slider', { name: 'Hue' }).props).toMatchObject({
        'aria-valuenow': 256,
      })
      expect(
        screen.getByRole('slider', { name: 'Label, Lightness' }).props,
      ).toMatchObject({ 'aria-valuenow': 47.84 })
    })

    it('starts black when it is given no colour', async () => {
      await renderPicker({ defaultOpen: true, defaultValue: undefined })

      expect(field().props.value).toBe('#000000')
    })

    it('reports a colour changed on the hue strip in HSL, and the trigger and field follow', async () => {
      const onChange = changes()

      await renderPicker({ defaultOpen: true, onChange })
      await ask('Hue', 'increment')

      const changed = onChange.mock.calls.at(-1)?.[0]

      expect(changed?.getColorSpace()).toBe('hsl')
      expect(changed?.getChannelValue('hue')).toBe(257)
      expect(field().props.value).toBe(hexOf(changed))
      expect(
        trigger(`Label, ${changed?.getColorName('en-US') ?? ''}`),
      ).toBeOnTheScreen()
    })

    it('reports a colour moved on the plane', async () => {
      const onChange = changes()

      await renderPicker({ defaultOpen: true, onChange })
      await ask('Label, Saturation', 'increment')

      expect(
        onChange.mock.calls.at(-1)?.[0]?.getChannelValue('saturation'),
      ).toBe(35)
    })

    it('takes a hex typed in the field', async () => {
      const onChange = changes()

      await renderPicker({ defaultOpen: true, onChange })
      await fireEvent.changeText(field(), RED)
      await fireEvent(field(), 'blur', {})

      expect(hexOf(onChange.mock.calls.at(-1)?.[0])).toBe(RED)
      expect(trigger(`Label, ${nameOf(RED)}`)).toBeOnTheScreen()
    })

    it('keeps its colour when the field is emptied, and shows it there again', async () => {
      const onChange = changes()

      await renderPicker({ defaultOpen: true, onChange })
      await fireEvent.changeText(field(), '')
      await fireEvent(field(), 'blur', {})

      expect(onChange).not.toHaveBeenCalled()
      expect(field().props.value).toBe(PURPLE)
      expect(trigger()).toBeOnTheScreen()
    })

    it('holds the colour a call site gives it, reporting a change rather than making it', async () => {
      const onChange = changes()

      await renderPicker({
        defaultOpen: true,
        defaultValue: undefined,
        onChange,
        value: PURPLE,
      })
      await ask('Hue', 'increment')

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(field().props.value).toBe(PURPLE)
    })
  })

  describe('a control inside it', () => {
    it('takes the picker’s colour where it is given none', async () => {
      await renderPicker({
        children: <ColorSwatch testID="inside" />,
        defaultOpen: true,
      })

      expect(fillOf(screen.getByTestId('inside'))).toBe(
        parseColor(PURPLE).toString('css'),
      )
    })

    it('keeps a colour of its own, and reports its changes to the picker and then to itself', async () => {
      const calls: string[] = []

      await renderPicker({
        children: (
          <View testID="inside">
            <ColorSlider
              channel="hue"
              colorSpace="hsl"
              label="Label"
              onChange={recordInto(calls, 'own')}
              value={RED}
            />
          </View>
        ),
        defaultOpen: true,
        onChange: recordInto(calls, 'picker'),
      })

      expect(screen.getByRole('slider', { name: 'Label' }).props).toMatchObject(
        { 'aria-valuenow': 0 },
      )

      await ask('Label', 'increment')

      const moved = hexOf(parseColor('hsl(1, 100%, 50%)'))

      expect(calls).toEqual([`picker ${String(moved)}`, `own ${String(moved)}`])
      expect(trigger(`Label, ${nameOf('hsl(1, 100%, 50%)')}`)).toBeOnTheScreen()
    })

    it('moves the picker’s colour from a wheel', async () => {
      const onChange = changes()

      await renderPicker({
        children: (
          <View testID="inside">
            <ColorWheel />
          </View>
        ),
        defaultOpen: true,
        onChange,
      })

      expect(screen.getByRole('slider', { name: 'Hue' }).props).toMatchObject({
        'aria-valuenow': 256.43,
      })

      await ask('Hue', 'increment')

      expect(onChange.mock.calls.at(-1)?.[0]?.getChannelValue('hue')).toBe(257)
    })

    it('moves the picker’s colour from a plane read in its own space', async () => {
      const onChange = changes()

      await renderPicker({
        children: (
          <View testID="inside">
            <ColorArea colorSpace="hsl" xChannel="hue" yChannel="saturation" />
          </View>
        ),
        defaultOpen: true,
        onChange,
      })

      expect(screen.getByRole('slider', { name: 'Hue' }).props).toMatchObject({
        'aria-valuenow': 256.43,
      })

      await ask('Hue', 'increment')

      expect(onChange.mock.calls.at(-1)?.[0]?.getChannelValue('hue')).toBe(257)
    })

    it('sets the picker’s colour from a swatch picker, which shows it chosen', async () => {
      const onChange = changes()

      await renderPicker({
        children: (
          <View testID="inside">
            <ColorSwatchPicker>
              <ColorSwatchPicker.Item color={PURPLE} />
              <ColorSwatchPicker.Item color={RED} />
            </ColorSwatchPicker>
          </View>
        ),
        defaultOpen: true,
        onChange,
      })

      expect(screen.getByRole('radio', { name: nameOf(PURPLE) })).toBeChecked()
      // Each item draws its own colour rather than the picker's.
      expect(
        fillsIn(screen.getByRole('radio', { name: nameOf(RED) })),
      ).toContain(parseColor(RED).toString('css'))

      // The surface takes no touches until it has been placed.
      await laidOut()
      await fireEvent.press(
        screen.getByRole('radio', { name: nameOf(RED) }),
        PRESS,
      )

      expect(hexOf(onChange.mock.calls.at(-1)?.[0])).toBe(RED)
      expect(screen.getByRole('radio', { name: nameOf(RED) })).toBeChecked()
    })

    it('shows and sets one channel of the picker’s colour from a channel field', async () => {
      const onChange = changes()

      await renderPicker({
        children: (
          <View testID="inside">
            <ColorField channel="red" label="Label" />
          </View>
        ),
        defaultOpen: true,
        onChange,
      })

      expect(field().props.value).toBe('103')

      await fireEvent.changeText(field(), '255')
      await fireEvent(field(), 'blur', {})

      expect(hexOf(onChange.mock.calls.at(-1)?.[0])).toBe('#FF50A4')
    })

    it('keeps a field emptied on purpose empty', async () => {
      await renderPicker({
        children: (
          <View testID="inside">
            <ColorField label="Label" value={null} />
          </View>
        ),
        defaultOpen: true,
      })

      expect(field().props.value).toBe('')
    })

    it('reads its own value and handler alone outside a picker', async () => {
      const onChange = jest.fn<(value: Color | null) => void>()

      await render(
        <ThemeScope>
          <ColorField label="Label" onChange={onChange} value={RED} />
        </ThemeScope>,
      )
      await fireEvent.changeText(field(), PURPLE)
      await fireEvent(field(), 'blur', {})

      expect(hexOf(onChange.mock.calls.at(-1)?.[0] ?? undefined)).toBe(PURPLE)
      expect(field().props.value).toBe(RED)
    })
  })
})
