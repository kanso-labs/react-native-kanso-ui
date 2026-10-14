import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle } from 'react-native'
import type { TestNode } from 'test-renderer'

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

import { Radio, RadioGroup } from '.'
import { ThemeScope } from '../../theme-scope'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

// What the next radio button the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

const { theme } = scopeFor('light', {})
const { colors, motion, radii, spacing, stateLayerOpacity, typography } = theme

const DISABLED = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContent,
)

// The state layer's colour over each kind of button, hovered and pressed,
// from the page: the two swap once pressed.
const LAYERS = [
  {
    hover: colors.onSurface,
    name: 'an unselected button',
    pressed: colors.primary,
    value: 'second',
  },
  {
    hover: colors.primary,
    name: 'a selected button',
    pressed: colors.onSurface,
    value: 'first',
  },
] as const

// A theme over one colour, and a style from outside.
const PRIMARY = { '--kui-color-primary': '#0b57d0' }
const OFFSET = { marginTop: 4 }

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

function button(name: string) {
  return screen.getByRole('radio', { name })
}

function child(element: null | TestNode | undefined) {
  if (
    element === null ||
    element === undefined ||
    typeof element === 'string'
  ) {
    throw new TypeError('expected a view')
  }
  return element
}

// The dot's colour while one is drawn.
function dotOf(name: string) {
  const dot = parts(name).dot
  return dot === undefined ? undefined : same(styleOf(dot).backgroundColor)
}

// The group, which is the element rendered. A container is never an
// accessibility element of its own, since iOS would then read it as one and
// hide its buttons, so it is not one Testing Library finds by role.
function group() {
  const root = screen.root
  if (root?.props.role !== 'radiogroup') {
    throw new TypeError('expected the group')
  }
  return root
}

function Options() {
  return (
    <>
      <Radio value="first">First item</Radio>
      <Radio value="second">Second item</Radio>
      <Radio value="third">Third item</Radio>
    </>
  )
}

// The 40dp disc, the press feedback's layer inside it, the ring over that,
// and the dot inside the ring while the button is selected.
function parts(name: string) {
  const disc = child(button(name).children.at(0))
  const surface = child(disc.children.at(0))
  const ring = child(disc.children.at(1))
  const dot = ring.children.at(0)
  return {
    disc,
    dot: dot === undefined ? undefined : child(dot),
    layer: child(surface.children.at(0)),
    ring,
    surface,
  }
}

// The ring's colour once its ease has run.
async function ringOf(name: string) {
  await advance(motion.durationShort2)
  return same(getAnimatedStyle(parts(name).ring).borderColor)
}

// One spelling of a colour, since Reanimated writes the colours it eases
// through as `rgba()` whatever they were given as.
function same(color: unknown) {
  if (typeof color !== 'string') {
    throw new TypeError('expected a colour')
  }
  return withOpacity(color, 1)
}

function styleOf(element: { props: { style?: StyleProp<TextStyle> } }) {
  return StyleSheet.flatten([element.props.style])
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  mockReducedMotion = false
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('RadioGroup', () => {
  describe('semantics', () => {
    it('is announced as a radio group named by its label', async () => {
      await render(
        <RadioGroup label="Label">
          <Options />
        </RadioGroup>,
      )

      const label = screen.getByText('Label')
      expect(group().props.role).toBe('radiogroup')
      expect(typeof label.props.id).toBe('string')
      expect(group().props['aria-labelledby']).toBe(label.props.id)
    })

    it('announces each button as a radio named by its label', async () => {
      await render(
        <RadioGroup defaultValue="second" label="Label">
          <Options />
        </RadioGroup>,
      )

      expect(screen.getAllByRole('radio')).toHaveLength(3)
      expect(button('First item')).not.toBeChecked()
      expect(button('Second item')).toBeChecked()
      expect(button('Third item')).not.toBeChecked()
    })

    it('names a button by aria-label without a label of its own', async () => {
      await render(
        <RadioGroup label="Label">
          <Radio aria-label="First item" value="first" />
        </RadioGroup>,
      )

      expect(button('First item')).toBeTruthy()
      // The disc alone, with no empty text beside it to take a gap.
      expect(button('First item').children).toHaveLength(1)
    })

    it('reads a button’s description as its hint, and hides the line itself', async () => {
      await render(
        <RadioGroup label="Label">
          <Radio description="Supporting line" value="first">
            First item
          </Radio>
        </RadioGroup>,
      )

      expect(button('First item').props.accessibilityHint).toBe(
        'Supporting line',
      )
      expect(screen.queryByText('Supporting line')).toBeNull()
    })

    it('leaves the group’s own line where a screen reader reaches it on iOS and Android', async () => {
      await render(
        <RadioGroup description="Supporting line" label="Label">
          <Options />
        </RadioGroup>,
      )

      expect(screen.getByText('Supporting line')).toBeTruthy()
      expect(group().props).not.toHaveProperty('aria-describedby')
      expect(group().props).not.toHaveProperty('accessibilityHint')
    })

    it('points the group at its line on the web', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await render(
        <RadioGroup description="Supporting line" label="Label">
          <Options />
        </RadioGroup>,
      )

      const line = screen.getByText('Supporting line')
      expect(typeof line.props.id).toBe('string')
      expect(group().props['aria-describedby']).toBe(line.props.id)
    })

    it('names no line on the web when there is none', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await render(
        <RadioGroup label="Label">
          <Options />
        </RadioGroup>,
      )

      expect(group().props).not.toHaveProperty('aria-describedby')
    })

    it('points a button at its own line on the web', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await render(
        <RadioGroup label="Label">
          <Radio description="Supporting line" value="first">
            First item
          </Radio>
        </RadioGroup>,
      )

      expect(button('First item').props['aria-describedby']).toBe(
        screen.getByText('Supporting line').props.id,
      )
    })

    it('replaces the description with the error rather than stacking them', async () => {
      await render(
        <RadioGroup
          description="Supporting line"
          error="Choose one."
          label="Label"
        >
          <Options />
        </RadioGroup>,
      )

      expect(screen.getByText('Choose one.')).toBeTruthy()
      expect(screen.queryByText('Supporting line')).toBeNull()
    })

    it('throws outside a group, which is what holds the selection', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(
        render(<Radio value="first">First item</Radio>),
      ).rejects.toThrow('A Radio is drawn inside a RadioGroup')
    })
  })

  describe('selection', () => {
    it('checks the pressed button and unchecks the others, and reports its value', async () => {
      const onChange = jest.fn()
      await render(
        <RadioGroup defaultValue="first" label="Label" onChange={onChange}>
          <Options />
        </RadioGroup>,
      )

      await fireEvent.press(button('Third item'))

      expect(button('First item')).not.toBeChecked()
      expect(button('Third item')).toBeChecked()
      expect(onChange).toHaveBeenCalledWith('third')
    })

    it('takes a press on a button’s label as one on the button', async () => {
      const onChange = jest.fn()
      await render(
        <RadioGroup label="Label" onChange={onChange}>
          <Options />
        </RadioGroup>,
      )

      await fireEvent.press(screen.getByText('Second item'))

      expect(button('Second item')).toBeChecked()
      expect(onChange).toHaveBeenCalledWith('second')
    })

    it('starts with nothing selected when told nothing', async () => {
      await render(
        <RadioGroup label="Label">
          <Options />
        </RadioGroup>,
      )

      expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0)
    })

    it('reports without moving when controlled', async () => {
      const onChange = jest.fn()
      await render(
        <RadioGroup label="Label" onChange={onChange} value="first">
          <Options />
        </RadioGroup>,
      )

      await fireEvent.press(button('Second item'))

      expect(onChange).toHaveBeenCalledWith('second')
      expect(button('First item')).toBeChecked()
      expect(button('Second item')).not.toBeChecked()
    })

    it('takes no press on a disabled button, and announces it disabled', async () => {
      const onChange = jest.fn()
      await render(
        <RadioGroup defaultValue="first" label="Label" onChange={onChange}>
          <Radio value="first">First item</Radio>
          <Radio isDisabled value="second">
            Second item
          </Radio>
        </RadioGroup>,
      )

      await fireEvent.press(button('Second item'))

      expect(button('First item')).toBeEnabled()
      expect(button('Second item')).toBeDisabled()
      expect(button('First item')).toBeChecked()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('disables every button from the group', async () => {
      const onChange = jest.fn()
      await render(
        <RadioGroup isDisabled label="Label" onChange={onChange}>
          <Options />
        </RadioGroup>,
      )

      await fireEvent.press(button('Second item'))

      for (const radio of screen.getAllByRole('radio')) {
        expect(radio).toBeDisabled()
      }
      expect(onChange).not.toHaveBeenCalled()
    })

    it('takes no press while read-only, without being announced disabled', async () => {
      const onChange = jest.fn()
      await render(
        <RadioGroup
          defaultValue="first"
          isReadOnly
          label="Label"
          onChange={onChange}
        >
          <Options />
        </RadioGroup>,
      )

      await fireEvent.press(button('Second item'))

      expect(button('Second item')).toBeEnabled()
      expect(button('First item')).toBeChecked()
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('appearance', () => {
    it('draws an unselected ring in on surface variant, with no dot', async () => {
      await render(
        <RadioGroup defaultValue="first" label="Label">
          <Options />
        </RadioGroup>,
      )

      expect(await ringOf('Second item')).toBe(same(colors.onSurfaceVariant))
      expect(parts('Second item').dot).toBeUndefined()
    })

    it('draws a selected ring and its dot in primary', async () => {
      await render(
        <RadioGroup defaultValue="first" label="Label">
          <Options />
        </RadioGroup>,
      )

      expect(await ringOf('First item')).toBe(same(colors.primary))
      expect(dotOf('First item')).toBe(same(colors.primary))
    })

    it('eases the ring over the short duration, with the dot there at once', async () => {
      await render(
        <RadioGroup label="Label">
          <Options />
        </RadioGroup>,
      )
      await advance(motion.durationShort2)

      await fireEvent.press(button('First item'))
      await advance(motion.durationShort2 / 2)

      const halfway = same(
        getAnimatedStyle(parts('First item').ring).borderColor,
      )
      expect(halfway).not.toBe(same(colors.primary))
      expect(halfway).not.toBe(same(colors.onSurfaceVariant))
      expect(dotOf('First item')).toBe(same(colors.primary))

      await advance(motion.durationShort2 / 2)

      expect(same(getAnimatedStyle(parts('First item').ring).borderColor)).toBe(
        same(colors.primary),
      )
    })

    it('moves at once for a reader who asks for reduced motion', async () => {
      mockReducedMotion = true
      await render(
        <RadioGroup label="Label">
          <Options />
        </RadioGroup>,
      )

      await fireEvent.press(button('First item'))
      await advance(0)

      expect(same(getAnimatedStyle(parts('First item').ring).borderColor)).toBe(
        same(colors.primary),
      )
    })

    it('turns an unselected ring on surface while hovered, pressed or focused', async () => {
      await render(
        <RadioGroup defaultValue="first" label="Label">
          <Options />
        </RadioGroup>,
      )
      const second = button('Second item')

      await fireEvent(second, 'hoverIn', {})
      expect(await ringOf('Second item')).toBe(same(colors.onSurface))

      await fireEvent(second, 'hoverOut', {})
      expect(await ringOf('Second item')).toBe(same(colors.onSurfaceVariant))

      await fireEvent(second, 'pressIn', { nativeEvent: {} })
      expect(await ringOf('Second item')).toBe(same(colors.onSurface))
      await fireEvent(second, 'pressOut', {})

      await fireEvent(second, 'blur', {})
      await fireEvent(second, 'focus', {})
      expect(await ringOf('Second item')).toBe(same(colors.onSurface))
    })

    it('keeps a selected ring primary under a pointer', async () => {
      await render(
        <RadioGroup defaultValue="first" label="Label">
          <Options />
        </RadioGroup>,
      )

      await fireEvent(button('First item'), 'hoverIn', {})

      expect(await ringOf('First item')).toBe(same(colors.primary))
    })

    it('keeps the ring at rest under a pointer while read-only', async () => {
      await render(
        <RadioGroup isReadOnly label="Label">
          <Options />
        </RadioGroup>,
      )

      await fireEvent(button('First item'), 'hoverIn', {})

      expect(await ringOf('First item')).toBe(same(colors.onSurfaceVariant))
    })

    it('dims the ring, the dot and the label of a disabled button', async () => {
      await render(
        <RadioGroup defaultValue="second" label="Label">
          <Radio isDisabled value="first">
            First item
          </Radio>
          <Radio isDisabled value="second">
            Second item
          </Radio>
        </RadioGroup>,
      )

      expect(await ringOf('First item')).toBe(same(DISABLED))
      expect(styleOf(screen.getByText('First item')).color).toBe(DISABLED)
      expect(await ringOf('Second item')).toBe(same(DISABLED))
      expect(dotOf('Second item')).toBe(same(DISABLED))
    })

    it('keeps its buttons’ colours while the group has an error', async () => {
      await render(
        <RadioGroup defaultValue="first" error="Choose one." label="Label">
          <Options />
        </RadioGroup>,
      )

      expect(await ringOf('First item')).toBe(same(colors.primary))
      expect(await ringOf('Second item')).toBe(same(colors.onSurfaceVariant))
    })

    it('sets the group’s label in label large, on surface variant', async () => {
      await render(
        <RadioGroup label="Label">
          <Options />
        </RadioGroup>,
      )

      expect(styleOf(screen.getByText('Label'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.labelLargeSize,
        lineHeight: typography.labelLargeLineHeight,
      })
    })

    it('turns the label and the line error while the group has an error', async () => {
      await render(
        <RadioGroup error="Choose one." label="Label">
          <Options />
        </RadioGroup>,
      )

      expect(styleOf(screen.getByText('Label')).color).toBe(colors.error)
      expect(styleOf(screen.getByText('Choose one.'))).toMatchObject({
        color: colors.error,
        fontSize: typography.bodySmallSize,
        lineHeight: typography.bodySmallLineHeight,
      })
    })

    it('sets the line in body small, on surface variant', async () => {
      await render(
        <RadioGroup description="Supporting line" label="Label">
          <Options />
        </RadioGroup>,
      )

      expect(styleOf(screen.getByText('Supporting line')).color).toBe(
        colors.onSurfaceVariant,
      )
    })

    it('dims the group’s label while the group is disabled, and an error over it wins', async () => {
      await render(
        <RadioGroup isDisabled label="Label">
          <Options />
        </RadioGroup>,
      )

      expect(styleOf(screen.getByText('Label')).color).toBe(DISABLED)
      expect(await ringOf('First item')).toBe(same(DISABLED))

      await screen.rerender(
        <RadioGroup error="Choose one." isDisabled label="Label">
          <Options />
        </RadioGroup>,
      )

      expect(styleOf(screen.getByText('Label')).color).toBe(colors.error)
    })

    it('reads its colours from the theme around it', async () => {
      await render(
        <ThemeScope theme={PRIMARY}>
          <RadioGroup defaultValue="first" label="Label">
            <Options />
          </RadioGroup>
        </ThemeScope>,
      )

      expect(await ringOf('First item')).toBe(same('#0b57d0'))
    })
  })

  describe('the state layer', () => {
    it.each(LAYERS)(
      'is drawn over $name in its own colour, swapped once pressed',
      async ({ hover, pressed, value }) => {
        await render(
          <RadioGroup defaultValue="first" label="Label">
            <Radio value={value}>Option</Radio>
          </RadioGroup>,
        )

        await fireEvent(button('Option'), 'hoverIn', {})
        expect(styleOf(parts('Option').layer)).toMatchObject({
          backgroundColor: hover,
          opacity: stateLayerOpacity.hover,
        })

        await fireEvent(button('Option'), 'pressIn', { nativeEvent: {} })
        expect(styleOf(parts('Option').layer)).toMatchObject({
          backgroundColor: pressed,
          opacity: stateLayerOpacity.pressed,
        })
      },
    )

    it.each([
      { name: 'disabled', props: { isDisabled: true } },
      { name: 'read-only', props: { isReadOnly: true } },
    ])('is not drawn while the group is $name', async ({ props }) => {
      await render(
        <RadioGroup label="Label" {...props}>
          <Options />
        </RadioGroup>,
      )

      await fireEvent(button('First item'), 'hoverIn', {})

      expect(styleOf(parts('First item').layer).opacity).toBe(0)
    })

    it('fills the disc, clipped to its circle', async () => {
      await render(
        <RadioGroup label="Label">
          <Options />
        </RadioGroup>,
      )

      expect(styleOf(parts('First item').surface)).toMatchObject({
        borderRadius: radii.circle,
        overflow: 'hidden',
      })
    })

    it('ripples from the middle of the disc wherever the row is pressed', async () => {
      await render(
        <RadioGroup label="Label">
          <Options />
        </RadioGroup>,
      )

      await fireEvent(button('Second item'), 'pressIn', {
        nativeEvent: { pageX: 300, pageY: 30 },
      })
      await advance(0)

      // A disc a fifth of the layer's side, centred in the layer.
      const size = 40 * 0.2
      const start = (40 - size) / 2
      const ripple = child(parts('Second item').surface.children.at(1))
      expect(getAnimatedStyle(ripple)).toMatchObject({
        backgroundColor: colors.primary,
        height: size,
        transform: [{ translateX: start }, { translateY: start }, { scale: 1 }],
      })
    })

    it('rings the disc for focus from a key', async () => {
      await render(
        <RadioGroup label="Label">
          <Options />
        </RadioGroup>,
      )

      await fireEvent(button('First item'), 'focus', {})

      expect(styleOf(parts('First item').disc)).toMatchObject({
        borderRadius: radii.circle,
        outlineColor: colors.primary,
        outlineStyle: 'solid',
        outlineWidth: 2,
      })
    })
  })

  describe('measurements', () => {
    it('draws a 20 ring with a 2 rule and a 10 dot inside a 40 disc', async () => {
      await render(
        <RadioGroup defaultValue="first" label="Label">
          <Options />
        </RadioGroup>,
      )
      const { disc, dot, ring } = parts('First item')

      expect(styleOf(disc)).toMatchObject({ height: 40, width: 40 })
      expect(styleOf(ring)).toMatchObject({
        alignItems: 'center',
        borderRadius: radii.circle,
        borderWidth: 2,
        height: 20,
        justifyContent: 'center',
        width: 20,
      })
      expect(styleOf(child(dot))).toMatchObject({
        borderRadius: radii.circle,
        height: 10,
        width: 10,
      })
    })

    it('takes presses over a 48dp target', async () => {
      await render(
        <RadioGroup label="Label">
          <Options />
        </RadioGroup>,
      )

      expect(button('First item').props.hitSlop).toEqual({
        bottom: 4,
        left: 4,
        right: 4,
        top: 4,
      })
    })

    it('stacks the label, the buttons and the line 4dp apart, the line 4dp further', async () => {
      await render(
        <RadioGroup description="Supporting line" label="Label">
          <Options />
        </RadioGroup>,
      )

      expect(styleOf(group())).toMatchObject({
        flexDirection: 'column',
        rowGap: spacing.xs,
      })
      expect(
        styleOf(child(screen.getByText('Supporting line').parent)),
      ).toEqual({ marginTop: spacing.xs })
    })

    it('lays the buttons one under another', async () => {
      await render(
        <RadioGroup label="Label">
          <Options />
        </RadioGroup>,
      )

      const items = child(group().children.at(1))
      expect(styleOf(items)).toEqual({ flexDirection: 'column' })
      expect(styleOf(child(items.children.at(0)))).toEqual({})
    })

    it('lays them along a wrapping line 16dp apart when horizontal, each giving up width', async () => {
      await render(
        <RadioGroup label="Label" orientation="horizontal">
          <Options />
        </RadioGroup>,
      )

      const items = child(group().children.at(1))
      expect(styleOf(items)).toEqual({
        columnGap: spacing.lg,
        flexDirection: 'row',
        flexWrap: 'wrap',
      })
      expect(styleOf(child(items.children.at(0)))).toEqual({ flexShrink: 1 })
    })
  })

  it('passes style, ref and testID through to the group', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(
      <RadioGroup label="Label" ref={ref} style={OFFSET} testID="group">
        <Options />
      </RadioGroup>,
    )

    expect(screen.getByTestId('group')).toBe(group())
    expect(styleOf(group())).toMatchObject(OFFSET)
    expect(ref.current).not.toBeNull()
  })

  it('passes style, ref and testID through to the view holding a button', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(
      <RadioGroup label="Label">
        <Radio ref={ref} style={OFFSET} testID="radio" value="first">
          First item
        </Radio>
      </RadioGroup>,
    )

    const root = screen.getByTestId('radio')
    expect(styleOf(root)).toEqual(OFFSET)
    expect(root.children.at(0)).toBe(button('First item'))
    expect(ref.current).not.toBeNull()
  })
})
