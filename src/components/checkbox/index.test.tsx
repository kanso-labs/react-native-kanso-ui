import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle } from 'react-native'
import type { TestInstance, TestNode } from 'test-renderer'

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

import { Checkbox } from '.'
import { ThemeScope } from '../../theme-scope'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

// What the next checkbox the device draws is told about reduced motion.
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

// kanso-ui's paths, copied rather than read from the glyphs under test.
const CHECK = 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
const DASH = 'M19 13H5v-2h14v2z'

// The state layer's colour over each kind of box, hovered and pressed, from
// the page: the two swap once pressed, and error is error throughout.
const LAYERS = [
  {
    hover: colors.onSurface,
    name: 'an unselected box',
    pressed: colors.primary,
    props: {},
  },
  {
    hover: colors.primary,
    name: 'a selected box',
    pressed: colors.onSurface,
    props: { defaultSelected: true },
  },
  {
    hover: colors.error,
    name: 'an invalid box',
    pressed: colors.error,
    props: { error: 'Choose one.' },
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

// The box's fill and rule once its ease has run.
async function boxColors() {
  await advance(motion.durationShort2)
  return {
    fill: fillOf(),
    rule: same(getAnimatedStyle(parts().box).borderColor),
  }
}

function checkbox() {
  return screen.getByRole('checkbox')
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

// The box's fill as it stands.
function fillOf() {
  return same(getAnimatedStyle(parts().box).backgroundColor)
}

// The glyph's path, or nothing while no glyph is drawn.
function glyphPath(): unknown {
  const { glyph } = parts()
  return glyph === undefined ? undefined : pathsIn(glyph).at(0)
}

// The 40dp disc, the press feedback's layer inside it, the box over that, and
// the glyph over the box while one is drawn.
function parts() {
  const disc = child(checkbox().children.at(0))
  const surface = child(disc.children.at(0))
  const glyph = disc.children.at(2)
  return {
    box: child(disc.children.at(1)),
    disc,
    glyph: glyph === undefined ? undefined : child(glyph),
    layer: child(surface.children.at(0)),
    ripple: surface.children.at(1),
    surface,
  }
}

function pathsIn(node: TestInstance): unknown[] {
  const d: unknown = node.props.d
  return [
    ...(node.type === 'RNSVGPath' ? [d] : []),
    ...node.children.flatMap((part) =>
      typeof part === 'string' ? [] : pathsIn(part),
    ),
  ]
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

describe('Checkbox', () => {
  describe('semantics', () => {
    it('is announced as a checkbox named by its label', async () => {
      await render(<Checkbox>Label</Checkbox>)

      expect(screen.getByRole('checkbox', { name: 'Label' })).toBeTruthy()
    })

    it('is named by aria-label without a label of its own', async () => {
      await render(<Checkbox aria-label="Label" />)

      expect(screen.getByRole('checkbox', { name: 'Label' })).toBeTruthy()
      // The disc alone, with no empty text beside it to take a gap.
      expect(checkbox().children).toHaveLength(1)
    })

    it('reports unchecked, checked and mixed', async () => {
      await render(<Checkbox>Label</Checkbox>)
      expect(checkbox()).not.toBeChecked()
      expect(checkbox()).not.toBePartiallyChecked()

      await screen.rerender(<Checkbox isSelected>Label</Checkbox>)
      expect(checkbox()).toBeChecked()

      await screen.rerender(<Checkbox isIndeterminate>Label</Checkbox>)
      expect(checkbox()).toBePartiallyChecked()
    })

    it('reads its description as its hint, and hides the line itself', async () => {
      await render(<Checkbox description="Supporting line">Label</Checkbox>)

      expect(checkbox().props.accessibilityHint).toBe('Supporting line')
      expect(screen.queryByText('Supporting line')).toBeNull()
      expect(
        screen.getByText('Supporting line', { includeHiddenElements: true }),
      ).toBeTruthy()
    })

    it('replaces the description with the error rather than stacking them', async () => {
      await render(
        <Checkbox description="Supporting line" error="Choose one.">
          Label
        </Checkbox>,
      )

      expect(checkbox().props.accessibilityHint).toBe('Choose one.')
      expect(
        screen.queryByText('Supporting line', { includeHiddenElements: true }),
      ).toBeNull()
      expect(
        screen.getByText('Choose one.', { includeHiddenElements: true }),
      ).toBeTruthy()
    })

    it('points at the line under it on the web, which drops the hint', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await render(<Checkbox description="Supporting line">Label</Checkbox>)

      const line = screen.getByText('Supporting line')
      expect(typeof line.props.id).toBe('string')
      expect(checkbox().props['aria-describedby']).toBe(line.props.id)
      expect(checkbox().props).not.toHaveProperty('accessibilityHint')
    })

    it('names no line when there is none', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await render(<Checkbox>Label</Checkbox>)

      expect(checkbox().props).not.toHaveProperty('aria-describedby')
    })

    it('draws no line for an empty error, and still takes the error colours', async () => {
      await render(
        <Checkbox description="Supporting line" error="">
          Label
        </Checkbox>,
      )

      expect(checkbox().props).not.toHaveProperty('accessibilityHint')
      expect(
        screen.queryByText('Supporting line', { includeHiddenElements: true }),
      ).toBeNull()
      expect((await boxColors()).rule).toBe(same(colors.error))
    })
  })

  describe('selection', () => {
    it('keeps its own state, changed by a press on the box or the label', async () => {
      const onChange = jest.fn()
      await render(<Checkbox onChange={onChange}>Label</Checkbox>)

      await fireEvent.press(checkbox())
      expect(checkbox()).toBeChecked()
      expect(onChange).toHaveBeenLastCalledWith(true)

      await fireEvent.press(screen.getByText('Label'))
      expect(checkbox()).not.toBeChecked()
      expect(onChange).toHaveBeenLastCalledWith(false)
    })

    it('starts selected when told to', async () => {
      await render(<Checkbox defaultSelected>Label</Checkbox>)

      expect(checkbox()).toBeChecked()
    })

    it('reports without moving when controlled', async () => {
      const onChange = jest.fn()
      await render(
        <Checkbox isSelected={false} onChange={onChange}>
          Label
        </Checkbox>,
      )

      await fireEvent.press(checkbox())

      expect(onChange).toHaveBeenCalledWith(true)
      expect(checkbox()).not.toBeChecked()
    })

    it('stays mixed while indeterminate, and still reports a press', async () => {
      const onChange = jest.fn()
      await render(
        <Checkbox isIndeterminate onChange={onChange}>
          Label
        </Checkbox>,
      )

      await fireEvent.press(checkbox())

      expect(onChange).toHaveBeenCalledWith(true)
      expect(checkbox()).toBePartiallyChecked()
    })

    it('takes no press while disabled, and is announced disabled', async () => {
      const onChange = jest.fn()
      await render(
        <Checkbox isDisabled onChange={onChange}>
          Label
        </Checkbox>,
      )

      await fireEvent.press(checkbox())

      expect(checkbox()).toBeDisabled()
      expect(checkbox()).not.toBeChecked()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('takes no press while read-only, without being announced disabled', async () => {
      const onChange = jest.fn()
      await render(
        <Checkbox defaultSelected isReadOnly onChange={onChange}>
          Label
        </Checkbox>,
      )

      await fireEvent.press(checkbox())

      expect(checkbox()).toBeEnabled()
      expect(checkbox()).toBeChecked()
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('appearance', () => {
    it('draws an unselected box as a rule in on surface variant', async () => {
      await render(<Checkbox>Label</Checkbox>)

      expect(await boxColors()).toEqual({
        fill: same(withOpacity(colors.onSurfaceVariant, 0)),
        rule: same(colors.onSurfaceVariant),
      })
      expect(parts().glyph).toBeUndefined()
    })

    it('fills a selected box with primary and draws the check in on primary', async () => {
      await render(<Checkbox defaultSelected>Label</Checkbox>)

      expect(await boxColors()).toEqual({
        fill: same(colors.primary),
        rule: same(withOpacity(colors.primary, 0)),
      })
      expect(glyphPath()).toBe(CHECK)
      expect(parts().glyph?.props).toMatchObject({
        color: colors.onPrimary,
        height: 18,
        width: 18,
      })
    })

    it('fills an indeterminate box the same way, with the dash', async () => {
      await render(<Checkbox isIndeterminate>Label</Checkbox>)

      expect((await boxColors()).fill).toBe(same(colors.primary))
      expect(glyphPath()).toBe(DASH)
      expect(parts().glyph?.props.color).toBe(colors.onPrimary)
    })

    it('eases to the filled box over the short duration once pressed', async () => {
      await render(<Checkbox>Label</Checkbox>)
      await advance(motion.durationShort2)

      await fireEvent.press(checkbox())
      await advance(motion.durationShort2 / 2)

      expect(fillOf()).not.toBe(same(colors.primary))
      expect(fillOf()).not.toBe(same(withOpacity(colors.onSurfaceVariant, 0)))

      await advance(motion.durationShort2 / 2)

      expect(fillOf()).toBe(same(colors.primary))
    })

    it('moves at once for a reader who asks for reduced motion', async () => {
      mockReducedMotion = true
      await render(<Checkbox>Label</Checkbox>)

      await fireEvent.press(checkbox())
      await advance(0)

      expect(fillOf()).toBe(same(colors.primary))
    })

    it('takes the error pair while invalid', async () => {
      await render(<Checkbox error="Choose one.">Label</Checkbox>)

      expect((await boxColors()).rule).toBe(same(colors.error))
      expect(
        styleOf(
          screen.getByText('Choose one.', { includeHiddenElements: true }),
        ).color,
      ).toBe(colors.error)

      await screen.rerender(
        <Checkbox error="Choose one." isSelected>
          Label
        </Checkbox>,
      )

      expect((await boxColors()).fill).toBe(same(colors.error))
      expect(parts().glyph?.props.color).toBe(colors.onError)
    })

    // On error and on primary are both white in the light scheme, so the dark
    // one is where a check drawn in the wrong role shows.
    it('draws the check in on error over an invalid box in the dark scheme', async () => {
      const dark = scopeFor('dark', {}).theme.colors
      await render(
        <ThemeScope scheme="dark">
          <Checkbox error="Choose one." isSelected>
            Label
          </Checkbox>
        </ThemeScope>,
      )

      expect(dark.onError).not.toBe(dark.onPrimary)
      expect(parts().glyph?.props.color).toBe(dark.onError)
    })

    it('dims the rule, the fill and the label while disabled, over an error', async () => {
      await render(
        <Checkbox error="Choose one." isDisabled>
          Label
        </Checkbox>,
      )

      expect((await boxColors()).rule).toBe(same(DISABLED))
      expect(styleOf(screen.getByText('Label')).color).toBe(DISABLED)

      await screen.rerender(
        <Checkbox error="Choose one." isDisabled isSelected>
          Label
        </Checkbox>,
      )

      expect((await boxColors()).fill).toBe(same(DISABLED))
      expect(parts().glyph?.props.color).toBe(colors.surface)
    })

    it('turns the rule on surface while hovered, pressed or focused', async () => {
      await render(<Checkbox isSelected={false}>Label</Checkbox>)

      await fireEvent(checkbox(), 'hoverIn', {})
      expect((await boxColors()).rule).toBe(same(colors.onSurface))

      await fireEvent(checkbox(), 'hoverOut', {})
      expect((await boxColors()).rule).toBe(same(colors.onSurfaceVariant))

      await fireEvent(checkbox(), 'pressIn', { nativeEvent: {} })
      expect((await boxColors()).rule).toBe(same(colors.onSurface))
      await fireEvent(checkbox(), 'pressOut', {})

      await fireEvent(checkbox(), 'blur', {})
      await fireEvent(checkbox(), 'focus', {})
      expect((await boxColors()).rule).toBe(same(colors.onSurface))
    })

    it('keeps the rule at rest under a pointer while read-only', async () => {
      await render(<Checkbox isReadOnly>Label</Checkbox>)

      await fireEvent(checkbox(), 'hoverIn', {})

      expect((await boxColors()).rule).toBe(same(colors.onSurfaceVariant))
    })

    it('reads its colours from the theme around it', async () => {
      await render(
        <ThemeScope theme={PRIMARY}>
          <Checkbox defaultSelected>Label</Checkbox>
        </ThemeScope>,
      )

      expect((await boxColors()).fill).toBe(same('#0b57d0'))
    })
  })

  describe('the state layer', () => {
    it.each(LAYERS)(
      'is drawn over $name in its own colour, swapped once pressed',
      async ({ hover, pressed, props }) => {
        await render(<Checkbox {...props}>Label</Checkbox>)

        await fireEvent(checkbox(), 'hoverIn', {})
        expect(styleOf(parts().layer)).toMatchObject({
          backgroundColor: hover,
          opacity: stateLayerOpacity.hover,
        })

        await fireEvent(checkbox(), 'pressIn', { nativeEvent: {} })
        expect(styleOf(parts().layer)).toMatchObject({
          backgroundColor: pressed,
          opacity: stateLayerOpacity.pressed,
        })
      },
    )

    it.each([
      { name: 'disabled', props: { isDisabled: true } },
      { name: 'read-only', props: { isReadOnly: true } },
    ])('is not drawn while $name', async ({ props }) => {
      await render(<Checkbox {...props}>Label</Checkbox>)

      await fireEvent(checkbox(), 'hoverIn', {})

      expect(styleOf(parts().layer).opacity).toBe(0)
    })

    it('fills the disc, clipped to its circle', async () => {
      await render(<Checkbox>Label</Checkbox>)

      expect(styleOf(parts().surface)).toMatchObject({
        borderRadius: radii.circle,
        overflow: 'hidden',
      })
    })

    it('ripples from the middle of the disc wherever the row is pressed', async () => {
      await render(<Checkbox>Label</Checkbox>)

      await fireEvent(checkbox(), 'pressIn', {
        nativeEvent: { pageX: 300, pageY: 30 },
      })
      await advance(0)

      // A disc a fifth of the layer's side, centred in the layer.
      const size = 40 * 0.2
      const start = (40 - size) / 2
      expect(getAnimatedStyle(child(parts().ripple))).toMatchObject({
        backgroundColor: colors.primary,
        height: size,
        transform: [{ translateX: start }, { translateY: start }, { scale: 1 }],
      })
    })

    it('rings the disc for focus from a key', async () => {
      await render(<Checkbox>Label</Checkbox>)

      await fireEvent(checkbox(), 'focus', {})

      expect(styleOf(parts().disc)).toMatchObject({
        borderRadius: radii.circle,
        outlineColor: colors.primary,
        outlineStyle: 'solid',
        outlineWidth: 2,
      })
    })
  })

  describe('measurements', () => {
    it('draws an 18 box with a 2 rule and corner inside a 40 disc', async () => {
      await render(<Checkbox defaultSelected>Label</Checkbox>)

      expect(styleOf(parts().disc)).toMatchObject({ height: 40, width: 40 })
      expect(styleOf(parts().box)).toMatchObject({
        borderRadius: 2,
        borderWidth: 2,
        height: 18,
        width: 18,
      })
      // The glyph covers the whole box, rule included.
      expect(styleOf(parts().glyph ?? { props: {} })).toMatchObject({
        left: 11,
        position: 'absolute',
        top: 11,
      })
    })

    it('takes presses over a 48dp target', async () => {
      await render(<Checkbox aria-label="Label" />)

      expect(checkbox().props.hitSlop).toEqual({
        bottom: 4,
        left: 4,
        right: 4,
        top: 4,
      })
    })

    it('grows with the label rather than holding the layer’s height', async () => {
      await render(<Checkbox>Label</Checkbox>)

      expect(styleOf(checkbox())).toMatchObject({
        columnGap: spacing.sm,
        flexDirection: 'row',
        minHeight: 40,
      })
      expect(styleOf(checkbox())).not.toHaveProperty('height')
    })

    it('sets the label in body large, its first line centred on the disc', async () => {
      await render(<Checkbox>Label</Checkbox>)

      expect(styleOf(screen.getByText('Label'))).toMatchObject({
        color: colors.onSurface,
        flexShrink: 1,
        fontSize: typography.bodyLargeSize,
        lineHeight: typography.bodyLargeLineHeight,
        // What lets a word with nowhere to break wrap inside the row under
        // React Native Web.
        minWidth: 0,
        paddingVertical: (40 - typography.bodyLargeLineHeight) / 2,
      })
    })

    it('sets the line under the label, in body small', async () => {
      await render(<Checkbox description="Supporting line">Label</Checkbox>)

      const line = screen.getByText('Supporting line', {
        includeHiddenElements: true,
      })
      expect(styleOf(line)).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.bodySmallSize,
        lineHeight: typography.bodySmallLineHeight,
      })
      expect(styleOf(child(line.parent))).toEqual({
        marginStart: 40 + spacing.sm,
        marginTop: spacing.xs,
      })
    })
  })

  it('passes style, ref and testID through to the view holding the row', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(
      <Checkbox ref={ref} style={OFFSET} testID="checkbox">
        Label
      </Checkbox>,
    )

    const root = screen.getByTestId('checkbox')
    expect(styleOf(root)).toEqual({ marginTop: 4 })
    expect(root.children.at(0)).toBe(checkbox())
    expect(ref.current).not.toBeNull()
  })
})
