import type { Meta, StoryFn } from '@storybook/react'

import { describe, expect, it, jest } from '@jest/globals'
import { composeStories } from '@storybook/react'
import { render, screen } from '@testing-library/react-native'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { StyleSheet } from 'react-native'

import preview from '../.storybook/preview'
import { dark, light } from './tokens/defaults'

type StoryModule = Record<string, StoryFn> & { default: Meta }

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
      // toolbar's scheme, which is what puts the story on that scheme's
      // surface.
      const canvas = screen.toJSON()

      expect(canvas).not.toBeNull()
      expect(
        StyleSheet.flatten(
          canvas !== null && !Array.isArray(canvas)
            ? canvas.props.style
            : undefined,
        ),
      ).toMatchObject({
        backgroundColor: SCHEMES[theme]['--kui-color-surface'],
      })
    })
  })
})
