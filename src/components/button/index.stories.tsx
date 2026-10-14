import type { Decorator, Meta, StoryObj } from '@storybook/react'
import type { ReactNode } from 'react'

import { StyleSheet, View } from 'react-native'

import { Button } from '.'
import { PlusGlyph } from '../../glyphs'
import { Stack } from '../stack'

const SIZES = ['xs', 'md', 'lg', 'xl', 'xxl'] as const

const VARIANTS = ['filled', 'tonal', 'elevated', 'outlined', 'text'] as const

const styles = StyleSheet.create({
  // Holds each story's buttons at their own width rather than stretching
  // them across the canvas, as any view in a React Native column is.
  hug: {
    alignItems: 'flex-start',
  },
  // Narrower than the long labels on one line, so they wrap.
  narrow: {
    maxWidth: '100%',
    width: 240,
  },
})

// A column that stretches what it holds, as a form's footer or a sheet's
// actions do, and narrower than the long label.
function Column({ children }: { readonly children: ReactNode }) {
  return (
    <Stack gap="lg" style={styles.narrow}>
      {children}
    </Stack>
  )
}

// The library's own plus, which reads the colour and size the button's slot
// hands it through useIconStyle(), as an app's own icon does. Hoisted so it is
// one stable element per render, which is what react-perf's no-jsx-as-prop is
// after.
const PLUS = <PlusGlyph />

const Hugged: Decorator = (Story) => (
  <View style={styles.hug}>
    <Story />
  </View>
)

const meta = {
  args: {
    children: 'Label',
  },
  component: Button,
  decorators: [Hugged],
  title: 'Components/Button',
} satisfies Meta<typeof Button>

type Story = StoryObj<typeof meta>

const Default: Story = {}

const Elevated: Story = {
  args: { variant: 'elevated' },
}

const Square: Story = {
  args: { shape: 'square' },
}

// A toggle, selected: the tonal pair moved to secondary, and the pill traded
// for the square corner.
const Toggle: Story = {
  args: { defaultSelected: true, variant: 'tonal' },
}

// The five variants side by side, each drawn disabled beneath: on-surface at
// the page's two disabled opacities, over whatever the button sits on, and
// without the elevated button's shadow.
const Variants: Story = {
  render: () => (
    <Stack gap="lg">
      <Stack direction="row" gap="md" wrap>
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            Label
          </Button>
        ))}
      </Stack>
      <Stack direction="row" gap="md" wrap>
        {VARIANTS.map((variant) => (
          <Button isDisabled key={variant} variant={variant}>
            Label
          </Button>
        ))}
      </Stack>
    </Stack>
  ),
}

// A filled button over an outlined one with the same label at each size,
// which come out one width: the outlined rule is drawn inside the padding
// rather than beside it, so a row mixing the two lines up.
const OutlinedBesideFilled: Story = {
  render: () => (
    <Stack align="end" direction="row" gap="lg" wrap>
      {SIZES.map((size) => (
        <Stack align="start" gap="sm" key={size}>
          <Button size={size} variant="filled">
            Label
          </Button>
          <Button size={size} variant="outlined">
            Label
          </Button>
        </Stack>
      ))}
    </Stack>
  ),
}

// An icon before the label at each of the five sizes, where it takes the
// page's icon size for that size and the gap the size sets before the label.
const WithIcon: Story = {
  render: (args) => (
    <Stack align="end" direction="row" gap="lg" wrap>
      {SIZES.map((size) => (
        <Button {...args} icon={PLUS} key={size} size={size} />
      ))}
    </Stack>
  ),
}

// A label too long for the row wraps, as a translation often does at a
// phone's width, and the container grows to hold every line rather than
// keeping its height. A label on one line still draws the size's own height.
const LongLabels: Story = {
  render: () => (
    <Column>
      <Stack align="start" gap="lg">
        <Button variant="filled">
          A label long enough that it wraps onto more lines than one
        </Button>
        <Button variant="tonal">
          A label long enough that it wraps onto more lines than one
        </Button>
        <Button variant="outlined">
          A label long enough that it wraps onto more lines than one
        </Button>
      </Stack>
    </Column>
  ),
}

// A button stretched by the column it sits in, as any view in a React Native
// column is unless the column says otherwise. The label sits in the middle
// either way, and a link wraps its lines centred, as the button form does.
const FullWidth: Story = {
  render: () => (
    <Column>
      <Button variant="filled">Label</Button>
      <Button href="/label" variant="outlined">
        A label long enough that it wraps onto more lines than one
      </Button>
    </Column>
  ),
}

export {
  Default,
  Elevated,
  FullWidth,
  LongLabels,
  OutlinedBesideFilled,
  Square,
  Toggle,
  Variants,
  WithIcon,
}

export default meta
