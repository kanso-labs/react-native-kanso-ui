import type { Meta, StoryObj } from '@storybook/react'
import type { ColorValue, ViewStyle } from 'react-native'

import { StyleSheet, View } from 'react-native'

import { ButtonGroup } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { Button } from '../button'
import { IconButton } from '../icon-button'

// Hoisted so the keys are not a new array on every render, which is what
// react-perf's no-new-array-as-prop is after.
const SECOND = ['second']

const styles = StyleSheet.create({
  column: {
    alignItems: 'flex-start',
    gap: 16,
  },
})

type Shape = 'circle' | 'square' | 'triangle'

// Plain shapes rather than an icon set, so the stories show the group alone,
// as web's do: a circle, a rounded square and a triangle, drawn as views in
// the colour and at the size the button hands them through useIconStyle(),
// as an app's own icon reads them.
function ShapeIcon({ shape }: { readonly shape: Shape }) {
  const { color, size } = useIconStyle()

  return <View style={shapeOf(shape, color, size)} />
}

function shapeOf(
  shape: Shape,
  color: ColorValue | undefined,
  size: number,
): ViewStyle {
  const edge = (size * 2) / 3

  if (shape === 'triangle') {
    return {
      borderBottomColor: color,
      borderBottomWidth: edge,
      borderLeftColor: 'transparent',
      borderLeftWidth: (size * 3) / 8,
      borderRightColor: 'transparent',
      borderRightWidth: (size * 3) / 8,
      height: 0,
      width: 0,
    }
  }

  return {
    backgroundColor: color,
    borderRadius: shape === 'circle' ? edge / 2 : size / 12,
    height: shape === 'circle' ? edge : (size * 7) / 12,
    width: shape === 'circle' ? edge : (size * 7) / 12,
  }
}

const BUTTONS = (
  <>
    <Button id="first" variant="tonal">
      First item
    </Button>
    <Button id="second" variant="tonal">
      Second item
    </Button>
    <Button id="third" variant="tonal">
      Third item
    </Button>
  </>
)

const ICON_BUTTONS = [
  <IconButton aria-label="First item" id="first" key="first" variant="filled">
    <ShapeIcon shape="circle" />
  </IconButton>,
  <IconButton
    aria-label="Second item"
    id="second"
    key="second"
    variant="filled"
  >
    <ShapeIcon shape="square" />
  </IconButton>,
  <IconButton aria-label="Third item" id="third" key="third" variant="filled">
    <ShapeIcon shape="triangle" />
  </IconButton>,
]

const meta = {
  args: {
    'aria-label': 'Label',
    children: BUTTONS,
  },
  component: ButtonGroup,
  title: 'Components/ButtonGroup',
} satisfies Meta<typeof ButtonGroup>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// The connected group selecting one of its buttons.
const Connected: Story = {
  args: {
    defaultSelectedKeys: SECOND,
    selectionMode: 'single',
    variant: 'connected',
  },
}

// Its own story because the buttons are of another kind: a group takes
// IconButtons as readily as Buttons, standard or connected, and gives them
// the size it names.
const IconButtons: Story = {
  render: () => (
    <View style={styles.column}>
      <ButtonGroup aria-label="First label" size="lg">
        {ICON_BUTTONS}
      </ButtonGroup>
      <ButtonGroup
        aria-label="Second label"
        selectionMode="multiple"
        shape="square"
        variant="connected"
      >
        {ICON_BUTTONS}
      </ButtonGroup>
    </View>
  ),
}

export { Connected, Default, IconButtons }

export default meta
