import type { Meta, StoryObj } from '@storybook/react'
import type { ColorValue, ViewStyle } from 'react-native'

import { useState } from 'react'
import { View } from 'react-native'

import type { NavigationTabBarProps } from '.'

import { NavigationBar, NavigationTabBar } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { RouterProvider } from '../../router'

// Plain shapes rather than an icon set, so the stories show the bar alone,
// as web's do. Each is a view in the colour and at the size the destination
// hands it through useIconStyle(), as an app's own icon reads them.
type Shape = 'circle' | 'diamond' | 'ring' | 'square' | 'triangle'

const ROUTES = [
  { key: 'first', name: 'first' },
  { key: 'second', name: 'second' },
  { key: 'third', name: 'third' },
]

const TABS = `\`NavigationTabBar\` draws the bar for a tab navigator: hand it to the navigator's \`tabBar\` prop, and each screen's \`title\`, \`tabBarIcon\` and \`tabBarBadge\` become a destination's label, icon and badge. The story stands in for the navigator, holding which route is focused.

With Expo Router:

\`\`\`tsx
import { Tabs } from 'expo-router'
import { NavigationTabBar } from '@kanso-labs/react-native-kanso-ui'

export default function Layout() {
  return (
    <Tabs tabBar={(props) => <NavigationTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ tabBarIcon: () => <FirstIcon />, title: 'First item' }} />
      <Tabs.Screen name="second" options={{ tabBarBadge: 3, tabBarIcon: () => <SecondIcon />, title: 'Second item' }} />
    </Tabs>
  )
}
\`\`\`

With React Navigation:

\`\`\`tsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { NavigationTabBar } from '@kanso-labs/react-native-kanso-ui'

const Tab = createBottomTabNavigator()

function Tabs() {
  return (
    <Tab.Navigator tabBar={(props) => <NavigationTabBar {...props} />}>
      <Tab.Screen component={First} name="First" options={{ tabBarIcon: () => <FirstIcon />, title: 'First item' }} />
      <Tab.Screen component={Second} name="Second" options={{ tabBarIcon: () => <SecondIcon />, title: 'Second item' }} />
    </Tab.Navigator>
  )
}
\`\`\`

An icon drawn by \`tabBarIcon\` takes the colour and size it is handed, or reads them with \`useIconStyle()\`.`

function Icon({ shape }: { readonly shape: Shape }) {
  const { color, size } = useIconStyle()

  return <View style={shapeOf(shape, color, size)} />
}

function iconFor(shape: Shape) {
  return () => <Icon shape={shape} />
}

// Hoisted so each is one stable element per render, which is what
// react-perf's no-jsx-as-prop is after.
const CIRCLE = <Icon shape="circle" />
const DIAMOND = <Icon shape="diamond" />
const RING = <Icon shape="ring" />
const SQUARE = <Icon shape="square" />
const TRIANGLE = <Icon shape="triangle" />

const THREE = (
  <>
    <NavigationBar.Item href="/first" icon={CIRCLE}>
      First item
    </NavigationBar.Item>
    <NavigationBar.Item href="/second" icon={SQUARE}>
      Second item
    </NavigationBar.Item>
    <NavigationBar.Item href="/third" icon={TRIANGLE}>
      Third item
    </NavigationBar.Item>
  </>
)

const FIVE = (
  <>
    <NavigationBar.Item href="/first" icon={CIRCLE}>
      First item
    </NavigationBar.Item>
    <NavigationBar.Item href="/second" icon={SQUARE}>
      Second item
    </NavigationBar.Item>
    <NavigationBar.Item href="/third" icon={TRIANGLE}>
      Third item
    </NavigationBar.Item>
    <NavigationBar.Item href="/fourth" icon={RING}>
      Fourth item
    </NavigationBar.Item>
    <NavigationBar.Item href="/fifth" icon={DIAMOND}>
      Fifth item
    </NavigationBar.Item>
  </>
)

const BADGED = (
  <>
    <NavigationBar.Item href="/first" icon={CIRCLE}>
      First item
    </NavigationBar.Item>
    <NavigationBar.Item
      aria-label="Second item, 3 new"
      badge={3}
      href="/second"
      icon={SQUARE}
    >
      Second item
    </NavigationBar.Item>
    <NavigationBar.Item
      aria-label="Third item, new"
      badge
      href="/third"
      icon={TRIANGLE}
    >
      Third item
    </NavigationBar.Item>
  </>
)

const LARGE_COUNTS = (
  <>
    <NavigationBar.Item
      aria-label="First item, 99 new"
      badge={99}
      href="/first"
      icon={CIRCLE}
    >
      First item
    </NavigationBar.Item>
    <NavigationBar.Item
      aria-label="Second item, 999+ new"
      badge={1000}
      href="/second"
      icon={SQUARE}
    >
      Second item
    </NavigationBar.Item>
    <NavigationBar.Item href="/third" icon={TRIANGLE}>
      Third item
    </NavigationBar.Item>
  </>
)

const LONG_LABELS = (
  <>
    <NavigationBar.Item href="/first" icon={CIRCLE}>
      First destination
    </NavigationBar.Item>
    <NavigationBar.Item href="/second" icon={SQUARE}>
      Second destination
    </NavigationBar.Item>
    <NavigationBar.Item href="/third" icon={TRIANGLE}>
      Third destination
    </NavigationBar.Item>
    <NavigationBar.Item href="/fourth" icon={RING}>
      Fourth destination
    </NavigationBar.Item>
    <NavigationBar.Item href="/fifth" icon={DIAMOND}>
      Fifth destination
    </NavigationBar.Item>
  </>
)

const DESCRIPTORS: NavigationTabBarProps['descriptors'] = {
  first: { options: { tabBarIcon: iconFor('circle'), title: 'First item' } },
  second: {
    options: {
      tabBarAccessibilityLabel: 'Second item, 3 new',
      tabBarBadge: 3,
      tabBarIcon: iconFor('square'),
      title: 'Second item',
    },
  },
  third: {
    options: { tabBarIcon: iconFor('triangle'), title: 'Third item' },
  },
}

// The router's part, played by the story: the route that is current, which
// pressing a destination sets.
function Navigated() {
  const [route, setRoute] = useState('/first')

  return (
    <RouterProvider navigate={setRoute}>
      <NavigationBar selectedRoute={route}>{THREE}</NavigationBar>
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
    diamond: {
      backgroundColor: color,
      borderRadius: 2,
      height: side * 0.75,
      transform: [{ rotate: '45deg' }],
      width: side * 0.75,
    },
    ring: {
      borderColor: color,
      borderRadius: side / 2,
      borderWidth: 2,
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

// The navigator's part, played by the story: the routes, and which of them
// is focused, which a press moves.
function TabNavigator() {
  const [index, setIndex] = useState(0)
  const navigation = {
    emit: () => ({ defaultPrevented: false }),
    navigate: (name: string) => {
      setIndex(ROUTES.findIndex((route) => route.name === name))
    },
  }
  const tabs = {
    descriptors: DESCRIPTORS,
    navigation,
    state: { index, routes: ROUTES },
  }

  return <NavigationTabBar {...tabs} />
}

const meta = {
  args: {
    children: THREE,
    selectedRoute: '/first',
  },
  component: NavigationBar,
  title: 'Components/NavigationBar',
} satisfies Meta<typeof NavigationBar>

type Story = StoryObj<typeof meta>

// Vertical destinations in a compact window, and horizontal pills from the
// medium window size class.
const Default: Story = {}

// The five destinations the page allows at most.
const FiveDestinations: Story = {
  args: {
    children: FIVE,
  },
}

// Badges on two destinations' icons: a count, and the small dot.
const WithBadges: Story = {
  args: {
    children: BADGED,
  },
}

// Counts of two and four characters. Beside the labels, in the horizontal
// form, each label starts after its badge rather than under it.
const WithLargeCounts: Story = {
  args: {
    children: LARGE_COUNTS,
  },
}

// Five labels the horizontal form has no room for in a window of 640dp, so
// the bar keeps the vertical form there and turns horizontal once the
// window is wide enough to show every label whole.
const LongLabels: Story = {
  args: {
    children: LONG_LABELS,
  },
}

// The wiring an app's router does, with the story standing in for it:
// pressing a destination makes it current.
const Navigation: Story = {
  render: () => <Navigated />,
}

// The bar drawn for a tab navigator, through its `tabBar` prop.
const TabBar: Story = {
  parameters: {
    docs: { description: { story: TABS } },
  },
  render: () => <TabNavigator />,
}

export {
  Default,
  FiveDestinations,
  LongLabels,
  Navigation,
  TabBar,
  WithBadges,
  WithLargeCounts,
}

export default meta
