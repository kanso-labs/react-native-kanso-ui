import type { ComponentRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { TestInstance, TestNode } from 'test-renderer'

import { afterEach, describe, expect, it } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { Dimensions, StyleSheet, Text, View } from 'react-native'

import { Feed } from '.'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const GAP = theme.spacing.xl

const CALL_SITE = { alignItems: 'center', paddingTop: 4 } as const

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

const LABELS = ['First item', 'Second item', 'Third item', 'Fourth item']

afterEach(() => {
  Dimensions.set(INITIAL)
})

// What each cell starts at before it grows to its share, in a room of
// `room` laid into `columns`: an equal part of what the gaps leave, half a
// dp under it.
function basisOf(room: number, columns: number) {
  return (room - GAP * (columns - 1)) / columns - 0.5
}

function cells() {
  return grid().children.map(child)
}

function child(node: TestNode | undefined): TestInstance {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

function feed() {
  return screen.getByTestId('feed')
}

function grid() {
  return child(feed().children[0])
}

// Each item, by its label.
function items(count = LABELS.length) {
  return LABELS.slice(0, count).map((label) => <Text key={label}>{label}</Text>)
}

// The label in each cell, an empty cell as null.
function labels() {
  return cells().map((cell) => {
    const item = cell.children.at(0)
    return item === undefined ? null : child(item).children[0]
  })
}

// The grid laid out at `width`, as the platform reports it once the feed has
// drawn: the room the feed has inside its own padding.
async function layOut(width: number) {
  await fireEvent(grid(), 'layout', {
    nativeEvent: { layout: { height: 100, width, x: 0, y: 0 } },
  })
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

// The window as the platform reports it, which is the room the feed guesses
// before its first layout.
function windowAt(width: number) {
  Dimensions.set({ ...INITIAL, window: { ...INITIAL.window, width } })
}

describe('feed', () => {
  describe('columns', () => {
    it('fits as many columns of the minimum as the room holds', async () => {
      await render(
        <Feed minItemWidth={180} testID="feed">
          {items()}
        </Feed>,
      )

      // Three cells of 180dp and two gaps of 24dp are 588dp; a fourth would
      // need 792dp.
      await layOut(600)
      expect(labels()).toEqual([...LABELS, null, null])
      expect(styleOf(cells()[0]).flexBasis).toBe(basisOf(600, 3))

      await layOut(792)
      expect(labels()).toEqual(LABELS)
      expect(styleOf(cells()[0]).flexBasis).toBe(basisOf(792, 4))
    })

    it('counts a column that exactly fits, gaps included', async () => {
      await render(
        <Feed minItemWidth={180} testID="feed">
          {items()}
        </Feed>,
      )

      await layOut(180 * 2 + GAP)
      expect(styleOf(cells()[0]).flexBasis).toBe(basisOf(180 * 2 + GAP, 2))

      await layOut(180 * 2 + GAP - 1)
      expect(styleOf(cells()[0]).flexBasis).toBe(basisOf(180 * 2 + GAP - 1, 1))
    })

    it('grows each cell to its share and lets it shrink past its content', async () => {
      await render(
        <Feed minItemWidth={180} testID="feed">
          {items()}
        </Feed>,
      )

      await layOut(600)
      for (const cell of cells()) {
        expect(styleOf(cell)).toMatchObject({
          flexGrow: 1,
          flexShrink: 1,
          minWidth: 0,
        })
      }
    })

    it('keeps one column in less room than the minimum, at the room it has', async () => {
      await render(
        <Feed minItemWidth={260} testID="feed">
          {items(2)}
        </Feed>,
      )

      await layOut(200)
      expect(labels()).toEqual(['First item', 'Second item'])
      expect(styleOf(cells()[0]).flexBasis).toBe(basisOf(200, 1))
    })

    it('reads a share of the room as the minimum', async () => {
      await render(
        <Feed minItemWidth="50%" testID="feed">
          {items(3)}
        </Feed>,
      )

      // Two halves leave no room for the gap between them, so one column.
      await layOut(1200)
      expect(labels()).toEqual(['First item', 'Second item', 'Third item'])
      expect(styleOf(cells()[0]).flexBasis).toBe(basisOf(1200, 1))
    })

    it('keeps the empty cells of a short line rather than stretching what it holds', async () => {
      await render(
        <Feed minItemWidth={180} testID="feed">
          {items(2)}
        </Feed>,
      )

      await layOut(900)
      expect(labels()).toEqual(['First item', 'Second item', null, null])
      for (const cell of cells()) {
        expect(styleOf(cell).flexBasis).toBe(basisOf(900, 4))
      }
    })

    it('takes 180dp as the minimum by default', async () => {
      await render(<Feed testID="feed">{items()}</Feed>)

      await layOut(180 * 3 + GAP * 2)
      expect(styleOf(cells()[0]).flexBasis).toBe(basisOf(180 * 3 + GAP * 2, 3))
    })
  })

  describe('the room', () => {
    it('guesses the window before its first layout', async () => {
      windowAt(180 * 2 + GAP)
      await render(
        <Feed minItemWidth={180} testID="feed">
          {items()}
        </Feed>,
      )

      expect(styleOf(cells()[0]).flexBasis).toBe(basisOf(180 * 2 + GAP, 2))
    })

    it('follows the room it is given rather than the window', async () => {
      windowAt(1200)
      await render(
        <Feed minItemWidth={180} testID="feed">
          {items()}
        </Feed>,
      )

      await layOut(300)
      expect(styleOf(cells()[0]).flexBasis).toBe(basisOf(300, 1))
    })

    it('measures a grid spanning its content box, whatever it aligns to', async () => {
      await render(
        <Feed style={CALL_SITE} testID="feed">
          {items()}
        </Feed>,
      )

      expect(styleOf(grid())).toMatchObject({
        alignSelf: 'stretch',
        flexDirection: 'row',
        flexWrap: 'wrap',
      })
    })
  })

  describe('spacing', () => {
    it('sets the scale’s 24dp between lines and between cells', async () => {
      await render(<Feed testID="feed">{items()}</Feed>)

      expect(styleOf(grid())).toMatchObject({ columnGap: GAP, rowGap: GAP })
    })

    it('paints nothing', async () => {
      await render(<Feed testID="feed">{items()}</Feed>)

      expect(styleOf(feed())).not.toHaveProperty('backgroundColor')
      expect(styleOf(grid())).not.toHaveProperty('backgroundColor')
    })
  })

  describe('children', () => {
    it('lays out the items a fragment holds and none for null', async () => {
      await render(
        <Feed minItemWidth={180} testID="feed">
          <>
            <Text>First item</Text>
            <Text>Second item</Text>
          </>
          {null}
          <Text>Third item</Text>
        </Feed>,
      )

      await layOut(600)
      expect(labels()).toEqual(['First item', 'Second item', 'Third item'])
    })

    it('draws no cell for no items', async () => {
      await render(<Feed testID="feed" />)

      expect(grid().children).toHaveLength(0)
    })

    it('keeps every item mounted as the columns change', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        <Feed minItemWidth={180} testID="feed">
          {items(3)}
          <View key="last" ref={ref} />
        </Feed>,
      )

      await layOut(900)
      const last = ref.current
      await layOut(200)

      expect(last).not.toBeNull()
      expect(ref.current).toBe(last)
    })
  })

  describe('the call site', () => {
    it('lands `style`, `ref` and `testID` on the outer view', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        <Feed ref={ref} style={CALL_SITE} testID="feed">
          {items()}
        </Feed>,
      )

      expect(styleOf(feed())).toMatchObject({ paddingTop: 4 })
      expect(ref.current).not.toBeNull()
    })
  })
})
