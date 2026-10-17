import type { ComponentRef, ReactNode } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { TestInstance } from 'test-renderer'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { I18nManager, ScrollView, StyleSheet, Text, View } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { TabsProps, TabsTabProps } from '.'

import { Tabs, TabsList, TabsPanel, TabsPanels, TabsTab } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { RouterProvider } from '../../router'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

// What the next bar the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

const { theme } = scopeFor('light', {})
const { colors, motion, sizing, spacing, stateLayerOpacity } = theme

const FADED = withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)

// A press with no point on the page, on a tab that measures nothing, so the
// ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// Where a case lays its tabs out: each 120dp wide and 48dp tall, one after
// the other, with a 60dp label 30dp into each.
const TAB = 120
const LABEL_AT = 30
const LABEL = 60

// Hoisted so the keys, the slots and the call sites' styles are stable,
// which is what react-perf's no-new-array-as-prop, no-jsx-as-prop and
// no-new-object-as-prop are after.
const FIRST = ['first']
const ITEMS = [
  { id: 'a', name: 'First item' },
  { id: 'b', name: 'Second item' },
]
const CALL_SITE = { marginTop: 4 }
const LIST_SITE = { marginTop: 8 }
const PANEL_SITE = { marginTop: 12 }
const TAB_SITE = { marginTop: 16 }
const ICON = <Icon />
const NO_TABS = {}

type SampleProps = Omit<TabsProps, 'children'> & {
  readonly panels?: 'box' | 'none' | 'plain'
  readonly tabs?: Partial<Record<'first' | 'second' | 'third', TabsTabProps>>
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// A bar written in a component of the call site's own, which Tabs cannot
// find among its children.
function BarOfItsOwn(): ReactNode {
  return (
    <TabsList aria-label="Sections">
      <TabsTab id="first">First item</TabsTab>
    </TabsList>
  )
}

// The height Tabs.Panels' box has once its frame has run, or undefined while
// it takes its content's own.
async function boxHeight(): Promise<unknown> {
  await advance(0)
  const { height }: { height?: unknown } = getAnimatedStyle(
    screen.getByTestId('panels'),
  )
  return height
}

function child(node: string | TestInstance | undefined): TestInstance {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

// The third tab, given an href and the props a case adds.
function hrefOnThird(props: TabsTabProps) {
  return { third: { href: '/third', ...props } }
}

// What a tab's icon slot hands an icon, written out where a case can read it.
function Icon() {
  const { color, size } = useIconStyle()

  return <Text testID="icon">{`${String(color)} ${String(size)}`}</Text>
}

// The bar's indicator, which is drawn last in the bar, after the tabs.
function indicator() {
  return child(rowOf().children.at(-1))
}

// Where the indicator lies along the bar once its frame has run, as its
// motion has it.
async function indicatorPlace() {
  await advance(0)
  const style = getAnimatedStyle(indicator())
  const transform: unknown = style.transform
  const move: unknown = Array.isArray(transform) ? transform.at(0) : undefined
  const across =
    typeof move === 'object' && move !== null && 'translateX' in move
  const offset: unknown =
    typeof move !== 'object' || move === null
      ? undefined
      : across
        ? move.translateX
        : 'translateY' in move
          ? move.translateY
          : undefined

  return { length: across ? style.width : style.height, offset }
}

// A tab's label view, which holds its text, its badge and its icon, drawn
// after the press feedback.
function labelOf(name: string) {
  return child(tab(name).children.at(-1))
}

// Lays the tabs out, one after the other along the bar, each with its label
// inside it.
async function layOut({
  label = LABEL,
  names = ['First item', 'Second item', 'Third item'],
  size = TAB,
  vertical = false,
}: {
  readonly label?: number
  readonly names?: readonly string[]
  readonly size?: number
  readonly vertical?: boolean
} = {}) {
  for (const [index, name] of names.entries()) {
    // oxlint-disable-next-line no-await-in-loop -- each layout is an act of its own, and two acts may not overlap
    await fireEvent(tab(name), 'layout', {
      nativeEvent: {
        layout: vertical
          ? { height: 48, width: 160, x: 0, y: index * size }
          : { height: 48, width: size, x: index * size, y: 0 },
      },
    })
    // oxlint-disable-next-line no-await-in-loop -- see above
    await fireEvent(labelOf(name), 'layout', {
      nativeEvent: {
        layout: { height: 20, width: label, x: LABEL_AT, y: 14 },
      },
    })
  }
}

// The badge's mark inside an element, which is hidden from a screen reader.
function marksIn(element: TestInstance) {
  return element.queryAll(
    (each) =>
      typeof each.type === 'string' && each.props['aria-hidden'] === true,
  )
}

// The panels a case's bar switches between.
function panelsOf(kind: 'box' | 'none' | 'plain') {
  if (kind === 'none') {
    return null
  }
  const panels = (
    <>
      <Tabs.Panel id="first" testID="first panel">
        <Text>Panel for the first</Text>
      </Tabs.Panel>
      <Tabs.Panel id="second" testID="second panel">
        <Text>Panel for the second</Text>
      </Tabs.Panel>
      <Tabs.Panel id="third" testID="third panel">
        <Text>Panel for the third</Text>
      </Tabs.Panel>
    </>
  )
  return kind === 'box' ? (
    <Tabs.Panels testID="panels">{panels}</Tabs.Panels>
  ) : (
    panels
  )
}

// The panels drawn, by their test ids.
function panelsShown() {
  return ['first', 'second', 'third'].filter(
    (name) => screen.queryByTestId(`${name} panel`) !== null,
  )
}

async function press(name: string) {
  const target = tab(name)

  await fireEvent(target, 'pressIn', PRESS)
  await fireEvent.press(target)
  await fireEvent(target, 'pressOut', PRESS)
}

async function renderTabs(props: SampleProps = {}) {
  await render(<Sample {...props} />)
}

// Reports a panel's height, as its layout would.
async function reportHeight(name: string, height: number) {
  await fireEvent(screen.getByTestId(`${name} panel`), 'layout', {
    nativeEvent: { layout: { height, width: 360, x: 0, y: 0 } },
  })
}

// What the bar holds its tabs in: the bar itself, or the content of its
// scroll view in the scrollable layout.
function rowOf() {
  const list = screen.getByTestId('list')
  const scroll = list.queryAll((each) => each.type === 'RCTScrollView').at(0)

  return scroll === undefined ? list : child(scroll.children.at(-1))
}

function Sample({ panels = 'plain', tabs = NO_TABS, ...props }: SampleProps) {
  return (
    <Tabs testID="tabs" {...props}>
      <Tabs.List aria-label="Sections" testID="list">
        <Tabs.Tab id="first" {...tabs.first}>
          First item
        </Tabs.Tab>
        <Tabs.Tab id="second" {...tabs.second}>
          Second item
        </Tabs.Tab>
        <Tabs.Tab id="third" {...tabs.third}>
          Third item
        </Tabs.Tab>
      </Tabs.List>
      {panelsOf(panels)}
    </Tabs>
  )
}

// Jest's scroll view is a class whose instance methods are mocks on its
// prototype, shared by every instance.
function scrollTo() {
  const prototype: unknown = Reflect.get(ScrollView, 'prototype')
  const method: unknown =
    typeof prototype === 'object' && prototype !== null
      ? Reflect.get(prototype, 'scrollTo')
      : undefined

  if (!jest.isMockFunction(method)) {
    throw new TypeError("expected Jest's scroll view to mock scrollTo")
  }
  return method
}

// Whether each tab reports itself selected, in order.
function selected() {
  return screen.getAllByRole('tab').map((each: TestInstance) => {
    const state: unknown = each.props.accessibilityState
    return typeof state === 'object' && state !== null && 'selected' in state
      ? state.selected === true
      : false
  })
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function tab(name: string) {
  return screen.getByRole('tab', { name })
}

function textStyleOf(element: {
  props: { style?: StyleProp<TextStyle> }
}): TextStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

beforeEach(() => {
  jest.useFakeTimers()
  scrollTo().mockClear()
})

afterEach(() => {
  jest.useRealTimers()
  mockReducedMotion = false
})

describe('Tabs', () => {
  describe('selection', () => {
    it('selects the tab it is given at first, and draws its panel', async () => {
      await renderTabs({ defaultSelectedKey: 'second' })

      expect(selected()).toEqual([false, true, false])
      expect(panelsShown()).toEqual(['second'])
    })

    it('selects the first tab when it is given none', async () => {
      await renderTabs()

      expect(selected()).toEqual([true, false, false])
      expect(panelsShown()).toEqual(['first'])
    })

    it('passes over a disabled first tab when it chooses one', async () => {
      await renderTabs({ disabledKeys: FIRST })

      expect(selected()).toEqual([false, true, false])
    })

    it('selects a tab when it is pressed, and reports it', async () => {
      const onSelectionChange = jest.fn()
      await renderTabs({ defaultSelectedKey: 'first', onSelectionChange })

      await press('Third item')

      expect(onSelectionChange.mock.calls).toEqual([['third']])
      expect(selected()).toEqual([false, false, true])
      expect(panelsShown()).toEqual(['third'])
    })

    it('reports nothing when the selected tab is pressed again', async () => {
      const onSelectionChange = jest.fn()
      await renderTabs({ defaultSelectedKey: 'first', onSelectionChange })

      await press('First item')

      expect(onSelectionChange).not.toHaveBeenCalled()
      expect(selected()).toEqual([true, false, false])
    })

    it('follows selectedKey when the call site holds it', async () => {
      const onSelectionChange = jest.fn()
      await renderTabs({ onSelectionChange, selectedKey: 'first' })

      await press('Second item')

      expect(onSelectionChange.mock.calls).toEqual([['second']])
      expect(selected()).toEqual([true, false, false])

      await screen.rerender(
        <Sample onSelectionChange={onSelectionChange} selectedKey="second" />,
      )

      expect(selected()).toEqual([false, true, false])
      expect(panelsShown()).toEqual(['second'])
    })

    it("calls a tab's own onPress beside selecting it", async () => {
      const onPress = jest.fn()
      await renderTabs({ tabs: { second: { onPress } } })

      await press('Second item')

      expect(onPress).toHaveBeenCalledTimes(1)
      expect(selected()).toEqual([false, true, false])
    })

    it('draws a tab for each of its items, keyed by their ids', async () => {
      const onSelectionChange = jest.fn()
      await render(
        <Tabs onSelectionChange={onSelectionChange}>
          <Tabs.List aria-label="Sections" items={ITEMS}>
            {(item: { id: string; name: string }) => (
              <Tabs.Tab id={item.id}>{item.name}</Tabs.Tab>
            )}
          </Tabs.List>
        </Tabs>,
      )

      await press('Second item')

      expect(selected()).toEqual([false, true])
      expect(onSelectionChange.mock.calls.at(-1)).toEqual(['b'])
    })

    it('takes a number as a key', async () => {
      const onSelectionChange = jest.fn()
      await render(
        <Tabs defaultSelectedKey={1} onSelectionChange={onSelectionChange}>
          <Tabs.List aria-label="Sections">
            <Tabs.Tab id={1}>First item</Tabs.Tab>
            <Tabs.Tab id={2}>Second item</Tabs.Tab>
          </Tabs.List>
        </Tabs>,
      )

      await press('Second item')

      expect(onSelectionChange.mock.calls).toEqual([[2]])
    })

    it('finds its bar inside a view around it', async () => {
      await render(
        <Tabs defaultSelectedKey="second">
          <View>
            <>
              <Tabs.List aria-label="Sections">
                <Tabs.Tab id="first">First item</Tabs.Tab>
                <Tabs.Tab id="second">Second item</Tabs.Tab>
              </Tabs.List>
            </>
          </View>
        </Tabs>,
      )

      expect(selected()).toEqual([false, true])
    })

    // A bar inside a panel is the inner Tabs' own, whichever comes first.
    it('leaves the bar of a Tabs inside it to that Tabs', async () => {
      await render(
        <Tabs defaultSelectedKey="outer">
          <Tabs.Panel id="outer">
            <Tabs defaultSelectedKey="inner">
              <Tabs.List aria-label="Inner">
                <Tabs.Tab id="inner">Inner item</Tabs.Tab>
              </Tabs.List>
            </Tabs>
          </Tabs.Panel>
          <Tabs.List aria-label="Outer">
            <Tabs.Tab id="outer">Outer item</Tabs.Tab>
          </Tabs.List>
        </Tabs>,
      )

      expect(screen.getAllByRole('tab')).toHaveLength(2)
      expect(selected()).toEqual([true, true])
    })
  })

  describe('the tabs', () => {
    it('names each tab by its label, and says it is a tab', async () => {
      await renderTabs()

      expect(screen.getAllByRole('tab')).toHaveLength(3)
      expect(tab('Second item').props.role).toBe('tab')
    })

    it('names the bar a tablist, with its label', async () => {
      await renderTabs()

      const list = screen.getByTestId('list')
      expect(list.props.role).toBe('tablist')
      expect(list.props['aria-label']).toBe('Sections')
    })

    it('shares the bar equally among the tabs, at least 48dp tall', async () => {
      await renderTabs()

      const style = styleOf(tab('First item'))
      expect(style.flex).toBe(1)
      expect(style.minWidth).toBe(0)
      expect(style.minHeight).toBe(sizing.controlMd)
      expect(style.paddingHorizontal).toBe(spacing.lg)
    })

    it('draws the divider inside the bar along its bottom edge', async () => {
      await renderTabs()

      const divider = styleOf(child(screen.getByTestId('list').children[0]))
      expect(divider).toMatchObject({
        backgroundColor: colors.outlineVariant,
        bottom: 0,
        height: 1,
        left: 0,
        position: 'absolute',
        right: 0,
      })
    })

    it('draws the active label in primary and the rest in on surface variant', async () => {
      await renderTabs()

      expect(textStyleOf(screen.getByText('First item')).color).toBe(
        colors.primary,
      )
      expect(textStyleOf(screen.getByText('Second item')).color).toBe(
        colors.onSurfaceVariant,
      )
    })

    it('draws a secondary bar’s active label in on surface', async () => {
      await renderTabs({ variant: 'secondary' })

      expect(textStyleOf(screen.getByText('First item')).color).toBe(
        colors.onSurface,
      )
      expect(textStyleOf(screen.getByText('Second item')).color).toBe(
        colors.onSurfaceVariant,
      )
    })

    it('draws an inactive tab in on surface while it is pressed', async () => {
      await renderTabs()

      await fireEvent(tab('Second item'), 'pressIn', PRESS)

      expect(textStyleOf(screen.getByText('Second item')).color).toBe(
        colors.onSurface,
      )
    })

    it('sets the label in title small, centred, on two lines at most', async () => {
      await renderTabs()

      const text = screen.getByText('First item')
      expect(textStyleOf(text)).toMatchObject({
        fontSize: theme.typography.titleSmallSize,
        textAlign: 'center',
      })
      expect(text.props.numberOfLines).toBe(2)
    })

    it('puts its focus ring inside the tab', async () => {
      await renderTabs()

      await fireEvent(tab('First item'), 'focus')

      expect(styleOf(tab('First item')).outlineOffset).toBe(-2)
    })

    it('measures each tab and its label however it starts, as React Native Web needs', async () => {
      await renderTabs()

      expect(tab('First item').props.onLayout).toEqual(expect.any(Function))
      expect(labelOf('First item').props.onLayout).toEqual(expect.any(Function))
    })
  })

  describe('the indicator', () => {
    it('waits for the tabs to be laid out before it is drawn', async () => {
      await renderTabs()

      expect(rowOf().children.at(-1)).toBe(tab('Third item'))
    })

    it('lies under the label of a primary tab, 2dp short of it at either end', async () => {
      await renderTabs({ defaultSelectedKey: 'second' })
      await layOut()

      expect(await indicatorPlace()).toEqual({
        length: LABEL - 2 * spacing.xxs,
        offset: TAB + LABEL_AT + spacing.xxs,
      })
    })

    it('is never shorter than 24dp under a primary tab', async () => {
      await renderTabs()
      await layOut({ label: 10 })

      expect(await indicatorPlace()).toEqual({
        length: 24,
        offset: LABEL_AT + (10 - 24) / 2,
      })
    })

    it('is 3dp of primary, rounded along its top, along the bar’s bottom', async () => {
      await renderTabs()
      await layOut()

      expect(styleOf(indicator())).toMatchObject({
        backgroundColor: colors.primary,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
        bottom: 0,
        height: 3,
        left: 0,
        position: 'absolute',
      })
    })

    it('spans the whole tab on a secondary bar, 2dp and square', async () => {
      await renderTabs({ defaultSelectedKey: 'third', variant: 'secondary' })
      await layOut()

      expect(await indicatorPlace()).toEqual({
        length: TAB,
        offset: 2 * TAB,
      })
      const style = styleOf(indicator())
      expect(style.height).toBe(2)
      expect(style.borderTopLeftRadius).toBeUndefined()
    })

    it('slides to the tab pressed over medium1', async () => {
      await renderTabs()
      await layOut()
      const from = LABEL_AT + spacing.xxs
      const to = 2 * TAB + LABEL_AT + spacing.xxs

      await press('Third item')
      await advance(motion.durationMedium1 / 2)

      const { offset } = await indicatorPlace()
      expect(offset).toBeGreaterThan(from)
      expect(offset).toBeLessThan(to)

      await advance(motion.durationMedium1 / 2)

      expect(await indicatorPlace()).toEqual({
        length: LABEL - 2 * spacing.xxs,
        offset: to,
      })
    })

    it('moves at once under reduced motion', async () => {
      mockReducedMotion = true
      await renderTabs()
      await layOut()

      await press('Third item')

      expect((await indicatorPlace()).offset).toBe(
        2 * TAB + LABEL_AT + spacing.xxs,
      )
    })

    it('follows a tab laid out again at once, without sliding', async () => {
      await renderTabs()
      await layOut()

      await layOut({ size: 100 })

      expect(await indicatorPlace()).toEqual({
        length: LABEL - 2 * spacing.xxs,
        offset: LABEL_AT + spacing.xxs,
      })
      await layOut({ label: 80 })
      expect((await indicatorPlace()).length).toBe(80 - 2 * spacing.xxs)
    })

    // A layout reports a tab's x from the bar's left edge in either
    // direction, and React Native swaps left and right under a
    // right-to-left layout, so it is right that names that edge there.
    it('is moved from the bar’s left edge under a right-to-left layout', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      jest.spyOn(I18nManager, 'getConstants').mockReturnValue({
        doLeftAndRightSwapInRTL: true,
        isRTL: true,
      })
      await renderTabs()
      await layOut()

      const style = styleOf(indicator())
      expect(style.right).toBe(0)
      expect(style.left).toBeUndefined()
    })

    it('keeps left where the app turns the swap off', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      jest.spyOn(I18nManager, 'getConstants').mockReturnValue({
        doLeftAndRightSwapInRTL: false,
        isRTL: true,
      })
      await renderTabs()
      await layOut()

      expect(styleOf(indicator()).left).toBe(0)
    })
  })

  describe('icons', () => {
    it('stacks a primary tab’s icon over its label, and the tab grows to 64dp', async () => {
      await renderTabs({ tabs: { first: { icon: ICON } } })

      expect(styleOf(tab('First item')).minHeight).toBe(64)
      expect(styleOf(labelOf('First item'))).toMatchObject({
        flexDirection: 'column-reverse',
        gap: spacing.xxs,
      })
      expect(screen.getByText('First item').props.numberOfLines).toBe(1)
    })

    it('sets a secondary tab’s icon before its label, 8dp from it, at 48dp', async () => {
      await renderTabs({
        tabs: { first: { icon: ICON } },
        variant: 'secondary',
      })

      expect(styleOf(tab('First item')).minHeight).toBe(sizing.controlMd)
      expect(styleOf(labelOf('First item'))).toMatchObject({
        flexDirection: 'row-reverse',
        gap: spacing.sm,
      })
      expect(screen.getByText('First item').props.numberOfLines).toBe(2)
    })

    it('hands the icon the tab’s colour at 24dp', async () => {
      await renderTabs({
        tabs: { first: { icon: ICON }, second: { icon: ICON } },
      })

      const [active, inactive] = screen
        .getAllByTestId('icon')
        .map((each: TestInstance) => {
          const { children }: { children?: unknown } = each.props
          return children
        })
      expect(active).toBe(`${colors.primary} 24`)
      expect(inactive).toBe(`${colors.onSurfaceVariant} 24`)
    })

    // A badge's count is text, and ahead of the label it would put the count
    // before the name.
    it('puts the label first in the tree, ahead of the icon', async () => {
      await renderTabs({ tabs: { first: { icon: ICON } } })

      const [first] = labelOf('First item').children
      expect(child(first).type).toBe('Text')
    })
  })

  describe('badges', () => {
    it('sets a primary tab’s badge on its icon', async () => {
      await renderTabs({
        tabs: {
          first: { 'aria-label': 'First item, 3 new', badge: 3, icon: ICON },
        },
      })

      const slot = child(labelOf('First item, 3 new').children.at(-1))
      const [mark] = marksIn(slot)
      expect(marksIn(tab('First item, 3 new'))).toEqual([mark])
      expect(
        slot.queryAll((each) => each.props.testID === 'icon'),
      ).toHaveLength(1)
      // The large badge, holding the number.
      expect(
        child(mark).queryAll(
          (each) => each.type === 'Text' && each.props.children === '3',
        ),
      ).toHaveLength(1)
    })

    it('sets a badge 4dp after the label where the tab stacks no icon', async () => {
      await renderTabs({
        tabs: { first: { 'aria-label': 'First item, new', badge: true } },
      })

      const [line] = labelOf('First item, new').children
      const row = child(line)
      expect(styleOf(row).gap).toBe(spacing.xs)
      expect(child(row.children[0]).type).toBe('Text')
      expect(marksIn(child(row.children[1]))).toHaveLength(1)
    })

    it('sets a secondary tab’s badge after its label, not on its icon', async () => {
      await renderTabs({
        tabs: {
          first: { 'aria-label': 'First item, new', badge: true, icon: ICON },
        },
        variant: 'secondary',
      })

      const label = labelOf('First item, new')
      expect(marksIn(child(label.children[0]))).toHaveLength(1)
      expect(marksIn(child(label.children.at(-1)))).toHaveLength(0)
    })

    it('draws none for false', async () => {
      await renderTabs({ tabs: { first: { badge: false, icon: ICON } } })

      expect(marksIn(tab('First item'))).toHaveLength(0)
    })
  })

  describe('disabled', () => {
    it('takes no press on a tab among disabledKeys, and fades it', async () => {
      const onSelectionChange = jest.fn()
      await renderTabs({
        defaultSelectedKey: 'first',
        disabledKeys: ['second'],
        onSelectionChange,
      })

      await press('Second item')

      expect(tab('Second item')).toBeDisabled()
      expect(onSelectionChange).not.toHaveBeenCalled()
      expect(selected()).toEqual([true, false, false])
      expect(textStyleOf(screen.getByText('Second item')).color).toBe(FADED)
    })

    it('takes no press on a tab given isDisabled', async () => {
      await renderTabs({ tabs: { third: { isDisabled: true } } })

      await press('Third item')

      expect(tab('Third item')).toBeDisabled()
      expect(selected()).toEqual([true, false, false])
    })

    it('disables every tab when the bar is disabled', async () => {
      await renderTabs({ isDisabled: true })

      for (const each of screen.getAllByRole('tab')) {
        expect(each).toBeDisabled()
      }
    })
  })

  describe('the scrollable layout', () => {
    it('gives each tab its label’s width, between 72dp and 264dp', async () => {
      await renderTabs({ layout: 'scrollable' })

      expect(styleOf(tab('First item'))).toMatchObject({
        flexGrow: 0,
        flexShrink: 0,
        maxWidth: 264,
        minWidth: 72,
      })
    })

    it('scrolls without a scroll indicator, and draws the indicator inside', async () => {
      await renderTabs({ layout: 'scrollable' })
      await layOut()

      const scroll = screen
        .getByTestId('list')
        .queryAll((each) => each.type === 'RCTScrollView')
        .at(0)
      expect(scroll?.props.showsHorizontalScrollIndicator).toBe(false)
      expect(scroll?.props.horizontal).toBe(true)
      expect(styleOf(indicator()).backgroundColor).toBe(colors.primary)
    })

    it('brings the selected tab into view at once the first time', async () => {
      await renderTabs({ defaultSelectedKey: 'third', layout: 'scrollable' })
      await fireEvent(scrollOf(), 'layout', {
        nativeEvent: { layout: { height: 48, width: 200, x: 0, y: 0 } },
      })
      await layOut()

      expect(scrollTo().mock.calls).toEqual([
        [{ animated: false, x: 3 * TAB - 200 }],
      ])
    })

    it('scrolls back to a tab cut off at the start, with the platform’s own scroll', async () => {
      await renderTabs({ defaultSelectedKey: 'third', layout: 'scrollable' })
      await fireEvent(scrollOf(), 'layout', {
        nativeEvent: { layout: { height: 48, width: 200, x: 0, y: 0 } },
      })
      await layOut()
      await fireEvent.scroll(scrollOf(), {
        nativeEvent: { contentOffset: { x: 3 * TAB - 200, y: 0 } },
      })

      await press('First item')

      expect(scrollTo().mock.calls.at(-1)).toEqual([{ animated: true, x: 0 }])
    })

    it('leaves a tab already in view where it is', async () => {
      await renderTabs({ layout: 'scrollable' })
      await fireEvent(scrollOf(), 'layout', {
        nativeEvent: { layout: { height: 48, width: 300, x: 0, y: 0 } },
      })
      await layOut()

      await press('Second item')

      expect(scrollTo()).not.toHaveBeenCalled()
    })

    it('scrolls at once under reduced motion', async () => {
      mockReducedMotion = true
      await renderTabs({ layout: 'scrollable' })
      await fireEvent(scrollOf(), 'layout', {
        nativeEvent: { layout: { height: 48, width: 200, x: 0, y: 0 } },
      })
      await layOut()

      await press('Third item')

      expect(scrollTo().mock.calls).toEqual([
        [{ animated: false, x: 3 * TAB - 200 }],
      ])
    })
  })

  describe('panels', () => {
    it('names each panel a tabpanel, by its tab', async () => {
      await renderTabs()

      const panel = screen.getByTestId('first panel')
      expect(panel.props.role).toBe('tabpanel')
      const labelledBy: unknown =
        panel.props['aria-labelledby'] ?? panel.props.accessibilityLabelledBy
      expect(labelledBy).toBe(tab('First item').props.id)
    })

    it('gives each tab an id of its own', async () => {
      await renderTabs()

      const ids = screen.getAllByRole('tab').map((each: TestInstance) => {
        const { id }: { id?: unknown } = each.props
        return id
      })
      expect(new Set(ids).size).toBe(3)
    })

    it('draws a panel given no id under whichever tab is selected', async () => {
      await render(
        <Tabs defaultSelectedKey="second">
          <Tabs.List aria-label="Sections">
            <Tabs.Tab id="first">First item</Tabs.Tab>
            <Tabs.Tab id="second">Second item</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel testID="panel">
            <Text>Panel</Text>
          </Tabs.Panel>
        </Tabs>,
      )

      const labelledBy: unknown =
        screen.getByTestId('panel').props['aria-labelledby'] ??
        screen.getByTestId('panel').props.accessibilityLabelledBy
      expect(labelledBy).toBe(tab('Second item').props.id)
    })

    it('needs no panels at all', async () => {
      await renderTabs({ panels: 'none' })

      await press('Second item')

      expect(selected()).toEqual([false, true, false])
    })
  })

  describe('Tabs.Panels', () => {
    it('takes its content’s own height until a panel has reported one', async () => {
      await renderTabs({ panels: 'box' })

      expect(await boxHeight()).toBeUndefined()
      expect(styleOf(screen.getByTestId('panels')).overflow).toBe('hidden')
    })

    it('takes the first panel’s height at once', async () => {
      await renderTabs({ panels: 'box' })

      await reportHeight('first', 120)

      expect(await boxHeight()).toBe(120)
    })

    it('moves to the next panel’s height over medium1', async () => {
      await renderTabs({ panels: 'box' })
      await reportHeight('first', 120)

      await press('Second item')
      expect(await boxHeight()).toBe(120)
      await reportHeight('second', 200)
      await advance(motion.durationMedium1 / 2)

      const between = await boxHeight()
      expect(between).toBeGreaterThan(120)
      expect(between).toBeLessThan(200)

      await advance(motion.durationMedium1 / 2)

      expect(await boxHeight()).toBe(200)
    })

    it('moves at once under reduced motion', async () => {
      mockReducedMotion = true
      await renderTabs({ panels: 'box' })
      await reportHeight('first', 120)

      await press('Second item')
      await reportHeight('second', 200)

      expect(await boxHeight()).toBe(200)
    })

    it('follows a panel that changes height at once', async () => {
      await renderTabs({ panels: 'box' })
      await reportHeight('first', 120)

      await reportHeight('first', 160)

      expect(await boxHeight()).toBe(160)
    })

    // A panel measured the last time it was shown may have changed since, so
    // the box waits for its own report rather than moving to the old one.
    it('waits for a panel shown again to report its height', async () => {
      await renderTabs({ panels: 'box' })
      await reportHeight('first', 120)
      await press('Second item')
      await reportHeight('second', 200)
      await advance(motion.durationMedium1)

      await press('First item')
      await advance(motion.durationMedium1)

      expect(await boxHeight()).toBe(200)
    })
  })

  describe('href', () => {
    it('goes to its href through the router once selected, after its own handler', async () => {
      const calls: string[] = []
      const navigate = jest.fn((href: string) => {
        calls.push(`navigate ${href}`)
      })
      const onPress = jest.fn(() => {
        calls.push('onPress')
      })
      await render(
        <RouterProvider navigate={navigate}>
          <Sample tabs={hrefOnThird({ onPress })} />
        </RouterProvider>,
      )

      await press('Third item')

      expect(calls).toEqual(['onPress', 'navigate /third'])
      expect(selected()).toEqual([false, false, true])
    })

    it('goes nowhere while disabled', async () => {
      const navigate = jest.fn()
      await render(
        <RouterProvider navigate={navigate}>
          <Sample tabs={hrefOnThird({ isDisabled: true })} />
        </RouterProvider>,
      )

      await press('Third item')

      expect(navigate).not.toHaveBeenCalled()
    })
  })

  describe('vertical', () => {
    it('sets the bar beside its panels, its tabs in a column', async () => {
      await renderTabs({ orientation: 'vertical' })

      expect(styleOf(screen.getByTestId('tabs')).flexDirection).toBe('row')
      expect(styleOf(screen.getByTestId('list'))).toMatchObject({
        flexDirection: 'column',
        flexShrink: 0,
      })
      expect(styleOf(screen.getByTestId('first panel'))).toMatchObject({
        flexGrow: 1,
        minWidth: 0,
      })
    })

    it('starts each label at the tab’s start', async () => {
      await renderTabs({ orientation: 'vertical' })

      expect(styleOf(tab('First item')).justifyContent).toBe('flex-start')
      expect(styleOf(tab('First item')).flex).toBeUndefined()
      expect(textStyleOf(screen.getByText('First item')).textAlign).toBe('auto')
    })

    it('runs the divider down the bar’s end edge', async () => {
      await renderTabs({ orientation: 'vertical' })

      const divider = styleOf(child(screen.getByTestId('list').children[0]))
      expect(divider).toMatchObject({ end: 0, position: 'absolute', width: 1 })
    })

    it('lays a primary indicator along the tab’s end edge, 2dp short of it', async () => {
      await renderTabs({
        defaultSelectedKey: 'second',
        orientation: 'vertical',
      })
      await layOut({ size: 48, vertical: true })

      expect(await indicatorPlace()).toEqual({
        length: 48 - 2 * spacing.xxs,
        offset: 48 + spacing.xxs,
      })
      expect(styleOf(indicator())).toMatchObject({
        borderBottomStartRadius: 3,
        borderTopStartRadius: 3,
        end: 0,
        width: 3,
      })
    })

    it('lays a secondary indicator along the whole tab, 2dp wide', async () => {
      await renderTabs({
        defaultSelectedKey: 'third',
        orientation: 'vertical',
        variant: 'secondary',
      })
      await layOut({ size: 48, vertical: true })

      expect(await indicatorPlace()).toEqual({ length: 48, offset: 96 })
      expect(styleOf(indicator())).toMatchObject({ end: 0, width: 2 })
    })
  })

  describe('where the parts are written', () => {
    it('throws for a panel drawn outside Tabs', async () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {
        // React reports the throw as well; the case asserts on it instead.
      })
      try {
        await expect(render(<TabsPanel id="first" />)).rejects.toThrow(
          'Tabs.Panel is drawn inside Tabs.',
        )
      } finally {
        error.mockRestore()
      }
    })

    it('throws for a bar written in a component of its own', async () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {
        // React reports the throw as well; the case asserts on it instead.
      })
      try {
        await expect(
          render(
            <Tabs>
              <BarOfItsOwn />
            </Tabs>,
          ),
        ).rejects.toThrow('Tabs.List is written among the children of Tabs')
      } finally {
        error.mockRestore()
      }
    })

    it('names each part on Tabs as well as on its own', () => {
      expect(Tabs.List).toBe(TabsList)
      expect(Tabs.Panel).toBe(TabsPanel)
      expect(Tabs.Panels).toBe(TabsPanels)
      expect(Tabs.Tab).toBe(TabsTab)
    })
  })

  describe('the call site', () => {
    it('lands style, ref and testID on the root, the bar, a tab and a panel', async () => {
      const root = createRef<ComponentRef<typeof View>>()
      const list = createRef<ComponentRef<typeof View>>()
      const first = createRef<ComponentRef<typeof View>>()
      const panel = createRef<ComponentRef<typeof View>>()
      await render(
        <Tabs ref={root} style={CALL_SITE} testID="tabs">
          <Tabs.List
            aria-label="Sections"
            ref={list}
            style={LIST_SITE}
            testID="list"
          >
            <Tabs.Tab id="first" ref={first} style={TAB_SITE}>
              First item
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel ref={panel} style={PANEL_SITE} testID="panel">
            <Text>Panel</Text>
          </Tabs.Panel>
        </Tabs>,
      )

      expect(styleOf(screen.getByTestId('tabs'))).toEqual(CALL_SITE)
      expect(styleOf(screen.getByTestId('list'))).toMatchObject(LIST_SITE)
      expect(styleOf(tab('First item'))).toMatchObject(TAB_SITE)
      expect(styleOf(screen.getByTestId('panel'))).toEqual(PANEL_SITE)
      for (const each of [root, list, first, panel]) {
        expect(each.current).not.toBeNull()
      }
    })

    it("calls a tab's own onLayout beside measuring it", async () => {
      const onLayout = jest.fn()
      await renderTabs({ tabs: { first: { onLayout } } })

      await layOut()

      expect(onLayout).toHaveBeenCalledTimes(1)
    })
  })
})

function scrollOf() {
  const scroll = screen
    .getByTestId('list')
    .queryAll((each) => each.type === 'RCTScrollView')
    .at(0)
  if (scroll === undefined) {
    throw new TypeError('expected the bar to scroll')
  }
  return scroll
}
