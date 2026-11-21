import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import type { KuiTheme } from '../../tokens/defaults'

import { FabMenu } from '.'
import {
  KeyboardGlyph,
  PersonGlyph,
  PlusGlyph,
  SearchGlyph,
} from '../../glyphs'

// The open story opens its menu as it renders, so on the Overview page it is
// drawn in a frame of its own, sized to hold it, rather than over the page.
const FRAMED = { docs: { story: { height: '420px', inline: false } } }

const styles = StyleSheet.create({
  // Where a FAB sits on a screen: the bottom trailing corner, with room
  // above it for the actions to open into.
  frame: {
    alignItems: 'flex-end',
    height: 420,
    justifyContent: 'flex-end',
    padding: 16,
  },
})

// The library's own glyphs, which read the colour and size their slot hands
// them through useIconStyle(), as an app's own icon does. Hoisted so each is
// one stable element per render, which is what react-perf's no-jsx-as-prop
// is after.
const KEYBOARD = <KeyboardGlyph />
const PERSON = <PersonGlyph />
const PLUS = <PlusGlyph />
const SEARCH = <SearchGlyph />

const ACTIONS = [
  <FabMenu.Item icon={PERSON} id="first" key="first">
    First item
  </FabMenu.Item>,
  <FabMenu.Item icon={SEARCH} id="second" key="second">
    Second item
  </FabMenu.Item>,
  <FabMenu.Item icon={KEYBOARD} id="third" key="third">
    Third item
  </FabMenu.Item>,
]

// A theme of one action's own, as a part of an app with a colour of its own
// would hand it: the primary container pair, here pointed at the library's
// error container pair so it reads in either scheme.
const OWN_THEME: KuiTheme = {
  '--kui-color-on-primary-container': 'var(--kui-color-on-error-container)',
  '--kui-color-primary-container': 'var(--kui-color-error-container)',
}

// Four actions, each in a colour of its own: the three tones, and one in a
// theme of its own.
const OWN_TONES = [
  <FabMenu.Item icon={PERSON} id="first" key="first" tone="primary">
    First item
  </FabMenu.Item>,
  <FabMenu.Item icon={SEARCH} id="second" key="second" tone="secondary">
    Second item
  </FabMenu.Item>,
  <FabMenu.Item icon={KEYBOARD} id="third" key="third" tone="tertiary">
    Third item
  </FabMenu.Item>,
  <FabMenu.Item icon={PLUS} id="fourth" key="fourth" theme={OWN_THEME}>
    Fourth item
  </FabMenu.Item>,
]

const meta = {
  args: {
    'aria-label': 'Label',
    children: ACTIONS,
    icon: PLUS,
  },
  component: FabMenu,
  render: (args) => (
    <View style={styles.frame}>
      <FabMenu {...args} />
    </View>
  ),
  title: 'Components/FabMenu',
} satisfies Meta<typeof FabMenu>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// The menu open: the close button, and the actions above it.
const Open: Story = {
  args: {
    defaultOpen: true,
  },
  parameters: FRAMED,
}

// Each action in a tone of its own, while the close button keeps the menu's.
const ItemTones: Story = {
  args: {
    children: OWN_TONES,
    defaultOpen: true,
  },
  parameters: FRAMED,
}

export { Default, ItemTones, Open }

export default meta
