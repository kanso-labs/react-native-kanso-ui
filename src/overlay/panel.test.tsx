import type { HostInstance, ViewProps } from 'react-native'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Platform, View } from 'react-native'

import { Button } from '../components/button'
import { ListBox } from '../components/list-box'
import { Popover } from '../components/popover'
import { Select } from '../components/select'
import { ThemeScope } from '../theme-scope'

// What a page's key listener is handed.
type Key = {
  defaultPrevented: boolean
  readonly key: string
  readonly preventDefault: () => void
  readonly stopImmediatePropagation: () => void
  stopped: boolean
}

type Listener = (event: Key) => void

// What React Native's Jest preset draws a View as: a class component holding
// its props, with the native methods on its prototype.
type MockedView = Pick<HostInstance, 'focus' | 'measureInWindow'> & {
  readonly props: ViewProps
}

// Escape on the web, heard on the document while a non-modal panel is open.
// React Native's Jest environment has no document, so each case stands one
// in that dispatches a key as a browser does for one pressed on an element
// inside the document: its capture listeners first, then, unless one of
// them stopped it, its bubbling ones, which is where React Native Web's
// `Modal` hears the release it closes on. Its focus is on its body, where a
// browser drops the focus a panel held as the panel goes, unless a case
// puts it elsewhere.
class Page {
  activeElement: unknown
  readonly body = {}
  readonly listeners = new Map<
    string,
    { capture: boolean; listener: Listener }[]
  >()

  constructor() {
    this.activeElement = this.body
  }

  addEventListener(type: string, listener: Listener, capture = false) {
    this.listeners.set(type, [
      ...(this.listeners.get(type) ?? []),
      { capture, listener },
    ])
  }

  dispatch(type: string, key: string) {
    const event: Key = {
      defaultPrevented: false,
      key,
      preventDefault: () => {
        event.defaultPrevented = true
      },
      stopImmediatePropagation: () => {
        event.stopped = true
      },
      stopped: false,
    }
    const all = this.listeners.get(type) ?? []

    for (const capture of [true, false]) {
      for (const entry of all.filter((each) => each.capture === capture)) {
        if (event.stopped) {
          return event
        }
        entry.listener(event)
      }
    }
    return event
  }

  removeEventListener(type: string, listener: Listener, capture = false) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter(
        (each) => each.listener !== listener || each.capture !== capture,
      ),
    )
  }
}

let page: Page

const OPTIONS = [
  <ListBox.Item id="first" key="first">
    First item
  </ListBox.Item>,
  <ListBox.Item id="second" key="second">
    Second item
  </ListBox.Item>,
]

// Runs the panel's exit, after which it has gone.
async function exited() {
  await act(() => {
    jest.advanceTimersByTime(1000)
  })
}

// Whether the trigger with this test id says what it opens is open.
function expanded(testID: string) {
  const state: unknown = screen.getByTestId(testID, {
    includeHiddenElements: true,
  }).props.accessibilityState

  return typeof state === 'object' && state !== null && 'expanded' in state
    ? state.expanded
    : undefined
}

function isMockedView(value: unknown): value is MockedView {
  return typeof value === 'object' && value !== null && 'focus' in value
}

// The surface the list is drawn on: the nearest view around it that closes
// on VoiceOver's escape gesture.
function panelOfList() {
  let node = screen.getByLabelText('Label').parent

  while (node !== null && !('onAccessibilityEscape' in node.props)) {
    node = node.parent
  }
  if (node === null) {
    throw new TypeError('expected the surface around the list')
  }
  return node
}

// Places the list under the box, which takes presses once it is: the box
// and the overlay layer report where they are, and the list its size.
async function placed() {
  const prototype: unknown = View.prototype

  if (!isMockedView(prototype)) {
    throw new TypeError('expected the View the Jest preset mocks')
  }
  jest.spyOn(prototype, 'measureInWindow').mockImplementation(function measure(
    this: MockedView,
    callback,
  ) {
    if (this.props.testID === 'box') {
      callback(20, 100, 320, 56)
    } else {
      callback(0, 0, 400, 800)
    }
  })
  await fireEvent(panelOfList(), 'layout', {
    nativeEvent: { layout: { height: 168, width: 320, x: 0, y: 0 } },
  })
}

// Presses a key on the page, down and then up, as a keyboard does, with a
// listener for the release where a `Modal` listens for it. Returns whether
// the press was cancelled and whether the release reached that listener.
async function press(key: string) {
  const released = jest.fn()
  let down: Key | undefined

  page.addEventListener('keyup', released)
  await act(() => {
    down = page.dispatch('keydown', key)
    page.dispatch('keyup', key)
  })
  page.removeEventListener('keyup', released)

  return {
    cancelled: down?.defaultPrevented === true,
    released: released.mock.calls.length > 0,
  }
}

// Renders an open Select, and watches which views are focused. The preset's
// View shares one mock `focus` between instances, so a call's `this` says
// which was focused.
async function renderOpenSelect() {
  const prototype: unknown = View.prototype

  if (!isMockedView(prototype)) {
    throw new TypeError('expected the View the Jest preset mocks')
  }
  const focus = jest.spyOn(prototype, 'focus')
  focus.mockClear()

  await render(
    <ThemeScope>
      <Select defaultOpen label="Label" options={OPTIONS} testID="box" />
    </ThemeScope>,
  )
  return () =>
    focus.mock.contexts.map((view) =>
      isMockedView(view) ? view.props.testID : undefined,
    )
}

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web')
  page = new Page()
  Object.assign(globalThis, { document: page })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'document')
})

describe('Escape on the web', () => {
  it('closes an open Select', async () => {
    await render(
      <ThemeScope>
        <Select defaultOpen label="Label" options={OPTIONS} testID="box" />
      </ThemeScope>,
    )
    expect(expanded('box')).toBe(true)

    const { cancelled, released } = await press('Escape')

    expect(expanded('box')).toBe(false)
    expect(cancelled).toBe(true)
    // A dialog the panel sits in, which closes on the release, stays open.
    expect(released).toBe(false)
  })

  it('closes an open Popover', async () => {
    await render(
      <ThemeScope>
        <Popover defaultOpen>
          <Button testID="trigger">Open</Button>
          <Popover.Content>
            <Popover.Title>Headline</Popover.Title>
          </Popover.Content>
        </Popover>
      </ThemeScope>,
    )
    expect(expanded('trigger')).toBe(true)

    await press('Escape')

    expect(expanded('trigger')).toBe(false)
  })

  it('closes the panel opened last, and the one under it on the next Escape', async () => {
    await render(
      <ThemeScope>
        <Popover defaultOpen>
          <Button testID="outer">Open</Button>
          <Popover.Content>
            <Popover defaultOpen>
              <Button testID="inner">Open</Button>
              <Popover.Content>
                <Popover.Title>Headline</Popover.Title>
              </Popover.Content>
            </Popover>
          </Popover.Content>
        </Popover>
      </ThemeScope>,
    )

    await press('Escape')

    expect(expanded('outer')).toBe(true)
    expect(screen.queryByTestId('inner')).not.toBeNull()
    expect(expanded('inner')).toBe(false)

    await press('Escape')

    expect(expanded('outer')).toBe(false)
  })

  it('leaves the page alone for another key, and once the panel has closed', async () => {
    await render(
      <ThemeScope>
        <Select defaultOpen label="Label" options={OPTIONS} testID="box" />
      </ThemeScope>,
    )

    expect(await press('Enter')).toEqual({ cancelled: false, released: true })
    expect(expanded('box')).toBe(true)

    await press('Escape')

    expect(await press('Escape')).toEqual({ cancelled: false, released: true })
  })

  it('reopens and closes again', async () => {
    await render(
      <ThemeScope>
        <Select label="Label" options={OPTIONS} testID="box" />
      </ThemeScope>,
    )

    await fireEvent.press(screen.getByTestId('box'))
    expect(expanded('box')).toBe(true)

    await press('Escape')

    expect(expanded('box')).toBe(false)
  })
})

describe('focus on the web, once a panel has gone', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('goes back to the trigger after Escape', async () => {
    const focused = await renderOpenSelect()

    await press('Escape')
    await exited()

    expect(focused()).toEqual(['box'])
  })

  it('goes back to the trigger after a choice', async () => {
    const focused = await renderOpenSelect()
    await placed()

    await fireEvent.press(screen.getByRole('button', { name: /Second item/ }), {
      currentTarget: { measure: () => undefined },
      nativeEvent: {},
    })
    await exited()

    expect(expanded('box')).toBe(false)
    expect(focused()).toEqual(['box'])
  })

  it('goes back to the trigger after a press outside', async () => {
    const focused = await renderOpenSelect()
    const panel = panelOfList()
    const siblings = panel.parent?.children ?? []
    const layer = siblings.at(siblings.indexOf(panel) - 1)

    if (layer === undefined || typeof layer === 'string') {
      throw new TypeError('expected the layer before the list')
    }
    await fireEvent.press(layer)
    await exited()

    expect(expanded('box')).toBe(false)
    expect(focused()).toEqual(['box'])
  })

  it('stays where it is when the panel never had it', async () => {
    const focused = await renderOpenSelect()
    // On the box itself, or anywhere else on the page.
    page.activeElement = {}

    await press('Escape')
    await exited()

    expect(focused()).toEqual([])
  })
})
