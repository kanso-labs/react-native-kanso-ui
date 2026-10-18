import type { ComponentRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { TestInstance, TestNode } from 'test-renderer'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import {
  Dimensions,
  I18nManager,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { CarouselLayout, CarouselProps } from '.'

import { Carousel } from '.'
import { I18nProvider } from '../../i18n/provider'
import { scopeFor } from '../../theme/scope'

// What the next carousel the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

const { theme } = scopeFor('light', {})
const PADDING = theme.spacing.lg

// A call site's style, over the component's own corner and gap.
const CALL_SITE = { borderRadius: 0, marginTop: 4, rowGap: 0 } as const

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

const LABELS = [
  'First item',
  'Second item',
  'Third item',
  'Fourth item',
  'Fifth item',
  'Sixth item',
]

const OS = Platform.OS

// Where the buttons scroll to: the preset's scroll view keeps `scrollTo` on
// its prototype, so one spy sees every carousel's.
let scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo')

beforeEach(() => {
  jest.useFakeTimers()
  scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo')
})

afterEach(() => {
  jest.useRealTimers()
  scrollTo.mockRestore()
  Dimensions.set(INITIAL)
  Platform.OS = OS
  mockReducedMotion = false
})

function child(node: TestNode | undefined): TestInstance {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

function contentStyleOf(view: {
  props: { contentContainerStyle?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([view.props.contentContainerStyle]) ?? {}
}

// Where item `index` is drawn, from the start of what shows: its slot's
// start, moved by the transform, less what has scrolled past, with the mask
// centred in a slot as wide as a large item.
function drawn(
  index: number,
  { large, scrolled, step }: { large: number; scrolled: number; step: number },
) {
  const style = getAnimatedStyle(item(index))
  const shift = translationOf(style)
  const along = I18nManager.isRTL ? -shift : shift
  const width = Number(style.width)
  return {
    left: index * step + large / 2 + along - width / 2 - scrolled,
    width,
  }
}

// The chevron a button draws, which turns over by its transform.
function glyphOf(button: TestInstance): TestInstance {
  return child(
    button.queryAll((each) => each.type.startsWith('RNSVGSvgView'))[0],
  )
}

function item(index: number) {
  return screen.getByTestId(`item-${index}`)
}

function items(count = LABELS.length) {
  return LABELS.slice(0, count).map((label, index) => (
    <Carousel.Item key={label} testID={`item-${index}`}>
      <Text>{label}</Text>
    </Carousel.Item>
  ))
}

// The scroll view laid out at `width`, as the platform reports it once the
// carousel has drawn.
async function layOut(width: number) {
  await fireEvent(scroller(), 'layout', {
    nativeEvent: { layout: { height: 200, width, x: 0, y: 0 } },
  })
  await act(() => {
    jest.advanceTimersByTime(0)
  })
}

function next() {
  return screen.getByRole('button', { name: 'Next slide' })
}

function previous() {
  return screen.getByRole('button', { name: 'Previous slide' })
}

async function renderCarousel(
  props: Partial<CarouselProps> = {},
  count = LABELS.length,
) {
  await render(
    <Carousel label="Label" testID="carousel" {...props}>
      {items(count)}
    </Carousel>,
  )
}

// The scroll view scrolled to `x`, as the platform reports it: from the left
// edge, whichever way the text runs.
async function scrollBy(x: number) {
  await fireEvent.scroll(scroller(), {
    nativeEvent: { contentOffset: { x, y: 0 } },
  })
  await act(() => {
    jest.advanceTimersByTime(0)
  })
}

function scroller() {
  return child(screen.getByTestId('carousel').children[0])
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

// How far an animated style moves its view along, from its transform.
function translationOf(style: ReturnType<typeof getAnimatedStyle>): number {
  const { transform } = style
  const first: unknown = Array.isArray(transform) ? transform[0] : undefined
  return typeof first === 'object' &&
    first !== null &&
    'translateX' in first &&
    typeof first.translateX === 'number'
    ? first.translateX
    : 0
}

describe('carousel', () => {
  describe('the arrangement', () => {
    // The page's multi-browse at 400dp: 368dp of room holds one large item
    // of 240dp, and what is left is a medium and a small one, both 56dp, so
    // it rests five times, 248dp apart.
    const MULTI_BROWSE = { large: 240, scrolled: 0, step: 248 }

    it('draws each item where multi-browse places it at the first rest', async () => {
      await renderCarousel()
      await layOut(400)

      expect(drawn(0, MULTI_BROWSE)).toEqual({ left: 0, width: 240 })
      expect(drawn(1, MULTI_BROWSE)).toEqual({ left: 248, width: 56 })
      expect(drawn(2, MULTI_BROWSE)).toEqual({ left: 312, width: 56 })
    })

    it('lays out more large items where they fit', async () => {
      await renderCarousel()
      await layOut(800)

      const at = { large: 240, scrolled: 0, step: 248 }
      expect(drawn(0, at)).toEqual({ left: 0, width: 240 })
      expect(drawn(1, at)).toEqual({ left: 248, width: 240 })
      expect(drawn(2, at)).toEqual({ left: 496, width: 208 })
      expect(drawn(3, at)).toEqual({ left: 712, width: 56 })
    })

    it('narrows the large item where the preferred one does not fit', async () => {
      await renderCarousel()
      await layOut(200)

      // 168dp of room holds no 240dp item, so the large one gives way to
      // what is left beside a medium item and a small one of 40dp.
      const { width } = getAnimatedStyle(item(0))
      expect(width).toBeCloseTo(61.33)
      expect(styleOf(child(item(0).parent ?? undefined)).width).toBe(width)
    })

    it('takes the preferred width from itemSize', async () => {
      await renderCarousel({ itemSize: 200 })
      await layOut(800)

      const at = { large: 200, scrolled: 0, step: 208 }
      expect(drawn(0, at)).toEqual({ left: 0, width: 200 })
      expect(drawn(1, at)).toEqual({ left: 208, width: 200 })
    })

    it('draws hero as one large item and one small', async () => {
      await renderCarousel({ layout: 'hero' })
      await layOut(400)

      const at = { large: 304, scrolled: 0, step: 312 }
      expect(drawn(0, at)).toEqual({ left: 0, width: 304 })
      expect(drawn(1, at)).toEqual({ left: 312, width: 56 })
    })

    it('draws every uncontained item at the preferred width, unmoved', async () => {
      await renderCarousel({ layout: 'uncontained' })
      await layOut(400)

      for (const index of [0, 3, 5]) {
        expect(getAnimatedStyle(item(index))).not.toHaveProperty('transform')
        expect(styleOf(child(item(index).parent ?? undefined)).width).toBe(240)
      }
    })

    it('guesses the window before its first layout', async () => {
      Dimensions.set({ ...INITIAL, window: { ...INITIAL.window, width: 800 } })
      await renderCarousel()

      const at = { large: 240, scrolled: 0, step: 248 }
      expect(drawn(1, at)).toEqual({ left: 248, width: 240 })
    })
  })

  describe('scrolling', () => {
    const AT = { large: 240, step: 248 }

    it('rests at every rest of a layout that masks', async () => {
      await renderCarousel()
      await layOut(400)

      expect(scroller().props.snapToOffsets).toEqual([
        0, 248, 496, 744, 992, 1240,
      ])
      // As long as the view and the run of rests, so it scrolls to the last.
      expect(contentStyleOf(scroller())).toMatchObject({
        overflow: 'hidden',
        width: 400 + 1240,
      })
    })

    it('rests at each uncontained item’s start, as far as the row goes', async () => {
      await renderCarousel({ layout: 'uncontained' })
      await layOut(400)

      // Six items of 240dp, five gaps and both paddings are 1512dp, which
      // scrolls 1112dp in a view of 400dp.
      expect(scroller().props.snapToOffsets).toEqual([
        0, 248, 496, 744, 992, 1112,
      ])
      expect(contentStyleOf(scroller())).not.toHaveProperty('width')
    })

    it('rests once at the end however many items start past it', async () => {
      await renderCarousel({ layout: 'uncontained' })
      await layOut(800)

      // The same row scrolls 712dp in a view of 800dp, so the last three
      // items all come to rest at its end.
      expect(scroller().props.snapToOffsets).toEqual([0, 248, 496, 712])
    })

    it('follows the room it is laid out in once the guess was wrong', async () => {
      Dimensions.set({ ...INITIAL, window: { ...INITIAL.window, width: 800 } })
      await renderCarousel({ layout: 'uncontained' }, 3)

      // Three items fit in the window, so there is nowhere to go.
      expect(next()).toBeDisabled()

      await layOut(400)
      expect(next()).toBeEnabled()
      expect(previous()).toBeDisabled()
    })

    it('does not scroll at all when everything fits', async () => {
      await renderCarousel({}, 1)
      await layOut(400)

      expect(scroller().props.snapToOffsets).toBeUndefined()
      expect(scroller().props.focusable).toBe(false)
      expect(previous()).toBeDisabled()
      expect(next()).toBeDisabled()
    })

    it('is a keyboard stop while there is anywhere to scroll', async () => {
      await renderCarousel()
      await layOut(400)

      expect(scroller().props.focusable).toBe(true)
    })

    it('draws each item at the next rest once scrolled there', async () => {
      await renderCarousel()
      await layOut(400)
      await scrollBy(248)

      const at = { ...AT, scrolled: 248 }
      expect(drawn(0, at)).toEqual({ left: -80, width: 56 })
      expect(drawn(1, at)).toEqual({ left: 0, width: 240 })
      expect(drawn(2, at)).toEqual({ left: 248, width: 56 })
    })

    it('shrinks an item as it leaves and grows the next as it arrives', async () => {
      await renderCarousel()
      await layOut(400)
      await scrollBy(124)

      const at = { ...AT, scrolled: 124 }
      expect(drawn(0, at)).toEqual({ left: -40, width: 148 })
      expect(drawn(1, at)).toEqual({ left: 124, width: 148 })
    })

    it('holds every item at the last rest past the end', async () => {
      await renderCarousel()
      await layOut(400)
      await scrollBy(1240)
      const last = drawn(5, { ...AT, scrolled: 1240 })

      await scrollBy(1400)
      expect(drawn(5, { ...AT, scrolled: 1400 })).toEqual(last)
    })
  })

  describe('previous and next', () => {
    it('points previous at the start and next at the end', async () => {
      await renderCarousel()

      expect(styleOf(glyphOf(previous())).transform).toEqual([{ scaleX: -1 }])
      expect(styleOf(glyphOf(next())).transform).toBeUndefined()
    })

    it('is disabled at the start for previous and at the end for next', async () => {
      await renderCarousel()
      await layOut(400)

      expect(previous()).toBeDisabled()
      expect(next()).toBeEnabled()

      await scrollBy(300)
      expect(previous()).toBeEnabled()
      expect(next()).toBeEnabled()

      await scrollBy(1240)
      expect(previous()).toBeEnabled()
      expect(next()).toBeDisabled()
    })

    it('counts a scroll resting a fraction short of a limit as at it', async () => {
      await renderCarousel()
      await layOut(400)

      await scrollBy(1239.6)
      expect(next()).toBeDisabled()

      await scrollBy(0.4)
      expect(previous()).toBeDisabled()
    })

    it('moves to the rest either side of the nearest one', async () => {
      await renderCarousel()
      await layOut(400)

      await fireEvent.press(next())
      expect(scrollTo).toHaveBeenLastCalledWith({ animated: true, x: 248 })

      // Nearer the third rest than the second.
      await scrollBy(400)
      await fireEvent.press(next())
      expect(scrollTo).toHaveBeenLastCalledWith({ animated: true, x: 744 })
      await fireEvent.press(previous())
      expect(scrollTo).toHaveBeenLastCalledWith({ animated: true, x: 248 })
    })

    it('stops at either end', async () => {
      await renderCarousel()
      await layOut(400)
      await scrollBy(1200)

      await fireEvent.press(next())
      expect(scrollTo).toHaveBeenLastCalledWith({ animated: true, x: 1240 })
    })

    it('moves an uncontained carousel an item along, up to its end', async () => {
      await renderCarousel({ layout: 'uncontained' })
      await layOut(400)
      await scrollBy(100)

      await fireEvent.press(next())
      expect(scrollTo).toHaveBeenLastCalledWith({ animated: true, x: 348 })
      await fireEvent.press(previous())
      expect(scrollTo).toHaveBeenLastCalledWith({ animated: true, x: 0 })

      await scrollBy(1000)
      await fireEvent.press(next())
      expect(scrollTo).toHaveBeenLastCalledWith({ animated: true, x: 1112 })
    })

    it('jumps rather than scrolls under reduced motion', async () => {
      mockReducedMotion = true
      await renderCarousel()
      await layOut(400)

      await fireEvent.press(next())
      expect(scrollTo).toHaveBeenLastCalledWith({ animated: false, x: 248 })
    })

    it('takes its labels from the call site', async () => {
      await renderCarousel({ nextLabel: 'Later', previousLabel: 'Earlier' })

      expect(screen.getByRole('button', { name: 'Earlier' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Later' })).toBeTruthy()
    })

    it('names them in the reader’s locale', async () => {
      await render(
        <I18nProvider locale="de-DE">
          <Carousel label="Label">{items()}</Carousel>
        </I18nProvider>,
      )

      expect(
        screen.getByRole('button', { name: 'Vorherige Folie' }),
      ).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Nächste Folie' })).toBeTruthy()
    })
  })

  describe('right to left', () => {
    beforeEach(() => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
    })

    it('reads an offset from the left as one from the start', async () => {
      await renderCarousel()
      await layOut(400)

      // The far left of a right-to-left row is its end.
      await scrollBy(0)
      expect(next()).toBeDisabled()
      expect(previous()).toBeEnabled()

      await scrollBy(1240)
      expect(previous()).toBeDisabled()
    })

    it('scrolls to an offset from the left', async () => {
      await renderCarousel()
      await layOut(400)
      await scrollBy(1240)

      await fireEvent.press(next())
      expect(scrollTo).toHaveBeenLastCalledWith({ animated: true, x: 992 })
    })

    it('draws each item from the right', async () => {
      await renderCarousel()
      await layOut(400)
      await scrollBy(1240 - 248)

      const at = { large: 240, scrolled: 248, step: 248 }
      expect(drawn(0, at)).toEqual({ left: -80, width: 56 })
      expect(drawn(1, at)).toEqual({ left: 0, width: 240 })
    })

    it('turns both chevrons over', async () => {
      await renderCarousel()

      expect(styleOf(glyphOf(previous())).transform).toEqual([{ scaleX: 1 }])
      expect(styleOf(glyphOf(next())).transform).toEqual([{ scaleX: -1 }])
    })
  })

  describe('accessibility', () => {
    it('is a region named by its label', async () => {
      await renderCarousel()

      // A container rather than one element, so a screen reader still
      // reaches each item and both buttons inside it.
      expect(screen.getByTestId('carousel').props).toMatchObject({
        'aria-label': 'Label',
        role: 'region',
      })
      expect(screen.getByTestId('carousel').props.accessible).toBeUndefined()
    })

    it('names each item by which of how many it is', async () => {
      await renderCarousel()

      expect(item(1).props.role).toBe('group')
      expect(item(1).props['aria-label']).toBe('2 of 6')
    })

    it('names its items in the reader’s locale', async () => {
      await render(
        <I18nProvider locale="ar-EG">
          <Carousel label="Label">{items()}</Carousel>
        </I18nProvider>,
      )

      expect(item(1).props['aria-label']).toBe('٢ من ٦')
    })

    it('keeps an item’s own name', async () => {
      await render(
        <Carousel label="Label">
          <Carousel.Item aria-label="Headline" testID="item-0">
            <Text>First item</Text>
          </Carousel.Item>
        </Carousel>,
      )

      expect(item(0).props['aria-label']).toBe('Headline')
    })

    it('describes the region and its items as web does under React Native Web', async () => {
      Platform.OS = 'web'
      await renderCarousel()

      expect(screen.getByTestId('carousel').props['aria-roledescription']).toBe(
        'carousel',
      )
      expect(item(0).props['aria-roledescription']).toBe('slide')
    })

    it('gives no role description where the platform has none', async () => {
      await renderCarousel()

      expect(screen.getByTestId('carousel').props).not.toHaveProperty(
        'aria-roledescription',
      )
      expect(item(0).props).not.toHaveProperty('aria-roledescription')
    })
  })

  describe('the item', () => {
    it('cuts what it holds to the extra-large corner', async () => {
      await renderCarousel()

      expect(getAnimatedStyle(item(0))).toMatchObject({
        borderRadius: theme.radii.xl,
        overflow: 'hidden',
      })
    })

    it('lays what it holds out at the large width', async () => {
      await renderCarousel()
      await layOut(400)

      expect(styleOf(child(item(1).children[0])).width).toBe(240)
    })

    it('is a plain clip outside a carousel', async () => {
      await render(
        <Carousel.Item testID="item-0">
          <Text>First item</Text>
        </Carousel.Item>,
      )

      expect(getAnimatedStyle(item(0))).not.toHaveProperty('transform')
      expect(item(0).props['aria-label']).toBe('1 of 1')
    })

    it('takes a style, a ref and a testID', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        <Carousel label="Label">
          <Carousel.Item ref={ref} style={CALL_SITE} testID="item-0">
            <Text>First item</Text>
          </Carousel.Item>
        </Carousel>,
      )

      expect(getAnimatedStyle(item(0))).toMatchObject(CALL_SITE)
      expect(ref.current).not.toBeNull()
    })
  })

  describe('the carousel', () => {
    it('takes a style, a ref and a testID', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await renderCarousel({ ref, style: CALL_SITE })

      expect(styleOf(screen.getByTestId('carousel'))).toMatchObject(CALL_SITE)
      expect(ref.current).not.toBeNull()
    })

    it('pads its ends and its top and bottom from the spacing scale', async () => {
      await renderCarousel()

      expect(contentStyleOf(scroller())).toMatchObject({
        columnGap: 8,
        paddingHorizontal: PADDING,
        paddingVertical: theme.spacing.sm,
      })
    })

    it.each<CarouselLayout>(['multi-browse', 'hero', 'uncontained'])(
      'names every item the same way under %s',
      async (layout) => {
        await renderCarousel({ layout })
        await layOut(400)

        expect(
          LABELS.map(
            (_label, index): unknown => item(index).props['aria-label'],
          ),
        ).toEqual(['1 of 6', '2 of 6', '3 of 6', '4 of 6', '5 of 6', '6 of 6'])
      },
    )
  })
})
