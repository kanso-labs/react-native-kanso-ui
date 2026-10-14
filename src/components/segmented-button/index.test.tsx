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
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { createRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { SegmentedButtonProps } from '.'
import type { Key } from '../..'

import { SegmentedButton } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

// What the next set the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

const { theme } = scopeFor('light', {})
const { colors, motion, radii, sizing, spacing, stateLayerOpacity } = theme

const DISABLED_CONTAINER = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContainer,
)
const DISABLED_CONTENT = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContent,
)

// The page's 18dp slot, and the room a segment keeps for it: the slot and
// the gap after it. The padding a squeezed segment gives back first.
const GLYPH = 18
const RESERVE = GLYPH + spacing.sm
const GIVE = spacing.md - spacing.sm

// kanso-ui's path, copied rather than read from the glyph under test.
const CHECK = 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'

const FIRST = ['first']
const SECOND = ['second']
const NONE: string[] = []
const CALL_SITE = { marginTop: 4 }
const HIT_SLOP = { bottom: 8, left: 8, right: 8, top: 8 }
const MISSING = ['missing']

// The widths the three sample labels measure at, the second the widest.
const LABELS = [60, 80, 70]
const NAMES = ['First item', 'Second item', 'Third item']

// A press with no point on the page, on a control that measures nothing, so
// the ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
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

// A set whose choice the call site holds, as a controlled one is held.
function Controlled() {
  const [keys, setKeys] = useState<Iterable<Key>>(FIRST)
  return <Segments onSelectionChange={setKeys} selectedKeys={keys} />
}

// The fill a segment draws inside its rule: its own chosen container in a set
// that chooses several, and in a set that chooses one, the stand-in for the
// track's until the choice first moves.
function fillOf(name: string) {
  return child(segment(name).children.at(0))
}

// Runs the next frame, which is when an animated style takes a value set
// without an ease.
async function frame() {
  await advance(0)
}

// The glyph a segment draws in its slot, as the path it draws or the probe's
// text, or undefined where it keeps no slot.
function glyphOf(name: string) {
  const slot = slotOf(name)
  if (slot === undefined) {
    return undefined
  }
  const drawn = child(slot.children.at(0)).children.at(0)
  if (drawn === undefined) {
    return undefined
  }
  const glyph = child(drawn)
  const paths = pathsIn(glyph)
  const text: unknown = glyph.props.children
  return paths.length > 0 ? paths.at(0) : text
}

// The set, which is the element rendered. A container is never an
// accessibility element of its own, since iOS would then read it as one and
// hide its segments, so it is not one Testing Library finds by role.
function group() {
  const root = screen.root
  if (root?.props.role !== 'radiogroup' && root?.props.role !== 'toolbar') {
    throw new TypeError('expected the set')
  }
  return root
}

// An icon of the app's own, which writes the colour and size its slot hands
// it, as `colour size`.
function IconProbe() {
  const { color, size } = useIconStyle()

  return <Text testID="icon">{`${String(color)} ${String(size)}`}</Text>
}

// Hoisted so it is one stable element per render, which is what react-perf's
// no-jsx-as-prop is after.
const ICON = <IconProbe />

// The view the chosen container is drawn in.
function clip() {
  return child(group().children.at(0))
}

// The gap after the glyph slot.
function gapOf(name: string) {
  return child(partsOf(name).leading.children.at(1))
}

// The chosen container of a set that chooses one.
function indicator() {
  return child(clip().children.at(0))
}

// A label's colour, once the ease has run.
async function labelColor(name: string) {
  await advance(motion.durationShort2)
  const style = getAnimatedStyle(partsOf(name).label)
  return same('color' in style ? style.color : undefined)
}

async function layOut(
  element: TestInstance,
  layout: { height?: number; width: number; x?: number },
) {
  await fireEvent(element, 'layout', {
    nativeEvent: { layout: { height: 40, x: 0, y: 0, ...layout } },
  })
  await frame()
}

// Lays every segment out side by side at the given width, and the chosen
// container at the start of the track.
async function layOutAll(width: number) {
  await layOutSegments(width)
  await layOut(indicator(), { width, x: 0 })
}

// Lays the three segments out side by side at the given width.
async function layOutSegments(width: number) {
  await layOut(segment('First item'), { width, x: 0 })
  await layOut(segment('Second item'), { width, x: width })
  await layOut(segment('Third item'), { width, x: width * 2 })
}

// Measures the labels at the given widths, in order, leaving any not given
// unmeasured.
async function measure(widths: readonly number[] = LABELS) {
  const texts = measurer().children
  const [first, second, third] = [widths.at(0), widths.at(1), widths.at(2)]
  if (first !== undefined) {
    await layOut(child(texts.at(0)), { width: first })
  }
  if (second !== undefined) {
    await layOut(child(texts.at(1)), { width: second })
  }
  if (third !== undefined) {
    await layOut(child(texts.at(2)), { width: third })
  }
}

// What the set measures its labels with, off screen.
function measurer() {
  return child(group().children.at(-1))
}

// The three parts of a segment after its feedback: the room before its
// label, which holds the slot, its label, and the room after it.
function partsOf(name: string) {
  const parts = segment(name).children.filter(
    (part) =>
      typeof part !== 'string' &&
      part.props.importantForAccessibility !== 'no-hide-descendants',
  )
  const [leading, label, trailing] = parts.slice(-3)
  return {
    label: child(label),
    leading: child(leading),
    trailing: child(trailing),
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

// Records that a handler ran. Built by a call rather than written inline at
// the prop, which is what react-perf's jsx-no-new-function-as-prop is after.
function pushThen(order: string[], name: string) {
  return () => {
    order.push(name)
  }
}

// One spelling of a colour, since Reanimated writes the colours it eases
// through as `rgba()` whatever they were given as.
function same(color: unknown) {
  if (typeof color !== 'string') {
    throw new TypeError('expected a colour')
  }
  return withOpacity(color, 1)
}

// A segment, which is a radio in a set that chooses one and a button in a set
// that chooses several.
function segment(label: string) {
  // An icon probe's text comes before the label in the name.
  const name = new RegExp(`(^| )${label}$`)
  return (
    screen.queryByRole('radio', { name }) ??
    screen.getByRole('button', { name })
  )
}

function Segments(props: Partial<SegmentedButtonProps>) {
  return (
    <SegmentedButton aria-label="Label" {...props}>
      <SegmentedButton.Segment id="first">First item</SegmentedButton.Segment>
      <SegmentedButton.Segment id="second">Second item</SegmentedButton.Segment>
      <SegmentedButton.Segment id="third">Third item</SegmentedButton.Segment>
    </SegmentedButton>
  )
}

// How far the chosen container is moved from where it rests.
function shiftOf() {
  const { transform } = getAnimatedStyle(indicator())
  const moves: readonly unknown[] = Array.isArray(transform) ? transform : []
  const move = moves.at(0)
  return typeof move === 'object' && move !== null && 'translateX' in move
    ? move.translateX
    : undefined
}

// The glyph slot, inside the room before a segment's label.
function slotOf(name: string) {
  const { leading } = partsOf(name)
  return leading.children.length === 0
    ? undefined
    : child(leading.children.at(0))
}

// What a selection reports, as a sorted list, since React Stately's is a Set
// of its own class that a plain Set never equals.
function sorted(keys: Set<Key> | undefined) {
  if (keys === undefined) {
    throw new TypeError('expected a set of keys')
  }
  return [...keys].map(String).toSorted()
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}) {
  return StyleSheet.flatten([element.props.style])
}

// What a segment's state layer and ripple are drawn in, after its fill.
function surfaceOf(name: string) {
  return child(segment(name).children.at(1))
}

// A width, as an animated style holds it once it has eased.
function widthOf(element: TestInstance) {
  const style = getAnimatedStyle(element)
  return 'width' in style ? style.width : undefined
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  mockReducedMotion = false
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('SegmentedButton', () => {
  describe('semantics', () => {
    it('is a radio group of radios named by their labels while one is chosen', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)

      expect(group().props.role).toBe('radiogroup')
      expect(group().props['aria-label']).toBe('Label')
      expect(screen.getAllByRole('radio')).toHaveLength(3)
      expect(screen.getByRole('radio', { name: 'Second item' })).toBeTruthy()
    })

    it('reports which segment is checked', async () => {
      await render(<Segments defaultSelectedKeys={SECOND} />)

      expect(segment('First item')).not.toBeChecked()
      expect(segment('Second item')).toBeChecked()
      expect(segment('Third item')).not.toBeChecked()
    })

    it('is a toolbar of buttons that say whether they are selected while several may be', async () => {
      await render(
        <Segments defaultSelectedKeys={SECOND} selectionMode="multiple" />,
      )

      expect(group().props.role).toBe('toolbar')
      expect(screen.getAllByRole('button')).toHaveLength(3)
      expect(screen.queryAllByRole('radio')).toHaveLength(0)
      expect(segment('First item')).not.toBeSelected()
      expect(segment('Second item')).toBeSelected()
    })

    it('takes aria-labelledby in place of a label', async () => {
      await render(
        <SegmentedButton aria-labelledby="heading">
          <SegmentedButton.Segment id="first">
            First item
          </SegmentedButton.Segment>
        </SegmentedButton>,
      )

      expect(group().props['aria-labelledby']).toBe('heading')
    })

    it('names a segment with no label by its aria-label', async () => {
      await render(
        <SegmentedButton aria-label="Label">
          <SegmentedButton.Segment
            aria-label="First item"
            icon={ICON}
            id="first"
          />
        </SegmentedButton>,
      )

      expect(screen.getByRole('radio', { name: 'First item' })).toBeTruthy()
    })

    it('disables every segment when the set is disabled', async () => {
      await render(<Segments isDisabled />)

      for (const name of NAMES) {
        expect(segment(name)).toBeDisabled()
      }
    })

    it('disables a segment given isDisabled alone', async () => {
      await render(
        <SegmentedButton aria-label="Label">
          <SegmentedButton.Segment id="first">
            First item
          </SegmentedButton.Segment>
          <SegmentedButton.Segment id="second" isDisabled>
            Second item
          </SegmentedButton.Segment>
        </SegmentedButton>,
      )

      expect(segment('First item')).toBeEnabled()
      expect(segment('Second item')).toBeDisabled()
    })

    it('hides the labels it measures from a screen reader', async () => {
      await render(<Segments />)

      expect(measurer().props['aria-hidden']).toBe(true)
      expect(screen.getAllByText('First item')).toHaveLength(1)
    })

    it('renders nothing for a segment outside a set', async () => {
      await render(
        <View testID="outside">
          <SegmentedButton.Segment id="first">
            First item
          </SegmentedButton.Segment>
        </View>,
      )

      expect(screen.getByTestId('outside').children).toHaveLength(0)
    })
  })

  describe('selection', () => {
    it('chooses one at a time', async () => {
      const onSelectionChange = jest.fn<(keys: Set<Key>) => void>()
      await render(
        <Segments
          defaultSelectedKeys={FIRST}
          onSelectionChange={onSelectionChange}
        />,
      )

      await fireEvent.press(segment('Second item'), PRESS)

      expect(sorted(onSelectionChange.mock.calls.at(-1)?.[0])).toEqual([
        'second',
      ])
      expect(segment('First item')).not.toBeChecked()
      expect(segment('Second item')).toBeChecked()
    })

    it('keeps the chosen segment chosen when it is pressed again', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)

      await fireEvent.press(segment('First item'), PRESS)

      expect(segment('First item')).toBeChecked()
    })

    it('lets a press clear the choice when disallowEmptySelection is off', async () => {
      await render(
        <Segments defaultSelectedKeys={FIRST} disallowEmptySelection={false} />,
      )

      await fireEvent.press(segment('First item'), PRESS)

      expect(segment('First item')).not.toBeChecked()
    })

    it('adds to the choice while several may be chosen, and takes one back', async () => {
      const onSelectionChange = jest.fn<(keys: Set<Key>) => void>()
      await render(
        <Segments
          defaultSelectedKeys={FIRST}
          onSelectionChange={onSelectionChange}
          selectionMode="multiple"
        />,
      )

      await fireEvent.press(segment('Third item'), PRESS)
      expect(sorted(onSelectionChange.mock.calls.at(-1)?.[0])).toEqual([
        'first',
        'third',
      ])

      await fireEvent.press(segment('First item'), PRESS)
      expect(sorted(onSelectionChange.mock.calls.at(-1)?.[0])).toEqual([
        'third',
      ])

      await fireEvent.press(segment('Third item'), PRESS)
      expect(sorted(onSelectionChange.mock.calls.at(-1)?.[0])).toEqual([])
    })

    it('keeps the last one chosen while several may be, when told to', async () => {
      await render(
        <Segments
          defaultSelectedKeys={FIRST}
          disallowEmptySelection
          selectionMode="multiple"
        />,
      )

      await fireEvent.press(segment('First item'), PRESS)

      expect(segment('First item')).toBeSelected()
    })

    it('follows selectedKeys and reports a press without moving', async () => {
      const onSelectionChange = jest.fn<(keys: Set<Key>) => void>()
      await render(
        <Segments onSelectionChange={onSelectionChange} selectedKeys={FIRST} />,
      )

      await fireEvent.press(segment('Second item'), PRESS)

      expect(sorted(onSelectionChange.mock.calls.at(-1)?.[0])).toEqual([
        'second',
      ])
      expect(segment('First item')).toBeChecked()
      expect(segment('Second item')).not.toBeChecked()
    })

    it('moves when the call site moves selectedKeys', async () => {
      await render(<Controlled />)

      await fireEvent.press(segment('Third item'), PRESS)

      expect(segment('Third item')).toBeChecked()
      expect(segment('First item')).not.toBeChecked()
    })

    it('takes no press while the set is disabled', async () => {
      const onSelectionChange = jest.fn()
      await render(
        <Segments
          defaultSelectedKeys={FIRST}
          isDisabled
          onSelectionChange={onSelectionChange}
        />,
      )

      await fireEvent.press(segment('Second item'), PRESS)

      expect(onSelectionChange).not.toHaveBeenCalled()
      expect(segment('First item')).toBeChecked()
    })

    it('takes no press on a disabled segment', async () => {
      const onSelectionChange = jest.fn()
      await render(
        <SegmentedButton
          aria-label="Label"
          defaultSelectedKeys={FIRST}
          onSelectionChange={onSelectionChange}
        >
          <SegmentedButton.Segment id="first">
            First item
          </SegmentedButton.Segment>
          <SegmentedButton.Segment id="second" isDisabled>
            Second item
          </SegmentedButton.Segment>
        </SegmentedButton>,
      )

      await fireEvent.press(segment('Second item'), PRESS)

      expect(onSelectionChange).not.toHaveBeenCalled()
    })

    it("calls the segment's own onPress before it chooses it", async () => {
      const order: string[] = []
      await render(
        <SegmentedButton
          aria-label="Label"
          defaultSelectedKeys={FIRST}
          onSelectionChange={pushThen(order, 'selection')}
        >
          <SegmentedButton.Segment id="first">
            First item
          </SegmentedButton.Segment>
          <SegmentedButton.Segment
            id="second"
            onPress={pushThen(order, 'press')}
          >
            Second item
          </SegmentedButton.Segment>
        </SegmentedButton>,
      )

      await fireEvent.press(segment('Second item'), PRESS)

      expect(order).toEqual(['press', 'selection'])
    })

    it('takes segments from inside a fragment, and nothing else', async () => {
      await render(
        <SegmentedButton aria-label="Label" defaultSelectedKeys={SECOND}>
          <>
            <SegmentedButton.Segment id="first">
              First item
            </SegmentedButton.Segment>
            <SegmentedButton.Segment id="second">
              Second item
            </SegmentedButton.Segment>
          </>
          {null}
          {false}
          Stray text
        </SegmentedButton>,
      )

      expect(screen.getAllByRole('radio')).toHaveLength(2)
      expect(segment('Second item')).toBeChecked()
      expect(screen.queryByText('Stray text')).toBeNull()
      // Each is a segment of its own: measured, and placed second.
      expect(measurer().children).toHaveLength(2)
      expect(styleOf(segment('Second item'))).toMatchObject({
        borderStartWidth: 0,
        borderTopEndRadius: radii.pill,
      })
    })
  })

  describe('the check', () => {
    it('draws the check before the chosen label, in place of its icon', async () => {
      await render(
        <SegmentedButton aria-label="Label" defaultSelectedKeys={FIRST}>
          <SegmentedButton.Segment icon={ICON} id="first">
            First item
          </SegmentedButton.Segment>
          <SegmentedButton.Segment icon={ICON} id="second">
            Second item
          </SegmentedButton.Segment>
        </SegmentedButton>,
      )

      expect(glyphOf('First item')).toBe(CHECK)
      expect(glyphOf('Second item')).toBe(
        `${colors.onSurface} ${String(GLYPH)}`,
      )
    })

    it('moves the check with the choice', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)

      await fireEvent.press(segment('Third item'), PRESS)

      expect(glyphOf('First item')).toBeUndefined()
      expect(glyphOf('Third item')).toBe(CHECK)
    })

    it('keeps the icon of a chosen segment when the check is off', async () => {
      await render(
        <SegmentedButton
          aria-label="Label"
          defaultSelectedKeys={FIRST}
          showSelectedIcon={false}
        >
          <SegmentedButton.Segment icon={ICON} id="first">
            First item
          </SegmentedButton.Segment>
        </SegmentedButton>,
      )

      expect(glyphOf('First item')).toBe(
        `${colors.onSecondary} ${String(GLYPH)}`,
      )
    })

    it('keeps no slot at all where nothing could be drawn', async () => {
      await render(
        <Segments defaultSelectedKeys={FIRST} showSelectedIcon={false} />,
      )

      expect(slotOf('First item')).toBeUndefined()
      expect(partsOf('First item').leading.children).toHaveLength(0)
    })

    it('keeps the icon of a chosen segment with no label', async () => {
      await render(
        <SegmentedButton aria-label="Label" defaultSelectedKeys={FIRST}>
          <SegmentedButton.Segment
            aria-label="First item"
            icon={ICON}
            id="first"
          />
        </SegmentedButton>,
      )

      const leading = child(segment('First item').children.at(2))
      const probe = child(
        child(child(leading.children.at(0)).children.at(0)).children.at(0),
      )
      expect(probe.props.children).toBe(
        `${colors.onSecondary} ${String(GLYPH)}`,
      )
    })

    it.each([false, ''])(
      'takes %p from a condition for no label, and keeps the icon',
      async (label) => {
        await render(
          <SegmentedButton aria-label="Label" defaultSelectedKeys={FIRST}>
            <SegmentedButton.Segment
              aria-label="First item"
              icon={ICON}
              id="first"
            >
              {label}
            </SegmentedButton.Segment>
          </SegmentedButton>,
        )

        expect(measurer().children).toHaveLength(0)
        expect(screen.getByTestId('icon')).toHaveTextContent(
          `${colors.onSecondary} ${String(GLYPH)}`,
        )
      },
    )

    it('keeps no slot in a segment with neither a label nor an icon', async () => {
      await render(
        <SegmentedButton aria-label="Label" defaultSelectedKeys={FIRST}>
          <SegmentedButton.Segment aria-label="First item" id="first" />
        </SegmentedButton>,
      )

      const leading = child(segment('First item').children.at(2))
      expect(leading.children).toHaveLength(0)
    })

    it('hands the icon the label colour at 18dp', async () => {
      await render(
        <SegmentedButton aria-label="Label" defaultSelectedKeys={NONE}>
          <SegmentedButton.Segment icon={ICON} id="first">
            First item
          </SegmentedButton.Segment>
        </SegmentedButton>,
      )

      expect(screen.getByTestId('icon')).toHaveTextContent(
        `${colors.onSurface} 18`,
      )
    })
  })

  describe('colours', () => {
    it('draws a label on surface, and the chosen one on the secondary container', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)

      expect(await labelColor('First item')).toBe(
        same(colors.onSecondaryContainer),
      )
      expect(await labelColor('Second item')).toBe(same(colors.onSurface))
    })

    it('draws the chosen label on secondary where no check marks it', async () => {
      await render(
        <Segments defaultSelectedKeys={FIRST} showSelectedIcon={false} />,
      )

      expect(await labelColor('First item')).toBe(same(colors.onSecondary))
    })

    it('eases the label to its new colour', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)
      await fireEvent.press(segment('Second item'), PRESS)

      await advance(motion.durationShort2 / 2)
      const style = getAnimatedStyle(partsOf('Second item').label)
      expect(same('color' in style ? style.color : undefined)).not.toBe(
        same(colors.onSecondaryContainer),
      )
      expect(await labelColor('Second item')).toBe(
        same(colors.onSecondaryContainer),
      )
    })

    it('draws a disabled label on surface at the disabled opacity', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} isDisabled />)

      expect(await labelColor('First item')).toBe(same(DISABLED_CONTENT))
      expect(await labelColor('Second item')).toBe(same(DISABLED_CONTENT))
    })

    it('draws the rule in outline, and a disabled one on surface at the disabled opacity', async () => {
      await render(
        <SegmentedButton aria-label="Label">
          <SegmentedButton.Segment id="first">
            First item
          </SegmentedButton.Segment>
          <SegmentedButton.Segment id="second" isDisabled>
            Second item
          </SegmentedButton.Segment>
        </SegmentedButton>,
      )

      expect(styleOf(segment('First item')).borderColor).toBe(colors.outline)
      expect(styleOf(segment('Second item')).borderColor).toBe(
        DISABLED_CONTAINER,
      )
    })

    it('draws the chosen container on the secondary container', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)

      expect(styleOf(indicator()).backgroundColor).toBe(
        colors.secondaryContainer,
      )
    })

    it('draws the chosen container on secondary where no check marks it', async () => {
      await render(
        <Segments defaultSelectedKeys={FIRST} showSelectedIcon={false} />,
      )

      expect(styleOf(indicator()).backgroundColor).toBe(colors.secondary)
    })

    it('draws the chosen container of an icon with no label on secondary', async () => {
      await render(
        <SegmentedButton aria-label="Label" defaultSelectedKeys={FIRST}>
          <SegmentedButton.Segment
            aria-label="First item"
            icon={ICON}
            id="first"
          />
        </SegmentedButton>,
      )

      expect(styleOf(indicator()).backgroundColor).toBe(colors.secondary)
    })

    it('draws a disabled chosen container on surface at the disabled opacity', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} isDisabled />)

      expect(styleOf(indicator()).backgroundColor).toBe(DISABLED_CONTAINER)
    })

    it('draws a chosen disabled segment the same way in a set that is not', async () => {
      await render(
        <SegmentedButton aria-label="Label" defaultSelectedKeys={SECOND}>
          <SegmentedButton.Segment id="first">
            First item
          </SegmentedButton.Segment>
          <SegmentedButton.Segment id="second" isDisabled>
            Second item
          </SegmentedButton.Segment>
        </SegmentedButton>,
      )

      expect(styleOf(indicator()).backgroundColor).toBe(DISABLED_CONTAINER)
      expect(await labelColor('Second item')).toBe(same(DISABLED_CONTENT))
    })

    it('draws the state layer in the label colour', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)

      await fireEvent(segment('Second item'), 'hoverIn')

      const layer = child(surfaceOf('Second item').children.at(0))
      expect(styleOf(layer).backgroundColor).toBe(colors.onSurface)
      expect(styleOf(layer).opacity).toBe(stateLayerOpacity.hover)
    })

    it('rounds the state layer as the segment is rounded', async () => {
      await render(<Segments />)

      expect(styleOf(surfaceOf('First item'))).toMatchObject({
        borderBottomStartRadius: radii.pill,
        borderTopEndRadius: 0,
        overflow: 'hidden',
      })
    })

    it('draws a ripple unless disableRipple turns it off', async () => {
      await render(
        <SegmentedButton aria-label="Label">
          <SegmentedButton.Segment id="first">
            First item
          </SegmentedButton.Segment>
          <SegmentedButton.Segment disableRipple id="second">
            Second item
          </SegmentedButton.Segment>
        </SegmentedButton>,
      )

      // The layer, then the ripple where one is drawn.
      expect(surfaceOf('First item').children).toHaveLength(2)
      expect(surfaceOf('Second item').children).toHaveLength(1)
    })

    it('shows the focus ring when focus arrives from a key', async () => {
      await render(<Segments />)

      await fireEvent(segment('Second item'), 'focus', {})

      expect(styleOf(segment('Second item'))).toMatchObject({
        outlineColor: colors.primary,
        outlineWidth: 2,
      })
    })
  })

  describe('several chosen', () => {
    it('fills each chosen segment where it is, with no container of the track', async () => {
      await render(
        <Segments defaultSelectedKeys={FIRST} selectionMode="multiple" />,
      )

      expect(group().children).toHaveLength(4)
      expect(styleOf(fillOf('First item')).backgroundColor).toBe(
        colors.secondaryContainer,
      )
      expect(getAnimatedStyle(fillOf('First item'))).toMatchObject({
        opacity: 1,
      })
      expect(getAnimatedStyle(fillOf('Second item'))).toMatchObject({
        opacity: 0,
      })
    })

    it('fades a segment in and out of its fill', async () => {
      await render(
        <Segments defaultSelectedKeys={FIRST} selectionMode="multiple" />,
      )

      await fireEvent.press(segment('Second item'), PRESS)
      await advance(motion.durationShort2 / 2)
      const opacity = getAnimatedStyle(fillOf('Second item')).opacity
      expect(opacity).toBeGreaterThan(0)
      expect(opacity).toBeLessThan(1)

      await advance(motion.durationShort2)
      expect(getAnimatedStyle(fillOf('Second item'))).toMatchObject({
        opacity: 1,
      })
    })

    it('fills a segment at once under reduced motion', async () => {
      mockReducedMotion = true
      await render(
        <Segments defaultSelectedKeys={FIRST} selectionMode="multiple" />,
      )

      await fireEvent.press(segment('Second item'), PRESS)
      await frame()

      expect(getAnimatedStyle(fillOf('Second item'))).toMatchObject({
        opacity: 1,
      })
    })

    it('rounds the fill of an end as the segment is rounded', async () => {
      await render(
        <Segments defaultSelectedKeys={FIRST} selectionMode="multiple" />,
      )

      expect(styleOf(fillOf('First item'))).toMatchObject({
        borderBottomStartRadius: radii.pill,
        borderTopEndRadius: 0,
        bottom: 0,
        end: 0,
        position: 'absolute',
        start: 0,
        top: 0,
      })
    })

    it('fills a disabled segment on surface at the disabled opacity', async () => {
      await render(
        <Segments
          defaultSelectedKeys={FIRST}
          isDisabled
          selectionMode="multiple"
        />,
      )

      expect(styleOf(fillOf('First item')).backgroundColor).toBe(
        DISABLED_CONTAINER,
      )
    })

    it('fills a segment on secondary where no check marks it', async () => {
      await render(
        <Segments
          defaultSelectedKeys={FIRST}
          selectionMode="multiple"
          showSelectedIcon={false}
        />,
      )

      expect(styleOf(fillOf('First item')).backgroundColor).toBe(
        colors.secondary,
      )
    })
  })

  describe('geometry', () => {
    it('draws a 40dp segment with a 1dp rule and its padding', async () => {
      await render(<Segments />)

      expect(styleOf(segment('Second item'))).toMatchObject({
        alignItems: 'center',
        borderStartWidth: 0,
        borderWidth: 1,
        flexDirection: 'row',
        flexShrink: 1,
        justifyContent: 'center',
        minHeight: sizing.controlSm,
        minWidth: 0,
        paddingHorizontal: spacing.sm,
      })
    })

    it('draws the leading rule on the first segment alone', async () => {
      await render(<Segments />)

      expect(styleOf(segment('First item')).borderStartWidth).toBe(1)
      expect(styleOf(segment('Third item')).borderStartWidth).toBe(0)
    })

    it('rounds the outer ends and squares the joins', async () => {
      await render(<Segments />)

      expect(styleOf(segment('First item'))).toMatchObject({
        borderBottomEndRadius: 0,
        borderBottomStartRadius: radii.pill,
        borderTopEndRadius: 0,
        borderTopStartRadius: radii.pill,
      })
      expect(styleOf(segment('Second item'))).toMatchObject({
        borderBottomEndRadius: 0,
        borderBottomStartRadius: 0,
        borderTopEndRadius: 0,
        borderTopStartRadius: 0,
      })
      expect(styleOf(segment('Third item'))).toMatchObject({
        borderBottomEndRadius: radii.pill,
        borderBottomStartRadius: 0,
        borderTopEndRadius: radii.pill,
        borderTopStartRadius: 0,
      })
    })

    it('reaches 4dp above and below each segment and the track, and not across', async () => {
      await render(<Segments />)

      const reach = { bottom: 4, left: 0, right: 0, top: 4 }
      expect(segment('First item').props.hitSlop).toEqual(reach)
      expect(group().props.hitSlop).toEqual(reach)
    })

    it("takes the call site's own hitSlop", async () => {
      await render(
        <SegmentedButton aria-label="Label" hitSlop={HIT_SLOP}>
          <SegmentedButton.Segment hitSlop={HIT_SLOP} id="first">
            First item
          </SegmentedButton.Segment>
        </SegmentedButton>,
      )

      expect(group().props.hitSlop).toEqual(HIT_SLOP)
      expect(segment('First item').props.hitSlop).toEqual(HIT_SLOP)
    })

    it('lays the track out from the start, never wider than what holds it', async () => {
      await render(<Segments />)

      expect(styleOf(group())).toMatchObject({
        alignSelf: 'flex-start',
        flexDirection: 'row',
        maxWidth: '100%',
      })
    })

    it('measures each label off screen at its own width, in label large', async () => {
      await render(<Segments />)

      const texts = measurer().children.map(child)
      expect(texts.map((text): unknown => text.props.children)).toEqual(NAMES)
      expect(texts.every((text) => text.props.numberOfLines === 1)).toBe(true)
      expect(styleOf(child(texts.at(0)))).toMatchObject({
        fontSize: theme.typography.labelLargeSize,
      })
      expect(styleOf(measurer())).toMatchObject({
        opacity: 0,
        pointerEvents: 'none',
        position: 'absolute',
      })
    })

    it('hands every segment the widest one’s width once every label is measured', async () => {
      await render(<Segments />)

      await measure(LABELS.slice(0, 2))
      expect(styleOf(segment('First item')).width).toBeUndefined()

      await measure()
      // The second label is the widest: its label, the room for the check,
      // the 12dp of padding either side, and its one rule.
      const width = 80 + RESERVE + spacing.md * 2 + 1
      for (const name of NAMES) {
        expect(styleOf(segment(name))).toMatchObject({ flexGrow: 0, width })
      }
    })

    it('counts the leading rule of the first segment', async () => {
      await render(<Segments />)

      await measure([90, 80, 70])

      expect(styleOf(segment('Third item')).width).toBe(
        90 + RESERVE + spacing.md * 2 + 2,
      )
    })

    it('keeps no room for a glyph that is never drawn', async () => {
      await render(<Segments showSelectedIcon={false} />)

      await measure()

      expect(styleOf(segment('First item')).width).toBe(80 + spacing.md * 2 + 1)
    })

    it('keeps room for an icon when the check is off', async () => {
      await render(
        <SegmentedButton aria-label="Label" showSelectedIcon={false}>
          <SegmentedButton.Segment icon={ICON} id="first">
            First item
          </SegmentedButton.Segment>
        </SegmentedButton>,
      )

      await measure([60])

      expect(styleOf(segment('First item')).width).toBe(
        60 + RESERVE + spacing.md * 2 + 2,
      )
    })

    it('makes a segment with no label as wide as its icon and padding', async () => {
      await render(
        <SegmentedButton aria-label="Label">
          <SegmentedButton.Segment
            aria-label="First item"
            icon={ICON}
            id="first"
          />
          <SegmentedButton.Segment
            aria-label="Second item"
            icon={ICON}
            id="second"
          />
        </SegmentedButton>,
      )

      expect(measurer().children).toHaveLength(0)
      expect(styleOf(segment('Second item')).width).toBe(
        GLYPH + spacing.md * 2 + 2,
      )
    })

    it('measures a label again when it changes width', async () => {
      await render(<Segments />)
      await measure()

      await measure([60, 100, 70])

      expect(styleOf(segment('First item')).width).toBe(
        100 + RESERVE + spacing.md * 2 + 1,
      )
    })
  })

  describe('the room for a glyph', () => {
    it('splits the room either side of a label with nothing drawn', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)

      const { leading, trailing } = partsOf('Second item')
      expect(widthOf(leading)).toBe(GIVE + RESERVE / 2)
      expect(getAnimatedStyle(leading)).toMatchObject({ minWidth: 0 })
      expect(widthOf(trailing)).toBe(GIVE + RESERVE / 2)
      expect(widthOf(child(slotOf('Second item')))).toBe(0)
      expect(widthOf(gapOf('Second item'))).toBe(0)
    })

    it('puts all of it before a label with a glyph drawn, and holds it there', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)

      const { leading, trailing } = partsOf('First item')
      expect(widthOf(leading)).toBe(GIVE + RESERVE)
      expect(getAnimatedStyle(leading)).toMatchObject({ minWidth: RESERVE })
      expect(widthOf(trailing)).toBe(GIVE)
      expect(widthOf(child(slotOf('First item')))).toBe(GLYPH)
      expect(widthOf(gapOf('First item'))).toBe(spacing.sm)
    })

    it('keeps only the padding it gives back where there is no room to keep', async () => {
      await render(
        <Segments defaultSelectedKeys={FIRST} showSelectedIcon={false} />,
      )

      const { leading, trailing } = partsOf('First item')
      expect(widthOf(leading)).toBe(GIVE)
      expect(widthOf(trailing)).toBe(GIVE)
    })

    it('draws an icon with no label with no gap after it', async () => {
      await render(
        <SegmentedButton aria-label="Label" defaultSelectedKeys={FIRST}>
          <SegmentedButton.Segment
            aria-label="First item"
            icon={ICON}
            id="first"
          />
        </SegmentedButton>,
      )

      const parts = segment('First item').children.map(child)
      const [, , leading, trailing] = parts
      expect(widthOf(child(leading))).toBe(GIVE + GLYPH)
      expect(getAnimatedStyle(child(leading))).toMatchObject({
        minWidth: GLYPH,
      })
      expect(widthOf(child(trailing))).toBe(GIVE)
      expect(widthOf(child(child(leading).children.at(1)))).toBe(0)
      expect(parts).toHaveLength(4)
    })

    it('opens the slot from its centre, clipping the glyph', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)

      const slot = child(slotOf('First item'))
      expect(styleOf(slot)).toMatchObject({
        alignItems: 'center',
        height: GLYPH,
        justifyContent: 'center',
        overflow: 'hidden',
      })
      expect(styleOf(child(slot.children.at(0)))).toMatchObject({
        flexShrink: 0,
        height: GLYPH,
        width: GLYPH,
      })
    })

    it('gives the room back before the label', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)

      const { label, leading, trailing } = partsOf('First item')
      expect(styleOf(leading)).toMatchObject({
        flexShrink: 1,
        justifyContent: 'flex-end',
      })
      expect(styleOf(trailing)).toMatchObject({ flexShrink: 1 })
      expect(styleOf(label)).toMatchObject({ flexShrink: 0, minWidth: 0 })
      expect(label.props.numberOfLines).toBe(1)
    })

    it('sets the label in label large, as it is measured', async () => {
      await render(<Segments />)

      expect(styleOf(partsOf('First item').label)).toMatchObject({
        fontSize: theme.typography.labelLargeSize,
        lineHeight: theme.typography.labelLargeLineHeight,
      })
    })

    it('cuts a label short at what is left once its padding and glyph are taken out', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)

      await layOutAll(100)
      await advance(motion.durationShort2)

      const first = getAnimatedStyle(partsOf('First item').label)
      const second = getAnimatedStyle(partsOf('Second item').label)
      expect(first).toMatchObject({
        maxWidth: 100 - 2 - spacing.sm * 2 - RESERVE,
      })
      expect(second).toMatchObject({ maxWidth: 100 - 1 - spacing.sm * 2 })
    })

    it('sets no cut until the segment is laid out', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)

      expect(getAnimatedStyle(partsOf('First item').label)).not.toHaveProperty(
        'maxWidth',
      )
    })

    it('eases the room over to the newly chosen segment', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)

      await fireEvent.press(segment('Second item'), PRESS)
      await advance(motion.durationShort2 / 2)
      const halfway = widthOf(partsOf('Second item').leading)
      expect(halfway).toBeGreaterThan(GIVE + RESERVE / 2)
      expect(halfway).toBeLessThan(GIVE + RESERVE)

      await advance(motion.durationShort2)
      expect(widthOf(partsOf('Second item').leading)).toBe(GIVE + RESERVE)
      expect(widthOf(partsOf('First item').leading)).toBe(GIVE + RESERVE / 2)
    })

    it('moves the room at once under reduced motion', async () => {
      mockReducedMotion = true
      await render(<Segments defaultSelectedKeys={FIRST} />)

      await fireEvent.press(segment('Second item'), PRESS)
      await frame()

      expect(widthOf(partsOf('Second item').leading)).toBe(GIVE + RESERVE)
      expect(widthOf(child(slotOf('Second item')))).toBe(GLYPH)
      expect(widthOf(gapOf('Second item'))).toBe(spacing.sm)
      expect(widthOf(partsOf('Second item').trailing)).toBe(GIVE)
    })
  })

  describe('the chosen container', () => {
    it('is drawn in the track’s own outline, behind the segments', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)

      expect(styleOf(clip())).toMatchObject({
        borderRadius: radii.pill,
        bottom: 0,
        end: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        position: 'absolute',
        start: 0,
        top: 0,
      })
      expect(styleOf(indicator())).toMatchObject({
        bottom: 0,
        position: 'absolute',
        start: 0,
        top: 0,
      })
    })

    it('is drawn by the segment the set opens on until the choice moves', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)

      expect(styleOf(fillOf('First item')).backgroundColor).toBe(
        colors.secondaryContainer,
      )
      expect(getAnimatedStyle(fillOf('First item'))).toMatchObject({
        opacity: 1,
      })
      expect(getAnimatedStyle(fillOf('Second item'))).toMatchObject({
        opacity: 0,
      })

      await layOutAll(100)
      await fireEvent.press(segment('Second item'), PRESS)
      await frame()

      // The track's own slides out from under it, and it is gone at once.
      expect(getAnimatedStyle(fillOf('First item'))).toMatchObject({
        opacity: 0,
      })
      expect(getAnimatedStyle(fillOf('Second item'))).toMatchObject({
        opacity: 0,
      })
    })

    it('is hidden until the segments are laid out', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)

      expect(getAnimatedStyle(indicator())).toMatchObject({ opacity: 0 })
    })

    it('is drawn at the chosen segment, as wide as it is', async () => {
      await render(<Segments defaultSelectedKeys={SECOND} />)

      await layOutAll(100)

      expect(styleOf(indicator()).width).toBe(100)
      expect(getAnimatedStyle(indicator())).toMatchObject({
        opacity: 1,
        transform: [{ translateX: 100 }],
      })
    })

    it('measures its move from where it rests', async () => {
      await render(<Segments defaultSelectedKeys={SECOND} />)

      await layOutSegments(100)
      // Right to left, it rests at the right end of the track.
      await layOut(indicator(), { width: 100, x: 200 })

      expect(getAnimatedStyle(indicator())).toMatchObject({
        opacity: 1,
        transform: [{ translateX: -100 }],
      })
    })

    it('waits for where it rests at the width it is drawn at', async () => {
      await render(<Segments defaultSelectedKeys={SECOND} />)

      await layOutSegments(100)
      await layOut(indicator(), { width: 0, x: 300 })

      expect(getAnimatedStyle(indicator())).toMatchObject({ opacity: 0 })
    })

    it('slides to the next chosen segment over durationMedium1', async () => {
      await render(<Segments defaultSelectedKeys={FIRST} />)
      await layOutAll(100)

      await fireEvent.press(segment('Third item'), PRESS)
      await advance(motion.durationMedium1 / 2)
      const shift = shiftOf()
      expect(shift).toBeGreaterThan(0)
      expect(shift).toBeLessThan(200)

      // Still on its way once the segments' own ease, over durationShort2,
      // has ended.
      await advance(motion.durationMedium1 / 2 - 50)
      expect(shiftOf()).toBeLessThan(200)

      await advance(motion.durationMedium1)
      expect(getAnimatedStyle(indicator())).toMatchObject({
        opacity: 1,
        transform: [{ translateX: 200 }],
      })
    })

    it('moves at once under reduced motion', async () => {
      mockReducedMotion = true
      await render(<Segments defaultSelectedKeys={FIRST} />)
      await layOutAll(100)

      await fireEvent.press(segment('Third item'), PRESS)
      await frame()

      expect(getAnimatedStyle(indicator())).toMatchObject({
        opacity: 1,
        transform: [{ translateX: 200 }],
      })
    })

    it('follows a layout that moves under the same choice at once', async () => {
      await render(<Segments defaultSelectedKeys={SECOND} />)
      await layOutAll(100)

      await layOut(segment('Second item'), { width: 100, x: 120 })

      expect(getAnimatedStyle(indicator())).toMatchObject({
        opacity: 1,
        transform: [{ translateX: 120 }],
      })
    })

    it('fades out where it was when the choice is cleared, at the width it had', async () => {
      await render(
        <Segments
          defaultSelectedKeys={SECOND}
          disallowEmptySelection={false}
        />,
      )
      await layOutAll(100)

      await fireEvent.press(segment('Second item'), PRESS)
      await advance(motion.durationMedium1 / 2)
      const { opacity } = getAnimatedStyle(indicator())
      expect(opacity).toBeGreaterThan(0)
      expect(opacity).toBeLessThan(1)

      await advance(motion.durationMedium1)
      expect(getAnimatedStyle(indicator())).toMatchObject({
        opacity: 0,
        transform: [{ translateX: 100 }],
      })
      expect(styleOf(indicator()).width).toBe(100)
    })

    it('keeps the colour of the segment it fades out at', async () => {
      // The set opens on an icon with no label, whose container is the
      // stronger one, so a container that went back to it would show.
      await render(
        <SegmentedButton
          aria-label="Label"
          defaultSelectedKeys={FIRST}
          disallowEmptySelection={false}
        >
          <SegmentedButton.Segment
            aria-label="First item"
            icon={ICON}
            id="first"
          />
          <SegmentedButton.Segment id="second">
            Second item
          </SegmentedButton.Segment>
        </SegmentedButton>,
      )

      await fireEvent.press(segment('Second item'), PRESS)
      await fireEvent.press(segment('Second item'), PRESS)

      expect(segment('Second item')).not.toBeChecked()
      expect(styleOf(indicator()).backgroundColor).toBe(
        colors.secondaryContainer,
      )
    })

    it('fades in where the next choice is, rather than sliding from the last', async () => {
      await render(
        <Segments
          defaultSelectedKeys={SECOND}
          disallowEmptySelection={false}
        />,
      )
      await layOutAll(100)
      await fireEvent.press(segment('Second item'), PRESS)
      await advance(motion.durationMedium1)

      await fireEvent.press(segment('Third item'), PRESS)
      expect(getAnimatedStyle(indicator()).transform).toEqual([
        { translateX: 200 },
      ])
      await advance(motion.durationMedium1 / 2)
      const { opacity } = getAnimatedStyle(indicator())
      expect(opacity).toBeGreaterThan(0)
      expect(opacity).toBeLessThan(1)
    })

    it('appears at once when the set opens with nothing chosen and one is', async () => {
      await render(
        <Segments defaultSelectedKeys={NONE} disallowEmptySelection={false} />,
      )
      await layOutAll(100)
      expect(getAnimatedStyle(indicator())).toMatchObject({ opacity: 0 })

      await fireEvent.press(segment('Second item'), PRESS)
      await layOut(indicator(), { width: 100, x: 0 })

      expect(getAnimatedStyle(indicator())).toMatchObject({
        opacity: 1,
        transform: [{ translateX: 100 }],
      })
    })

    it('fades out at once under reduced motion', async () => {
      mockReducedMotion = true
      await render(
        <Segments
          defaultSelectedKeys={SECOND}
          disallowEmptySelection={false}
        />,
      )
      await layOutAll(100)

      await fireEvent.press(segment('Second item'), PRESS)
      await frame()

      expect(getAnimatedStyle(indicator())).toMatchObject({ opacity: 0 })
    })

    it('ignores a chosen key no segment carries', async () => {
      await render(<Segments selectedKeys={MISSING} />)
      await layOutAll(100)

      expect(getAnimatedStyle(indicator())).toMatchObject({ opacity: 0 })
    })

    it('fades out when the choice moves to a key no segment carries', async () => {
      const { rerender } = await render(<Segments selectedKeys={FIRST} />)
      await layOutAll(100)

      await rerender(<Segments selectedKeys={MISSING} />)
      await advance(motion.durationMedium1)

      expect(getAnimatedStyle(indicator())).toMatchObject({ opacity: 0 })
    })

    it('follows a chosen segment that changes width where it is', async () => {
      await render(<Segments defaultSelectedKeys={SECOND} />)
      await layOutAll(100)

      await layOut(segment('Second item'), { width: 120, x: 100 })

      expect(styleOf(indicator()).width).toBe(120)
    })
  })

  describe('the call site', () => {
    it('puts style, testID and ref on the track, its style last', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(<Segments ref={ref} style={CALL_SITE} testID="set" />)

      expect(screen.getByTestId('set')).toBe(group())
      expect(styleOf(group())).toMatchObject(CALL_SITE)
      expect(ref.current).not.toBeNull()
    })

    it('puts style, testID and ref on the segment, its style last', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        <SegmentedButton aria-label="Label">
          <SegmentedButton.Segment
            id="first"
            ref={ref}
            style={CALL_SITE}
            testID="segment"
          >
            First item
          </SegmentedButton.Segment>
        </SegmentedButton>,
      )

      expect(screen.getByTestId('segment')).toBe(segment('First item'))
      expect(styleOf(segment('First item')).marginTop).toBe(4)
      expect(ref.current).not.toBeNull()
    })

    it("calls the segment's own onLayout after recording where it is", async () => {
      const onLayout = jest.fn()
      await render(
        <SegmentedButton aria-label="Label" defaultSelectedKeys={FIRST}>
          <SegmentedButton.Segment id="first" onLayout={onLayout}>
            First item
          </SegmentedButton.Segment>
        </SegmentedButton>,
      )

      await layOut(segment('First item'), { width: 100 })
      await layOut(indicator(), { width: 100 })

      expect(onLayout).toHaveBeenCalledTimes(1)
      expect(getAnimatedStyle(indicator())).toMatchObject({ opacity: 1 })
    })

    it("calls the segment's own focus and press handlers", async () => {
      const onFocus = jest.fn()
      const onPressIn = jest.fn()
      await render(
        <SegmentedButton aria-label="Label">
          <SegmentedButton.Segment
            id="first"
            onFocus={onFocus}
            onPressIn={onPressIn}
          >
            First item
          </SegmentedButton.Segment>
        </SegmentedButton>,
      )

      await fireEvent(segment('First item'), 'focus')
      await fireEvent(segment('First item'), 'pressIn', PRESS)

      expect(onFocus).toHaveBeenCalledTimes(1)
      expect(onPressIn).toHaveBeenCalledTimes(1)
    })
  })
})
