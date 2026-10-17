import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { TestInstance, TestNode } from 'test-renderer'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { act, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { I18nManager, Text as NativeText, StyleSheet, View } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { AppBarProps } from '.'
import type { KuiTheme } from '../../tokens/defaults'

import { AppBar } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { ThemeScope } from '../../theme-scope'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'
import { IconButton } from '../icon-button'

// What the next bar the device draws is told about reduced motion.
let mockReducedMotion = false

// Every timing the bar asks Reanimated for, since the two fills are too
// close in colour for the end of a curve to show which duration it ran over.
const mockTimings: unknown[] = []

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<typeof import('react-native-reanimated')>(
    'react-native-reanimated',
  )
  return {
    __esModule: true,
    ...actual,
    useReducedMotion: () => mockReducedMotion,
    withTiming: (...args: Parameters<typeof actual.withTiming>) => {
      mockTimings.push(args[1])
      return actual.withTiming(...args)
    },
  }
})

const { theme } = scopeFor('light', {})
const { colors, motion, spacing, typography } = theme

// Each size, its minimum height without a subtitle and with one, and the
// type role its headline is set in.
const SIZES: [
  NonNullable<AppBarProps['size']>,
  number,
  number,
  'headlineMedium' | 'headlineSmall' | 'titleLarge',
][] = [
  ['sm', 64, 64, 'titleLarge'],
  ['md', 112, 136, 'headlineSmall'],
  ['lg', 120, 152, 'headlineMedium'],
]

// A theme of its own, which nothing else renders under.
const OWN_THEME: KuiTheme = {}

// The slots most cases fill.
const BACK = (
  <IconButton aria-label="Back">
    <NativeText>B</NativeText>
  </IconButton>
)
const SEARCH = (
  <IconButton aria-label="Search">
    <NativeText>S</NativeText>
  </IconButton>
)

// The bar's surface, its outermost view.
function bar() {
  return screen.getByTestId('bar')
}

// The button inside a slot, which is the slot's first child.
function buttonIn(slot: TestInstance) {
  return child(slot.children[0])
}

function child(node: TestNode | undefined): TestInstance {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

// The bar's fill as it stands, as a colour at full opacity.
function fill() {
  const color: unknown = getAnimatedStyle(bar()).backgroundColor
  if (typeof color !== 'string') {
    throw new TypeError('expected a colour')
  }
  return withOpacity(color, 1)
}

function headline() {
  return screen.getByRole('heading')
}

// What an icon in a slot is handed, written out where a test can read it.
function Probe({ testID }: { readonly testID: string }) {
  const { color, size } = useIconStyle()

  return <View style={probeStyle(color, size)} testID={testID} />
}

function probeStyle(color: unknown, size: number): ViewStyle {
  return { borderColor: String(color), height: size }
}

async function renderBar(props: Partial<AppBarProps> = {}) {
  return render(<AppBar headline="Headline" testID="bar" {...props} />)
}

// The row inside the safe area, which the bar's contents are laid out in.
function row() {
  return child(safeArea().children[0])
}

function safeArea() {
  return child(bar().children[0])
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function textStyleOf(element: {
  props: { style?: StyleProp<TextStyle> }
}): TextStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  mockReducedMotion = false
  mockTimings.length = 0
  jest.useRealTimers()
})

describe('AppBar', () => {
  describe('semantics', () => {
    it('is a heading for a screen reader', async () => {
      await renderBar()

      expect(headline()).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'Headline' })).toBeTruthy()
    })

    it('finds its actions by role and name', async () => {
      await renderBar({ leading: BACK, trailing: SEARCH })

      expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy()
    })

    it('draws a subtitle under the headline', async () => {
      await renderBar({ size: 'md', subtitle: 'Supporting line' })

      expect(textStyleOf(screen.getByText('Supporting line'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.bodyMediumSize,
      })
    })

    it('wraps a long headline rather than truncating it', async () => {
      await renderBar()

      expect(headline().props.numberOfLines).toBeUndefined()
    })

    it('draws neither slot nor headline it was not given', async () => {
      await render(<AppBar testID="bar" />)

      expect(screen.queryByRole('heading')).toBeNull()
      expect(row().children).toHaveLength(1)
    })
  })

  describe.each(SIZES)('at %s', (size, plain, withSubtitle, role) => {
    it(`is at least ${String(plain)}dp tall`, async () => {
      await renderBar({ size })

      expect(styleOf(row()).minHeight).toBe(plain)
      expect(styleOf(row()).height).toBeUndefined()
    })

    it(`is at least ${String(withSubtitle)}dp tall with a subtitle`, async () => {
      await renderBar({ size, subtitle: 'Supporting line' })

      expect(styleOf(row()).minHeight).toBe(withSubtitle)
    })

    it(`sets the headline in ${role}`, async () => {
      await renderBar({ size })

      expect(textStyleOf(headline())).toMatchObject({
        color: colors.onSurface,
        fontSize: typography[`${role}Size`],
        lineHeight: typography[`${role}LineHeight`],
      })
    })
  })

  describe('collapsed', () => {
    it.each(['md', 'lg'] as const)(
      'turns %s into the small bar',
      async (size) => {
        await renderBar({ collapsed: true, size, subtitle: 'Supporting line' })

        expect(styleOf(row()).minHeight).toBe(64)
        expect(textStyleOf(headline()).fontSize).toBe(typography.titleLargeSize)
        expect(screen.queryByText('Supporting line')).toBeNull()
      },
    )

    it('leaves the small bar as it is', async () => {
      await renderBar({ collapsed: true, subtitle: 'Supporting line' })

      expect(styleOf(row()).minHeight).toBe(64)
      expect(screen.getByText('Supporting line')).toBeTruthy()
    })
  })

  describe('the safe area', () => {
    it('keeps the contents clear of the top and the sides', async () => {
      await renderBar()

      expect(safeArea().type).toBe('RNCSafeAreaView')
      expect(safeArea().props.edges).toEqual({
        bottom: 'off',
        left: 'additive',
        right: 'additive',
        top: 'additive',
      })
    })

    it('paints its surface around the inset', async () => {
      await renderBar()

      expect(fill()).toBe(withOpacity(colors.surface, 1))
      expect(styleOf(safeArea()).backgroundColor).toBeUndefined()
    })
  })

  describe('the content inset', () => {
    it('starts the headline at the spacing scale lg step', async () => {
      await renderBar()

      expect(styleOf(row())).toMatchObject({
        paddingEnd: spacing.lg,
        paddingStart: spacing.lg,
      })
    })

    it('puts a slot glyph rather than its target at the inset', async () => {
      await renderBar({ leading: BACK, trailing: SEARCH })

      // The target's 12dp around a 24dp glyph, and the slot's 4dp.
      expect(styleOf(row())).toMatchObject({
        paddingEnd: spacing.lg - 12,
        paddingStart: spacing.lg - 12,
      })
    })

    it('takes an inset of the call site', async () => {
      await renderBar({ contentInset: 24, trailing: SEARCH })

      expect(styleOf(row())).toMatchObject({ paddingEnd: 12, paddingStart: 24 })
    })

    it('stops at zero for an inset smaller than a glyph', async () => {
      await renderBar({ contentInset: 4, leading: BACK })

      expect(styleOf(row()).paddingStart).toBe(0)
    })

    it('stops growing at the measure it is given', async () => {
      await renderBar({ contentMaxInlineSize: 600 })

      expect(styleOf(row())).toMatchObject({ maxWidth: 600, width: '100%' })
      expect(styleOf(safeArea()).alignItems).toBe('center')
    })

    it('spaces two buttons by their targets', async () => {
      await renderBar({ trailing: [BACK, SEARCH] })

      expect(styleOf(child(row().children[1]))).toMatchObject({
        flexShrink: 0,
        gap: 8,
        paddingHorizontal: 4,
      })
    })
  })

  describe('the slots', () => {
    it('hand a leading icon the on-surface colour at 24dp', async () => {
      await renderBar({ leading: <Probe testID="icon" /> })

      expect(styleOf(screen.getByTestId('icon'))).toMatchObject({
        borderColor: colors.onSurface,
        height: 24,
      })
    })

    it('hand a trailing icon the on-surface-variant colour at 24dp', async () => {
      await renderBar({ trailing: <Probe testID="icon" /> })

      expect(styleOf(screen.getByTestId('icon'))).toMatchObject({
        borderColor: colors.onSurfaceVariant,
        height: 24,
      })
    })
  })

  describe('align', () => {
    it('centres the text', async () => {
      await renderBar({
        align: 'center',
        size: 'md',
        subtitle: 'Supporting line',
      })

      expect(textStyleOf(headline()).textAlign).toBe('center')
      expect(textStyleOf(screen.getByText('Supporting line')).textAlign).toBe(
        'center',
      )
    })

    it('starts the text by default', async () => {
      await renderBar()

      expect(textStyleOf(headline()).textAlign).toBeUndefined()
    })
  })

  describe('scrolled', () => {
    it('fills the bar with the surface container role', async () => {
      await renderBar({ scrolled: true })

      expect(fill()).toBe(withOpacity(colors.surfaceContainer, 1))
    })

    it('eases between the two over medium 1', async () => {
      await renderBar()

      expect(fill()).toBe(withOpacity(colors.surface, 1))

      await screen.rerender(
        <AppBar headline="Headline" scrolled testID="bar" />,
      )
      await act(() => {
        jest.advanceTimersByTime(motion.durationMedium1 / 2)
      })

      expect(fill()).not.toBe(withOpacity(colors.surface, 1))
      expect(fill()).not.toBe(withOpacity(colors.surfaceContainer, 1))

      await act(() => {
        jest.advanceTimersByTime(motion.durationMedium1 / 2)
      })

      expect(fill()).toBe(withOpacity(colors.surfaceContainer, 1))
      expect(mockTimings.at(-1)).toMatchObject({
        duration: motion.durationMedium1,
      })
    })

    it('arrives at once under reduced motion', async () => {
      mockReducedMotion = true
      await renderBar()

      await screen.rerender(
        <AppBar headline="Headline" scrolled testID="bar" />,
      )
      await act(() => {
        jest.advanceTimersByTime(0)
      })

      expect(fill()).toBe(withOpacity(colors.surfaceContainer, 1))
    })
  })

  describe('pinned', () => {
    it('is drawn over what follows it', async () => {
      await renderBar({ pinned: true })

      expect(styleOf(bar()).zIndex).toBe(1)
    })

    it('takes no stacking of its own otherwise', async () => {
      await renderBar()

      expect(styleOf(bar()).zIndex).toBeUndefined()
    })
  })

  describe('in a right-to-left layout', () => {
    it('leaves the row to put the leading slot at the start, on the right', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(
        <ThemeScope theme={OWN_THEME}>
          <AppBar
            headline="Headline"
            leading={BACK}
            testID="bar"
            trailing={SEARCH}
          />
        </ThemeScope>,
      )

      expect(styleOf(row()).flexDirection).toBe('row')
      expect(styleOf(row()).direction).toBeUndefined()
      expect(screen.getByRole('button', { name: 'Back' })).toBe(
        buttonIn(child(row().children[0])),
      )
      expect(styleOf(row()).paddingStart).toBe(spacing.lg - 12)
    })
  })

  describe('the root', () => {
    it('takes a ref and a style of the call site', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await renderBar({ ref, style: { marginTop: 8 } })

      expect(ref.current).not.toBeNull()
      expect(styleOf(bar()).marginTop).toBe(8)
    })

    it('hands a layout event to the call site', async () => {
      const onLayout = jest.fn()
      await renderBar({ onLayout })

      expect(bar().props.onLayout).toBe(onLayout)
    })
  })
})
