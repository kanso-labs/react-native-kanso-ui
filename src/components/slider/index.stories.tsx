import type { Decorator, Meta, StoryObj } from '@storybook/react'
import type { ColorValue, ViewStyle } from 'react-native'

import { StyleSheet, View } from 'react-native'

import { Slider } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'

// Hoisted so each is one stable array per render rather than a fresh one,
// which is what react-perf's no-new-array-as-prop is after.
const RANGE = [20, 60]
const THUMB_LABELS = ['Start', 'End']

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const

const styles = StyleSheet.create({
  // A slider fills its container, so the samples need a width to fill: a
  // phone's.
  phone: {
    maxWidth: '100%',
    width: 360,
  },
})

const stylesOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    // Room above for the value indicator, which stands over the handle while
    // it is dragged.
    sample: {
      paddingTop: spacing.xxxl,
    },
    // The sizes, one under another, each with room above for its value.
    sizes: {
      gap: spacing.lg,
      paddingTop: spacing.xxxl,
    },
    // Room to the start side for a vertical slider's indicator.
    vertical: {
      paddingStart: spacing.xxxl + spacing.lg,
    },
  }),
)

// The inset icon the samples draw, a plain shape of the stories' own rather
// than an icon set's, as web's is. It takes the colour and the size the
// slider hands it through useIconStyle(), as an app's own icon reads them.
function Dot() {
  const { color, size } = useIconStyle()

  return <View style={dotOf(color, size)} />
}

function dotOf(color: ColorValue | undefined, size: number): ViewStyle {
  return {
    backgroundColor: color,
    borderRadius: size / 4,
    height: size / 2,
    width: size / 2,
  }
}

// Hoisted so it is one stable element per render, which is what react-perf's
// no-jsx-as-prop is after.
const ICON = <Dot />

// A decorator rather than a wrapper in each `render`, so every story takes
// the phone's width and the room the indicator needs.
const OnAPhone: Decorator = (Story) => {
  const own = stylesOf(useTheme())

  return (
    <View style={styles.phone}>
      <View style={own.sample}>
        <Story />
      </View>
    </View>
  )
}

const meta = {
  args: {
    defaultValue: 40,
    label: 'Label',
  },
  component: Slider,
  decorators: [OnAPhone],
  title: 'Components/Slider',
} satisfies Meta<typeof Slider>

type Story = StoryObj<typeof meta>

const Default: Story = {}

const Range: Story = {
  args: {
    defaultValue: RANGE,
    thumbLabels: THUMB_LABELS,
  },
}

const Stops: Story = {
  args: {
    label: 'In steps of ten',
    showStops: true,
    step: 10,
  },
}

// Every size, the icon drawn from medium up, as the page gives it.
const Sizes: Story = {
  render: function Render() {
    const own = stylesOf(useTheme())

    return (
      <View style={own.sizes}>
        {SIZES.map((size) => (
          <Slider
            defaultValue={40}
            icon={ICON}
            key={size}
            label={size}
            size={size}
          />
        ))}
      </View>
    )
  },
}

// Its indicator stands to the start side of the handle, so the sample leaves
// room there.
const Vertical: Story = {
  args: {
    orientation: 'vertical',
  },
  render: function Render(args) {
    const own = stylesOf(useTheme())

    return (
      <View style={own.vertical}>
        <Slider {...args} />
      </View>
    )
  },
}

const Disabled: Story = {
  args: {
    isDisabled: true,
  },
}

export { Default, Disabled, Range, Sizes, Stops, Vertical }

export default meta
