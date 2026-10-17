import type { Decorator, Meta, StoryObj } from '@storybook/react'

import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import type { Key } from '../..'

import { ListDetail } from '.'
import { useWindowSizeClass } from '../../hooks/useWindowSizeClass'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'
import { Button } from '../button'
import { Card } from '../card'
import { List } from '../list'
import { Separator } from '../separator'
import { Stack } from '../stack'
import { Text } from '../text'

const ITEMS = [
  { id: 'first', label: 'First item' },
  { id: 'second', label: 'Second item' },
  { id: 'third', label: 'Third item' },
]

// The rows, as elements rather than a fragment, which a list would not look
// inside.
const ROWS = ITEMS.map(({ id, label }) => (
  <List.Item id={id} key={id} supporting="Supporting line">
    {label}
  </List.Item>
))

const ROUTERS = `On a phone the two panes are two steps of the app's navigation, and the router holds the item that is open. Choosing one pushes the route with its id, so the back gesture on Android and the swipe on iOS return to the list through the router; where both panes show, the id is changed in place, so choosing between items does not stack a screen per choice. The story holds the id in its own state instead, and draws a button standing in for the back gesture below the expanded window size.

With Expo Router, the id is a search parameter of the screen:

\`\`\`tsx
import { router, useLocalSearchParams } from 'expo-router'
import { type Key, List, ListDetail, useWindowSizeClass } from '@kanso-labs/react-native-kanso-ui'

export default function Items() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const sizeClass = useWindowSizeClass()
  const open = (key: Key) => {
    const params = { id: String(key) }
    if (sizeClass === 'compact' || sizeClass === 'medium') {
      router.push({ params, pathname: '/items' })
    } else {
      router.setParams(params)
    }
  }

  return (
    <ListDetail
      detail={id === undefined ? null : <Detail id={id} />}
      list={<List aria-label="Items" onAction={open}>{rows}</List>}
      showing={id === undefined ? 'list' : 'detail'}
    />
  )
}
\`\`\`

With React Navigation, it is a parameter of the stack's route:

\`\`\`tsx
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { type Key, List, ListDetail, useWindowSizeClass } from '@kanso-labs/react-native-kanso-ui'

type Screens = { Items: { id?: string } | undefined }

function Items({ navigation, route }: NativeStackScreenProps<Screens, 'Items'>) {
  const id = route.params?.id
  const sizeClass = useWindowSizeClass()
  const open = (key: Key) => {
    const params = { id: String(key) }
    if (sizeClass === 'compact' || sizeClass === 'medium') {
      navigation.push('Items', params)
    } else {
      navigation.setParams(params)
    }
  }

  return (
    <ListDetail
      detail={id === undefined ? null : <Detail id={id} />}
      list={<List aria-label="Items" onAction={open}>{rows}</List>}
      showing={id === undefined ? 'list' : 'detail'}
    />
  )
}
\`\`\``

const styles = StyleSheet.create({
  // The open item's pane, the back button over the outlined detail.
  fill: {
    flexGrow: 1,
  },
  // A height for the layout to fill, as a screen gives it.
  screen: {
    height: 480,
  },
})

const stylesOf = themedStyles(({ colors, radii, spacing }) =>
  StyleSheet.create({
    // A dashed outline on the detail pane, so the tracks are legible in a
    // capture. The component paints nothing itself; this is the story's.
    outline: {
      borderColor: colors.outlineVariant,
      borderRadius: radii.md,
      borderStyle: 'dashed',
      borderWidth: 1,
      flexGrow: 1,
      padding: spacing.md,
    },
  }),
)

const Screen: Decorator = (Story) => (
  <View style={styles.screen}>
    <Story />
  </View>
)

type DetailPaneProps = {
  readonly children?: string
}

/* oxlint-enable react-perf/jsx-no-jsx-as-prop */

// Built by a call rather than written inline at the prop, which is what
// react-perf's jsx-no-new-function-as-prop is after; the React Compiler
// memoises the result on its inputs.
function closeWith(setId: (id: Key | undefined) => void) {
  return () => {
    setId(undefined)
  }
}

function DetailPane({ children = 'Headline' }: DetailPaneProps) {
  const own = stylesOf(useTheme())

  return (
    <View style={own.outline}>
      <Stack gap="sm">
        <Text role="heading" variant="titleLarge">
          {children}
        </Text>
        <Text tone="muted" variant="bodyMedium">
          Supporting line
        </Text>
        <Separator />
        <Text tone="muted" variant="bodyMedium">
          The detail pane takes the flexible track, so it takes whatever the
          list does not.
        </Text>
      </Stack>
    </View>
  )
}

function ListPane() {
  return (
    <Card padding="none" variant="outlined">
      <List aria-label="Items" scrollEnabled={false}>
        {ROWS}
      </List>
    </Card>
  )
}

// The router's part, played by the story: the id of the item that is open,
// which choosing a row sets and going back clears. Its slots follow that
// state, so they are new elements whenever it changes, which react-perf's
// rule cannot tell from a needless one; the React Compiler memoises them on
// their inputs.
/* oxlint-disable react-perf/jsx-no-jsx-as-prop -- the slots follow the story's state */
function Navigated() {
  const [id, setId] = useState<Key | undefined>()
  const sizeClass = useWindowSizeClass()
  const open = ITEMS.find((item) => item.id === id)
  const list = (
    <Card padding="none" variant="outlined">
      <List aria-label="Items" onAction={setId} scrollEnabled={false}>
        {ROWS}
      </List>
    </Card>
  )
  const detail =
    open === undefined ? (
      <DetailPane>Nothing open</DetailPane>
    ) : (
      <Stack gap="sm" style={styles.fill}>
        {sizeClass === 'compact' || sizeClass === 'medium' ? (
          <Button onPress={closeWith(setId)} variant="text">
            Back
          </Button>
        ) : null}
        <DetailPane>{open.label}</DetailPane>
      </Stack>
    )

  return (
    <ListDetail
      detail={detail}
      list={list}
      showing={open === undefined ? 'list' : 'detail'}
    />
  )
}

const meta = {
  args: {
    detail: <DetailPane />,
    list: <ListPane />,
  },
  component: ListDetail,
  decorators: [Screen],
  title: 'Components/ListDetail',
} satisfies Meta<typeof ListDetail>

type Story = StoryObj<typeof meta>

// Both panes from the expanded window size, and the list alone below it.
const Default: Story = {}

// Its own story because below the expanded window size it is a different
// layout rather than a differently sized one: the list is gone, not
// narrower.
const ShowingDetail: Story = {
  args: {
    showing: 'detail',
  },
}

// The wiring an app's router does, with the story standing in for it.
const Navigation: Story = {
  parameters: {
    docs: { description: { story: ROUTERS } },
  },
  render: () => <Navigated />,
}

export { Default, Navigation, ShowingDetail }

export default meta
