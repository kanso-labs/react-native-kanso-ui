import type {
  HostInstance,
  MeasureInWindowOnSuccessCallback,
  ViewProps,
} from 'react-native'
import type { TestInstance } from 'test-renderer'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import {
  AccessibilityInfo,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { PickerPopup } from '.'
import { ThemeScope } from '../theme-scope'

// What the date pickers' tests leave out: a surface holding something other
// than a calendar, as a colour picker's does, which no cell names a date in.

type Frame = readonly [x: number, y: number, width: number, height: number]

// What React Native's Jest preset draws a View as: a class component holding
// its props, with the native methods on its prototype.
type MockedView = Pick<HostInstance, 'measureInWindow'> & {
  readonly props: ViewProps
}

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

// A phone held upright, below the medium bound, and a tablet, above it.
const COMPACT = 412
const MEDIUM = 800

// Where `measureInWindow` reports the box and the overlay layer, the two
// views a docked surface is placed by.
const BOX: Frame = [20, 100, 320, 56]
const LAYER: Frame = [0, 0, MEDIUM, MEDIUM]

// The nearest view at or above `from` taking `prop`.
function ancestorWith(from: TestInstance, prop: string) {
  let node: null | TestInstance = from

  while (node !== null && !(prop in node.props)) {
    node = node.parent
  }
  if (node === null) {
    throw new TypeError(`expected a view taking ${prop}`)
  }
  return node
}

// Whom focus was sent to, in turn, by role and name.
function focusSentTo() {
  // oxlint-disable-next-line typescript/unbound-method -- the preset's mock, which reads no `this`
  const { sendAccessibilityEvent } = AccessibilityInfo

  return jest.mocked(sendAccessibilityEvent).mock.calls.map(([view, event]) => {
    const props: Record<string, unknown> = isMockedView(view)
      ? { ...view.props }
      : {}

    return `${event} ${String(props.role)} ${String(props['aria-label'])}`
  })
}

function isMockedView(value: unknown): value is MockedView {
  return (
    typeof value === 'object' && value !== null && 'measureInWindow' in value
  )
}

// Renders an open surface holding a line of text, under a box it is docked
// to.
async function renderPopup() {
  const anchor = createRef<HostInstance>()

  return render(
    <ThemeScope>
      <View ref={anchor} />
      <PickerPopup
        anchor={anchor}
        close={jest.fn()}
        isOpen
        label="Label"
        trigger={null}
      >
        <Text>Body</Text>
      </PickerPopup>
    </ThemeScope>,
  )
}

function resize(width: number) {
  const metrics = { fontScale: 1, height: MEDIUM, scale: 1, width }

  Dimensions.set({ screen: metrics, window: metrics })
}

// The surface, which closes on VoiceOver's escape gesture.
function surface() {
  return ancestorWith(screen.getByText('Body'), 'onAccessibilityEscape')
}

beforeEach(() => {
  const prototype: unknown = View.prototype

  if (!isMockedView(prototype)) {
    throw new TypeError('expected the View the Jest preset mocks')
  }

  jest.spyOn(prototype, 'measureInWindow').mockImplementation(function measure(
    this: MockedView,
    callback: MeasureInWindowOnSuccessCallback,
  ) {
    callback(
      ...(StyleSheet.flatten([this.props.style])?.position === 'absolute'
        ? LAYER
        : BOX),
    )
  })
})

afterEach(() => {
  Dimensions.set(INITIAL)
  jest.clearAllMocks()
  jest.restoreAllMocks()
})

describe('PickerPopup', () => {
  it('sends a screen reader to a docked surface holding no calendar once placed', async () => {
    resize(MEDIUM)
    await renderPopup()
    await fireEvent(surface(), 'layout', {
      nativeEvent: { layout: { height: 200, width: 360, x: 0, y: 0 } },
    })

    expect(focusSentTo()).toEqual(['focus dialog Label'])
  })

  it('leaves focus to React Native Web, which has no screen reader to send', async () => {
    jest.replaceProperty(Platform, 'OS', 'web')
    resize(MEDIUM)
    await renderPopup()
    await fireEvent(surface(), 'layout', {
      nativeEvent: { layout: { height: 200, width: 360, x: 0, y: 0 } },
    })

    expect(focusSentTo()).toEqual([])
  })

  it('sends a screen reader to a modal surface holding no calendar once it shows', async () => {
    resize(COMPACT)
    await renderPopup()
    await fireEvent(ancestorWith(surface(), 'onRequestClose'), 'show')

    expect(focusSentTo()).toEqual(['focus dialog Label'])
  })
})
