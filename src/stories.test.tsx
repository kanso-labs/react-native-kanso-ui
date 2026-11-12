import type { Meta, StoryFn } from '@storybook/react'
import type { TestInstance } from 'test-renderer'

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { composeStories } from '@storybook/react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { Linking, StyleSheet } from 'react-native'

import type { DemoTheme } from './theming/themes'

import preview from '../.storybook/preview'
import { demoThemes } from './theming/themes'
import { dark, light } from './tokens/defaults'

type StoryModule = Record<string, StoryFn> & { default: Meta }

const DEMO_THEMES: Readonly<Partial<Record<string, DemoTheme>>> = demoThemes
const SCHEMES = { dark, light }

// Every story file under src, found on disk rather than listed, so a new one
// is rendered here the moment it exists. Both Storybooks glob the same files.
const files = readdirSync(__dirname, { recursive: true })
  .map(String)
  .filter((file) => file.endsWith('.stories.tsx'))
  .toSorted()

function storiesIn(file: string, theme: keyof typeof SCHEMES) {
  const module = jest.requireActual<StoryModule>(path.join(__dirname, file))

  return Object.entries(
    composeStories(module, { ...preview, initialGlobals: { theme } }),
  )
}

// The surface the canvas paints for a `theme` global: a demo scheme's own, or
// the library's in the scheme it names.
function surfaceOf(theme: unknown): string | undefined {
  const demo = typeof theme === 'string' ? DEMO_THEMES[theme] : undefined

  return (
    demo?.theme['--kui-color-surface'] ??
    SCHEMES[theme === 'dark' ? 'dark' : 'light']['--kui-color-surface']
  )
}

// Each story through Storybook's portable stories, in both schemes the
// toolbar offers: the preview's decorators and the story's args, as the
// Storybooks render it, but drawn by React Native's own host components
// rather than React Native Web's. A story that throws while rendering fails
// here, in `npm test`. Nothing here runs a play function: one reads a DOM, and
// Metro bundles the same story files for the device, which has none.
describe.each(files)('%s', (file) => {
  describe.each(['light', 'dark'] as const)('in %s', (theme) => {
    it.each(storiesIn(file, theme))('renders %s', async (_, Story) => {
      await render(<Story />)

      // The outermost view is the preview's canvas, a scope pinned to the
      // toolbar's theme, which is what puts the story on that theme's
      // surface. A story pinning a theme of its own through `globals`, as
      // the Theming pages do, is drawn in that one whatever the toolbar says.
      const canvas = screen.toJSON()

      expect(canvas).not.toBeNull()
      expect(
        StyleSheet.flatten(
          canvas !== null && !Array.isArray(canvas)
            ? canvas.props.style
            : undefined,
        ),
      ).toMatchObject({
        backgroundColor: surfaceOf(Story.globals.theme),
      })
    })
  })
})

// The stories whose destinations carry a page's address, which a device has
// nothing to open with. Each stands in for an app's router, so a press stays
// inside the story rather than reaching the platform, which warned "Could
// not open /third" and changed nothing.
const ROUTED = [
  'components/breadcrumbs/index.stories.tsx',
  'components/link/index.stories.tsx',
  'components/navigation-bar/index.stories.tsx',
  'components/navigation-rail/index.stories.tsx',
  'components/navigation-tree/index.stories.tsx',
].map((file) => path.normalize(file))

// Presses each of `targets` in turn, each an act of its own.
async function pressEach(targets: readonly TestInstance[]) {
  const first = targets.at(0)
  if (first !== undefined) {
    await fireEvent.press(first)
    await pressEach(targets.slice(1))
  }
}

describe.each(ROUTED)('%s', (file) => {
  // React Native mocks `Linking` already, so the spy is that mock, whose
  // calls a restore keeps.
  afterEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  it.each(storiesIn(file, 'light'))(
    'keeps a press on each destination of %s inside the story',
    async (_, Story) => {
      const open = jest.spyOn(Linking, 'openURL')
      await render(<Story />)

      const destinations = [
        ...screen.queryAllByRole('link'),
        ...screen.queryAllByRole('tab'),
      ]
      await pressEach(destinations)

      expect(destinations.length).toBeGreaterThan(0)
      expect(open).not.toHaveBeenCalled()
    },
  )
})
