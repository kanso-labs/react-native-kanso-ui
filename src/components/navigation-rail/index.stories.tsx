import type { Meta, StoryObj } from '@storybook/react'
import type { ColorValue, ViewStyle } from 'react-native'

import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { NavigationRail } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { IconButton } from '../icon-button'

// Plain shapes rather than an icon set, so the stories show the rail alone,
// as web's do. Each is a view in the colour and in a box of the size the
// destination hands it through useIconStyle(), as an app's own icon reads
// them.
type Shape = 'circle' | 'menu' | 'square' | 'triangle'

const styles = StyleSheet.create({
  // The rail runs the height of the row that holds it, as it would the
  // screen's.
  frame: {
    flexDirection: 'row',
    height: 440,
  },
})

const ORDINALS = [
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
]

function Icon({ shape }: { readonly shape: Shape }) {
  const { color, size } = useIconStyle()

  return (
    <View style={boxOf(size)}>
      {shape === 'menu' ? (
        <>
          <View style={barOf(color, size)} />
          <View style={barOf(color, size)} />
          <View style={barOf(color, size)} />
        </>
      ) : (
        <View style={shapeOf(shape, color, size)} />
      )}
    </View>
  )
}

// Hoisted so each is one stable element per render, which is what
// react-perf's no-jsx-as-prop is after.
const CIRCLE = <Icon shape="circle" />
const MENU = <Icon shape="menu" />
const SQUARE = <Icon shape="square" />
const TRIANGLE = <Icon shape="triangle" />

const ICONS = [CIRCLE, SQUARE, TRIANGLE]

const DESTINATIONS = (
  <>
    <NavigationRail.Item href="/first" icon={CIRCLE}>
      First item
    </NavigationRail.Item>
    <NavigationRail.Item
      aria-label="Second item, 3 new"
      badge={3}
      href="/second"
      icon={SQUARE}
    >
      Second item
    </NavigationRail.Item>
    <NavigationRail.Item href="/third" icon={TRIANGLE}>
      Third item
    </NavigationRail.Item>
  </>
)

// Ten destinations, more than the 440dp frame holds.
const TEN_DESTINATIONS = ORDINALS.map((ordinal, index) => (
  <NavigationRail.Item
    href={`/${ordinal.toLowerCase()}`}
    icon={ICONS[index % ICONS.length]}
    key={ordinal}
  >
    {`${ordinal} item`}
  </NavigationRail.Item>
))

const MENU_BUTTON = <IconButton aria-label="Menu">{MENU}</IconButton>

function barOf(color: ColorValue | undefined, size: number): ViewStyle {
  return {
    backgroundColor: color,
    borderRadius: 1,
    height: 2,
    width: (size * 2) / 3,
  }
}

// The icon's own box, at the size it is handed, which the shape is centred
// in as a glyph is in an icon font's square.
function boxOf(size: number): ViewStyle {
  return {
    alignItems: 'center',
    gap: size / 6,
    height: size,
    justifyContent: 'center',
    width: size,
  }
}

// A rail whose header holds the menu button that expands and collapses it,
// which is how the page has a reader move between the two forms.
function Expandable() {
  const [isExpanded, setExpanded] = useState(false)
  const button = {
    'aria-expanded': isExpanded,
    'aria-label': 'Menu',
    onPress: () => {
      setExpanded((expanded) => !expanded)
    },
  }
  const rail = {
    'aria-label': 'Label',
    header: <IconButton {...button}>{MENU}</IconButton>,
    isExpanded,
    selectedRoute: '/first',
  }

  return (
    <View style={styles.frame}>
      <NavigationRail {...rail}>{DESTINATIONS}</NavigationRail>
    </View>
  )
}

function shapeOf(
  shape: Exclude<Shape, 'menu'>,
  color: ColorValue | undefined,
  size: number,
): ViewStyle {
  const side = (size * 2) / 3
  const shapes: Readonly<Record<Exclude<Shape, 'menu'>, ViewStyle>> = {
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

const meta = {
  args: {
    'aria-label': 'Label',
    children: DESTINATIONS,
    selectedRoute: '/first',
  },
  component: NavigationRail,
  render: (args) => (
    <View style={styles.frame}>
      <NavigationRail {...args} />
    </View>
  ),
  title: 'Components/NavigationRail',
} satisfies Meta<typeof NavigationRail>

type Story = StoryObj<typeof meta>

// The collapsed form, each destination's label under its icon.
const Default: Story = {}

// The expanded form, each destination a pill.
const Expanded: Story = {
  args: {
    isExpanded: true,
  },
}

// A menu button in the header that expands the rail and collapses it, the
// surface widening and narrowing as it does.
const WithHeader: Story = {
  render: () => <Expandable />,
}

// More destinations than the rail has room for: they scroll in their own
// block under the header, each keeping the page's 56dp, rather than
// squashing or running past the rail. The header's menu button sits at the
// leading edge with its icon over the destinations' icons.
const ManyDestinations: Story = {
  args: {
    children: TEN_DESTINATIONS,
    header: MENU_BUTTON,
    isExpanded: true,
  },
}

export { Default, Expanded, ManyDestinations, WithHeader }

export default meta
