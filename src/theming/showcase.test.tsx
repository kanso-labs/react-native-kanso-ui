import { describe, expect, it } from '@jest/globals'
import { render, screen, within } from '@testing-library/react-native'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

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

describe('the showcase', () => {
  // What this catches is omission, not hollowness: a section with a title and
  // nothing in it satisfies it.
  it('gives every component a section', async () => {
    await render(<Showcase name="editorial" />)

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

  it('names the scheme it is drawn under', async () => {
    await render(<Showcase name="dark" />)

    expect(screen.getAllByRole('heading')[0]).toHaveTextContent('Dark')
  })
})
