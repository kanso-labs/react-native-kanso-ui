import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { Selection } from 'react-stately'
import type { TestInstance } from 'test-renderer'

import { describe, expect, it, jest } from '@jest/globals'
import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import { createRef } from 'react'
import { FlatList, StyleSheet, Text } from 'react-native'

import { ListBox } from '.'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'
import { Autocomplete } from '../autocomplete'
import { SearchField } from '../search-field'

const { theme } = scopeFor('light', {})
const { colors, sizing, spacing, stateLayerOpacity, typography } = theme

// A press with no point on the page, on an option that measures nothing, so
// the ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// What a screen reader sends when an option's select action is chosen.
const SELECT = { nativeEvent: { actionName: 'select' } }

// Hoisted so each is one stable value per render, which is what react-perf's
// rules are after.
const CALL_SITE = { marginTop: 4 }
const FIRST = ['first']
const ITEMS = [
  { id: 'first', name: 'First item' },
  { id: 'second', name: 'Second item' },
] as const
const LEADING = <Text testID="leading">Lead</Text>
const SECOND = ['second']
const TRAILING = <Text testID="trailing">Trail</Text>

// The options most cases draw, as elements rather than a component of their
// own, since a list reads its parts straight off its children.
const THREE_OPTIONS = [
  <ListBox.Item id="first" key="first">
    First item
  </ListBox.Item>,
  <ListBox.Item id="second" key="second">
    Second item
  </ListBox.Item>,
  <ListBox.Item id="third" key="third">
    Third item
  </ListBox.Item>,
]

const WITH_SUPPORTING = [
  <ListBox.Item id="first" key="first" supporting="Supporting line">
    First item
  </ListBox.Item>,
  <ListBox.Item id="second" key="second" supporting="Supporting line">
    Second item
  </ListBox.Item>,
]

function EmptyState() {
  return <Text>Nothing here</Text>
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

// An option, by the headline that names it.
function optionOf(headline: string) {
  return screen.getByRole('button', { name: new RegExp(headline) })
}

function renderEmptyState() {
  return <EmptyState />
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle & ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

// The text inside an element, in order.
function textOf(element: TestInstance): string {
  return element.children
    .map((child) => (typeof child === 'string' ? child : textOf(child)))
    .join('')
}

describe('ListBox', () => {
  describe('semantics', () => {
    it('is found by its label, and each option by its headline', async () => {
      await render(
        <ListBox aria-label="Label" selectionMode="single">
          {THREE_OPTIONS}
        </ListBox>,
      )

      expect(list()).toBeOnTheScreen()
      for (const headline of ['First item', 'Second item', 'Third item']) {
        expect(optionOf(headline)).toBeOnTheScreen()
      }
    })

    it('draws each option from a function over `items`', async () => {
      await render(
        <ListBox aria-label="Label" items={ITEMS} selectionMode="single">
          {(item) => <ListBox.Item id={item.id}>{item.name}</ListBox.Item>}
        </ListBox>,
      )

      expect(optionOf('First item')).toBeOnTheScreen()
      expect(optionOf('Second item')).toBeOnTheScreen()
    })

    it('draws the row slots inside the option, in order', async () => {
      await render(
        <ListBox aria-label="Label" selectionMode="single">
          <ListBox.Item
            id="first"
            leading={LEADING}
            supporting="Supporting line"
            trailing={TRAILING}
          >
            First item
          </ListBox.Item>
        </ListBox>,
      )

      expect(textOf(optionOf('First item'))).toBe(
        'LeadFirst itemSupporting lineTrail',
      )
    })

    it('reports a disabled option as one', async () => {
      await render(
        <ListBox
          aria-label="Label"
          disabledKeys={SECOND}
          selectionMode="single"
        >
          {THREE_OPTIONS}
        </ListBox>,
      )

      expect(
        screen.getByRole('button', { disabled: true, name: /Second item/ }),
      ).toBeOnTheScreen()
      expect(
        screen.getByRole('button', { disabled: false, name: /First item/ }),
      ).toBeOnTheScreen()
    })

    it('presents an option with nothing to do on a press, with no role', async () => {
      await render(<ListBox aria-label="Label">{THREE_OPTIONS}</ListBox>)

      expect(screen.getByText('First item')).toBeOnTheScreen()
      expect(screen.queryByRole('button')).toBe(null)
    })
  })

  describe('selection', () => {
    it('selects one option at a time, and says which', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <ListBox
          aria-label="Label"
          onSelectionChange={onSelectionChange}
          selectionMode="single"
        >
          {THREE_OPTIONS}
        </ListBox>,
      )

      await fireEvent.press(optionOf('First item'), PRESS)
      expect(keysOf(onSelectionChange)).toEqual(['first'])

      await fireEvent.press(optionOf('Second item'), PRESS)
      expect(keysOf(onSelectionChange)).toEqual(['second'])
      expect(
        screen.getByRole('button', { name: /Second item/, selected: true }),
      ).toBeOnTheScreen()
      expect(
        screen.getByRole('button', { name: /First item/, selected: false }),
      ).toBeOnTheScreen()
    })

    it('toggles more than one when asked', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <ListBox
          aria-label="Label"
          onSelectionChange={onSelectionChange}
          selectionMode="multiple"
        >
          {THREE_OPTIONS}
        </ListBox>,
      )

      await fireEvent.press(optionOf('First item'), PRESS)
      await fireEvent.press(optionOf('Second item'), PRESS)
      expect(keysOf(onSelectionChange)).toEqual(['first', 'second'])

      await fireEvent.press(optionOf('First item'), PRESS)
      expect(keysOf(onSelectionChange)).toEqual(['second'])
    })

    it('keeps its own selection from defaultSelectedKeys', async () => {
      await render(
        <ListBox
          aria-label="Label"
          defaultSelectedKeys={SECOND}
          selectionMode="single"
        >
          {THREE_OPTIONS}
        </ListBox>,
      )

      expect(
        screen.getByRole('button', { name: /Second item/, selected: true }),
      ).toBeOnTheScreen()
    })

    it('does not select on its own when controlled', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <ListBox
          aria-label="Label"
          onSelectionChange={onSelectionChange}
          selectedKeys={FIRST}
          selectionMode="single"
        >
          {THREE_OPTIONS}
        </ListBox>,
      )

      await fireEvent.press(optionOf('Second item'), PRESS)

      expect(onSelectionChange).toHaveBeenCalledTimes(1)
      expect(
        screen.getByRole('button', { name: /First item/, selected: true }),
      ).toBeOnTheScreen()
      expect(
        screen.getByRole('button', { name: /Second item/, selected: false }),
      ).toBeOnTheScreen()
    })

    it('leaves a disabled option unselectable', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <ListBox
          aria-label="Label"
          disabledKeys={SECOND}
          onSelectionChange={onSelectionChange}
          selectionMode="single"
        >
          {THREE_OPTIONS}
        </ListBox>,
      )

      await fireEvent.press(optionOf('Second item'), PRESS)

      expect(onSelectionChange).not.toHaveBeenCalled()
    })
  })

  describe('actions', () => {
    it("runs the list's onAction with the option's key on a press", async () => {
      const onAction = jest.fn()
      await render(
        <ListBox aria-label="Label" onAction={onAction}>
          {THREE_OPTIONS}
        </ListBox>,
      )

      await fireEvent.press(optionOf('Second item'), PRESS)

      expect(onAction).toHaveBeenCalledTimes(1)
      expect(onAction).toHaveBeenCalledWith('second')
    })

    it('runs the action while nothing is selected, and selects once something is', async () => {
      const onAction = jest.fn()
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <ListBox
          aria-label="Label"
          onAction={onAction}
          onSelectionChange={onSelectionChange}
          selectionMode="multiple"
        >
          {THREE_OPTIONS}
        </ListBox>,
      )

      await fireEvent.press(optionOf('First item'), PRESS)
      expect(onAction).toHaveBeenCalledWith('first')
      expect(onSelectionChange).not.toHaveBeenCalled()

      await fireEvent(optionOf('First item'), 'longPress', PRESS)
      expect(keysOf(onSelectionChange)).toEqual(['first'])

      await fireEvent.press(optionOf('Second item'), PRESS)
      expect(keysOf(onSelectionChange)).toEqual(['first', 'second'])
      expect(onAction).toHaveBeenCalledTimes(1)
    })
  })

  describe('a screen reader', () => {
    // A press on an option already selects it, so a second way to do the
    // same thing would only lengthen the actions a reader lists.
    it('offers no select action where a press selects', async () => {
      await render(
        <ListBox aria-label="Label" selectionMode="multiple">
          {THREE_OPTIONS}
        </ListBox>,
      )

      expect(optionOf('First item').props.accessibilityActions).toBeUndefined()
    })

    it('offers one, named by selectLabel, where a press may run an action', async () => {
      await render(
        <ListBox
          aria-label="Label"
          onAction={jest.fn()}
          selectionMode="multiple"
        >
          {THREE_OPTIONS}
        </ListBox>,
      )

      expect(optionOf('First item').props.accessibilityActions).toEqual([
        { label: 'Select', name: 'select' },
      ])

      await render(
        <ListBox
          aria-label="Label"
          onAction={jest.fn()}
          selectionMode="multiple"
          selectLabel="Choose"
        >
          {THREE_OPTIONS}
        </ListBox>,
      )

      expect(optionOf('First item').props.accessibilityActions).toEqual([
        { label: 'Choose', name: 'select' },
      ])
    })

    it('selects an option from the select action', async () => {
      const onAction = jest.fn()
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <ListBox
          aria-label="Label"
          onAction={onAction}
          onSelectionChange={onSelectionChange}
          selectionMode="multiple"
        >
          {THREE_OPTIONS}
        </ListBox>,
      )

      await fireEvent(optionOf('Third item'), 'accessibilityAction', SELECT)

      expect(keysOf(onSelectionChange)).toEqual(['third'])
      expect(onAction).not.toHaveBeenCalled()
    })

    it('offers nothing on a disabled option', async () => {
      await render(
        <ListBox
          aria-label="Label"
          disabledKeys={SECOND}
          onAction={jest.fn()}
          selectionMode="multiple"
        >
          {THREE_OPTIONS}
        </ListBox>,
      )

      expect(optionOf('Second item').props.accessibilityActions).toBeUndefined()
    })
  })

  describe('appearance', () => {
    // The lists page's row: a 56dp floor with 16 either side, and a
    // supporting line moving it to the two-line height.
    it('draws the row height and inset of the lists page', async () => {
      await render(
        <ListBox aria-label="Label" selectionMode="single">
          <ListBox.Item id="first">First item</ListBox.Item>
          <ListBox.Item id="second" supporting="Supporting line">
            Second item
          </ListBox.Item>
        </ListBox>,
      )

      expect(styleOf(optionOf('First item'))).toMatchObject({
        minHeight: sizing.rowSm,
        paddingHorizontal: spacing.lg,
      })
      expect(styleOf(optionOf('Second item')).minHeight).toBe(sizing.rowMd)
      expect(styleOf(screen.getByText('First item'))).toMatchObject({
        color: colors.onSurface,
        fontSize: typography.bodyLargeSize,
      })
    })

    it('draws a selected option on primary container, with no checkbox', async () => {
      await render(
        <ListBox
          aria-label="Label"
          defaultSelectedKeys={SECOND}
          selectionMode="multiple"
        >
          {THREE_OPTIONS}
        </ListBox>,
      )

      const selected = optionOf('Second item')

      expect(styleOf(selected).backgroundColor).toBe(colors.primaryContainer)
      expect(styleOf(optionOf('First item')).backgroundColor).toBeUndefined()
      expect(styleOf(screen.getByText('Second item')).color).toBe(
        colors.onPrimaryContainer,
      )
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
      expect(
        selected.queryAll((node) => node.type === 'RNSVGPath'),
      ).toHaveLength(0)
    })

    // The muted role a supporting line takes on the surface is a second
    // colour family over a selected option's container, so there it takes
    // the container's content role, as the headline does.
    it('draws a selected supporting line in the selected content role', async () => {
      await render(
        <ListBox
          aria-label="Label"
          defaultSelectedKeys={SECOND}
          selectionMode="single"
        >
          {WITH_SUPPORTING}
        </ListBox>,
      )

      const [unselected, selected] = screen.getAllByText('Supporting line')

      expect(styleOf(selected).color).toBe(colors.onPrimaryContainer)
      expect(styleOf(unselected).color).toBe(colors.onSurfaceVariant)
    })

    it('fades a disabled option, its supporting line with it', async () => {
      await render(
        <ListBox
          aria-label="Label"
          disabledKeys={SECOND}
          selectionMode="single"
        >
          {WITH_SUPPORTING}
        </ListBox>,
      )

      const faded = withOpacity(
        colors.onSurface,
        stateLayerOpacity.disabledContent,
      )
      const [, disabled] = screen.getAllByText('Supporting line')

      expect(styleOf(screen.getByText('Second item')).color).toBe(faded)
      expect(styleOf(disabled).color).toBe(faded)
    })

    // No ground of its own, so the same list draws correctly on a page and
    // inside a popover, with the 8dp above and below its rows.
    it('insets the rows without a colour of its own', async () => {
      await render(
        <ListBox aria-label="Label" selectionMode="single">
          {THREE_OPTIONS}
        </ListBox>,
      )

      expect(styleOf(list()).backgroundColor).toBeUndefined()
      expect(
        StyleSheet.flatten(list().props.contentContainerStyle),
      ).toMatchObject({ paddingVertical: spacing.sm })
    })
  })

  describe('sections', () => {
    it('heads a section in title small and the muted role', async () => {
      await render(
        <ListBox aria-label="Label" selectionMode="single">
          <ListBox.Section header="First group" id="first-group">
            <ListBox.Item id="first">First item</ListBox.Item>
          </ListBox.Section>
        </ListBox>,
      )

      expect(
        styleOf(screen.getByRole('heading', { name: 'First group' })),
      ).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.titleSmallSize,
        paddingHorizontal: spacing.lg,
      })
      expect(optionOf('First item')).toBeOnTheScreen()
    })

    // A header that sticks covers the rows under it with a ground, and the
    // list has none, so its headers scroll with the options.
    it('scrolls its headers with the options, on no ground', async () => {
      await render(
        <ListBox aria-label="Label" selectionMode="single">
          <ListBox.Item id="zero">Item</ListBox.Item>
          <ListBox.Section header="First group" id="first-group">
            <ListBox.Item id="first">First item</ListBox.Item>
          </ListBox.Section>
        </ListBox>,
      )

      const heading = screen.getByRole('heading', { name: 'First group' })

      // A List names the header's index here, 1, which is what makes it stick.
      expect(list().props.stickyHeaderIndices).toEqual([])
      expect(styleOf(heading.parent ?? heading).backgroundColor).toBeUndefined()
    })

    it('draws no heading for a section without one', async () => {
      await render(
        <ListBox aria-label="Label" selectionMode="single">
          <ListBox.Section id="section">
            <ListBox.Item id="first">First item</ListBox.Item>
          </ListBox.Section>
        </ListBox>,
      )

      expect(screen.queryByRole('heading')).toBe(null)
      expect(optionOf('First item')).toBeOnTheScreen()
    })
  })

  describe('empty', () => {
    it('says there are no results when it has no options', async () => {
      await render(<ListBox aria-label="Label" />)

      expect(screen.getByText('No results')).toBeOnTheScreen()
    })

    it('draws renderEmptyState in its place', async () => {
      await render(
        <ListBox aria-label="Label" renderEmptyState={renderEmptyState} />,
      )

      expect(screen.getByText('Nothing here')).toBeOnTheScreen()
      expect(screen.queryByText('No results')).toBe(null)
    })
  })

  describe('loading more', () => {
    it('draws the ring while it is loading', async () => {
      await render(
        <ListBox aria-label="Label">
          {THREE_OPTIONS}
          <ListBox.LoadMore isLoading />
        </ListBox>,
      )

      expect(
        screen.getByRole('progressbar', { name: 'Loading more' }),
      ).toBeOnTheScreen()
    })

    it('takes a label of its own', async () => {
      await render(
        <ListBox aria-label="Label">
          {THREE_OPTIONS}
          <ListBox.LoadMore isLoading label="Fetching" />
        </ListBox>,
      )

      expect(
        screen.getByRole('progressbar', { name: 'Fetching' }),
      ).toBeOnTheScreen()
    })
  })

  describe('in an Autocomplete', () => {
    it('shows the options the search keeps', async () => {
      await render(
        <Autocomplete>
          <SearchField label="Search" />
          <ListBox aria-label="Label" selectionMode="single">
            {THREE_OPTIONS}
          </ListBox>
        </Autocomplete>,
      )

      await fireEvent.changeText(
        screen.getByRole('searchbox', { name: 'Search' }),
        'second',
      )

      expect(within(list()).getAllByRole('button').map(textOf)).toEqual([
        'Second item',
      ])
    })
  })

  describe('the call site', () => {
    it('lands style and ref on the FlatList', async () => {
      const ref = createRef<FlatList>()
      await render(
        <ListBox aria-label="Label" ref={ref} style={CALL_SITE}>
          {THREE_OPTIONS}
        </ListBox>,
      )

      expect(ref.current).toBeInstanceOf(FlatList)
      expect(styleOf(list())).toEqual(CALL_SITE)
    })

    it("keeps the call site's onLayout", async () => {
      const onLayout = jest.fn()
      const layout = { height: 168, width: 320, x: 0, y: 0 }
      await render(
        <ListBox aria-label="Label" onLayout={onLayout}>
          {THREE_OPTIONS}
        </ListBox>,
      )

      await fireEvent(list(), 'layout', { nativeEvent: { layout } })

      expect(onLayout).toHaveBeenCalledWith({ nativeEvent: { layout } })
    })

    it("lands an option's style and testID on the option", async () => {
      await render(
        <ListBox aria-label="Label" selectionMode="single">
          <ListBox.Item id="first" style={CALL_SITE} testID="option">
            First item
          </ListBox.Item>
        </ListBox>,
      )

      expect(styleOf(screen.getByTestId('option'))).toMatchObject({
        marginTop: 4,
        minHeight: sizing.rowSm,
      })
    })
  })
})
