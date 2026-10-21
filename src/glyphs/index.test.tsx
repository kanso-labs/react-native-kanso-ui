import type { StyleProp, ViewStyle } from 'react-native'
import type { JsonElement } from 'test-renderer'

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import {
  arrowBackPath,
  arrowDownwardPath,
  arrowDropDownPath,
  arrowUpwardPath,
  calendarPath,
  checkPath,
  chevronDownPath,
  chevronEndPath,
  clockPath,
  closePath,
  keyboardPath,
  minusPath,
  personPath,
  plusPath,
  searchPath,
} from '@kanso-labs/kanso-ui-core/glyphs'
import { render, screen } from '@testing-library/react-native'
import { I18nManager, StyleSheet, Text } from 'react-native'

import * as glyphs from '.'
import { IconStyleContext, useIconStyle } from './icon-style'

// The paths @kanso-labs/kanso-ui-core publishes, read from the package rather
// than from the source under test, so a glyph drawing any other path fails its
// case.
const PATHS: Record<keyof typeof glyphs, string> = {
  ArrowBackGlyph: arrowBackPath,
  ArrowDownwardGlyph: arrowDownwardPath,
  ArrowDropDownGlyph: arrowDropDownPath,
  ArrowUpwardGlyph: arrowUpwardPath,
  CalendarGlyph: calendarPath,
  CheckGlyph: checkPath,
  ChevronDownGlyph: chevronDownPath,
  ChevronEndGlyph: chevronEndPath,
  ClockGlyph: clockPath,
  CloseGlyph: closePath,
  IndeterminateGlyph: minusPath,
  KeyboardGlyph: keyboardPath,
  MinusGlyph: minusPath,
  PersonGlyph: personPath,
  PlusGlyph: plusPath,
  SearchGlyph: searchPath,
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
