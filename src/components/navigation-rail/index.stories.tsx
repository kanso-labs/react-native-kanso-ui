import type { Meta, StoryObj } from '@storybook/react'
import type { ReactNode } from 'react'
import type { ColorValue, ViewStyle } from 'react-native'

import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import type { NavigationRailProps } from '.'

import { NavigationRail } from '.'
import { PlusGlyph } from '../../glyphs'
import { useIconStyle } from '../../glyphs/icon-style'
import { RouterProvider } from '../../router'
import { IconButton } from '../icon-button'

// Plain shapes rather than an icon set, so the stories show the rail alone,
// as web's do. Each is a view in the colour and in a box of the size the
// destination hands it through useIconStyle(), as an app's own icon reads
// them.
type Shape = 'circle' | 'menu' | 'square' | 'triangle'

const styles = StyleSheet.create({
  // A view whose automatic top margin takes the height the destinations
  // above it leave, which puts what it holds at the rail's foot. It spans
  // the rail, so a collapsed destination in it is as wide as the others.
  foot: {
    alignSelf: 'stretch',
    marginTop: 'auto',
  },
  // Two rails side by side, each in a frame of its own.
  forms: {
    flexDirection: 'row',
    gap: 24,
  },
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

// The three destinations, and a fourth at the rail's foot.
const FOOT_DESTINATIONS = (
  <>
    {DESTINATIONS}
    <View style={styles.foot}>
      <NavigationRail.Item href="/fourth" icon={CIRCLE}>
        Fourth item
      </NavigationRail.Item>
    </View>
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

// The screen's FAB, at the top of the rail. Its press does nothing, since
// what the story shows is the rail rather than what the FAB would do.
const FAB = (
  <NavigationRail.Fab label="Label" onPress={() => {}}>
    <PlusGlyph />
  </NavigationRail.Fab>
)

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
function Expandable({ fab }: { readonly fab?: ReactNode }) {
  const [isExpanded, setExpanded] = useState(false)
  const [route, setRoute] = useState('/first')
  const button = {
    'aria-expanded': isExpanded,
    'aria-label': 'Menu',
    onPress: () => {
      setExpanded((expanded) => !expanded)
    },
  }
  const rail = {
    'aria-label': 'Label',
    fab,
    header: <IconButton {...button}>{MENU}</IconButton>,
    isExpanded,
    selectedRoute: route,
  }

  return (
    <RouterProvider navigate={setRoute}>
      <View style={styles.frame}>
        <NavigationRail {...rail}>{DESTINATIONS}</NavigationRail>
      </View>
    </RouterProvider>
  )
}

// The router's part, played by every story: the route that is current,
// which pressing a destination sets. A device has nothing to open a page's
// address with, so without it a press went to the platform, which warned
// and changed nothing.
function Navigated({ selectedRoute, ...props }: NavigationRailProps) {
  const [route, setRoute] = useState(selectedRoute)

  return (
    <RouterProvider navigate={setRoute}>
      <View style={styles.frame}>
        <NavigationRail {...props} selectedRoute={route} />
      </View>
    </RouterProvider>
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
  // Keyed on the route the Controls panel sets, which starts it again from
  // there.
  render: (args) => <Navigated key={String(args.selectedRoute)} {...args} />,
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

// A destination at the rail's foot, below the rest: a view with
// `marginTop: 'auto'` around it takes the height the others leave.
const DestinationAtFoot: Story = {
  args: {
    children: FOOT_DESTINATIONS,
  },
}

// The screen's FAB under the menu button: the icon alone while the rail is
// collapsed, and the extended FAB once the menu button expands it, revealed
// as the surface widens.
const WithFab: Story = {
  render: () => <Expandable fab={FAB} />,
}

// The FAB in each form at once, collapsed and expanded, with no header.
const FabForms: Story = {
  args: {
    fab: FAB,
  },
  render: (args) => (
    <View style={styles.forms}>
      <Navigated {...args} />
      <Navigated {...args} isExpanded />
    </View>
  ),
}

export {
  Default,
  DestinationAtFoot,
  Expanded,
  FabForms,
  ManyDestinations,
  WithFab,
  WithHeader,
}

export default meta
