import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native'

import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

/**
 * The small bar's height in dp, which is what a flexible bar collapses to.
 * AppBar draws its small height from this, so the hook's arithmetic and the
 * bar it measures cannot disagree.
 */
const COLLAPSED_BLOCK_SIZE = 64

// How long Android waits after the last scroll event before the bar changes,
// in ms: past the frames of a drag or a fling, so the view resizes once it
// has stopped.
const SETTLE = 150

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
 *
 * **On Android the bar changes once the scroll has stopped**, 150ms after
 * the last event, rather than as the screen scrolls. A scroll view there that
 * changes height while it is dragged goes back to an earlier offset, near 0,
 * so the bar collapsing under a drag pulled the content back to the top: the
 * hook then expanded the bar, the view shrank, and the two took turns until
 * the finger lifted, leaving the content where the drag began and the bar
 * as often expanded as not. iOS and the web keep the bar following the
 * scroll as it goes. An event that comes with the view at a new height is
 * the one its resizing sends, which Android sends with an offset of 0, and
 * it is left alone everywhere; the event after it carries the offset.
 */
function useAppBarScroll({
  collapseAfter = 0,
}: AppBarScrollOptions = {}): AppBarScroll {
  const height = useRef(COLLAPSED_BLOCK_SIZE)
  // The scrolling view's height in the event before, which tells the event
  // its own resizing sends apart from one a scroll does.
  const viewport = useRef<null | number>(null)
  // The change Android waits to make until the scroll has stopped.
  const settle = useRef<null | ReturnType<typeof setTimeout>>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(
    () => () => {
      if (settle.current !== null) {
        clearTimeout(settle.current)
      }
    },
    [],
  )

  const onLayout = (event: LayoutChangeEvent) => {
    height.current = event.nativeEvent.layout.height
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
    const offset = contentOffset.y
    const resized =
      viewport.current !== null && viewport.current !== layoutMeasurement.height

    viewport.current = layoutMeasurement.height
    if (resized) {
      return
    }

    setScrolled(offset > 0)
    let next = collapsed
    if (offset <= collapseAfter) {
      next = false
    } else if (!collapsed) {
      const givesBack = Math.max(0, height.current - COLLAPSED_BLOCK_SIZE)
      next =
        contentSize.height - layoutMeasurement.height - givesBack >
        collapseAfter
    }
    if (Platform.OS !== 'android') {
      setCollapsed(next)
      return
    }
    if (settle.current !== null) {
      clearTimeout(settle.current)
    }
    settle.current = setTimeout(() => {
      settle.current = null
      setCollapsed(next)
    }, SETTLE)
  }

  return { collapsed, onLayout, onScroll, scrolled }
}

export { COLLAPSED_BLOCK_SIZE, useAppBarScroll }
export type { AppBarScroll, AppBarScrollOptions }
