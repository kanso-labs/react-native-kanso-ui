import type { ComponentRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { TestInstance } from 'test-renderer'

import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { processColor, StyleSheet, View } from 'react-native'
import { parseColor } from 'react-stately'

import { ColorSwatch } from '.'
import { I18nProvider } from '../../i18n/provider'
import { ThemeScope } from '../../theme-scope'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const { colors, radii } = theme

const OPAQUE = '#6750A4'
const TRANSLUCENT = 'hsla(200, 100%, 50%, 0.4)'

// A style a call site hands the swatch.
const LARGE = { height: 72, width: 72 }

// A view laid over the whole of the one it sits in.
const ABSOLUTE_FILL = {
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
}

type Paint = { brushRef?: string; payload?: number }

/** WCAG's contrast ratio between two colours. */
function contrastOf(one: string, two: string) {
  const [lighter, darker] = [luminanceOf(one), luminanceOf(two)].sort(
    (a, b) => b - a,
  )

  return (lighter + 0.05) / (darker + 0.05)
}

// The view the colour is painted on, and the one outlining it over the top.
function fill() {
  return layers().find((layer) => layer.type === 'View')
}

function fillOf(element: { props: { fill?: Paint } }): Paint {
  return element.props.fill ?? {}
}

function hairline() {
  return layers().findLast((layer) => layer.type === 'View')
}

function layers() {
  return swatch().children.filter(
    (child): child is TestInstance => typeof child !== 'string',
  )
}

/** WCAG's relative luminance of a colour. */
function luminanceOf(color: string) {
  const rgb = parseColor(color).toFormat('rgb')
  const [r, g, b] = (['red', 'green', 'blue'] as const).map((channel) => {
    const value = rgb.getChannelValue(channel) / 255

    return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function nameOf(element: { props: { name?: string } }) {
  return element.props.name
}

function patternOf(element: TestInstance) {
  const [pattern] = element.queryAll((each) => each.type === 'RNSVGPattern')

  return pattern
}

function rects(element: TestInstance) {
  return element.queryAll((each) => each.type === 'RNSVGRect')
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function swatch() {
  return screen.getByRole('img')
}

describe('ColorSwatch', () => {
  it('is an image, named by its colour', async () => {
    await render(<ColorSwatch color={OPAQUE} />)

    expect(screen.getByRole('img', { name: 'dark purple' })).toBeOnTheScreen()
  })

  it('names a colour with transparency by how much', async () => {
    await render(<ColorSwatch color={TRANSLUCENT} />)

    expect(
      screen.getByRole('img', {
        name: 'light vibrant cyan blue, 60% transparent',
      }),
    ).toBeOnTheScreen()
  })

  it('calls a colour with no alpha left transparent, in the locale’s words', async () => {
    const { rerender } = await render(<ColorSwatch color="#00000000" />)

    expect(screen.getByRole('img', { name: 'transparent' })).toBeOnTheScreen()

    await rerender(
      <I18nProvider locale="pt-BR">
        <ColorSwatch color="#00000000" />
      </I18nProvider>,
    )

    expect(screen.getByRole('img', { name: 'transparente' })).toBeOnTheScreen()
  })

  it('names the colour in the provider’s locale', async () => {
    await render(
      <I18nProvider locale="pt-BR">
        <ColorSwatch color={OPAQUE} />
        <ColorSwatch color={TRANSLUCENT} />
      </I18nProvider>,
    )

    expect(screen.getByRole('img', { name: 'escuro roxo' })).toBeOnTheScreen()
    expect(
      screen.getByRole('img', {
        name: 'claro vibrante azul-ciano, 60% transparente',
      }),
    ).toBeOnTheScreen()
  })

  it('takes colorName in place of the colour’s own name, and an aria-label after either', async () => {
    const { rerender } = await render(
      <ColorSwatch color={OPAQUE} colorName="Brand" />,
    )

    expect(screen.getByRole('img', { name: 'Brand' })).toBeOnTheScreen()

    await rerender(<ColorSwatch aria-label="Label" color={OPAQUE} />)

    expect(
      screen.getByRole('img', { name: 'dark purple, Label' }),
    ).toBeOnTheScreen()

    await rerender(
      <ColorSwatch aria-label="Label" color="#00000000" colorName="Brand" />,
    )

    expect(screen.getByRole('img', { name: 'Brand, Label' })).toBeOnTheScreen()
  })

  it('fills the square with the colour, from a string or a Color', async () => {
    const { rerender } = await render(<ColorSwatch color={TRANSLUCENT} />)

    expect(styleOf(fill() ?? swatch())).toEqual({
      ...ABSOLUTE_FILL,
      backgroundColor: 'hsla(200, 100%, 50%, 0.4)',
    })

    const color = parseColor('hsb(260, 51%, 64%)')

    await rerender(<ColorSwatch color={color} />)

    expect(styleOf(fill() ?? swatch()).backgroundColor).toBe(
      color.toString('css'),
    )
    expect(screen.getByRole('img', { name: 'dark purple' })).toBeOnTheScreen()
  })

  it('is transparent white when given no colour', async () => {
    await render(<ColorSwatch />)

    expect(screen.getByRole('img', { name: 'transparent' })).toBeOnTheScreen()
    expect(styleOf(fill() ?? swatch()).backgroundColor).toBe(
      'rgba(255, 255, 255, 0)',
    )
  })

  it('draws the chequer only behind a colour with some transparency', async () => {
    const { rerender } = await render(<ColorSwatch color={OPAQUE} />)

    expect(
      swatch().queryAll((each) => each.type.startsWith('RNSVGSvgView')),
    ).toHaveLength(0)
    expect(layers()).toHaveLength(2)

    await rerender(<ColorSwatch color="rgba(103, 80, 164, 0.99)" />)

    expect(layers()).toHaveLength(3)

    await rerender(<ColorSwatch color={TRANSLUCENT} />)

    const [chequer] = layers()

    // Behind the colour, filling the square, and hidden from screen readers.
    expect(chequer.type.startsWith('RNSVGSvgView')).toBe(true)
    expect(styleOf(chequer)).toMatchObject(ABSOLUTE_FILL)
    expect(chequer.props).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    })
    expect(layers()).toHaveLength(3)
  })

  it('draws the chequer as 8dp squares of the theme’s two outer surface containers', async () => {
    await render(<ColorSwatch color={TRANSLUCENT} />)

    const [pattern] = swatch().queryAll((each) => each.type === 'RNSVGPattern')

    // A 16dp tile measured in the swatch's own units.
    expect(pattern.props).toMatchObject({
      height: 16,
      patternUnits: 1,
      width: 16,
    })

    const [ground, first, second] = rects(pattern)

    expect(fillOf(ground).payload).toBe(
      processColor(colors.surfaceContainerLowest),
    )
    expect(ground.props).toMatchObject({ height: 16, width: 16 })

    for (const square of [first, second]) {
      expect(fillOf(square).payload).toBe(
        processColor(colors.surfaceContainerHighest),
      )
      expect(square.props).toMatchObject({ height: 8, width: 8 })
    }

    expect(first.props).toMatchObject({ x: 0, y: 0 })
    expect(second.props).toMatchObject({ x: 8, y: 8 })

    const painted = rects(swatch()).filter(
      (rect) => !rects(pattern).includes(rect),
    )

    expect(painted).toHaveLength(1)
    expect(painted[0].props).toMatchObject({ height: '100%', width: '100%' })
    expect(fillOf(painted[0]).brushRef).toBe(nameOf(pattern))
  })

  it('gives each chequer a pattern of its own', async () => {
    await render(
      <>
        <ColorSwatch color={TRANSLUCENT} />
        <ColorSwatch color={TRANSLUCENT} />
      </>,
    )

    const names = screen
      .getAllByRole('img')
      .map((each) => nameOf(patternOf(each)))

    expect(new Set(names).size).toBe(2)

    for (const [index, each] of screen.getAllByRole('img').entries()) {
      const painted = rects(each).at(-1)

      expect(painted && fillOf(painted).brushRef).toBe(names[index])
    }
  })

  it('outlines the colour with an outline hairline laid over it', async () => {
    await render(<ColorSwatch color={OPAQUE} />)

    expect(layers().at(-1)).toBe(hairline())
    expect(styleOf(hairline() ?? swatch())).toEqual({
      ...ABSOLUTE_FILL,
      borderColor: colors.outline,
      borderRadius: radii.xs,
      borderWidth: 1,
    })
  })

  // A white swatch's edge is what carries its value on a light surface, so it
  // is a boundary that has to read, which WCAG 1.4.11 puts at 3:1 against
  // what is beside it. Material Design gives that kind of boundary the
  // outline role and keeps outline variant for decoration.
  it.each(['light', 'dark'] as const)(
    'edges a white swatch at 3:1 on the %s surface',
    async (scheme) => {
      const { outline, surface } = scopeFor(scheme, {}).theme.colors

      await render(
        <ThemeScope scheme={scheme}>
          <ColorSwatch color="#ffffff" />
        </ThemeScope>,
      )

      const edge = styleOf(hairline() ?? swatch()).borderColor

      expect(edge).toBe(outline)
      expect(contrastOf(String(edge), surface)).toBeGreaterThanOrEqual(3)
    },
  )

  it('is a 40dp square on the extra-small corner, which a style resizes', async () => {
    const { rerender } = await render(<ColorSwatch color={OPAQUE} />)

    expect(styleOf(swatch())).toEqual({
      borderRadius: radii.xs,
      height: 40,
      overflow: 'hidden',
      width: 40,
    })

    await rerender(<ColorSwatch color={OPAQUE} style={LARGE} />)

    expect(styleOf(swatch())).toMatchObject(LARGE)
  })

  it('hands its ref and testID to the square', async () => {
    const ref = createRef<ComponentRef<typeof View>>()

    await render(<ColorSwatch color={OPAQUE} ref={ref} testID="swatch" />)

    expect(screen.getByTestId('swatch')).toBe(swatch())
    expect(ref.current).toBeInstanceOf(View)
  })
})
