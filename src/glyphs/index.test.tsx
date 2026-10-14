import type { StyleProp, ViewStyle } from 'react-native'
import type { JsonElement } from 'test-renderer'

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react-native'
import { I18nManager, StyleSheet, Text } from 'react-native'

import * as glyphs from '.'
import { IconStyleContext, useIconStyle } from './icon-style'

// kanso-ui's paths, copied here rather than read from the source under test,
// so a path changed by accident fails the case for its glyph.
const PATHS: Record<keyof typeof glyphs, string> = {
  ArrowBackGlyph:
    'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  ArrowDownwardGlyph:
    'M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z',
  ArrowDropDownGlyph: 'M7 10l5 5 5-5z',
  ArrowUpwardGlyph:
    'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z',
  CalendarGlyph:
    'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z',
  CheckGlyph: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  ChevronDownGlyph: 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z',
  ChevronEndGlyph: 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  ClockGlyph:
    'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  CloseGlyph:
    'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  IndeterminateGlyph: 'M19 13H5v-2h14v2z',
  KeyboardGlyph:
    'M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 12H4V7h16v10zm-9-9h2v2h-2zm0 3h2v2h-2zM8 8h2v2H8zm0 3h2v2H8zm-3 0h2v2H5zm0-3h2v2H5zm3 6h8v2H8zm6-3h2v2h-2zm0-3h2v2h-2zm3 3h2v2h-2zm0-3h2v2h-2z',
  MinusGlyph: 'M19 13H5v-2h14v2z',
  PersonGlyph:
    'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  PlusGlyph: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  SearchGlyph:
    'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
}

// The two that say "back" and "further in" rather than "left" and "right".
const MIRRORED = new Set<string>(['ArrowBackGlyph', 'ChevronEndGlyph'])

const PATH_OF = new Map<string, string>(Object.entries(PATHS))

const CASES = Object.entries(glyphs).map(([name, Glyph]) => ({ Glyph, name }))

// A slot's colour and size, and a second pair a call site overrides them with.
const SLOT = { color: '#6750a4', size: 18 }
const OWN = { color: '#b3261e', size: 20 }

// Testing Library leaves out what a screen reader cannot reach, which is every
// glyph, so a case reading one asks for hidden elements too.
function hidden(testID: string) {
  return screen.getByTestId(testID, { includeHiddenElements: true })
}

function pathsIn(node: JsonElement): unknown[] {
  const d: unknown = node.props.d
  return [
    ...(node.type === 'RNSVGPath' ? [d] : []),
    ...node.children.flatMap((child) =>
      typeof child === 'string' ? [] : pathsIn(child),
    ),
  ]
}

// An icon of the app's own, standing in for one another library draws, which
// writes out what it was handed.
function Probe() {
  const { color, size } = useIconStyle()
  return <Text testID="icon">{`${String(color)} ${String(size)}`}</Text>
}

function transformOf(element: { props: { style?: StyleProp<ViewStyle> } }) {
  return StyleSheet.flatten(element.props.style)?.transform
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('glyphs', () => {
  it('draws exactly the glyphs it has a path for', () => {
    expect(Object.keys(glyphs).toSorted()).toEqual(
      Object.keys(PATHS).toSorted(),
    )
  })

  it.each(CASES)('draws $name on the 24-unit grid', async ({ Glyph, name }) => {
    await render(<Glyph testID="glyph" />)
    const tree = screen.toJSON()
    if (tree === null) {
      throw new Error('expected the glyph to render an svg')
    }

    expect(pathsIn(tree)).toEqual([PATH_OF.get(name)])
    expect(hidden('glyph').props).toMatchObject({ vbHeight: 24, vbWidth: 24 })
  })

  // The control around a glyph carries the name, so the glyph says nothing:
  // `accessibilityElementsHidden` hides it from VoiceOver and
  // `importantForAccessibility` from TalkBack.
  it.each(CASES)('hides $name from screen readers', async ({ Glyph }) => {
    await render(<Glyph testID="glyph" />)

    expect(hidden('glyph').props).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    })
    expect(screen.queryByTestId('glyph')).toBeNull()
  })

  it('draws at 24dp in no colour of its own outside a slot', async () => {
    await render(<glyphs.CheckGlyph testID="glyph" />)

    expect(hidden('glyph').props).toMatchObject({
      color: undefined,
      fill: 'currentColor',
      height: 24,
      width: 24,
    })
  })

  it('takes its colour and size from the slot it sits in', async () => {
    await render(
      <IconStyleContext value={SLOT}>
        <glyphs.CheckGlyph testID="glyph" />
      </IconStyleContext>,
    )

    expect(hidden('glyph').props).toMatchObject({
      color: SLOT.color,
      fill: 'currentColor',
      height: SLOT.size,
      width: SLOT.size,
    })
  })

  it('takes its own colour and size over the slot', async () => {
    await render(
      <IconStyleContext value={SLOT}>
        <glyphs.CheckGlyph color={OWN.color} size={OWN.size} testID="glyph" />
      </IconStyleContext>,
    )

    expect(hidden('glyph').props).toMatchObject({
      color: OWN.color,
      height: OWN.size,
      width: OWN.size,
    })
  })

  it.each(CASES)('keeps $name unturned left to right', async ({ Glyph }) => {
    jest.replaceProperty(I18nManager, 'isRTL', false)
    await render(<Glyph testID="glyph" />)

    expect(transformOf(hidden('glyph'))).toBeUndefined()
  })

  it.each(CASES)(
    'turns $name over right to left only if it points onward or back',
    async ({ Glyph, name }) => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(<Glyph testID="glyph" />)

      expect(transformOf(hidden('glyph'))).toEqual(
        MIRRORED.has(name) ? [{ scaleX: -1 }] : undefined,
      )
    },
  )
})

describe('useIconStyle', () => {
  it('hands an icon of the app’s own the slot’s colour and size', async () => {
    await render(
      <IconStyleContext value={SLOT}>
        <Probe />
      </IconStyleContext>,
    )

    expect(screen.getByTestId('icon')).toHaveTextContent('#6750a4 18')
  })

  it('hands 24dp and no colour outside a slot', async () => {
    await render(<Probe />)

    expect(screen.getByTestId('icon')).toHaveTextContent('undefined 24')
  })
})
