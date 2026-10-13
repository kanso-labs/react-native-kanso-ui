import { describe, expect, it } from '@jest/globals'

import { resolveTheme } from '../theme/resolve'
import { dark, light } from '../tokens/defaults'
import { demoThemes } from './themes'

const COLORS = Object.keys(light).filter((property) =>
  property.startsWith('--kui-color-'),
)

describe.each(Object.entries(demoThemes))('the %s scheme', (_, { theme }) => {
  // A colour a scheme leaves out is filled from the library's defaults in the
  // scheme around it, so the page would draw that role in its light value on
  // a light device and its dark value on a dark one.
  it('states every colour', () => {
    expect(COLORS.filter((property) => !(property in theme))).toEqual([])
  })

  // A property the defaults do not declare is ignored by the resolver, so a
  // misspelt key, or one carried over from web under a name native never
  // learned, would leave its role at the default with nothing on screen to
  // say so.
  it('sets only properties the library declares', () => {
    expect(
      Object.keys(theme).filter((property) => !(property in light)),
    ).toEqual([])
  })

  // A value native cannot evaluate keeps its property at the default, which
  // is a scheme drawn partly in the library's own tokens.
  it.each([
    ['light', light],
    ['dark', dark],
  ])('resolves over the %s defaults with no problems', (_scheme, defaults) => {
    expect(resolveTheme(defaults, theme).problems).toEqual([])
  })
})
