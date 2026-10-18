import type { ComponentRef, ReactNode, Ref } from 'react'
import type {
  LayoutChangeEvent,
  ScrollView,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle, SharedValue } from 'react-native-reanimated'

import {
  Children,
  createContext,
  isValidElement,
  use,
  useCallback,
  useRef,
  useState,
} from 'react'
import {
  I18nManager,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import type { CarouselLayout, Placement } from '../../carousel/arrangement'

import { arrange, GAP, placements } from '../../carousel/arrangement'
import { ChevronEndGlyph } from '../../glyphs'
import { slideLabelFor } from '../../i18n'
import { useLocaleOf, useMessages } from '../../i18n/provider'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { IconButton } from '../icon-button'

// The carousel page's carousel, as kanso-ui's Carousel draws it: a row of
// items that scrolls on and off the screen, in three of the page's layouts.
// Each has the page's 16dp of padding at its ends and 8dp at its top and
// bottom, 8dp between items and a 28dp corner on every item.
//
// - **Multi-browse**, the default, shows as many large items as fit at
//   `itemSize`, then a medium one and a small one, and fills its width
//   exactly; the large width gives way where the preferred one does not fit.
// - **Hero** shows one large item and one small.
// - **Uncontained** shows every item at `itemSize`, scrolling past the edge.
//
// **Items change size as they move**, as the page draws them. The first two
// layouts come to rest one item apart, and between two rests every item's
// place and width are interpolated, so an item shrinks as it leaves and
// grows as it arrives; the last rests turn the arrangement round a slot at a
// time, so every item is drawn large at one of them. The arithmetic is
// `src/carousel/arrangement.ts`, web's own.
//
// **The scrolling is the platform's.** A horizontal scroll view holds the
// items in a row, each in a slot as wide as a large item, and is as long as
// the run of rests, so it comes to rest at them through `snapToOffsets`. A
// scroll handler keeps how far it has scrolled on the UI thread, and each
// item is drawn from that there too: moved along by as much as the view has
// scrolled, which holds it against what shows, and then to where the
// arrangement places it, and cut to the width it is drawn at by a view with
// the page's corner, centred on what it holds, which is laid out at the large
// width. What it holds is cut at both sides rather than squeezed, as the
// page's masked items are, and as web's are by `clip-path`. Uncontained has
// no rests and no masks, so its items scroll in the row themselves, snapping
// to their own starts.
//
// **It is the ARIA carousel pattern** that web follows: a region named by
// `label`, each item a group named by which of how many it is, and a previous
// and a next button under it, at the end, which move to the neighbouring rest
// and are disabled at either limit. Under React Native Web the region and its
// items take web's role descriptions, carousel and slide; neither platform
// has a role description to give them. On iOS and Android a screen reader
// moves through the items itself, and nothing here scrolls when one is
// reached, which web does on focus. Under reduced motion the buttons jump
// rather than scroll.
//
// The gap between items is the arrangement's 8dp, `GAP`, rather than the
// theme's `spacing.sm`, since every rest and every place is worked out from
// it, and a scheme moving the one without the other would draw the items
// over each other. The padding at the ends is the theme's `spacing.lg`, which
// the arithmetic is handed.
//
// The page's large width is "dynamic, or user-set", and neither MDC-Android
// nor Compose has a default for it; `itemSize`'s 240 is web's own.
// Uncontained keeps the padding at its end as well as its start, where the
// page gives it a leading padding alone, so its last item does not end flush
// against the edge.
//
// React Native Web has no `snapToOffsets`, so in the web Storybook the
// carousel rests wherever a drag leaves it; the buttons still move it from
// rest to rest.

const DEFAULT_ITEM_SIZE = 240

// How near a limit counts as at it, in dp, since a scroll can come to rest a
// fraction of a pixel short.
const SLACK = 0.5

type CarouselItemProps = Omit<ViewProps, 'children'> & {
  /** What the item shows: usually an image, which the item masks. */
  readonly children?: ReactNode
  readonly ref?: Ref<ComponentRef<typeof View>>
}

type CarouselProps = Omit<ViewProps, 'children'> & {
  /** The items: `Carousel.Item` for each. */
  readonly children?: ReactNode
  /**
   * The large item's preferred width, in dp. Multi-browse lays out as many
   * as fit and narrows them where they do not; uncontained draws every item
   * at it; hero takes its large item's width from the carousel's.
   * @default 240
   */
  readonly itemSize?: number
  /**
   * What the carousel shows, for a screen reader. Required rather than
   * optional: a carousel is a region, and a region with no name is one a
   * screen reader cannot introduce.
   */
  readonly label: string
  /**
   * Which of the page's layouts the carousel draws.
   * @default 'multi-browse'
   */
  readonly layout?: CarouselLayout
  /**
   * What the next button is called. Left out, the library names it in the
   * reader's locale — "Next slide" in English.
   */
  readonly nextLabel?: string
  /**
   * What the previous button is called. Left out, the library names it in
   * the reader's locale — "Previous slide" in English.
   */
  readonly previousLabel?: string
  readonly ref?: Ref<ComponentRef<typeof View>>
}

/** Which limits the carousel is at, as one value a reaction can compare. */
type Edge = 'both' | 'end' | 'none' | 'start'

/** What the controls scroll by, as numbers read off one render. */
type Geometry = {
  /** The offset of the last rest, or for uncontained how far it scrolls. */
  readonly end: number
  readonly masked: boolean
  readonly scrolled: number
  /** The distance between two rests, or for uncontained between two items. */
  readonly step: number
}

/** Where a layout that masks draws an item at each of its rests. */
type Path = {
  /** The rests, counted from 0, which the two below are drawn at. */
  readonly rests: readonly number[]
  /** Where the item starts at each rest, along the content box. */
  readonly starts: readonly number[]
  readonly widths: readonly number[]
}

type Slot = {
  readonly count: number
  readonly index: number
  /** The width the item is laid out at. */
  readonly large: number
  readonly layout: CarouselLayout
  /** Where it is drawn, for a layout that masks. */
  readonly path: Path | undefined
  readonly rtl: boolean
  /** How far the carousel has scrolled along the text, on the UI thread. */
  readonly scrolled: SharedValue<number>
  /** The distance between two rests. */
  readonly step: number
}

const SlotContext = createContext<null | Slot>(null)

const styles = StyleSheet.create({
  // A layout that masks holds its row to the run of rests, and clips what it
  // places past either end rather than letting it lengthen the scroll view.
  contentMasked: {
    overflow: 'hidden',
  },
  // What an item holds, laid out at the large width and centred on the mask,
  // so the mask cuts it at both sides.
  held: {
    flexGrow: 1,
  },
  // Previous points at the start, and next at the end; the end chevron turns
  // over with the text itself, so previous turns it back.
  previousGlyph: {
    transform: [{ scaleX: -1 }],
  },
  previousGlyphRightToLeft: {
    transform: [{ scaleX: 1 }],
  },
  root: {
    minWidth: 0,
  },
  // The room a large item is laid out in. The mask inside it is centred,
  // and the row stretches every slot to the tallest item.
  slot: {
    alignItems: 'center',
    flexShrink: 0,
  },
})

const stylesOf = themedStyles(({ radii, spacing }) =>
  StyleSheet.create({
    controls: {
      columnGap: spacing.sm,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.lg,
    },
    // The mask, which is the item: the page's corner, cutting what it holds
    // to the width it is drawn at.
    item: {
      alignItems: 'center',
      borderRadius: radii.xl,
      flexGrow: 1,
      overflow: 'hidden',
    },
    root: {
      rowGap: spacing.sm,
    },
    row: {
      columnGap: GAP,
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
  }),
)

// Where a press of previous or next scrolls to from `scrolled`: the rest
// either side of the nearest one, or for uncontained an item's width along,
// kept between the two ends.
function along(
  direction: -1 | 1,
  { end, masked, scrolled, step }: Geometry,
): number {
  const offset = masked
    ? (Math.round(scrolled / step) + direction) * step
    : scrolled + direction * step
  return Math.min(Math.max(offset, 0), end)
}

/**
 * A row of items that scrolls on and off the screen, in the carousel page's
 * multi-browse, hero or uncontained layout. Name it with `label`, and give it
 * a `Carousel.Item` for each item.
 *
 * ```tsx
 * <Carousel label="Label">
 *   <Carousel.Item><Image alt="First item" source={first} /></Carousel.Item>
 *   <Carousel.Item><Image alt="Second item" source={second} /></Carousel.Item>
 * </Carousel>
 * ```
 *
 * `style`, `ref` and `testID` land on the carousel as a whole, which is the
 * view a layout positions, and a `style` there applies over its own.
 */
function Carousel({
  children,
  itemSize = DEFAULT_ITEM_SIZE,
  label,
  layout = 'multi-browse',
  nextLabel,
  previousLabel,
  style,
  ...props
}: CarouselProps) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const messages = useMessages()
  const reduceMotion = useReducedMotion()
  const dimensions = useWindowDimensions()
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null)
  const scrolled = useSharedValue(0)
  // The scroll view's width, which the layout reports once it has drawn;
  // before that the first render guesses the window's.
  const [measured, setMeasured] = useState<number>()
  const width = measured ?? dimensions.width
  const padding = theme.spacing.lg
  const rtl = I18nManager.isRTL

  const items = Children.toArray(children).filter(isValidElement)
  const count = items.length
  const room = Math.max(width - 2 * padding, 0)
  const arrangement = arrange(layout, room, itemSize, count)
  const masked = layout !== 'uncontained'
  const step = arrangement.large + GAP
  // The last rest, or how far the uncontained row runs past the scroll view.
  const end = masked
    ? arrangement.steps * step
    : Math.max(count * step - GAP + 2 * padding - width, 0)
  const paths = masked
    ? pathsOf(
        Array.from({ length: arrangement.steps + 1 }, (_, rest) =>
          placements(layout, arrangement, room, padding, count, rest),
        ),
        count,
      )
    : []

  const [edge, setEdge] = useState<Edge>(() => edgeOf(0, end))

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet'
      scrolled.set(fromStart(event.contentOffset.x, end, rtl))
    },
  })

  // Which limits the carousel is at, on the JavaScript thread, for the two
  // buttons; told only when it changes, rather than on every frame.
  useAnimatedReaction(
    () => {
      'worklet'
      return edgeOf(scrolled.get(), end)
    },
    (now, before) => {
      'worklet'
      if (now !== before) {
        scheduleOnRN(setEdge, now)
      }
    },
  )

  const move = useCallback(
    (direction: -1 | 1) => {
      const geometry = { end, masked, scrolled: scrolled.get(), step }
      scroller.current?.scrollTo({
        animated: !reduceMotion,
        x: fromStart(along(direction, geometry), end, rtl),
      })
    },
    [end, masked, reduceMotion, rtl, scrolled, step],
  )
  const previous = useCallback(() => {
    move(-1)
  }, [move])
  const next = useCallback(() => {
    move(1)
  }, [move])

  const slots = items.map((_, index): Slot => ({
    count,
    index,
    large: arrangement.large,
    layout,
    path: paths[index],
    rtl,
    scrolled,
    step,
  }))

  return (
    <View
      aria-label={label}
      role="region"
      {...describedAs(messages.carousel)}
      {...props}
      style={composeStyles<ViewStyle>(styles.root, own.root, style)}
    >
      <Animated.ScrollView
        contentContainerStyle={composeStyles<ViewStyle>(
          own.row,
          masked && styles.contentMasked,
          masked && { width: width + end },
        )}
        decelerationRate="fast"
        // A keyboard stop while there is anywhere to scroll, so the arrow
        // keys move it whatever its items hold, which axe's
        // scrollable-region-focusable asks of it under React Native Web.
        focusable={end > 0}
        horizontal
        onLayout={widthTo(setMeasured)}
        onScroll={onScroll}
        ref={scroller}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToOffsets={offsetsOf(masked, arrangement.steps, step, count, end)}
      >
        {items.map((item, index) => (
          <SlotContext key={item.key ?? index} value={slots[index] ?? null}>
            {item}
          </SlotContext>
        ))}
      </Animated.ScrollView>
      <View style={own.controls}>
        <IconButton
          aria-label={previousLabel ?? messages.previousSlide}
          isDisabled={edge === 'start' || edge === 'both'}
          onPress={previous}
        >
          <ChevronEndGlyph
            style={rtl ? styles.previousGlyphRightToLeft : styles.previousGlyph}
          />
        </IconButton>
        <IconButton
          aria-label={nextLabel ?? messages.nextSlide}
          isDisabled={edge === 'end' || edge === 'both'}
          onPress={next}
        >
          <ChevronEndGlyph />
        </IconButton>
      </View>
    </View>
  )
}

/**
 * One item. It is named by which of how many it is — "2 of 6" — unless it is
 * given an `aria-label` of its own.
 *
 * `style`, `ref` and `testID` land on the item, the view with the corner that
 * cuts what it holds to the width it is drawn at.
 */
function CarouselItem({ children, style, ...props }: CarouselItemProps) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const locale = useLocaleOf(undefined)
  const messages = useMessages()
  const slot = use(SlotContext)
  const count = slot?.count ?? 1
  const index = slot?.index ?? 0
  const drawn = useDrawn(slot)

  return (
    <View style={composeStyles<ViewStyle>(styles.slot, slotWidthOf(slot))}>
      <Animated.View
        aria-label={slideLabelFor(index + 1, count, locale)}
        role="group"
        {...describedAs(messages.slide)}
        {...props}
        style={composeStyles<AnimatedStyle<ViewStyle>>(own.item, drawn, style)}
      >
        <View style={composeStyles<ViewStyle>(styles.held, slotWidthOf(slot))}>
          {children}
        </View>
      </Animated.View>
    </View>
  )
}

// What the region and its items are described as, under React Native Web,
// where the DOM takes a role description; React Native has none to give.
function describedAs(word: string) {
  return Platform.OS === 'web' ? { 'aria-roledescription': word } : undefined
}

function edgeOf(scrolled: number, end: number): Edge {
  'worklet'
  const atStart = scrolled <= SLACK
  const atEnd = scrolled >= end - SLACK
  if (atStart && atEnd) {
    return 'both'
  }
  if (atStart) {
    return 'start'
  }
  return atEnd ? 'end' : 'none'
}

/**
 * A right-to-left scroll view's offset counted from its other edge: from the
 * start of the text where it is from the left, and from the left where it is
 * from the start, so the one function reads an offset and writes one. `end`
 * is how much longer the content is than the view.
 *
 * iOS and Android agree on what a right-to-left scroll view reports, though
 * they get there differently. iOS turns the whole scroll view over, so its
 * own offset counts from the start, and React Native counts it from the left
 * again before handing it to `onScroll`, and back before `scrollTo`
 * (`_scrollViewMetrics` and `scrollToOffset` in
 * RCTScrollViewComponentView.mm). Android's is the view's own `scrollX`,
 * which is from the left and starts at the far end, so the start shows first
 * (ReactHorizontalScrollView.kt). So on both an event's offset and the one
 * `scrollTo` takes are from the left, while `snapToOffsets` is read from the
 * start on both: Android turns its offsets round where it flings, and iOS
 * compares them with its own turned-over offset. React Native Web reports no
 * right-to-left layout through I18nManager, so there nothing is turned.
 */
function fromStart(offset: number, end: number, rtl: boolean): number {
  'worklet'
  return rtl ? end - offset : offset
}

// Where the scroll view comes to rest: at every rest of a layout that masks,
// or at each uncontained item's start, as far as the row goes.
function offsetsOf(
  masked: boolean,
  steps: number,
  step: number,
  count: number,
  end: number,
): number[] | undefined {
  if (end <= 0) {
    return undefined
  }
  if (masked) {
    return Array.from({ length: steps + 1 }, (_, rest) => rest * step)
  }
  const starts = Array.from({ length: count }, (_, index) =>
    Math.min(index * step, end),
  )
  return [...new Set(starts)]
}

// Each item's place and width at every rest, which the UI thread
// interpolates between as the carousel moves. A carousel with one rest is
// given it twice, since an interpolation needs two.
function pathsOf(rests: readonly Placement[][], count: number): Path[] {
  const at = rests.length > 1 ? rests : [...rests, ...rests]
  return Array.from({ length: count }, (_, index) => ({
    rests: at.map((_placed, rest) => rest),
    starts: at.map((placed) => placed[index]?.left ?? 0),
    widths: at.map((placed) => placed[index]?.width ?? 0),
  }))
}

function slotWidthOf(slot: null | Slot): undefined | ViewStyle {
  return slot === null ? undefined : { width: slot.large }
}

// Where a layout that masks draws an item as the carousel scrolls: moved
// along by as much as it has scrolled, which holds it against what shows,
// then from its slot to where the arrangement places it, at the width it is
// drawn at. Physical, since a transform is: a right-to-left row is laid out
// from the right, so there the item moves the other way.
function useDrawn(slot: null | Slot) {
  const path = slot?.path
  const scrolled = slot?.scrolled
  const index = slot?.index ?? 0
  const large = slot?.large ?? 0
  const step = slot?.step ?? 0
  const rtl = slot?.rtl ?? false

  return useAnimatedStyle(() => {
    'worklet'
    if (path === undefined || scrolled === undefined) {
      return {}
    }
    const offset = scrolled.get()
    const position = offset / step
    const start = interpolate(
      position,
      path.rests,
      path.starts,
      Extrapolation.CLAMP,
    )
    const width = interpolate(
      position,
      path.rests,
      path.widths,
      Extrapolation.CLAMP,
    )
    const shift = offset + start + width / 2 - index * step - large / 2
    return { transform: [{ translateX: rtl ? -shift : shift }], width }
  })
}

// A layout handler handing the width it reports to `onMeasure`. Built by a
// call rather than written inline, which is what react-perf's
// jsx-no-new-function-as-prop is after; the React Compiler memoises it.
function widthTo(onMeasure: (width: number) => void) {
  return (event: LayoutChangeEvent) => {
    onMeasure(event.nativeEvent.layout.width)
  }
}

Carousel.Item = CarouselItem

export { Carousel, CarouselItem }
export type { CarouselItemProps, CarouselLayout, CarouselProps }
