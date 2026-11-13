import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { act, render, screen, within } from '@testing-library/react-native'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { Platform } from 'react-native'

import type { DemoThemeName } from './themes'

import { ThemeScope } from '../theme-scope'
import Showcase from './showcase'

// The showcase is the only page that draws the whole library under a scheme
// that is not the library's own, which makes it the only place a literal
// colour, corner or spacing step shows up at all: everywhere else a literal
// and the token it should have been draw identically. A component missing
// from it is therefore never checked under a theme, and without this the page
// still renders and every scheme's story still passes.
//
// The expected set comes from the directories under src/components, each
// named as the component it holds, as on web.
const COMPONENTS = path.join(__dirname, '../components')
const EXPECTED = readdirSync(COMPONENTS, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      existsSync(path.join(COMPONENTS, entry.name, 'index.tsx')),
  )
  .map((entry) =>
    entry.name
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(''),
  )

// The pause a device takes after one section's content mounts before the
// next, which the page's own constant sets.
const PAUSE = 250

const OS = Platform.OS

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
  Platform.OS = OS
})

// Runs the clock on by `milliseconds`, and the commits that follow.
async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// How many sections draw anything under their headline: a section's rule,
// its headline and description, then what it shows.
function filled() {
  return screen
    .getAllByTestId('showcase-section')
    .filter((section) => section.children.length > 2).length
}

// Runs a pause at a time until the page mounts no more, each pause an act of
// its own, since the next is set only once the section before has committed.
async function mountAll(): Promise<void> {
  const before = filled()
  await advance(PAUSE)
  if (filled() > before) {
    await mountAll()
  }
}

// The page inside a ThemeScope, as the Storybook canvas draws it, whose
// overlay host is where the page's snackbar draws.
async function renderPage(name: 'dark' | DemoThemeName) {
  return render(
    <ThemeScope>
      <Showcase name={name} />
    </ThemeScope>,
  )
}

describe('the showcase', () => {
  // What this catches is omission, not hollowness: a section with a title and
  // nothing in it satisfies it.
  it('gives every component a section', async () => {
    await renderPage('editorial')

    // The heading a section opens with, rather than every heading on the
    // page: the page's own scheme label is one too, and a component drawn
    // inside a section may carry one of its own.
    const titles = screen
      .getAllByTestId('showcase-section')
      .map((section) => within(section).getAllByRole('heading').at(0))
      .map((heading) => heading?.props.children as unknown)

    // Named differences rather than whole lists, so a failure says which
    // component went missing. The count after it is what catches a section
    // that is duplicated rather than absent.
    const missing = EXPECTED.filter((name) => !titles.includes(name))
    const unexpected = titles.filter(
      (title) => typeof title !== 'string' || !EXPECTED.includes(title),
    )

    expect({ missing, unexpected }).toEqual({ missing: [], unexpected: [] })
    expect(titles).toHaveLength(EXPECTED.length)
  })

  // It mounts the page a section at a time, which a busy machine running the
  // whole suite takes longer than Jest's five seconds over.
  it('mounts the sections a few at a time on a device, a pause after each, and every one in the end', async () => {
    await renderPage('editorial')

    // Every headline at once, and the content of the first three, the first
    // of which is AppBar's and draws none.
    expect(screen.getAllByTestId('showcase-section')).toHaveLength(
      EXPECTED.length,
    )
    expect(filled()).toBe(2)

    // Nothing more until the pause has run, so the device has frames free
    // to answer a scroll between two sections.
    await advance(PAUSE - 1)

    expect(filled()).toBe(2)

    await advance(1)

    expect(filled()).toBe(3)

    // AppBar's section draws nothing under its headline, since the bar it
    // describes is the page's own.
    await mountAll()

    expect(filled()).toBe(EXPECTED.length - 1)
  }, 30_000)

  it('mounts the whole page at once on the web', async () => {
    Platform.OS = 'web'
    await renderPage('editorial')

    expect(filled()).toBe(EXPECTED.length - 1)
  })

  it('names the scheme it is drawn under', async () => {
    await renderPage('dark')

    // The app bar's headline comes first, as it does at the top of a screen,
    // so the scheme's name is the heading after it.
    expect(screen.getAllByRole('heading')[1]).toHaveTextContent('Dark')
  })
})
