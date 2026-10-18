import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

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

const TONES = [
  { label: 'onPrimary', tile: 'primary' },
  { label: 'onSecondary', tile: 'secondary' },
  { label: 'onTertiary', tile: 'tertiary' },
] as const

function Tile({
  index,
  label,
}: {
  readonly index: number
  readonly label: string
}) {
  const tiles = tilesOf(useTheme())
  const tone = TONES[index % TONES.length] ?? TONES[0]
  return (
    <View style={StyleSheet.compose(tiles.tile, tiles[tone.tile])}>
      <Text numberOfLines={1} style={tiles[tone.label]} variant="titleMedium">
        {label}
      </Text>
    </View>
  )
}

const ITEMS = LABELS.map((label, index) => (
  <Carousel.Item key={label}>
    <Tile index={index} label={label} />
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
