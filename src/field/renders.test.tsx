import type { ComponentType, ReactElement } from 'react'

import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'

import type { FieldVariant } from '.'

import { SearchField } from '../components/search-field'
import { TextArea } from '../components/text-area'
import { TextField } from '../components/text-field'

// What typing re-renders in a field's chrome. Each part counted is swapped for
// a stand-in that counts and then draws the real one, and the fields import
// them from here, so a stand-in is called exactly when React renders the part
// in its place: a field that hands a part the element it handed it last time
// is skipped, stand-in and all. The stand-ins opt out of the React Compiler,
// which runs over the library here as it does in a build, so what is counted
// is the memoisation a consumer gets.
const mockRenders: Record<string, number> = {}

// Called from the stand-ins rather than written in them, since a jest.mock
// factory may reach no variable but one named `mock…`.
function mockCount(name: string) {
  mockRenders[name] = (mockRenders[name] ?? 0) + 1
}

function mockCounted(name: string, Real: ComponentType<object>) {
  function Counted(props: object) {
    'use no memo'
    mockCount(name)
    return <Real {...props} />
  }
  return Counted
}

jest.mock('.', () => {
  const actual = jest.requireActual<Record<string, ComponentType<object>>>('.')
  return {
    ...actual,
    FieldBox: mockCounted('FieldBox', actual.FieldBox),
    FieldMessage: mockCounted('FieldMessage', actual.FieldMessage),
  }
})

jest.mock('../components/icon-button', () => {
  const actual = jest.requireActual<Record<string, ComponentType<object>>>(
    '../components/icon-button',
  )
  return {
    ...actual,
    IconButton: mockCounted('IconButton', actual.IconButton),
  }
})

// The two fields drawn in the box, as the props these tests hand them.
type Field = ComponentType<{
  readonly characterCount?: boolean
  readonly label: string
  readonly variant?: FieldVariant
}>

const FIELDS: [string, Field][] = [
  ['TextField', TextField],
  ['TextArea', TextArea],
]

function count(name: string) {
  return mockRenders[name] ?? 0
}

function input() {
  return screen.getByLabelText('Label')
}

async function show(element: ReactElement) {
  await render(element)
}

function startCounting() {
  for (const name of Object.keys(mockRenders)) {
    mockRenders[name] = 0
  }
}

// Each value in turn, as a keystroke each, waiting on one before the next.
async function type(...values: readonly string[]) {
  await values.reduce(async (previous, value) => {
    await previous
    await fireEvent.changeText(input(), value)
  }, Promise.resolve())
}

beforeEach(() => {
  startCounting()
})

describe('typing into a field', () => {
  // The box's label and rule follow focus, so focusing the field renders the
  // box. The first character renders it once more, since the box is told the
  // field now holds something; the characters after that change nothing it
  // draws. Before, the control was handed to the box as its children, a new
  // element on every keystroke, since the value is one of its props, and the
  // box rendered once per character.
  describe.each(FIELDS)('%s', (_, Field) => {
    it.each(['filled', 'outlined'] as const)(
      'renders the %s box as focus arrives, and not as characters do',
      async (variant) => {
        await show(<Field label="Label" variant={variant} />)

        startCounting()
        await fireEvent(input(), 'focus', {})
        expect(count('FieldBox')).toBe(1)

        startCounting()
        await type('a')
        expect(count('FieldBox')).toBe(1)

        startCounting()
        await type('ab', 'abc', 'abcd')

        expect(input().props.value).toBe('abcd')
        expect(count('FieldBox')).toBe(0)
      },
    )

    // What the box draws does follow the value where focus does not hide it:
    // an empty, unfocused field holds its label on the value's line, and a
    // value arriving floats it. Pinned so the test above cannot pass on a box
    // that never renders at all.
    it('renders the box when a value arrives in an unfocused field', async () => {
      await show(<Field label="Label" />)

      startCounting()
      await type('a')

      expect(count('FieldBox')).toBe(1)
    })

    // The line under the field draws the count alone of what typing changes,
    // so it renders per character only while it counts.
    it('renders the line under it per character only while it counts', async () => {
      await show(<Field label="Label" />)
      await type('a')

      startCounting()
      await type('ab', 'abc')
      expect(count('FieldMessage')).toBe(0)

      await show(<Field characterCount label="Label" />)
      await type('a')

      startCounting()
      await type('ab', 'abc')
      expect(count('FieldMessage')).toBe(2)
    })
  })
})

describe('typing into a search field', () => {
  // The clear button arrives with the first character and stays the same
  // button after it. Before, its press handler was a new closure on every
  // keystroke, and the button and its glyph rendered with each one.
  it('renders the clear button as it arrives, and not as characters do', async () => {
    await show(<SearchField label="Label" />)
    await fireEvent(input(), 'focus', {})

    startCounting()
    await type('a')
    expect(count('IconButton')).toBe(1)

    startCounting()
    await type('ab', 'abc', 'abcd')

    expect(input().props.value).toBe('abcd')
    expect(count('IconButton')).toBe(0)
  })
})
