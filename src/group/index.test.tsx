import type { Meta, StoryFn } from '@storybook/react'
import type { TestInstance } from 'test-renderer'

import { describe, expect, it, jest } from '@jest/globals'
import { composeStories } from '@storybook/react'
import { render, screen } from '@testing-library/react-native'
import path from 'node:path'

import preview from '../../.storybook/preview'

type StoryModule = Record<string, StoryFn> & { default: Meta }

// Each container that carries a role or a name and draws nothing of its own,
// by the story that draws it and the role it carries. Fabric flattened every
// one of them away on Android, its name with it.
const VIEWS: readonly (readonly [string, string, string])[] = [
  ['breadcrumbs', 'Default', 'group'],
  ['button-group', 'Connected', 'radiogroup'],
  ['button-group', 'Default', 'group'],
  ['calendar', 'Default', 'group'],
  ['checkbox-group', 'Default', 'group'],
  ['chip-group', 'Default', 'group'],
  ['color-swatch-picker', 'Default', 'radiogroup'],
  ['date-field', 'Default', 'group'],
  ['navigation-bar', 'Default', 'tablist'],
  ['radio-group', 'Default', 'radiogroup'],
  ['range-calendar', 'Default', 'group'],
  ['segmented-button', 'Default', 'radiogroup'],
  ['split-button', 'Default', 'group'],
  ['tabs', 'Default', 'tablist'],
  ['toolbar', 'Default', 'toolbar'],
]

// The containers that are scroll views, which keep a view of their own but
// hand Android no `aria-label`, by the name each is given.
const SCROLLS: readonly (readonly [string, string, string])[] = [
  ['list-box', 'Default', 'Label'],
  ['navigation-rail', 'Default', 'Label'],
]

function hostsWith(predicate: (node: TestInstance) => boolean) {
  return (
    screen.root?.queryAll(
      (node) => typeof node.type === 'string' && predicate(node),
    ) ?? []
  )
}

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

describe('a named group', () => {
  it.each(VIEWS)(
    'keeps %s’s view in its %s story on Android',
    async (component, name, role) => {
      const Story = storyOf(component, name)
      await render(<Story />)

      const groups = hostsWith((node) => node.props.role === role)

      expect(groups.length).toBeGreaterThan(0)
      for (const group of groups) {
        expect(group.props.collapsable).toBe(false)
      }
    },
  )

  it.each(SCROLLS)(
    'names %s’s scroll view in its %s story on Android',
    async (component, name, label) => {
      const Story = storyOf(component, name)
      await render(<Story />)

      expect(
        hostsWith(
          (node) =>
            node.type === 'RCTScrollView' &&
            node.props.accessibilityLabel === label,
        ),
      ).toHaveLength(1)
    },
  )
})
