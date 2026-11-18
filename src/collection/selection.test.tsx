import type { ProfilerOnRenderCallback, ReactElement } from 'react'
import type { PressableProps } from 'react-native'

import { beforeEach, describe, expect, it } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Profiler } from 'react'

import { List } from '../components/list'
import { ListBox } from '../components/list-box'
import { Tree } from '../components/tree'

// What a selection re-renders, row by row. Each row is drawn through its
// `render` inside a `Profiler` of its own, which reports every commit that
// rendered anything in the row: a row React bailed out of reports nothing.
// The React Compiler runs over the library here as it does in a build, so
// what is counted is the memoisation a consumer gets.
const renders = new Map<string, number>()

// A press with no point on the page, on a row that measures nothing, so the
// ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// Fifty rows, more than a `FlatList` draws at first, so the rows counted are
// the ones it has drawn.
const NAMES = Array.from({ length: 50 }, (_, index) => `Item ${index + 1}`)

const count: ProfilerOnRenderCallback = (id, phase) => {
  if (phase !== 'mount') {
    renders.set(id, (renders.get(id) ?? 0) + 1)
  }
}

// A row's `render`, drawing it inside its own `Profiler`.
function profiled(name: string) {
  return (row: ReactElement<PressableProps>) => (
    <Profiler id={name} onRender={count}>
      {row}
    </Profiler>
  )
}

function rowOf(name: string) {
  return screen.getByRole('button', { name })
}

// The rows a commit since the last `reset` rendered, and how often.
function rowRenders() {
  return Object.fromEntries(renders)
}

beforeEach(() => {
  renders.clear()
})

describe('a selection', () => {
  it('re-renders only the List rows whose selection changed', async () => {
    await render(
      <List aria-label="Label" selectionMode="multiple">
        {NAMES.map((name) => (
          <List.Item id={name} key={name} render={profiled(name)}>
            {name}
          </List.Item>
        ))}
      </List>,
    )
    renders.clear()

    await fireEvent.press(rowOf('Item 2'), PRESS)

    expect(
      screen.getByRole('button', { name: 'Item 2', selected: true }),
    ).toBeOnTheScreen()
    // Before, every row the list had drawn rendered again: ten here.
    expect(rowRenders()).toEqual({ 'Item 2': 1 })

    renders.clear()
    await fireEvent.press(rowOf('Item 5'), PRESS)
    await fireEvent.press(rowOf('Item 2'), PRESS)

    expect(rowRenders()).toEqual({ 'Item 2': 1, 'Item 5': 1 })
  })

  it('re-renders only the ListBox options whose selection changed', async () => {
    await render(
      <ListBox aria-label="Label" selectionMode="single">
        {NAMES.map((name) => (
          <ListBox.Item id={name} key={name} render={profiled(name)}>
            {name}
          </ListBox.Item>
        ))}
      </ListBox>,
    )
    await fireEvent.press(rowOf('Item 2'), PRESS)
    renders.clear()

    await fireEvent.press(rowOf('Item 3'), PRESS)

    // The option chosen and the one it took over from.
    expect(rowRenders()).toEqual({ 'Item 2': 1, 'Item 3': 1 })
  })

  it('re-renders only the Tree rows whose selection changed', async () => {
    await render(
      <Tree aria-label="Label" selectionMode="multiple">
        {NAMES.map((name) => (
          <Tree.Item
            headline={name}
            id={name}
            key={name}
            render={profiled(name)}
          />
        ))}
      </Tree>,
    )
    renders.clear()

    await fireEvent.press(rowOf('Item 2'), PRESS)

    expect(rowRenders()).toEqual({ 'Item 2': 1 })
  })

  it('re-renders every row whose press it changes', async () => {
    await render(
      <List aria-label="Label" onAction={noop} selectionMode="multiple">
        {NAMES.slice(0, 3).map((name) => (
          <List.Item id={name} key={name} render={profiled(name)}>
            {name}
          </List.Item>
        ))}
      </List>,
    )
    renders.clear()

    // A press on a row that acts runs the action while nothing is selected
    // and selects once something is, so the first selection changes what a
    // press does on every row.
    await fireEvent(rowOf('Item 2'), 'longPress', PRESS)

    expect(rowRenders()).toEqual({ 'Item 1': 1, 'Item 2': 1, 'Item 3': 1 })
  })
})

function noop() {
  // An action that does nothing, for a list whose rows act.
}
