import type { Decorator, Meta, StoryObj } from '@storybook/react'
import type { ColorValue, ViewStyle } from 'react-native'

import { StyleSheet, View } from 'react-native'

import { Tabs } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { Text } from '../text'

// More tabs than a phone's width has room for at their labels' widths.
const SCROLLING = [
  ['first', 'First item'],
  ['second', 'Second item'],
  ['third', 'Third item'],
  ['fourth', 'Fourth item'],
  ['fifth', 'Fifth item'],
  ['sixth', 'Sixth item'],
] as const

const styles = StyleSheet.create({
  // A phone's width, narrower than either long label below on one line, and
  // the width every sample takes, since a bar fills what it is given.
  phone: {
    maxWidth: '100%',
    width: 360,
  },
  // A panel beside a vertical bar, given a height so the bar has a length to
  // run.
  tallBeside: {
    minHeight: 200,
  },
})

const stylesOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    // Set off from the divider as the horizontal panel is from below it.
    besideBar: {
      paddingStart: spacing.lg,
    },
    panel: {
      paddingTop: spacing.md,
    },
    // Enough lines that the box has somewhere to grow to.
    tall: {
      gap: spacing.sm,
    },
  }),
)

// A plain shape rather than an icon set, so the stories show the bar alone,
// as web's do. It takes the colour and the size the tab hands it through
// useIconStyle(), as an app's own icon reads them.
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

// Hoisted so each is one stable element per render, which is what
// react-perf's no-jsx-as-prop is after.
const DOT = <Dot />

// A panel of the stories' own, set off from the bar.
function Panel({
  besideBar = false,
  id,
  text,
}: {
  readonly besideBar?: boolean
  readonly id: string
  readonly text: string
}) {
  const own = stylesOf(useTheme())

  return (
    <Tabs.Panel
      id={id}
      style={composeStyles<ViewStyle>(
        own.panel,
        besideBar ? own.besideBar : undefined,
        besideBar ? styles.tallBeside : undefined,
      )}
    >
      <Text tone="muted" variant="bodyMedium">
        {text}
      </Text>
    </Tabs.Panel>
  )
}

// A panel taller than the others beside it, so the box has somewhere to grow
// to.
function TallPanel() {
  const own = stylesOf(useTheme())

  return (
    <View style={own.tall}>
      <Text variant="bodyMedium">
        Several lines, so the box has somewhere to grow to.
      </Text>
      <Text tone="muted" variant="bodyMedium">
        Supporting line.
      </Text>
      <Text tone="muted" variant="bodyMedium">
        Supporting line.
      </Text>
    </View>
  )
}

// A decorator rather than a wrapper in each `render`, so every story takes
// the phone's width.
const OnAPhone: Decorator = (Story) => (
  <View style={styles.phone}>
    <Story />
  </View>
)

const meta = {
  args: {
    defaultSelectedKey: 'first',
  },
  component: Tabs,
  decorators: [OnAPhone],
  title: 'Components/Tabs',
} satisfies Meta<typeof Tabs>

type Story = StoryObj<typeof meta>

const Default: Story = {
  render: (args) => (
    <Tabs {...args}>
      <Tabs.List aria-label="Sections">
        <Tabs.Tab id="first">First item</Tabs.Tab>
        <Tabs.Tab id="second">Second item</Tabs.Tab>
        <Tabs.Tab id="third">Third item</Tabs.Tab>
      </Tabs.List>
      <Panel id="first" text="The first panel." />
      <Panel id="second" text="The second panel." />
      <Panel id="third" text="The third panel." />
    </Tabs>
  ),
}

// A primary bar whose tabs carry icons, which grows it to 64dp, with a badge
// on one of them.
const WithIcons: Story = {
  render: (args) => (
    <Tabs {...args}>
      <Tabs.List aria-label="Sections">
        <Tabs.Tab icon={DOT} id="first">
          First item
        </Tabs.Tab>
        <Tabs.Tab
          aria-label="Second item, 3 new"
          badge={3}
          icon={DOT}
          id="second"
        >
          Second item
        </Tabs.Tab>
        <Tabs.Tab icon={DOT} id="third">
          Third item
        </Tabs.Tab>
      </Tabs.List>
    </Tabs>
  ),
}

// A bar with more tabs than the room has sections for, opened on one the bar
// has to scroll to.
const Scrollable: Story = {
  args: { defaultSelectedKey: 'fifth', layout: 'scrollable' },
  render: (args) => (
    <Tabs {...args}>
      <Tabs.List aria-label="Sections">
        {SCROLLING.map(([id, label]) => (
          <Tabs.Tab id={id} key={id}>
            {label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  ),
}

// The bar on its side, beside its panels.
const Vertical: Story = {
  args: { orientation: 'vertical' },
  render: (args) => (
    <Tabs {...args}>
      <Tabs.List aria-label="Sections">
        <Tabs.Tab id="first">First item</Tabs.Tab>
        <Tabs.Tab id="second">Second item</Tabs.Tab>
        <Tabs.Tab id="third">Third item</Tabs.Tab>
      </Tabs.List>
      <Panel besideBar id="first" text="The first panel." />
      <Panel besideBar id="second" text="The second panel." />
      <Panel besideBar id="third" text="The third panel." />
    </Tabs>
  ),
}

// The strip under a primary bar.
const Secondary: Story = {
  args: { variant: 'secondary' },
  render: (args) => (
    <Tabs {...args}>
      <Tabs.List aria-label="Sections">
        <Tabs.Tab id="first">First item</Tabs.Tab>
        <Tabs.Tab id="second">Second item</Tabs.Tab>
        <Tabs.Tab id="third">Third item</Tabs.Tab>
      </Tabs.List>
    </Tabs>
  ),
}

// The bar on its own: tabs that filter the content below rather than
// swapping a panel.
const WithoutPanels: Story = {
  render: (args) => (
    <Tabs {...args}>
      <Tabs.List aria-label="Sections">
        <Tabs.Tab id="first">First item</Tabs.Tab>
        <Tabs.Tab id="second">Second item</Tabs.Tab>
        <Tabs.Tab id="third">Third item</Tabs.Tab>
      </Tabs.List>
    </Tabs>
  ),
}

// Its own story because the box around the panels is what animates, and it
// only shows when the panels are different heights.
const AnimatedPanels: Story = {
  render: (args) => (
    <Tabs {...args}>
      <Tabs.List aria-label="Sections">
        <Tabs.Tab id="first">First item</Tabs.Tab>
        <Tabs.Tab id="second">Second item</Tabs.Tab>
        <Tabs.Tab id="third">Third item</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panels>
        <Tabs.Panel id="first">
          <Text variant="bodyMedium">One line.</Text>
        </Tabs.Panel>
        <Tabs.Panel id="second">
          <TallPanel />
        </Tabs.Panel>
        <Tabs.Panel id="third">
          <Text variant="bodyMedium">One line again.</Text>
        </Tabs.Panel>
      </Tabs.Panels>
    </Tabs>
  ),
}

// A badge sits on a primary tab's icon, and 4dp after the label where none is
// stacked over it, as here. It is hidden from a screen reader, so the tab says
// what it says in its own name.
const BadgeAfterLabel: Story = {
  render: (args) => (
    <Tabs {...args}>
      <Tabs.List aria-label="Sections">
        <Tabs.Tab id="first">First item</Tabs.Tab>
        <Tabs.Tab aria-label="Second item, new" badge id="second">
          Second item
        </Tabs.Tab>
        <Tabs.Tab id="third">Third item</Tabs.Tab>
      </Tabs.List>
    </Tabs>
  ),
}

// Disabling is a prop of one tab, which no other story sets. A disabled tab is
// announced as disabled and takes no press.
const DisabledTab: Story = {
  render: (args) => (
    <Tabs {...args}>
      <Tabs.List aria-label="Sections">
        <Tabs.Tab id="first">First item</Tabs.Tab>
        <Tabs.Tab id="second" isDisabled>
          Second item
        </Tabs.Tab>
        <Tabs.Tab id="third">Third item</Tabs.Tab>
      </Tabs.List>
    </Tabs>
  ),
}

// A label has its tab's equal share of the bar and no more: a longer word
// breaks inside itself, and several words take two lines and then an
// ellipsis. A screen reader still reads it whole.
const LongLabels: Story = {
  render: (args) => (
    <Tabs {...args}>
      <Tabs.List aria-label="Sections">
        <Tabs.Tab id="first">Unterstützungszeile</Tabs.Tab>
        <Tabs.Tab id="second">
          A label long enough that it has nowhere left to go on one line
        </Tabs.Tab>
        <Tabs.Tab id="third">Third item</Tabs.Tab>
      </Tabs.List>
    </Tabs>
  ),
}

export {
  AnimatedPanels,
  BadgeAfterLabel,
  Default,
  DisabledTab,
  LongLabels,
  Scrollable,
  Secondary,
  Vertical,
  WithIcons,
  WithoutPanels,
}

export default meta
