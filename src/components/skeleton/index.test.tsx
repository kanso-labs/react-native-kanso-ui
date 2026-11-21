import type { StyleProp, ViewStyle } from 'react-native'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { act, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { SkeletonBarSize } from '.'

import { Skeleton } from '.'
import { I18nProvider } from '../../i18n/provider'
import { scopeFor } from '../../theme/scope'

// What the next skeleton the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

const { theme } = scopeFor('light', {})
const { colors, radii, sizing, spacing } = theme

// A circle, hoisted so it is one stable element per render.
const MARK = <Skeleton.Circle />

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

function opacity() {
  const value: unknown = getAnimatedStyle(root()).opacity
  if (typeof value !== 'number') {
    throw new TypeError('expected an opacity')
  }
  return value
}

async function renderRows() {
  return render(
    <Skeleton testID="skeleton">
      <Skeleton.Row leading={MARK} lines={2}>
        <Skeleton.Bar size="md" width="60%" />
        <Skeleton.Bar width={120} />
      </Skeleton.Row>
      <Skeleton.Row>
        <Skeleton.Bar size="lg" width="80%" />
      </Skeleton.Row>
    </Skeleton>,
  )
}

// The skeleton's own view, which holds the shapes and fades them.
function root() {
  return screen.getByTestId('skeleton')
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  mockReducedMotion = false
  jest.useRealTimers()
})

describe('Skeleton', () => {
  describe('for a screen reader', () => {
    it('is one busy element, named Loading', async () => {
      await renderRows()

      const [only, ...rest] = screen.getAllByRole('progressbar')

      expect(rest).toHaveLength(0)
      expect(only).toBe(root())
      expect(root().props).toMatchObject({
        accessible: true,
        'aria-busy': true,
        'aria-label': 'Loading',
      })
      expect(screen.getByRole('progressbar', { name: 'Loading' })).toBe(root())
    })

    it("says the library's word for loading in the locale", async () => {
      await render(
        <I18nProvider locale="pt-BR">
          <Skeleton testID="skeleton" />
        </I18nProvider>,
      )

      expect(root().props['aria-label']).toBe('Carregando')
    })

    it('takes a name of the call site', async () => {
      await render(<Skeleton aria-label="Label" testID="skeleton" />)

      expect(screen.getByRole('progressbar', { name: 'Label' })).toBe(root())
    })
  })

  describe('the fade', () => {
    it('fades from full opacity to 60% over 1.5 seconds, and back', async () => {
      await renderRows()
      await advance(0)

      expect(opacity()).toBeCloseTo(1, 2)

      await advance(1500)

      expect(opacity()).toBeCloseTo(0.6, 2)

      await advance(1500)

      expect(opacity()).toBeCloseTo(1, 2)
    })

    it('holds at full opacity under reduced motion', async () => {
      mockReducedMotion = true
      await renderRows()

      await advance(750)
      expect(opacity()).toBe(1)
      await advance(750)
      expect(opacity()).toBe(1)
    })
  })

  describe('the rows', () => {
    it("stand at the list's 72dp for two lines and 56dp for one", async () => {
      await renderRows()

      const [two, one] = root().children.map((row) => {
        if (typeof row === 'string') {
          throw new TypeError('expected a row')
        }
        return styleOf(row)
      })

      expect(two).toMatchObject({
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.lg,
        minHeight: sizing.rowMd,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
      })
      expect(one.minHeight).toBe(sizing.rowSm)
    })

    it.each<[SkeletonBarSize, number]>([
      ['sm', 12],
      ['md', 14],
      ['lg', 28],
    ])(
      'draws a %s bar %ddp tall, at the 4dp corner, as wide as it is told',
      async (size, height) => {
        await render(
          <Skeleton testID="skeleton">
            <Skeleton.Bar size={size} width="50%" />
          </Skeleton>,
        )

        const [bar] = root().children

        if (typeof bar === 'string') {
          throw new TypeError('expected a bar')
        }
        expect(styleOf(bar)).toMatchObject({
          backgroundColor: colors.surfaceContainerHighest,
          borderRadius: radii.xs,
          height,
          width: '50%',
        })
      },
    )

    it('draws a 40dp circle for a mark', async () => {
      await render(
        <Skeleton testID="skeleton">
          <Skeleton.Circle />
        </Skeleton>,
      )

      const [circle] = root().children

      if (typeof circle === 'string') {
        throw new TypeError('expected a circle')
      }
      expect(styleOf(circle)).toMatchObject({
        backgroundColor: colors.surfaceContainerHighest,
        borderRadius: radii.pill,
        height: 40,
        width: 40,
      })
    })
  })
})
