import type { RefObject } from 'react'
import type { HostInstance, LayoutChangeEvent, ViewStyle } from 'react-native'

import { use, useEffect, useState } from 'react'
import { Dimensions, I18nManager, useWindowDimensions } from 'react-native'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

import type { OverlayAlign, OverlaySide, Rect, Size } from './placement'

import { useTheme } from '../theme/scope'
import { OverlayHostContext } from './host'
import { boundsOf, place } from './placement'

type AnchoredPlacement = {
  /**
   * The anchor's width as it was measured, for a surface as wide as what
   * opened it, and undefined until the surface has been placed.
   */
  readonly anchorWidth: number | undefined
  /**
   * Hand to the surface's own `onLayout`. The surface is placed once it has
   * reported its size, and placed again whenever that size changes.
   */
  readonly onLayout: (event: LayoutChangeEvent) => void
  /**
   * Whether the surface has been placed. Until it has, it is laid out out of
   * sight, and a screen reader cannot be sent to it.
   */
  readonly placed: boolean
  /** The side the surface opened on, which is the opposite one after a flip. */
  readonly side: OverlaySide
  /**
   * The surface's position in the overlay layer, and the height it may take.
   * Until it has been placed it is laid out out of sight, to be measured.
   */
  readonly style: ViewStyle
}

type AnchoredPlacementOptions = {
  /**
   * Where the surface sits along the side it opens on.
   * @default 'center'
   */
  readonly align?: OverlayAlign | undefined
  /** Moves the surface along that side, in dp: right or down when positive. */
  readonly alignOffset?: number | undefined
  /** The view the surface opens beside. */
  readonly anchor: RefObject<null | Pick<HostInstance, 'measureInWindow'>>
  /**
   * Which side of the anchor the surface opens on. It flips to the opposite
   * side when there is no room.
   * @default 'bottom'
   */
  readonly side?: OverlaySide | undefined
  /**
   * The gap between the anchor and the surface, in dp.
   * @default spacing.sm
   */
  readonly sideOffset?: number | undefined
}

type Measured = {
  readonly anchor: Rect
  /** Where the overlay layer starts in the window. */
  readonly origin: { readonly x: number; readonly y: number }
}

const HIDDEN: ViewStyle = {
  left: 0,
  opacity: 0,
  pointerEvents: 'none',
  position: 'absolute',
  top: 0,
}

// Outside a SafeAreaProvider the insets are unknown, and the window's own edge
// is the best bound there is.
const NO_INSETS = { bottom: 0, left: 0, right: 0, top: 0 }

/**
 * Places a surface drawn in an `Overlay` beside the view that opened it, as
 * web's anchored overlays are placed: on `side`, lined up by `align`, flipped
 * to the opposite side at the edge of the window, and kept inside the safe
 * area's insets with `spacing.md` to spare, the padding React Aria keeps from
 * the edge of the viewport. On `top` and `bottom`, `start` and `end` follow
 * `I18nManager.isRTL`.
 *
 * The anchor is measured with `measureInWindow` whenever the surface reports
 * a new size or the window changes size.
 */
function useAnchoredPlacement({
  align = 'center',
  alignOffset = 0,
  anchor,
  side = 'bottom',
  sideOffset,
}: AnchoredPlacementOptions): AnchoredPlacement {
  const store = use(OverlayHostContext)
  const { spacing } = useTheme()
  const window = useWindowDimensions()
  const insets = use(SafeAreaInsetsContext) ?? NO_INSETS
  const [measured, setMeasured] = useState<Measured | null>(null)
  const [surface, setSurface] = useState<null | Size>(null)

  useEffect(() => {
    // The layer is measured as well as the anchor, since the host need not
    // start at the window's corner: the surface is placed in the layer, and
    // the anchor is measured in the window.
    const measure = () => {
      const layer = store?.layer() ?? null
      const target = anchor.current

      if (surface === null || layer === null || target === null) {
        return
      }

      layer.measureInWindow((originX, originY) => {
        target.measureInWindow((x, y, width, height) => {
          setMeasured({
            anchor: { height, width, x, y },
            origin: { x: originX, y: originY },
          })
        })
      })
    }

    measure()

    // A rotation or a resized window can move the anchor without the
    // surface changing size.
    const subscription = Dimensions.addEventListener('change', measure)

    return () => {
      subscription.remove()
    }
  }, [anchor, store, surface])

  const onLayout = (event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout

    setSurface((known) =>
      known?.height === height && known.width === width
        ? known
        : { height, width },
    )
  }

  if (measured === null || surface === null) {
    return {
      anchorWidth: undefined,
      onLayout,
      placed: false,
      side,
      style: HIDDEN,
    }
  }

  const placement = place({
    align,
    alignOffset,
    anchor: measured.anchor,
    bounds: boundsOf(window, insets, spacing.md),
    rtl: I18nManager.isRTL,
    side,
    sideOffset: sideOffset ?? spacing.sm,
    surface,
  })
  const x = placement.x - measured.origin.x

  return {
    anchorWidth: measured.anchor.width,
    onLayout,
    placed: true,
    side: placement.side,
    style: {
      maxHeight: placement.maxHeight,
      position: 'absolute',
      top: placement.y - measured.origin.y,
      // The placement is in physical coordinates, as `measureInWindow`
      // reports them. React Native swaps `left` and `right` in a right-to-left
      // layout unless an app turns that off, so there `right` is what puts
      // the surface's left edge where the placement says.
      ...(I18nManager.isRTL && I18nManager.doLeftAndRightSwapInRTL
        ? { right: x }
        : { left: x }),
    },
  }
}

export type { AnchoredPlacement, AnchoredPlacementOptions }

export { useAnchoredPlacement }
