import type { Decorator, Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import { Autocomplete } from '.'
import { Card } from '../card'
import { List } from '../list'
import { SearchField } from '../search-field'
import { Stack } from '../stack'

const styles = StyleSheet.create({
  // The bar and the rows fill the column they sit in, so they need one to
  // have a width.
  width: {
    width: 380,
  },
})

// The people the list holds, as elements rather than a fragment, which a
// list would not look inside.
const PEOPLE = [
  <List.Item id="ada" key="ada" supporting="Supporting line">
    Ada Lovelace
  </List.Item>,
  <List.Item id="grace" key="grace" supporting="Supporting line">
    Grace Hopper
  </List.Item>,
  <List.Item id="alan" key="alan" supporting="Supporting line">
    Alan Turing
  </List.Item>,
]

const Sample: Decorator = (Story) => (
  <View style={styles.width}>
    <Story />
  </View>
)

// The search page's shape: the bar over the rows it filters, the rows in
// an outlined card with no padding, which gives them an edge. Autocomplete
// draws neither; the page puts them where it likes. The list is laid out
// at its full length, since the canvas around it already scrolls.
const meta = {
  component: Autocomplete,
  decorators: [Sample],
  render: (args) => (
    <Stack gap="sm">
      <Autocomplete {...args}>
        <SearchField label="Search people" placeholder="Search" />
        <Card padding="none" variant="outlined">
          <List
            aria-label="People"
            scrollEnabled={false}
            selectionMode="single"
          >
            {PEOPLE}
          </List>
        </Card>
      </Autocomplete>
    </Stack>
  ),
  title: 'Components/Autocomplete',
} satisfies Meta<typeof Autocomplete<object>>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// Filtered down to one, so a snapshot shows what searching does rather than
// what the list looks like before it starts.
const Filtered: Story = {
  args: { defaultInputValue: 'Ada' },
}

// A search that matches nothing: the list draws its empty row in place of
// the rows, and says the same to a screen reader.
const FilteredEmpty: Story = {
  args: { defaultInputValue: 'zzz' },
}

export { Default, Filtered, FilteredEmpty }

export default meta
