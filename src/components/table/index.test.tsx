import type { ReactNode } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { Key, Selection, SortDescriptor } from 'react-stately'
import type { ColumnSize } from 'react-stately/useTableState'
import type { TestInstance, TestNode } from 'test-renderer'

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import {
  arrowDownwardPath,
  arrowUpwardPath,
} from '@kanso-labs/kanso-ui-core/glyphs'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { createRef, StrictMode } from 'react'
import {
  AccessibilityInfo,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  I18nManager,
  Platform,
  StyleSheet,
  Text,
} from 'react-native'
import { State } from 'react-native-gesture-handler'
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils'

import { Table } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { I18nProvider } from '../../i18n/provider'
import { RouterProvider } from '../../router'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const { colors, sizing, spacing, stateLayerOpacity, typography } = theme

// A press with no point on the page, on a row that measures nothing, so the
// ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// What a screen reader sends for an accessibility action.
function action(actionName: string) {
  return { nativeEvent: { actionName } }
}

// The table laid out 600dp wide, which three columns divide evenly.
const WIDTH = 600
const LAYOUT = {
  nativeEvent: { layout: { height: 400, width: WIDTH, x: 0, y: 0 } },
}

// Hoisted so each is one stable value per render, which is what react-perf's
// rules are after.
const CALL_SITE = { marginTop: 4 }
// The height a table's rows are given to scroll in.
const ROOM = {
  nativeEvent: { layout: { height: 200, width: WIDTH, x: 0, y: 0 } },
}
const SECOND = ['second']
const EVERY_ROW = ['first', 'second', 'third', 'fourth']
const GONE: SortDescriptor = { column: 'gone', direction: 'ascending' }
const SORTED: SortDescriptor = { column: 'colName', direction: 'ascending' }
const SORTED_DOWN: SortDescriptor = {
  column: 'colName',
  direction: 'descending',
}
const ITEMS = [
  { id: 'first', name: 'First item', value: '01' },
  { id: 'second', name: 'Second item', value: '02' },
] as const
const COLUMNS = [
  { id: 'colName', name: 'Label' },
  { id: 'colValue', name: 'Value' },
] as const
const REVERSED = [COLUMNS[1], COLUMNS[0]]

const ROWS = [
  <Table.Row id="first" key="first">
    <Table.Cell>First item</Table.Cell>
    <Table.Cell>01</Table.Cell>
  </Table.Row>,
  <Table.Row id="second" key="second">
    <Table.Cell>Second item</Table.Cell>
    <Table.Cell>02</Table.Cell>
  </Table.Row>,
  <Table.Row id="third" key="third">
    <Table.Cell>Third item</Table.Cell>
    <Table.Cell>03</Table.Cell>
  </Table.Row>,
]

const SELECTING_ROWS = [
  <Table.Row id="first" key="first">
    <Table.Cell selection />
    <Table.Cell>First item</Table.Cell>
  </Table.Row>,
  <Table.Row id="second" key="second">
    <Table.Cell selection />
    <Table.Cell>Second item</Table.Cell>
  </Table.Row>,
  <Table.Row id="third" key="third">
    <Table.Cell selection />
    <Table.Cell>Third item</Table.Cell>
  </Table.Row>,
]

function Basic(props: Partial<Parameters<typeof Table>[0]>) {
  return (
    <Table aria-label="Label" style={CALL_SITE} testID="table" {...props}>
      <Table.Header>
        <Table.Column id="colName" isRowHeader>
          Label
        </Table.Column>
        <Table.Column id="colValue">Value</Table.Column>
      </Table.Header>
      <Table.Body>{ROWS}</Table.Body>
    </Table>
  )
}

// The checkbox's 18dp box, as a cell draws it.
function boxIn(element: TestInstance) {
  return element.queryAll((node) => {
    const style = styleOf(node)
    return style.width === 18 && style.borderWidth === 2
  })
}

// The cell a string is drawn in.
function cellOf(text: string) {
  return instance(screen.getByText(text).parent)
}

function checksIn(element: TestInstance) {
  return element.queryAll(
    (node) => node.type === 'RNSVGPath' && typeof node.props.d === 'string',
  )
}

// A table built from `columns` and `items`. React Stately caches a dynamic
// collection's nodes by item, so a rerender handed the same objects asks
// each cached node whether it has to be built again.
function Dynamic({
  columns = COLUMNS,
  ...props
}: Partial<Parameters<typeof Table>[0]> & {
  readonly columns?: readonly (typeof COLUMNS)[number][]
}) {
  return (
    <Table aria-label="Label" {...props}>
      <Table.Header columns={columns}>
        {(column: (typeof COLUMNS)[number]) => (
          <Table.Column id={column.id}>{column.name}</Table.Column>
        )}
      </Table.Header>
      <Table.Body items={ITEMS}>
        {(item: (typeof ITEMS)[number]) => (
          <Table.Row id={item.id}>
            {(columnKey: Key) => (
              <Table.Cell>
                {columnKey === 'colName' ? item.name : item.value}
              </Table.Cell>
            )}
          </Table.Row>
        )}
      </Table.Body>
    </Table>
  )
}

// A table with no rows, drawing what `nothingToShow` returns in their
// place, with a LoadMore in the body once `loading` says whether it loads.
function Empty(props: { readonly loading?: boolean }) {
  return (
    <Table aria-label="Label">
      <Table.Header>
        <Table.Column id="colName">Label</Table.Column>
      </Table.Header>
      <Table.Body renderEmptyState={nothingToShow}>
        {props.loading === undefined ? null : (
          <Table.LoadMore isLoading={props.loading} />
        )}
      </Table.Body>
    </Table>
  )
}

// A table with two footer rows, the first spanning two columns.
function Footed() {
  return (
    <Table aria-label="Label" style={CALL_SITE}>
      <Table.Header>
        <Table.Column id="colName">Label</Table.Column>
        <Table.Column id="colStatus">Status</Table.Column>
        <Table.Column id="colValue">Value</Table.Column>
      </Table.Header>
      <Table.Body>
        <Table.Row id="first">
          <Table.Cell>First item</Table.Cell>
          <Table.Cell>Ready</Table.Cell>
          <Table.Cell>01</Table.Cell>
        </Table.Row>
      </Table.Body>
      <Table.Footer style={CALL_SITE} testID="footer">
        <Table.Row id="total" style={CALL_SITE} testID="total">
          <Table.Cell colSpan={2} style={CALL_SITE} testID="cell">
            Total
          </Table.Cell>
          <Table.Cell>
            <Text testID="sum">06</Text>
          </Table.Cell>
        </Table.Row>
        <Table.Row id="average">
          <Table.Cell>Average</Table.Cell>
          <Table.Cell>-</Table.Cell>
          <Table.Cell>02</Table.Cell>
        </Table.Row>
        {null}
        Stray text
      </Table.Footer>
    </Table>
  )
}

// Every resize handle the table draws, in order.
function handles() {
  return screen.getAllByRole('slider')
}

// A column's header, by its name.
function headerOf(name: string) {
  return instance(instance(screen.getByText(name).parent).parent)
}

// The header row, which holds every column's header.
function headerRow() {
  return instance(headerOf('Label').parent)
}

// Shows the icon style a cell hands what it holds.
function IconProbe() {
  const { color, size } = useIconStyle()
  return <Text testID="probe">{`${String(color)} ${String(size)}`}</Text>
}

// A node of the tree that is an element rather than text.
function instance(node: null | TestNode | undefined): TestInstance {
  if (node === null || node === undefined || typeof node === 'string') {
    throw new TypeError('expected an element')
  }
  return node
}

// The keys the latest change reported, in order.
function keysOf(onSelectionChange: jest.Mock<(keys: Selection) => void>) {
  const keys = onSelectionChange.mock.calls.at(-1)?.[0]

  if (keys === undefined) {
    throw new TypeError('expected a change')
  }
  return keys === 'all' ? 'all' : [...keys].map(String).toSorted()
}

// The table laid out at `WIDTH`, through the box `style` lands on.
async function layOut() {
  await fireEvent(instance(screen.root), 'layout', LAYOUT)
}

function list() {
  return screen.getByLabelText('Label')
}

// A table whose body ends in a LoadMore given these props.
function Loading(props: {
  readonly isLoading?: boolean
  readonly onLoadMore?: () => void
  readonly scrollOffset?: number
}) {
  return (
    <Table aria-label="Label">
      <Table.Header>
        <Table.Column id="colName">Label</Table.Column>
        <Table.Column id="colValue">Value</Table.Column>
      </Table.Header>
      <Table.Body>
        {ROWS}
        <Table.LoadMore label="Fetching" testID="loader" {...props} />
      </Table.Body>
    </Table>
  )
}

// An element an empty table draws in place of rows.
function nothing(): ReactNode {
  return <Text testID="nothing">Nothing to show</Text>
}

// What an empty table draws in place of rows.
function nothingToShow() {
  return 'Nothing to show'
}

function Resizable(props: Partial<Parameters<typeof Table>[0]>) {
  return (
    <Table
      aria-label="Label"
      resizable
      style={CALL_SITE}
      testID="table"
      {...props}
    >
      <Table.Header>
        <Table.Column id="colName" resizable>
          Label
        </Table.Column>
        <Table.Column id="colStatus">Status</Table.Column>
        <Table.Column id="colValue" resizable>
          Value
        </Table.Column>
      </Table.Header>
      <Table.Body>
        <Table.Row id="first">
          <Table.Cell>First item</Table.Cell>
          <Table.Cell>Ready</Table.Cell>
          <Table.Cell>01</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  )
}

// A row, by the text of one of its cells.
function rowOf(text: string) {
  return screen.getByRole('button', { name: new RegExp(text) })
}

// The rule a resize handle draws, its only child.
function ruleOf(handle: TestInstance) {
  return instance(handle.children.at(0))
}

// The horizontal scroll view the table is drawn in.
function scroller() {
  return instance(
    screen.root?.queryAll((node) => node.type === 'RCTScrollView').at(0),
  )
}

// The select-all checkbox, the first checkbox the table draws.
function selectAll() {
  return screen.getAllByRole('checkbox').at(0)
}

function Selecting(props: Partial<Parameters<typeof Table>[0]>) {
  return (
    <Table
      aria-label="Label"
      selectionMode="multiple"
      testID="table"
      {...props}
    >
      <Table.Header>
        <Table.Column id="colSelect" selection />
        <Table.Column id="colName">Label</Table.Column>
      </Table.Header>
      <Table.Body>{SELECTING_ROWS}</Table.Body>
    </Table>
  )
}

function Sortable(props: Partial<Parameters<typeof Table>[0]>) {
  return (
    <Table aria-label="Label" testID="table" {...props}>
      <Table.Header>
        <Table.Column allowsSorting id="colName">
          Label
        </Table.Column>
        <Table.Column id="colValue">Value</Table.Column>
      </Table.Header>
      <Table.Body>{ROWS}</Table.Body>
    </Table>
  )
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle & ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

// The widths each column's header is drawn at, in order.
function widthsOf(...names: string[]) {
  return names.map((name) => styleOf(headerOf(name)).width)
}
// Each case's spies and replaced properties, the platform and the layout
// direction among them, go back as they were.
afterEach(() => {
  jest.restoreAllMocks()
})

describe('Table', () => {
  describe('the parts', () => {
    it('throws without a header or a body', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(
        render(
          <Table aria-label="Label">
            <Table.Body>{ROWS}</Table.Body>
          </Table>,
        ),
      ).rejects.toThrow('A Table holds a Table.Header and a Table.Body.')
      await expect(
        render(
          <Table aria-label="Label">
            <Table.Header>
              <Table.Column id="colName">Label</Table.Column>
            </Table.Header>
          </Table>,
        ),
      ).rejects.toThrow('A Table holds a Table.Header and a Table.Body.')
    })

    it('throws when a row’s cells do not fill its columns', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(
        render(
          <Table aria-label="Label">
            <Table.Header>
              <Table.Column id="colName">Label</Table.Column>
              <Table.Column id="colValue">Value</Table.Column>
            </Table.Header>
            <Table.Body>
              <Table.Row id="first">
                <Table.Cell>First item</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table>,
        ),
      ).rejects.toThrow(
        'Cell count must match column count. Found 1 cells and 2 columns.',
      )
    })

    it('draws nothing from a part on its own', async () => {
      await render(
        <>
          <Table.Header />
          <Table.Column />
          <Table.Body />
          <Table.Row />
          <Table.Cell>First item</Table.Cell>
          <Table.LoadMore isLoading />
          <Table.Footer />
        </>,
      )

      expect(screen.toJSON()).toBeNull()
    })

    it('draws columns from `columns` and rows from `items`, each through a function', async () => {
      await render(<Dynamic />)

      expect(screen.getByText('Label')).toBeTruthy()
      expect(screen.getByText('Value')).toBeTruthy()
      expect(screen.getByText('First item')).toBeTruthy()
      expect(screen.getByText('02')).toBeTruthy()
    })

    it('keeps the rows it built when rerendered with the same columns and items', async () => {
      await render(<Dynamic />)

      await screen.rerender(<Dynamic testID="table" />)

      expect(screen.getByText('First item')).toBeTruthy()
      expect(screen.getByText('02')).toBeTruthy()
    })

    it('rebuilds a cached row once its columns change order', async () => {
      await render(<Dynamic />)

      await screen.rerender(<Dynamic columns={REVERSED} />)

      expect(
        screen
          .getAllByText(/^(?:First item|01|Label|Value)$/u)
          .flatMap((text) =>
            text.children.filter((child) => typeof child === 'string'),
          ),
      ).toEqual(['Value', 'Label', '01', 'First item'])
    })

    it('builds its columns once under StrictMode', async () => {
      await render(
        <StrictMode>
          <Basic />
        </StrictMode>,
      )

      expect(screen.getAllByText('Label')).toHaveLength(1)
      expect(screen.getByText('First item')).toBeTruthy()
    })

    it('rebuilds the rows against new columns', async () => {
      await render(<Basic />)

      await screen.rerender(
        <Table aria-label="Label">
          <Table.Header>
            <Table.Column id="colValue">Value</Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Row id="first">
              {(columnKey: Key) => <Table.Cell>{String(columnKey)}</Table.Cell>}
            </Table.Row>
          </Table.Body>
        </Table>,
      )

      expect(screen.queryByText('Label')).toBeNull()
      expect(screen.getByText('colValue')).toBeTruthy()
    })
  })

  describe('the header', () => {
    it('names each column in label large, in the muted role', async () => {
      await render(<Basic />)

      expect(styleOf(screen.getByText('Label'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.labelLargeSize,
      })
      expect(styleOf(instance(screen.getByText('Label').parent))).toMatchObject(
        {
          alignItems: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
        },
      )
    })

    it('is 56dp tall with a rule under it', async () => {
      await render(<Basic />)

      expect(styleOf(headerRow())).toMatchObject({
        borderBottomColor: colors.outlineVariant,
        borderBottomWidth: 1,
        minHeight: sizing.rowSm,
      })
    })

    it('draws a column’s name as given when it is not text', async () => {
      await render(
        <Table aria-label="Label">
          <Table.Header>
            <Table.Column id="colName" textValue="Label">
              <Text testID="name">Label</Text>
            </Table.Column>
          </Table.Header>
          <Table.Body />
        </Table>,
      )

      expect(styleOf(screen.getByTestId('name')).color).toBeUndefined()
    })

    it('takes the style and testID a column is given', async () => {
      await render(
        <Table aria-label="Label">
          <Table.Header style={CALL_SITE} testID="header">
            <Table.Column id="colName" style={CALL_SITE} testID="column">
              Label
            </Table.Column>
          </Table.Header>
          <Table.Body />
        </Table>,
      )

      expect(styleOf(screen.getByTestId('header')).marginTop).toBe(4)
      expect(styleOf(screen.getByTestId('column')).marginTop).toBe(4)
    })
  })

  describe('the widths', () => {
    it('shares the window’s width among the columns until it is laid out', async () => {
      await render(<Basic />)

      const half = Dimensions.get('window').width / 2
      expect(widthsOf('Label', 'Value')).toEqual([half, half])
    })

    it('shares its own width among the columns once laid out', async () => {
      await render(<Basic />)
      await layOut()

      expect(widthsOf('Label', 'Value')).toEqual([300, 300])
      expect(styleOf(cellOf('First item')).width).toBe(300)
      expect(scroller().props.scrollEnabled).toBe(false)
      expect(scroller().props.focusable).toBe(false)
    })

    it('takes each column’s default width, minimum and maximum', async () => {
      await render(
        <Table aria-label="Label" style={CALL_SITE}>
          <Table.Header>
            <Table.Column defaultWidth="2fr" id="colName">
              Label
            </Table.Column>
            <Table.Column defaultWidth={100} id="colStatus">
              Status
            </Table.Column>
            <Table.Column id="colValue" maxWidth={80}>
              Value
            </Table.Column>
          </Table.Header>
          <Table.Body />
        </Table>,
      )
      await layOut()

      expect(widthsOf('Label', 'Status', 'Value')).toEqual([420, 100, 80])
    })

    it('gives the checkbox column its box and padding, and the rest to the others', async () => {
      await render(<Selecting style={CALL_SITE} />)
      await layOut()

      const box = 2 * spacing.lg + 40
      expect(styleOf(headerOf('Label')).width).toBe(WIDTH - box)
      expect(styleOf(instance(headerRow().children.at(0)))).toMatchObject({
        alignItems: 'center',
        width: box,
      })
    })

    it('scrolls sideways once its columns are wider than it is', async () => {
      await render(
        <Table aria-label="Label" style={CALL_SITE}>
          <Table.Header>
            <Table.Column defaultWidth={400} id="colName">
              Label
            </Table.Column>
            <Table.Column defaultWidth={400} id="colValue">
              Value
            </Table.Column>
          </Table.Header>
          <Table.Body />
        </Table>,
      )
      await layOut()

      expect(scroller().props.scrollEnabled).toBe(true)
      expect(scroller().props.focusable).toBe(true)
      expect(scroller().props.horizontal).toBe(true)
    })

    it('draws a cell across the columns it spans', async () => {
      await render(
        <Table aria-label="Label" style={CALL_SITE}>
          <Table.Header>
            <Table.Column id="colName">Label</Table.Column>
            <Table.Column id="colStatus">Status</Table.Column>
            <Table.Column id="colValue">Value</Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Row id="first">
              <Table.Cell colSpan={2}>First item</Table.Cell>
              <Table.Cell>01</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>,
      )
      await layOut()

      expect(styleOf(cellOf('First item')).width).toBe(400)
      expect(styleOf(cellOf('01')).width).toBe(200)
    })
  })

  describe('the rows', () => {
    it('is found by its label, with a row for each one', async () => {
      await render(<Basic />)

      expect(list()).toBeInstanceOf(Object)
      expect(screen.getByText('First item')).toBeTruthy()
      expect(screen.getByText('Third item')).toBeTruthy()
    })

    it('sets a cell’s text in body medium, padded 16dp each side', async () => {
      await render(<Basic />)

      expect(styleOf(screen.getByText('First item'))).toMatchObject({
        color: colors.onSurface,
        fontSize: typography.bodyMediumSize,
      })
      expect(styleOf(cellOf('First item'))).toMatchObject({
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
      })
    })

    it('draws nothing in a cell with nothing in it', async () => {
      await render(
        <Table aria-label="Label">
          <Table.Header>
            <Table.Column id="colName">Label</Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Row id="first" textValue="First item">
              <Table.Cell testID="cell" />
            </Table.Row>
          </Table.Body>
        </Table>,
      )

      expect(screen.getByTestId('cell').children).toHaveLength(0)
    })

    it('draws a cell’s elements as given, with an icon in the row’s colour', async () => {
      await render(
        <Table aria-label="Label">
          <Table.Header>
            <Table.Column id="colName">Label</Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Row id="first" textValue="First item">
              <Table.Cell style={CALL_SITE} testID="cell">
                <IconProbe />
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>,
      )

      expect(screen.getByTestId('probe')).toHaveTextContent(
        `${colors.onSurface} 24`,
      )
      expect(styleOf(screen.getByTestId('cell')).marginTop).toBe(4)
    })

    it('draws each row 52dp tall, with a rule above all but the first', async () => {
      await render(<Basic />)

      const first = instance(cellOf('First item').parent)
      const second = instance(cellOf('Second item').parent)
      expect(styleOf(first)).toMatchObject({ minHeight: 52 })
      expect(styleOf(first).borderTopWidth).toBeUndefined()
      expect(styleOf(second)).toMatchObject({
        borderTopColor: colors.outlineVariant,
        borderTopWidth: 1,
        minHeight: 52,
      })
    })

    it('presents a row with nothing to do on a press, with no role', async () => {
      await render(<Basic />)

      const row = instance(cellOf('First item').parent)
      expect(row.props.role).toBeUndefined()
      expect(row.props.onPress).toBeUndefined()
      expect(screen.queryAllByRole('button')).toHaveLength(0)
    })

    it('marks a disabled row that only presents as one', async () => {
      await render(<Basic disabledKeys={SECOND} />)

      expect(
        instance(cellOf('Second item').parent).props['aria-disabled'],
      ).toBe(true)
      expect(
        instance(cellOf('First item').parent).props['aria-disabled'],
      ).toBeUndefined()
    })

    it('takes the style, ref and testID a row is given', async () => {
      const ref = createRef<never>()
      await render(
        <Table aria-label="Label">
          <Table.Header>
            <Table.Column id="colName">Label</Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Row id="first" ref={ref} style={CALL_SITE} testID="row">
              <Table.Cell>First item</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>,
      )

      expect(styleOf(screen.getByTestId('row')).marginTop).toBe(4)
      expect(ref.current).not.toBeNull()
    })

    it('runs onRowAction with the row’s key on a press', async () => {
      const onRowAction = jest.fn<(key: Key) => void>()
      await render(<Basic onRowAction={onRowAction} />)

      await fireEvent.press(rowOf('Second item'), PRESS)

      expect(onRowAction).toHaveBeenCalledWith('second')
      expect(rowOf('Second item').props.role).toBe('button')
    })

    it('runs a row’s own onAction in place of the table’s, and the call site’s onPress beside it', async () => {
      const onAction = jest.fn()
      const onPress = jest.fn()
      const onRowAction = jest.fn()
      await render(
        <Table aria-label="Label" onRowAction={onRowAction}>
          <Table.Header>
            <Table.Column id="colName">Label</Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Row id="first" onAction={onAction} onPress={onPress}>
              <Table.Cell>First item</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>,
      )

      await fireEvent.press(rowOf('First item'), PRESS)

      expect(onAction).toHaveBeenCalledTimes(1)
      expect(onPress).toHaveBeenCalledTimes(1)
      expect(onRowAction).not.toHaveBeenCalled()
    })

    it('presses a row with only an onPress, as a button', async () => {
      const onPress = jest.fn()
      await render(
        <Table aria-label="Label">
          <Table.Header>
            <Table.Column id="colName">Label</Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Row id="first" onPress={onPress}>
              <Table.Cell>First item</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>,
      )

      await fireEvent.press(rowOf('First item'), PRESS)

      expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('opens a row’s href through the RouterProvider, as a link', async () => {
      const navigate = jest.fn()
      await render(
        <RouterProvider navigate={navigate}>
          <Table aria-label="Label">
            <Table.Header>
              <Table.Column id="colName">Label</Table.Column>
            </Table.Header>
            <Table.Body>
              <Table.Row href="/first" id="first">
                <Table.Cell>First item</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table>
        </RouterProvider>,
      )

      const row = screen.getByRole('link', { name: /First item/ })
      await fireEvent.press(row, PRESS)

      expect(navigate).toHaveBeenCalledWith('/first')
    })
  })

  describe('selection', () => {
    it('selects a row on a press, and says it is selected', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(<Selecting onSelectionChange={onSelectionChange} />)

      await fireEvent.press(rowOf('Second item'), PRESS)

      expect(keysOf(onSelectionChange)).toEqual(['second'])
      expect(
        screen.getByRole('button', { name: /Second item/, selected: true }),
      ).toBeTruthy()
      expect(
        screen.getByRole('button', { name: /First item/, selected: false }),
      ).toBeTruthy()
    })

    it('draws a selected row on primary container, its text and checkbox on the matching role', async () => {
      await render(<Selecting defaultSelectedKeys={SECOND} />)

      const selected = rowOf('Second item')
      expect(styleOf(selected).backgroundColor).toBe(colors.primaryContainer)
      expect(styleOf(rowOf('First item')).backgroundColor).toBeUndefined()
      expect(styleOf(screen.getByText('Second item')).color).toBe(
        colors.onPrimaryContainer,
      )
      expect(boxIn(selected)).toHaveLength(1)
      expect(checksIn(selected)).toHaveLength(1)
      expect(checksIn(rowOf('First item'))).toHaveLength(0)
    })

    it('names the select action by selectLabel, and in the device language otherwise', async () => {
      const { rerender } = await render(<Selecting />)

      expect(rowOf('First item').props.accessibilityActions).toEqual([
        { label: 'Select', name: 'select' },
      ])

      await rerender(<Selecting selectLabel="Pick" />)

      expect(rowOf('First item').props.accessibilityActions).toEqual([
        { label: 'Pick', name: 'select' },
      ])

      await rerender(
        <I18nProvider locale="de-DE">
          <Selecting />
        </I18nProvider>,
      )

      expect(rowOf('First item').props.accessibilityActions).toEqual([
        { label: 'Auswählen', name: 'select' },
      ])
    })

    it('selects a row from the select action, and ignores any other', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(<Selecting onSelectionChange={onSelectionChange} />)

      await fireEvent(
        rowOf('Third item'),
        'accessibilityAction',
        action('expand'),
      )
      expect(onSelectionChange).not.toHaveBeenCalled()

      await fireEvent(
        rowOf('Third item'),
        'accessibilityAction',
        action('select'),
      )
      expect(keysOf(onSelectionChange)).toEqual(['third'])
    })

    it('runs the action while nothing is selected, and selects once something is', async () => {
      const onLongPress = jest.fn()
      const onRowAction = jest.fn()
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <Selecting
          onRowAction={onRowAction}
          onSelectionChange={onSelectionChange}
        />,
      )

      await fireEvent.press(rowOf('First item'), PRESS)
      expect(onRowAction).toHaveBeenCalledWith('first')
      expect(onSelectionChange).not.toHaveBeenCalled()

      await fireEvent(rowOf('First item'), 'longPress', PRESS)
      expect(keysOf(onSelectionChange)).toEqual(['first'])

      await fireEvent.press(rowOf('Second item'), PRESS)
      expect(keysOf(onSelectionChange)).toEqual(['first', 'second'])
      expect(onRowAction).toHaveBeenCalledTimes(1)
      expect(onLongPress).not.toHaveBeenCalled()
    })

    it('runs the call site’s onLongPress on a row that only selects', async () => {
      const onLongPress = jest.fn()
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <Table
          aria-label="Label"
          onSelectionChange={onSelectionChange}
          selectionMode="multiple"
        >
          <Table.Header>
            <Table.Column id="colName">Label</Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Row id="first" onLongPress={onLongPress}>
              <Table.Cell>First item</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>,
      )

      await fireEvent(rowOf('First item'), 'longPress', PRESS)

      expect(onLongPress).toHaveBeenCalledTimes(1)
      expect(onSelectionChange).not.toHaveBeenCalled()
    })

    it('selects through the checkbox on a row whose press acts', async () => {
      const onRowAction = jest.fn()
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(
        <Selecting
          onRowAction={onRowAction}
          onSelectionChange={onSelectionChange}
        />,
      )

      const box = rowOf('Second item')
        .queryAll(
          (node) =>
            node.props.accessible === false &&
            typeof node.props.onClick === 'function',
        )
        .at(0)
      await fireEvent.press(instance(box), PRESS)

      expect(keysOf(onSelectionChange)).toEqual(['second'])
      expect(onRowAction).not.toHaveBeenCalled()
    })

    it('draws the checkbox for the eye on a row whose press selects', async () => {
      await render(<Selecting />)

      expect(
        rowOf('Second item').queryAll(
          (node) =>
            node.props.accessible === false &&
            typeof node.props.onClick === 'function',
        ),
      ).toHaveLength(0)
    })

    it.each(['Second item', 'Fourth item'])(
      'takes no press, offers no selection and draws faded on a disabled row, selected or not: %s',
      async (text) => {
        const onSelectionChange = jest.fn<(keys: Selection) => void>()
        const onRowAction = jest.fn()
        await render(
          <Table
            aria-label="Label"
            defaultSelectedKeys={EVERY_ROW}
            disabledKeys={SECOND}
            onRowAction={onRowAction}
            onSelectionChange={onSelectionChange}
            selectionMode="multiple"
          >
            <Table.Header>
              <Table.Column id="colSelect" selection />
              <Table.Column id="colName">Label</Table.Column>
            </Table.Header>
            <Table.Body>
              {SELECTING_ROWS}
              <Table.Row id="fourth" isDisabled>
                <Table.Cell selection />
                <Table.Cell>Fourth item</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table>,
        )

        const row = screen.getByRole('button', {
          disabled: true,
          name: new RegExp(text),
        })
        await fireEvent.press(row, PRESS)

        expect(row.props.accessibilityActions).toBeUndefined()
        expect(styleOf(row).backgroundColor).toBeUndefined()
        expect(styleOf(screen.getByText(text)).color).toBe(
          withOpacity(colors.onSurface, stateLayerOpacity.disabledContent),
        )
        expect(onRowAction).not.toHaveBeenCalled()
        expect(onSelectionChange).not.toHaveBeenCalled()
      },
    )

    it('leaves a disabled row its action under disabledBehavior selection', async () => {
      const onRowAction = jest.fn()
      await render(
        <Selecting
          disabledBehavior="selection"
          disabledKeys={SECOND}
          onRowAction={onRowAction}
        />,
      )

      const row = rowOf('Second item')
      await fireEvent.press(row, PRESS)

      expect(onRowAction).toHaveBeenCalledWith('second')
      expect(row.props.accessibilityActions).toBeUndefined()
    })
  })

  describe('select all', () => {
    it('is a checkbox named Select All in multiple mode, and Select in single mode', async () => {
      const { rerender } = await render(<Selecting />)

      expect(
        screen.getByRole('checkbox', { name: 'Select All' }),
      ).not.toBeDisabled()

      await rerender(<Selecting selectionMode="single" />)

      expect(screen.getByRole('checkbox', { name: 'Select' })).toBeDisabled()

      await rerender(<Selecting selectAllLabel="Every row" />)

      expect(screen.getByRole('checkbox', { name: 'Every row' })).toBeTruthy()
    })

    it('is unchecked, mixed or checked as the rows are', async () => {
      const { rerender } = await render(<Selecting />)
      expect(selectAll()).not.toBeChecked()
      expect(selectAll()).not.toBePartiallyChecked()

      await rerender(<Selecting selectedKeys={SECOND} />)
      expect(selectAll()).toBePartiallyChecked()

      await rerender(<Selecting selectedKeys="all" />)
      expect(selectAll()).toBeChecked()
    })

    it('selects every row, then none', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(<Selecting onSelectionChange={onSelectionChange} />)

      await fireEvent.press(instance(selectAll()))
      expect(keysOf(onSelectionChange)).toBe('all')

      await fireEvent.press(instance(selectAll()))
      expect(keysOf(onSelectionChange)).toEqual([])
    })

    it('is disabled with no rows to select', async () => {
      await render(
        <Table aria-label="Label" selectionMode="multiple">
          <Table.Header>
            <Table.Column id="colSelect" selection />
            <Table.Column id="colName">Label</Table.Column>
          </Table.Header>
          <Table.Body />
        </Table>,
      )

      expect(selectAll()).toBeDisabled()
    })
  })

  describe('sorting', () => {
    it('makes a sortable column’s header a button saying it sorts', async () => {
      await render(<Sortable />)

      expect(
        screen.getByRole('button', { name: 'Label, sortable column' }),
      ).toBeTruthy()
      expect(screen.queryByRole('button', { name: /Value/ })).toBeNull()
    })

    it('says and draws the direction of the column it sorts by', async () => {
      const { rerender } = await render(<Sortable sortDescriptor={SORTED} />)

      const up = screen.getByRole('button', {
        name: 'Label, sortable column, ascending',
      })
      expect(
        up.queryAll((node) => node.props.d === arrowUpwardPath),
      ).toHaveLength(1)
      expect(
        up.queryAll((node) => node.props.d === arrowDownwardPath),
      ).toHaveLength(0)
      expect(
        styleOf(
          instance(up.queryAll((node) => node.type === 'RNSVGSvgView').at(0)),
        ),
      ).toMatchObject({ height: 18, width: 18 })

      await rerender(<Sortable sortDescriptor={SORTED_DOWN} />)

      const down = screen.getByRole('button', {
        name: 'Label, sortable column, descending',
      })
      expect(
        down.queryAll((node) => node.props.d === arrowDownwardPath),
      ).toHaveLength(1)
    })

    it('draws no arrow on a sortable column it is not sorted by', async () => {
      await render(<Sortable />)

      expect(
        rowOf('Label').queryAll((node) => node.type === 'RNSVGPath'),
      ).toHaveLength(0)
    })

    it('asks to sort ascending, then the other way round', async () => {
      const onSortChange = jest.fn<(descriptor: SortDescriptor) => void>()
      const { rerender } = await render(
        <Sortable onSortChange={onSortChange} />,
      )

      await fireEvent.press(rowOf('Label'), PRESS)
      expect(onSortChange).toHaveBeenLastCalledWith(SORTED)

      await rerender(
        <Sortable onSortChange={onSortChange} sortDescriptor={SORTED} />,
      )
      await fireEvent.press(rowOf('Label'), PRESS)
      expect(onSortChange).toHaveBeenLastCalledWith(SORTED_DOWN)
    })

    it('says how the rows are sorted once they are, on Android in a live region', async () => {
      jest.replaceProperty(Platform, 'OS', 'android')
      const { rerender } = await render(<Sortable />)

      expect(screen.queryByText(/sorted by/)).toBeNull()

      await rerender(<Sortable sortDescriptor={SORTED} />)

      const status = screen.getByText(
        'sorted by column Label in ascending order',
      )
      expect(instance(status.parent).props['aria-live']).toBe('polite')
    })

    it('announces the sort on iOS once it changes', async () => {
      jest.replaceProperty(Platform, 'OS', 'ios')
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation(() => undefined)
      // The preset's own mock, which keeps what earlier cases announced.
      announce.mockClear()
      const { rerender } = await render(<Sortable sortDescriptor={SORTED} />)

      expect(announce).not.toHaveBeenCalled()

      await rerender(<Sortable sortDescriptor={SORTED_DOWN} />)

      expect(announce).toHaveBeenCalledWith(
        'sorted by column Label in descending order',
      )
    })

    it('names a sorted column by its key when no column has it', async () => {
      jest.replaceProperty(Platform, 'OS', 'android')
      await render(<Sortable sortDescriptor={GONE} />)

      expect(
        screen.getByText('sorted by column gone in ascending order'),
      ).toBeTruthy()
    })
  })

  describe('resizing', () => {
    it('draws a handle at the end of each resizable column, as a slider', async () => {
      await render(<Resizable />)
      await layOut()

      const [name, value] = handles()
      expect(handles()).toHaveLength(2)
      expect(name.props['aria-label']).toBe('Resizer Label')
      expect(value.props['aria-label']).toBe('Resizer Value')
      expect(name).toHaveAccessibilityValue({
        max: Number.MAX_SAFE_INTEGER,
        min: 75,
        now: 200,
        text: '200 pixels',
      })
      expect(styleOf(instance(name))).toMatchObject({ start: 188, width: 24 })
      // The last column's handle keeps the half inside the table.
      expect(styleOf(instance(value))).toMatchObject({ start: 588, width: 12 })
      expect(styleOf(ruleOf(instance(name)))).toMatchObject({
        backgroundColor: colors.outlineVariant,
        end: 12,
        width: 1,
      })
      expect(styleOf(ruleOf(instance(value))).end).toBe(0)
    })

    it('names a handle by resizeLabel', async () => {
      await render(<Resizable resizeLabel="Width of" />)

      expect(handles().at(0)?.props['aria-label']).toBe('Width of Label')
    })

    it('draws no handles on a table that does not resize', async () => {
      await render(<Resizable resizable={false} />)

      expect(screen.queryAllByRole('slider')).toHaveLength(0)
    })

    it('widens a column as its handle is dragged, and reports the widths', async () => {
      const onResize = jest.fn<(widths: Map<Key, ColumnSize>) => void>()
      const onResizeEnd = jest.fn<(widths: Map<Key, ColumnSize>) => void>()
      await render(<Resizable onResize={onResize} onResizeEnd={onResizeEnd} />)
      await layOut()

      await act(() => {
        fireGestureHandler(getByGestureTestId('table-resize-colName'), [
          { state: State.BEGAN, translationX: 0 },
          { state: State.ACTIVE, translationX: 20 },
          { state: State.ACTIVE, translationX: 50 },
          { state: State.END, translationX: 50 },
        ])
      })

      const widths = new Map<Key, ColumnSize>([
        ['colName', 250],
        ['colStatus', '1fr'],
        ['colValue', '1fr'],
      ])
      expect(onResize).toHaveBeenLastCalledWith(widths)
      expect(onResizeEnd).toHaveBeenCalledTimes(1)
      expect(onResizeEnd).toHaveBeenCalledWith(widths)
      expect(widthsOf('Label', 'Status', 'Value')).toEqual([250, 175, 175])
    })

    it('reads a drag from the right under a right-to-left layout', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(<Resizable />)
      await layOut()

      await act(() => {
        fireGestureHandler(getByGestureTestId('table-resize-colName'), [
          { state: State.BEGAN, translationX: 0 },
          { state: State.ACTIVE, translationX: 50 },
          { state: State.END, translationX: 50 },
        ])
      })

      expect(widthsOf('Label')).toEqual([150])
    })

    it('holds a column at its minimum', async () => {
      await render(<Resizable />)
      await layOut()

      await act(() => {
        fireGestureHandler(getByGestureTestId('table-resize-colName'), [
          { state: State.BEGAN, translationX: 0 },
          { state: State.ACTIVE, translationX: -500 },
          { state: State.END, translationX: -500 },
        ])
      })

      expect(widthsOf('Label')).toEqual([75])
    })

    it('thickens the rule in primary while its column is dragged', async () => {
      await render(<Resizable />)
      await layOut()
      const { handlerTag } = getByGestureTestId('table-resize-colName')
      const send = async (name: string, event: object) => {
        await act(() => {
          DeviceEventEmitter.emit(name, { handlerTag, ...event })
        })
      }

      await send('onGestureHandlerStateChange', {
        oldState: State.UNDETERMINED,
        state: State.BEGAN,
        translationX: 0,
      })
      await send('onGestureHandlerStateChange', {
        oldState: State.BEGAN,
        state: State.ACTIVE,
        translationX: 10,
      })

      expect(styleOf(ruleOf(instance(handles().at(0))))).toMatchObject({
        backgroundColor: colors.primary,
        width: 2,
      })
      expect(styleOf(ruleOf(instance(handles().at(1))))).toMatchObject({
        backgroundColor: colors.outlineVariant,
        width: 1,
      })

      await send('onGestureHandlerStateChange', {
        oldState: State.ACTIVE,
        state: State.END,
        translationX: 10,
      })

      expect(styleOf(ruleOf(instance(handles().at(0)))).width).toBe(1)
    })

    it('ends a drag that never started without reporting anything', async () => {
      const onResizeEnd = jest.fn()
      await render(<Resizable onResizeEnd={onResizeEnd} />)
      const { handlerTag } = getByGestureTestId('table-resize-colName')

      await act(() => {
        DeviceEventEmitter.emit('onGestureHandlerStateChange', {
          handlerTag,
          oldState: State.UNDETERMINED,
          state: State.FAILED,
        })
      })

      expect(onResizeEnd).not.toHaveBeenCalled()
    })

    it('steps a column by 10dp from a screen reader, reporting each step once', async () => {
      const onResize = jest.fn<(widths: Map<Key, ColumnSize>) => void>()
      const onResizeEnd = jest.fn<(widths: Map<Key, ColumnSize>) => void>()
      await render(<Resizable onResize={onResize} onResizeEnd={onResizeEnd} />)
      await layOut()

      await fireEvent(
        instance(handles().at(0)),
        'accessibilityAction',
        action('increment'),
      )

      expect(widthsOf('Label')).toEqual([210])
      expect(onResize).toHaveBeenCalledTimes(1)
      expect(onResizeEnd).toHaveBeenCalledTimes(1)
      expect(onResizeEnd.mock.calls.at(0)?.[0].get('colName')).toBe(210)

      await fireEvent(
        instance(handles().at(0)),
        'accessibilityAction',
        action('decrement'),
      )
      await fireEvent(
        instance(handles().at(0)),
        'accessibilityAction',
        action('decrement'),
      )

      expect(widthsOf('Label')).toEqual([190])
      expect(handles().at(0)).toHaveAccessibilityValue({ now: 190 })

      await fireEvent(
        instance(handles().at(0)),
        'accessibilityAction',
        action('activate'),
      )

      expect(onResizeEnd).toHaveBeenCalledTimes(3)
    })

    it('holds the sideways scroll inside a root for gestures', async () => {
      await render(<Resizable />)

      expect(styleOf(instance(screen.root)).marginTop).toBe(4)
      expect(getByGestureTestId('table-resize-colValue')).toBeTruthy()
    })
  })

  describe('the header’s place', () => {
    it('draws the header as the list’s first cell, so it scrolls with the rows', async () => {
      await render(<Basic />)

      const header = headerRow()
      expect(list().queryAll((node) => node === header)).toHaveLength(1)
    })

    it('draws a sticky header above the rows, outside the list', async () => {
      await render(<Basic stickyHeader />)

      const header = headerRow()
      expect(list().queryAll((node) => node === header)).toHaveLength(0)
      expect(screen.getByText('First item')).toBeTruthy()
    })
  })

  describe('the empty state', () => {
    it('draws renderEmptyState’s text muted, padded and centred', async () => {
      await render(<Empty />)

      const text = screen.getByText('Nothing to show')
      expect(styleOf(text)).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.bodyMediumSize,
        textAlign: 'center',
      })
      expect(styleOf(instance(text.parent))).toMatchObject({
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xxl,
      })
    })

    it('draws an element renderEmptyState returns as it is', async () => {
      await render(
        <Table aria-label="Label">
          <Table.Header>
            <Table.Column id="colName">Label</Table.Column>
          </Table.Header>
          <Table.Body renderEmptyState={nothing} />
        </Table>,
      )

      expect(styleOf(screen.getByTestId('nothing')).color).toBeUndefined()
    })

    it('shows nothing in place of rows while the first are loading', async () => {
      await render(<Empty loading />)

      expect(screen.queryByText('Nothing to show')).toBeNull()

      await screen.rerender(<Empty loading={false} />)

      expect(screen.getByText('Nothing to show')).toBeTruthy()
    })

    it('draws nothing in place of rows without renderEmptyState', async () => {
      await render(
        <Table aria-label="Label">
          <Table.Header>
            <Table.Column id="colName">Label</Table.Column>
          </Table.Header>
          <Table.Body />
        </Table>,
      )

      expect(list().props.ListEmptyComponent).toBeUndefined()
    })
  })

  describe('loading more', () => {
    it('draws the ring after the rows while loading, a row tall, in a live region', async () => {
      await render(<Loading isLoading />)

      const loader = screen.getByTestId('loader')
      expect(loader.props['aria-live']).toBe('polite')
      expect(styleOf(loader).minHeight).toBe(52)
      expect(screen.getByRole('progressbar', { name: 'Fetching' })).toBeTruthy()
    })

    it('keeps the live region, empty, while idle', async () => {
      await render(<Loading />)

      const loader = screen.getByTestId('loader')
      expect(loader.children).toHaveLength(0)
      expect(styleOf(loader).minHeight).toBeUndefined()
    })

    it('asks for more once the end of the table is in view, and not while a load is under way', async () => {
      const onLoadMore = jest.fn()
      const { rerender } = await render(<Loading onLoadMore={onLoadMore} />)

      await fireEvent(list(), 'layout', LAYOUT)
      await fireEvent(list(), 'contentSizeChange', 320, 200)

      expect(onLoadMore).toHaveBeenCalledTimes(1)
      expect(list().props.onEndReachedThreshold).toBe(1)

      await rerender(
        <Loading isLoading onLoadMore={onLoadMore} scrollOffset={2} />,
      )
      expect(list().props.onEndReachedThreshold).toBe(2)
    })

    it('asks for nothing without a LoadMore', async () => {
      await render(<Basic />)

      expect(list().props.onEndReached).toBeUndefined()
    })
  })

  describe('the footer', () => {
    it('draws its rows under the body, ruled off, in label large and the muted role', async () => {
      await render(<Footed />)
      await layOut()

      expect(styleOf(screen.getByTestId('footer'))).toMatchObject({
        borderTopColor: colors.outlineVariant,
        borderTopWidth: 1,
        marginTop: 4,
      })
      expect(styleOf(screen.getByText('Total'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.labelLargeSize,
      })
      expect(styleOf(screen.getByTestId('total'))).toMatchObject({
        marginTop: 4,
        minHeight: 52,
      })
      expect(
        styleOf(screen.getByTestId('total')).borderTopWidth,
      ).toBeUndefined()
      expect(styleOf(instance(cellOf('Average').parent)).borderTopWidth).toBe(1)
      expect(screen.queryByText('Stray text')).toBeNull()
    })

    it('draws a cell across the columns it spans, and an element as given', async () => {
      await render(<Footed />)
      await layOut()

      expect(styleOf(screen.getByTestId('cell'))).toMatchObject({
        marginTop: 4,
        width: 400,
      })
      expect(styleOf(instance(screen.getByTestId('sum').parent)).width).toBe(
        200,
      )
      expect(styleOf(screen.getByTestId('sum')).color).toBeUndefined()
    })

    it('keeps its rows out of the selection and takes no press', async () => {
      await render(
        <Table aria-label="Label" selectionMode="multiple">
          <Table.Header>
            <Table.Column id="colName">Label</Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Row id="first">
              <Table.Cell>First item</Table.Cell>
            </Table.Row>
          </Table.Body>
          <Table.Footer>
            <Table.Row id="total">
              <Table.Cell>Total</Table.Cell>
            </Table.Row>
          </Table.Footer>
        </Table>,
      )

      expect(screen.queryByRole('button', { name: /Total/ })).toBeNull()
      expect(instance(cellOf('Total').parent).props.onPress).toBeUndefined()
    })
  })

  describe('the table', () => {
    it('puts its style on the box it is drawn in, and its ref and testID on the list', async () => {
      const ref = createRef<FlatList>()
      await render(<Basic ref={ref} />)

      expect(ref.current).toBeInstanceOf(FlatList)
      expect(screen.getByTestId('table')).toBe(list())
      expect(styleOf(list()).marginTop).toBeUndefined()
    })

    it('takes focus while its rows run past the room they have', async () => {
      const onContentSizeChange = jest.fn()
      const onLayout = jest.fn()
      await render(
        <Basic onContentSizeChange={onContentSizeChange} onLayout={onLayout} />,
      )

      expect(list().props.focusable).toBe(false)

      await fireEvent(list(), 'layout', ROOM)
      await fireEvent(list(), 'contentSizeChange', WIDTH, 300)

      expect(list().props.focusable).toBe(true)
      expect(onLayout).toHaveBeenCalledWith(ROOM)
      expect(onContentSizeChange).toHaveBeenCalledWith(WIDTH, 300)

      await fireEvent(list(), 'contentSizeChange', WIDTH, 200)

      expect(list().props.focusable).toBe(false)
    })

    it('keeps a call site’s own focusable', async () => {
      await render(<Basic focusable={false} />)
      await fireEvent(list(), 'layout', ROOM)
      await fireEvent(list(), 'contentSizeChange', WIDTH, 300)

      expect(list().props.focusable).toBe(false)
    })

    it('hands the scroll props to the list', async () => {
      await render(<Basic scrollEnabled={false} />)

      expect(list().props.scrollEnabled).toBe(false)
    })
  })
})
