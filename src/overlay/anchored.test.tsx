import type { ComponentRef, RefObject } from 'react'
import type {
  HostInstance,
  MeasureInWindowOnSuccessCallback,
  StyleProp,
  ViewProps,
  ViewStyle,
} from 'react-native'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { useRef } from 'react'
import { Dimensions, I18nManager, StyleSheet, View } from 'react-native'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

import type { AnchoredPlacementOptions } from './anchored'

import { ThemeScope } from '../theme-scope'
import { useAnchoredPlacement } from './anchored'
import { Overlay } from './host'

type Frame = readonly [x: number, y: number, width: number, height: number]

// What React Native's Jest preset draws a View as: a class component holding
// its props, with the native methods on its prototype. React Native's types
// declare View a function, whose prototype they leave untyped.
type MockedView = Pick<HostInstance, 'measureInWindow'> & {
  readonly props: ViewProps
}

// Where `measureInWindow` reports each view: the anchor by its test id, and
// the overlay layer, the only other view measured, at the window's corner
// unless a case moves it.
const frames: { anchor: Frame; layer: Frame } = {
  anchor: [180, 300, 40, 40],
  layer: [0, 0, 400, 800],
}

// A notched phone in landscape: the notch on the left, the status bar above.
const NOTCHED = { bottom: 0, left: 44, right: 0, top: 47 }

const sides: string[] = []
const placements: boolean[] = []

type SurfaceProps = Omit<AnchoredPlacementOptions, 'anchor'> & {
  readonly anchor: RefObject<ComponentRef<typeof View> | null>
}

function Anchored(options: Omit<AnchoredPlacementOptions, 'anchor'>) {
  const anchor = useRef<ComponentRef<typeof View>>(null)

  return (
    <ThemeScope>
      <View ref={anchor} testID="anchor" />
      <Overlay>
        <Surface anchor={anchor} {...options} />
      </Overlay>
    </ThemeScope>
  )
}

function isMockedView(value: unknown): value is MockedView {
  return (
    typeof value === 'object' && value !== null && 'measureInWindow' in value
  )
}

async function laidOut(width = 120, height = 60) {
  await fireEvent(screen.getByTestId('surface'), 'layout', {
    nativeEvent: { layout: { height, width, x: 0, y: 0 } },
  })
}

function placed() {
  return styleOf(screen.getByTestId('surface'))
}

function resize(width: number, height: number) {
  const metrics = { fontScale: 1, height, scale: 1, width }

  Dimensions.set({ screen: metrics, window: metrics })
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function Surface(props: SurfaceProps) {
  const {
    onLayout,
    placed: isPlaced,
    side,
    style,
  } = useAnchoredPlacement(props)

  placements.push(isPlaced)
  sides.push(side)

  return <View onLayout={onLayout} style={style} testID="surface" />
}

beforeEach(() => {
  frames.anchor = [180, 300, 40, 40]
  frames.layer = [0, 0, 400, 800]
  placements.length = 0
  sides.length = 0
  resize(400, 800)
  const prototype: unknown = View.prototype

  if (!isMockedView(prototype)) {
    throw new TypeError('expected the View the Jest preset mocks')
  }

  jest.spyOn(prototype, 'measureInWindow').mockImplementation(function measure(
    this: MockedView,
    callback: MeasureInWindowOnSuccessCallback,
  ) {
    callback(...(this.props.testID === 'anchor' ? frames.anchor : frames.layer))
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('useAnchoredPlacement', () => {
  it('lays the surface out of sight until it is placed', async () => {
    await render(<Anchored />)

    expect(placed()).toMatchObject({ opacity: 0, pointerEvents: 'none' })
    expect(placements.at(-1)).toBe(false)
  })

  it('says when the surface has been placed', async () => {
    await render(<Anchored />)
    await laidOut()

    expect(placements.at(-1)).toBe(true)
  })

  it('places the surface below the anchor, centred, by default', async () => {
    await render(<Anchored />)
    await laidOut()

    // spacing.sm below the anchor, and spacing.md from the window's edge.
    expect(placed()).toEqual({
      left: 140,
      maxHeight: 440,
      position: 'absolute',
      top: 348,
    })
    expect(sides.at(-1)).toBe('bottom')
  })

  it('takes the side, the alignment and the offsets', async () => {
    await render(
      <Anchored align="start" alignOffset={4} side="top" sideOffset={20} />,
    )
    await laidOut()

    expect(placed()).toMatchObject({ left: 184, top: 220 })
  })

  it('names the side it opened on after a flip', async () => {
    frames.anchor = [180, 700, 40, 40]

    await render(<Anchored />)
    await laidOut()

    expect(placed()).toMatchObject({ top: 632 })
    expect(sides.at(-1)).toBe('top')
  })

  it('places the surface in the layer, wherever the layer starts', async () => {
    frames.layer = [10, 24, 390, 776]

    await render(<Anchored />)
    await laidOut()

    expect(placed()).toMatchObject({ left: 130, top: 324 })
  })

  it('stays inside the safe area', async () => {
    frames.anchor = [40, 90, 40, 40]

    await render(
      <SafeAreaInsetsContext value={NOTCHED}>
        <Anchored side="top" />
      </SafeAreaInsetsContext>,
    )
    await laidOut()

    // Flipped below, with 23 dp to spare above it, and kept clear of the
    // inset on the left.
    expect(placed()).toMatchObject({ left: 56, top: 138 })
  })

  it('places the surface again when its size changes', async () => {
    await render(<Anchored />)
    await laidOut()
    await laidOut(200)

    expect(placed()).toMatchObject({ left: 100 })
  })

  it('measures the anchor again when the window changes size', async () => {
    await render(<Anchored />)
    await laidOut()

    frames.anchor = [380, 100, 40, 40]
    await act(() => {
      resize(800, 400)
    })

    expect(placed()).toMatchObject({ left: 340, maxHeight: 240, top: 148 })
  })

  describe('in a right-to-left layout', () => {
    beforeEach(() => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
    })

    it('lines start up with the right edge of the anchor', async () => {
      jest.replaceProperty(I18nManager, 'doLeftAndRightSwapInRTL', false)

      await render(<Anchored align="start" />)
      await laidOut()

      expect(placed()).toMatchObject({ left: 100 })
    })

    it('places by right where React Native swaps left and right', async () => {
      await render(<Anchored align="start" />)
      await laidOut()

      expect(placed()).toMatchObject({ right: 100 })
      expect(placed()).not.toHaveProperty('left')
    })
  })
})
