import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'

import type { CarouselItemRenderProps } from '.'

import { Carousel } from '.'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'
import { Text } from '../text'

const LABELS = [
  'First item',
  'Second item',
  'Third item',
  'Fourth item',
  'Fifth item',
  'Sixth item',
]

const tilesOf = themedStyles(({ colors, spacing }) =>
  StyleSheet.create({
    // The container pairs, in turn, so neighbouring items read apart.
    onPrimary: {
      color: colors.onPrimaryContainer,
    },
    onSecondary: {
      color: colors.onSecondaryContainer,
    },
    onTertiary: {
      color: colors.onTertiaryContainer,
    },
    primary: {
      backgroundColor: colors.primaryContainer,
    },
    secondary: {
      backgroundColor: colors.secondaryContainer,
    },
    tertiary: {
      backgroundColor: colors.tertiaryContainer,
    },
    // What an item holds: a block of colour standing in for an image, with
    // its label at the bottom, so the stories show the carousel alone.
    tile: {
      height: 200,
      justifyContent: 'flex-end',
      padding: spacing.lg,
    },
  }),
)

// How far the mask closes in before a label is gone: 16dp from each side,
// the tile's padding, so the label fades out before the mask reaches a
// letter and comes back as its item is drawn large. Material Design's
// carousel shows an item's text on its large items alone.
const FADE = 32

const TONES = [
  { label: 'onPrimary', tile: 'primary' },
  { label: 'onSecondary', tile: 'secondary' },
  { label: 'onTertiary', tile: 'tertiary' },
] as const

function Tile({
  index,
  label,
  visibleWidth,
  width,
}: CarouselItemRenderProps & {
  readonly index: number
  readonly label: string
}) {
  const tiles = tilesOf(useTheme())
  const tone = TONES[index % TONES.length] ?? TONES[0]
  const fade = useAnimatedStyle(() => {
    'worklet'
    const shown = 1 - (width - visibleWidth.get()) / FADE
    return { opacity: Math.min(Math.max(shown, 0), 1) }
  })
  return (
    <View style={StyleSheet.compose(tiles.tile, tiles[tone.tile])}>
      <Animated.View style={fade}>
        <Text numberOfLines={1} style={tiles[tone.label]} variant="titleMedium">
          {label}
        </Text>
      </Animated.View>
    </View>
  )
}

const ITEMS = LABELS.map((label, index) => (
  <Carousel.Item key={label}>
    {(state) => <Tile {...state} index={index} label={label} />}
  </Carousel.Item>
))

const meta = {
  args: {
    children: ITEMS,
    label: 'Label',
  },
  component: Carousel,
  title: 'Components/Carousel',
} satisfies Meta<typeof Carousel>

type Story = StoryObj<typeof meta>

const Default: Story = {}

const Hero: Story = {
  args: { layout: 'hero' },
}

const Uncontained: Story = {
  args: { layout: 'uncontained' },
}

export { Default, Hero, Uncontained }

export default meta
