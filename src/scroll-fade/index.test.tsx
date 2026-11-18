import type { StyleProp, ViewStyle } from 'react-native'
import type { TestInstance } from 'test-renderer'

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { act, render, renderHook, screen } from '@testing-library/react-native'
import { I18nManager, Platform, StyleSheet, View } from 'react-native'

import type { ScrollEdges } from '.'

import { edgesOf, ScrollFade, useScrollEdges, useScrollFadeProps } from '.'
import { ThemeScope } from '../theme-scope'
import { scopeFor } from '../theme/scope'

const { theme } = scopeFor('light', {})
const { colors, spacing } = theme

const BOTH: ScrollEdges = { end: true, start: true }

// What a gradient stop's colour comes to, from the integer svg packs it in.
function decode(value: number) {
  const packed = value >>> 0
  return {
    alpha: Math.round(((packed >>> 24) / 255) * 100) / 100,
    rgb: `rgb(${(packed >>> 16) & 255}, ${(packed >>> 8) & 255}, ${packed & 255})`,
  }
}

// The view a gradient is laid over its edge in: the nearest one up from it
// placed at an edge.
function fadeBoxOf(gradient: TestInstance): TestInstance {
  let node: null | TestInstance = gradient.parent
  while (node !== null) {
    const style = styleOf(node)
    if ('start' in style || 'end' in style) {
      return node
    }
    node = node.parent
  }
  throw new TypeError('expected the gradient inside an edge’s view')
}

// Each fade drawn, by the edge it is laid over, with the way its gradient
// runs and the colours at either end of it.
function fades() {
  return screen
    .getByTestId('box')
    .queryAll((each) => each.type === 'RNSVGLinearGradient')
    .map((gradient) => {
      const box = fadeBoxOf(gradient)
      const style = styleOf(box)
      const packed: unknown = gradient.props.gradient
      const stops = Array.isArray(packed)
        ? packed
            .filter((_, index) => index % 2 === 1)
            .map(Number)
            .map(decode)
        : []
      return {
        edge: 'start' in style ? 'start' : 'end',
        stops,
        width: style.width,
        x1: Number(gradient.props.x1),
        x2: Number(gradient.props.x2),
      }
    })
}

async function renderFade(edges: ScrollEdges) {
  await render(
    <ThemeScope scheme="light">
      <View testID="box">
        <ScrollFade color={colors.surfaceContainer} edges={edges} />
      </View>
    </ThemeScope>,
  )
}

// The colour a token names, as svg's packed stop reads it back.
function rgbOf(color: string) {
  const view = /^#(?<hex>[\da-f]{6})$/iu.exec(color)?.groups?.hex
  if (view === undefined) {
    throw new TypeError(`expected a six-digit colour, got ${color}`)
  }
  const value = Number.parseInt(view, 16)
  return `rgb(${(value >>> 16) & 255}, ${(value >>> 8) & 255}, ${value & 255})`
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('edgesOf', () => {
  it('fades the end of a box scrolled to its start, with more past its end', () => {
    expect(edgesOf(0, 200, 360, false)).toEqual({ end: true, start: false })
  })

  it('fades both edges of a box scrolled part of the way', () => {
    expect(edgesOf(80, 200, 360, false)).toEqual(BOTH)
  })

  it('fades the start of a box scrolled to its end', () => {
    expect(edgesOf(160, 200, 360, false)).toEqual({ end: false, start: true })
  })

  it('takes a box a pixel short of either end as there', () => {
    expect(edgesOf(0.5, 200, 360, false)).toEqual({ end: true, start: false })
    expect(edgesOf(159.5, 200, 360, false)).toEqual({
      end: false,
      start: true,
    })
  })

  it('fades neither edge of a box whose content fits, or that has no size yet', () => {
    expect(edgesOf(0, 400, 360, false)).toEqual({ end: false, start: false })
    expect(edgesOf(0, 0, 360, false)).toEqual({ end: false, start: false })
  })

  // React Native measures the offset from the left edge in either direction,
  // so a right-to-left box opens scrolled to the far end.
  it('reads the offset from the far end in a right-to-left layout', () => {
    expect(edgesOf(160, 200, 360, true)).toEqual({ end: true, start: false })
    expect(edgesOf(0, 200, 360, true)).toEqual({ end: false, start: true })
  })
})

describe('useScrollEdges', () => {
  it('follows the scroll view’s reports', async () => {
    const { result } = await renderHook(() => useScrollEdges())

    expect(result.current.edges).toEqual({ end: false, start: false })

    await act(() => {
      result.current.onViewport(200)
      result.current.onContentSize(360)
    })
    expect(result.current.edges).toEqual({ end: true, start: false })

    await act(() => {
      result.current.onScrolled(160)
    })
    expect(result.current.edges).toEqual({ end: false, start: true })
  })

  it('keeps the same edges while a scroll changes neither', async () => {
    const { result } = await renderHook(() => useScrollEdges())
    await act(() => {
      result.current.onViewport(200)
      result.current.onContentSize(360)
      result.current.onScrolled(40)
    })
    const before = result.current.edges

    await act(() => {
      result.current.onScrolled(80)
    })

    expect(result.current.edges).toBe(before)
  })
})

describe('ScrollFade', () => {
  it('lays a gradient from the container’s colour to nothing over each edge with content past it', async () => {
    await renderFade(BOTH)

    const transparent = { alpha: 0, rgb: rgbOf(colors.surfaceContainer) }
    const opaque = { alpha: 1, rgb: rgbOf(colors.surfaceContainer) }
    expect(fades()).toEqual([
      {
        edge: 'start',
        stops: [opaque, transparent],
        width: spacing.xxl,
        x1: 0,
        x2: 1,
      },
      {
        edge: 'end',
        stops: [opaque, transparent],
        width: spacing.xxl,
        x1: 1,
        x2: 0,
      },
    ])
  })

  it('draws nothing at an edge with nothing past it', async () => {
    await renderFade({ end: true, start: false })

    expect(fades().map(({ edge }) => edge)).toEqual(['end'])
  })

  it('runs the start fade from the right edge in a right-to-left layout', async () => {
    jest.replaceProperty(I18nManager, 'isRTL', true)
    await renderFade(BOTH)

    expect(fades().map(({ edge, x1, x2 }) => ({ edge, x1, x2 }))).toEqual([
      { edge: 'start', x1: 1, x2: 0 },
      { edge: 'end', x1: 0, x2: 1 },
    ])
  })

  // React Native Web's `I18nManager` has no `isRTL`, which read as it is
  // turned the end fade round there.
  it('runs the end fade from the right edge where the direction is not known, as on the web', async () => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the type says boolean, which React Native Web's I18nManager is not
    jest.replaceProperty(I18nManager, 'isRTL', undefined as unknown as boolean)
    await renderFade(BOTH)

    expect(fades().map(({ edge, x1, x2 }) => ({ edge, x1, x2 }))).toEqual([
      { edge: 'start', x1: 0, x2: 1 },
      { edge: 'end', x1: 1, x2: 0 },
    ])
  })

  it('leaves the fade to the scroll view on Android', async () => {
    jest.replaceProperty(Platform, 'OS', 'android')
    await renderFade(BOTH)

    expect(fades()).toEqual([])
  })

  it('stays out of the way of a press and of a screen reader', async () => {
    await renderFade({ end: true, start: false })

    const gradient = screen
      .getByTestId('box')
      .queryAll((each) => each.type === 'RNSVGLinearGradient')
      .at(0)
    if (gradient === undefined) {
      throw new TypeError('expected a fade')
    }
    const box = fadeBoxOf(gradient)
    expect(styleOf(box)).toMatchObject({
      pointerEvents: 'none',
    })
    const svg = box.queryAll((each) => each.type === 'RNSVGSvgView').at(0)
    expect(svg?.props.importantForAccessibility).toBe('no-hide-descendants')
  })
})

describe('useScrollFadeProps', () => {
  it('fades the scroll view’s own edges by the fade’s length on Android', async () => {
    jest.replaceProperty(Platform, 'OS', 'android')
    const { result } = await renderHook(() => useScrollFadeProps())

    expect(result.current).toEqual({ fadingEdgeLength: spacing.xxl })
  })

  it('hands the scroll view nothing elsewhere', async () => {
    const { result } = await renderHook(() => useScrollFadeProps())

    expect(result.current).toEqual({})
  })
})
