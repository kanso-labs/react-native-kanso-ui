import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { TestInstance, TestNode } from 'test-renderer'

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

import type { ChipProps } from '.'

import { Chip } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

// What the next chip the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

const { theme } = scopeFor('light', {})
const {
  colors,
  motion,
  radii,
  shadows,
  sizing,
  spacing,
  stateLayerOpacity,
  typography,
} = theme

const DISABLED_CONTAINER = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContainer,
)
const DISABLED_CONTENT = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContent,
)

// The two transparent colours the chip eases through: the secondary container
// and the outline variant at no opacity.
const NO_FILL = withOpacity(colors.secondaryContainer, 0)
const NO_RULE = withOpacity(colors.outlineVariant, 0)

// kanso-ui's path, copied rather than read from the glyph under test.
const CHECK = 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'

const CALL_SITE = { marginTop: 4 }

// A press with no point on the page, on a control that measures nothing, so
// the ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// What each kind of chip draws at rest: its fill, its rule, its label, and
// whether it casts the page's elevation 1.
const PAINTS: readonly (readonly [
  string,
  ChipProps,
  {
    readonly fill: string
    readonly label: string
    readonly rule: string
    readonly shadow: string | undefined
  },
])[] = [
  [
    'an unselected filter chip',
    { children: 'Label' },
    {
      fill: NO_FILL,
      label: colors.onSurfaceVariant,
      rule: colors.outlineVariant,
      shadow: undefined,
    },
  ],
  [
    'a selected filter chip',
    { children: 'Label', defaultSelected: true },
    {
      fill: colors.secondaryContainer,
      label: colors.onSecondaryContainer,
      rule: NO_RULE,
      shadow: undefined,
    },
  ],
  [
    'an assist chip',
    { children: 'Label', variant: 'assist' },
    {
      fill: NO_FILL,
      label: colors.onSurface,
      rule: colors.outlineVariant,
      shadow: undefined,
    },
  ],
  [
    'a suggestion chip',
    { children: 'Label', variant: 'suggestion' },
    {
      fill: NO_FILL,
      label: colors.onSurfaceVariant,
      rule: colors.outlineVariant,
      shadow: undefined,
    },
  ],
  [
    'an elevated chip',
    { children: 'Label', elevated: true },
    {
      fill: colors.surfaceContainerLow,
      label: colors.onSurfaceVariant,
      rule: NO_RULE,
      shadow: shadows.elevation1,
    },
  ],
  [
    'an elevated assist chip',
    { children: 'Label', elevated: true, variant: 'assist' },
    {
      fill: colors.surfaceContainerLow,
      label: colors.onSurface,
      rule: NO_RULE,
      shadow: shadows.elevation1,
    },
  ],
  [
    'a selected elevated chip',
    { children: 'Label', defaultSelected: true, elevated: true },
    {
      fill: colors.secondaryContainer,
      label: colors.onSecondaryContainer,
      rule: NO_RULE,
      shadow: shadows.elevation1,
    },
  ],
  [
    'a disabled chip',
    { children: 'Label', isDisabled: true },
    {
      fill: NO_FILL,
      label: DISABLED_CONTENT,
      rule: DISABLED_CONTAINER,
      shadow: undefined,
    },
  ],
  [
    'a disabled selected chip',
    { children: 'Label', defaultSelected: true, isDisabled: true },
    {
      fill: DISABLED_CONTAINER,
      label: DISABLED_CONTENT,
      rule: NO_RULE,
      shadow: undefined,
    },
  ],
  [
    'a disabled elevated chip',
    { children: 'Label', elevated: true, isDisabled: true },
    {
      fill: DISABLED_CONTAINER,
      label: DISABLED_CONTENT,
      rule: NO_RULE,
      shadow: undefined,
    },
  ],
  [
    'a disabled assist chip',
    { children: 'Label', isDisabled: true, variant: 'assist' },
    {
      fill: NO_FILL,
      label: DISABLED_CONTENT,
      rule: DISABLED_CONTAINER,
      shadow: undefined,
    },
  ],
]

// The state layer's colour over each container: on-surface over the outline
// and the elevated container alike, on-secondary-container over the selected.
const LAYERS: readonly (readonly [string, Partial<ChipProps>, string])[] = [
  ['an unselected chip', {}, colors.onSurface],
  ['an elevated chip', { elevated: true }, colors.onSurface],
  ['a selected chip', { defaultSelected: true }, colors.onSecondaryContainer],
]

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
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

function chip() {
  return screen.getByTestId('chip')
}

// The chip's fill, rule and label as they stand.
function colorsNow() {
  const container = getAnimatedStyle(chip())
  const text = getAnimatedStyle(label())
  return {
    fill: same(container.backgroundColor),
    label: same('color' in text ? text.color : undefined),
    rule: same(container.borderColor),
  }
}

// The slot before the label, while one is drawn.
function glyph() {
  return child(chip().children.at(1))
}

// An icon of the app's own, which writes the colour and size its slot hands
// it, as `colour size`.
function IconProbe() {
  const { color, size } = useIconStyle()

  return <Text testID="icon">{`${String(color)} ${String(size)}`}</Text>
}

// Hoisted so it is one stable element per render, which is what react-perf's
// no-jsx-as-prop is after.
const ICON = <IconProbe />

function label() {
  return screen.getByText('Label')
}

// The state layer, under the surface the press feedback draws first.
function layer() {
  return child(child(chip().children.at(0)).children.at(0))
}

function pathsIn(node: TestInstance): unknown[] {
  const d: unknown = node.props.d
  return [
    ...(node.type === 'RNSVGPath' ? [d] : []),
    ...node.children.flatMap((part) =>
      typeof part === 'string' ? [] : pathsIn(part),
    ),
  ]
}

// One spelling of a colour, since Reanimated writes the colours it eases
// through as `rgba()` whatever they were given as.
function same(color: unknown) {
  if (typeof color !== 'string') {
    throw new TypeError('expected a colour')
  }
  return withOpacity(color, 1)
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle | ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  mockReducedMotion = false
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('Chip', () => {
  it('is a button named by its label', async () => {
    await render(<Chip>Label</Chip>)

    expect(screen.getByRole('button', { name: 'Label' })).toBeTruthy()
  })

  it.each(['assist', 'suggestion'] as const)(
    'is a button named by its label as an %s chip',
    async (variant) => {
      await render(<Chip variant={variant}>Label</Chip>)

      expect(screen.getByRole('button', { name: 'Label' })).toBeTruthy()
    },
  )

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn()
    await render(
      <Chip onPress={onPress} variant="assist">
        Label
      </Chip>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Label' }))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('is disabled, and takes no press, given isDisabled', async () => {
    const onChange = jest.fn()
    const onPress = jest.fn()
    await render(
      <Chip isDisabled onChange={onChange} onPress={onPress}>
        Label
      </Chip>,
    )

    const disabled = screen.getByRole('button', {
      disabled: true,
      name: 'Label',
    })
    await fireEvent.press(disabled)

    expect(onPress).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    expect(disabled).not.toBeSelected()
  })

  it('puts the style, ref and testID on the pressable', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(
      <Chip ref={ref} style={CALL_SITE} testID="chip">
        Label
      </Chip>,
    )

    expect(styleOf(chip())).toMatchObject(CALL_SITE)
    // The pressable's own view, which Reanimated's wrapper hands the ref on
    // to, rather than the wrapper.
    expect(typeof ref.current?.measure).toBe('function')
  })

  it('passes the rest of its props to the pressable', async () => {
    await render(
      <Chip aria-label="Name" testID="chip">
        Label
      </Chip>,
    )

    expect(screen.getByRole('button', { name: 'Name' })).toBe(chip())
  })
})

describe('the filter chip', () => {
  it('reports its state, and changes it when pressed', async () => {
    const onChange = jest.fn()
    await render(<Chip onChange={onChange}>Label</Chip>)

    const filter = screen.getByRole('button', { name: 'Label' })
    expect(filter).not.toBeSelected()

    await fireEvent.press(filter)

    expect(filter).toBeSelected()
    expect(onChange).toHaveBeenCalledWith(true)

    await fireEvent.press(filter)

    expect(filter).not.toBeSelected()
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it('starts selected given defaultSelected', async () => {
    await render(<Chip defaultSelected>Label</Chip>)

    expect(screen.getByRole('button', { name: 'Label' })).toBeSelected()
  })

  it('calls onPress before onChange', async () => {
    const calls: string[] = []
    const onChange = jest.fn(() => {
      calls.push('change')
    })
    const onPress = jest.fn(() => {
      calls.push('press')
    })
    await render(
      <Chip onChange={onChange} onPress={onPress}>
        Label
      </Chip>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Label' }))

    expect(calls).toEqual(['press', 'change'])
  })

  it('follows isSelected when the call site holds the state', async () => {
    const onChange = jest.fn()
    await render(
      <Chip isSelected onChange={onChange}>
        Label
      </Chip>,
    )

    const filter = screen.getByRole('button', { name: 'Label' })
    await fireEvent.press(filter)

    expect(onChange).toHaveBeenCalledWith(false)
    expect(filter).toBeSelected()
  })

  it('draws the check before its label once selected', async () => {
    await render(<Chip testID="chip">Label</Chip>)

    expect(chip().children).toHaveLength(2)

    await fireEvent.press(chip())

    expect(pathsIn(glyph())).toEqual([CHECK])
  })

  it('draws the check in place of its icon, in the label colour', async () => {
    await render(
      <Chip defaultSelected icon={ICON} testID="chip">
        Label
      </Chip>,
    )

    expect(screen.queryByTestId('icon')).toBeNull()
    expect(pathsIn(glyph())).toEqual([CHECK])
    const check = child(glyph().children.at(0))
    expect(check.props).toMatchObject({
      color: colors.onSecondaryContainer,
      height: 18,
      width: 18,
    })
  })

  // src/button's toggleState reports a device's selected state, which
  // VoiceOver and TalkBack read, and web's `aria-pressed` under React Native
  // Web; the suite runs as a device.
  it('reports its state as a device does, selected or not', async () => {
    await render(
      <>
        <Chip defaultSelected testID="chip">
          Label
        </Chip>
        <Chip testID="unselected">Unselected</Chip>
      </>,
    )

    expect(chip().props.accessibilityState).toMatchObject({ selected: true })
    expect(
      screen.getByTestId('unselected').props.accessibilityState,
    ).toMatchObject({ selected: false })
  })
})

describe('the action chips', () => {
  it.each(['assist', 'suggestion'] as const)(
    'never selects an %s chip',
    async (variant) => {
      const onPress = jest.fn()
      await render(
        <Chip onPress={onPress} testID="chip" variant={variant}>
          Label
        </Chip>,
      )

      await fireEvent.press(chip())

      expect(onPress).toHaveBeenCalledTimes(1)
      expect(chip()).not.toBeSelected()
      expect(chip().props).not.toMatchObject({
        accessibilityState: { selected: expect.any(Boolean) },
      })
    },
  )

  it('stays unselected given selected props past its types', async () => {
    const onChange = jest.fn()
    await render(
      // @ts-expect-error An action chip takes no selected state.
      <Chip defaultSelected onChange={onChange} testID="chip" variant="assist">
        Label
      </Chip>,
    )

    await fireEvent.press(chip())

    expect(chip()).not.toBeSelected()
    expect(onChange).not.toHaveBeenCalled()
    expect(chip().children).toHaveLength(2)
  })
})

describe('the colours', () => {
  it.each(PAINTS)('draws %s', async (_name, props, paint) => {
    await render(<Chip {...props} testID="chip" />)

    expect(colorsNow()).toEqual({
      fill: same(paint.fill),
      label: same(paint.label),
      rule: same(paint.rule),
    })
    expect(styleOf(chip()).boxShadow).toBe(paint.shadow)
  })

  it('hands its icon the primary role at 18dp', async () => {
    await render(<Chip icon={ICON}>Label</Chip>)

    expect(screen.getByTestId('icon')).toHaveTextContent(`${colors.primary} 18`)
  })

  it('hands its icon the primary role on an assist chip', async () => {
    await render(
      <Chip elevated icon={ICON} variant="assist">
        Label
      </Chip>,
    )

    expect(screen.getByTestId('icon')).toHaveTextContent(`${colors.primary} 18`)
  })

  it('hands its icon the disabled label colour while disabled', async () => {
    await render(
      <Chip icon={ICON} isDisabled>
        Label
      </Chip>,
    )

    expect(screen.getByTestId('icon')).toHaveTextContent(
      `${DISABLED_CONTENT} 18`,
    )
  })

  it('draws a disabled check in the disabled label colour', async () => {
    await render(
      <Chip defaultSelected isDisabled testID="chip">
        Label
      </Chip>,
    )

    expect(child(glyph().children.at(0)).props.color).toBe(DISABLED_CONTENT)
  })
})

describe('the ease', () => {
  it('eases its fill, rule and label over the short duration', async () => {
    await render(<Chip testID="chip">Label</Chip>)

    await fireEvent.press(chip())
    await advance(motion.durationShort2 / 2)
    const midway = colorsNow()

    expect(midway.fill).not.toBe(same(NO_FILL))
    expect(midway.fill).not.toBe(same(colors.secondaryContainer))
    expect(midway.rule).not.toBe(same(colors.outlineVariant))
    expect(midway.rule).not.toBe(same(NO_RULE))
    expect(midway.label).not.toBe(same(colors.onSurfaceVariant))
    expect(midway.label).not.toBe(same(colors.onSecondaryContainer))

    await advance(motion.durationShort2 / 2)

    expect(colorsNow()).toEqual({
      fill: same(colors.secondaryContainer),
      label: same(colors.onSecondaryContainer),
      rule: same(NO_RULE),
    })
  })

  it('eases the fill through the container rather than through black', async () => {
    await render(<Chip testID="chip">Label</Chip>)

    await fireEvent.press(chip())
    await advance(motion.durationShort2 / 2)

    // The fill's channels stay the container's while its opacity rises.
    const fill = String(getAnimatedStyle(chip()).backgroundColor)
    expect(fill.slice(0, fill.lastIndexOf(','))).toBe(
      same(colors.secondaryContainer).slice(
        0,
        same(colors.secondaryContainer).lastIndexOf(','),
      ),
    )
  })

  it('changes its colours at once under reduced motion', async () => {
    mockReducedMotion = true
    await render(<Chip testID="chip">Label</Chip>)

    await fireEvent.press(chip())
    await advance(20)

    expect(colorsNow()).toEqual({
      fill: same(colors.secondaryContainer),
      label: same(colors.onSecondaryContainer),
      rule: same(NO_RULE),
    })
  })
})

describe('the shape', () => {
  it('draws the page pill: 32dp, an 8dp corner and a 1dp rule', async () => {
    await render(<Chip testID="chip">Label</Chip>)

    expect(styleOf(chip())).toMatchObject({
      alignItems: 'center',
      borderRadius: radii.sm,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      maxWidth: '100%',
      minHeight: sizing.controlXs,
      paddingHorizontal: spacing.lg,
    })
    expect(styleOf(chip()).paddingVertical).toBeUndefined()
  })

  it('sets its label in label-large, on one line', async () => {
    await render(<Chip>Label</Chip>)

    expect(label().props.numberOfLines).toBe(1)
    expect(styleOf(label())).toMatchObject({
      flexShrink: 1,
      fontSize: typography.labelLargeSize,
      letterSpacing: typography.labelLargeTracking,
      lineHeight: typography.labelLargeLineHeight,
      minWidth: 0,
    })
  })

  it('draws its icon in an 18dp slot that gives back half the padding', async () => {
    await render(
      <Chip icon={ICON} testID="chip">
        Label
      </Chip>,
    )

    expect(styleOf(glyph())).toMatchObject({
      flexShrink: 0,
      height: 18,
      marginStart: -spacing.sm,
      width: 18,
    })
  })

  it('draws no slot without an icon', async () => {
    await render(<Chip testID="chip">Label</Chip>)

    // The press feedback's surface and the label, and nothing between.
    expect(chip().children).toHaveLength(2)
    expect(child(chip().children.at(1)).props.children).toBe('Label')
  })
})

describe('the target', () => {
  it('reaches half the gap between rows before it is measured', async () => {
    await render(<Chip testID="chip">Label</Chip>)

    expect(chip().props.hitSlop).toEqual({
      bottom: spacing.sm / 2,
      left: 0,
      right: 0,
      top: spacing.sm / 2,
    })
  })

  it('reaches across to 48dp once a narrow chip is measured', async () => {
    const onLayout = jest.fn()
    await render(
      <Chip onLayout={onLayout} testID="chip">
        Label
      </Chip>,
    )

    const event = {
      nativeEvent: { layout: { height: 32, width: 30, x: 0, y: 0 } },
    }
    await fireEvent(chip(), 'layout', event)

    expect(chip().props.hitSlop).toEqual({
      bottom: spacing.sm / 2,
      left: 9,
      right: 9,
      top: spacing.sm / 2,
    })
    expect(onLayout).toHaveBeenCalledWith(event)
  })

  it('reaches no further across a chip wider than 48dp', async () => {
    await render(<Chip testID="chip">Label</Chip>)

    await fireEvent(chip(), 'layout', {
      nativeEvent: { layout: { height: 32, width: 96, x: 0, y: 0 } },
    })

    expect(chip().props.hitSlop).toMatchObject({ left: 0, right: 0 })
  })

  it("takes the call site's own hitSlop over its own", async () => {
    await render(
      <Chip hitSlop={12} testID="chip">
        Label
      </Chip>,
    )

    expect(chip().props.hitSlop).toBe(12)
  })
})

describe('the shadow', () => {
  it('rises to elevation 2 under a pointer, pressed or not', async () => {
    await render(
      <Chip elevated testID="chip">
        Label
      </Chip>,
    )

    await fireEvent(chip(), 'hoverIn', {})
    expect(styleOf(chip()).boxShadow).toBe(shadows.elevation2)

    await fireEvent(chip(), 'pressIn', PRESS)
    expect(styleOf(chip()).boxShadow).toBe(shadows.elevation2)

    await fireEvent(chip(), 'pressOut', {})
    await fireEvent(chip(), 'hoverOut', {})
    expect(styleOf(chip()).boxShadow).toBe(shadows.elevation1)
  })

  it('stays flat under a pointer when not elevated', async () => {
    await render(<Chip testID="chip">Label</Chip>)

    await fireEvent(chip(), 'hoverIn', {})

    expect(styleOf(chip()).boxShadow).toBeUndefined()
  })
})

describe('the press feedback', () => {
  it.each(LAYERS)(
    'draws its layer over %s in the page role',
    async (_name, props, color) => {
      await render(
        <Chip {...props} testID="chip">
          Label
        </Chip>,
      )

      await fireEvent(chip(), 'hoverIn', {})

      expect(styleOf(layer())).toMatchObject({
        backgroundColor: color,
        opacity: stateLayerOpacity.hover,
      })
    },
  )

  it('draws no layer, and no ring, while disabled', async () => {
    await render(
      <Chip isDisabled testID="chip">
        Label
      </Chip>,
    )

    await fireEvent(chip(), 'hoverIn', {})
    await fireEvent(chip(), 'focus', {})

    expect(styleOf(layer()).opacity).toBe(0)
    expect(styleOf(chip()).outlineWidth).toBeUndefined()
  })

  it('clips its layer to the corner', async () => {
    await render(<Chip testID="chip">Label</Chip>)

    expect(styleOf(child(chip().children.at(0)))).toMatchObject({
      borderRadius: radii.sm,
      overflow: 'hidden',
    })
  })

  it('shows the focus ring when focus arrives from a key', async () => {
    await render(<Chip testID="chip">Label</Chip>)

    await fireEvent(chip(), 'focus', {})

    expect(styleOf(chip())).toMatchObject({
      outlineColor: colors.primary,
      outlineWidth: 2,
    })
  })

  it('calls the handlers it takes over', async () => {
    const onHoverIn = jest.fn()
    const onPressIn = jest.fn()
    await render(
      <Chip onHoverIn={onHoverIn} onPressIn={onPressIn} testID="chip">
        Label
      </Chip>,
    )

    await fireEvent(chip(), 'hoverIn', {})
    await fireEvent(chip(), 'pressIn', PRESS)

    expect(onHoverIn).toHaveBeenCalledTimes(1)
    expect(onPressIn).toHaveBeenCalledTimes(1)
  })
})
