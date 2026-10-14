import type { ComponentRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { StyleSheet, useColorScheme, View } from 'react-native'

import type { KuiTheme } from './tokens/defaults'

import { ThemeScope } from './theme-scope'
import { type ResolvedTheme, useTheme } from './theme/scope'
import { dark, light } from './tokens/defaults'

// Every map a case hands a scope is a constant, as the scope's own comment
// asks of an app, so a case about resolving once is not undone by the map
// itself changing.
const ACCENT: KuiTheme = { '--kui-color-primary': '#7d5260' }
const BRAND: KuiTheme = {
  '--kui-color-primary': '#006a6a',
  '--kui-color-secondary': '#4a6363',
}
const VALUES: KuiTheme = {
  '--kui-color-primary': 'rgb(0, 106, 106)',
  '--kui-motion-duration-short1': '0.2s',
  '--kui-motion-easing-standard': 'cubic-bezier(0.3, 0, 0, 1)',
  '--kui-radius-sm': '6px',
  '--kui-shadow-elevation1': '0px 1px 2px 0px rgba(0, 0, 0, 0.3)',
  '--kui-spacing-md': '20px',
  '--kui-state-layer-opacity-hover': '12%',
  '--kui-typography-font-family-plain': "'Inter', sans-serif",
  '--kui-typography-weight-regular': '450',
}
// What a call site styles a scope with, drawn over the surface it paints.
const CALL_SITE = { backgroundColor: 'red', flex: 1 }
const UNEVALUABLE: KuiTheme = {
  '--kui-color-primary': 'color-mix(in srgb, red, blue)',
  '--kui-spacing-md': 'calc(4px * 3)',
}

const seen: ResolvedTheme[] = []

// Hands the theme around it to the case, which reads what it was given.
function Capture() {
  seen.push(useTheme())
  return null
}

function last(): ResolvedTheme {
  const theme = seen.at(-1)
  if (theme === undefined) {
    throw new Error('expected a theme to have been read')
  }
  return theme
}

// An unpinned scope passes no style at all, which flattens in an array.
function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

afterEach(() => {
  seen.length = 0
  jest.mocked(useColorScheme).mockReturnValue('light')
  jest.restoreAllMocks()
})

describe('useTheme', () => {
  it('reads the light defaults outside every scope', async () => {
    await render(<Capture />)

    expect(last().colors.primary).toBe(light['--kui-color-primary'])
    expect(last().colors.surface).toBe(light['--kui-color-surface'])
  })

  it('follows the device into the dark defaults outside every scope', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark')
    await render(<Capture />)

    expect(last().colors.primary).toBe(dark['--kui-color-primary'])
  })

  it('reads each kind of value in the units React Native takes', async () => {
    await render(
      <ThemeScope theme={VALUES}>
        <Capture />
      </ThemeScope>,
    )
    const { colors, motion, radii, shadows, spacing, stateLayerOpacity } =
      last()

    expect(colors.primary).toBe('rgb(0, 106, 106)')
    expect(motion.durationShort1).toBe(200)
    expect(motion.easingStandard).toEqual([0.3, 0, 0, 1])
    expect(radii.sm).toBe(6)
    expect(shadows.elevation1).toBe('0px 1px 2px 0px rgba(0, 0, 0, 0.3)')
    expect(spacing.md).toBe(20)
    expect(stateLayerOpacity.hover).toBe(0.12)
  })

  // A role's family and weight refer to the plain family and the regular
  // weight through var(), so an override of either reaches every role.
  it('follows a reference to another property', async () => {
    await render(
      <ThemeScope theme={VALUES}>
        <Capture />
      </ThemeScope>,
    )
    const { typography } = last()

    expect(typography.fontFamilyPlain).toEqual(['Inter', 'sans-serif'])
    expect(typography.bodyLargeFont).toEqual(['Inter', 'sans-serif'])
    expect(typography.weightRegular).toBe(450)
    expect(typography.bodyLargeWeight).toBe(450)
  })

  it('names a value native cannot evaluate and keeps its default', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    await render(
      <ThemeScope theme={UNEVALUABLE}>
        <Capture />
      </ThemeScope>,
    )

    expect(warn.mock.calls).toEqual([
      [
        [
          'ThemeScope kept these properties at their defaults:',
          '  --kui-color-primary: color-mix(in srgb, red, blue) uses color-mix(), which native cannot evaluate',
          '  --kui-spacing-md: calc(4px * 3) uses calc(), which native cannot evaluate',
        ].join('\n'),
      ],
    ])
    expect(last().colors.primary).toBe(light['--kui-color-primary'])
    expect(last().spacing.md).toBe(Number.parseFloat(light['--kui-spacing-md']))
  })

  it('resolves the same theme once, into the same object', async () => {
    const { rerender } = await render(
      <>
        <ThemeScope theme={BRAND}>
          <Capture />
        </ThemeScope>
        <ThemeScope theme={BRAND}>
          <Capture />
        </ThemeScope>
      </>,
    )
    await rerender(
      <ThemeScope theme={BRAND}>
        <Capture />
      </ThemeScope>,
    )

    expect(seen).toHaveLength(3)
    expect(new Set(seen).size).toBe(1)
  })
})

describe('ThemeScope', () => {
  it('follows the device while its scheme is unset', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark')
    await render(
      <ThemeScope>
        <Capture />
      </ThemeScope>,
    )

    expect(last().colors.primary).toBe(dark['--kui-color-primary'])
  })

  it('repaints when the device changes appearance', async () => {
    const { rerender } = await render(
      <ThemeScope>
        <Capture />
      </ThemeScope>,
    )
    jest.mocked(useColorScheme).mockReturnValue('dark')
    await rerender(
      <ThemeScope>
        <Capture />
      </ThemeScope>,
    )

    expect(seen.map(({ colors }) => colors.primary)).toEqual([
      light['--kui-color-primary'],
      dark['--kui-color-primary'],
    ])
  })

  it('keeps its pinned scheme whatever the device asks for', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark')
    await render(
      <ThemeScope scheme="light">
        <Capture />
      </ThemeScope>,
    )

    expect(last().colors.primary).toBe(light['--kui-color-primary'])
  })

  it('hands an unpinned scope inside it its scheme', async () => {
    await render(
      <ThemeScope scheme="dark">
        <ThemeScope>
          <Capture />
        </ThemeScope>
      </ThemeScope>,
    )

    expect(last().colors.primary).toBe(dark['--kui-color-primary'])
  })

  it('applies a nested map over its parent’s', async () => {
    await render(
      <ThemeScope theme={BRAND}>
        <Capture />
        <ThemeScope theme={ACCENT}>
          <Capture />
        </ThemeScope>
      </ThemeScope>,
    )
    const [outer, inner] = seen

    expect(outer.colors.primary).toBe('#006a6a')
    expect(inner.colors.primary).toBe('#7d5260')
    expect(inner.colors.secondary).toBe('#4a6363')
  })

  // On web the overrides are custom properties and the scheme picks only the
  // defaults beneath them, so an override declared outside a pinned scope
  // still holds inside it.
  it('keeps the overrides around it under a scheme of its own', async () => {
    await render(
      <ThemeScope theme={ACCENT}>
        <ThemeScope scheme="dark">
          <Capture />
        </ThemeScope>
      </ThemeScope>,
    )

    expect(last().colors.primary).toBe('#7d5260')
    expect(last().colors.surface).toBe(dark['--kui-color-surface'])
  })

  it('paints its surface when its scheme is pinned', async () => {
    await render(
      <>
        <ThemeScope scheme="dark" testID="dark" />
        <ThemeScope scheme="light" testID="light" />
      </>,
    )

    expect(styleOf(screen.getByTestId('dark')).backgroundColor).toBe(
      dark['--kui-color-surface'],
    )
    expect(styleOf(screen.getByTestId('light')).backgroundColor).toBe(
      light['--kui-color-surface'],
    )
  })

  it('paints nothing while its scheme is unset', async () => {
    await render(<ThemeScope testID="scope" />)

    expect(styleOf(screen.getByTestId('scope')).backgroundColor).toBeUndefined()
  })

  it('draws the style it is given over its surface', async () => {
    await render(<ThemeScope scheme="dark" style={CALL_SITE} testID="scope" />)

    expect(StyleSheet.flatten(screen.getByTestId('scope').props.style)).toEqual(
      { backgroundColor: 'red', flex: 1 },
    )
  })

  it('takes a ref on its view', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(<ThemeScope ref={ref} testID="scope" />)

    expect(ref.current).not.toBeNull()
  })
})
