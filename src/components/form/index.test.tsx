import type { ComponentRef, ReactElement, ReactNode } from 'react'
import type { StyleProp, TextInput, ViewStyle } from 'react-native'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import type { FormHandle, FormProps } from '.'

import { Form } from '.'
import { scopeFor } from '../../theme/scope'
import { Button } from '../button'
import { IconButton } from '../icon-button'
import { NumberField } from '../number-field'
import { SearchField } from '../search-field'
import { TextField } from '../text-field'

const { theme } = scopeFor('light', {})

// React Native's Jest preset reports a font scale of 2.
const FONT_SCALE = 2

const REQUIRED = 'Fill out this field.'

// Hoisted so each is one stable object per render, which is what
// react-perf's no-new-object-as-prop is after, and so a rerender hands the
// form the same object rather than a new one.
const SERVER_ERRORS = { headline: 'Choose another headline.' }
const SERVER_ERRORS_AGAIN = { headline: 'Choose another headline.' }
const SERVER_ERRORS_TWO = { headline: ['Too short.', 'Taken.'] }

type Host = ReturnType<typeof screen.getByTestId>

// What a field's validate says about an empty value and about a short one.
function atLeastThree(value: string) {
  return value.length < 3 ? `Enter ${String(3 - value.length)} more.` : null
}

function atMostTen(value: number) {
  return value > 10 ? 'Enter 10 or less.' : null
}

async function blur(element: Host) {
  await fireEvent(element, 'blur', {})
}

function control(label: string) {
  return screen.getByLabelText(label)
}

// What a screen reader hears describing a field on iOS, which is where its
// error is read from: the message under it is hidden there, since the hint
// says it.
function errorOf(label: string): unknown {
  return control(label).props.accessibilityHint
}

function flatStyleOf(element: Host | undefined): ViewStyle {
  return (
    StyleSheet.flatten([
      (element?.props as undefined | { style?: StyleProp<ViewStyle> })?.style,
    ]) ?? {}
  )
}

// The form around its fields, with a submit button after them.
function formOf(props: FormProps, fields: ReactNode): ReactElement {
  return (
    <Form {...props}>
      <View testID="fields">{fields}</View>
      <Button type="submit">Submit</Button>
    </Form>
  )
}

function hostsOf(element: Host | undefined): Host[] {
  return element?.children.filter((child) => typeof child !== 'string') ?? []
}

// The line under the nth field: its root draws the box, then the line.
function lineOf(index: number) {
  return hostsOf(hostsOf(screen.getByTestId('fields'))[index])[1]
}

function missing(): never {
  throw new TypeError('expected the field to hand its control over')
}

async function submit() {
  await fireEvent.press(screen.getByRole('button', { name: 'Submit' }))
}

function submitted(onSubmit: jest.Mock): unknown {
  return onSubmit.mock.calls.at(-1)?.[0]
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  // The preset's AccessibilityInfo is a mock already, which spyOn hands back
  // as it is and restoring leaves holding its calls.
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('Form', () => {
  describe('what it draws', () => {
    it('draws nothing of its own around its fields', async () => {
      await render(
        <Form>
          <Text testID="child">Label</Text>
        </Form>,
      )

      expect(screen.toJSON()).toMatchObject({ props: { testID: 'child' } })
    })
  })

  describe('submitting', () => {
    it('hands onSubmit the values by name from a submit button', async () => {
      const onSubmit = jest.fn()
      await render(
        formOf(
          { onSubmit },
          <>
            <TextField defaultValue="Headline" label="First" name="first" />
            <TextField label="Second" name="second" />
          </>,
        ),
      )

      await fireEvent.changeText(control('Second'), 'Supporting line')
      await submit()

      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(submitted(onSubmit)).toEqual({
        first: 'Headline',
        second: 'Supporting line',
      })
    })

    it('submits the value a controlled field shows', async () => {
      const onSubmit = jest.fn()
      await render(
        formOf(
          { onSubmit },
          <TextField label="First" name="first" value="Headline" />,
        ),
      )

      await submit()

      expect(submitted(onSubmit)).toEqual({ first: 'Headline' })
    })

    it('submits through requestSubmit on its ref as the button does', async () => {
      const onSubmit = jest.fn()
      const form = createRef<FormHandle>()
      await render(
        <Form onSubmit={onSubmit} ref={form}>
          <TextField defaultValue="Headline" label="First" name="first" />
        </Form>,
      )

      await fireEvent(control('First'), 'submitEditing', {})
      form.current?.requestSubmit()

      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(submitted(onSubmit)).toEqual({ first: 'Headline' })
    })

    it('submits a search field, and a number field as its number written out', async () => {
      const onSubmit = jest.fn()
      await render(
        formOf(
          { onSubmit },
          <>
            <SearchField defaultValue="Query" label="Search" name="query" />
            <NumberField defaultValue={1234.5} label="Amount" name="amount" />
            <NumberField label="Empty" name="empty" />
          </>,
        ),
      )

      await submit()

      expect(submitted(onSubmit)).toEqual({
        amount: '1234.5',
        empty: '',
        query: 'Query',
      })
    })

    it('leaves out a field with no name and a disabled one, and keeps a read-only one', async () => {
      const onSubmit = jest.fn()
      await render(
        formOf(
          { onSubmit },
          <>
            <TextField defaultValue="Headline" label="Unnamed" />
            <TextField
              defaultValue="Headline"
              isDisabled
              label="Disabled"
              name="disabled"
            />
            <TextField
              defaultValue="Headline"
              isReadOnly
              label="Read-only"
              name="readOnly"
            />
          </>,
        ),
      )

      await submit()

      expect(submitted(onSubmit)).toEqual({ readOnly: 'Headline' })
    })

    it('drops a field once it unmounts and takes one that mounts later', async () => {
      const onSubmit = jest.fn()
      const view = await render(
        formOf(
          { onSubmit },
          <TextField
            defaultValue="First item"
            key="first"
            label="First"
            name="first"
          />,
        ),
      )

      await view.rerender(
        formOf(
          { onSubmit },
          <TextField
            defaultValue="Second item"
            key="second"
            label="Second"
            name="second"
          />,
        ),
      )
      await submit()

      expect(submitted(onSubmit)).toEqual({ second: 'Second item' })
    })

    it('submits nothing from a plain button, or from a submit button outside a form', async () => {
      const onPress = jest.fn()
      const onSubmit = jest.fn()
      await render(
        <>
          <Form onSubmit={onSubmit}>
            <Button onPress={onPress}>Plain</Button>
          </Form>
          <Button onPress={onPress} type="submit">
            Outside
          </Button>
        </>,
      )

      await fireEvent.press(screen.getByRole('button', { name: 'Plain' }))
      await fireEvent.press(screen.getByRole('button', { name: 'Outside' }))

      expect(onPress).toHaveBeenCalledTimes(2)
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('submits from an icon button too, after its own onPress', async () => {
      const calls: string[] = []
      const onPress = jest.fn(() => {
        calls.push('press')
      })
      const onSubmit = jest.fn(() => {
        calls.push('submit')
      })
      await render(
        <Form onSubmit={onSubmit}>
          <IconButton aria-label="Send" onPress={onPress} type="submit">
            <Text>+</Text>
          </IconButton>
        </Form>,
      )

      await fireEvent.press(screen.getByRole('button', { name: 'Send' }))

      expect(calls).toEqual(['press', 'submit'])
    })
  })

  describe('server errors', () => {
    it('shows an error under the field it names, and only there', async () => {
      await render(
        formOf(
          { validationErrors: SERVER_ERRORS },
          <>
            <TextField label="Headline" name="headline" />
            <TextField label="Other" name="other" />
          </>,
        ),
      )

      expect(errorOf('Headline')).toBe('Choose another headline.')
      expect(errorOf('Other')).toBeUndefined()
    })

    it('marks the field invalid on the web', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await render(
        formOf(
          { validationErrors: SERVER_ERRORS },
          <>
            <TextField label="Headline" name="headline" />
            <TextField label="Other" name="other" />
          </>,
        ),
      )

      expect(control('Headline').props['aria-invalid']).toBe(true)
      expect(control('Other').props).not.toHaveProperty('aria-invalid')
      expect(screen.getByText('Choose another headline.')).toBeTruthy()
    })

    it('joins several errors for one field into one line', async () => {
      await render(
        formOf(
          { validationErrors: SERVER_ERRORS_TWO },
          <TextField label="Headline" name="headline" />,
        ),
      )

      expect(errorOf('Headline')).toBe('Too short. Taken.')
    })

    it('replaces the description with the error', async () => {
      await render(
        formOf(
          { validationErrors: SERVER_ERRORS },
          <TextField
            description="Supporting line"
            label="Headline"
            name="headline"
          />,
        ),
      )

      expect(errorOf('Headline')).toBe('Choose another headline.')
      expect(
        screen.queryByText('Supporting line', { includeHiddenElements: true }),
      ).toBeNull()
    })

    it('reaches a search field and a number field by name too', async () => {
      await render(
        formOf(
          { validationErrors: SERVER_ERRORS },
          <>
            <SearchField label="Search" name="headline" />
            <NumberField label="Amount" name="headline" />
          </>,
        ),
      )

      expect(errorOf('Search')).toBe('Choose another headline.')
      expect(errorOf('Amount')).toBe('Choose another headline.')
    })

    it('draws the error under a search field and a number field on Android', async () => {
      jest.replaceProperty(Platform, 'OS', 'android')
      await render(
        formOf(
          { validationErrors: SERVER_ERRORS },
          <>
            <SearchField label="Search" name="headline" />
            <NumberField label="Amount" name="headline" />
          </>,
        ),
      )

      expect(screen.getAllByText('Choose another headline.')).toHaveLength(2)
    })

    it('gives way to the field’s own error', async () => {
      await render(
        formOf(
          { validationErrors: SERVER_ERRORS },
          <TextField
            error="Supporting line"
            label="Headline"
            name="headline"
          />,
        ),
      )

      expect(errorOf('Headline')).toBe('Supporting line')
    })

    it('clears on the first edit, and shows again with new errors', async () => {
      const view = await render(
        formOf(
          { validationErrors: SERVER_ERRORS },
          <TextField label="Headline" name="headline" />,
        ),
      )

      await fireEvent.changeText(control('Headline'), 'Edited')

      expect(errorOf('Headline')).toBeUndefined()

      // The same errors again leave it cleared; a new object is a new answer.
      await view.rerender(
        formOf(
          { validationErrors: SERVER_ERRORS },
          <TextField label="Headline" name="headline" />,
        ),
      )
      expect(errorOf('Headline')).toBeUndefined()

      await view.rerender(
        formOf(
          { validationErrors: SERVER_ERRORS_AGAIN },
          <TextField label="Headline" name="headline" />,
        ),
      )
      expect(errorOf('Headline')).toBe('Choose another headline.')
    })

    it('clears from a search field once cleared, and a number field once stepped', async () => {
      await render(
        formOf(
          { validationErrors: SERVER_ERRORS },
          <>
            <SearchField defaultValue="Query" label="Search" name="headline" />
            <NumberField label="Amount" name="headline" />
          </>,
        ),
      )

      await fireEvent.press(
        screen.getByRole('button', { name: 'Clear search' }),
      )
      await fireEvent.press(
        screen.getByRole('button', { name: 'Increase Amount' }),
      )

      expect(errorOf('Search')).toBeUndefined()
      expect(errorOf('Amount')).toBeUndefined()
    })

    it('clears from a search field and a number field as they are typed in', async () => {
      await render(
        formOf(
          { validationErrors: SERVER_ERRORS },
          <>
            <SearchField label="Search" name="headline" />
            <NumberField label="Amount" name="headline" />
          </>,
        ),
      )

      await fireEvent.changeText(control('Search'), 'Query')
      await fireEvent.changeText(control('Amount'), '12')

      expect(errorOf('Search')).toBeUndefined()
      expect(errorOf('Amount')).toBeUndefined()
    })

    it('announces an error as it arrives on iOS', async () => {
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation(() => undefined)
      const view = await render(
        formOf({}, <TextField label="Headline" name="headline" />),
      )

      await view.rerender(
        formOf(
          { validationErrors: SERVER_ERRORS },
          <TextField label="Headline" name="headline" />,
        ),
      )

      expect(announce).toHaveBeenCalledWith('Choose another headline.')
    })
  })

  // A message arriving inside a form would otherwise push every field below
  // it down by the line it takes, at the moment a person is reading the form.
  describe('room for a message', () => {
    it('keeps the line drawn under a field that has nothing to say', async () => {
      await render(
        formOf(
          {},
          <>
            <TextField label="First" />
            <SearchField label="Search" />
            <NumberField label="Amount" />
          </>,
        ),
      )

      for (const index of [0, 1, 2]) {
        const line = flatStyleOf(lineOf(index))
        expect(line).not.toHaveProperty('position')
        expect(line).toMatchObject({
          marginTop: theme.spacing.xs,
          minHeight: theme.typography.bodySmallLineHeight * FONT_SCALE,
        })
      }
    })

    it('leaves a field on its own ending at its box', async () => {
      await render(
        <View testID="fields">
          <TextField label="Alone" />
        </View>,
      )

      expect(flatStyleOf(lineOf(0))).toMatchObject({ position: 'absolute' })
    })
  })

  describe('under aria, the default', () => {
    it('submits a required field left empty, and shows it no error', async () => {
      const onSubmit = jest.fn()
      await render(
        formOf(
          { onSubmit },
          <TextField isRequired label="Headline" name="headline" />,
        ),
      )

      await submit()

      expect(submitted(onSubmit)).toEqual({ headline: '' })
      expect(errorOf('Headline')).toBeUndefined()
    })

    it('shows what validate says as the value changes, and submits regardless', async () => {
      const onSubmit = jest.fn()
      await render(
        formOf(
          { onSubmit },
          <TextField
            defaultValue="abc"
            label="Headline"
            name="headline"
            validate={atLeastThree}
          />,
        ),
      )

      expect(errorOf('Headline')).toBeUndefined()

      await fireEvent.changeText(control('Headline'), 'a')
      expect(errorOf('Headline')).toBe('Enter 2 more.')

      await fireEvent.changeText(control('Headline'), 'ab')
      expect(errorOf('Headline')).toBe('Enter 1 more.')

      await submit()
      expect(submitted(onSubmit)).toEqual({ headline: 'ab' })

      await fireEvent.changeText(control('Headline'), 'abc')
      expect(errorOf('Headline')).toBeUndefined()
    })

    it('validates a field outside any form the same way', async () => {
      await render(
        <TextField label="Headline" validate={atLeastThree} value="a" />,
      )

      expect(errorOf('Headline')).toBe('Enter 2 more.')
    })

    it('reads a list of messages from validate as one line', async () => {
      await render(
        <TextField
          label="Headline"
          validate={jest.fn(() => ['Too short.', 'Taken.'])}
          value="a"
        />,
      )

      expect(errorOf('Headline')).toBe('Too short. Taken.')
    })

    // On the web, where an empty message would still mark the field invalid
    // while giving a screen reader nothing to read.
    it.each<['' | null | true | undefined]>([
      [true],
      [null],
      [undefined],
      [''],
    ])('reads %p from validate as no error', async (result) => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await render(
        <TextField
          label="Headline"
          validate={jest.fn(() => result)}
          value="a"
        />,
      )

      expect(control('Headline').props).not.toHaveProperty('aria-invalid')
    })

    it('validates a number field’s number, NaN while it is empty', async () => {
      const validate = jest.fn((value: number) =>
        Number.isNaN(value) ? 'Enter an amount.' : null,
      )
      await render(<NumberField label="Amount" validate={validate} />)

      expect(errorOf('Amount')).toBe('Enter an amount.')

      await fireEvent.changeText(control('Amount'), '12')

      expect(validate).toHaveBeenLastCalledWith(12)
      expect(errorOf('Amount')).toBeUndefined()
    })
  })

  describe('under native', () => {
    it('holds back a required field left empty, shows its error and focuses it', async () => {
      const onSubmit = jest.fn()
      const headline = createRef<ComponentRef<typeof TextInput>>()
      await render(
        formOf(
          { onSubmit, validationBehavior: 'native' },
          <>
            <TextField label="Other" name="other" />
            <TextField
              inputRef={headline}
              isRequired
              label="Headline"
              name="headline"
            />
          </>,
        ),
      )
      const focus = jest.spyOn(headline.current ?? missing(), 'focus')

      expect(errorOf('Headline')).toBeUndefined()

      await submit()

      expect(onSubmit).not.toHaveBeenCalled()
      expect(errorOf('Headline')).toBe(REQUIRED)
      expect(errorOf('Other')).toBeUndefined()
      expect(focus.mock.contexts).toEqual([headline.current])

      await fireEvent.changeText(control('Headline'), 'Headline')
      expect(errorOf('Headline')).toBeUndefined()

      await submit()
      expect(submitted(onSubmit)).toEqual({ headline: 'Headline', other: '' })
    })

    it('announces the error a submission shows on iOS', async () => {
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation(() => undefined)
      await render(
        formOf(
          { validationBehavior: 'native' },
          <TextField isRequired label="Headline" name="headline" />,
        ),
      )

      await submit()

      expect(announce).toHaveBeenCalledWith(REQUIRED)
    })

    it('leaves the error in a polite live region on Android', async () => {
      jest.replaceProperty(Platform, 'OS', 'android')
      await render(
        formOf(
          { validationBehavior: 'native' },
          <TextField isRequired label="Headline" name="headline" />,
        ),
      )

      await submit()

      expect(screen.getByText(REQUIRED).parent?.props['aria-live']).toBe(
        'polite',
      )
    })

    it('shows every blocking field’s error and focuses the first, as drawn', async () => {
      const first = createRef<ComponentRef<typeof TextInput>>()
      await render(
        formOf(
          { validationBehavior: 'native' },
          <>
            <TextField inputRef={first} isRequired label="First" name="a" />
            <TextField isRequired label="Second" name="b" />
          </>,
        ),
      )
      // An edit renders the first field again on its own, which keeps its
      // place ahead of the second.
      await fireEvent.changeText(control('First'), 'a')
      await fireEvent.changeText(control('First'), '')
      // The preset's TextInput shares one mock `focus` between instances,
      // so the call's `this` says which was focused.
      const focus = jest.spyOn(first.current ?? missing(), 'focus')

      await submit()

      expect(errorOf('First')).toBe(REQUIRED)
      expect(errorOf('Second')).toBe(REQUIRED)
      expect(focus.mock.contexts).toEqual([first.current])
    })

    it('shows validate’s error rather than the required one', async () => {
      await render(
        formOf(
          { validationBehavior: 'native' },
          <TextField
            isRequired
            label="Headline"
            name="headline"
            validate={atLeastThree}
          />,
        ),
      )

      await submit()

      expect(errorOf('Headline')).toBe('Enter 3 more.')
    })

    it('checks the error again against each edit, and takes it back once right', async () => {
      const onSubmit = jest.fn()
      await render(
        formOf(
          { onSubmit, validationBehavior: 'native' },
          <TextField
            label="Headline"
            name="headline"
            validate={atLeastThree}
          />,
        ),
      )

      await submit()
      expect(onSubmit).not.toHaveBeenCalled()
      expect(errorOf('Headline')).toBe('Enter 3 more.')

      await fireEvent.changeText(control('Headline'), 'a')
      expect(errorOf('Headline')).toBe('Enter 2 more.')

      await fireEvent.changeText(control('Headline'), 'abc')
      expect(errorOf('Headline')).toBeUndefined()

      // Taken back, so nothing shows again while the field is typed in.
      await fireEvent.changeText(control('Headline'), 'ab')
      expect(errorOf('Headline')).toBeUndefined()
    })

    it('shows nothing while a field is typed in, and the error once it loses focus', async () => {
      await render(
        formOf(
          { validationBehavior: 'native' },
          <>
            <TextField
              label="Headline"
              name="headline"
              validate={atLeastThree}
            />
            <TextField isRequired label="Other" name="other" />
          </>,
        ),
      )

      await fireEvent(control('Headline'), 'focus', {})
      await fireEvent.changeText(control('Headline'), 'a')
      expect(errorOf('Headline')).toBeUndefined()

      await blur(control('Headline'))
      expect(errorOf('Headline')).toBe('Enter 2 more.')

      // Focus and leave without an edit, and nothing is checked.
      await fireEvent(control('Other'), 'focus', {})
      await blur(control('Other'))
      expect(errorOf('Other')).toBeUndefined()
    })

    it('runs the call site’s own blur handler', async () => {
      const onBlur = jest.fn()
      await render(
        formOf(
          { validationBehavior: 'native' },
          <TextField label="Headline" name="headline" onBlur={onBlur} />,
        ),
      )

      await blur(control('Headline'))

      expect(onBlur).toHaveBeenCalledTimes(1)
    })

    it('holds nothing back for a disabled or read-only field', async () => {
      const onSubmit = jest.fn()
      await render(
        formOf(
          { onSubmit, validationBehavior: 'native' },
          <>
            <TextField isDisabled isRequired label="Disabled" name="a" />
            <TextField
              isReadOnly
              isRequired
              label="Read-only"
              name="b"
              validate={atLeastThree}
            />
            <NumberField isReadOnly isRequired label="Amount" name="c" />
          </>,
        ),
      )

      await submit()

      expect(submitted(onSubmit)).toEqual({ b: '', c: '' })
      expect(errorOf('Disabled')).toBeUndefined()
    })

    it('holds back a field showing its own error, and focuses it', async () => {
      const onSubmit = jest.fn()
      const own = createRef<ComponentRef<typeof TextInput>>()
      await render(
        formOf(
          { onSubmit, validationBehavior: 'native' },
          <TextField
            error="Supporting line"
            inputRef={own}
            label="Own"
            name="own"
          />,
        ),
      )
      const focus = jest.spyOn(own.current ?? missing(), 'focus')

      await submit()

      expect(onSubmit).not.toHaveBeenCalled()
      expect(focus.mock.contexts).toEqual([own.current])
    })

    it('takes a shown error back once the field is disabled', async () => {
      const view = await render(
        formOf(
          { validationBehavior: 'native' },
          <TextField isRequired label="Headline" name="headline" />,
        ),
      )

      await submit()
      expect(errorOf('Headline')).toBe(REQUIRED)

      await view.rerender(
        formOf(
          { validationBehavior: 'native' },
          <TextField isDisabled isRequired label="Headline" name="headline" />,
        ),
      )
      expect(errorOf('Headline')).toBeUndefined()
    })

    it('submits once a server’s error is edited away', async () => {
      const onSubmit = jest.fn()
      await render(
        formOf(
          {
            onSubmit,
            validationBehavior: 'native',
            validationErrors: SERVER_ERRORS,
          },
          <TextField label="Headline" name="headline" />,
        ),
      )

      await submit()
      expect(onSubmit).not.toHaveBeenCalled()

      await fireEvent.changeText(control('Headline'), 'Edited')
      await submit()
      expect(submitted(onSubmit)).toEqual({ headline: 'Edited' })
    })

    it('holds back an empty required search field and number field', async () => {
      const onSubmit = jest.fn()
      await render(
        formOf(
          { onSubmit, validationBehavior: 'native' },
          <>
            <SearchField isRequired label="Search" name="query" />
            <NumberField isRequired label="Amount" name="amount" />
          </>,
        ),
      )

      await submit()

      expect(onSubmit).not.toHaveBeenCalled()
      expect(errorOf('Search')).toBe(REQUIRED)
      expect(errorOf('Amount')).toBe(REQUIRED)

      await fireEvent.changeText(control('Search'), 'Query')
      await fireEvent.changeText(control('Amount'), '12')
      await submit()

      expect(submitted(onSubmit)).toEqual({ amount: '12', query: 'Query' })
    })

    it('shows a number field’s error once it loses focus after an edit', async () => {
      await render(
        formOf(
          { validationBehavior: 'native' },
          <NumberField label="Amount" name="amount" validate={atMostTen} />,
        ),
      )

      await fireEvent.changeText(control('Amount'), '12')
      expect(errorOf('Amount')).toBeUndefined()

      await blur(control('Amount'))
      expect(errorOf('Amount')).toBe('Enter 10 or less.')
    })

    it('marks a required search field for the web', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await render(<SearchField isRequired label="Search" />)

      expect(control('Search').props['aria-required']).toBe(true)
    })
  })
})
