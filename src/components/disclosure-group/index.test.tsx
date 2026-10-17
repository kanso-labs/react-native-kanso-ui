import type { ComponentRef, ReactNode } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { Key } from 'react-stately'
import type { TestInstance } from 'test-renderer'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { DisclosureGroupProps } from '.'

import { DisclosureGroup } from '.'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'
import { Disclosure } from '../disclosure'

const { theme } = scopeFor('light', {})
const { colors, stateLayerOpacity } = theme

const FADED = withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)

// A press with no point on the page, on a row that measures nothing, so the
// ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// Hoisted so the keys and the call site's style are stable, which is what
// react-perf's no-new-array-as-prop and no-new-object-as-prop are after.
const FIRST = ['first']
const FIRST_AND_THIRD = ['first', 'third']
const SECOND = ['second']
const CALL_SITE = { marginTop: 4 }

function section(
  id: Key | undefined,
  label: string,
  props: {
    isDisabled?: boolean
    onExpandedChange?: (open: boolean) => void
  } = {},
) {
  return (
    <Disclosure id={id} key={label} {...props}>
      <Disclosure.Header>{label}</Disclosure.Header>
      <Disclosure.Panel testID={`${label} panel`}>
        <Text>{`Panel for the ${label}`}</Text>
      </Disclosure.Panel>
    </Disclosure>
  )
}

// Written as an array rather than a fragment so the two shapes are covered
// apart: the fragment case has a test of its own below.
const SECTIONS = [
  section('first', 'First item'),
  section('second', 'Second item'),
  section('third', 'Third item'),
]

function button(name: string) {
  return screen.getByRole('button', { name })
}

// Whether each header reports its section open, in order.
function expanded() {
  return screen
    .getAllByRole('button')
    .map((each: TestInstance) => isExpanded(each.props))
}

function isExpanded(props: { accessibilityState?: unknown }) {
  const state = props.accessibilityState
  return typeof state === 'object' && state !== null && 'expanded' in state
    ? state.expanded === true
    : false
}

async function press(name: string) {
  const target = button(name)

  await fireEvent(target, 'pressIn', PRESS)
  await fireEvent.press(target)
  await fireEvent(target, 'pressOut', PRESS)
}

async function renderGroup(
  props: Omit<DisclosureGroupProps, 'children'> = {},
  children: ReactNode = SECTIONS,
) {
  await render(
    <DisclosureGroup testID="group" {...props}>
      {children}
    </DisclosureGroup>,
  )
}

// What a child of the group's view is: a rule, or a section, which has no
// role of its own.
function roleOf(child: string | TestInstance) {
  if (typeof child === 'string') {
    return 'text'
  }
  const { role }: { role?: unknown } = child.props
  return typeof role === 'string' ? role : undefined
}

// The rules the group draws. A query by role reaches only what a screen
// reader stops on, which a rule is not.
function rules() {
  return screen
    .getByTestId('group')
    .queryAll(
      (each) =>
        typeof each.type === 'string' && each.props.role === 'separator',
    )
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function textStyleOf(element: {
  props: { style?: StyleProp<TextStyle> }
}): TextStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('DisclosureGroup', () => {
  describe('what is open', () => {
    it('opens the sections it is given', async () => {
      await renderGroup({ defaultExpandedKeys: FIRST })

      expect(expanded()).toEqual([true, false, false])
    })

    // One at a time is the default, so opening a new section closes the last.
    it('closes the last when a new one opens', async () => {
      await renderGroup({ defaultExpandedKeys: FIRST })

      await press('Second item')

      expect(expanded()).toEqual([false, true, false])
    })

    it('closes the open one when its own header is pressed', async () => {
      await renderGroup({ defaultExpandedKeys: FIRST })

      await press('First item')

      expect(expanded()).toEqual([false, false, false])
    })

    it('keeps several open when it allows them', async () => {
      await renderGroup({
        allowsMultipleExpanded: true,
        defaultExpandedKeys: FIRST,
      })

      await press('Second item')

      expect(expanded()).toEqual([true, true, false])
    })

    it('keeps several open from defaultExpandedKeys when it allows them', async () => {
      await renderGroup({
        allowsMultipleExpanded: true,
        defaultExpandedKeys: FIRST_AND_THIRD,
      })

      expect(expanded()).toEqual([true, false, true])
    })

    it('keeps the first of several it is given when it opens one at a time', async () => {
      await renderGroup({ defaultExpandedKeys: FIRST_AND_THIRD })

      expect(expanded()).toEqual([true, false, false])
    })

    it('follows expandedKeys when the call site holds them', async () => {
      const onExpandedChange = jest.fn()
      await renderGroup({ expandedKeys: FIRST, onExpandedChange })

      await press('Second item')

      expect(onExpandedChange.mock.calls).toEqual([[new Set(['second'])]])
      expect(expanded()).toEqual([true, false, false])

      await screen.rerender(
        <DisclosureGroup
          expandedKeys={SECOND}
          onExpandedChange={onExpandedChange}
        >
          {SECTIONS}
        </DisclosureGroup>,
      )

      expect(expanded()).toEqual([false, true, false])
    })

    it("calls a section's own onExpandedChange beside the group's", async () => {
      const own = jest.fn()
      const onExpandedChange = jest.fn()
      await renderGroup({ onExpandedChange }, [
        section('first', 'First item', { onExpandedChange: own }),
        section('second', 'Second item'),
      ])

      await press('First item')

      expect(own.mock.calls).toEqual([[true]])
      expect(onExpandedChange.mock.calls).toEqual([[new Set(['first'])]])
    })

    it('takes a number as a key', async () => {
      const onExpandedChange = jest.fn()
      await renderGroup({ defaultExpandedKeys: [1], onExpandedChange }, [
        section(1, 'First item'),
        section(2, 'Second item'),
      ])

      expect(expanded()).toEqual([true, false])

      await press('Second item')

      expect(onExpandedChange.mock.calls).toEqual([[new Set([2])]])
    })

    // A section given no id still takes part, under a key of its own, as
    // React Aria's does.
    it('opens a section given no id, and closes the one that was open', async () => {
      await renderGroup({ defaultExpandedKeys: FIRST }, [
        section('first', 'First item'),
        section(undefined, 'Second item'),
      ])

      await press('Second item')

      expect(expanded()).toEqual([false, true])
    })
  })

  describe('disabled', () => {
    it('disables every section, which takes no press', async () => {
      const onExpandedChange = jest.fn()
      await renderGroup({
        defaultExpandedKeys: FIRST,
        isDisabled: true,
        onExpandedChange,
      })

      await press('Second item')

      for (const each of screen.getAllByRole('button')) {
        expect(each).toBeDisabled()
      }
      expect(onExpandedChange).not.toHaveBeenCalled()
      expect(expanded()).toEqual([true, false, false])
    })

    it("fades every section's headline", async () => {
      await renderGroup({ isDisabled: true })

      for (const label of ['First item', 'Second item', 'Third item']) {
        expect(textStyleOf(screen.getByText(label)).color).toBe(FADED)
      }
    })

    it('leaves the others alone when one section is disabled', async () => {
      await renderGroup({}, [
        section('first', 'First item', { isDisabled: true }),
        section('second', 'Second item'),
      ])

      expect(button('First item')).toBeDisabled()
      expect(button('Second item')).not.toBeDisabled()

      await press('Second item')

      expect(expanded()).toEqual([false, true])
    })
  })

  describe('the rule between the sections', () => {
    it('draws one between each pair and none at the ends', async () => {
      await renderGroup()

      expect(rules()).toHaveLength(2)
    })

    it('draws each between the two sections it divides', async () => {
      await renderGroup()

      const kinds = screen
        .getByTestId('group')
        .children.map((child) => roleOf(child))

      expect(kinds).toEqual([
        undefined,
        'separator',
        undefined,
        'separator',
        undefined,
      ])
    })

    it('draws none when the group is undivided', async () => {
      await renderGroup({ divided: false })

      expect(rules()).toHaveLength(0)
    })

    it('draws none for a single section', async () => {
      await renderGroup({}, section('first', 'First item'))

      expect(rules()).toHaveLength(0)
    })

    // Sections are as often written inside a fragment as listed as siblings,
    // and a call site that maps over data and wraps the result gets one.
    // React's own child helpers hand a fragment back as a single child, so
    // without opening it up the group would draw no rules at all.
    it('draws them for sections written inside a fragment', async () => {
      await renderGroup(
        {},
        <>
          {section('first', 'First item')}
          {section('second', 'Second item')}
          {section('third', 'Third item')}
        </>,
      )

      expect(screen.getAllByRole('button')).toHaveLength(3)
      expect(rules()).toHaveLength(2)
    })

    it('draws them for sections nested a fragment deeper', async () => {
      await renderGroup(
        {},
        <>
          {section('first', 'First item')}
          <>
            {section('second', 'Second item')}
            {section('third', 'Third item')}
          </>
        </>,
      )

      expect(rules()).toHaveLength(2)
    })

    // A section left out by a condition is no section, so no rule is drawn
    // for it at either end.
    it('draws none for a section a condition left out', async () => {
      await renderGroup(
        {},
        <>
          {section('first', 'First item')}
          {null}
          {section('third', 'Third item')}
        </>,
      )

      expect(rules()).toHaveLength(1)
    })
  })

  // Each section keeps its own instance, under the key React gave it, so one
  // added before it remounts nothing: the open section keeps the height its
  // content last reported rather than starting again unmeasured.
  it('keeps each section as it was when one is added before it', async () => {
    await renderGroup({ defaultExpandedKeys: FIRST }, [
      section('first', 'First item'),
      section('second', 'Second item'),
    ])
    const inner = screen.getByTestId('First item panel').children.at(0)
    if (inner === undefined || typeof inner === 'string') {
      throw new TypeError('expected the panel to hold a view')
    }
    await fireEvent(inner, 'layout', {
      nativeEvent: { layout: { height: 120, width: 360, x: 0, y: 0 } },
    })

    await screen.rerender(
      <DisclosureGroup defaultExpandedKeys={FIRST} testID="group">
        {[
          section('zero', 'Zero item'),
          section('first', 'First item'),
          section('second', 'Second item'),
        ]}
      </DisclosureGroup>,
    )
    await act(() => {
      jest.advanceTimersByTime(0)
    })

    expect(expanded()).toEqual([false, true, false])
    const { height }: { height?: unknown } = getAnimatedStyle(
      screen.getByTestId('First item panel'),
    )
    expect(height).toBe(120)
  })

  describe('the call site', () => {
    it("lands style, ref and testID on the group's own view, and draws nothing of its own", async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await renderGroup({ ref, style: CALL_SITE, testID: 'group' })

      expect(styleOf(screen.getByTestId('group'))).toEqual(CALL_SITE)
      expect(ref.current).not.toBeNull()
    })
  })
})
