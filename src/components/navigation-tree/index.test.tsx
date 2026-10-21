import type { ReactNode } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { Key } from 'react-stately'
import type { TestInstance, TestNode } from 'test-renderer'

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { chevronEndPath } from '@kanso-labs/kanso-ui-core/glyphs'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { FlatList, Linking, Platform, StyleSheet, Text } from 'react-native'

import type { KuiTheme } from '../../tokens/defaults'

import { NavigationTree } from '.'
import { RouterProvider } from '../../router'
import { ThemeScope } from '../../theme-scope'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'
import { nativeWeight } from '../../typography/roles'

const { theme } = scopeFor('light', {})
const { colors, radii, sizing, spacing, stateLayerOpacity, typography } = theme

const FADED = withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)
const BOLD = nativeWeight(typography.weightBold)
const OS = Platform.OS

// A press with no point on the page, on a row that measures nothing, so the
// ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// What a screen reader sends when one of a row's actions is chosen.
const COLLAPSE = { nativeEvent: { actionName: 'collapse' } }
const EXPAND = { nativeEvent: { actionName: 'expand' } }

// Hoisted so each is one stable value per render, which is what react-perf's
// rules are after.
const CALL_SITE = { marginTop: 4 }
// A label large set apart from title small, which the default tokens give
// the same values, so a heading in the wrong one of the two shows.
const LABEL_APART: KuiTheme = {
  '--kui-typography-label-large-line-height': '22px',
  '--kui-typography-label-large-size': '15px',
}
const FIRST = ['first']
const FIRST_AND_SECOND = ['first', 'second']
const ITEMS = [
  { href: '/first', id: 'first', name: 'First item' },
  { href: '/second', id: 'second', name: 'Second item' },
] as const
const LABEL = <Text testID="label">First item</Text>
const LEADING = <Text testID="leading">Lead</Text>
const TRAILING = <Text testID="trailing">01</Text>

// The rows most cases draw: a row with a row under it, which has one of its
// own, a second row under the first, and a row on its own, each a link.
const ROWS = [
  <NavigationTree.Item href="/first" id="first" key="first" label="First item">
    <NavigationTree.Item href="/second" id="second" label="Second item">
      <NavigationTree.Item href="/third" id="third" label="Third item" />
    </NavigationTree.Item>
    <NavigationTree.Item href="/fourth" id="fourth" label="Fourth item" />
  </NavigationTree.Item>,
  <NavigationTree.Item
    href="/fifth"
    id="fifth"
    key="fifth"
    label="Fifth item"
  />,
]

// The preset already mocks `Linking`, and a spy on a mock is that same mock,
// so its calls outlive a restore and are cleared as well.
afterEach(() => {
  Platform.OS = OS
  jest.restoreAllMocks()
  jest.clearAllMocks()
})

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
            (each) =>
              each.type === 'RNSVGPath' && each.props.d === chevronEndPath,
          )
          .at(0) !== undefined,
    )
    .at(-1)

  if (chevron === undefined) {
    throw new TypeError('expected a chevron')
  }
  return chevron
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
function keysOf(onChange: jest.Mock<(keys: Set<Key>) => void>) {
  const keys = onChange.mock.calls.at(-1)?.[0]

  if (keys === undefined) {
    throw new TypeError('expected a set of keys')
  }
  return [...keys].map(String).toSorted()
}

// The labels drawn, top to bottom.
function labels() {
  return screen
    .queryAllByText(/item$/)
    .map((node) =>
      node.children
        .map((child) => (typeof child === 'string' ? child : ''))
        .join(''),
    )
}

// The view a row's chevron and leading content sit in, which its depth sets
// in.
function leadOf(label: string) {
  const lead = rowOf(label)
    .queryAll((node) => styleOf(node).marginStart !== undefined)
    .at(0)

  if (lead === undefined) {
    throw new TypeError('expected a lead')
  }
  return lead
}

function Routed({
  children,
  navigate,
}: {
  readonly children: ReactNode
  readonly navigate: (href: string) => void
}) {
  return <RouterProvider navigate={navigate}>{children}</RouterProvider>
}

// A row, by the label that names it, whether it leads, presses or presents.
function rowOf(label: string): TestInstance {
  const name = new RegExp(label)
  const pressable =
    screen.queryByRole('link', { name }) ??
    screen.queryByRole('button', { name })

  if (pressable !== null) {
    return pressable
  }

  let node = instance(screen.getByText(label).parent)
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

describe('NavigationTree', () => {
  describe('naming', () => {
    it('is found by its label, and each row as a link by its label', async () => {
      await render(
        <NavigationTree aria-label="Label" defaultExpandedKeys={FIRST}>
          {ROWS}
        </NavigationTree>,
      )

      expect(tree()).toBeOnTheScreen()
      expect(
        screen.getByRole('link', { expanded: true, name: 'First item' }),
      ).toBeOnTheScreen()
      expect(
        screen.getByRole('link', { expanded: false, name: 'Second item' }),
      ).toBeOnTheScreen()
      expect(
        screen.getByRole('link', { name: 'Fourth item' }),
      ).toBeOnTheScreen()
    })

    it('draws each row from a function over `items`', async () => {
      await render(
        <NavigationTree aria-label="Label" items={ITEMS}>
          {(item) => (
            <NavigationTree.Item
              href={item.href}
              id={item.id}
              label={item.name}
            />
          )}
        </NavigationTree>,
      )

      expect(labels()).toEqual(['First item', 'Second item'])
    })

    it('draws a label given as an element', async () => {
      await render(
        <NavigationTree aria-label="Label">
          <NavigationTree.Item
            href="/first"
            id="first"
            label={LABEL}
            textValue="First item"
          />
        </NavigationTree>,
      )

      expect(screen.getByTestId('label')).toBeOnTheScreen()
    })
  })

  describe('the current row', () => {
    it('draws the row whose href is the route on the drawer’s pill', async () => {
      await render(
        <NavigationTree
          aria-label="Label"
          defaultExpandedKeys={FIRST_AND_SECOND}
          selectedRoute="/third"
        >
          {ROWS}
        </NavigationTree>,
      )

      expect(styleOf(rowOf('Third item'))).toMatchObject({
        backgroundColor: colors.secondaryContainer,
        borderRadius: radii.pill,
      })
      expect(styleOf(screen.getByText('Third item')).color).toBe(
        colors.onSecondaryContainer,
      )
      expect(styleOf(rowOf('Fourth item')).backgroundColor).toBeUndefined()
      expect(styleOf(screen.getByText('Fourth item')).color).toBe(
        colors.onSurface,
      )
    })

    it('draws the chevron of a current row that opens in the pill’s own colour', async () => {
      await render(
        <NavigationTree
          aria-label="Label"
          defaultExpandedKeys={FIRST}
          selectedRoute="/second"
        >
          {ROWS}
        </NavigationTree>,
      )

      // The muted role is not guaranteed to read over the container.
      expect(chevronColourIn(rowOf('Second item'))).toBe(
        colors.onSecondaryContainer,
      )
      expect(chevronColourIn(rowOf('First item'))).toBe(colors.onSurfaceVariant)
    })

    it('reports the current row selected on native, and every other not', async () => {
      await render(
        <NavigationTree
          aria-label="Label"
          defaultExpandedKeys={FIRST_AND_SECOND}
          selectedRoute="/third"
        >
          {ROWS}
        </NavigationTree>,
      )

      expect(
        screen.getByRole('link', { name: 'Third item', selected: true }),
      ).toBeOnTheScreen()
      expect(
        screen.getByRole('link', { name: 'Second item', selected: false }),
      ).toBeOnTheScreen()
      expect(rowOf('Third item').props).not.toHaveProperty('aria-current')
    })

    it('marks the current row as the page on the web, and nothing else', async () => {
      Platform.OS = 'web'
      await render(
        <NavigationTree
          aria-label="Label"
          defaultExpandedKeys={FIRST_AND_SECOND}
          selectedRoute="/third"
        >
          {ROWS}
        </NavigationTree>,
      )

      expect(rowOf('Third item').props['aria-current']).toBe('page')
      expect(rowOf('Third item').props).not.toHaveProperty('aria-selected')
      expect(rowOf('Second item').props).not.toHaveProperty('aria-current')
    })

    it('draws each row the current one sits under in bold, and no other', async () => {
      await render(
        <NavigationTree
          aria-label="Label"
          defaultExpandedKeys={FIRST_AND_SECOND}
          selectedRoute="/third"
        >
          {ROWS}
        </NavigationTree>,
      )

      expect(styleOf(screen.getByText('First item')).fontWeight).toBe(BOLD)
      expect(styleOf(screen.getByText('Second item')).fontWeight).toBe(BOLD)
      // The trail is set apart by more than a step from the label's own
      // weight, and the current row keeps that weight under its pill.
      expect(typography.labelLargeWeight).not.toBe(BOLD)
      expect(styleOf(screen.getByText('Third item')).fontWeight).toBe(
        typography.labelLargeWeight,
      )
      expect(styleOf(screen.getByText('Fourth item')).fontWeight).toBe(
        typography.labelLargeWeight,
      )
      expect(styleOf(rowOf('Second item')).backgroundColor).toBeUndefined()
    })

    it('marks the trail of a current row closed out of sight', async () => {
      await render(
        <NavigationTree aria-label="Label" selectedRoute="/third">
          {ROWS}
        </NavigationTree>,
      )

      expect(labels()).toEqual(['First item', 'Fifth item'])
      expect(styleOf(screen.getByText('First item')).fontWeight).toBe(BOLD)
      expect(styleOf(screen.getByText('Fifth item')).fontWeight).toBe(
        typography.labelLargeWeight,
      )
    })

    it.each([['/none'], [undefined], [null]])(
      'marks nothing while no row’s href is the route: %s',
      async (selectedRoute) => {
        await render(
          <NavigationTree
            aria-label="Label"
            defaultExpandedKeys={FIRST_AND_SECOND}
            selectedRoute={selectedRoute}
          >
            {ROWS}
          </NavigationTree>,
        )

        for (const label of labels()) {
          expect(styleOf(rowOf(label)).backgroundColor).toBeUndefined()
          expect(styleOf(screen.getByText(label)).fontWeight).toBe(
            typography.labelLargeWeight,
          )
        }
        expect(screen.queryByRole('link', { selected: true })).toBe(null)
      },
    )

    it('takes no row without an href for the current one while there is no route', async () => {
      await render(
        <NavigationTree aria-label="Label">
          <NavigationTree.Item id="first" label="First item">
            <NavigationTree.Item
              href="/second"
              id="second"
              label="Second item"
            />
          </NavigationTree.Item>
        </NavigationTree>,
      )

      expect(
        screen.getByRole('button', { name: 'First item', selected: false }),
      ).toBeOnTheScreen()
      expect(styleOf(rowOf('First item')).backgroundColor).toBeUndefined()
    })

    it('follows the route as it moves', async () => {
      const { rerender } = await render(
        <NavigationTree
          aria-label="Label"
          defaultExpandedKeys={FIRST}
          selectedRoute="/fourth"
        >
          {ROWS}
        </NavigationTree>,
      )

      await rerender(
        <NavigationTree
          aria-label="Label"
          defaultExpandedKeys={FIRST}
          selectedRoute="/fifth"
        >
          {ROWS}
        </NavigationTree>,
      )

      expect(
        screen.getByRole('link', { name: 'Fifth item', selected: true }),
      ).toBeOnTheScreen()
      expect(
        screen.getByRole('link', { name: 'Fourth item', selected: false }),
      ).toBeOnTheScreen()
      expect(styleOf(screen.getByText('First item')).fontWeight).toBe(
        typography.labelLargeWeight,
      )
    })
  })

  describe('navigation', () => {
    it('opens a row’s href through the RouterProvider around it on a press', async () => {
      const navigate = jest.fn<(href: string) => void>()
      await render(
        <Routed navigate={navigate}>
          <NavigationTree aria-label="Label">{ROWS}</NavigationTree>
        </Routed>,
      )

      await fireEvent.press(rowOf('Fifth item'), PRESS)

      expect(navigate).toHaveBeenCalledTimes(1)
      expect(navigate).toHaveBeenCalledWith('/fifth')
    })

    it('calls the row’s own onPress before it opens the href', async () => {
      const navigate = jest.fn<(href: string) => void>()
      const onPress = jest.fn()
      await render(
        <Routed navigate={navigate}>
          <NavigationTree aria-label="Label">
            <NavigationTree.Item
              href="/first"
              id="first"
              label="First item"
              onPress={onPress}
            />
          </NavigationTree>
        </Routed>,
      )

      await fireEvent.press(rowOf('First item'), PRESS)

      expect(navigate).toHaveBeenCalledWith('/first')
      expect(onPress.mock.invocationCallOrder[0]).toBeLessThan(
        navigate.mock.invocationCallOrder[0] ?? 0,
      )
    })

    it('asks the platform to open the href without a RouterProvider', async () => {
      const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue()
      await render(<NavigationTree aria-label="Label">{ROWS}</NavigationTree>)

      await fireEvent.press(rowOf('Fifth item'), PRESS)

      expect(openURL).toHaveBeenCalledWith('/fifth')
    })

    it('goes where a row with rows under it leads on a press, and opens it from its chevron', async () => {
      const navigate = jest.fn<(href: string) => void>()
      const onExpandedChange = jest.fn<(keys: Set<Key>) => void>()
      await render(
        <Routed navigate={navigate}>
          <NavigationTree
            aria-label="Label"
            onExpandedChange={onExpandedChange}
          >
            {ROWS}
          </NavigationTree>
        </Routed>,
      )

      await fireEvent.press(rowOf('First item'), PRESS)

      expect(navigate).toHaveBeenCalledWith('/first')
      expect(onExpandedChange).not.toHaveBeenCalled()

      await fireEvent.press(chevronIn(rowOf('First item')), PRESS)

      expect(navigate).toHaveBeenCalledTimes(1)
      expect(keysOf(onExpandedChange)).toEqual(['first'])
      expect(labels()).toEqual([
        'First item',
        'Second item',
        'Fourth item',
        'Fifth item',
      ])
    })

    it('opens and closes a row with no href on a press', async () => {
      await render(
        <NavigationTree aria-label="Label">
          <NavigationTree.Item id="first" label="First item">
            <NavigationTree.Item
              href="/second"
              id="second"
              label="Second item"
            />
          </NavigationTree.Item>
        </NavigationTree>,
      )

      const row = screen.getByRole('button', { name: 'First item' })
      await fireEvent.press(row, PRESS)

      expect(labels()).toEqual(['First item', 'Second item'])

      await fireEvent.press(row, PRESS)

      expect(labels()).toEqual(['First item'])
    })

    it('opens and closes a row from its actions, named Expand and Collapse', async () => {
      await render(<NavigationTree aria-label="Label">{ROWS}</NavigationTree>)

      expect(rowOf('First item').props.accessibilityActions).toEqual([
        { label: 'Expand', name: 'expand' },
      ])

      await fireEvent(rowOf('First item'), 'accessibilityAction', EXPAND)

      expect(labels()).toEqual([
        'First item',
        'Second item',
        'Fourth item',
        'Fifth item',
      ])
      expect(rowOf('First item').props.accessibilityActions).toEqual([
        { label: 'Collapse', name: 'collapse' },
      ])

      await fireEvent(rowOf('First item'), 'accessibilityAction', COLLAPSE)

      expect(labels()).toEqual(['First item', 'Fifth item'])
      expect(rowOf('Fifth item').props.accessibilityActions).toBeUndefined()
    })

    it('keeps the open rows the call site holds', async () => {
      const onExpandedChange = jest.fn<(keys: Set<Key>) => void>()
      await render(
        <NavigationTree
          aria-label="Label"
          expandedKeys={FIRST}
          onExpandedChange={onExpandedChange}
        >
          {ROWS}
        </NavigationTree>,
      )

      await fireEvent.press(chevronIn(rowOf('Second item')), PRESS)

      expect(keysOf(onExpandedChange)).toEqual(['first', 'second'])
      expect(labels()).toEqual([
        'First item',
        'Second item',
        'Fourth item',
        'Fifth item',
      ])
    })
  })

  describe('rows', () => {
    it('sets each level in by a chevron’s width', async () => {
      await render(
        <NavigationTree
          aria-label="Label"
          defaultExpandedKeys={FIRST_AND_SECOND}
        >
          {ROWS}
        </NavigationTree>,
      )

      expect(styleOf(leadOf('First item')).marginStart).toBe(0)
      expect(styleOf(leadOf('Second item')).marginStart).toBe(spacing.xl)
      expect(styleOf(leadOf('Third item')).marginStart).toBe(2 * spacing.xl)
      expect(styleOf(leadOf('Fourth item')).marginStart).toBe(spacing.xl)
      expect(spacing.xl).toBe(24)
    })

    it('draws a row as the drawer page’s: 56dp, a pill held 12dp off each edge, a label-large label', async () => {
      await render(<NavigationTree aria-label="Label">{ROWS}</NavigationTree>)

      expect(styleOf(rowOf('Fifth item'))).toMatchObject({
        borderRadius: radii.pill,
        marginHorizontal: spacing.md,
        minHeight: sizing.rowSm,
      })
      expect(spacing.md).toBe(12)
      expect(sizing.rowSm).toBe(56)
      expect(styleOf(screen.getByText('Fifth item'))).toMatchObject({
        fontSize: typography.labelLargeSize,
        letterSpacing: typography.labelLargeTracking,
        lineHeight: typography.labelLargeLineHeight,
      })
    })

    it('clips its press feedback to the pill', async () => {
      await render(<NavigationTree aria-label="Label">{ROWS}</NavigationTree>)

      const layer = instance(rowOf('Fifth item').children.at(0))

      expect(styleOf(layer)).toMatchObject({ borderRadius: radii.pill })
    })

    it('draws the leading content after the chevron, and the supporting line and trailing content', async () => {
      await render(
        <NavigationTree aria-label="Label">
          <NavigationTree.Item
            href="/first"
            id="first"
            label="First item"
            leading={LEADING}
            supporting="Supporting line"
            trailing={TRAILING}
          >
            <NavigationTree.Item
              href="/second"
              id="second"
              label="Second item"
            />
          </NavigationTree.Item>
        </NavigationTree>,
      )

      const lead = leadOf('First item')

      expect(lead.children).toHaveLength(2)
      expect(lead.children.at(1)).toBe(screen.getByTestId('leading'))
      expect(screen.getByText('Supporting line')).toBeOnTheScreen()
      expect(screen.getByTestId('trailing')).toBeOnTheScreen()
    })

    it('presents a row with no href and nothing under it, with no role', async () => {
      await render(
        <NavigationTree aria-label="Label">
          <NavigationTree.Item id="first" label="First item" />
        </NavigationTree>,
      )

      expect(screen.getByText('First item')).toBeOnTheScreen()
      expect(screen.queryByRole('link')).toBe(null)
      expect(screen.queryByRole('button')).toBe(null)
    })
  })

  describe('disabled rows', () => {
    it.each(['First item', 'Fifth item'])(
      'takes no press, and goes nowhere, on a disabled row: %s',
      async (label) => {
        const navigate = jest.fn<(href: string) => void>()
        await render(
          <Routed navigate={navigate}>
            <NavigationTree aria-label="Label" disabledKeys={FIRST}>
              <NavigationTree.Item href="/first" id="first" label="First item">
                <NavigationTree.Item
                  href="/second"
                  id="second"
                  label="Second item"
                />
              </NavigationTree.Item>
              <NavigationTree.Item
                href="/fifth"
                id="fifth"
                isDisabled
                label="Fifth item"
              />
            </NavigationTree>
          </Routed>,
        )

        const row = screen.getByRole('link', { disabled: true, name: label })
        await fireEvent.press(row, PRESS)

        expect(row.props.accessibilityActions).toBeUndefined()
        expect(navigate).not.toHaveBeenCalled()
        expect(styleOf(screen.getByText(label)).color).toBe(FADED)
      },
    )
  })

  describe('sections', () => {
    it('heads each section in label large and the muted role, in line with the labels, scrolling with its rows', async () => {
      await render(
        <NavigationTree aria-label="Label" defaultExpandedKeys={FIRST}>
          <NavigationTree.Section header="Header" id="section">
            <NavigationTree.Item href="/first" id="first" label="First item">
              <NavigationTree.Item
                href="/second"
                id="second"
                label="Second item"
              />
            </NavigationTree.Item>
          </NavigationTree.Section>
          <NavigationTree.Item href="/fifth" id="fifth" label="Fifth item" />
        </NavigationTree>,
      )

      expect(styleOf(header())).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.labelLargeSize,
        lineHeight: typography.labelLargeLineHeight,
        paddingBottom: spacing.xxs,
        paddingHorizontal: spacing.lg + spacing.md,
        paddingTop: spacing.lg,
      })
      expect(tree().props.stickyHeaderIndices).toEqual([])
      expect(typography.titleSmallSize).toBe(typography.labelLargeSize)
      expect(styleOf(leadOf('First item')).marginStart).toBe(0)
      expect(styleOf(leadOf('Second item')).marginStart).toBe(spacing.xl)
      expect(labels()).toEqual(['First item', 'Second item', 'Fifth item'])
    })

    it('takes the label’s own role for its heading, not a list’s subhead', async () => {
      await render(
        <ThemeScope theme={LABEL_APART}>
          <NavigationTree aria-label="Label">
            <NavigationTree.Section header="Header" id="section">
              <NavigationTree.Item
                href="/first"
                id="first"
                label="First item"
              />
            </NavigationTree.Section>
          </NavigationTree>
        </ThemeScope>,
      )

      expect(styleOf(header())).toMatchObject({ fontSize: 15, lineHeight: 22 })
    })
  })

  describe('the tree', () => {
    it('is a FlatList taking a style and a ref, with no ground of its own', async () => {
      const ref = createRef<FlatList>()
      await render(
        <NavigationTree aria-label="Label" ref={ref} style={CALL_SITE}>
          {ROWS}
        </NavigationTree>,
      )

      expect(ref.current).toBeInstanceOf(FlatList)
      expect(styleOf(tree()).backgroundColor).toBeUndefined()
      expect(styleOf(tree()).marginTop).toBe(4)
    })

    it('draws nothing when it has no rows', async () => {
      await render(<NavigationTree aria-label="Label">{[]}</NavigationTree>)

      expect(tree()).toBeOnTheScreen()
      expect(screen.queryByText('No results')).toBe(null)
    })
  })
})
