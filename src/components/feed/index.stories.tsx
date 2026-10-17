import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { Feed } from '.'
import { Card } from '../card'
import { ProductIcon } from '../product-icon'
import { Stack } from '../stack'
import { Tag } from '../tag'
import { Text } from '../text'

// A mark of awkward proportions, the web story's own drawn to a PNG, inline
// so the story needs no fixture served beside it. Wide on purpose: it is what
// shows ProductIcon letterboxing rather than cropping when these are seen at
// a glance. A PNG rather than web's SVG, since React Native's `Image` draws
// no SVG.
const MARK =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAABACAYAAABMbHjfAAAGIElEQVR4nOzdX0xTVxwH8O+9LS10otY/M1IKThCFzX8TpxBwOp0i4DIXo8ZkU+OSJb7uYQ+LTs32sLk9zJdl2RKJcZlb5v5oQEbY/EcGKC7ooJqFPxb5oyIIgm2h7b07twnGbMvi6Lmn1fP7vHCBkJP0/L49595zerDib5atX7NcVdWdgJKtQ89RoEwFIY8pVsN9rIY90HWPpmtl9aeq6x7+vTJ2sXLlysSAw75fUfA2+9YCQp48YR3ax8Gb/XsuXboUNH4QCcCyoqIFqqp/y76bC0KecGxUuKyH1TfqKyuvqMYPFEt4GxU/kQWbEi2M1Lxx/UJRUZ5q0WvYUKCCEEnogKaHlcVWi6ptZzmg4idSMd7wFVXbrbIkLAIhEmK1P8/Kvs4DITJSWAAURZkEQiTEboZn0NyfSI0CQKRGASBSowAQqVEAiNQoAERqFAAiNSsESVAtWJKehhWZmUifMhUTk5IwKTHRWI3DYMCPe/4AOvr7cLalBQ1eL8KaBkLMpuSVrNNhomS7HVtzc1H83Hw4bLZH+pvhkRFUNjfhWEMDhtg1IWYxLQBWi4pX5i/EtqW5SE5MwngMsZHhqwsXcbLpCkJhGhEIf6YEwJFgw96SEix2u8HDb21tOFhVBV9wFITwxP0mOHWyE4c2b+FW/Ib82bNxaMtmuJ2TQQhPXAMwMSkRBzaUwj3FCd7czinYV7KB3TiPbzpFyL/hFgCLqmI/K1DXZP7FPybV6cR7bGpltEUID9wqadOixciZORNmezYlJdIWITxwWQcwpiVb2dMeUbbkLsXPVz0Y8PvBW1ZGJlatKERqigtuFraJyckg5rk3NIQb3d3o6urEr+dr8GdrC0SyuLMy9yFKbxUURt6ZRbFZLZEnTfXXr4MXW0ICtm3ajN1v7sIcdtP99LRpsLM1DGIu4zU2XuuMZ2azN54VsNvsaL52Dbpu6vLUA1FPgZ5ii1trc7Ih2svZOZG2eUhnT6w+ef8DbCyl+4tYMl7710pLcXD/gUifiBB1by9MTUWCRdiOigeMUcBom4fCvHy4BNy/kEczKy0t0iciRB2A3LR0xAqPtudmZuLV4mKQ+GL0iYhRIOoAZEyfjljh0faqggKoNO2JO0afrF+9GmaLeu7idDgQKzzanpUeuxGM/DfXTPMfrHAIwFOIFR5ti3iRyfi4Usy/L5N+7A/SBjupRR2Au777iBUebbd3dIDEJxF9wyEAPsQKj7bbvRSAeCWib6IOQGtvL2KFR9u/nD2DYCgEEl/8gQCqz5yG2aIOQEOHF7FifFAmWj23buGb74+DxJevj3+Hm7dvw2xRB+ByZydGQ2GIFgyH0Nh1Azz8WF6ONo77ikh02r1eVFRVQYSoN8MFw2FMnzABWTNmQKTK5mbUtreDB2Pb1ZmaGqgWC7LYyrCqKCDiGSeB/FRegU8//wyhsJg3VS6fCXYmOXBkxw7YrGL2BI2yOfvrZYdN2w79UmEBXK5U2g4twNh26M7uLpw+d174dmguFXvX70N5UxM2LhLzz2Z+uNxoSvEbjA4Q3QkkdrgthB2pq0Nb7x2Y7WpPD45euABCeOAWAOPIkj0nT6B3aBhm6RoYwN7yk5EpECE8cN0Kcef+cCQE90f4by8YZNOsd0+ciByhSAgv3PcCtffdwfYjZfD0dIOX3290YNfRo+gZHAAhPJl2NKLCHiWunZeNnfl54961OeDzoayuFpUej7DPiBK5mH44rsOWgK25S7Fh/oL/dThuedMfONZwEb7RIAgxi+kBGGMcj/58ehpeZAtNaZHj0RMjx6kYS06DgQCb2/vh7e/DuZYWXKTj0YkgwgJASDyiD8MSqVEAiNQoAERqFAAiNQoAkRoFgEiNAkCkpurQb4EQCRm1rypQGkGIhIzaZyOARgEgUjJqX1VC6pc6QOcDEsnow6oW/sLS2dra75qTEVIUZQ0IkYbyTm1F9amx8z/UvOJ1DWxSRP9+kTz5dL2xtqJqCbvSxh6DanbfSD6bE33IrsWfckWIGGFdx0d232geu47st//HCVDL1q9ZrirqDihKDntMlMPulKeCkMcUq+E+VsMednVV07TD9aeq6x7+/V8AAAD//xGOqLIAAAAGSURBVAMAi4Prv4kde7cAAAAASUVORK5CYII='

const ITEMS = [
  { label: 'First item', supporting: 'Supporting line' },
  {
    label: 'Second item',
    supporting:
      'A longer supporting line, to show a card growing to its content',
  },
  { label: 'Third item', supporting: 'Supporting line' },
  { label: 'Fourth item', supporting: 'Supporting line' },
  { label: 'Fifth item', supporting: 'Supporting line' },
  { label: 'Sixth item', supporting: 'Supporting line' },
]

const ITEM_MIN_WIDTH = 260

const styles = StyleSheet.create({
  // A card fills its cell, so every card in a line is as tall as the
  // tallest, as a grid's cells are.
  fill: {
    flexGrow: 1,
  },
  narrow: {
    width: 300,
  },
  wide: {
    width: 640,
  },
})

function ItemCard({
  label,
  supporting,
}: {
  readonly label: string
  readonly supporting: string
}) {
  return (
    <Card style={styles.fill} variant="outlined">
      <Stack align="start" gap="xs">
        <Stack align="center" direction="row" gap="md">
          <ProductIcon name={label} size="sm" src={MARK} />
          <Text variant="titleSmall">{label}</Text>
        </Stack>
        <Text tone="muted" variant="bodySmall">
          {supporting}
        </Text>
        <Tag tone="neutral" variant="outlined">
          Label
        </Tag>
      </Stack>
    </Card>
  )
}

// The items as elements, each a cell of the feed's. A component listing them
// would be one item to the feed, which lays out the elements it is handed.
function itemsOf(count = ITEMS.length) {
  return ITEMS.slice(0, count).map((item) => (
    <ItemCard key={item.label} {...item} />
  ))
}

const meta = {
  args: {
    children: itemsOf(),
    minItemWidth: ITEM_MIN_WIDTH,
  },
  component: Feed,
  title: 'Components/Feed',
} satisfies Meta<typeof Feed>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// Its own story because a single column is the arrangement most of the
// argument is about, and the default width never reaches it.
const SingleColumn: Story = {
  args: {
    children: itemsOf(3),
    minItemWidth: '100%',
  },
}

// Its own story because the grid answers to the room it is given rather than
// to the width of the window, so a feed inside a pane reflows with the pane:
// the same feed and cell minimum, in containers of different widths.
const ContainerWidths: Story = {
  render: () => (
    <Stack gap="lg">
      <View style={styles.wide}>
        <Feed minItemWidth={ITEM_MIN_WIDTH}>{itemsOf(4)}</Feed>
      </View>
      <View style={styles.narrow}>
        <Feed minItemWidth={ITEM_MIN_WIDTH}>{itemsOf(2)}</Feed>
      </View>
    </Stack>
  ),
}

// Its own story because two items in a line with room for more stay the
// width of a cell rather than stretching to share the line, so a short feed
// reads as the start of a longer one.
const ShortRow: Story = {
  args: {
    children: itemsOf(2),
  },
}

export { ContainerWidths, Default, ShortRow, SingleColumn }

export default meta
