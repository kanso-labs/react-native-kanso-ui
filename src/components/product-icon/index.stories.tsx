import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { ProductIcon } from '.'
import { Avatar } from '../avatar'
import { Card } from '../card'
import { Stack } from '../stack'
import { Text } from '../text'

// Two marks of deliberately awkward proportions, the web stories' own drawn
// to PNGs, inline so the stories need no fixture served beside them. The
// wide one is what makes `contain` visible: cropped to fill the square it
// would lose its ends, which for a real wordmark means losing the word. PNGs
// rather than web's SVGs, since React Native's `Image` draws no SVG.
const WIDE_MARK =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAABACAYAAABMbHjfAAAGIElEQVR4nOzdX0xTVxwH8O+9LS10otY/M1IKThCFzX8TpxBwOp0i4DIXo8ZkU+OSJb7uYQ+LTs32sLk9zJdl2RKJcZlb5v5oQEbY/EcGKC7ooJqFPxb5oyIIgm2h7b07twnGbMvi6Lmn1fP7vHCBkJP0/L49595zerDib5atX7NcVdWdgJKtQ89RoEwFIY8pVsN9rIY90HWPpmtl9aeq6x7+vTJ2sXLlysSAw75fUfA2+9YCQp48YR3ax8Gb/XsuXboUNH4QCcCyoqIFqqp/y76bC0KecGxUuKyH1TfqKyuvqMYPFEt4GxU/kQWbEi2M1Lxx/UJRUZ5q0WvYUKCCEEnogKaHlcVWi6ptZzmg4idSMd7wFVXbrbIkLAIhEmK1P8/Kvs4DITJSWAAURZkEQiTEboZn0NyfSI0CQKRGASBSowAQqVEAiNQoAERqFAAiNSsESVAtWJKehhWZmUifMhUTk5IwKTHRWI3DYMCPe/4AOvr7cLalBQ1eL8KaBkLMpuSVrNNhomS7HVtzc1H83Hw4bLZH+pvhkRFUNjfhWEMDhtg1IWYxLQBWi4pX5i/EtqW5SE5MwngMsZHhqwsXcbLpCkJhGhEIf6YEwJFgw96SEix2u8HDb21tOFhVBV9wFITwxP0mOHWyE4c2b+FW/Ib82bNxaMtmuJ2TQQhPXAMwMSkRBzaUwj3FCd7czinYV7KB3TiPbzpFyL/hFgCLqmI/K1DXZP7FPybV6cR7bGpltEUID9wqadOixciZORNmezYlJdIWITxwWQcwpiVb2dMeUbbkLsXPVz0Y8PvBW1ZGJlatKERqigtuFraJyckg5rk3NIQb3d3o6urEr+dr8GdrC0SyuLMy9yFKbxUURt6ZRbFZLZEnTfXXr4MXW0ICtm3ajN1v7sIcdtP99LRpsLM1DGIu4zU2XuuMZ2azN54VsNvsaL52Dbpu6vLUA1FPgZ5ii1trc7Ih2svZOZG2eUhnT6w+ef8DbCyl+4tYMl7710pLcXD/gUifiBB1by9MTUWCRdiOigeMUcBom4fCvHy4BNy/kEczKy0t0iciRB2A3LR0xAqPtudmZuLV4mKQ+GL0iYhRIOoAZEyfjljh0faqggKoNO2JO0afrF+9GmaLeu7idDgQKzzanpUeuxGM/DfXTPMfrHAIwFOIFR5ti3iRyfi4Usy/L5N+7A/SBjupRR2Au777iBUebbd3dIDEJxF9wyEAPsQKj7bbvRSAeCWib6IOQGtvL2KFR9u/nD2DYCgEEl/8gQCqz5yG2aIOQEOHF7FifFAmWj23buGb74+DxJevj3+Hm7dvw2xRB+ByZydGQ2GIFgyH0Nh1Azz8WF6ONo77ikh02r1eVFRVQYSoN8MFw2FMnzABWTNmQKTK5mbUtreDB2Pb1ZmaGqgWC7LYyrCqKCDiGSeB/FRegU8//wyhsJg3VS6fCXYmOXBkxw7YrGL2BI2yOfvrZYdN2w79UmEBXK5U2g4twNh26M7uLpw+d174dmguFXvX70N5UxM2LhLzz2Z+uNxoSvEbjA4Q3QkkdrgthB2pq0Nb7x2Y7WpPD45euABCeOAWAOPIkj0nT6B3aBhm6RoYwN7yk5EpECE8cN0Kcef+cCQE90f4by8YZNOsd0+ciByhSAgv3PcCtffdwfYjZfD0dIOX3290YNfRo+gZHAAhPJl2NKLCHiWunZeNnfl54961OeDzoayuFpUej7DPiBK5mH44rsOWgK25S7Fh/oL/dThuedMfONZwEb7RIAgxi+kBGGMcj/58ehpeZAtNaZHj0RMjx6kYS06DgQCb2/vh7e/DuZYWXKTj0YkgwgJASDyiD8MSqVEAiNQoAERqFAAiNQoAkRoFgEiNAkCkpurQb4EQCRm1rypQGkGIhIzaZyOARgEgUjJqX1VC6pc6QOcDEsnow6oW/sLS2dra75qTEVIUZQ0IkYbyTm1F9amx8z/UvOJ1DWxSRP9+kTz5dL2xtqJqCbvSxh6DanbfSD6bE33IrsWfckWIGGFdx0d232geu47st//HCVDL1q9ZrirqDihKDntMlMPulKeCkMcUq+E+VsMednVV07TD9aeq6x7+/V8AAAD//xGOqLIAAAAGSURBVAMAi4Prv4kde7cAAAAASUVORK5CYII='

const TALL_MARK =
  'data:image/png;base64,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'

const styles = StyleSheet.create({
  // A card wide enough for a mark, a name and a line about it, which is
  // where these mostly sit.
  wide: {
    width: 260,
  },
})

const meta = {
  args: {
    name: 'First item',
    src: WIDE_MARK,
  },
  component: ProductIcon,
  title: 'Components/ProductIcon',
} satisfies Meta<typeof ProductIcon>

type Story = StoryObj<typeof meta>

// Its own story because a mark is drawn to its own bounding box and fitted
// inside the square rather than filled to it: a wide one leaves space above
// and below, a tall one space either side, and neither loses an edge.
const AspectRatios: Story = {
  render: () => (
    <Stack align="end" direction="row" gap="lg" wrap>
      <Stack align="center" gap="xs">
        <ProductIcon name="First item" size="lg" src={WIDE_MARK} />
        <Text tone="muted" variant="labelSmall">
          wide
        </Text>
      </Stack>
      <Stack align="center" gap="xs">
        <ProductIcon name="Second item" size="lg" src={TALL_MARK} />
        <Text tone="muted" variant="labelSmall">
          tall
        </Text>
      </Stack>
    </Stack>
  ),
}

// Its own story because the two only read against each other: handed the
// same wide image, ProductIcon letterboxes it in a rounded square where
// Avatar crops it to a circle, in a box of the same size, so either can lead
// a row.
const AvatarComparison: Story = {
  render: () => (
    <Stack align="end" direction="row" gap="lg" wrap>
      <Stack align="center" gap="xs">
        <ProductIcon name="First item" src={WIDE_MARK} />
        <Text tone="muted" variant="labelSmall">
          ProductIcon
        </Text>
      </Stack>
      <Stack align="center" gap="xs">
        <Avatar name="Ada Lovelace" src={WIDE_MARK} />
        <Text tone="muted" variant="labelSmall">
          Avatar
        </Text>
      </Stack>
    </Stack>
  ),
}

const Default: Story = {}

// The mark beside the name of what it identifies, leading a card, which is
// where these mostly sit. It is decorative, so a screen reader reads the
// name once, from the text.
const InACard: Story = {
  render: () => (
    <View style={styles.wide}>
      <Card variant="outlined">
        <Stack align="center" direction="row" gap="md">
          <ProductIcon decorative name="First item" src={WIDE_MARK} />
          <Stack gap="xxs">
            <Text variant="titleSmall">First item</Text>
            <Text tone="muted" variant="bodySmall">
              Supporting line
            </Text>
          </Stack>
        </Stack>
      </Card>
    </View>
  ),
}

// Its own story because the fallback is the state a snapshot of the default
// never reaches: the mark covers it as soon as it loads.
const WithoutMark: Story = {
  args: {
    src: undefined,
  },
}

export { AspectRatios, AvatarComparison, Default, InACard, WithoutMark }

export default meta
