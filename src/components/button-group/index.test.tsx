import type { ComponentProps } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
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
import { Platform, StyleSheet } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { ControlSize } from '../../button'

import { ButtonGroup } from '.'
import { scopeFor } from '../../theme/scope'
import { Button } from '../button'
import { IconButton } from '../icon-button'

const { theme } = scopeFor('light', {})
const { colors, motion, radii, sizing, spacing } = theme

// Hoisted so each is one stable array per render, which is what react-perf's
// jsx-no-new-array-as-prop is after.
const FIRST = ['first']
const SECOND = ['second']

// A press with no point on the page, on a control that measures nothing, so
// the ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// The width every button is laid out at before a case presses one, so the
// share a press moves is a round 15.
const WIDTH = 100

type Element = Parameters<typeof getAnimatedStyle>[0]

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

function buttons() {
  return screen.getAllByRole('button')
}

// A button's corners on its two sides, read once their ease has run.
function cornersOf(element: Element) {
  const style: {
    borderBottomEndRadius?: unknown
    borderBottomLeftRadius?: unknown
    borderBottomRightRadius?: unknown
    borderBottomStartRadius?: unknown
    borderRadius?: unknown
    borderTopEndRadius?: unknown
    borderTopLeftRadius?: unknown
    borderTopRightRadius?: unknown
    borderTopStartRadius?: unknown
  } = getAnimatedStyle(element)

  return {
    end: [style.borderTopEndRadius, style.borderBottomEndRadius],
    left: [style.borderTopLeftRadius, style.borderBottomLeftRadius],
    right: [style.borderTopRightRadius, style.borderBottomRightRadius],
    round: style.borderRadius,
    start: [style.borderTopStartRadius, style.borderBottomStartRadius],
  }
}

function group() {
  return screen.getByTestId('group')
}

function Group(props: Partial<ComponentProps<typeof ButtonGroup>>) {
  return (
    <ButtonGroup aria-label="Label" testID="group" {...props}>
      <Button id="first">First item</Button>
      <Button id="second">Second item</Button>
      <Button id="third">Third item</Button>
    </ButtonGroup>
  )
}

async function layOut(elements: readonly TestInstance[], width = WIDTH) {
  for (const element of elements) {
    // oxlint-disable-next-line no-await-in-loop -- each layout is an act of its own, and two acts may not overlap
    await fireEvent(element, 'layout', {
      nativeEvent: { layout: { height: 40, width, x: 0, y: 0 } },
    })
  }
}

// A button's inline padding, the same on both sides: the group's eased
// padding where it sets one, else the button's own resting padding.
function paddingOf(element: Element): unknown {
  const {
    paddingHorizontal,
    paddingLeft,
    paddingRight,
  }: {
    paddingHorizontal?: unknown
    paddingLeft?: unknown
    paddingRight?: unknown
  } = getAnimatedStyle(element)

  expect(paddingRight).toBe(paddingLeft)

  return paddingLeft ?? paddingHorizontal
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function widthOf(element: Element): unknown {
  const { width }: { width?: unknown } = getAnimatedStyle(element)

  return width
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
  jest.clearAllMocks()
  jest.restoreAllMocks()
})

describe('the structure', () => {
  it('is a named group of its buttons', async () => {
    await render(<Group />)

    expect(group().props).toMatchObject({
      'aria-label': 'Label',
      role: 'group',
    })
    expect(buttons()).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'First item' })).toBeTruthy()
  })

  it('makes its buttons radios that it selects one of, given single', async () => {
    const onSelectionChange = jest.fn<(keys: Set<unknown>) => void>()
    await render(
      <Group
        defaultSelectedKeys={FIRST}
        onSelectionChange={onSelectionChange}
        selectionMode="single"
      />,
    )

    expect(group().props.role).toBe('radiogroup')

    await fireEvent.press(screen.getByRole('radio', { name: 'Second item' }))

    expect(
      screen.getByRole('radio', { checked: true, name: 'Second item' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('radio', { checked: false, name: 'First item' }),
    ).toBeTruthy()
    expect([...(onSelectionChange.mock.calls[0]?.[0] ?? [])]).toEqual([
      'second',
    ])
  })

  it('makes them toggles it keeps any number of, given multiple', async () => {
    await render(<Group selectionMode="multiple" />)

    expect(group().props.role).toBe('toolbar')

    await fireEvent.press(screen.getByRole('button', { name: 'First item' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Third item' }))

    expect(
      screen
        .getAllByRole('button', { selected: true })
        .map(({ props }) => String(props.id)),
    ).toEqual(['first', 'third'])
  })

  it('clears the choice when the chosen button is pressed again', async () => {
    await render(<Group defaultSelectedKeys={FIRST} selectionMode="single" />)

    await fireEvent.press(screen.getByRole('radio', { name: 'First item' }))

    expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0)
  })

  it('keeps the choice, given disallowEmptySelection', async () => {
    await render(
      <Group
        defaultSelectedKeys={FIRST}
        disallowEmptySelection
        selectionMode="single"
      />,
    )

    await fireEvent.press(screen.getByRole('radio', { name: 'First item' }))

    expect(
      screen.getByRole('radio', { checked: true, name: 'First item' }),
    ).toBeTruthy()
  })

  it('follows selectedKeys, which the call site holds', async () => {
    const onSelectionChange = jest.fn<(keys: Set<unknown>) => void>()
    await render(
      <Group
        onSelectionChange={onSelectionChange}
        selectedKeys={FIRST}
        selectionMode="single"
      />,
    )

    await fireEvent.press(screen.getByRole('radio', { name: 'Second item' }))

    expect(
      screen.getByRole('radio', { checked: true, name: 'First item' }),
    ).toBeTruthy()
    expect(onSelectionChange).toHaveBeenCalledTimes(1)
  })

  it("leaves a button's own toggle props unread in a group that selects", async () => {
    const onChange = jest.fn()
    await render(
      <ButtonGroup aria-label="Label" selectionMode="multiple">
        <Button defaultSelected id="first" onChange={onChange}>
          First item
        </Button>
      </ButtonGroup>,
    )

    expect(screen.queryAllByRole('button', { selected: true })).toHaveLength(0)

    await fireEvent.press(screen.getByRole('button', { name: 'First item' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'First item', selected: true }),
    ).toBeTruthy()
  })

  it("calls a button's own onPress before the group selects it", async () => {
    const onPress = jest.fn()
    const onSelectionChange = jest.fn()
    await render(
      <ButtonGroup
        aria-label="Label"
        onSelectionChange={onSelectionChange}
        selectionMode="single"
      >
        <Button id="first" onPress={onPress}>
          First item
        </Button>
      </ButtonGroup>,
    )

    await fireEvent.press(screen.getByRole('radio', { name: 'First item' }))

    expect(onPress.mock.invocationCallOrder).toHaveLength(1)
    expect(onSelectionChange.mock.invocationCallOrder).toHaveLength(1)
    expect(onPress.mock.invocationCallOrder.at(0)).toBeLessThan(
      onSelectionChange.mock.invocationCallOrder.at(0) ?? 0,
    )
  })

  it('draws a selected button on its toggle colours', async () => {
    await render(
      <ButtonGroup
        aria-label="Label"
        defaultSelectedKeys={FIRST}
        selectionMode="single"
      >
        <Button id="first" variant="tonal">
          First item
        </Button>
        <Button id="second" variant="tonal">
          Second item
        </Button>
      </ButtonGroup>,
    )
    const [first, second] = screen.getAllByRole('radio')

    expect(styleOf(first)).toMatchObject({ backgroundColor: colors.secondary })
    expect(styleOf(second)).toMatchObject({
      backgroundColor: colors.secondaryContainer,
    })
  })

  it('keeps a text button on its plain colours and corner while selected', async () => {
    await render(
      <ButtonGroup
        aria-label="Label"
        defaultSelectedKeys={FIRST}
        selectionMode="single"
      >
        <Button id="first" variant="text">
          First item
        </Button>
      </ButtonGroup>,
    )

    expect(
      screen.getByRole('radio', { checked: true, name: 'First item' }),
    ).toBeTruthy()
    expect(styleOf(screen.getByText('First item'))).toMatchObject({
      color: colors.primary,
    })
    expect(
      cornersOf(screen.getByRole('radio', { name: 'First item' })).round,
    ).toBe(radii.pill)
  })

  it('selects icon buttons as it does buttons', async () => {
    const onChange = jest.fn()
    await render(
      <ButtonGroup aria-label="Label" selectionMode="multiple">
        <IconButton aria-label="First item" id="first" variant="tonal">
          {null}
        </IconButton>
        <IconButton
          aria-label="Second item"
          defaultSelected
          id="second"
          onChange={onChange}
          variant="tonal"
        >
          {null}
        </IconButton>
      </ButtonGroup>,
    )
    const second = screen.getByRole('button', { name: 'Second item' })

    expect(styleOf(second)).toMatchObject({
      backgroundColor: colors.secondaryContainer,
    })

    await fireEvent.press(screen.getByRole('button', { name: 'First item' }))
    await fireEvent.press(second)
    await advance(motion.durationShort2)

    const first = screen.getByRole('button', {
      name: 'First item',
      selected: true,
    })
    expect(styleOf(first)).toMatchObject({ backgroundColor: colors.secondary })
    expect(cornersOf(first).round).toBe(radii.sm)
    expect(
      screen.getByRole('button', { name: 'Second item', selected: true }),
    ).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables the icon buttons in it too', async () => {
    await render(
      <ButtonGroup aria-label="Label" isDisabled>
        <IconButton aria-label="First item">{null}</IconButton>
      </ButtonGroup>,
    )

    expect(
      screen.getByRole('button', { disabled: true, name: 'First item' }),
    ).toBeTruthy()
  })

  it.each<[string, 'multiple' | 'single' | undefined]>([
    ['a plain', undefined],
    ['a single-selecting', 'single'],
    ['a multiple-selecting', 'multiple'],
  ])('disables every button in %s group', async (_name, selectionMode) => {
    const onSelectionChange = jest.fn()
    await render(
      <Group
        isDisabled
        onSelectionChange={onSelectionChange}
        selectionMode={selectionMode}
      />,
    )
    const all = screen.getAllByRole(
      selectionMode === 'single' ? 'radio' : 'button',
      { disabled: true },
    )

    expect(all).toHaveLength(3)

    await fireEvent.press(all[1])

    expect(onSelectionChange).not.toHaveBeenCalled()
  })
})

describe('the size', () => {
  it('hands its size to the buttons in it', async () => {
    await render(<Group size="lg" />)

    for (const each of buttons()) {
      expect(styleOf(each)).toMatchObject({ minHeight: sizing.controlLg })
    }
  })

  it("leaves a button's own size standing", async () => {
    await render(
      <ButtonGroup aria-label="Label" size="lg">
        <Button size="xs">First item</Button>
        <IconButton aria-label="Second item" size="xs">
          {null}
        </IconButton>
        <IconButton aria-label="Third item">{null}</IconButton>
      </ButtonGroup>,
    )

    expect(
      styleOf(screen.getByRole('button', { name: 'First item' })),
    ).toMatchObject({ minHeight: sizing.controlXs })
    expect(
      styleOf(screen.getByRole('button', { name: 'Second item' })),
    ).toMatchObject({ height: sizing.controlXs, width: sizing.controlXs })
    expect(
      styleOf(screen.getByRole('button', { name: 'Third item' })),
    ).toMatchObject({ height: sizing.controlLg, width: sizing.controlLg })
  })
})

describe('the standard group', () => {
  it.each<[ControlSize, number]>([
    ['xs', 18],
    ['md', spacing.md],
    ['lg', spacing.sm],
    ['xl', spacing.sm],
    ['xxl', spacing.sm],
  ])('sets %s buttons %idp apart', async (size, gap) => {
    await render(<Group size={size} />)

    expect(styleOf(group())).toMatchObject({
      flexDirection: 'row',
      gap,
    })
  })

  // A fragment is opened rather than taken as one button, so the press is
  // shared out among the buttons inside it. Its buttons' keys are kept apart
  // from another fragment's, which React would otherwise say are the same,
  // and a stray string, which a row cannot hold, is passed over.
  it('reaches buttons inside a fragment', async () => {
    const error = jest.spyOn(console, 'error')
    await render(
      <ButtonGroup aria-label="Label">
        <>
          <Button id="first">First item</Button>
          <Button id="second">Second item</Button>
        </>{' '}
        <>
          <Button id="third">Third item</Button>
        </>
      </ButtonGroup>,
    )
    const [first, second, third] = buttons()

    expect(error).not.toHaveBeenCalled()
    await layOut([first, second, third])

    await fireEvent(second, 'pressIn', PRESS)
    await advance(motion.durationShort2)

    expect(paddingOf(second)).toBe(spacing.lg + 15 / 2)
    expect(paddingOf(first)).toBe(spacing.lg - 15 / 4)
    expect(paddingOf(third)).toBe(spacing.lg - 15 / 4)
  })

  // Material Design's own group widens a pressed button by 15% of its width
  // and narrows its neighbours to make the room. Button takes the change as
  // inline padding, half the share on either side.
  it('widens a pressed button and narrows both its neighbours', async () => {
    await render(<Group />)
    const [first, second, third] = buttons()
    await layOut([first, second, third])

    await fireEvent(second, 'pressIn', PRESS)
    await advance(motion.durationShort2)

    expect(paddingOf(second)).toBe(spacing.lg + 15 / 2)
    expect(paddingOf(first)).toBe(spacing.lg - 15 / 4)
    expect(paddingOf(third)).toBe(spacing.lg - 15 / 4)
    // Each side by name, which web applies to an animated style, rather than
    // the paddingHorizontal shorthand, which it drops there.
    expect(getAnimatedStyle(second)).toMatchObject({
      paddingLeft: spacing.lg + 15 / 2,
      paddingRight: spacing.lg + 15 / 2,
    })

    await fireEvent(second, 'pressOut', PRESS)
    await advance(motion.durationShort2)

    for (const each of [first, second, third]) {
      expect(paddingOf(each)).toBe(spacing.lg)
    }
  })

  it('eases the change rather than jumping to it', async () => {
    await render(<Group />)
    const [first, second] = buttons()
    await layOut([first, second])

    await fireEvent(second, 'pressIn', PRESS)
    await advance(motion.durationShort2 / 2)
    const halfway = paddingOf(second)

    expect(typeof halfway).toBe('number')
    expect(halfway).toBeGreaterThan(spacing.lg)
    expect(halfway).toBeLessThan(spacing.lg + 15 / 2)
  })

  // An outlined button gives its rule back out of its padding, and the
  // padding a group sets while it widens or narrows one has to do the same,
  // or every button it touches jumps by twice the rule.
  it('widens an outlined button by the same share', async () => {
    await render(
      <ButtonGroup aria-label="Label">
        <Button variant="outlined">First item</Button>
        <Button variant="outlined">Second item</Button>
        <Button variant="outlined">Third item</Button>
      </ButtonGroup>,
    )
    const [first, second, third] = buttons()
    await layOut([first, second, third])

    expect(paddingOf(second)).toBe(spacing.lg - 1)

    await fireEvent(second, 'pressIn', PRESS)
    await advance(motion.durationShort2)

    expect(paddingOf(second)).toBe(spacing.lg - 1 + 15 / 2)
    expect(paddingOf(first)).toBe(spacing.lg - 1 - 15 / 4)
  })

  it('takes all the room from the one neighbour of a button at an end', async () => {
    await render(<Group />)
    const [first, second, third] = buttons()
    await layOut([first, second, third])

    await fireEvent(first, 'pressIn', PRESS)
    await advance(motion.durationShort2)

    expect(paddingOf(first)).toBe(spacing.lg + 15 / 2)
    expect(paddingOf(second)).toBe(spacing.lg - 15 / 2)
    expect(paddingOf(third)).toBe(spacing.lg)
  })

  it('widens a pressed icon button too', async () => {
    await render(
      <ButtonGroup aria-label="Label">
        <IconButton aria-label="First item" variant="filled">
          {null}
        </IconButton>
        <IconButton aria-label="Second item" variant="filled">
          {null}
        </IconButton>
      </ButtonGroup>,
    )
    const [first, second] = buttons()
    await layOut([first, second], sizing.controlSm)

    await fireEvent(first, 'pressIn', PRESS)
    await advance(motion.durationShort2)

    expect(widthOf(first)).toBeCloseTo(sizing.controlSm * 1.15)
    expect(widthOf(second)).toBeCloseTo(sizing.controlSm * 0.85)
  })

  it("calls a button's own press handlers as well", async () => {
    const onPressIn = jest.fn()
    const onPressOut = jest.fn()
    await render(
      <ButtonGroup aria-label="Label">
        <Button onPressIn={onPressIn} onPressOut={onPressOut}>
          First item
        </Button>
      </ButtonGroup>,
    )
    const [first] = buttons()

    await fireEvent(first, 'pressIn', PRESS)
    await fireEvent(first, 'pressOut', PRESS)

    expect(onPressIn).toHaveBeenCalledTimes(1)
    expect(onPressOut).toHaveBeenCalledTimes(1)
  })

  it.each(['connected', 'standard'] as const)(
    "calls a button's own onLayout in a %s group",
    async (variant) => {
      const onLayout = jest.fn()
      await render(
        <ButtonGroup aria-label="Label" variant={variant}>
          <Button onLayout={onLayout}>First item</Button>
          <IconButton aria-label="Second item" onLayout={onLayout}>
            {null}
          </IconButton>
        </ButtonGroup>,
      )

      await layOut(buttons())

      expect(onLayout).toHaveBeenCalledTimes(2)
    },
  )

  it("keeps the buttons' own corners", async () => {
    await render(<Group />)
    const [first] = buttons()

    expect(cornersOf(first).round).toBe(radii.pill)
  })

  it('gives its buttons no minimum width', async () => {
    await render(<Group size="xs" />)

    expect(styleOf(buttons()[0]).minWidth).toBeUndefined()
  })
})

describe('the connected group', () => {
  it('sets its buttons 2dp apart', async () => {
    await render(<Group size="xl" variant="connected" />)

    expect(styleOf(group())).toMatchObject({
      gap: spacing.xxs,
    })
  })

  it('squares off the inner corners and keeps the ends round', async () => {
    await render(<Group variant="connected" />)
    const [first, second, third] = buttons()
    const round = sizing.controlSm / 2

    expect(cornersOf(first)).toMatchObject({
      end: [radii.sm, radii.sm],
      start: [round, round],
    })
    expect(cornersOf(second)).toMatchObject({
      end: [radii.sm, radii.sm],
      start: [radii.sm, radii.sm],
    })
    expect(cornersOf(third)).toMatchObject({
      end: [round, round],
      start: [radii.sm, radii.sm],
    })
  })

  // Start and end rather than left and right, which is what turns the round
  // end over with the layout's direction.
  it('keeps the round end at the start, whichever way the layout runs', async () => {
    await render(<Group variant="connected" />)
    const [first] = buttons()

    expect(cornersOf(first)).toMatchObject({
      left: [undefined, undefined],
      right: [undefined, undefined],
      round: undefined,
    })
  })

  // On web Reanimated writes the animated style straight onto the element,
  // where the logical corners are no CSS properties, so the start is the
  // left there.
  it('sets the physical corners on web, the round end on the left', async () => {
    jest.replaceProperty(Platform, 'OS', 'web')
    await render(<Group variant="connected" />)
    const [first] = buttons()
    const round = sizing.controlSm / 2

    expect(cornersOf(first)).toMatchObject({
      end: [undefined, undefined],
      left: [round, round],
      right: [radii.sm, radii.sm],
      start: [undefined, undefined],
    })
  })

  it.each<[ControlSize, number]>([
    ['xs', radii.xs],
    ['lg', radii.sm],
    ['xl', radii.lg],
    ['xxl', 20],
  ])('gives %s buttons a %ddp inner corner', async (size, corner) => {
    await render(<Group size={size} variant="connected" />)
    const [first] = buttons()

    expect(cornersOf(first).end).toEqual([corner, corner])
  })

  it('takes the inner corner at its ends too when square', async () => {
    await render(<Group shape="square" variant="connected" />)
    const [first] = buttons()

    expect(cornersOf(first)).toMatchObject({
      end: [radii.sm, radii.sm],
      start: [radii.sm, radii.sm],
    })
  })

  it.each<[ControlSize, number]>([
    ['md', radii.xs],
    ['xs', 2],
    ['xl', radii.sm],
    ['xxl', 10],
  ])(
    "tightens a pressed %s button's inner corners to %ddp",
    async (size, corner) => {
      await render(<Group size={size} variant="connected" />)
      const [, second] = buttons()

      await fireEvent(second, 'pressIn', PRESS)
      await advance(motion.durationShort2)

      expect(cornersOf(second)).toMatchObject({
        end: [corner, corner],
        start: [corner, corner],
      })
    },
  )

  it("rounds off a selected button's inner corners", async () => {
    await render(
      <Group
        defaultSelectedKeys={SECOND}
        selectionMode="single"
        variant="connected"
      />,
    )
    const second = screen.getByRole('radio', { name: 'Second item' })
    const round = sizing.controlSm / 2

    expect(cornersOf(second)).toMatchObject({
      end: [round, round],
      start: [round, round],
    })
  })

  it("rounds off a selected icon button's inner corners", async () => {
    await render(
      <ButtonGroup
        aria-label="Label"
        defaultSelectedKeys={FIRST}
        selectionMode="single"
        variant="connected"
      >
        <IconButton aria-label="First item" id="first">
          {null}
        </IconButton>
        <IconButton aria-label="Second item" id="second">
          {null}
        </IconButton>
      </ButtonGroup>,
    )
    const round = sizing.controlSm / 2

    expect(
      cornersOf(screen.getByRole('radio', { name: 'First item' })),
    ).toMatchObject({ end: [round, round], start: [round, round] })
  })

  it("rounds off a button's own toggle once selected", async () => {
    await render(
      <ButtonGroup aria-label="Label" variant="connected">
        <Button>First item</Button>
        <Button defaultSelected variant="tonal">
          Second item
        </Button>
      </ButtonGroup>,
    )
    const second = screen.getByRole('button', { name: 'Second item' })
    const round = sizing.controlSm / 2

    expect(cornersOf(second)).toMatchObject({
      start: [round, round],
    })
  })

  it('lets a press win over a selection', async () => {
    await render(
      <Group
        defaultSelectedKeys={SECOND}
        selectionMode="single"
        variant="connected"
      />,
    )
    const second = screen.getByRole('radio', { name: 'Second item' })

    await fireEvent(second, 'pressIn', PRESS)
    await advance(motion.durationShort2)

    expect(cornersOf(second).start).toEqual([radii.xs, radii.xs])
  })

  it('leaves the widths alone while a button is pressed', async () => {
    await render(<Group variant="connected" />)
    const [first, second] = buttons()
    await layOut([first, second])

    await fireEvent(second, 'pressIn', PRESS)
    await advance(motion.durationShort2)

    expect(paddingOf(first)).toBe(spacing.lg)
    expect(paddingOf(second)).toBe(spacing.lg)
  })

  it.each(['xs', 'md'] as const)(
    'gives %s buttons the 48dp touch target as a minimum width',
    async (size) => {
      await render(
        <ButtonGroup aria-label="Label" size={size} variant="connected">
          <Button>First item</Button>
          <IconButton aria-label="Second item">{null}</IconButton>
        </ButtonGroup>,
      )
      const [first, second] = buttons()

      expect(styleOf(first)).toMatchObject({ minWidth: 48 })
      expect(styleOf(second)).toMatchObject({ minWidth: 48 })
      // The width is the target already, so the reach adds nothing across.
      expect(second.props.hitSlop).toMatchObject({ left: 0, right: 0 })
    },
  )

  it('gives larger buttons no minimum width', async () => {
    await render(<Group size="lg" variant="connected" />)

    expect(styleOf(buttons()[0]).minWidth).toBeUndefined()
  })
})
