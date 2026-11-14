import type { Meta, StoryFn } from '@storybook/react'
import type { TestInstance } from 'test-renderer'

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { composeStories } from '@storybook/react'
import { render, screen } from '@testing-library/react-native'
import path from 'node:path'
import { Platform } from 'react-native'

import { toggleState } from '.'
import preview from '../../.storybook/preview'

type StoryModule = Record<string, StoryFn> & { default: Meta }

// The stories the review read every toggle in as a plain button on Android,
// by the component and the story.
const TOGGLES: readonly (readonly [string, string])[] = [
  ['chip', 'Default'],
  ['icon-button', 'Toggle'],
  ['segmented-button', 'MultipleSelection'],
]

function storyOf(component: string, name: string) {
  const module = jest.requireActual<StoryModule>(
    path.join(__dirname, '..', 'components', component, 'index.stories.tsx'),
  )
  const Story = Object.entries(composeStories(module, preview)).find(
    ([key]) => key === name,
  )?.[1]

  if (Story === undefined) {
    throw new TypeError(`expected the ${component} story ${name}`)
  }
  return Story
}

function toggles(): TestInstance[] {
  return (
    screen.root?.queryAll(
      (node) =>
        typeof node.type === 'string' &&
        node.props.accessibilityRole === 'togglebutton',
    ) ?? []
  )
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('toggleState', () => {
  it('is a checkable toggle button on Android, checked only while selected', () => {
    jest.replaceProperty(Platform, 'OS', 'android')

    expect(toggleState(false)).toEqual({
      accessibilityRole: 'togglebutton',
      'aria-checked': false,
      role: undefined,
    })
    expect(toggleState(true)).toMatchObject({ 'aria-checked': true })
  })

  it('reports the selected state on iOS, which VoiceOver reads', () => {
    jest.replaceProperty(Platform, 'OS', 'ios')

    expect(toggleState(true)).toEqual({ 'aria-selected': true })
  })

  it('reports the pressed state on the web, as web’s toggle does', () => {
    jest.replaceProperty(Platform, 'OS', 'web')

    expect(toggleState(false)).toEqual({ 'aria-pressed': false })
  })

  it.each(TOGGLES)(
    'makes every toggle in %s’s %s story a toggle button on Android',
    async (component, name) => {
      jest.replaceProperty(Platform, 'OS', 'android')
      const Story = storyOf(component, name)
      await render(<Story />)

      const found = toggles()

      expect(found.length).toBeGreaterThan(0)
      for (const toggle of found) {
        expect(toggle.props.role).toBeUndefined()
        // The host view carries `aria-checked` in its accessibility state.
        const state: unknown = toggle.props.accessibilityState
        expect(state).toMatchObject({ checked: expect.any(Boolean) })
      }
    },
  )
})
