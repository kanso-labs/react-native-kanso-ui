import type { TextStyle } from 'react-native'

import { describe, expect, it } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { AppBar } from '../components/app-bar'
import { scopeFor } from '../theme/scope'
import { COLLAPSED_BLOCK_SIZE, useAppBarScroll } from './useAppBarScroll'

const { typography } = scopeFor('light', {}).theme

// The viewport the scrolling screens below share, in dp.
const VIEWPORT = 600

// A large bar with a subtitle, the tallest the library draws.
const LARGE = 152

// The bar reporting its height, as React Native does once it is laid out.
async function layout(height: number) {
  await fireEvent(screen.getByTestId('bar'), 'layout', {
    nativeEvent: { layout: { height, width: 400, x: 0, y: 0 } },
  })
}

// What the hook reports, written out where a query can read it, with a
// stand-in for the bar and the view that scrolls.
function Probe({ collapseAfter }: { readonly collapseAfter?: number }) {
  const { collapsed, onLayout, onScroll, scrolled } = useAppBarScroll({
    collapseAfter,
  })

  return (
    <>
      <View onLayout={onLayout} testID="bar" />
      <ScrollView onScroll={onScroll} testID="scroller" />
      <Text testID="state">{`${collapsed ? 'collapsed' : 'expanded'} ${scrolled ? 'scrolled' : 'top'}`}</Text>
    </>
  )
}

// A screen wired as the hook's own example wires one.
function Screen() {
  const { collapsed, onLayout, onScroll, scrolled } = useAppBarScroll({
    collapseAfter: 24,
  })

  return (
    <>
      <AppBar
        collapsed={collapsed}
        headline="Headline"
        onLayout={onLayout}
        pinned
        scrolled={scrolled}
        size="lg"
        testID="bar"
      />
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        testID="scroller"
      >
        <Text>Supporting line</Text>
      </ScrollView>
    </>
  )
}

// The screen scrolled to an offset, over content of the given height.
async function scroll(offset: number, content: number) {
  await fireEvent.scroll(screen.getByTestId('scroller'), {
    nativeEvent: {
      contentInset: { bottom: 0, left: 0, right: 0, top: 0 },
      contentOffset: { x: 0, y: offset },
      contentSize: { height: content, width: 400 },
      layoutMeasurement: { height: VIEWPORT, width: 400 },
      zoomScale: 1,
    },
  })
}

// What the probe reports: whether the bar is collapsed, then whether the
// screen is scrolled.
function state() {
  const text: unknown = screen.getByTestId('state').props.children
  if (typeof text !== 'string') {
    throw new TypeError('expected the probe to write a string')
  }
  return text
}

function textStyleOf(element: { props: { style?: TextStyle } }): TextStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

describe('useAppBarScroll', () => {
  it('starts neither scrolled nor collapsed', async () => {
    await render(<Probe />)

    expect(state()).toBe('expanded top')
  })

  it('is scrolled once the screen moves past zero', async () => {
    await render(<Probe collapseAfter={100} />)

    await scroll(1, 2000)

    expect(state()).toBe('expanded scrolled')

    await scroll(0, 2000)

    expect(state()).toBe('expanded top')
  })

  it('collapses only past the offset it is given', async () => {
    await render(<Probe collapseAfter={100} />)

    await scroll(100, 2000)

    expect(state()).toMatch(/^expanded /)

    await scroll(101, 2000)

    expect(state()).toMatch(/^collapsed /)
  })

  it('collapses as soon as the screen moves by default', async () => {
    await render(<Probe />)

    await scroll(1, 2000)

    expect(state()).toMatch(/^collapsed /)
  })

  it('expands again back at the offset', async () => {
    await render(<Probe collapseAfter={100} />)

    await scroll(400, 2000)
    await scroll(100, 2000)

    expect(state()).toBe('expanded scrolled')
  })

  describe('on a screen too short to stay collapsed', () => {
    // Overflowing by the offset plus the room the bar gives back, and no
    // more, so collapsing would pull the offset back below the threshold.
    const SHORT = VIEWPORT + 100 + (LARGE - COLLAPSED_BLOCK_SIZE)

    it('leaves the bar expanded', async () => {
      await render(<Probe collapseAfter={100} />)
      await layout(LARGE)

      await scroll(SHORT - VIEWPORT, SHORT)

      expect(state()).toBe('expanded scrolled')
    })

    it('collapses a dp longer', async () => {
      await render(<Probe collapseAfter={100} />)
      await layout(LARGE)

      await scroll(SHORT + 1 - VIEWPORT, SHORT + 1)

      expect(state()).toMatch(/^collapsed /)
    })

    it('stays collapsed when collapsing pulls the offset back', async () => {
      await render(<Probe collapseAfter={100} />)
      await layout(LARGE)

      await scroll(SHORT + 1 - VIEWPORT, SHORT + 1)
      // The collapse gave the scroll view the bar's height back, so the same
      // content overflows by that much less, a dp past the threshold.
      await scroll(101, SHORT + 1 - (LARGE - COLLAPSED_BLOCK_SIZE))

      expect(state()).toMatch(/^collapsed /)
    })

    it('counts nothing given back for a bar it has not measured', async () => {
      await render(<Probe collapseAfter={100} />)

      await scroll(SHORT - VIEWPORT, SHORT)

      expect(state()).toMatch(/^collapsed /)
    })
  })

  it('drives a bar from the scroll view it is handed to', async () => {
    await render(<Screen />)

    await layout(120)
    await scroll(400, 2000)

    expect(
      textStyleOf(screen.getByRole('heading', { name: 'Headline' })).fontSize,
    ).toBe(typography.titleLargeSize)
  })
})
