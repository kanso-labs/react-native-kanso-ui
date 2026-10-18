import type { Meta, StoryObj } from '@storybook/react'
import type { TextStyle } from 'react-native'
import type { SortDescriptor } from 'react-stately'

import { useMemo, useState } from 'react'
import { StyleSheet } from 'react-native'

import { Table } from '.'
import { useTheme } from '../../theme/scope'
import { composeStyles } from '../../theme/styles'
import { useFontFamily } from '../../typography/fonts'
import { familyStyle } from '../../typography/roles'
import { Card } from '../card'
import { Tag } from '../tag'
import { Text } from '../text'

const styles = StyleSheet.create({
  // Tabular figures, so 01, 02 and 03 line up down the column.
  figures: {
    fontVariant: ['tabular-nums'],
  },
  // What a sticky header needs to have something to stick to: a box the
  // table is taller than.
  scroller: {
    height: 200,
  },
})

const ROWS = [
  { id: 'first', name: 'First item', status: 'Ready', value: '01' },
  { id: 'second', name: 'Second item', status: 'Waiting', value: '02' },
  { id: 'third', name: 'Third item', status: 'Ready', value: '03' },
] as const

// A column's id and a row's id share one namespace in React Stately's
// collection, so the two sets are kept apart by prefix: a value used by both
// leaves the table with no columns at all.
const COLUMNS = {
  name: 'colName',
  status: 'colStatus',
  value: 'colValue',
} as const

// Hoisted so the array identity is stable across renders, which is what
// react-perf's jsx-no-new-array-as-prop is after.
const SELECTED = ['second']
const DISABLED = ['third']

// Enough rows to scroll under a sticky header, each with an id of its own:
// the same three repeated would give three rows one key between them.
const SCROLLING_ROWS = Array.from({ length: 9 }, (_unused, index) => ({
  id: `row${String(index)}`,
  name: ROWS[index % ROWS.length]?.name ?? '',
  value: String(index + 1).padStart(2, '0'),
}))

// What the empty table draws in place of rows. Declared once rather than
// written at the prop, which would hand it a new function each render.
function nothingToShow() {
  return 'Nothing to show'
}

/**
 * A figure in the theme's mono family with tabular figures, as web's value
 * column draws it. A cell sets a plain string in its own type role, so a
 * figure in another family brings its role with it: body medium in the body,
 * and the footer's label large in the muted role there.
 */
function Value({
  children,
  isFooter = false,
}: {
  readonly children: string
  readonly isFooter?: boolean
}) {
  const theme = useTheme()
  const family = familyStyle(useFontFamily(theme.typography.fontFamilyMono))

  return (
    <Text
      style={composeStyles<TextStyle>(family, styles.figures)}
      tone={isFooter ? 'muted' : 'neutral'}
      variant={isFooter ? 'labelLarge' : 'bodyMedium'}
    >
      {children}
    </Text>
  )
}

const meta = {
  component: Table,
  // The device Storybook draws a story in a scroll view of its own, which a
  // table scrolling by itself must not sit inside, so these opt out of it.
  parameters: { scrolls: true },
  title: 'Components/Table',
} satisfies Meta<typeof Table>

type Story = StoryObj<typeof meta>

function Basic() {
  return (
    <Card padding="none" variant="outlined">
      <Table aria-label="Label">
        <Table.Header>
          <Table.Column id={COLUMNS.name} isRowHeader>
            Label
          </Table.Column>
          <Table.Column id={COLUMNS.status}>Status</Table.Column>
          <Table.Column id={COLUMNS.value}>Value</Table.Column>
        </Table.Header>
        <Table.Body>
          {ROWS.map((row) => (
            <Table.Row id={row.id} key={row.id}>
              <Table.Cell>{row.name}</Table.Cell>
              <Table.Cell>{row.status}</Table.Cell>
              <Table.Cell>
                <Value>{row.value}</Value>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Card>
  )
}

// Resizing is React Stately's: the table holds the widths and the handle
// drags them. What a call site decides is which columns take a handle, and
// what each one starts at.
function Resizable() {
  return (
    <Card padding="none" variant="outlined">
      <Table aria-label="Label" resizable>
        <Table.Header>
          <Table.Column
            defaultWidth="2fr"
            id={COLUMNS.name}
            isRowHeader
            resizable
          >
            Label
          </Table.Column>
          <Table.Column defaultWidth="1fr" id={COLUMNS.status} resizable>
            Status
          </Table.Column>
          <Table.Column defaultWidth="1fr" id={COLUMNS.value}>
            Value
          </Table.Column>
        </Table.Header>
        <Table.Body>
          {ROWS.map((row) => (
            <Table.Row id={row.id} key={row.id}>
              <Table.Cell>{row.name}</Table.Cell>
              <Table.Cell>{row.status}</Table.Cell>
              <Table.Cell>
                <Value>{row.value}</Value>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Card>
  )
}

// A table whose rows select, with the second selected. The Disabled story
// disables a row of the same table.
function Selecting(props: { readonly disabledKeys?: string[] }) {
  return (
    <Card padding="none" variant="outlined">
      <Table
        aria-label="Label"
        defaultSelectedKeys={SELECTED}
        disabledKeys={props.disabledKeys}
        selectionMode="multiple"
      >
        <Table.Header>
          <Table.Column id="colSelect" selection />
          <Table.Column id={COLUMNS.name} isRowHeader>
            Label
          </Table.Column>
          <Table.Column id={COLUMNS.status}>Status</Table.Column>
        </Table.Header>
        <Table.Body>
          {ROWS.map((row) => (
            <Table.Row id={row.id} key={row.id}>
              <Table.Cell selection />
              <Table.Cell>{row.name}</Table.Cell>
              <Table.Cell>
                <Tag tone={row.status === 'Ready' ? 'positive' : 'neutral'}>
                  {row.status}
                </Tag>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Card>
  )
}

// Sorting is the call site's to do: the table reports which column and which
// direction, and the rows it is handed are the rows it draws.
function Sortable() {
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: COLUMNS.name,
    direction: 'ascending',
  })

  const rows = useMemo(() => {
    const key = sortDescriptor.column === COLUMNS.value ? 'value' : 'name'
    // oxlint-disable-next-line unicorn/no-array-sort -- the spread is the copy
    const sorted = [...ROWS].sort((a, b) => a[key].localeCompare(b[key]))
    // oxlint-disable-next-line unicorn/no-array-reverse -- sorted is already a copy
    return sortDescriptor.direction === 'descending' ? sorted.reverse() : sorted
  }, [sortDescriptor])

  return (
    <Card padding="none" variant="outlined">
      <Table
        aria-label="Label"
        onSortChange={setSortDescriptor}
        sortDescriptor={sortDescriptor}
      >
        <Table.Header>
          <Table.Column allowsSorting id={COLUMNS.name} isRowHeader>
            Label
          </Table.Column>
          <Table.Column id={COLUMNS.status}>Status</Table.Column>
          <Table.Column allowsSorting id={COLUMNS.value}>
            Value
          </Table.Column>
        </Table.Header>
        <Table.Body>
          {rows.map((row) => (
            <Table.Row id={row.id} key={row.id}>
              <Table.Cell>{row.name}</Table.Cell>
              <Table.Cell>{row.status}</Table.Cell>
              <Table.Cell>
                <Value>{row.value}</Value>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Card>
  )
}

const Default: Story = {
  render: () => <Basic />,
}

// Its own story because it is a state no other story draws: the third row
// faded, with its checkbox off and no tint, in a table whose other rows
// still select.
const Disabled: Story = {
  render: () => <Selecting disabledKeys={DISABLED} />,
}

// Its own story because it is a state a snapshot can show and a description
// cannot: the arrow beside the sorted column, and the rows in the order the
// call site put them in.
const Sorting: Story = {
  render: () => <Sortable />,
}

// Its own story because dragging a handle is the thing to look at, and the
// resting state is what a reviewer compares against.
const Resizing: Story = {
  render: () => <Resizable />,
}

// The header holds its place while the rows scroll under it, which needs the
// table to have a height it is taller than, so the story gives it one.
const StickyHeader: Story = {
  render: () => (
    <Card padding="none" variant="outlined">
      <Table aria-label="Label" stickyHeader style={styles.scroller}>
        <Table.Header>
          <Table.Column id={COLUMNS.name} isRowHeader>
            Label
          </Table.Column>
          <Table.Column id={COLUMNS.value}>Value</Table.Column>
        </Table.Header>
        <Table.Body>
          {SCROLLING_ROWS.map((row) => (
            <Table.Row id={row.id} key={row.id}>
              <Table.Cell>{row.name}</Table.Cell>
              <Table.Cell>
                <Value>{row.value}</Value>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Card>
  ),
}

// `Table.LoadMore` goes after the rows and draws a ring across the width
// while more are being fetched. It is drawn mid-fetch rather than wired to a
// real one, since a story that fetches has loaded its next page when looked
// at.
const LoadingMore: Story = {
  render: () => (
    <Card padding="none" variant="outlined">
      <Table aria-label="Label">
        <Table.Header>
          <Table.Column id={COLUMNS.name} isRowHeader>
            Label
          </Table.Column>
          <Table.Column id={COLUMNS.value}>Value</Table.Column>
        </Table.Header>
        <Table.Body>
          {ROWS.map((row) => (
            <Table.Row id={row.id} key={row.id}>
              <Table.Cell>{row.name}</Table.Cell>
              <Table.Cell>
                <Value>{row.value}</Value>
              </Table.Cell>
            </Table.Row>
          ))}
          <Table.LoadMore isLoading />
        </Table.Body>
      </Table>
    </Card>
  ),
}

// A footer holds a row under the body, totals and the like, ruled off from
// it. It is kept out of the selection and takes no press, so it is read as a
// summary rather than as one more row.
const Footer: Story = {
  render: () => (
    <Card padding="none" variant="outlined">
      <Table aria-label="Label">
        <Table.Header>
          <Table.Column id={COLUMNS.name} isRowHeader>
            Label
          </Table.Column>
          <Table.Column id={COLUMNS.value}>Value</Table.Column>
        </Table.Header>
        <Table.Body>
          {ROWS.map((row) => (
            <Table.Row id={row.id} key={row.id}>
              <Table.Cell>{row.name}</Table.Cell>
              <Table.Cell>
                <Value>{row.value}</Value>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
        <Table.Footer>
          <Table.Row id="total">
            <Table.Cell>Total</Table.Cell>
            <Table.Cell>
              <Value isFooter>06</Value>
            </Table.Cell>
          </Table.Row>
        </Table.Footer>
      </Table>
    </Card>
  ),
}

// A table with no rows shows what its `renderEmptyState` returns in their
// place, and still says what its columns are.
const Empty: Story = {
  render: () => (
    <Card padding="none" variant="outlined">
      <Table aria-label="Label">
        <Table.Header>
          <Table.Column id={COLUMNS.name} isRowHeader>
            Label
          </Table.Column>
          <Table.Column id={COLUMNS.value}>Value</Table.Column>
        </Table.Header>
        <Table.Body renderEmptyState={nothingToShow} />
      </Table>
    </Card>
  ),
}

export {
  Default,
  Disabled,
  Empty,
  Footer,
  LoadingMore,
  Resizing,
  Sorting,
  StickyHeader,
}

export default meta
