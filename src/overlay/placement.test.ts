import { describe, expect, it } from '@jest/globals'

import type { OverlayAlign, OverlaySide, PlacementInput } from './placement'

import { boundsOf, place } from './placement'

// A 400 by 800 window with 12 to spare on every side, and a 40 dp anchor in
// the middle of it, with 160 dp of room on either side and 280 above.
const BOUNDS = boundsOf(
  { height: 800, width: 400 },
  { bottom: 0, left: 0, right: 0, top: 0 },
  12,
)
const ANCHOR = { height: 40, width: 40, x: 180, y: 300 }
const SURFACE = { height: 60, width: 120 }

function placed(input: Partial<PlacementInput>) {
  return place({
    align: 'center',
    alignOffset: 0,
    anchor: ANCHOR,
    bounds: BOUNDS,
    rtl: false,
    side: 'bottom',
    sideOffset: 8,
    surface: SURFACE,
    ...input,
  })
}

describe('boundsOf', () => {
  it('takes the insets and the padding off every side of the window', () => {
    expect(
      boundsOf(
        { height: 800, width: 400 },
        { bottom: 34, left: 44, right: 20, top: 47 },
        12,
      ),
    ).toEqual({ height: 695, width: 312, x: 56, y: 59 })
  })
})

describe('place', () => {
  it.each<[OverlaySide, OverlayAlign, number, number]>([
    ['bottom', 'start', 180, 348],
    ['bottom', 'center', 140, 348],
    ['bottom', 'end', 100, 348],
    ['top', 'start', 180, 232],
    ['top', 'center', 140, 232],
    ['top', 'end', 100, 232],
    ['left', 'start', 52, 300],
    ['left', 'center', 52, 290],
    ['left', 'end', 52, 280],
    ['right', 'start', 228, 300],
    ['right', 'center', 228, 290],
    ['right', 'end', 228, 280],
  ])('opens on %s, aligned to the %s', (side, align, x, y) => {
    expect(placed({ align, side })).toMatchObject({ side, x, y })
  })

  it.each<[OverlaySide, OverlayAlign, number]>([
    ['bottom', 'start', 100],
    ['bottom', 'end', 180],
    ['top', 'start', 100],
    ['top', 'end', 180],
  ])(
    'reads %s %s from the right in a right-to-left layout',
    (side, align, x) => {
      expect(placed({ align, rtl: true, side })).toMatchObject({ x })
    },
  )

  it.each<[OverlaySide, OverlayAlign, number]>([
    ['left', 'start', 300],
    ['left', 'end', 280],
    ['right', 'start', 300],
    ['right', 'end', 280],
  ])(
    'reads %s %s from the top in a right-to-left layout too',
    (side, align, y) => {
      expect(placed({ align, rtl: true, side })).toMatchObject({ y })
    },
  )

  it('keeps the side offset between the anchor and the surface', () => {
    expect(placed({ sideOffset: 20 })).toMatchObject({ y: 360 })
    expect(placed({ side: 'right', sideOffset: 20 })).toMatchObject({
      x: 240,
    })
  })

  it('moves the surface along the side by the align offset', () => {
    expect(placed({ align: 'start', alignOffset: 10 })).toMatchObject({
      x: 190,
    })
    expect(
      placed({ align: 'start', alignOffset: 10, side: 'left' }),
    ).toMatchObject({ y: 310 })
  })

  it('never offsets the surface off its anchor', () => {
    expect(placed({ align: 'start', alignOffset: 1000 })).toMatchObject({
      x: 220,
    })
    expect(placed({ align: 'start', alignOffset: -1000 })).toMatchObject({
      x: 60,
    })
  })

  it('flips to the opposite side when the surface does not fit', () => {
    expect(placed({ anchor: { ...ANCHOR, y: 700 } })).toMatchObject({
      side: 'top',
      y: 632,
    })
    expect(placed({ anchor: { ...ANCHOR, y: 60 }, side: 'top' })).toMatchObject(
      { side: 'bottom', y: 108 },
    )
    expect(
      placed({ anchor: { ...ANCHOR, x: 20 }, side: 'left' }),
    ).toMatchObject({ side: 'right', x: 68 })
    expect(
      placed({ anchor: { ...ANCHOR, x: 340 }, side: 'right' }),
    ).toMatchObject({ side: 'left', x: 212 })
  })

  it('stays when the opposite side has less room', () => {
    // 440 below the anchor and 280 above, against a surface of 700.
    expect(placed({ surface: { height: 700, width: 120 } })).toMatchObject({
      maxHeight: 440,
      side: 'bottom',
      y: 348,
    })
  })

  it('gives the surface the room on its side as its height', () => {
    expect(placed({})).toMatchObject({ maxHeight: 440 })
    expect(placed({ side: 'top' })).toMatchObject({ maxHeight: 280 })
    expect(placed({ side: 'left' })).toMatchObject({ maxHeight: 776 })
  })

  it('opens a surface taller than the room above it from the top bound', () => {
    // 480 above the anchor and 240 below, against a surface of 600.
    expect(
      placed({
        anchor: { ...ANCHOR, y: 500 },
        side: 'top',
        surface: { height: 600, width: 120 },
      }),
    ).toMatchObject({ maxHeight: 480, side: 'top', y: 12 })
  })

  it('shifts the surface along the side to stay inside the bounds', () => {
    expect(placed({ anchor: { ...ANCHOR, x: 12 } })).toMatchObject({ x: 12 })
    expect(placed({ anchor: { ...ANCHOR, x: 348 } })).toMatchObject({
      x: 268,
    })
    expect(
      placed({ anchor: { ...ANCHOR, y: 12 }, side: 'left' }),
    ).toMatchObject({ y: 12 })
    expect(
      placed({ anchor: { ...ANCHOR, y: 748 }, side: 'left' }),
    ).toMatchObject({ y: 728 })
  })

  it('starts a surface wider than the bounds where the bounds start', () => {
    expect(placed({ surface: { height: 60, width: 500 } })).toMatchObject({
      x: 12,
    })
    expect(
      placed({ align: 'start', surface: { height: 60, width: 500 } }),
    ).toMatchObject({ x: 12 })
  })

  it('keeps a surface wider than both sides inside the bounds', () => {
    expect(
      placed({ side: 'left', surface: { height: 60, width: 300 } }),
    ).toMatchObject({ side: 'left', x: 12 })
    expect(
      placed({ side: 'right', surface: { height: 60, width: 300 } }),
    ).toMatchObject({ side: 'right', x: 88 })
  })

  it('stays inside the safe area', () => {
    const notched = boundsOf(
      { height: 800, width: 400 },
      { bottom: 34, left: 44, right: 0, top: 47 },
      12,
    )

    // 23 dp between the anchor and the inset at the top, so it flips.
    expect(
      placed({ anchor: { ...ANCHOR, y: 90 }, bounds: notched, side: 'top' }),
    ).toMatchObject({ side: 'bottom' })
    expect(placed({ anchor: { ...ANCHOR, y: 90 }, side: 'top' })).toMatchObject(
      { side: 'top', y: 22 },
    )
    expect(
      placed({ anchor: { ...ANCHOR, x: 40 }, bounds: notched }),
    ).toMatchObject({ x: 56 })
  })
})
