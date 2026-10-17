import type { ComponentRef, ReactNode } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { TestNode } from 'test-renderer'

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
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import { CheckboxGroup } from '.'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'
import { Button } from '../button'
import { Checkbox } from '../checkbox'
import { Form } from '../form'

const { theme } = scopeFor('light', {})
const { colors, motion, spacing, stateLayerOpacity, typography } = theme

// React Native's Jest preset reports a font scale of 2.
const FONT_SCALE = 2

const REQUIRED = 'Fill out this field.'

const DISABLED = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContent,
)

// Hoisted so each is one stable value per render, which is what react-perf's
// no-new-array-as-prop and no-new-object-as-prop are after.
const FIRST = ['first']
const OFFSET = { marginTop: 4 }
const SERVER_ERRORS = { items: 'Choose another item.' }

type Host = ReturnType<typeof screen.getByTestId>

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// What the validate under test says about a selection.
function atLeastTwo(value: readonly string[]) {
  return value.length < 2 ? 'Choose at least two.' : null
}

function box(name: string) {
  return screen.getByRole('checkbox', { name })
}

function child(element: null | TestNode | undefined) {
  if (
    element === null ||
    element === undefined ||
    typeof element === 'string'
  ) {
    throw new TypeError('expected a view')
  }
  return element
}

// The group, which is the element rendered. A container is never an
// accessibility element of its own, since iOS would then read it as one and
// hide its checkboxes, so it is not one Testing Library finds by role.
function group() {
  const root = screen.root
  if (root?.props.role !== 'group') {
    throw new TypeError('expected the group')
  }
  return root
}

// What a screen reader hears a focused row described by, which is how a
// test tells one checkbox's row from another's.
function hintOf(view: unknown): unknown {
  if (typeof view !== 'object' || view === null || !('props' in view)) {
    return undefined
  }
  const { props } = view
  return typeof props === 'object' &&
    props !== null &&
    'accessibilityHint' in props
    ? props.accessibilityHint
    : undefined
}

function Items() {
  return (
    <>
      <Checkbox value="first">First item</Checkbox>
      <Checkbox value="second">Second item</Checkbox>
      <Checkbox value="third">Third item</Checkbox>
    </>
  )
}

// The line under the group: its last child.
function line() {
  return child(group().children.at(-1))
}

function missing(): never {
  throw new TypeError('expected the view to be mounted')
}

// The 18dp box of a checkbox, inside its 40dp disc after the press
// feedback's layer, with its rule once its ease has run.
async function ruleOf(name: string) {
  await advance(motion.durationShort2)
  const square = child(child(box(name).children.at(0)).children.at(1))
  return withOpacity(String(getAnimatedStyle(square).borderColor), 1)
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle & ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

async function submit() {
  await fireEvent.press(screen.getByRole('button', { name: 'Submit' }))
}

function textColorOf(element: Host) {
  return styleOf(element).color
}

function withForm(children: ReactNode, props = {}) {
  return (
    <Form {...props}>
      {children}
      <Button type="submit">Submit</Button>
    </Form>
  )
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('CheckboxGroup', () => {
  it('passes style, ref and testID through to the group', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(
      <CheckboxGroup label="Label" ref={ref} style={OFFSET} testID="group">
        <Items />
      </CheckboxGroup>,
    )

    expect(screen.getByTestId('group')).toBe(group())
    expect(ref.current).not.toBeNull()
    expect(styleOf(group())).toMatchObject({
      flexDirection: 'column',
      marginTop: 4,
      rowGap: spacing.xs,
    })
  })

  describe('semantics', () => {
    it('is a group named by its label', async () => {
      await render(
        <CheckboxGroup label="Label">
          <Items />
        </CheckboxGroup>,
      )

      const label = screen.getByText('Label')
      expect(typeof label.props.id).toBe('string')
      expect(group().props['aria-labelledby']).toBe(label.props.id)
      expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    })

    it('marks a required group’s label', async () => {
      await render(
        <CheckboxGroup isRequired label="Label">
          <Items />
        </CheckboxGroup>,
      )

      expect(screen.getByText('Label*')).toBeTruthy()
    })

    it('leaves the group’s line where a screen reader reaches it on iOS and Android', async () => {
      await render(
        <CheckboxGroup description="Supporting line" label="Label">
          <Items />
        </CheckboxGroup>,
      )

      expect(screen.getByText('Supporting line')).toBeTruthy()
      expect(group().props).not.toHaveProperty('aria-describedby')
    })

    it('points the group at its line on the web', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await render(
        <CheckboxGroup error="Choose at least one." label="Label">
          <Items />
        </CheckboxGroup>,
      )

      const message = screen.getByText('Choose at least one.')
      expect(typeof message.props.id).toBe('string')
      expect(group().props['aria-describedby']).toBe(message.props.id)
    })

    it('names no line on the web when there is none', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await render(
        <CheckboxGroup label="Label">
          <Items />
        </CheckboxGroup>,
      )

      expect(group().props).not.toHaveProperty('aria-describedby')
    })

    it('replaces the description with the error rather than stacking them', async () => {
      await render(
        <CheckboxGroup
          description="Supporting line"
          error="Choose at least one."
          label="Label"
        >
          <Items />
        </CheckboxGroup>,
      )

      expect(screen.getByText('Choose at least one.')).toBeTruthy()
      expect(screen.queryByText('Supporting line')).toBeNull()
    })

    it('holds the error in a polite live region, mounted before it arrives', async () => {
      const view = await render(
        <CheckboxGroup label="Label">
          <Items />
        </CheckboxGroup>,
      )
      const region = child(line().children.at(0))

      expect(region.props['aria-live']).toBe('polite')

      await view.rerender(
        <CheckboxGroup error="Choose at least one." label="Label">
          <Items />
        </CheckboxGroup>,
      )

      expect(line().children.at(0)).toBe(region)
      expect(screen.getByText('Choose at least one.').parent).toBe(region)
    })

    it('announces an error as it arrives on iOS, and not one it opens with', async () => {
      const announce = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation(() => undefined)
      const view = await render(
        <CheckboxGroup error="Choose one." label="Label">
          <Items />
        </CheckboxGroup>,
      )

      expect(announce).not.toHaveBeenCalledWith('Choose one.')

      await view.rerender(
        <CheckboxGroup error="Choose at least one." label="Label">
          <Items />
        </CheckboxGroup>,
      )

      expect(announce).toHaveBeenCalledWith('Choose at least one.')
    })
  })

  describe('selection', () => {
    it('keeps its own value when uncontrolled', async () => {
      const onChange = jest.fn()
      await render(
        <CheckboxGroup defaultValue={FIRST} label="Label" onChange={onChange}>
          <Items />
        </CheckboxGroup>,
      )

      expect(box('First item')).toBeChecked()
      expect(box('Second item')).not.toBeChecked()

      await fireEvent.press(box('Second item'))

      expect(box('First item')).toBeChecked()
      expect(box('Second item')).toBeChecked()
      expect(onChange).toHaveBeenLastCalledWith(['first', 'second'])

      await fireEvent.press(box('First item'))

      expect(box('First item')).not.toBeChecked()
      expect(onChange).toHaveBeenLastCalledWith(['second'])
    })

    // Controlled means the call site owns the value: a press reports the set
    // it would become and nothing moves until the prop comes back.
    it('reports without moving when controlled', async () => {
      const onChange = jest.fn()
      await render(
        <CheckboxGroup label="Label" onChange={onChange} value={FIRST}>
          <Items />
        </CheckboxGroup>,
      )

      await fireEvent.press(box('Second item'))

      expect(onChange).toHaveBeenCalledWith(['first', 'second'])
      expect(box('Second item')).not.toBeChecked()
    })

    it('tells a checkbox’s own onChange as well', async () => {
      const onChange = jest.fn()
      await render(
        <CheckboxGroup label="Label">
          <Checkbox onChange={onChange} value="first">
            First item
          </Checkbox>
        </CheckboxGroup>,
      )

      await fireEvent.press(box('First item'))

      expect(onChange).toHaveBeenCalledWith(true)
    })

    it('disables every checkbox from the group, and dims its label', async () => {
      const onChange = jest.fn()
      await render(
        <CheckboxGroup isDisabled label="Label" onChange={onChange}>
          <Items />
        </CheckboxGroup>,
      )

      await fireEvent.press(box('First item'))

      expect(box('First item')).toBeDisabled()
      expect(box('Second item')).toBeDisabled()
      expect(onChange).not.toHaveBeenCalled()
      expect(textColorOf(screen.getByText('Label'))).toBe(DISABLED)
    })

    it('holds every checkbox still while read-only', async () => {
      const onChange = jest.fn()
      const onToggle = jest.fn()
      await render(
        <CheckboxGroup
          defaultValue={FIRST}
          isReadOnly
          label="Label"
          onChange={onChange}
        >
          <Checkbox onChange={onToggle} value="first">
            First item
          </Checkbox>
        </CheckboxGroup>,
      )

      await fireEvent.press(box('First item'))

      expect(box('First item')).toBeChecked()
      expect(box('First item')).not.toBeDisabled()
      expect(onChange).not.toHaveBeenCalled()
      expect(onToggle).not.toHaveBeenCalled()
    })

    it('asks each checkbox inside it for the entry it stands for', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(
        render(
          <CheckboxGroup label="Label">
            <Checkbox>First item</Checkbox>
          </CheckboxGroup>,
        ),
      ).rejects.toThrow('names the entry it stands for with `value`')
    })
  })

  describe('appearance', () => {
    it('sets its label in label large on surface variant', async () => {
      await render(
        <CheckboxGroup label="Label">
          <Items />
        </CheckboxGroup>,
      )

      expect(styleOf(screen.getByText('Label'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.labelLargeSize,
      })
    })

    it('draws every box, its label and its line in error while the group is invalid', async () => {
      await render(
        <CheckboxGroup error="Choose at least one." label="Label">
          <Items />
        </CheckboxGroup>,
      )

      expect(await ruleOf('First item')).toBe(withOpacity(colors.error, 1))
      expect(await ruleOf('Third item')).toBe(withOpacity(colors.error, 1))
      expect(textColorOf(screen.getByText('Label'))).toBe(colors.error)
      expect(styleOf(screen.getByText('Choose at least one.'))).toMatchObject({
        color: colors.error,
        fontSize: typography.bodySmallSize,
      })
    })

    it('keeps the boxes in their own colours while valid', async () => {
      await render(
        <CheckboxGroup label="Label">
          <Items />
        </CheckboxGroup>,
      )

      expect(await ruleOf('First item')).toBe(
        withOpacity(colors.onSurfaceVariant, 1),
      )
    })

    it('takes no place for an empty line outside a form', async () => {
      await render(
        <CheckboxGroup label="Label">
          <Items />
        </CheckboxGroup>,
      )

      expect(styleOf(line())).toMatchObject({
        marginTop: 0,
        position: 'absolute',
      })
    })

    it('sets its line 4dp further down, at least one line tall', async () => {
      await render(
        <CheckboxGroup description="Supporting line" label="Label">
          <Items />
        </CheckboxGroup>,
      )

      expect(styleOf(line())).toEqual({
        marginTop: spacing.xs,
        minHeight: typography.bodySmallLineHeight * FONT_SCALE,
      })
    })
  })

  describe('in a form', () => {
    it('holds its line from the start, so an error moves nothing', async () => {
      await render(
        withForm(
          <CheckboxGroup label="Label">
            <Items />
          </CheckboxGroup>,
        ),
      )
      // The group's last child, the group being the label's parent here,
      // inside the form.
      const last = child(screen.getByText('Label').parent?.children.at(-1))

      expect(styleOf(last)).toEqual({
        marginTop: spacing.xs,
        minHeight: typography.bodySmallLineHeight * FONT_SCALE,
      })
    })

    it('holds a native form back while a required group has nothing selected', async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <CheckboxGroup isRequired label="Label" name="items">
            <Items />
          </CheckboxGroup>,
          { onSubmit, validationBehavior: 'native' },
        ),
      )

      expect(screen.queryByText(REQUIRED)).toBeNull()

      await submit()

      expect(onSubmit).not.toHaveBeenCalled()
      expect(screen.getByText(REQUIRED)).toBeTruthy()
      expect(await ruleOf('First item')).toBe(withOpacity(colors.error, 1))

      await fireEvent.press(box('Second item'))

      expect(screen.queryByText(REQUIRED)).toBeNull()

      await submit()

      expect(onSubmit).toHaveBeenCalledWith({})
    })

    it('shows a required group’s error once a press leaves it empty', async () => {
      await render(
        withForm(
          <CheckboxGroup defaultValue={FIRST} isRequired label="Label">
            <Items />
          </CheckboxGroup>,
          { validationBehavior: 'native' },
        ),
      )

      await fireEvent.press(box('First item'))

      expect(screen.getByText(REQUIRED)).toBeTruthy()
    })

    it('focuses its first checkbox when it holds a native form back', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        withForm(
          <CheckboxGroup isRequired label="Label">
            <Checkbox description="First line" ref={ref} value="first">
              First item
            </Checkbox>
            <Checkbox description="Second line" value="second">
              Second item
            </Checkbox>
          </CheckboxGroup>,
          { validationBehavior: 'native' },
        ),
      )
      // The preset's View shares one mock `focus` between instances, so the
      // call's `this` says which was focused: the pressable row, which reads
      // its checkbox's description as its hint. Shared across tests too, so
      // cleared of what earlier ones focused.
      const focus = jest.spyOn(ref.current ?? missing(), 'focus')
      focus.mockClear()

      await submit()

      expect(focus.mock.contexts.map(hintOf)).toEqual(['First line'])
    })

    it('says what its validate says about the selection', async () => {
      await render(
        <CheckboxGroup defaultValue={FIRST} label="Label" validate={atLeastTwo}>
          <Items />
        </CheckboxGroup>,
      )

      expect(screen.getByText('Choose at least two.')).toBeTruthy()

      await fireEvent.press(box('Second item'))

      expect(screen.queryByText('Choose at least two.')).toBeNull()
    })

    it('shows the error the form has for its name until a press', async () => {
      await render(
        withForm(
          <CheckboxGroup label="Label" name="items">
            <Items />
          </CheckboxGroup>,
          { validationErrors: SERVER_ERRORS },
        ),
      )

      expect(screen.getByText('Choose another item.')).toBeTruthy()

      await fireEvent.press(box('First item'))

      expect(screen.queryByText('Choose another item.')).toBeNull()
    })

    it('submits no value of its own beside the fields', async () => {
      const onSubmit = jest.fn()
      await render(
        withForm(
          <CheckboxGroup defaultValue={FIRST} label="Label" name="items">
            <Items />
          </CheckboxGroup>,
          { onSubmit },
        ),
      )

      await submit()

      // Strictly, since an entry under its name with no value in it would
      // otherwise pass for none at all.
      expect(onSubmit.mock.calls).toStrictEqual([[{}]])
    })
  })
})
