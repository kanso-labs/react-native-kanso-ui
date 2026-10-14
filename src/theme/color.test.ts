import { describe, expect, it } from '@jest/globals'

import { withOpacity } from './color'

describe('withOpacity', () => {
  it('writes a hex colour back as rgba at the opacity', () => {
    expect(withOpacity('#1d1b20', 0.12)).toBe('rgba(29, 27, 32, 0.12)')
  })

  it('reads a colour function and a name', () => {
    expect(withOpacity('rgb(103, 80, 164)', 0.38)).toBe(
      'rgba(103, 80, 164, 0.38)',
    )
    expect(withOpacity('white', 0.5)).toBe('rgba(255, 255, 255, 0.5)')
  })

  it("scales a colour's own alpha", () => {
    expect(withOpacity('rgba(0, 0, 0, 0.4)', 0.5)).toBe('rgba(0, 0, 0, 0.2)')
  })

  it('hands back a colour it cannot read', () => {
    expect(withOpacity('color-mix(in srgb, red, blue)', 0.5)).toBe(
      'color-mix(in srgb, red, blue)',
    )
  })
})
