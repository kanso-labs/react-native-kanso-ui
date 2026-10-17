import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native'

import { useRef, useState } from 'react'

/**
 * The small bar's height in dp, which is what a flexible bar collapses to.
 * AppBar draws its small height from this, so the hook's arithmetic and the
 * bar it measures cannot disagree.
 */
const COLLAPSED_BLOCK_SIZE = 64

type AppBarScroll = {
  /** For the bar's `collapsed`. */
  readonly collapsed: boolean
  /**
   * For the bar's `onLayout`. The bar's height is what tells the hook how
   * much room collapsing gives back, so without it every screen counts as
   * long enough to collapse on.
   */
  readonly onLayout: (event: LayoutChangeEvent) => void
  /** For the `onScroll` of the view that scrolls. */
  readonly onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  /** For the bar's `scrolled`. */
  readonly scrolled: boolean
}

type AppBarScrollOptions = {
  /**
   * How far the screen scrolls, in dp, before the bar collapses. It expands
   * again once the screen is scrolled back to this offset or less.
   * @default 0
   */
  readonly collapseAfter?: number
}

/**
 * Derives an `AppBar`'s `scrolled` and `collapsed` from the view its screen
 * scrolls in. Pass `onLayout` to the bar and `onScroll` to that view, and
 * hand the bar the two states.
 *
 * ```tsx
 * const { collapsed, onLayout, onScroll, scrolled } = useAppBarScroll()
 *
 * <AppBar collapsed={collapsed} onLayout={onLayout} pinned scrolled={scrolled} size="lg" />
 * <ScrollView onScroll={onScroll} scrollEventThrottle={16}>…</ScrollView>
 * ```
 *
 * `onScroll` is a plain handler, so it fits any scroll view: a `ScrollView`,
 * a `FlatList`, the library's `List`, and Reanimated's animated ones. Give
 * the view a `scrollEventThrottle` of 16, so the event comes once a frame:
 * React Native's default of 0 sends it once each time the view is scrolled.
 *
 * It collapses the bar only on a screen long enough to stay collapsed.
 * Collapsing shortens the bar, which the scroll view below it grows into, so
 * a screen that overflows by less than the height the bar gives back plus
 * `collapseAfter` cannot scroll that far any more: the offset is pulled back
 * inside the shorter content, below `collapseAfter`, the bar expands, and
 * the two take turns on every scroll event. On such a screen the bar stays
 * expanded, which is also all there is room for. The bar's height counts its
 * safe-area inset as well, which collapsing keeps, so a screen that only
 * just overflows by enough is taken to be too short, and the bar stays
 * expanded there too.
 */
function useAppBarScroll({
  collapseAfter = 0,
}: AppBarScrollOptions = {}): AppBarScroll {
  const height = useRef(COLLAPSED_BLOCK_SIZE)
  const [collapsed, setCollapsed] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const onLayout = (event: LayoutChangeEvent) => {
    height.current = event.nativeEvent.layout.height
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
    const offset = contentOffset.y

    setScrolled(offset > 0)
    if (offset <= collapseAfter) {
      setCollapsed(false)
    } else if (!collapsed) {
      const givesBack = Math.max(0, height.current - COLLAPSED_BLOCK_SIZE)
      setCollapsed(
        contentSize.height - layoutMeasurement.height - givesBack >
          collapseAfter,
      )
    }
  }

  return { collapsed, onLayout, onScroll, scrolled }
}

export { COLLAPSED_BLOCK_SIZE, useAppBarScroll }
export type { AppBarScroll, AppBarScrollOptions }
