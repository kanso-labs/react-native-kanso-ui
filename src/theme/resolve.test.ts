import { describe, expect, it } from '@jest/globals'

import { resolveTheme } from './resolve'

const PLAIN = "'Roboto Flex', -apple-system, sans-serif"

const DEFAULTS = {
  '--kui-color-on-primary': '#ffffff',
  '--kui-color-primary': '#6750a4',
  '--kui-color-shadow': '#000000',
  '--kui-motion-duration-long1': '0.45s',
  '--kui-motion-duration-short1': '100ms',
  '--kui-motion-easing-linear': 'linear',
  '--kui-motion-easing-standard': 'cubic-bezier(0.2, 0, 0, 1)',
  '--kui-radius-none': '0',
  '--kui-radius-sm': '8px',
  '--kui-shadow-elevation1':
    '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
  '--kui-sizing-control-md': '48px',
  '--kui-spacing-md': '12px',
  '--kui-state-layer-opacity-hover': '0.08',
  '--kui-typography-body-large-font': `var(--kui-typography-font-family-plain, ${PLAIN})`,
  '--kui-typography-body-large-line-height': '24px',
  '--kui-typography-body-large-size': '16px',
  '--kui-typography-body-large-tracking': '-0.25px',
  '--kui-typography-body-large-weight':
    'var(--kui-typography-weight-regular, 400)',
  '--kui-typography-font-family-plain': PLAIN,
  '--kui-typography-weight-regular': '400',
}

describe('resolveTheme', () => {
  it('groups and keys the tokens as the web library does', () => {
    const { problems, theme } = resolveTheme(DEFAULTS)

    expect(problems).toEqual([])
    expect(theme).toEqual({
      colors: { onPrimary: '#ffffff', primary: '#6750a4', shadow: '#000000' },
      motion: {
        durationLong1: 450,
        durationShort1: 100,
        easingLinear: [0, 0, 1, 1],
        easingStandard: [0.2, 0, 0, 1],
      },
      radii: { none: 0, sm: 8 },
      shadows: {
        elevation1:
          '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
      },
      sizing: { controlMd: 48 },
      spacing: { md: 12 },
      stateLayerOpacity: { hover: 0.08 },
      typography: {
        bodyLargeFont: ['Roboto Flex', '-apple-system', 'sans-serif'],
        bodyLargeLineHeight: 24,
        bodyLargeSize: 16,
        bodyLargeTracking: -0.25,
        bodyLargeWeight: 400,
        fontFamilyPlain: ['Roboto Flex', '-apple-system', 'sans-serif'],
        weightRegular: 400,
      },
    })
  })

  it('takes an override in place of the default', () => {
    const { problems, theme } = resolveTheme(DEFAULTS, {
      '--kui-color-primary': 'rgb(125 82 96)',
      '--kui-radius-sm': '6px',
    })

    expect(problems).toEqual([])
    expect(theme.colors.primary).toBe('rgb(125 82 96)')
    expect(theme.radii.sm).toBe(6)
  })

  it('carries an override through every role that refers to it', () => {
    const { theme } = resolveTheme(DEFAULTS, {
      '--kui-typography-font-family-plain': '"Inter", sans-serif',
      '--kui-typography-weight-regular': '450',
    })

    expect(theme.typography.bodyLargeFont).toEqual(['Inter', 'sans-serif'])
    expect(theme.typography.bodyLargeWeight).toBe(450)
  })

  it('resolves a reference inside a longer value', () => {
    const { theme } = resolveTheme(DEFAULTS, {
      '--kui-color-shadow': 'rgba(0, 0, 0, 0.5)',
      '--kui-shadow-elevation1': '0px 1px 2px 0px var(--kui-color-shadow)',
    })

    expect(theme.shadows.elevation1).toBe('0px 1px 2px 0px rgba(0, 0, 0, 0.5)')
  })

  it('takes the fallback where a reference names no token', () => {
    const { problems, theme } = resolveTheme(DEFAULTS, {
      '--kui-color-primary':
        'var(--kui-color-brand, var(--app-brand, #7d5260))',
    })

    expect(problems).toEqual([])
    expect(theme.colors.primary).toBe('#7d5260')
  })

  it('reads the other units and keywords CSS allows', () => {
    const { problems, theme } = resolveTheme(DEFAULTS, {
      '--kui-motion-easing-standard': 'ease-in-out',
      '--kui-state-layer-opacity-hover': '12%',
      '--kui-typography-weight-regular': 'bold',
    })

    expect(problems).toEqual([])
    expect(theme.motion.easingStandard).toEqual([0.42, 0, 0.58, 1])
    expect(theme.stateLayerOpacity.hover).toBe(0.12)
    expect(theme.typography.weightRegular).toBe(700)
  })

  it('clamps an opacity to the unit interval, as CSS does', () => {
    const { theme } = resolveTheme(DEFAULTS, {
      '--kui-state-layer-opacity-hover': '1.5',
    })

    expect(theme.stateLayerOpacity.hover).toBe(1)
  })

  it.each([
    [
      '--kui-color-primary',
      'color-mix(in srgb, red, blue)',
      'uses color-mix()',
    ],
    ['--kui-spacing-md', 'calc(4px * 3)', 'uses calc()'],
    ['--kui-spacing-md', '1rem', 'is not a length in px'],
    ['--kui-spacing-md', '12', 'is not a length in px'],
    ['--kui-motion-duration-short1', '100', 'is not a duration'],
    [
      '--kui-motion-easing-standard',
      'cubic-bezier(2, 0, 0, 1)',
      'cubic-bezier',
    ],
    ['--kui-motion-easing-standard', 'steps(4)', 'cubic-bezier'],
    ['--kui-typography-weight-regular', '1200', 'is not a font weight'],
    ['--kui-color-primary', 'var(--kui-color-missing)', 'no usable value'],
  ])('keeps the default where %s is %p', (property, value, reason) => {
    const { problems, theme } = resolveTheme(DEFAULTS, { [property]: value })
    const { theme: untouched } = resolveTheme(DEFAULTS)

    expect(theme).toEqual(untouched)
    expect(problems).toEqual([
      { property, reason: expect.stringContaining(reason), value },
    ])
  })

  it('gives a reference the default of a property whose override failed', () => {
    const { problems, theme } = resolveTheme(DEFAULTS, {
      '--kui-typography-font-family-plain': 'calc(1)',
    })

    expect(problems).toHaveLength(1)
    expect(theme.typography.bodyLargeFont).toEqual([
      'Roboto Flex',
      '-apple-system',
      'sans-serif',
    ])
  })

  it('stops at a reference that leads back to where it started', () => {
    const { problems, theme } = resolveTheme(DEFAULTS, {
      '--kui-color-on-primary': 'var(--kui-color-primary)',
      '--kui-color-primary': 'var(--kui-color-on-primary)',
    })

    expect(theme.colors).toEqual(resolveTheme(DEFAULTS).theme.colors)
    expect(problems.map(({ property }) => property).toSorted()).toEqual([
      '--kui-color-on-primary',
      '--kui-color-primary',
    ])
  })

  it('ignores a property the defaults do not declare, and says so', () => {
    const { problems, theme } = resolveTheme(DEFAULTS, {
      '--kui-color-brand': '#7d5260',
    })

    expect(theme.colors).not.toHaveProperty('brand')
    expect(problems).toEqual([
      {
        property: '--kui-color-brand',
        reason: 'is not a Kanso UI token',
        value: '#7d5260',
      },
    ])
  })

  it('skips an override listed as undefined', () => {
    const { problems, theme } = resolveTheme(DEFAULTS, {
      '--kui-color-primary': undefined,
    })

    expect(problems).toEqual([])
    expect(theme.colors.primary).toBe('#6750a4')
  })
})
