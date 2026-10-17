import type { ComponentRef, ReactNode, Ref } from 'react'
import type { LayoutChangeEvent, ViewProps, ViewStyle } from 'react-native'

import { Children, Fragment, isValidElement, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'

import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// Material Design's example minimum for an adaptive grid cell, and the only
// number the spec puts on one. It is a floor rather than a recommendation: how
// narrow a cell can get before its contents stop making sense is a property of
// the contents, which is why Material Design leaves it a parameter. Most feeds
// should say what theirs is instead of taking this.
const DEFAULT_MIN_ITEM_WIDTH = 180

// How far under its share of the line a cell starts, before it grows back to
// it. The layout rounds every box to the device's pixels, so cells summing to
// exactly the room could come out a fraction wider than it and wrap the last
// one onto a line of its own.
const ROUNDING = 0.5

// Room for rounding in the width the layout reports, so a room exactly wide
// enough for one more column is not short of it by a fraction of a dp.
const EPSILON = 1e-6

// The third of Material Design's canonical layouts, after list-detail and
// supporting pane, as kanso-ui's Feed draws it: one pane arranged into a grid
// of comparable things, described by its cell rather than by its columns.
// Compose spells it `GridCells.Adaptive(minSize)`: every column is at least
// that wide, the grid fits as many as it can, and always at least one, which
// takes the whole width even where that is narrower than the minimum.
//
// React Native has no grid, so the feed works out the column count itself
// from the room it is given, and wraps the items into lines of that many
// equal cells. The last line is filled out with empty cells, which is web's
// `auto-fill` rather than `auto-fit`: two items in a line with room for four
// stay a cell wide rather than stretching to share it. Every cell of a line is
// as tall as its tallest item, as grid cells are.
//
// The room is the width of the grid inside the feed's own padding, which the
// layout reports once the feed has drawn, so a feed inside a pane reflows
// with the pane rather than with the window. Before that report arrives the
// first render guesses the window's width, the room a feed most often has.
//
// Every cell is a child of the one grid, so an item keeps its place in the
// tree, and whatever state it holds, as the column count changes.
//
// It virtualises nothing, as on web: every item is drawn whether or not it is
// on screen. A feed of hundreds of items is a `FlatList` with `numColumns`,
// which draws only what can be seen.
const styles = StyleSheet.create({
  // A cell grows back to its share of the line from under it, and shrinks
  // past its content rather than overflowing the line.
  cell: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  // The grid spans the feed's content box, whatever the feed aligns its
  // content to, since its width is the room the columns are counted in.
  grid: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})

const stylesOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    // The gap between lines and the one between cells, which web's grid
    // spells `gap: spacing.xl` for both.
    grid: {
      columnGap: spacing.xl,
      rowGap: spacing.xl,
    },
  }),
)

type Cell = {
  readonly item?: ReturnType<typeof Children.toArray>[number]
  readonly key: string
}

type FeedProps = Omit<ViewProps, 'children'> & {
  /**
   * The items, each laid into a cell of its own. An element is one item,
   * whatever it renders, so hand the feed the items themselves rather than a
   * component listing them; a fragment counts as the items it holds. A cell
   * is as tall as the tallest item in its line, and an item that should fill
   * that height, as a card in a grid does, sets `flexGrow: 1`.
   */
  readonly children?: ReactNode
  /**
   * How narrow a cell may get before the grid drops a column, in dp or as a
   * share of the room the feed is given. Every column is at least this wide
   * and the grid fits as many as the room allows, which is how Material
   * Design describes an adaptive grid: by its cell rather than by a column
   * count per window size. Given less room than this, the one column takes
   * the room it is given rather than overflowing it.
   *
   * Worth setting. The default is the figure Material Design's own example
   * uses, and it is a floor rather than advice: only the contents know how
   * narrow they can go.
   * @default 180
   */
  readonly minItemWidth?: `${number}%` | number
  readonly ref?: Ref<ComponentRef<typeof View>>
}

// The items as cells, the last line filled out with empty ones.
function cellsOf(children: ReactNode, columns: number) {
  const cells = itemsOf(children, '')
  for (let at = cells.length; at % columns !== 0; at += 1) {
    cells.push({ key: `empty-${at}` })
  }
  return cells
}

/**
 * How many columns of at least `minItemWidth` fit in `room` with `gap`
 * between them, as `repeat(auto-fill, minmax(min(…, 100%), 1fr))` counts
 * them, and never fewer than one.
 */
function columnsOf(
  room: number,
  minItemWidth: NonNullable<FeedProps['minItemWidth']>,
  gap: number,
) {
  const least =
    typeof minItemWidth === 'number'
      ? minItemWidth
      : (room * Number.parseFloat(minItemWidth)) / 100
  const cell = Math.min(least, room)
  return Math.max(1, Math.floor((room + gap) / (cell + gap) + EPSILON))
}

/**
 * Material Design's feed layout: a grid of comparable items that fits as many
 * columns as the room allows, down to a single column when it allows only
 * one.
 *
 * ```tsx
 * <Feed minItemWidth={260}>
 *   {items.map((item) => (
 *     <Card key={item.id} style={FILL}>…</Card>
 *   ))}
 * </Feed>
 * ```
 *
 * Layout only: it paints no surface. Each element it is handed sits in a
 * cell of the feed's, which is what sizes it: a fragment counts as the items
 * it holds and `null` as none, while a component counts as one item whatever
 * it renders, since a grid on native sees elements rather than what they
 * draw.
 *
 * It reads the room it is in rather than the width of the window, so a feed
 * inside a pane reflows with the pane.
 *
 * `style`, `ref` and `testID` land on the outer `View`, and a `style` there
 * applies over the feed's own.
 */
function Feed({
  children,
  minItemWidth = DEFAULT_MIN_ITEM_WIDTH,
  style,
  ...props
}: FeedProps) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const dimensions = useWindowDimensions()
  const [measured, setMeasured] = useState<number>()
  const room = measured ?? dimensions.width
  const gap = theme.spacing.xl
  const columns = columnsOf(room, minItemWidth, gap)
  const share = shareOf(room, columns, gap)

  return (
    <View {...props} style={style}>
      <View
        onLayout={widthTo(setMeasured)}
        style={composeStyles<ViewStyle>(styles.grid, own.grid)}
      >
        {cellsOf(children, columns).map(({ item, key }) => (
          <View key={key} style={composeStyles<ViewStyle>(styles.cell, share)}>
            {item}
          </View>
        ))}
      </View>
    </View>
  )
}

// Each item as a cell, with a fragment's items in its place, as a grid on web
// lays out what a fragment holds rather than the fragment. A cell takes the
// key `Children.toArray` gives its element under the keys of the fragments
// around it, or its place for a bare string or number, which takes none.
function itemsOf(children: ReactNode, within: string): Cell[] {
  return Children.toArray(children).flatMap((item, at) => {
    if (!isValidElement<{ children?: ReactNode }>(item)) {
      return [{ item, key: `${within}item-${at}` }]
    }
    const key = `${within}${item.key ?? `item-${at}`}`
    return item.type === Fragment
      ? itemsOf(item.props.children, key)
      : [{ item, key }]
  })
}

/**
 * A cell's share of a line as a style: an equal part of the room left after
 * the gaps, less the rounding the cells grow back from.
 */
function shareOf(room: number, columns: number, gap: number): ViewStyle {
  const share = (room - gap * (columns - 1)) / columns
  return { flexBasis: Math.max(0, share - ROUNDING) }
}

// A layout handler handing the width it reports to `onMeasure`. Built by a
// call rather than written inline, which is what react-perf's
// jsx-no-new-function-as-prop is after; the React Compiler memoises it.
function widthTo(onMeasure: (width: number) => void) {
  return (event: LayoutChangeEvent) => {
    onMeasure(event.nativeEvent.layout.width)
  }
}

export type { FeedProps }

export { Feed }
