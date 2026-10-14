import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native'
import { createRef } from 'react'
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { ButtonSize, ButtonVariant } from '.'

import { Button } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { RouterProvider } from '../../router'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

// What the next button the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

// The locale the device reports, which a pending ring's name is written in
// when the call site gives none.
let mockDeviceLocale = 'en-US'

jest.mock('../../number/locale', () => ({
  localeOf: (locale: string | undefined) => locale ?? mockDeviceLocale,
}))

// A path drawn as a plain element, so the stroke the ring hands it reads as
// written rather than as react-native-svg's processed colour. Reanimated
// moves the ring's arc through `setNativeProps`, which has nothing to do here.
jest.mock('react-native-svg', () => {
  const { Component, createElement } =
    jest.requireActual<typeof import('react')>('react')

  class Path extends Component {
    render() {
      return createElement('Path', this.props)
    }

    setNativeProps() {}
  }

  return {
    __esModule: true,
    ...jest.requireActual<object>('react-native-svg'),
    Path,
  }
})

const { theme } = scopeFor('light', {})
const { colors, motion, radii, shadows, sizing, spacing, stateLayerOpacity } =
  theme
const { typography } = theme

const DISABLED_CONTAINER = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContainer,
)
const DISABLED_CONTENT = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContent,
)

const CALL_SITE = { marginTop: 4 }

// A style as a case expects it, which `toMatchObject` takes as a record.
type Style = Readonly<Record<string, number | string>>

// A press with no point on the page, on a control that measures nothing, so
// the ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// Each variant's container and label at rest.
const VARIANTS: readonly (readonly [ButtonVariant, Style, string])[] = [
  ['filled', { backgroundColor: colors.primary }, colors.onPrimary],
  [
    'tonal',
    { backgroundColor: colors.secondaryContainer },
    colors.onSecondaryContainer,
  ],
  [
    'outlined',
    { borderColor: colors.outlineVariant, borderWidth: 1 },
    colors.onSurfaceVariant,
  ],
  ['text', {}, colors.primary],
  [
    'elevated',
    {
      backgroundColor: colors.surfaceContainerLow,
      boxShadow: shadows.elevation1,
    },
    colors.primary,
  ],
]

// Each variant's container and label once disabled.
const DISABLED: readonly (readonly [ButtonVariant, Style])[] = [
  ['filled', { backgroundColor: DISABLED_CONTAINER }],
  ['tonal', { backgroundColor: DISABLED_CONTAINER }],
  ['elevated', { backgroundColor: DISABLED_CONTAINER }],
  ['outlined', { borderColor: DISABLED_CONTAINER }],
  ['text', {}],
]

// Each size's height, padding, gap, type role, icon and outlined rule.
const SIZES: readonly (readonly [
  ButtonSize,
  Readonly<
    Record<
      'gap' | 'minHeight' | 'paddingHorizontal' | 'paddingVertical',
      number
    >
  >,
  'headlineLarge' | 'headlineSmall' | 'labelLarge' | 'titleMedium',
  number,
  number,
])[] = [
  [
    'xs',
    {
      gap: spacing.sm,
      minHeight: sizing.controlXs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    'labelLarge',
    20,
    1,
  ],
  [
    'md',
    {
      gap: spacing.sm,
      minHeight: sizing.controlSm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    'labelLarge',
    20,
    1,
  ],
  [
    'lg',
    {
      gap: spacing.sm,
      minHeight: sizing.controlLg,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    'titleMedium',
    24,
    1,
  ],
  [
    'xl',
    {
      gap: spacing.md,
      minHeight: sizing.controlXl,
      paddingHorizontal: 48,
      paddingVertical: spacing.xl,
    },
    'headlineSmall',
    32,
    2,
  ],
  [
    'xxl',
    {
      gap: spacing.lg,
      minHeight: sizing.controlXxl,
      paddingHorizontal: 64,
      paddingVertical: spacing.xxl,
    },
    'headlineLarge',
    40,
    3,
  ],
]

// Each toggle's container unselected and selected.
const TOGGLES: readonly (readonly [
  'elevated' | 'filled' | 'outlined' | 'tonal',
  string | undefined,
  string,
])[] = [
  ['filled', colors.surfaceContainer, colors.primary],
  ['tonal', colors.secondaryContainer, colors.secondary],
  ['elevated', colors.surfaceContainerLow, colors.primary],
  ['outlined', undefined, colors.inverseSurface],
]

// The corner each size rests at when square, and presses to.
const CORNERS: readonly (readonly [ButtonSize, number, number])[] = [
  ['xs', radii.md, radii.sm],
  ['md', radii.md, radii.sm],
  ['lg', radii.lg, radii.md],
  ['xl', radii.xl, radii.lg],
  ['xxl', radii.xl, radii.lg],
]

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

function button() {
  return screen.getByTestId('button')
}

// The view the feedback clips to the corner, and the state layer inside it.
function clip() {
  const view = button().children.at(0)
  if (view === undefined || typeof view === 'string') {
    throw new TypeError('expected the feedback to sit in a view')
  }
  return view
}

function cornerOf(element: Parameters<typeof getAnimatedStyle>[0]): unknown {
  const { borderRadius }: { borderRadius?: unknown } = getAnimatedStyle(element)

  return borderRadius
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

function layer() {
  const surface = clip().children.at(0)
  if (surface === undefined || typeof surface === 'string') {
    throw new TypeError('expected the feedback to draw a surface')
  }
  const view = surface.children.at(0)
  if (view === undefined || typeof view === 'string') {
    throw new TypeError('expected a state layer')
  }
  return view
}

// The ring a pending button draws, found as a screen reader finds it.
function ring(name = 'Loading') {
  return screen.getByRole('progressbar', { name })
}

// What the ring's svg is drawn at, and the colour of each of its arcs.
function ringDrawing() {
  const element = ring()
  const svg = element
    .queryAll((each) => each.type.startsWith('RNSVGSvgView'))
    .at(0)
  const strokes = element
    .queryAll((each) => each.type === 'Path')
    .map((path): unknown => path.props.stroke)

  return { size: [svg?.props.bbWidth, svg?.props.bbHeight], strokes }
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}) {
  return StyleSheet.flatten([element.props.style])
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  mockDeviceLocale = 'en-US'
  mockReducedMotion = false
  jest.useRealTimers()
  jest.restoreAllMocks()
  jest.clearAllMocks()
})

describe('Button', () => {
  it('is a button named by its label', async () => {
    await render(<Button>Label</Button>)

    expect(screen.getByRole('button', { name: 'Label' })).toBeTruthy()
  })

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn()
    await render(<Button onPress={onPress}>Label</Button>)

    await fireEvent.press(screen.getByRole('button', { name: 'Label' }))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('is disabled, and takes no press, given isDisabled', async () => {
    const onPress = jest.fn()
    await render(
      <Button isDisabled onPress={onPress}>
        Label
      </Button>,
    )

    const disabled = screen.getByRole('button', {
      disabled: true,
      name: 'Label',
    })
    await fireEvent.press(disabled)

    expect(onPress).not.toHaveBeenCalled()
  })

  it('puts the style, ref and testID on the pressable', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(
      <Button ref={ref} style={CALL_SITE} testID="button">
        Label
      </Button>,
    )

    expect(styleOf(button())).toMatchObject(CALL_SITE)
    // The pressable's own view, which Reanimated's wrapper hands the ref on
    // to, rather than the wrapper.
    expect(typeof ref.current?.measure).toBe('function')
  })
})

describe('the variants', () => {
  it.each(VARIANTS)(
    'draws %s on its container and label colours',
    async (variant, container, content) => {
      await render(
        <Button testID="button" variant={variant}>
          Label
        </Button>,
      )

      expect(styleOf(button())).toMatchObject(container)
      expect(styleOf(label())).toMatchObject({ color: content })
    },
  )

  it('draws filled by default', async () => {
    await render(<Button testID="button">Label</Button>)

    expect(styleOf(button())).toMatchObject({
      backgroundColor: colors.primary,
    })
  })

  it('draws no container under text and outlined', async () => {
    await render(
      <>
        <Button testID="button" variant="text">
          Label
        </Button>
        <Button testID="outlined" variant="outlined">
          Outlined
        </Button>
      </>,
    )

    expect(styleOf(button()).backgroundColor).toBeUndefined()
    expect(
      styleOf(screen.getByTestId('outlined')).backgroundColor,
    ).toBeUndefined()
  })

  it.each(DISABLED)(
    'draws %s disabled in on-surface at the disabled opacities',
    async (variant, container) => {
      await render(
        <Button isDisabled testID="button" variant={variant}>
          Label
        </Button>,
      )

      expect(styleOf(button())).toMatchObject(container)
      expect(styleOf(button()).boxShadow).toBeUndefined()
      expect(styleOf(label())).toMatchObject({ color: DISABLED_CONTENT })
    },
  )
})

describe('the shadow', () => {
  it('lifts elevated a level under a pointer, and settles it while pressed', async () => {
    await render(
      <Button testID="button" variant="elevated">
        Label
      </Button>,
    )

    await fireEvent(button(), 'hoverIn', {})
    expect(styleOf(button()).boxShadow).toBe(shadows.elevation2)

    await fireEvent(button(), 'pressIn', PRESS)
    expect(styleOf(button()).boxShadow).toBe(shadows.elevation1)
  })

  it.each(['filled', 'tonal'] as const)(
    'lifts %s off the page under a pointer only',
    async (variant) => {
      await render(
        <Button testID="button" variant={variant}>
          Label
        </Button>,
      )
      expect(styleOf(button()).boxShadow).toBeUndefined()

      await fireEvent(button(), 'hoverIn', {})
      expect(styleOf(button()).boxShadow).toBe(shadows.elevation1)

      await fireEvent(button(), 'pressIn', PRESS)
      expect(styleOf(button()).boxShadow).toBeUndefined()
    },
  )

  it.each(['outlined', 'text'] as const)(
    'draws none under %s',
    async (variant) => {
      await render(
        <Button testID="button" variant={variant}>
          Label
        </Button>,
      )

      await fireEvent(button(), 'hoverIn', {})
      expect(styleOf(button()).boxShadow).toBeUndefined()
    },
  )
})

describe('the sizes', () => {
  it.each(SIZES)(
    'draws %s at its height, padding and type role, with its icon',
    async (size, metrics, role, icon) => {
      await render(
        <Button icon={ICON} size={size} testID="button">
          Label
        </Button>,
      )

      expect(styleOf(button())).toMatchObject(metrics)
      expect(styleOf(label())).toMatchObject({
        fontSize: typography[`${role}Size`],
        letterSpacing: typography[`${role}Tracking`],
        lineHeight: typography[`${role}LineHeight`],
      })
      expect(screen.getByTestId('icon')).toHaveTextContent(
        `${colors.onPrimary} ${String(icon)}`,
      )
    },
  )

  it.each(SIZES)(
    'draws an outlined %s rule inside the padding',
    async (size, metrics, _role, _icon, width) => {
      await render(
        <Button size={size} testID="button" variant="outlined">
          Label
        </Button>,
      )

      expect(styleOf(button())).toMatchObject({
        borderWidth: width,
        paddingHorizontal: metrics.paddingHorizontal - width,
      })
    },
  )

  it('draws md by default', async () => {
    await render(<Button testID="button">Label</Button>)

    expect(styleOf(button())).toMatchObject({ minHeight: sizing.controlSm })
  })

  it('brings xs and md up to a 48dp target, and leaves lg as it is', async () => {
    await render(
      <>
        <Button size="xs" testID="xs">
          Label
        </Button>
        <Button size="md" testID="md">
          Label
        </Button>
        <Button size="lg" testID="lg">
          Label
        </Button>
      </>,
    )

    expect(screen.getByTestId('xs').props).toMatchObject({
      hitSlop: { bottom: 8, left: 0, right: 0, top: 8 },
    })
    expect(screen.getByTestId('md').props).toMatchObject({
      hitSlop: { bottom: 4, left: 0, right: 0, top: 4 },
    })
    expect(screen.getByTestId('lg').props.hitSlop).toBeUndefined()
  })

  it("takes the call site's own hitSlop over its own", async () => {
    await render(
      <Button hitSlop={12} size="xs" testID="button">
        Label
      </Button>,
    )

    expect(button().props.hitSlop).toBe(12)
  })
})

describe('the shape', () => {
  it('rests as the pill', async () => {
    await render(<Button testID="button">Label</Button>)

    expect(cornerOf(button())).toBe(radii.pill)
  })

  it.each(CORNERS)(
    'rests %s square at its corner, and presses to a tighter one',
    async (size, square, pressed) => {
      await render(
        <Button shape="square" size={size} testID="button">
          Label
        </Button>,
      )
      expect(cornerOf(button())).toBe(square)

      await fireEvent(button(), 'pressIn', PRESS)
      await advance(motion.durationShort2 * 2)

      expect(cornerOf(button())).toBe(pressed)
    },
  )

  it('presses the pill to the same corner', async () => {
    await render(<Button testID="button">Label</Button>)

    await fireEvent(button(), 'pressIn', PRESS)
    await advance(motion.durationShort2 * 2)
    expect(cornerOf(button())).toBe(radii.sm)

    await fireEvent(button(), 'pressOut', {})
    await advance(motion.durationShort2 * 2)
    expect(cornerOf(button())).toBe(radii.pill)
  })

  it('runs the pill from half its measured height', async () => {
    await render(<Button testID="button">Label</Button>)

    await fireEvent(button(), 'layout', {
      nativeEvent: { layout: { height: 40, width: 120, x: 0, y: 0 } },
    })
    await advance(motion.durationShort2 * 2)

    expect(cornerOf(button())).toBe(20)
  })

  it('eases the corner over the short duration', async () => {
    await render(
      <Button shape="square" testID="button">
        Label
      </Button>,
    )

    await fireEvent(button(), 'pressIn', PRESS)
    await advance(motion.durationShort2 / 2)
    const midway = cornerOf(button())

    expect(typeof midway).toBe('number')
    expect(midway).toBeGreaterThan(radii.sm)
    expect(midway).toBeLessThan(radii.md)
  })

  it('moves the corner at once under reduced motion', async () => {
    mockReducedMotion = true
    await render(
      <Button shape="square" testID="button">
        Label
      </Button>,
    )

    await fireEvent(button(), 'pressIn', PRESS)
    await advance(20)

    expect(cornerOf(button())).toBe(radii.sm)
  })

  it('clips the press feedback to the same corner', async () => {
    await render(
      <Button shape="square" testID="button">
        Label
      </Button>,
    )

    expect(cornerOf(clip())).toBe(radii.md)
    expect(styleOf(clip())).toMatchObject({ overflow: 'hidden' })
  })
})

describe('the toggle', () => {
  it('reports its state, and changes it when pressed', async () => {
    const onChange = jest.fn()
    await render(
      <Button defaultSelected={false} onChange={onChange}>
        Label
      </Button>,
    )

    const toggle = screen.getByRole('button', { name: 'Label' })
    expect(toggle).not.toBeSelected()

    await fireEvent.press(toggle)

    expect(toggle).toBeSelected()
    expect(onChange).toHaveBeenCalledWith(true)
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
      <Button onChange={onChange} onPress={onPress}>
        Label
      </Button>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Label' }))

    expect(calls).toEqual(['press', 'change'])
  })

  it('follows isSelected when the call site holds the state', async () => {
    const onChange = jest.fn()
    await render(
      <Button isSelected onChange={onChange}>
        Label
      </Button>,
    )

    const toggle = screen.getByRole('button', { name: 'Label' })
    await fireEvent.press(toggle)

    expect(onChange).toHaveBeenCalledWith(false)
    expect(toggle).toBeSelected()
  })

  it.each(TOGGLES)(
    'draws a %s toggle on its own pair of containers',
    async (variant, unselected, selected) => {
      await render(
        <>
          <Button defaultSelected={false} testID="button" variant={variant}>
            Label
          </Button>
          <Button defaultSelected testID="selected" variant={variant}>
            Selected
          </Button>
        </>,
      )

      expect(styleOf(button()).backgroundColor).toBe(unselected)
      expect(styleOf(screen.getByTestId('selected')).backgroundColor).toBe(
        selected,
      )
    },
  )

  it('keeps a selected outlined toggle its width, with the rule drawn transparent', async () => {
    await render(
      <Button defaultSelected testID="button" variant="outlined">
        Label
      </Button>,
    )

    expect(styleOf(button())).toMatchObject({
      borderColor: 'transparent',
      borderWidth: 1,
    })
    expect(styleOf(label())).toMatchObject({ color: colors.inverseOnSurface })
  })

  it('trades its shape for the other once selected', async () => {
    await render(
      <>
        <Button defaultSelected testID="button">
          Label
        </Button>
        <Button defaultSelected shape="square" testID="square">
          Square
        </Button>
      </>,
    )

    expect(cornerOf(button())).toBe(radii.md)
    expect(cornerOf(screen.getByTestId('square'))).toBe(radii.pill)
  })

  it('stays a plain button under text', async () => {
    const onChange = jest.fn()
    await render(
      // @ts-expect-error A text button takes no selected colours.
      <Button defaultSelected onChange={onChange} variant="text">
        Label
      </Button>,
    )

    const plain = screen.getByRole('button', { name: 'Label' })
    await fireEvent.press(plain)

    expect(plain).not.toBeSelected()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('the link', () => {
  it('is a link, and presses through the router after onPress', async () => {
    const calls: string[] = []
    const navigate = jest.fn((href: string) => {
      calls.push(href)
    })
    const onPress = jest.fn(() => {
      calls.push('press')
    })
    await render(
      <RouterProvider navigate={navigate}>
        <Button href="/next" onPress={onPress}>
          Label
        </Button>
      </RouterProvider>,
    )

    await fireEvent.press(screen.getByRole('link', { name: 'Label' }))

    expect(calls).toEqual(['press', '/next'])
  })
})

describe('the press feedback', () => {
  it('draws its layer in the label colour', async () => {
    await render(
      <Button testID="button" variant="tonal">
        Label
      </Button>,
    )

    await fireEvent(button(), 'hoverIn', {})

    expect(styleOf(layer())).toMatchObject({
      backgroundColor: colors.onSecondaryContainer,
      opacity: stateLayerOpacity.hover,
    })
  })

  it('shows the focus ring when focus arrives from a key', async () => {
    await render(<Button testID="button">Label</Button>)

    await fireEvent(button(), 'focus', {})

    expect(styleOf(button())).toMatchObject({
      outlineColor: colors.primary,
      outlineWidth: 2,
    })
  })
})

describe('the pending state', () => {
  it('takes no press while pending', async () => {
    const onLongPress = jest.fn()
    const onPress = jest.fn()
    await render(
      <Button
        isPending
        onLongPress={onLongPress}
        onPress={onPress}
        testID="button"
      >
        Label
      </Button>,
    )

    const user = userEvent.setup()

    await user.press(button())
    await user.longPress(button())

    expect(onPress).not.toHaveBeenCalled()
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('keeps a pending toggle as it was', async () => {
    const onChange = jest.fn()
    await render(
      <Button
        defaultSelected={false}
        isPending
        onChange={onChange}
        testID="button"
      >
        Label
      </Button>,
    )

    await userEvent.setup().press(button())

    expect(onChange).not.toHaveBeenCalled()
    expect(button().props.accessibilityState).toMatchObject({ selected: false })
  })

  it('takes presses again once it clears', async () => {
    const onPress = jest.fn()
    const { rerender } = await render(
      <Button isPending onPress={onPress} testID="button">
        Label
      </Button>,
    )

    await rerender(
      <Button onPress={onPress} testID="button">
        Label
      </Button>,
    )
    await userEvent.setup().press(button())

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  // Hidden in place rather than taken away, which is what keeps the button
  // its width.
  it('keeps its label and icon where they stand, undrawn and unread', async () => {
    await render(
      <Button icon={ICON} isPending>
        Label
      </Button>,
    )
    const hiddenLabel = screen.getByText('Label', {
      includeHiddenElements: true,
    })
    const icon = screen.getByTestId('icon', { includeHiddenElements: true })

    expect(screen.queryByText('Label')).toBeNull()
    expect(screen.queryByTestId('icon')).toBeNull()
    expect(styleOf(hiddenLabel).opacity).toBe(0)
    expect(icon.parent && styleOf(icon.parent).opacity).toBe(0)
  })

  it('draws its label and icon again once it clears', async () => {
    const { rerender } = await render(
      <Button icon={ICON} isPending>
        Label
      </Button>,
    )

    await rerender(<Button icon={ICON}>Label</Button>)

    expect(styleOf(label()).opacity).toBeUndefined()
    expect(screen.getByTestId('icon')).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('names its ring with pendingLabel', async () => {
    await render(
      <Button isPending pendingLabel="Pending label">
        Label
      </Button>,
    )

    expect(ring('Pending label')).toBeTruthy()
  })

  it.each([
    ['en-US', 'Loading'],
    ['de-DE', 'Wird geladen'],
  ])('names its ring in the device’s locale, %s', async (locale, name) => {
    mockDeviceLocale = locale
    await render(<Button isPending>Label</Button>)

    expect(ring(name)).toBeTruthy()
  })

  it('reports itself busy, as a button still', async () => {
    await render(
      <Button isPending testID="button">
        Label
      </Button>,
    )

    expect(button().props.accessibilityState).toMatchObject({
      busy: true,
      disabled: false,
    })
    expect(screen.getByRole('button', { busy: true })).toBe(button())
  })

  it.each(VARIANTS)(
    'draws its ring in the label colour under %s',
    async (variant, _container, content) => {
      await render(
        <Button isPending variant={variant}>
          Label
        </Button>,
      )

      expect(ringDrawing().strokes).toEqual([content])
    },
  )

  // The device's text size under the suite: React Native's Jest preset
  // reports a font scale of 2.
  it.each(SIZES)(
    'draws its ring at the label’s type size at %s',
    async (size, _metrics, role) => {
      await render(
        <Button isPending size={size}>
          Label
        </Button>,
      )

      expect(ringDrawing().size).toEqual([
        typography[`${role}Size`] * 2,
        typography[`${role}Size`] * 2,
      ])
    },
  )

  it('keeps its focus ring, and draws no hover or press', async () => {
    await render(
      <Button isPending testID="button">
        Label
      </Button>,
    )

    await fireEvent(button(), 'hoverIn', {})
    await fireEvent(button(), 'pressIn', PRESS)

    expect(styleOf(layer()).opacity).toBe(0)
    expect(cornerOf(button())).toBe(radii.pill)

    await fireEvent(button(), 'pressOut', PRESS)
    await fireEvent(button(), 'focus', {})

    expect(styleOf(button())).toMatchObject({
      outlineColor: colors.primary,
      outlineWidth: 2,
    })
    expect(styleOf(layer()).opacity).toBe(stateLayerOpacity.focus)
  })

  it('takes no hover shadow while pending', async () => {
    await render(
      <Button isPending testID="button" variant="elevated">
        Label
      </Button>,
    )

    await fireEvent(button(), 'hoverIn', {})

    expect(styleOf(button()).boxShadow).toBe(shadows.elevation1)
  })

  describe('the announcement', () => {
    it.each(['ios', 'android'] as const)(
      'says the change on %s',
      async (os) => {
        jest.replaceProperty(Platform, 'OS', os)
        const announce = jest.spyOn(
          AccessibilityInfo,
          'announceForAccessibility',
        )
        const { rerender } = await render(<Button>Label</Button>)

        await rerender(<Button isPending>Label</Button>)

        expect(announce.mock.calls).toEqual([['Loading']])
      },
    )

    it('says the ring’s own name', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
      const { rerender } = await render(<Button>Label</Button>)

      await rerender(
        <Button isPending pendingLabel="Pending label">
          Label
        </Button>,
      )

      expect(announce.mock.calls).toEqual([['Pending label']])
    })

    it('says nothing for a button pending as it mounts, or as it clears', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
      const { rerender } = await render(<Button isPending>Label</Button>)

      await rerender(<Button>Label</Button>)

      expect(announce).not.toHaveBeenCalled()
    })

    it('says nothing under React Native Web, which has no announcer', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
      const { rerender } = await render(<Button>Label</Button>)

      await rerender(<Button isPending>Label</Button>)

      expect(announce).not.toHaveBeenCalled()
    })
  })

  it('takes no isPending on a link', async () => {
    await render(
      // @ts-expect-error A link is never pending.
      <Button href="/next" isPending>
        Label
      </Button>,
    )

    expect(screen.getByRole('link', { name: 'Label' })).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})
