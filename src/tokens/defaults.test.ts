import { describe, expect, it } from '@jest/globals'
import { readFileSync } from 'node:fs'

import { resolveTheme } from '../theme/resolve'
import { breakpoints, dark, light } from './defaults'

// The declarations in one block of kanso-ui-core's tokens.css. Its formatter breaks
// a long value over lines, so whitespace is folded back to what the value
// says.
function declarations(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/(--kui-[\w-]+):([^;]+);/gu)].map(([, name, value]) => [
      name,
      value
        .replaceAll(/\s+/gu, ' ')
        .replaceAll('( ', '(')
        .replaceAll(' )', ')')
        .trim(),
    ]),
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const css = readFileSync(
  require.resolve('@kanso-labs/kanso-ui-core/tokens.css'),
  'utf8',
).replaceAll(/\/\*[\s\S]*?\*\//gu, '')
const [rootBlock = '', darkBlock = ''] = css.split(
  '@media (prefers-color-scheme: dark)',
)
const root = declarations(rootBlock)
const darkColors = declarations(darkBlock)

describe('the token defaults', () => {
  it('declare every property tokens.css does, at its light value', () => {
    expect(Object.keys(root).length).toBeGreaterThan(0)
    expect(light).toEqual(root)
  })

  it('take the dark colours tokens.css declares under a dark scheme', () => {
    expect(Object.keys(darkColors).length).toBeGreaterThan(0)
    expect(dark).toEqual({ ...root, ...darkColors })
  })

  it('hold values the theme resolver reads without a problem', () => {
    expect(resolveTheme(light).problems).toEqual([])
    expect(resolveTheme(dark).problems).toEqual([])
  })

  it('carry the breakpoints in dp, as tokens.json gives them', () => {
    const source: unknown = JSON.parse(
      readFileSync(
        require.resolve('@kanso-labs/kanso-ui-core/tokens.json'),
        'utf8',
      ),
    )
    const layout = isRecord(source) ? source.layout : undefined
    const group = isRecord(layout) ? layout.breakpoint : undefined
    const expected = Object.fromEntries(
      Object.entries(isRecord(group) ? group : {}).flatMap(([key, token]) =>
        isRecord(token) && typeof token.$value === 'string'
          ? [[key, Number.parseFloat(token.$value)]]
          : [],
      ),
    )

    expect(Object.keys(expected).length).toBeGreaterThan(0)
    expect(breakpoints).toEqual(expected)
  })
})
