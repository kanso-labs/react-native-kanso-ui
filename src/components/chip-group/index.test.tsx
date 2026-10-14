import type { ComponentRef, ReactNode } from 'react'
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
import { Platform, StyleSheet, Text, View } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { ChipGroupProps } from '.'
import type { Key, Selection } from '../..'

import { ChipGroup } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const { colors, radii, sizing, spacing, stateLayerOpacity, typography } = theme

const DISABLED_CONTENT = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContent,
)

// kanso-ui's paths, copied rather than read from the glyphs under test.
const CHECK = 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
const CLOSE =
  'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'

const SECOND = ['second']
const FIRST_AND_THIRD = ['first', 'third']
const CALL_SITE = { marginTop: 4 }

// A press with no point on the page, on a control that measures nothing, so
// the ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// A set from data, and the function the group calls for each item in it.
const ITEMS = [
  { id: 'first', name: 'First item' },
  { id: 'second', name: 'Second item' },
  { id: 'third', name: 'Third item' },
]

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

// The chip's pill, which is a button while the group selects.
function chip(name: string) {
  return screen.getByRole('button', { name })
}

function chipFor(item: (typeof ITEMS)[number]) {
  return <ChipGroup.Chip id={item.id}>{item.name}</ChipGroup.Chip>
}

// The close target on the chip of that name.
function closeOf(name: string) {
  return screen.getByRole('button', { name: `Remove ${name}` })
}

// The pill's fill and the label's colour, once the ease has run.
async function colorsOf(name: string) {
  await advance(theme.motion.durationShort2)
  const pill = getAnimatedStyle(chip(name))
  const text = getAnimatedStyle(screen.getByText(name))
  return {
    fill: same(pill.backgroundColor),
    label: same('color' in text ? text.color : undefined),
  }
}

function emptyState() {
  return <Text>Empty state</Text>
}

// The glyph slot before a chip's label, while one is drawn.
function glyphOf(name: string) {
  const pill = chip(name)
  const slot = pill.children.at(1)
  return slot === screen.getByText(name) ? undefined : child(slot)
}

// The group, which is the element rendered. A container is never an
// accessibility element of its own, since iOS would then read it as one and
// hide its chips, so it is not one Testing Library finds by role.
function group() {
  const root = screen.root
  if (root?.props.role !== 'group') {
    throw new TypeError('expected the group')
  }
  return root
}

function Group(props: Partial<ChipGroupProps>) {
  return (
    <ChipGroup label="Label" {...props}>
      <ChipGroup.Chip id="first">First item</ChipGroup.Chip>
      <ChipGroup.Chip id="second">Second item</ChipGroup.Chip>
      <ChipGroup.Chip id="third">Third item</ChipGroup.Chip>
    </ChipGroup>
  )
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

// The list the chips sit in, between the label and the line under it.
function list() {
  return child(group().children.at(1))
}

// A group whose chips are removed from state, as a call site's are: one chip
// to start, so a single removal empties it.
function OneRemovable({ empty }: { readonly empty?: () => ReactNode }) {
  const [ids, setIds] = useState(['first'])

  return (
    <ChipGroup
      label="Label"
      onRemove={removeFrom(setIds)}
      renderEmptyState={empty}
    >
      {ids.map((id) => (
        <ChipGroup.Chip id={id} key={id}>
          First item
        </ChipGroup.Chip>
      ))}
    </ChipGroup>
  )
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

function removeFrom(setIds: (update: (ids: string[]) => string[]) => void) {
  return (keys: Set<Key>) => {
    setIds((ids) => ids.filter((id) => !keys.has(id)))
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

// What a selection reports, as a sorted list, since React Stately's is a Set
// of its own class that a plain Set never equals.
function sorted(keys: Selection | Set<Key> | undefined) {
  if (keys === undefined || keys === 'all') {
    throw new TypeError('expected a set of keys')
  }
  return [...keys].map(String).toSorted()
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}) {
  return StyleSheet.flatten([element.props.style])
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('ChipGroup', () => {
  describe('semantics', () => {
    it('is a group named by its label', async () => {
      await render(<Group />)

      const label = screen.getByText('Label')
      expect(group().props.role).toBe('group')
      expect(typeof label.props.id).toBe('string')
      expect(group().props['aria-labelledby']).toBe(label.props.id)
    })

    it('makes each chip a button named by its label once it selects', async () => {
      await render(<Group selectionMode="multiple" />)

      expect(screen.getAllByRole('button')).toHaveLength(3)
      expect(chip('First item')).toBeTruthy()
      expect(chip('Second item')).toBeTruthy()
      expect(chip('Third item')).toBeTruthy()
    })

    it('makes no chip a button in a group that selects nothing', async () => {
      await render(<Group />)

      expect(screen.queryAllByRole('button')).toHaveLength(0)
      expect(screen.getByText('First item')).toBeTruthy()
    })

    it('reports which chips are selected', async () => {
      await render(
        <Group defaultSelectedKeys={SECOND} selectionMode="multiple" />,
      )

      expect(chip('First item')).not.toBeSelected()
      expect(chip('Second item')).toBeSelected()
      expect(chip('Third item')).not.toBeSelected()
    })

    it('reports a chip in disabledKeys as disabled, and takes no press', async () => {
      const onSelectionChange = jest.fn()
      await render(
        <Group
          disabledKeys={SECOND}
          onSelectionChange={onSelectionChange}
          selectionMode="multiple"
        />,
      )

      expect(chip('Second item')).toBeDisabled()
      expect(chip('First item')).toBeEnabled()
      await fireEvent.press(chip('Second item'), PRESS)
      expect(onSelectionChange).not.toHaveBeenCalled()
    })

    it('reports a chip given isDisabled as disabled', async () => {
      await render(
        <ChipGroup label="Label" selectionMode="multiple">
          <ChipGroup.Chip id="first" isDisabled>
            First item
          </ChipGroup.Chip>
        </ChipGroup>,
      )

      expect(chip('First item')).toBeDisabled()
    })

    it('marks a disabled chip disabled in a group that selects nothing', async () => {
      await render(<Group disabledKeys={SECOND} />)

      const pill = screen.getByText('Second item').parent
      expect(pill?.props['aria-disabled']).toBe(true)
      expect(
        screen.getByText('First item').parent?.props['aria-disabled'],
      ).toBe(false)
    })

    it('shows the description when there is no error', async () => {
      await render(<Group description="Supporting line" />)

      expect(screen.getByText('Supporting line')).toBeTruthy()
    })

    it('replaces the description with the error rather than stacking them', async () => {
      await render(
        <Group description="Supporting line" error="Choose at least one" />,
      )

      expect(screen.getByText('Choose at least one')).toBeTruthy()
      expect(screen.queryByText('Supporting line')).toBeNull()
    })

    it('leaves its line where a screen reader reaches it on iOS and Android', async () => {
      await render(<Group description="Supporting line" />)

      expect(group().props).not.toHaveProperty('aria-describedby')
    })

    it('points the group at its line on the web', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await render(<Group description="Supporting line" />)

      const line = screen.getByText('Supporting line')
      expect(typeof line.props.id).toBe('string')
      expect(group().props['aria-describedby']).toBe(line.props.id)
    })

    it('names no line on the web when there is none', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await render(<Group />)

      expect(group().props).not.toHaveProperty('aria-describedby')
    })
  })

  describe('selection', () => {
    it('selects one chip at a time', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <Group onSelectionChange={onSelectionChange} selectionMode="single" />,
      )

      await fireEvent.press(chip('Second item'), PRESS)
      expect(sorted(onSelectionChange.mock.lastCall?.[0])).toEqual(['second'])
      expect(chip('Second item')).toBeSelected()

      await fireEvent.press(chip('Third item'), PRESS)
      expect(sorted(onSelectionChange.mock.lastCall?.[0])).toEqual(['third'])
      expect(chip('Second item')).not.toBeSelected()
      expect(chip('Third item')).toBeSelected()
    })

    it('selects more than one when asked', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <Group
          onSelectionChange={onSelectionChange}
          selectionMode="multiple"
        />,
      )

      await fireEvent.press(chip('First item'), PRESS)
      await fireEvent.press(chip('Third item'), PRESS)

      expect(sorted(onSelectionChange.mock.lastCall?.[0])).toEqual([
        'first',
        'third',
      ])
      expect(chip('First item')).toBeSelected()
      expect(chip('Second item')).not.toBeSelected()
      expect(chip('Third item')).toBeSelected()
    })

    it('clears a selected chip when it is pressed again', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <Group
          defaultSelectedKeys={SECOND}
          onSelectionChange={onSelectionChange}
          selectionMode="single"
        />,
      )

      await fireEvent.press(chip('Second item'), PRESS)

      expect(sorted(onSelectionChange.mock.lastCall?.[0])).toEqual([])
      expect(chip('Second item')).not.toBeSelected()
    })

    it('keeps the last chip selected given disallowEmptySelection', async () => {
      await render(
        <Group
          defaultSelectedKeys={SECOND}
          disallowEmptySelection
          selectionMode="single"
        />,
      )

      await fireEvent.press(chip('Second item'), PRESS)

      expect(chip('Second item')).toBeSelected()
    })

    it('keeps its own selection from defaultSelectedKeys', async () => {
      await render(
        <Group
          defaultSelectedKeys={FIRST_AND_THIRD}
          selectionMode="multiple"
        />,
      )

      expect(chip('First item')).toBeSelected()
      expect(chip('Third item')).toBeSelected()

      await fireEvent.press(chip('First item'), PRESS)

      expect(chip('First item')).not.toBeSelected()
      expect(chip('Third item')).toBeSelected()
    })

    it('does not select on its own when controlled', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <Group
          onSelectionChange={onSelectionChange}
          selectedKeys={SECOND}
          selectionMode="multiple"
        />,
      )

      await fireEvent.press(chip('First item'), PRESS)

      expect(sorted(onSelectionChange.mock.lastCall?.[0])).toEqual([
        'first',
        'second',
      ])
      expect(chip('First item')).not.toBeSelected()
      expect(chip('Second item')).toBeSelected()
    })

    it("calls the chip's own onPress before the selection changes", async () => {
      const calls: string[] = []
      const onSelectionChange = jest.fn(() => {
        calls.push('select')
      })
      const onPress = jest.fn(() => {
        calls.push('press')
      })
      await render(
        <ChipGroup
          label="Label"
          onSelectionChange={onSelectionChange}
          selectionMode="multiple"
        >
          <ChipGroup.Chip id="first" onPress={onPress}>
            First item
          </ChipGroup.Chip>
        </ChipGroup>,
      )

      await fireEvent.press(chip('First item'), PRESS)

      expect(calls).toEqual(['press', 'select'])
    })
  })

  describe('removing', () => {
    it('draws no close target without onRemove', async () => {
      await render(<Group selectionMode="multiple" />)

      expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull()
    })

    it('draws a close target on every chip once it can remove', async () => {
      await render(<Group onRemove={jest.fn()} />)

      expect(closeOf('First item')).toBeTruthy()
      expect(closeOf('Second item')).toBeTruthy()
      expect(closeOf('Third item')).toBeTruthy()
    })

    it('reports the key of the chip the close target belongs to', async () => {
      const onRemove = jest.fn<(keys: Set<Key>) => void>()
      await render(<Group onRemove={onRemove} />)

      await fireEvent.press(closeOf('Second item'), PRESS)

      expect(onRemove).toHaveBeenCalledTimes(1)
      expect(sorted(onRemove.mock.lastCall?.[0])).toEqual(['second'])
    })

    it('reports a number key as the number it is', async () => {
      const onRemove = jest.fn<(keys: Set<Key>) => void>()
      await render(
        <ChipGroup label="Label" onRemove={onRemove}>
          <ChipGroup.Chip id={7}>First item</ChipGroup.Chip>
        </ChipGroup>,
      )

      await fireEvent.press(closeOf('First item'), PRESS)

      expect([...(onRemove.mock.lastCall?.[0] ?? [])]).toEqual([7])
    })

    it('removes rather than selects', async () => {
      const onSelectionChange = jest.fn()
      await render(
        <Group
          onRemove={jest.fn()}
          onSelectionChange={onSelectionChange}
          selectionMode="multiple"
        />,
      )

      await fireEvent.press(closeOf('First item'), PRESS)

      expect(onSelectionChange).not.toHaveBeenCalled()
      expect(chip('First item')).not.toBeSelected()
    })

    it('takes a remove label of its own', async () => {
      await render(<Group onRemove={jest.fn()} removeLabel="Delete" />)

      expect(
        screen.getByRole('button', { name: 'Delete First item' }),
      ).toBeTruthy()
    })

    it('names the close target by textValue for a label that is an element', async () => {
      await render(
        <ChipGroup label="Label" onRemove={jest.fn()}>
          <ChipGroup.Chip id="first" textValue="First item">
            <Text>First item</Text>
          </ChipGroup.Chip>
        </ChipGroup>,
      )

      expect(closeOf('First item')).toBeTruthy()
    })

    it('names the close target by the verb alone with no text to add', async () => {
      await render(
        <ChipGroup label="Label" onRemove={jest.fn()}>
          <ChipGroup.Chip id="first">
            <Text>First item</Text>
          </ChipGroup.Chip>
        </ChipGroup>,
      )

      // The name matcher trims, so the label itself is what shows no space is
      // left where the text would have gone.
      expect(
        screen.getByRole('button', { name: 'Remove' }).props.accessibilityLabel,
      ).toBe('Remove')
    })

    it('disables the close target of a disabled chip', async () => {
      const onRemove = jest.fn()
      await render(<Group disabledKeys={SECOND} onRemove={onRemove} />)

      expect(closeOf('Second item')).toBeDisabled()
      expect(closeOf('First item')).toBeEnabled()
      await fireEvent.press(closeOf('Second item'), PRESS)
      expect(onRemove).not.toHaveBeenCalled()
    })

    it('draws what renderEmptyState gives once the last chip is removed', async () => {
      await render(<OneRemovable empty={emptyState} />)

      await fireEvent.press(closeOf('First item'), PRESS)

      expect(screen.queryByText('First item')).toBeNull()
      expect(screen.getByText('Empty state')).toBeTruthy()
    })

    it('draws nothing in the row once emptied without renderEmptyState', async () => {
      await render(<OneRemovable />)

      await fireEvent.press(closeOf('First item'), PRESS)

      expect(list().children).toHaveLength(0)
    })
  })

  describe('from data', () => {
    it('draws a chip for each item, selected by its id', async () => {
      const onRemove = jest.fn<(keys: Set<Key>) => void>()
      await render(
        <ChipGroup
          defaultSelectedKeys={SECOND}
          items={ITEMS}
          label="Label"
          onRemove={onRemove}
          selectionMode="multiple"
        >
          {chipFor}
        </ChipGroup>,
      )

      expect(chip('First item')).not.toBeSelected()
      expect(chip('Second item')).toBeSelected()
      await fireEvent.press(closeOf('Third item'), PRESS)
      expect(sorted(onRemove.mock.lastCall?.[0])).toEqual(['third'])
    })

    it("keys a chip with no id by its item's", async () => {
      const onRemove = jest.fn<(keys: Set<Key>) => void>()
      await render(
        <ChipGroup items={ITEMS} label="Label" onRemove={onRemove}>
          {(item) => <ChipGroup.Chip>{item.name}</ChipGroup.Chip>}
        </ChipGroup>,
      )

      await fireEvent.press(closeOf('Second item'), PRESS)

      expect(sorted(onRemove.mock.lastCall?.[0])).toEqual(['second'])
    })
  })

  describe('the chips', () => {
    it('draws the page two containers', async () => {
      await render(
        <Group defaultSelectedKeys={SECOND} selectionMode="multiple" />,
      )

      expect(await colorsOf('Second item')).toEqual({
        fill: same(colors.secondaryContainer),
        label: same(colors.onSecondaryContainer),
      })
      expect(await colorsOf('First item')).toEqual({
        fill: same(withOpacity(colors.secondaryContainer, 0)),
        label: same(colors.onSurfaceVariant),
      })
      expect(same(getAnimatedStyle(chip('First item')).borderColor)).toBe(
        same(colors.outlineVariant),
      )
    })

    it('draws a disabled chip in the disabled role', async () => {
      await render(<Group disabledKeys={SECOND} selectionMode="multiple" />)

      expect((await colorsOf('Second item')).label).toBe(same(DISABLED_CONTENT))
    })

    it('draws the check on the selected chips alone, and follows the selection', async () => {
      await render(
        <Group defaultSelectedKeys={SECOND} selectionMode="single" />,
      )

      expect(pathsIn(child(glyphOf('Second item')))).toEqual([CHECK])
      expect(glyphOf('First item')).toBeUndefined()

      await fireEvent.press(chip('First item'), PRESS)

      expect(pathsIn(child(glyphOf('First item')))).toEqual([CHECK])
      expect(glyphOf('Second item')).toBeUndefined()
    })

    it('draws its icon in the primary role, giving its place to the check', async () => {
      await render(
        <ChipGroup
          defaultSelectedKeys={SECOND}
          label="Label"
          selectionMode="multiple"
        >
          <ChipGroup.Chip icon={ICON} id="first">
            First item
          </ChipGroup.Chip>
          <ChipGroup.Chip icon={ICON} id="second">
            Second item
          </ChipGroup.Chip>
        </ChipGroup>,
      )

      expect(screen.getAllByTestId('icon')).toHaveLength(1)
      expect(screen.getByTestId('icon')).toHaveTextContent(
        `${colors.primary} 18`,
      )
      expect(pathsIn(child(glyphOf('Second item')))).toEqual([CHECK])
    })

    it('draws the page pill, and its label in label-large on one line', async () => {
      await render(<Group selectionMode="multiple" />)

      expect(styleOf(chip('First item'))).toMatchObject({
        borderRadius: radii.sm,
        borderWidth: 1,
        minHeight: sizing.controlXs,
        paddingHorizontal: spacing.lg,
      })
      const text = screen.getByText('First item')
      expect(text.props.numberOfLines).toBe(1)
      expect(styleOf(text)).toMatchObject({
        fontSize: typography.labelLargeSize,
      })
    })

    it('draws the same pill in a group that selects nothing', async () => {
      await render(<Group />)

      const pill = child(screen.getByText('First item').parent)
      expect(styleOf(pill)).toMatchObject({
        borderRadius: radii.sm,
        minHeight: sizing.controlXs,
      })
      expect(same(getAnimatedStyle(pill).borderColor)).toBe(
        same(colors.outlineVariant),
      )
    })

    it("puts the chip's style, ref and testID on its pill", async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        <ChipGroup label="Label" selectionMode="multiple">
          <ChipGroup.Chip id="first" ref={ref} style={CALL_SITE} testID="chip">
            First item
          </ChipGroup.Chip>
        </ChipGroup>,
      )

      expect(screen.getByTestId('chip')).toBe(chip('First item'))
      expect(styleOf(chip('First item'))).toMatchObject(CALL_SITE)
      expect(ref.current).not.toBeNull()
    })

    it("puts the chip's testID on its pill in a group that selects nothing", async () => {
      await render(
        <ChipGroup label="Label">
          <ChipGroup.Chip id="first" testID="chip">
            First item
          </ChipGroup.Chip>
        </ChipGroup>,
      )

      expect(screen.getByTestId('chip')).toBe(
        screen.getByText('First item').parent,
      )
    })
  })

  describe('the close target', () => {
    it('draws the close glyph at 18dp in the label colour', async () => {
      await render(
        <Group
          defaultSelectedKeys={SECOND}
          onRemove={jest.fn()}
          selectionMode="multiple"
        />,
      )

      const glyph = child(closeOf('First item').children.at(1))
      expect(pathsIn(glyph)).toEqual([CLOSE])
      expect(glyph.props).toMatchObject({ height: 18, width: 18 })
      expect(glyph.props.color).toBe(colors.onSurfaceVariant)
      expect(child(closeOf('Second item').children.at(1)).props.color).toBe(
        colors.onSecondaryContainer,
      )
    })

    it('sits over the pill’s end, which leaves room for it', async () => {
      await render(<Group onRemove={jest.fn()} selectionMode="multiple" />)

      expect(styleOf(closeOf('First item'))).toMatchObject({
        end: 1 + spacing.lg - spacing.sm,
        height: 18,
        position: 'absolute',
        width: 18,
      })
      expect(styleOf(chip('First item'))).toMatchObject({
        paddingEnd: spacing.lg + 18,
      })
    })

    it('leaves the pill its own padding without onRemove', async () => {
      await render(<Group selectionMode="multiple" />)

      expect(styleOf(chip('First item'))).not.toHaveProperty('paddingEnd')
    })

    it("reaches WCAG's 24dp", async () => {
      await render(<Group onRemove={jest.fn()} />)

      expect(closeOf('First item').props.hitSlop).toEqual({
        bottom: 3,
        left: 3,
        right: 3,
        top: 3,
      })
    })

    it('draws a hover and a pressed layer in the label colour, and none for focus', async () => {
      await render(<Group onRemove={jest.fn()} />)

      const layer = () => child(closeOf('First item').children.at(0))
      expect(styleOf(layer())).toMatchObject({
        backgroundColor: colors.onSurfaceVariant,
        borderRadius: radii.circle,
        opacity: 0,
      })

      await fireEvent(closeOf('First item'), 'hoverIn')
      expect(styleOf(layer()).opacity).toBe(stateLayerOpacity.hover)

      await fireEvent(closeOf('First item'), 'pressIn', PRESS)
      expect(styleOf(layer()).opacity).toBe(stateLayerOpacity.pressed)

      await fireEvent(closeOf('First item'), 'pressOut', PRESS)
      await fireEvent(closeOf('First item'), 'hoverOut')
      await fireEvent(closeOf('First item'), 'focus')
      expect(styleOf(layer()).opacity).toBe(0)
    })

    it('draws a 2dp ring in the label colour for focus from a key', async () => {
      await render(<Group onRemove={jest.fn()} />)

      expect(styleOf(closeOf('First item'))).not.toHaveProperty('outlineWidth')
      await fireEvent(closeOf('First item'), 'focus')

      expect(styleOf(closeOf('First item'))).toMatchObject({
        outlineColor: colors.onSurfaceVariant,
        outlineOffset: 1,
        outlineStyle: 'solid',
        outlineWidth: 2,
      })
    })

    it('draws no ring for focus that arrives with a press', async () => {
      await render(<Group onRemove={jest.fn()} />)

      await fireEvent(closeOf('First item'), 'pressIn', PRESS)
      await fireEvent(closeOf('First item'), 'focus')

      expect(styleOf(closeOf('First item'))).not.toHaveProperty('outlineWidth')
    })
  })

  describe('the target', () => {
    it('reaches half the gap between rows, and the view holding it does too', async () => {
      await render(<Group onRemove={jest.fn()} selectionMode="multiple" />)

      const reach = {
        bottom: spacing.sm / 2,
        left: 0,
        right: 0,
        top: spacing.sm / 2,
      }
      expect(chip('First item').props.hitSlop).toEqual(reach)
      expect(chip('First item').parent?.props.hitSlop).toEqual(reach)
    })

    it('reaches across to 48dp once a narrow chip is measured', async () => {
      await render(<Group selectionMode="multiple" />)

      await fireEvent(chip('First item'), 'layout', {
        nativeEvent: { layout: { height: 32, width: 40, x: 0, y: 0 } },
      })

      expect(chip('First item').props.hitSlop).toMatchObject({
        left: 4,
        right: 4,
      })
    })

    it("takes the chip's own hitSlop over its own", async () => {
      await render(
        <ChipGroup label="Label" selectionMode="multiple">
          <ChipGroup.Chip hitSlop={12} id="first">
            First item
          </ChipGroup.Chip>
        </ChipGroup>,
      )

      expect(chip('First item').props.hitSlop).toBe(12)
      expect(chip('First item').parent?.props.hitSlop).toBe(12)
    })

    it('reaches nowhere in a group that selects nothing', async () => {
      await render(<Group />)

      const pill = child(screen.getByText('First item').parent)
      expect(pill.props.hitSlop).toBeUndefined()
      expect(pill.parent?.props.hitSlop).toBeUndefined()
    })

    it("calls the chip's own onLayout", async () => {
      const onLayout = jest.fn()
      await render(
        <ChipGroup label="Label" selectionMode="multiple">
          <ChipGroup.Chip id="first" onLayout={onLayout}>
            First item
          </ChipGroup.Chip>
        </ChipGroup>,
      )

      await fireEvent(chip('First item'), 'layout', {
        nativeEvent: { layout: { height: 32, width: 40, x: 0, y: 0 } },
      })

      expect(onLayout).toHaveBeenCalledTimes(1)
    })

    it("calls the chip's own onLayout in a group that selects nothing", async () => {
      const onLayout = jest.fn()
      await render(
        <ChipGroup label="Label">
          <ChipGroup.Chip id="first" onLayout={onLayout}>
            First item
          </ChipGroup.Chip>
        </ChipGroup>,
      )

      await fireEvent(child(screen.getByText('First item').parent), 'layout', {
        nativeEvent: { layout: { height: 32, width: 40, x: 0, y: 0 } },
      })

      expect(onLayout).toHaveBeenCalledTimes(1)
    })
  })

  describe('the press feedback', () => {
    it('lays the state layer over a chip the group lets be selected', async () => {
      await render(<Group selectionMode="multiple" />)

      const surface = child(chip('First item').children.at(0))
      const layer = child(surface.children.at(0))
      await fireEvent(chip('First item'), 'hoverIn')

      expect(styleOf(layer)).toMatchObject({
        backgroundColor: colors.onSurface,
        opacity: stateLayerOpacity.hover,
      })
    })

    it('draws no layer on a chip a press does nothing to', async () => {
      await render(<Group />)

      const pill = child(screen.getByText('First item').parent)
      expect(pill.children).toHaveLength(1)
    })

    it('shows the focus ring when focus arrives from a key', async () => {
      await render(<Group selectionMode="multiple" />)

      await fireEvent(chip('First item'), 'focus')

      expect(styleOf(chip('First item'))).toMatchObject({
        outlineColor: colors.primary,
        outlineWidth: 2,
      })
    })
  })

  describe('the chrome', () => {
    it('sets its label in label-large on surface variant, and error while invalid', async () => {
      const { rerender } = await render(<Group />)

      expect(styleOf(screen.getByText('Label'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.labelLargeSize,
      })

      await rerender(<Group error="Choose at least one" />)

      expect(styleOf(screen.getByText('Label'))).toMatchObject({
        color: colors.error,
      })
      expect(styleOf(screen.getByText('Choose at least one'))).toMatchObject({
        color: colors.error,
        fontSize: typography.bodySmallSize,
      })
    })

    it('sets its description in body small on surface variant', async () => {
      await render(<Group description="Supporting line" />)

      const line = screen.getByText('Supporting line')
      expect(styleOf(line)).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.bodySmallSize,
      })
      expect(styleOf(child(line.parent))).toMatchObject({
        marginTop: spacing.xs,
      })
    })

    it('wraps its chips 8dp apart, and keeps a chip’s height while empty', async () => {
      await render(<Group />)

      expect(styleOf(list())).toMatchObject({
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        minHeight: sizing.controlXs,
      })
      expect(styleOf(group())).toMatchObject({
        flexDirection: 'column',
        rowGap: spacing.xs,
      })
    })

    it("puts the group's style and testID on the group", async () => {
      await render(<Group style={CALL_SITE} testID="group" />)

      expect(screen.getByTestId('group')).toBe(group())
      expect(styleOf(group())).toMatchObject(CALL_SITE)
    })
  })
})

describe('ChipGroup.Chip', () => {
  it('renders nothing outside a group', async () => {
    await render(<ChipGroup.Chip id="first">First item</ChipGroup.Chip>)

    expect(screen.queryByText('First item')).toBeNull()
  })
})
