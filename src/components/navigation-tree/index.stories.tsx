import type { Decorator, Meta, StoryObj } from '@storybook/react'
import type { ColorValue, ViewStyle } from 'react-native'

import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import type { NavigationTreeProps } from '.'

import { NavigationTree } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { RouterProvider } from '../../router'
import { Card } from '../card'

// Plain shapes rather than an icon set, so the stories show the drawer
// alone, as web's do. Each is a view in the colour and in a box of the size
// the row hands it through useIconStyle(), as an app's own icon reads them.
type Shape = 'circle' | 'square' | 'triangle'

const styles = StyleSheet.create({
  // The navigation drawer page's own container width.
  width: {
    width: 360,
  },
})

function Icon({ shape }: { readonly shape: Shape }) {
  const { color, size } = useIconStyle()

  return (
    <View style={boxOf(size)}>
      <View style={shapeOf(shape, color, size)} />
    </View>
  )
}

// Hoisted so each is one stable value per render, which is what react-perf's
// rules are after.
const CIRCLE = <Icon shape="circle" />
const SQUARE = <Icon shape="square" />
const TRIANGLE = <Icon shape="triangle" />

const OPEN = ['first', 'second']

// A tree reads its parts straight off its children, so the rows are an array
// of elements rather than a fragment, which it would not look inside: a row
// with a row under it, which has one of its own, and a row on its own.
const ROWS = [
  <NavigationTree.Item href="/first" id="first" key="first" label="First item">
    <NavigationTree.Item href="/second" id="second" label="Second item">
      <NavigationTree.Item href="/third" id="third" label="Third item" />
    </NavigationTree.Item>
    <NavigationTree.Item href="/fourth" id="fourth" label="Fourth item" />
  </NavigationTree.Item>,
  <NavigationTree.Item
    href="/fifth"
    id="fifth"
    key="fifth"
    label="Fifth item"
  />,
]

// An outlined card with no padding, so each sample has an edge and the
// drawer page's width. A decorator rather than a `render`, which leaves the
// stories below nothing but `args`, and so every prop live in the Controls
// panel.
const Framed: Decorator = (Story) => (
  <View style={styles.width}>
    <Card padding="none" variant="outlined">
      <Story />
    </Card>
  </View>
)

const meta = {
  args: {
    'aria-label': 'Label',
    children: ROWS,
    defaultExpandedKeys: OPEN,
    selectedRoute: '/third',
  },
  component: NavigationTree,
  decorators: [Framed],
  // The device Storybook draws a story in a scroll view of its own, which a
  // tree scrolling by itself must not sit inside, so these opt out of it.
  parameters: { scrolls: true },
  // The router's part, played by the story: a press on a row makes its
  // `href` the route, so the pill moves to it. Keyed on the route the
  // Controls panel sets, which starts it again from there.
  render: (args) => <Navigated key={String(args.selectedRoute)} {...args} />,
  title: 'Components/NavigationTree',
} satisfies Meta<typeof NavigationTree<object>>

type Story = StoryObj<typeof meta>

// The icon's own box, at the size it is handed, which the shape is centred
// in as a glyph is in an icon font's square.
function boxOf(size: number): ViewStyle {
  return {
    alignItems: 'center',
    height: size,
    justifyContent: 'center',
    width: size,
  }
}

function Navigated({ selectedRoute, ...props }: NavigationTreeProps) {
  const [route, setRoute] = useState(selectedRoute)

  return (
    <RouterProvider navigate={setRoute}>
      <NavigationTree {...props} selectedRoute={route} />
    </RouterProvider>
  )
}

function shapeOf(
  shape: Shape,
  color: ColorValue | undefined,
  size: number,
): ViewStyle {
  const side = (size * 2) / 3
  const shapes: Readonly<Record<Shape, ViewStyle>> = {
    circle: {
      backgroundColor: color,
      borderRadius: side / 2,
      height: side,
      width: side,
    },
    square: {
      backgroundColor: color,
      borderRadius: 2,
      height: side * 0.875,
      width: side * 0.875,
    },
    // Drawn with borders, the one shape a view has no corner for.
    triangle: {
      borderBottomColor: color,
      borderBottomWidth: side,
      borderLeftColor: 'transparent',
      borderLeftWidth: side / 2 + 1,
      borderRightColor: 'transparent',
      borderRightWidth: side / 2 + 1,
      height: 0,
      width: 0,
    },
  }

  return shapes[shape]
}

// Two levels open, each set in by its chevron's width. The current row sits
// on the drawer's pill, and the two rows above it carry its trail in bold.
const Default: Story = {}

// Its own story because a page's drawer has icons, and the leading slot is
// what makes the rows line up against them, after each row's chevron or its
// space.
const WithIcons: Story = {
  args: {
    children: [
      <NavigationTree.Item
        href="/first"
        id="first"
        key="first"
        label="First item"
        leading={CIRCLE}
      >
        <NavigationTree.Item
          href="/second"
          id="second"
          label="Second item"
          leading={SQUARE}
        >
          <NavigationTree.Item
            href="/third"
            id="third"
            label="Third item"
            leading={TRIANGLE}
          />
        </NavigationTree.Item>
        <NavigationTree.Item
          href="/fourth"
          id="fourth"
          label="Fourth item"
          leading={CIRCLE}
        />
      </NavigationTree.Item>,
      <NavigationTree.Item
        href="/fifth"
        id="fifth"
        key="fifth"
        label="Fifth item"
        leading={SQUARE}
      />,
    ],
  },
}

// Its own story because a section is a part of its own rather than a prop on
// a row: it names a group, and its heading takes the label's own role, so
// colour and room set it apart rather than size.
const Sections: Story = {
  args: {
    children: [
      <NavigationTree.Section header="Headline" id="one" key="one">
        <NavigationTree.Item href="/first" id="first" label="First item" />
        <NavigationTree.Item href="/second" id="second" label="Second item" />
      </NavigationTree.Section>,
      <NavigationTree.Section header="Headline" id="two" key="two">
        <NavigationTree.Item href="/third" id="third" label="Third item" />
      </NavigationTree.Section>,
    ],
    selectedRoute: '/second',
  },
}

export { Default, Sections, WithIcons }

export default meta
