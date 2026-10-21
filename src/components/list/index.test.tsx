import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { Key, Selection } from 'react-stately'
import type { TestInstance, TestNode } from 'test-renderer'

import { describe, expect, it, jest } from '@jest/globals'
import { checkPath } from '@kanso-labs/kanso-ui-core/glyphs'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import {
  AccessibilityInfo,
  FlatList,
  Platform,
  StyleSheet,
  Text,
} from 'react-native'

import { List } from '.'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const { colors, sizing, typography } = theme

// A press with no point on the page, on a row that measures nothing, so the
// ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// What a screen reader sends when the row's select action is chosen.
const SELECT = { nativeEvent: { actionName: 'select' } }

// A list laid out taller than its rows, which is a list whose end is in
// view as soon as it is drawn.
const LAYOUT = {
  nativeEvent: { layout: { height: 400, width: 320, x: 0, y: 0 } },
}

// Hoisted so each is one stable value per render, which is what react-perf's
// rules are after.
const CALL_SITE = { marginTop: 4 }
const FIRST = ['first']
const GROUND = { backgroundColor: '#fdf6e3' }
const ITEMS = [
  { id: 'first', name: 'First item' },
  { id: 'second', name: 'Second item' },
] as const
const LEADING = <Text testID="leading">Lead</Text>
const SECOND = ['second']

// The rows most cases draw, as elements rather than a component of their
// own, since a list reads its parts straight off its children.
const THREE_ROWS = [
  <List.Item id="first" key="first">
    First item
  </List.Item>,
  <List.Item id="second" key="second">
    Second item
  </List.Item>,
  <List.Item id="third" key="third">
    Third item
  </List.Item>,
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
    (node) => node.type === 'RNSVGPath' && node.props.d === checkPath,
  )
}

function EmptyState() {
  return <Text>Nothing here</Text>
}

function header() {
  return screen.getByRole('heading', { name: 'Header' })
}

// A node of the tree that is an element rather than text.
function instance(node: null | TestNode | undefined): TestInstance {
  if (node === null || node === undefined || typeof node === 'string') {
    throw new TypeError('expected an element')
  }
  return node
}

// The keys the latest change reported, in order.
function keysOf(onSelectionChange: jest.Mock<(keys: Selection) => void>) {
  const keys = onSelectionChange.mock.calls.at(-1)?.[0]

  if (keys === undefined || keys === 'all') {
    throw new TypeError('expected a set of keys')
  }
  return [...keys].map(String).toSorted()
}

function list() {
  return screen.getByLabelText('Label')
}

// The press of its own a checkbox takes on a row whose press acts.
function pressableBoxIn(element: TestInstance) {
  const box = element
    .queryAll(
      (node) =>
        node.props.accessible === false &&
        typeof node.props.onClick === 'function',
    )
    .at(0)

  if (box === undefined) {
    throw new TypeError('expected a pressable checkbox')
  }
  return box
}

function renderEmptyState() {
  return <EmptyState />
}

// A row, by the headline that names it.
function rowOf(headline: string) {
  return screen.getByRole('button', { name: new RegExp(headline) })
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle & ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

describe('List', () => {
  describe('naming', () => {
    it('is found by its label, and each row by its headline', async () => {
      await render(
        <List aria-label="Label" onAction={jest.fn()}>
          {THREE_ROWS}
        </List>,
      )

      expect(list()).toBeOnTheScreen()
      for (const headline of ['First item', 'Second item', 'Third item']) {
        expect(rowOf(headline)).toBeOnTheScreen()
      }
    })

    it('draws each row from a function over `items`', async () => {
      await render(
        <List aria-label="Label" items={ITEMS}>
          {(item) => <List.Item id={item.id}>{item.name}</List.Item>}
        </List>,
      )

      expect(screen.getByText('First item')).toBeOnTheScreen()
      expect(screen.getByText('Second item')).toBeOnTheScreen()
    })
  })

  describe('rows', () => {
    it("draws each row as ListItem does, at the line count's height", async () => {
      await render(
        <List aria-label="Label" onAction={jest.fn()}>
          <List.Item id="first">First item</List.Item>
          <List.Item id="second" supporting="Supporting line">
            Second item
          </List.Item>
        </List>,
      )

      expect(styleOf(rowOf('First item'))).toMatchObject({
        minHeight: sizing.rowSm,
      })
      expect(styleOf(rowOf('Second item'))).toMatchObject({
        minHeight: sizing.rowMd,
      })
      expect(styleOf(screen.getByText('First item'))).toMatchObject({
        color: colors.onSurface,
        fontSize: typography.bodyLargeSize,
      })
    })

    it('presents a row with nothing to do on a press, with no role', async () => {
      await render(<List aria-label="Label">{THREE_ROWS}</List>)

      expect(screen.getByText('First item')).toBeOnTheScreen()
      expect(screen.queryByRole('button')).toBe(null)
    })

    it("lands a row's style and testID on the row", async () => {
      await render(
        <List aria-label="Label" onAction={jest.fn()}>
          <List.Item id="first" style={CALL_SITE} testID="row">
            First item
          </List.Item>
        </List>,
      )

      expect(styleOf(screen.getByTestId('row'))).toMatchObject({
        marginTop: 4,
        minHeight: sizing.rowSm,
      })
    })
  })

  describe('actions', () => {
    it("runs the list's onAction with the row's key on a press", async () => {
      const onAction = jest.fn()
      await render(
        <List aria-label="Label" onAction={onAction}>
          {THREE_ROWS}
        </List>,
      )

      await fireEvent.press(rowOf('Second item'), PRESS)

      expect(onAction).toHaveBeenCalledTimes(1)
      expect(onAction).toHaveBeenCalledWith('second')
    })

    it("runs a row's own onAction in place of the list's", async () => {
      const onAction = jest.fn()
      const onRowAction = jest.fn()
      await render(
        <List aria-label="Label" onAction={onAction}>
          <List.Item id="first" onAction={onRowAction}>
            First item
          </List.Item>
        </List>,
      )

      await fireEvent.press(rowOf('First item'), PRESS)

      expect(onRowAction).toHaveBeenCalledTimes(1)
      expect(onAction).not.toHaveBeenCalled()
    })
  })

  describe('selection', () => {
    it('selects one row at a time in single mode, and says which', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <List
          aria-label="Label"
          onSelectionChange={onSelectionChange}
          selectionMode="single"
        >
          {THREE_ROWS}
        </List>,
      )

      await fireEvent.press(rowOf('First item'), PRESS)
      expect(keysOf(onSelectionChange)).toEqual(['first'])

      await fireEvent.press(rowOf('Second item'), PRESS)
      expect(keysOf(onSelectionChange)).toEqual(['second'])
      expect(
        screen.getByRole('button', { name: /Second item/, selected: true }),
      ).toBeOnTheScreen()
      expect(
        screen.getByRole('button', { name: /First item/, selected: false }),
      ).toBeOnTheScreen()
    })

    it('adds and takes away rows in multiple mode', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <List
          aria-label="Label"
          onSelectionChange={onSelectionChange}
          selectionMode="multiple"
        >
          {THREE_ROWS}
        </List>,
      )

      await fireEvent.press(rowOf('First item'), PRESS)
      await fireEvent.press(rowOf('Second item'), PRESS)
      expect(keysOf(onSelectionChange)).toEqual(['first', 'second'])

      await fireEvent.press(rowOf('First item'), PRESS)
      expect(keysOf(onSelectionChange)).toEqual(['second'])
    })

    it('keeps the selection the call site holds', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <List
          aria-label="Label"
          onSelectionChange={onSelectionChange}
          selectedKeys={FIRST}
          selectionMode="single"
        >
          {THREE_ROWS}
        </List>,
      )

      await fireEvent.press(rowOf('Second item'), PRESS)

      expect(keysOf(onSelectionChange)).toEqual(['second'])
      expect(
        screen.getByRole('button', { name: /First item/, selected: true }),
      ).toBeOnTheScreen()
    })

    it('draws a checkbox on every row, checked on a selected one, on primary container', async () => {
      await render(
        <List
          aria-label="Label"
          defaultSelectedKeys={FIRST}
          selectionMode="multiple"
        >
          {THREE_ROWS}
        </List>,
      )

      expect(boxesIn(rowOf('First item'))).toHaveLength(1)
      expect(checksIn(rowOf('First item'))).toHaveLength(1)
      expect(boxesIn(rowOf('Second item'))).toHaveLength(1)
      expect(checksIn(rowOf('Second item'))).toHaveLength(0)
      expect(styleOf(rowOf('First item')).backgroundColor).toBe(
        colors.primaryContainer,
      )
      expect(styleOf(rowOf('Second item')).backgroundColor).toBeUndefined()
      expect(styleOf(screen.getByText('First item')).color).toBe(
        colors.onPrimaryContainer,
      )
    })

    it('draws no checkbox on a list that does not select', async () => {
      await render(
        <List aria-label="Label" onAction={jest.fn()}>
          {THREE_ROWS}
        </List>,
      )

      expect(boxesIn(list())).toHaveLength(0)
    })

    it('draws the checkbox before whatever the leading slot holds', async () => {
      await render(
        <List aria-label="Label" selectionMode="multiple">
          <List.Item id="first" leading={LEADING}>
            First item
          </List.Item>
        </List>,
      )

      const lead = instance(screen.getByTestId('leading').parent)

      expect(lead.children).toHaveLength(2)
      expect(boxesIn(instance(lead.children.at(0)))).toHaveLength(1)
      expect(lead.children.at(1)).toBe(screen.getByTestId('leading'))
    })

    it('names the select action by selectLabel, and in the device language otherwise', async () => {
      await render(
        <List aria-label="Label" selectionMode="multiple">
          {THREE_ROWS}
        </List>,
      )

      expect(rowOf('First item').props.accessibilityActions).toEqual([
        { label: 'Select', name: 'select' },
      ])

      await render(
        <List aria-label="Label" selectionMode="multiple" selectLabel="Choose">
          {THREE_ROWS}
        </List>,
      )

      expect(rowOf('First item').props.accessibilityActions).toEqual([
        { label: 'Choose', name: 'select' },
      ])
    })

    it('selects a row from the select action', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <List
          aria-label="Label"
          onSelectionChange={onSelectionChange}
          selectionMode="multiple"
        >
          {THREE_ROWS}
        </List>,
      )

      await fireEvent(rowOf('Third item'), 'accessibilityAction', SELECT)

      expect(keysOf(onSelectionChange)).toEqual(['third'])
    })

    it('runs the action while nothing is selected, and selects once something is', async () => {
      const onAction = jest.fn()
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <List
          aria-label="Label"
          onAction={onAction}
          onSelectionChange={onSelectionChange}
          selectionMode="multiple"
        >
          {THREE_ROWS}
        </List>,
      )

      await fireEvent.press(rowOf('First item'), PRESS)
      expect(onAction).toHaveBeenCalledWith('first')
      expect(onSelectionChange).not.toHaveBeenCalled()

      await fireEvent(rowOf('First item'), 'longPress', PRESS)
      expect(keysOf(onSelectionChange)).toEqual(['first'])

      await fireEvent.press(rowOf('Second item'), PRESS)
      expect(keysOf(onSelectionChange)).toEqual(['first', 'second'])
      expect(onAction).toHaveBeenCalledTimes(1)
    })

    it('selects through the checkbox on a row whose press acts', async () => {
      const onAction = jest.fn()
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <List
          aria-label="Label"
          onAction={onAction}
          onSelectionChange={onSelectionChange}
          selectionMode="multiple"
        >
          {THREE_ROWS}
        </List>,
      )

      await fireEvent.press(pressableBoxIn(rowOf('Second item')), PRESS)

      expect(keysOf(onSelectionChange)).toEqual(['second'])
      expect(onAction).not.toHaveBeenCalled()
    })

    it.each(['Second item', 'Fourth item'])(
      'takes no press and offers no selection on a disabled row: %s',
      async (headline) => {
        const onAction = jest.fn()
        const onSelectionChange = jest.fn<(keys: Selection) => void>()
        await render(
          <List
            aria-label="Label"
            disabledKeys={SECOND}
            onAction={onAction}
            onSelectionChange={onSelectionChange}
            selectionMode="multiple"
          >
            {THREE_ROWS}
            <List.Item id="fourth" isDisabled>
              Fourth item
            </List.Item>
          </List>,
        )

        const row = screen.getByRole('button', {
          disabled: true,
          name: new RegExp(headline),
        })
        await fireEvent.press(row, PRESS)

        expect(row.props.accessibilityActions).toBeUndefined()
        expect(onAction).not.toHaveBeenCalled()
        expect(onSelectionChange).not.toHaveBeenCalled()
      },
    )
  })

  describe('sections', () => {
    it('heads each section with a heading that sticks', async () => {
      await render(
        <List aria-label="Label">
          <List.Item id="zero">Item</List.Item>
          <List.Section header="Header" id="section">
            <List.Item id="first">First item</List.Item>
            <List.Item id="second">Second item</List.Item>
          </List.Section>
        </List>,
      )

      expect(styleOf(header())).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.titleSmallSize,
      })
      expect(list().props.stickyHeaderIndices).toEqual([1])
      expect(screen.getByText('Second item')).toBeOnTheScreen()
    })

    it("covers the rows under it with the list's ground", async () => {
      await render(
        <List aria-label="Label">
          <List.Section header="Header" id="section">
            <List.Item id="first">First item</List.Item>
          </List.Section>
        </List>,
      )

      expect(styleOf(list()).backgroundColor).toBe(colors.surface)
      expect(styleOf(header().parent ?? header())).toMatchObject({
        backgroundColor: colors.surface,
      })

      await render(
        <List aria-label="Label" style={GROUND}>
          <List.Section header="Header" id="section">
            <List.Item id="first">First item</List.Item>
          </List.Section>
        </List>,
      )

      expect(styleOf(list()).backgroundColor).toBe(GROUND.backgroundColor)
      expect(styleOf(header().parent ?? header())).toMatchObject(GROUND)
    })

    it('draws a section with no header as its rows alone', async () => {
      await render(
        <List aria-label="Label">
          <List.Section id="section">
            <List.Item id="first">First item</List.Item>
          </List.Section>
        </List>,
      )

      expect(screen.queryByRole('heading')).toBe(null)
      expect(list().props.stickyHeaderIndices).toEqual([])
      expect(screen.getByText('First item')).toBeOnTheScreen()
    })
  })

  describe('empty', () => {
    it('says there are no results when it has no rows', async () => {
      await render(<List aria-label="Label" />)

      expect(screen.getByText('No results')).toBeOnTheScreen()
    })

    it('draws renderEmptyState in its place', async () => {
      await render(
        <List aria-label="Label" renderEmptyState={renderEmptyState} />,
      )

      expect(screen.getByText('Nothing here')).toBeOnTheScreen()
      expect(screen.queryByText('No results')).toBe(null)
    })

    it('says nothing is there while the first rows are loading', async () => {
      await render(
        <List aria-label="Label">
          <List.LoadMore isLoading />
        </List>,
      )

      expect(screen.queryByText('No results')).toBe(null)
      expect(
        screen.getByRole('progressbar', { name: 'Loading more' }),
      ).toBeOnTheScreen()
    })
  })

  describe('loading more', () => {
    it('asks for more once the end of the list is in view', async () => {
      const onLoadMore = jest.fn()
      await render(
        <List aria-label="Label">
          {THREE_ROWS}
          <List.LoadMore onLoadMore={onLoadMore} />
        </List>,
      )

      await fireEvent(list(), 'layout', LAYOUT)
      await fireEvent(list(), 'contentSizeChange', 320, 200)

      expect(onLoadMore).toHaveBeenCalledTimes(1)
    })

    it('asks for nothing while a load is under way', async () => {
      const onLoadMore = jest.fn()
      await render(
        <List aria-label="Label">
          {THREE_ROWS}
          <List.LoadMore isLoading onLoadMore={onLoadMore} />
        </List>,
      )

      await fireEvent(list(), 'layout', LAYOUT)
      await fireEvent(list(), 'contentSizeChange', 320, 200)

      expect(onLoadMore).not.toHaveBeenCalled()
    })

    it('draws the ring after the rows while loading, in a live region', async () => {
      await render(
        <List aria-label="Label">
          {THREE_ROWS}
          <List.LoadMore isLoading label="Fetching" testID="loader" />
        </List>,
      )

      const loader = screen.getByTestId('loader')

      expect(loader.props['aria-live']).toBe('polite')
      expect(styleOf(loader).minHeight).toBe(sizing.rowSm)
      expect(screen.getByRole('progressbar', { name: 'Fetching' })).toBe(
        loader.children.at(0),
      )
      // Named rather than labelled: the ring stands alone in its row.
      expect(screen.queryByText('Fetching')).toBe(null)
    })

    it('keeps the live region, empty, while idle', async () => {
      await render(
        <List aria-label="Label">
          {THREE_ROWS}
          <List.LoadMore testID="loader" />
        </List>,
      )

      const loader = screen.getByTestId('loader')

      expect(loader.props['aria-live']).toBe('polite')
      expect(loader.children).toHaveLength(0)
      expect(styleOf(loader).height).toBe(0)
    })

    it('says the ring on iOS as it appears, and not as the list mounts', async () => {
      jest.replaceProperty(Platform, 'OS', 'ios')
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation(() => undefined)
      const { rerender } = await render(
        <List aria-label="Label">
          {THREE_ROWS}
          <List.LoadMore isLoading />
        </List>,
      )

      expect(announce).not.toHaveBeenCalled()

      await rerender(
        <List aria-label="Label">
          {THREE_ROWS}
          <List.LoadMore />
        </List>,
      )
      await rerender(
        <List aria-label="Label">
          {THREE_ROWS}
          <List.LoadMore isLoading />
        </List>,
      )

      expect(announce).toHaveBeenCalledTimes(1)
      expect(announce).toHaveBeenCalledWith('Loading more')
    })
  })

  describe('the list', () => {
    it('is a FlatList taking a style and a ref, drawn on surface', async () => {
      const ref = createRef<FlatList>()
      await render(
        <List aria-label="Label" ref={ref} style={CALL_SITE}>
          {THREE_ROWS}
        </List>,
      )

      expect(ref.current).toBeInstanceOf(FlatList)
      expect(styleOf(list())).toMatchObject({
        backgroundColor: colors.surface,
        marginTop: 4,
      })
    })

    it('reports a key the way the call site wrote it', async () => {
      const onAction = jest.fn<(key: Key) => void>()
      await render(
        <List aria-label="Label" onAction={onAction}>
          <List.Item id={7}>First item</List.Item>
        </List>,
      )

      await fireEvent.press(rowOf('First item'), PRESS)

      expect(onAction).toHaveBeenCalledWith(7)
    })
  })
})
