import type { ComponentRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { TestInstance, TestNode } from 'test-renderer'

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { createRef, useCallback, useState } from 'react'
import {
  Dimensions,
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import type { ListDetailProps } from '.'
import type { WindowSizeClass } from '../../hooks/useWindowSizeClass'
import type { KuiTheme } from '../../tokens/defaults'

import { ListDetail } from '.'
import { ThemeScope } from '../../theme-scope'
import { breakpoints } from '../../tokens/defaults'

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

// Every class from expanded up has room for both panes, at its lower bound,
// and every class below it for one, a dp under the next class's bound.
const WIDE: [WindowSizeClass, number][] = [
  ['expanded', breakpoints.expanded],
  ['large', breakpoints.large],
  ['extraLarge', breakpoints.extraLarge],
]
const NARROW: [WindowSizeClass, number][] = [
  ['compact', breakpoints.medium - 1],
  ['medium', breakpoints.expanded - 1],
]

// The slots most cases fill, each a line of text naming its pane.
const DETAIL = <Text>Detail</Text>
const LIST = <Text>List</Text>

// A theme of its own, which nothing else renders under.
const OWN_THEME: KuiTheme = {}

afterEach(() => {
  Dimensions.set(INITIAL)
})

function child(node: TestNode | undefined): TestInstance {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

// A count that only its own presses change, standing in for whatever a pane
// holds that a rotation must not lose: a selection, a scroll position.
function Counter({ label }: { readonly label: string }) {
  const [count, setCount] = useState(0)
  const press = useCallback(() => {
    setCount((current) => current + 1)
  }, [])

  return (
    <Pressable accessibilityRole="button" onPress={press}>
      <Text>{`${label} ${String(count)}`}</Text>
    </Pressable>
  )
}

function detailPane() {
  return child(screen.getByTestId('layout').children[1])
}

function listPane() {
  return child(screen.getByTestId('layout').children[0])
}

async function renderLayout(props: Partial<ListDetailProps> = {}) {
  return render(
    <ListDetail detail={DETAIL} list={LIST} testID="layout" {...props} />,
  )
}

// The window as the platform reports it when it changes, which is what the
// size class follows.
function resize(width: number) {
  Dimensions.set({ ...INITIAL, window: { ...INITIAL.window, width } })
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

describe('ListDetail', () => {
  describe.each(WIDE)('at the %s window size, %idp', (sizeClass, width) => {
    it.each(['list', 'detail'] as const)(
      'shows both panes with showing set to %s',
      async (showing) => {
        resize(width)
        await renderLayout({ showing })

        expect(screen.getByText('List')).toBeTruthy()
        expect(screen.getByText('Detail')).toBeTruthy()
        expect(styleOf(listPane()).display).toBeUndefined()
        expect(styleOf(detailPane()).display).toBeUndefined()
        expect(listPane().props['aria-hidden']).toBe(false)
        expect(detailPane().props['aria-hidden']).toBe(false)
      },
    )

    it('gives the list the fixed pane and the detail the rest', async () => {
      resize(width)
      await renderLayout()

      expect(styleOf(listPane())).toMatchObject({
        width: sizeClass === 'extraLarge' ? 412 : 360,
      })
      expect(styleOf(listPane()).flex).toBeUndefined()
      expect(styleOf(detailPane())).toMatchObject({ flex: 1, minWidth: 0 })
      expect(styleOf(detailPane()).width).toBeUndefined()
    })
  })

  describe.each(NARROW)('at the %s window size, %idp', (_sizeClass, width) => {
    it('shows the list alone by default', async () => {
      resize(width)
      await renderLayout()

      expect(screen.getByText('List')).toBeTruthy()
      expect(screen.queryByText('Detail')).toBeNull()
      expect(styleOf(detailPane()).display).toBe('none')
      expect(detailPane().props['aria-hidden']).toBe(true)
      expect(listPane().props['aria-hidden']).toBe(false)
    })

    it('shows the detail alone when showing it', async () => {
      resize(width)
      await renderLayout({ showing: 'detail' })

      expect(screen.getByText('Detail')).toBeTruthy()
      expect(screen.queryByText('List')).toBeNull()
      expect(styleOf(listPane()).display).toBe('none')
      expect(listPane().props['aria-hidden']).toBe(true)
      expect(detailPane().props['aria-hidden']).toBe(false)
    })

    it('gives the pane showing the whole width', async () => {
      resize(width)
      await renderLayout()

      expect(styleOf(listPane())).toMatchObject({ flex: 1, minWidth: 0 })
      expect(styleOf(listPane()).width).toBeUndefined()
    })

    it('keeps the hidden pane mounted', async () => {
      resize(width)
      await renderLayout()

      expect(
        screen.getByText('Detail', { includeHiddenElements: true }),
      ).toBeTruthy()
    })
  })

  describe('when the window changes', () => {
    it('moves between the forms with showing kept', async () => {
      resize(breakpoints.medium - 1)
      await renderLayout({ showing: 'detail' })

      expect(screen.queryByText('List')).toBeNull()

      await act(() => {
        resize(breakpoints.expanded)
      })

      expect(screen.getByText('List')).toBeTruthy()
      expect(screen.getByText('Detail')).toBeTruthy()

      await act(() => {
        resize(breakpoints.medium - 1)
      })

      expect(screen.queryByText('List')).toBeNull()
      expect(screen.getByText('Detail')).toBeTruthy()
    })

    it('keeps what each pane holds', async () => {
      resize(breakpoints.expanded)
      await renderLayout({
        detail: <Counter label="Detail" />,
        list: <Counter label="List" />,
        showing: 'detail',
      })

      await fireEvent.press(screen.getByText('List 0'))
      await fireEvent.press(screen.getByText('Detail 0'))
      await fireEvent.press(screen.getByText('Detail 1'))

      await act(() => {
        resize(breakpoints.medium - 1)
      })

      expect(
        screen.getByText('List 1', { includeHiddenElements: true }),
      ).toBeTruthy()
      expect(screen.getByText('Detail 2')).toBeTruthy()

      await act(() => {
        resize(breakpoints.extraLarge)
      })

      expect(screen.getByText('List 1')).toBeTruthy()
      expect(screen.getByText('Detail 2')).toBeTruthy()
    })
  })

  describe('in a right-to-left layout', () => {
    it('leaves the row to put the list at the start, on the right', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      resize(breakpoints.expanded)
      // A theme of its own, so the stylesheets are built under right-to-left
      // rather than handed back from a test that ran before it.
      await render(
        <ThemeScope theme={OWN_THEME}>
          <ListDetail detail={DETAIL} list={LIST} testID="layout" />
        </ThemeScope>,
      )

      const root = styleOf(screen.getByTestId('layout'))

      expect(root.flexDirection).toBe('row')
      expect(root.direction).toBeUndefined()
      expect(textIn(listPane())).toBe('List')
      expect(textIn(detailPane())).toBe('Detail')
    })
  })

  describe('the safe area', () => {
    it('pads each pane where it meets the screen edge', async () => {
      resize(breakpoints.expanded)
      await renderLayout()

      for (const pane of [listPane(), detailPane()]) {
        const area = child(pane.children[0])

        expect(area.type).toBe('RNCSafeAreaView')
        expect(area.props.edges).toEqual({
          bottom: 'additive',
          left: 'additive',
          right: 'additive',
          top: 'additive',
        })
      }
    })
  })

  describe('the root', () => {
    it('grows to fill the screen, with 24dp between the panes', async () => {
      await renderLayout()

      expect(styleOf(screen.getByTestId('layout'))).toMatchObject({
        flexGrow: 1,
        gap: 24,
      })
    })

    it('takes a ref and a style of the call site', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await renderLayout({ ref, style: { flexGrow: 0, height: 120 } })

      expect(ref.current).not.toBeNull()
      expect(styleOf(screen.getByTestId('layout'))).toMatchObject({
        flexDirection: 'row',
        flexGrow: 0,
        height: 120,
      })
    })
  })
})

// The text inside a pane, which says whose pane it is.
function textIn(pane: TestInstance): string {
  const texts: string[] = []
  const walk = (node: TestNode) => {
    if (typeof node === 'string') {
      texts.push(node)
    } else {
      node.children.forEach(walk)
    }
  }
  walk(pane)
  return texts.join('')
}
