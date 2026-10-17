import type { ComponentRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { TestInstance, TestNode } from 'test-renderer'

import { afterEach, describe, expect, it } from '@jest/globals'
import { act, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { Dimensions, StyleSheet, Text, View } from 'react-native'

import { SupportingPane } from '.'
import { scopeFor } from '../../theme/scope'
import { breakpoints } from '../../tokens/defaults'

const { theme } = scopeFor('light', {})

const CALL_SITE = { paddingTop: 4 }

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

const MAIN = <Text>Main</Text>

// Views to hold on to across a change of shape, which the one test that
// reads them is handed fresh by React.
const MAIN_REF = createRef<ComponentRef<typeof View>>()
const SUPPORTING_REF = createRef<ComponentRef<typeof View>>()
const MAIN_VIEW = <View ref={MAIN_REF} />
const SUPPORTING_VIEW = <View ref={SUPPORTING_REF} />
const SUPPORTING = <Text>Supporting</Text>

afterEach(() => {
  Dimensions.set(INITIAL)
})

function child(node: TestNode | undefined): TestInstance {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

function layout() {
  return screen.getByTestId('layout')
}

// The text inside each pane, in the order the tree holds them.
function order() {
  return panes().map((pane) => child(pane.children[0]).children[0])
}

function panes() {
  return layout().children.map(child)
}

// The window as the platform reports it when it changes, which is what
// `useWindowDimensions()` listens for.
function resize(width: number) {
  Dimensions.set({ ...INITIAL, window: { ...INITIAL.window, width } })
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

describe('supporting pane', () => {
  describe('stacked, below the expanded window size', () => {
    it.each([
      ['compact', breakpoints.medium - 1],
      ['medium', breakpoints.expanded - 1],
    ])('puts the supporting pane under the main one, %s', async (_, width) => {
      resize(width)
      await render(
        <SupportingPane main={MAIN} supporting={SUPPORTING} testID="layout" />,
      )

      expect(styleOf(layout())).not.toHaveProperty('flexDirection')
      expect(order()).toEqual(['Main', 'Supporting'])
      for (const pane of panes()) {
        expect(styleOf(pane)).not.toHaveProperty('width')
        expect(styleOf(pane)).not.toHaveProperty('flex')
      }
    })

    it('stacks a leading pane under the main one too', async () => {
      resize(breakpoints.medium - 1)
      await render(
        <SupportingPane
          main={MAIN}
          placement="leading"
          supporting={SUPPORTING}
          testID="layout"
        />,
      )

      expect(styleOf(layout())).not.toHaveProperty('flexDirection')
      expect(order()).toEqual(['Main', 'Supporting'])
    })
  })

  describe('side by side, from the expanded window size up', () => {
    it('stands a 360dp pane at the main pane’s end, the main pane taking the rest', async () => {
      resize(breakpoints.expanded)
      await render(
        <SupportingPane main={MAIN} supporting={SUPPORTING} testID="layout" />,
      )

      const [main, supporting] = panes()
      expect(styleOf(layout())).toMatchObject({ flexDirection: 'row' })
      expect(styleOf(main)).toMatchObject({ flex: 1, minWidth: 0 })
      expect(styleOf(supporting)).toMatchObject({ width: 360 })
    })

    it('draws a leading pane at the start by reversing the row, keeping the main pane first', async () => {
      resize(breakpoints.expanded)
      await render(
        <SupportingPane
          main={MAIN}
          placement="leading"
          supporting={SUPPORTING}
          testID="layout"
        />,
      )

      expect(styleOf(layout())).toMatchObject({ flexDirection: 'row-reverse' })
      expect(order()).toEqual(['Main', 'Supporting'])
      expect(styleOf(panes()[1])).toMatchObject({ width: 360 })
    })

    it('stays side by side in the widest windows', async () => {
      resize(breakpoints.extraLarge)
      await render(
        <SupportingPane main={MAIN} supporting={SUPPORTING} testID="layout" />,
      )

      expect(styleOf(layout())).toMatchObject({ flexDirection: 'row' })
    })
  })

  it('sets the scale’s 24dp between the panes in either shape', async () => {
    resize(breakpoints.medium - 1)
    await render(
      <SupportingPane main={MAIN} supporting={SUPPORTING} testID="layout" />,
    )
    expect(styleOf(layout())).toMatchObject({ gap: theme.spacing.xl })

    await act(() => {
      resize(breakpoints.expanded)
    })
    expect(styleOf(layout())).toMatchObject({ gap: theme.spacing.xl })
  })

  it('keeps both panes mounted as the window changes shape', async () => {
    resize(breakpoints.medium - 1)
    await render(
      <SupportingPane
        main={MAIN_VIEW}
        supporting={SUPPORTING_VIEW}
        testID="layout"
      />,
    )
    const before = [MAIN_REF.current, SUPPORTING_REF.current]

    await act(() => {
      resize(breakpoints.expanded)
    })

    expect(styleOf(layout())).toMatchObject({ flexDirection: 'row' })
    expect(before).not.toContain(null)
    expect([MAIN_REF.current, SUPPORTING_REF.current]).toEqual(before)
  })

  it('paints nothing', async () => {
    await render(
      <SupportingPane main={MAIN} supporting={SUPPORTING} testID="layout" />,
    )

    expect(styleOf(layout())).not.toHaveProperty('backgroundColor')
    for (const pane of panes()) {
      expect(styleOf(pane)).not.toHaveProperty('backgroundColor')
    }
  })

  it('lands `style`, `ref` and `testID` on the outer view', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(
      <SupportingPane
        main={MAIN}
        ref={ref}
        style={CALL_SITE}
        supporting={SUPPORTING}
        testID="layout"
      />,
    )

    expect(styleOf(layout())).toMatchObject({ paddingTop: 4 })
    expect(ref.current).not.toBeNull()
  })
})
