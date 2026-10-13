import { describe, expect, it, jest } from '@jest/globals'

import type { ResolvedTheme } from './scope'

import { scopeFor } from './scope'
import { themedStyles } from './styles'

describe('themedStyles', () => {
  it('builds a theme’s stylesheet once and hands back the same one', () => {
    const create = jest.fn((theme: ResolvedTheme) => ({
      surface: theme.colors.surface,
    }))
    const stylesOf = themedStyles(create)
    const light = scopeFor('light', {}).theme
    const dark = scopeFor('dark', {}).theme

    const first = stylesOf(light)

    expect(stylesOf(light)).toBe(first)
    expect(stylesOf(dark)).not.toBe(first)
    expect(create.mock.calls.map(([theme]) => theme)).toEqual([light, dark])
  })
})
