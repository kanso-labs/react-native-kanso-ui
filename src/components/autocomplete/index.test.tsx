import type { ReactNode } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { Selection } from 'react-stately'

import { describe, expect, it, jest } from '@jest/globals'
import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import type { AutocompleteFilter, AutocompleteProps } from '.'

import { Autocomplete } from '.'
import { List } from '../list'
import { SearchField } from '../search-field'

// A press with no point on the page, on a row that measures nothing, so the
// ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// The rows most cases search, as elements rather than a component of their
// own, since a list reads its parts straight off its children. The third
// carries accents, for the cases that ignore them.
const PEOPLE = [
  <List.Item id="ada" key="ada">
    Ada Lovelace
  </List.Item>,
  <List.Item id="grace" key="grace">
    Grace Hopper
  </List.Item>,
  <List.Item id="emilie" key="emilie">
    Émilie du Châtelet
  </List.Item>,
]

const SECTIONS = [
  <List.Section header="First group" id="first-group" key="first-group">
    <List.Item id="ada">Ada Lovelace</List.Item>
    <List.Item id="grace">Grace Hopper</List.Item>
  </List.Section>,
  <List.Section header="Second group" id="second-group" key="second-group">
    <List.Item id="emilie">Émilie du Châtelet</List.Item>
  </List.Section>,
]

// A filter that keeps a row whose text starts with the search, where the
// default keeps one that contains it anywhere.
const STARTS_WITH: AutocompleteFilter = (textValue, inputValue) =>
  textValue.startsWith(inputValue)

// The props a case hands the autocomplete, the field and the list it draws.
type SearchProps = AutocompleteProps & {
  readonly onChange?: (value: string) => void
  readonly onSelectionChange?: (keys: Selection) => void
  readonly renderEmptyState?: () => ReactNode
}

function EmptyState() {
  return <Text>Nothing here</Text>
}

function field() {
  return screen.getByRole('searchbox', { name: 'Search' })
}

// The rows a search left, by their headlines, in order.
function headlines() {
  return within(list()).queryAllByRole('button').map(textOf)
}

function list() {
  return screen.getByLabelText('People')
}

function renderEmptyState() {
  return <EmptyState />
}

// A row, by the headline that names it.
function rowOf(headline: string) {
  return screen.getByRole('button', { name: new RegExp(headline) })
}

// An autocomplete over the field and a list that selects one row, which is
// what most cases search.
function Search({
  children = PEOPLE,
  onChange,
  onSelectionChange,
  renderEmptyState: empty,
  ...props
}: SearchProps) {
  return (
    <Autocomplete {...props}>
      <SearchField label="Search" onChange={onChange} />
      <List
        aria-label="People"
        onSelectionChange={onSelectionChange}
        renderEmptyState={empty}
        selectionMode="single"
      >
        {children}
      </List>
    </Autocomplete>
  )
}

// The status a list inside an Autocomplete keeps, by what it says.
function statusOf(words: string) {
  const text = screen.getByText(words)
  const region = text.parent

  if (region === null) {
    throw new TypeError('expected the status inside its region')
  }
  return region
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle & ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

// A row's headline, as the text inside it.
function textOf(row: ReturnType<typeof screen.getByRole>): string {
  return row.children
    .map((child) => (typeof child === 'string' ? child : textOf(child)))
    .join('')
}

describe('autocomplete', () => {
  describe('semantics', () => {
    it('draws nothing of its own', async () => {
      await render(
        <Autocomplete>
          <View testID="child" />
        </Autocomplete>,
      )

      expect(screen.root).toBe(screen.getByTestId('child'))
    })

    it('leaves the field a search box and the list a list of rows', async () => {
      await render(<Search />)

      expect(field().props.value).toBe('')
      expect(headlines()).toEqual([
        'Ada Lovelace',
        'Grace Hopper',
        'Émilie du Châtelet',
      ])
    })
  })

  describe('filtering', () => {
    it('narrows the list as the field is typed into', async () => {
      await render(<Search />)

      await fireEvent.changeText(field(), 'Grace')

      expect(field().props.value).toBe('Grace')
      expect(headlines()).toEqual(['Grace Hopper'])
    })

    it('matches anywhere in the text, not only at the start', async () => {
      await render(<Search />)

      await fireEvent.changeText(field(), 'hop')

      expect(headlines()).toEqual(['Grace Hopper'])
    })

    it.each([
      ['a different case', 'ADA'],
      ['no accents', 'emilie du chatelet'],
      ['an accent of its own', 'ádá'],
      ['an accent typed as a combining mark', 'Émilie'],
    ])('ignores case and accents, given %s', async (_case, search) => {
      await render(<Search />)

      await fireEvent.changeText(field(), search)

      expect(headlines()).toHaveLength(1)
    })

    it('takes a filter of its own', async () => {
      await render(<Search filter={STARTS_WITH} />)

      await fireEvent.changeText(field(), 'Hop')

      expect(headlines()).toEqual([])

      await fireEvent.changeText(field(), 'Gr')

      expect(headlines()).toEqual(['Grace Hopper'])
    })

    it('hands its filter the text, the search and the row', async () => {
      const filter = jest.fn<AutocompleteFilter>(() => true)
      await render(<Search filter={filter} />)

      await fireEvent.changeText(field(), 'x')

      expect(filter).toHaveBeenCalledWith(
        'Ada Lovelace',
        'x',
        expect.objectContaining({ key: 'ada', type: 'item' }),
      )
    })

    it('keeps a section with a row left in it, and drops the rest', async () => {
      await render(<Search>{SECTIONS}</Search>)

      await fireEvent.changeText(field(), 'emilie')

      expect(headlines()).toEqual(['Émilie du Châtelet'])
      expect(screen.queryByRole('heading', { name: 'First group' })).toBe(null)
      expect(screen.getByRole('heading', { name: 'Second group' })).toBeTruthy()
    })

    it('leaves a list outside an Autocomplete whole', async () => {
      await render(
        <>
          <Search />
          <List aria-label="Others">{PEOPLE}</List>
        </>,
      )

      await fireEvent.changeText(field(), 'Grace')

      expect(screen.getByText('Ada Lovelace')).toBeTruthy()
    })
  })

  describe('a search that matches nothing', () => {
    it('shows the list’s empty row', async () => {
      await render(<Search />)

      await fireEvent.changeText(field(), 'zzz')

      expect(headlines()).toEqual([])
      expect(screen.getAllByText('No results').length).toBeGreaterThan(0)
    })

    it('takes a renderEmptyState of its own over the default', async () => {
      await render(<Search renderEmptyState={renderEmptyState} />)

      await fireEvent.changeText(field(), 'zzz')

      expect(screen.getByText('Nothing here')).toBeTruthy()
    })

    it('keeps the ring while more rows are on their way', async () => {
      await render(
        <Search>
          {[...PEOPLE, <List.LoadMore isLoading key="loader" />]}
        </Search>,
      )

      await fireEvent.changeText(field(), 'zzz')

      expect(screen.getByLabelText('Loading more')).toBeTruthy()
      expect(screen.queryByText('Nothing here')).toBe(null)
    })
  })

  describe('what has been typed', () => {
    it('keeps its own from defaultInputValue', async () => {
      await render(<Search defaultInputValue="Ada" />)

      expect(field().props.value).toBe('Ada')
      expect(headlines()).toEqual(['Ada Lovelace'])
    })

    it('reports what was typed', async () => {
      const onInputChange = jest.fn()
      await render(<Search onInputChange={onInputChange} />)

      await fireEvent.changeText(field(), 'Gr')

      expect(onInputChange).toHaveBeenLastCalledWith('Gr')
    })

    it('does not change on its own when controlled', async () => {
      const onInputChange = jest.fn()
      await render(<Search inputValue="Ada" onInputChange={onInputChange} />)

      await fireEvent.changeText(field(), 'Gr')

      expect(onInputChange).toHaveBeenLastCalledWith('Gr')
      expect(field().props.value).toBe('Ada')
      expect(headlines()).toEqual(['Ada Lovelace'])
    })

    it('tells the field’s own onChange as well', async () => {
      const onChange = jest.fn()
      await render(<Search onChange={onChange} />)

      await fireEvent.changeText(field(), 'Gr')

      expect(onChange).toHaveBeenLastCalledWith('Gr')
    })

    it('reads its own value over the field’s', async () => {
      await render(
        <Autocomplete defaultInputValue="Ada">
          <SearchField defaultValue="Grace" label="Search" />
          <List aria-label="People">{PEOPLE}</List>
        </Autocomplete>,
      )

      expect(field().props.value).toBe('Ada')
    })

    it('shows every row again once the field is cleared', async () => {
      const onInputChange = jest.fn()
      await render(
        <Search defaultInputValue="Ada" onInputChange={onInputChange} />,
      )

      await fireEvent.press(screen.getByLabelText('Clear search'), PRESS)

      expect(onInputChange).toHaveBeenLastCalledWith('')
      expect(headlines()).toHaveLength(3)
    })
  })

  describe('a press', () => {
    it('selects the row it lands on', async () => {
      const onSelectionChange = jest.fn<(keys: Selection) => void>()
      await render(<Search onSelectionChange={onSelectionChange} />)

      await fireEvent.changeText(field(), 'Grace')
      await fireEvent.press(rowOf('Grace Hopper'), PRESS)

      const keys = onSelectionChange.mock.calls.at(-1)?.[0]
      expect(keys === 'all' ? keys : [...(keys ?? [])]).toEqual(['grace'])
    })

    it('reaches a row while the keyboard is up', async () => {
      await render(<Search />)

      expect(list().props.keyboardShouldPersistTaps).toBe('handled')
    })

    it('leaves the call site’s keyboard handling as it is', async () => {
      await render(
        <Autocomplete>
          <List aria-label="People" keyboardShouldPersistTaps="never">
            {PEOPLE}
          </List>
        </Autocomplete>,
      )

      expect(list().props.keyboardShouldPersistTaps).toBe('never')
    })

    it('leaves a list outside an Autocomplete as React Native has it', async () => {
      await render(<List aria-label="People">{PEOPLE}</List>)

      expect(list().props.keyboardShouldPersistTaps).toBeUndefined()
    })
  })

  describe('the count', () => {
    it('says how many rows are left in a polite live region', async () => {
      jest.replaceProperty(Platform, 'OS', 'android')
      await render(<Search />)

      const status = statusOf('3 options available.')

      expect(status.props['aria-live']).toBe('polite')
      expect(styleOf(status)).toMatchObject({
        height: 1,
        overflow: 'hidden',
        position: 'absolute',
        width: 1,
      })

      await fireEvent.changeText(field(), 'Ada')

      expect(statusOf('1 option available.')).toBe(status)
    })

    it('counts the rows inside sections, and not their headings', async () => {
      jest.replaceProperty(Platform, 'OS', 'android')
      await render(<Search>{SECTIONS}</Search>)

      expect(screen.getByText('3 options available.')).toBeTruthy()

      await fireEvent.changeText(field(), 'a')

      expect(screen.getByText('3 options available.')).toBeTruthy()

      await fireEvent.changeText(field(), 'emilie')

      expect(screen.getByText('1 option available.')).toBeTruthy()
    })

    it('says a search left none in the empty row’s words', async () => {
      jest.replaceProperty(Platform, 'OS', 'android')
      await render(<Search renderEmptyState={renderEmptyState} />)

      await fireEvent.changeText(field(), 'zzz')

      expect(statusOf('No results').props['aria-live']).toBe('polite')
    })

    it('says it on iOS as it changes, and not as the list mounts', async () => {
      jest.replaceProperty(Platform, 'OS', 'ios')
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation(() => undefined)
      // The preset's mock keeps what earlier cases said, so it starts clear.
      announce.mockClear()
      await render(<Search />)

      expect(announce).not.toHaveBeenCalled()

      await fireEvent.changeText(field(), 'Ada')

      expect(announce).toHaveBeenCalledTimes(1)
      expect(announce).toHaveBeenLastCalledWith('1 option available.')

      // The same count again says nothing new.
      await fireEvent.changeText(field(), 'Ad')

      expect(announce).toHaveBeenCalledTimes(1)
      // iOS has no live regions, so nothing is drawn for one.
      expect(screen.queryByText('1 option available.')).toBe(null)
    })

    it('draws no status in a list outside an Autocomplete', async () => {
      jest.replaceProperty(Platform, 'OS', 'android')
      await render(<List aria-label="People">{PEOPLE}</List>)

      expect(screen.queryByText(/available/u)).toBe(null)
    })
  })
})
