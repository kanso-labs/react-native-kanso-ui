import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { Key, Selection } from 'react-stately'
import type { TestInstance, TestNode } from 'test-renderer'

import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { FlatList, I18nManager, StyleSheet, Text } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import { Tree } from '.'
import { I18nProvider } from '../../i18n/provider'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const { colors, sizing, spacing, stateLayerOpacity } = theme

const FADED = withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)

// kanso-ui's glyphs, copied rather than read from the glyphs under test.
const CHECK = 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
const CHEVRON = 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z'

// A press with no point on the page, on a row that measures nothing, so the
// ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// What a screen reader sends when one of a row's actions is chosen.
const COLLAPSE = { nativeEvent: { actionName: 'collapse' } }
const EXPAND = { nativeEvent: { actionName: 'expand' } }
const SELECT = { nativeEvent: { actionName: 'select' } }

// A tree laid out taller than its rows, which is a tree whose end is in
// view as soon as it is drawn.
const LAYOUT = {
  nativeEvent: { layout: { height: 400, width: 320, x: 0, y: 0 } },
}

// Hoisted so each is one stable value per render, which is what react-perf's
// rules are after.
const CALL_SITE = { marginTop: 4 }
const FIRST = ['first']
const FIRST_AND_SECOND = ['first', 'second']
const ITEMS = [
  { id: 'first', name: 'First item' },
  { id: 'second', name: 'Second item' },
] as const
const HEADLINE = <Text testID="headline">First item</Text>
const LEADING = <Text testID="leading">Lead</Text>
const SECOND = ['second']

// The rows most cases draw: a row with a row under it, which has one of its
// own, a second row under the first, and a row on its own.
const ROWS = [
  <Tree.Item headline="First item" id="first" key="first">
    <Tree.Item headline="Second item" id="second">
      <Tree.Item headline="Third item" id="third" />
    </Tree.Item>
    <Tree.Item headline="Fourth item" id="fourth" />
  </Tree.Item>,
  <Tree.Item headline="Fifth item" id="fifth" key="fifth" />,
]

// The views drawn as the checkbox's 18dp box, and the checks drawn over one.
function boxesIn(element: TestInstance) {
  return element.queryAll((node) => {
    const style = styleOf(node)
    return style.width === 18 && style.borderWidth === 2
  })
}

function checksIn(element: TestInstance) {
  return element.queryAll(
    (node) => node.type === 'RNSVGPath' && node.props.d === CHECK,
  )
}

// How far a row's chevron is turned, in degrees.
function chevronAngleIn(element: TestInstance): number {
  const glyph = chevronIn(element)
    .queryAll((each) => each.type.startsWith('RNSVGSvgView'))
    .at(0)
  const turned = glyph?.parent

  if (turned === null || turned === undefined) {
    throw new TypeError('expected the chevron to be turned')
  }
  const { transform }: { transform?: unknown } = getAnimatedStyle(turned)
  const turn: unknown = Array.isArray(transform) ? transform.at(0) : undefined

  if (
    typeof turn !== 'object' ||
    turn === null ||
    !('rotate' in turn) ||
    typeof turn.rotate !== 'string'
  ) {
    throw new TypeError('expected the chevron to be turned')
  }
  return Number.parseFloat(turn.rotate)
}

// The colour a row's chevron is drawn in, which its svg is handed.
function chevronColourIn(element: TestInstance): unknown {
  return chevronIn(element)
    .queryAll((node) => node.props.vbWidth === 24)
    .at(0)?.props.color
}

// The press a row's chevron takes, the one around the chevron's glyph.
function chevronIn(element: TestInstance) {
  const chevron = element
    .queryAll(
      (node) =>
        node.props.accessible === false &&
        typeof node.props.onClick === 'function' &&
        node
          .queryAll(
            (each) => each.type === 'RNSVGPath' && each.props.d === CHEVRON,
          )
          .at(0) !== undefined,
    )
    .at(-1)

  if (chevron === undefined) {
    throw new TypeError('expected a chevron')
  }
  return chevron
}

function chevronsIn(element: TestInstance) {
  return element.queryAll(
    (node) => node.type === 'RNSVGPath' && node.props.d === CHEVRON,
  )
}

function header() {
  return screen.getByRole('heading', { name: 'Header' })
}

// The headlines drawn, top to bottom.
function headlines() {
  return screen
    .queryAllByText(/item$/)
    .map((node) =>
      node.children
        .map((child) => (typeof child === 'string' ? child : ''))
        .join(''),
    )
}

// A node of the tree that is an element rather than text.
function instance(node: null | TestNode | undefined): TestInstance {
  if (node === null || node === undefined || typeof node === 'string') {
    throw new TypeError('expected an element')
  }
  return node
}

// The keys the latest change reported, in order.
function keysOf(
  onChange:
    | jest.Mock<(keys: Selection) => void>
    | jest.Mock<(keys: Set<Key>) => void>,
) {
  const keys = onChange.mock.calls.at(-1)?.[0]

  if (keys === undefined || keys === 'all') {
    throw new TypeError('expected a set of keys')
  }
  return [...keys].map(String).toSorted()
}

// The view a row's chevron, checkbox and leading content sit in, which its
// depth sets in.
function leadOf(headline: string) {
  const lead = rowOf(headline)
    .queryAll((node) => styleOf(node).marginStart !== undefined)
    .at(0)

  if (lead === undefined) {
    throw new TypeError('expected a lead')
  }
  return lead
}

// A row, by the headline that names it, whether it presses or presents.
function rowOf(headline: string): TestInstance {
  const pressable = screen.queryByRole('button', {
    name: new RegExp(headline),
  })

  if (pressable !== null) {
    return pressable
  }

  let node = instance(screen.getByText(headline).parent)
  while (styleOf(node).minHeight === undefined) {
    node = instance(node.parent)
  }
  return node
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle & ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function tree() {
  return screen.getByLabelText('Label')
}

describe('Tree', () => {
  describe('naming', () => {
    it('is found by its label, and each row by its headline', async () => {
      await render(
        <Tree aria-label="Label" defaultExpandedKeys={FIRST}>
          {ROWS}
        </Tree>,
      )

      expect(tree()).toBeOnTheScreen()
      expect(
        screen.getByRole('button', { expanded: true, name: 'First item' }),
      ).toBeOnTheScreen()
      expect(
        screen.getByRole('button', { expanded: false, name: 'Second item' }),
      ).toBeOnTheScreen()
    })

    it('draws each row from a function over `items`', async () => {
      await render(
        <Tree aria-label="Label" items={ITEMS}>
          {(item) => <Tree.Item headline={item.name} id={item.id} />}
        </Tree>,
      )

      expect(headlines()).toEqual(['First item', 'Second item'])
    })

    it('draws a headline given as an element', async () => {
      await render(
        <Tree aria-label="Label">
          <Tree.Item headline={HEADLINE} id="first" textValue="First item" />
        </Tree>,
      )

      expect(screen.getByTestId('headline')).toBeOnTheScreen()
    })
  })

  describe('opening and closing', () => {
    it('draws the rows at the top, and none under a closed row', async () => {
      await render(<Tree aria-label="Label">{ROWS}</Tree>)

      expect(headlines()).toEqual(['First item', 'Fifth item'])
    })

    it('opens a row from its chevron, its rows following it, and closes it again', async () => {
      const onExpandedChange = jest.fn<(keys: Set<Key>) => void>()
      await render(
        <Tree aria-label="Label" onExpandedChange={onExpandedChange}>
          {ROWS}
        </Tree>,
      )

      await fireEvent.press(chevronIn(rowOf('First item')), PRESS)

      expect(keysOf(onExpandedChange)).toEqual(['first'])
      expect(headlines()).toEqual([
        'First item',
        'Second item',
        'Fourth item',
        'Fifth item',
      ])

      await fireEvent.press(chevronIn(rowOf('Second item')), PRESS)

      expect(keysOf(onExpandedChange)).toEqual(['first', 'second'])
      expect(headlines()).toEqual([
        'First item',
        'Second item',
        'Third item',
        'Fourth item',
        'Fifth item',
      ])

      await fireEvent.press(chevronIn(rowOf('First item')), PRESS)

      expect(keysOf(onExpandedChange)).toEqual(['second'])
      expect(headlines()).toEqual(['First item', 'Fifth item'])
    })

    it('opens the rows defaultExpandedKeys names at first', async () => {
      await render(
        <Tree aria-label="Label" defaultExpandedKeys={FIRST_AND_SECOND}>
          {ROWS}
        </Tree>,
      )

      expect(headlines()).toEqual([
        'First item',
        'Second item',
        'Third item',
        'Fourth item',
        'Fifth item',
      ])
    })

    it('keeps the open rows the call site holds', async () => {
      const onExpandedChange = jest.fn<(keys: Set<Key>) => void>()
      await render(
        <Tree
          aria-label="Label"
          expandedKeys={FIRST}
          onExpandedChange={onExpandedChange}
        >
          {ROWS}
        </Tree>,
      )

      await fireEvent.press(chevronIn(rowOf('Second item')), PRESS)

      expect(keysOf(onExpandedChange)).toEqual(['first', 'second'])
      expect(headlines()).toEqual([
        'First item',
        'Second item',
        'Fourth item',
        'Fifth item',
      ])
    })

    it('opens and closes a row on a press, in a tree that neither selects nor acts', async () => {
      await render(<Tree aria-label="Label">{ROWS}</Tree>)

      await fireEvent.press(rowOf('First item'), PRESS)
      expect(headlines()).toContain('Second item')

      await fireEvent.press(rowOf('First item'), PRESS)
      expect(headlines()).not.toContain('Second item')
    })

    it('opens and closes a row from its actions, named Expand and Collapse', async () => {
      await render(<Tree aria-label="Label">{ROWS}</Tree>)

      expect(rowOf('First item').props.accessibilityActions).toEqual([
        { label: 'Expand', name: 'expand' },
      ])

      await fireEvent(rowOf('First item'), 'accessibilityAction', EXPAND)

      expect(headlines()).toContain('Second item')
      expect(rowOf('First item').props.accessibilityActions).toEqual([
        { label: 'Collapse', name: 'collapse' },
      ])

      // The action a row does not offer does nothing.
      await fireEvent(rowOf('First item'), 'accessibilityAction', EXPAND)
      expect(headlines()).toContain('Second item')

      await fireEvent(rowOf('First item'), 'accessibilityAction', COLLAPSE)

      expect(headlines()).not.toContain('Second item')

      await fireEvent(rowOf('First item'), 'accessibilityAction', COLLAPSE)
      expect(headlines()).not.toContain('Second item')
    })

    it('names the two actions in the language around it', async () => {
      await render(
        <I18nProvider locale="de-DE">
          <Tree aria-label="Label" defaultExpandedKeys={FIRST}>
            {ROWS}
          </Tree>
        </I18nProvider>,
      )

      expect(rowOf('First item').props.accessibilityActions).toEqual([
        { label: 'Reduzieren', name: 'collapse' },
      ])
      expect(rowOf('Second item').props.accessibilityActions).toEqual([
        { label: 'Erweitern', name: 'expand' },
      ])
    })

    it('turns the chevron a quarter to point down while open', async () => {
      await render(
        <Tree aria-label="Label" defaultExpandedKeys={FIRST}>
          {ROWS}
        </Tree>,
      )

      expect(chevronAngleIn(rowOf('First item'))).toBe(90)
      expect(chevronAngleIn(rowOf('Second item'))).toBe(0)
    })

    it('turns it the other way under right-to-left, where the glyph is mirrored', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(
        <Tree aria-label="Label" defaultExpandedKeys={FIRST}>
          {ROWS}
        </Tree>,
      )

      expect(chevronAngleIn(rowOf('First item'))).toBe(-90)
    })
  })

  describe('rows', () => {
    it('sets each level in by a chevron’s width', async () => {
      await render(
        <Tree aria-label="Label" defaultExpandedKeys={FIRST_AND_SECOND}>
          {ROWS}
        </Tree>,
      )

      expect(styleOf(leadOf('First item')).marginStart).toBe(0)
      expect(styleOf(leadOf('Second item')).marginStart).toBe(spacing.xl)
      expect(styleOf(leadOf('Third item')).marginStart).toBe(2 * spacing.xl)
      expect(styleOf(leadOf('Fourth item')).marginStart).toBe(spacing.xl)
      expect(spacing.xl).toBe(24)
    })

    it('draws a chevron on a row with rows under it, and its space on one without', async () => {
      await render(
        <Tree aria-label="Label" defaultExpandedKeys={FIRST}>
          {ROWS}
        </Tree>,
      )

      expect(chevronsIn(rowOf('First item'))).toHaveLength(1)
      expect(chevronsIn(rowOf('Fifth item'))).toHaveLength(0)

      const space = instance(leadOf('Fifth item').children.at(0))

      expect(styleOf(space)).toMatchObject({ height: 24, width: 24 })
      expect(space.children).toHaveLength(0)
      expect(styleOf(chevronIn(rowOf('First item')))).toMatchObject({
        height: 24,
        width: 24,
      })
    })

    it('draws the chevron in the muted role, for the eye and the finger alone', async () => {
      await render(
        <Tree
          aria-label="Label"
          defaultSelectedKeys={FIRST}
          selectionMode="multiple"
        >
          {ROWS}
          <Tree.Item headline="Sixth item" id="sixth">
            <Tree.Item headline="Seventh item" id="seventh" />
          </Tree.Item>
        </Tree>,
      )

      const chevron = chevronIn(rowOf('Sixth item'))

      expect(chevron.props['aria-hidden']).toBe(true)
      // Kept out of the focus order, where the row stands for it, and grown
      // to a 48dp target for a finger.
      expect(chevron.props).toMatchObject({
        focusable: false,
        hitSlop: { bottom: 12, left: 12, right: 12, top: 12 },
        tabIndex: -1,
      })
      expect(chevronColourIn(rowOf('Sixth item'))).toBe(colors.onSurfaceVariant)
      // The muted role is not guaranteed to read over the selected
      // container, so a selected row's chevron takes the row's own colour.
      expect(chevronColourIn(rowOf('First item'))).toBe(
        colors.onPrimaryContainer,
      )
    })

    it('draws a row as the list row, at its line count’s height', async () => {
      await render(
        <Tree aria-label="Label">
          <Tree.Item headline="First item" id="first" />
          <Tree.Item
            headline="Second item"
            id="second"
            supporting="Supporting line"
          />
        </Tree>,
      )

      expect(styleOf(rowOf('First item')).minHeight).toBe(sizing.rowSm)
      expect(styleOf(rowOf('Second item')).minHeight).toBe(sizing.rowMd)
      expect(screen.getByText('Supporting line')).toBeOnTheScreen()
    })

    it('draws the leading content after the chevron', async () => {
      await render(
        <Tree aria-label="Label">
          <Tree.Item headline="First item" id="first" leading={LEADING}>
            <Tree.Item headline="Second item" id="second" />
          </Tree.Item>
        </Tree>,
      )

      const lead = leadOf('First item')

      expect(lead.children).toHaveLength(2)
      expect(chevronsIn(instance(lead.children.at(0)))).toHaveLength(1)
      expect(lead.children.at(1)).toBe(screen.getByTestId('leading'))
    })

    it('presents a row with nothing to do on a press, with no role', async () => {
      await render(<Tree aria-label="Label">{ROWS}</Tree>)

      expect(screen.getByText('Fifth item')).toBeOnTheScreen()
      expect(screen.queryByRole('button', { name: 'Fifth item' })).toBe(null)
    })

    it('draws no chevron on a row whose children are conditions left false', async () => {
      await render(
        <Tree aria-label="Label">
          <Tree.Item headline="First item" id="first">
            {false}
            {null}
            {undefined}
          </Tree.Item>
        </Tree>,
      )

      expect(chevronsIn(rowOf('First item'))).toHaveLength(0)
    })

    it("lands a row's style and testID on the row", async () => {
      await render(
        <Tree aria-label="Label" onAction={jest.fn()}>
          <Tree.Item
            headline="First item"
            id="first"
            style={CALL_SITE}
            testID="row"
          />
        </Tree>,
      )

      expect(styleOf(screen.getByTestId('row'))).toMatchObject({
        marginTop: 4,
        minHeight: sizing.rowSm,
      })
      // The headline is drawn inside the row rather than handed to it.
      expect(screen.getByTestId('row').props).not.toHaveProperty('headline')
    })
  })

  describe('selection', () => {
    it('draws a checkbox on every row, after the chevron and before the leading content', async () => {
      await render(
        <Tree
          aria-label="Label"
          defaultSelectedKeys={FIRST}
          selectionMode="multiple"
        >
          <Tree.Item headline="First item" id="first" leading={LEADING}>
            <Tree.Item headline="Second item" id="second" />
          </Tree.Item>
          <Tree.Item headline="Fifth item" id="fifth" />
        </Tree>,
      )

      const lead = leadOf('First item')

      expect(lead.children).toHaveLength(3)
      expect(chevronsIn(instance(lead.children.at(0)))).toHaveLength(1)
      expect(boxesIn(instance(lead.children.at(1)))).toHaveLength(1)
      expect(lead.children.at(2)).toBe(screen.getByTestId('leading'))
      expect(checksIn(rowOf('First item'))).toHaveLength(1)
      expect(boxesIn(rowOf('Fifth item'))).toHaveLength(1)
      expect(checksIn(rowOf('Fifth item'))).toHaveLength(0)
      expect(styleOf(rowOf('First item')).backgroundColor).toBe(
        colors.primaryContainer,
      )
    })

    it('selects a row on a press rather than opening it, and says which', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <Tree
          aria-label="Label"
          onSelectionChange={onSelectionChange}
          selectionMode="multiple"
        >
          {ROWS}
        </Tree>,
      )

      await fireEvent.press(rowOf('First item'), PRESS)
      await fireEvent.press(rowOf('Fifth item'), PRESS)

      expect(keysOf(onSelectionChange)).toEqual(['fifth', 'first'])
      expect(headlines()).toEqual(['First item', 'Fifth item'])
      expect(
        screen.getByRole('button', { name: 'First item', selected: true }),
      ).toBeOnTheScreen()
    })

    it('selects a row under another once it is open', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <Tree
          aria-label="Label"
          onSelectionChange={onSelectionChange}
          selectionMode="single"
        >
          {ROWS}
        </Tree>,
      )

      await fireEvent.press(chevronIn(rowOf('First item')), PRESS)
      await fireEvent.press(rowOf('Fourth item'), PRESS)

      expect(keysOf(onSelectionChange)).toEqual(['fourth'])
    })

    it('keeps the selection the call site holds', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <Tree
          aria-label="Label"
          onSelectionChange={onSelectionChange}
          selectedKeys={FIRST}
          selectionMode="single"
        >
          {ROWS}
        </Tree>,
      )

      await fireEvent.press(rowOf('Fifth item'), PRESS)

      expect(keysOf(onSelectionChange)).toEqual(['fifth'])
      expect(
        screen.getByRole('button', { name: 'First item', selected: true }),
      ).toBeOnTheScreen()
    })

    it('selects a row from the select action, beside the one that opens it', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <Tree
          aria-label="Label"
          onSelectionChange={onSelectionChange}
          selectionMode="multiple"
          selectLabel="Choose"
        >
          {ROWS}
        </Tree>,
      )

      expect(rowOf('First item').props.accessibilityActions).toEqual([
        { label: 'Choose', name: 'select' },
        { label: 'Expand', name: 'expand' },
      ])
      expect(rowOf('Fifth item').props.accessibilityActions).toEqual([
        { label: 'Choose', name: 'select' },
      ])

      await fireEvent(rowOf('First item'), 'accessibilityAction', SELECT)

      expect(keysOf(onSelectionChange)).toEqual(['first'])
      expect(headlines()).toEqual(['First item', 'Fifth item'])
    })
  })

  describe('actions', () => {
    it("runs the tree's onAction with the row's key on a press, rather than opening it", async () => {
      const onAction = jest.fn()
      await render(
        <Tree aria-label="Label" onAction={onAction}>
          {ROWS}
        </Tree>,
      )

      await fireEvent.press(rowOf('First item'), PRESS)

      expect(onAction).toHaveBeenCalledTimes(1)
      expect(onAction).toHaveBeenCalledWith('first')
      expect(headlines()).toEqual(['First item', 'Fifth item'])
    })

    it("runs a row's own onAction in place of the tree's", async () => {
      const onAction = jest.fn()
      const onRowAction = jest.fn()
      await render(
        <Tree aria-label="Label" onAction={onAction}>
          <Tree.Item headline="First item" id="first" onAction={onRowAction} />
        </Tree>,
      )

      await fireEvent.press(rowOf('First item'), PRESS)

      expect(onRowAction).toHaveBeenCalledTimes(1)
      expect(onAction).not.toHaveBeenCalled()
    })

    it('runs the action while nothing is selected, and selects once something is', async () => {
      const onAction = jest.fn()
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <Tree
          aria-label="Label"
          onAction={onAction}
          onSelectionChange={onSelectionChange}
          selectionMode="multiple"
        >
          {ROWS}
        </Tree>,
      )

      await fireEvent.press(rowOf('First item'), PRESS)
      expect(onAction).toHaveBeenCalledWith('first')
      expect(onSelectionChange).not.toHaveBeenCalled()

      await fireEvent(rowOf('Fifth item'), 'longPress', PRESS)
      expect(keysOf(onSelectionChange)).toEqual(['fifth'])

      await fireEvent.press(rowOf('First item'), PRESS)
      expect(keysOf(onSelectionChange)).toEqual(['fifth', 'first'])
      expect(onAction).toHaveBeenCalledTimes(1)
    })
  })

  describe('disabled rows', () => {
    it.each(['First item', 'Fifth item'])(
      'takes no press, and offers nothing, on a disabled row: %s',
      async (headline) => {
        const onAction = jest.fn()
        const onSelectionChange = jest.fn<(keys: Selection) => void>()
        await render(
          <Tree
            aria-label="Label"
            disabledKeys={FIRST}
            onAction={onAction}
            onSelectionChange={onSelectionChange}
            selectionMode="multiple"
          >
            <Tree.Item headline="First item" id="first">
              <Tree.Item headline="Second item" id="second" />
            </Tree.Item>
            <Tree.Item headline="Fifth item" id="fifth" isDisabled />
          </Tree>,
        )

        const row = screen.getByRole('button', {
          disabled: true,
          name: headline,
        })
        await fireEvent.press(row, PRESS)

        expect(row.props.accessibilityActions).toBeUndefined()
        expect(onAction).not.toHaveBeenCalled()
        expect(onSelectionChange).not.toHaveBeenCalled()
        expect(styleOf(screen.getByText(headline)).color).toBe(FADED)
      },
    )

    it('does not open a disabled row from its chevron', async () => {
      const onExpandedChange = jest.fn<(keys: Set<Key>) => void>()
      await render(
        <Tree
          aria-label="Label"
          disabledKeys={FIRST}
          onExpandedChange={onExpandedChange}
        >
          {ROWS}
        </Tree>,
      )

      const chevron = chevronIn(rowOf('First item'))
      await fireEvent.press(chevron, PRESS)

      expect(onExpandedChange).not.toHaveBeenCalled()
      expect(headlines()).toEqual(['First item', 'Fifth item'])
      expect(chevronColourIn(rowOf('First item'))).toBe(FADED)
    })
  })

  describe('what a screen reader hears', () => {
    it('reports whether a row that opens is open, and nothing on one that does not', async () => {
      await render(
        <Tree
          aria-label="Label"
          defaultExpandedKeys={FIRST}
          selectionMode="multiple"
        >
          {ROWS}
        </Tree>,
      )

      expect(rowOf('First item').props.accessibilityState).toMatchObject({
        expanded: true,
      })
      expect(rowOf('Second item').props.accessibilityState).toMatchObject({
        expanded: false,
      })
      const { accessibilityState }: { accessibilityState?: object } =
        rowOf('Fourth item').props
      expect(accessibilityState).toMatchObject({ expanded: undefined })
    })

    it('reports whether each row is selected', async () => {
      await render(
        <Tree
          aria-label="Label"
          defaultExpandedKeys={FIRST}
          defaultSelectedKeys={SECOND}
          selectionMode="multiple"
        >
          {ROWS}
        </Tree>,
      )

      expect(
        screen.getByRole('button', { name: 'Second item', selected: true }),
      ).toBeOnTheScreen()
      expect(
        screen.getByRole('button', { name: 'First item', selected: false }),
      ).toBeOnTheScreen()
    })
  })

  describe('sections', () => {
    it('heads each section with a heading that sticks, its rows at the top level', async () => {
      await render(
        <Tree aria-label="Label" defaultExpandedKeys={FIRST}>
          <Tree.Section header="Header" id="section">
            <Tree.Item headline="First item" id="first">
              <Tree.Item headline="Second item" id="second" />
            </Tree.Item>
          </Tree.Section>
          <Tree.Item headline="Fifth item" id="fifth" />
        </Tree>,
      )

      expect(header()).toBeOnTheScreen()
      expect(tree().props.stickyHeaderIndices).toEqual([0])
      expect(styleOf(leadOf('First item')).marginStart).toBe(0)
      expect(styleOf(leadOf('Second item')).marginStart).toBe(spacing.xl)
      expect(headlines()).toEqual(['First item', 'Second item', 'Fifth item'])
    })
  })

  describe('loading more', () => {
    it('asks for more once the end of the tree is in view', async () => {
      const onLoadMore = jest.fn()
      await render(
        <Tree aria-label="Label">
          {ROWS}
          <Tree.LoadMore onLoadMore={onLoadMore} />
        </Tree>,
      )

      await fireEvent(tree(), 'layout', LAYOUT)
      await fireEvent(tree(), 'contentSizeChange', 320, 200)

      expect(onLoadMore).toHaveBeenCalledTimes(1)
    })

    it('draws the ring after the rows while loading', async () => {
      await render(
        <Tree aria-label="Label">
          {ROWS}
          <Tree.LoadMore isLoading label="Fetching" testID="loader" />
        </Tree>,
      )

      const loader = screen.getByTestId('loader')

      expect(loader.props['aria-live']).toBe('polite')
      expect(screen.getByRole('progressbar', { name: 'Fetching' })).toBe(
        loader.children.at(0),
      )
    })
  })

  describe('the tree', () => {
    it('is a FlatList taking a style and a ref, drawn on surface', async () => {
      const ref = createRef<FlatList>()
      await render(
        <Tree aria-label="Label" ref={ref} style={CALL_SITE}>
          {ROWS}
        </Tree>,
      )

      expect(ref.current).toBeInstanceOf(FlatList)
      expect(styleOf(tree())).toMatchObject({
        backgroundColor: colors.surface,
        marginTop: 4,
      })
    })
  })
})
