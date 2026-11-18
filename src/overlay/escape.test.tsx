import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Platform } from 'react-native'

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

// Escape on the web, heard on the document while a non-modal panel is open.
// React Native's Jest environment has no document, so each case stands one
// in that dispatches a key as a browser does for one pressed on an element
// inside the document: its capture listeners first, then, unless one of
// them stopped it, its bubbling ones, which is where React Native Web's
// `Modal` hears the release it closes on.
class Page {
  readonly listeners = new Map<
    string,
    { capture: boolean; listener: Listener }[]
  >()

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

// Whether the trigger with this test id says what it opens is open.
function expanded(testID: string) {
  const state: unknown = screen.getByTestId(testID, {
    includeHiddenElements: true,
  }).props.accessibilityState

  return typeof state === 'object' && state !== null && 'expanded' in state
    ? state.expanded
    : undefined
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
