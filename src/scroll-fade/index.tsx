import type { ColorValue, ScrollViewProps, ViewStyle } from 'react-native'

import { useCallback, useId, useRef, useState } from 'react'
import { I18nManager, Platform, StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import type { ResolvedTheme } from '../theme/scope'

import { HIDDEN } from '../glyphs/hidden'
import { useTheme } from '../theme/scope'
import { composeStyles, themedStyles } from '../theme/styles'

// The fade on the edge of something that scrolls sideways, while there is
// more of it past that edge, as kanso-ui's src/styles/scroll-fade.ts draws
// it. A bar or a table cut off at its edge leaves the cut-off part looking
// like the whole: a tab clipped to "…nd item", a column that is simply not
// there until the reader happens to scroll. Fading the edge is what says
// there is more.
//
// Only an edge with something past it fades, so a box scrolled to its start
// keeps a hard start edge, and one whose content fits keeps both.
// `useScrollEdges` tells which, from the scroll view's own events.
//
// **On Android the scroll view fades its own edges**, through
// `fadingEdgeLength`, which `scrollFadeProps` hands it: the platform fades
// what is drawn there to nothing, and only at an edge with content past it.
//
// **On iOS and the web nothing native does**, and React Native has no mask,
// so `ScrollFade` lays a gradient over the edge instead: from the colour of
// the container the box is drawn on, opaque at the edge, to that colour
// transparent. The caller names that colour, from the theme, since only it
// knows what it is drawn on. Web's mask fades to whatever is behind without
// knowing it; a gradient has to be told.
//
// Material Design gives a scrolling box no such treatment, so the length is
// the library's own, kanso-ui's: 32dp, the spacing scale's `xxl`, the step
// wide enough to take the last letters of a label down to nothing while the
// rest of it still reads.
//
// The offsets are a scroll view's `contentOffset.x`, which under a
// right-to-left layout React Native measures from the left edge as it does
// any other, so the start of the content is the far end of the scroll, as
// src/components/carousel reads it.

/** Which inline edges of a scrolling box have content past them. */
type ScrollEdges = { readonly end: boolean; readonly start: boolean }

// Subpixel layout leaves a box scrolled to either end a fraction of a pixel
// short of it, which would otherwise read as one more pixel to go.
const SLACK = 1

const NO_EDGES: ScrollEdges = { end: false, start: false }

const styles = StyleSheet.create({
  fadeEnd: {
    end: 0,
  },
  fadeStart: {
    start: 0,
  },
})

const stylesOf = themedStyles(({ spacing }: ResolvedTheme) =>
  StyleSheet.create({
    // Laid over the box from top to bottom at one edge, the fade's length
    // wide, and never in the way of a press on what it fades.
    fade: {
      bottom: 0,
      pointerEvents: 'none',
      position: 'absolute',
      top: 0,
      width: spacing.xxl,
    },
  }),
)

/**
 * The edges with content past them, for a box `viewport` wide showing
 * `content` of it scrolled `offset` along: `start` once it is scrolled away
 * from its start, `end` while there is more past its end, and neither while
 * what it holds fits.
 */
function edgesOf(
  offset: number,
  viewport: number,
  content: number,
  rtl: boolean,
): ScrollEdges {
  const room = content - viewport
  if (viewport <= 0 || room <= SLACK) {
    return NO_EDGES
  }
  const travelled = rtl ? room - offset : offset
  return { end: travelled < room - SLACK, start: travelled > SLACK }
}

// One edge's gradient: opaque at the edge and transparent at the fade's
// length in. A gradient's direction is physical, so the start edge is the
// right one under a right-to-left layout.
function Fade({
  color,
  edge,
}: {
  readonly color: ColorValue
  readonly edge: 'end' | 'start'
}) {
  const own = stylesOf(useTheme())
  // A gradient is found by its id, which has to be unique in the page under
  // React Native Web, as the chequer's pattern is.
  const id = `fade${useId()}`
  // Read as a negation, since React Native Web's `I18nManager` has no
  // `isRTL` at all, and an undefined one compared as it is would flip the
  // end fade there.
  const fromLeft = (edge === 'start') === !I18nManager.isRTL

  return (
    <View
      style={composeStyles<ViewStyle>(
        own.fade,
        edge === 'start' ? styles.fadeStart : styles.fadeEnd,
      )}
    >
      <Svg
        {...HIDDEN}
        height="100%"
        style={StyleSheet.absoluteFill}
        width="100%"
      >
        <Defs>
          <LinearGradient
            id={id}
            x1={fromLeft ? 0 : 1}
            x2={fromLeft ? 1 : 0}
            y1={0}
            y2={0}
          >
            <Stop offset={0} stopColor={color} stopOpacity={1} />
            <Stop offset={1} stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect fill={`url(#${id})`} height="100%" width="100%" />
      </Svg>
    </View>
  )
}

/**
 * The fade over the edges of a box that scrolls sideways which have content
 * past them, in `color`, the colour of the container the box is drawn on.
 * Place it after the scroll view, inside a view the same size as it. On
 * Android it draws nothing: `scrollFadeProps` has the scroll view fade
 * itself.
 */
function ScrollFade({
  color,
  edges,
}: {
  readonly color: ColorValue
  readonly edges: ScrollEdges
}) {
  if (Platform.OS === 'android') {
    return null
  }
  return (
    <>
      {edges.start ? <Fade color={color} edge="start" /> : null}
      {edges.end ? <Fade color={color} edge="end" /> : null}
    </>
  )
}

/**
 * Which inline edges of a box that scrolls sideways have content past them,
 * from the three things its scroll view reports: how far it has scrolled,
 * how wide it is, and how wide its content is. Hand each report to the
 * function of the same name, from the scroll view's own handlers.
 *
 * The three are kept outside of state and the edges in it, so a scroll
 * renders the box again only as an edge starts or stops fading, rather
 * than on every frame it moves.
 */
function useScrollEdges() {
  const measured = useRef({ content: 0, offset: 0, viewport: 0 })
  const [edges, setEdges] = useState(NO_EDGES)

  const update = useCallback(
    (
      change: Partial<{ content: number; offset: number; viewport: number }>,
    ) => {
      const next = { ...measured.current, ...change }
      measured.current = next
      const now = edgesOf(
        next.offset,
        next.viewport,
        next.content,
        I18nManager.isRTL,
      )
      setEdges((before) =>
        before.end === now.end && before.start === now.start ? before : now,
      )
    },
    [],
  )
  const onContentSize = useCallback(
    (width: number) => {
      update({ content: width })
    },
    [update],
  )
  const onScrolled = useCallback(
    (x: number) => {
      update({ offset: x })
    },
    [update],
  )
  const onViewport = useCallback(
    (width: number) => {
      update({ viewport: width })
    },
    [update],
  )

  return { edges, onContentSize, onScrolled, onViewport }
}

/**
 * What a scroll view that scrolls sideways takes to fade its own edges on
 * Android, and nothing anywhere else, where `ScrollFade` draws the fade.
 */
function useScrollFadeProps(): Pick<ScrollViewProps, 'fadingEdgeLength'> {
  const { spacing } = useTheme()
  return Platform.OS === 'android' ? { fadingEdgeLength: spacing.xxl } : {}
}

export { edgesOf, ScrollFade, useScrollEdges, useScrollFadeProps }
export type { ScrollEdges }
