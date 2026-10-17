// Which end of the anchor the surface lines up with, along the side.
type Edge = 'center' | 'far' | 'near'

/** Where along that side it lines up with the anchor. */
type OverlayAlign = 'center' | 'end' | 'start'

/** Which side of the anchor a surface opens on. */
type OverlaySide = 'bottom' | 'left' | 'right' | 'top'

/** Where an anchored surface sits, in the coordinates its inputs were in. */
type Placement = {
  /**
   * The height the surface may take before it would pass the edge of the
   * bounds on the side it opened on. A surface taller than this scrolls.
   */
  readonly maxHeight: number
  /** The side it opened on, which is the opposite one after a flip. */
  readonly side: OverlaySide
  readonly x: number
  readonly y: number
}

type PlacementInput = {
  readonly align: OverlayAlign
  /** Moves the surface along the side, in dp: right or down when positive. */
  readonly alignOffset: number
  readonly anchor: Rect
  /** The area the surface stays inside, padding already taken off. */
  readonly bounds: Rect
  /** Whether `start` and `end` read from the right, on `top` and `bottom`. */
  readonly rtl: boolean
  readonly side: OverlaySide
  /** The gap between the anchor and the surface, in dp. */
  readonly sideOffset: number
  readonly surface: Size
}

type Rect = Size & { readonly x: number; readonly y: number }

type Size = { readonly height: number; readonly width: number }

const OPPOSITE = {
  bottom: 'top',
  left: 'right',
  right: 'left',
  top: 'bottom',
} as const satisfies Record<OverlaySide, OverlaySide>

/**
 * Where a surface of a given length starts along the anchor, for an edge,
 * moved by the offset. However far the offset moves it, it keeps overlapping
 * the anchor, as React Aria's placement does on web.
 */
function along(
  start: number,
  length: number,
  size: number,
  edge: Edge,
  offset: number,
) {
  const lined =
    edge === 'near'
      ? start
      : edge === 'far'
        ? start + length - size
        : start + (length - size) / 2

  return Math.min(Math.max(lined + offset, start - size), start + length)
}

/**
 * Bounds a surface stays inside: the window, less the safe area's insets and
 * a padding on every side.
 */
function boundsOf(
  window: Size,
  insets: { bottom: number; left: number; right: number; top: number },
  padding: number,
): Rect {
  return {
    height: window.height - insets.top - insets.bottom - padding * 2,
    width: window.width - insets.left - insets.right - padding * 2,
    x: insets.left + padding,
    y: insets.top + padding,
  }
}

// Which end of the anchor an alignment names. On `top` and `bottom` the
// surface lines up along the inline axis, so `start` is the left edge, or the
// right one in a right-to-left layout; on `left` and `right` it lines up along
// the block axis, where `start` is the top edge in both.
//
// `rtl` is read for its truth rather than compared with a boolean: it comes
// from `I18nManager.isRTL`, which React Native Web leaves undefined, and an
// equality with undefined put every `end` at the start there.
function edgeOf(align: OverlayAlign, inline: boolean, rtl: boolean): Edge {
  if (align === 'center') {
    return 'center'
  }

  const fromRight = inline && rtl

  if (align === 'start') {
    return fromRight ? 'far' : 'near'
  }

  return fromRight ? 'near' : 'far'
}

function isVertical(side: OverlaySide) {
  return side === 'bottom' || side === 'top'
}

/**
 * Places a surface beside its anchor, as React Aria places a popover on web.
 *
 * It opens on `side`, lined up along it by `align`, and flips to the opposite
 * side when it does not fit and that side has more room. Along the side it is
 * shifted to stay inside the bounds; across it, on `top` and `bottom`, it
 * stays inside them through `maxHeight`, and on `left` and `right`, where a
 * surface wider than both sides has nowhere to go, it is shifted over the
 * anchor rather than past the edge.
 */
function place({
  align,
  alignOffset,
  anchor,
  bounds,
  rtl,
  side: preferred,
  sideOffset,
  surface,
}: PlacementInput): Placement {
  const room = (on: OverlaySide) => spaceOn(on, anchor, bounds, sideOffset)
  const opposite = OPPOSITE[preferred]
  const length = isVertical(preferred) ? surface.height : surface.width
  const side =
    length > room(preferred) && room(opposite) > room(preferred)
      ? opposite
      : preferred

  if (isVertical(side)) {
    const maxHeight = Math.max(0, room(side))
    const height = Math.min(surface.height, maxHeight)
    const x = along(
      anchor.x,
      anchor.width,
      surface.width,
      edgeOf(align, true, rtl),
      alignOffset,
    )

    return {
      maxHeight,
      side,
      x: within(x, bounds.x, bounds.width, surface.width),
      y:
        side === 'bottom'
          ? anchor.y + anchor.height + sideOffset
          : anchor.y - sideOffset - height,
    }
  }

  const maxHeight = Math.max(0, bounds.height)
  const height = Math.min(surface.height, maxHeight)
  const x =
    side === 'right'
      ? anchor.x + anchor.width + sideOffset
      : anchor.x - sideOffset - surface.width
  const y = along(
    anchor.y,
    anchor.height,
    height,
    edgeOf(align, false, rtl),
    alignOffset,
  )

  return {
    maxHeight,
    side,
    x: within(x, bounds.x, bounds.width, surface.width),
    y: within(y, bounds.y, bounds.height, height),
  }
}

// The room between the anchor and the edge of the bounds on a side, less the
// gap the surface keeps from the anchor.
function spaceOn(
  side: OverlaySide,
  anchor: Rect,
  bounds: Rect,
  sideOffset: number,
) {
  const room = {
    bottom: bounds.y + bounds.height - anchor.y - anchor.height,
    left: anchor.x - bounds.x,
    right: bounds.x + bounds.width - anchor.x - anchor.width,
    top: anchor.y - bounds.y,
  }

  return room[side] - sideOffset
}

// Shifts a surface along an axis until it is inside the bounds, or, when it is
// longer than they are, until it starts where they start.
function within(position: number, start: number, length: number, size: number) {
  if (position < start) {
    return start
  }

  if (position + size > start + length) {
    return Math.max(start + length - size, start)
  }

  return position
}

export type { OverlayAlign, OverlaySide, Placement, PlacementInput, Rect, Size }

export { boundsOf, place }
