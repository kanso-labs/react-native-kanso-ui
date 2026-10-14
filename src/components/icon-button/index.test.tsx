import type { ComponentRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

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

import type { IconButtonSize, IconButtonVariant } from '.'

import { IconButton } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { RouterProvider } from '../../router'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

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
const { colors, motion, radii, sizing, stateLayerOpacity } = theme

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

// Each variant's container and icon at rest.
const VARIANTS: readonly (readonly [IconButtonVariant, Style, string])[] = [
  ['standard', {}, colors.onSurfaceVariant],
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
]

// Each variant's container once disabled.
const DISABLED: readonly (readonly [IconButtonVariant, Style])[] = [
  ['standard', {}],
  ['filled', { backgroundColor: DISABLED_CONTAINER }],
  ['tonal', { backgroundColor: DISABLED_CONTAINER }],
  ['outlined', { borderColor: DISABLED_CONTAINER }],
]

// Each toggle's container and icon, unselected and then selected.
const TOGGLES: readonly (readonly [
  IconButtonVariant,
  Style,
  string,
  Style,
  string,
])[] = [
  [
    'filled',
    { backgroundColor: colors.surfaceContainer },
    colors.onSurfaceVariant,
    { backgroundColor: colors.primary },
    colors.onPrimary,
  ],
  [
    'tonal',
    { backgroundColor: colors.secondaryContainer },
    colors.onSecondaryContainer,
    { backgroundColor: colors.secondary },
    colors.onSecondary,
  ],
  ['standard', {}, colors.onSurfaceVariant, {}, colors.primary],
  [
    'outlined',
    { borderColor: colors.outlineVariant },
    colors.onSurfaceVariant,
    {
      backgroundColor: colors.inverseSurface,
      borderColor: 'transparent',
      borderWidth: 1,
    },
    colors.inverseOnSurface,
  ],
]

// Each size's edge, icon, outlined rule and the corner it presses to.
const SIZES: readonly (readonly [
  IconButtonSize,
  number,
  number,
  number,
  number,
])[] = [
  ['xs', sizing.controlXs, 20, 1, radii.sm],
  ['md', sizing.controlSm, 24, 1, radii.sm],
  ['lg', sizing.controlLg, 24, 1, radii.md],
  ['xl', sizing.controlXl, 32, 2, radii.lg],
  ['xxl', sizing.controlXxl, 40, 3, radii.lg],
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

function icon() {
  return screen.getByTestId('icon')
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
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  mockDeviceLocale = 'en-US'
  jest.useRealTimers()
  jest.restoreAllMocks()
  jest.clearAllMocks()
})

describe('IconButton', () => {
  it('is a button named by its aria-label', async () => {
    await render(
      <IconButton aria-label="Label">
        <IconProbe />
      </IconButton>,
    )

    expect(screen.getByRole('button', { name: 'Label' })).toBeTruthy()
  })

  it('requires an aria-label, and names nothing itself', async () => {
    // @ts-expect-error An icon alone gives the control no name.
    await render(<IconButton testID="button" />)

    expect(button().props['aria-label']).toBeUndefined()
  })

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn()
    await render(
      <IconButton aria-label="Label" onPress={onPress}>
        <IconProbe />
      </IconButton>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Label' }))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('is disabled, and takes no press, given isDisabled', async () => {
    const onPress = jest.fn()
    await render(
      <IconButton aria-label="Label" isDisabled onPress={onPress}>
        <IconProbe />
      </IconButton>,
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
      <IconButton
        aria-label="Label"
        ref={ref}
        style={CALL_SITE}
        testID="button"
      >
        <IconProbe />
      </IconButton>,
    )

    expect(styleOf(button())).toMatchObject(CALL_SITE)
    // The pressable's own view, which Reanimated's wrapper hands the ref on
    // to, rather than the wrapper.
    expect(typeof ref.current?.measure).toBe('function')
  })
})

describe('the variants', () => {
  it.each(VARIANTS)(
    'draws %s on its container and icon colours',
    async (variant, container, content) => {
      await render(
        <IconButton aria-label="Label" testID="button" variant={variant}>
          <IconProbe />
        </IconButton>,
      )

      expect(styleOf(button())).toMatchObject(container)
      expect(icon()).toHaveTextContent(`${content} 24`)
    },
  )

  it('draws standard by default, with no container', async () => {
    await render(
      <IconButton aria-label="Label" testID="button">
        <IconProbe />
      </IconButton>,
    )

    expect(styleOf(button()).backgroundColor).toBeUndefined()
    expect(styleOf(button()).borderWidth).toBeUndefined()
    expect(icon()).toHaveTextContent(`${colors.onSurfaceVariant} 24`)
  })

  it.each(DISABLED)(
    'draws %s disabled in on-surface at the disabled opacities',
    async (variant, container) => {
      await render(
        <IconButton
          aria-label="Label"
          isDisabled
          testID="button"
          variant={variant}
        >
          <IconProbe />
        </IconButton>,
      )

      expect(styleOf(button())).toMatchObject(container)
      expect(icon()).toHaveTextContent(`${DISABLED_CONTENT} 24`)
    },
  )
})

describe('the sizes', () => {
  it.each(SIZES)(
    'draws %s as a square of its control height, with its icon',
    async (size, edge, iconSize) => {
      await render(
        <IconButton aria-label="Label" size={size} testID="button">
          <IconProbe />
        </IconButton>,
      )

      expect(styleOf(button())).toMatchObject({ height: edge, width: edge })
      expect(icon()).toHaveTextContent(
        `${colors.onSurfaceVariant} ${String(iconSize)}`,
      )
    },
  )

  it.each(SIZES)(
    'draws an outlined %s rule at its width',
    async (size, _edge, _icon, width) => {
      await render(
        <IconButton
          aria-label="Label"
          size={size}
          testID="button"
          variant="outlined"
        >
          <IconProbe />
        </IconButton>,
      )

      expect(styleOf(button())).toMatchObject({ borderWidth: width })
    },
  )

  it('draws md by default', async () => {
    await render(
      <IconButton aria-label="Label" testID="button">
        <IconProbe />
      </IconButton>,
    )

    expect(styleOf(button())).toMatchObject({
      height: sizing.controlSm,
      width: sizing.controlSm,
    })
  })

  it('brings xs and md up to a 48dp target both ways, and leaves lg as it is', async () => {
    await render(
      <>
        <IconButton aria-label="Extra small" size="xs" testID="xs">
          <IconProbe />
        </IconButton>
        <IconButton aria-label="Medium" size="md" testID="md">
          <IconProbe />
        </IconButton>
        <IconButton aria-label="Large" size="lg" testID="lg">
          <IconProbe />
        </IconButton>
      </>,
    )

    expect(screen.getByTestId('xs').props).toMatchObject({
      hitSlop: { bottom: 8, left: 8, right: 8, top: 8 },
    })
    expect(screen.getByTestId('md').props).toMatchObject({
      hitSlop: { bottom: 4, left: 4, right: 4, top: 4 },
    })
    expect(screen.getByTestId('lg').props.hitSlop).toBeUndefined()
  })

  it("takes the call site's own hitSlop over its own", async () => {
    await render(
      <IconButton aria-label="Label" hitSlop={12} size="xs" testID="button">
        <IconProbe />
      </IconButton>,
    )

    expect(button().props.hitSlop).toBe(12)
  })
})

describe('the shape', () => {
  it('rests as a circle', async () => {
    await render(
      <IconButton aria-label="Label" testID="button">
        <IconProbe />
      </IconButton>,
    )

    expect(cornerOf(button())).toBe(radii.pill)
  })

  it.each(SIZES)(
    'presses %s to its corner, and back to the circle',
    async (size, _edge, _icon, _width, pressed) => {
      await render(
        <IconButton aria-label="Label" size={size} testID="button">
          <IconProbe />
        </IconButton>,
      )

      await fireEvent(button(), 'pressIn', PRESS)
      await advance(motion.durationShort2 * 2)
      expect(cornerOf(button())).toBe(pressed)

      await fireEvent(button(), 'pressOut', {})
      await advance(motion.durationShort2 * 2)
      expect(cornerOf(button())).toBe(radii.pill)
    },
  )

  it('runs the circle from half its measured height', async () => {
    await render(
      <IconButton aria-label="Label" testID="button">
        <IconProbe />
      </IconButton>,
    )

    await fireEvent(button(), 'layout', {
      nativeEvent: { layout: { height: 40, width: 40, x: 0, y: 0 } },
    })
    await advance(motion.durationShort2 * 2)

    expect(cornerOf(button())).toBe(20)
  })

  it('clips the press feedback to the same corner', async () => {
    await render(
      <IconButton aria-label="Label" defaultSelected testID="button">
        <IconProbe />
      </IconButton>,
    )

    expect(cornerOf(clip())).toBe(radii.sm)
    expect(styleOf(clip())).toMatchObject({ overflow: 'hidden' })
  })
})

describe('the toggle', () => {
  it('reports its state, and changes it when pressed', async () => {
    const onChange = jest.fn()
    await render(
      <IconButton
        aria-label="Label"
        defaultSelected={false}
        onChange={onChange}
      >
        <IconProbe />
      </IconButton>,
    )

    const toggle = screen.getByRole('button', { name: 'Label' })
    expect(toggle).not.toBeSelected()

    await fireEvent.press(toggle)

    expect(toggle).toBeSelected()
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('is a toggle given onChange alone', async () => {
    const onChange = jest.fn()
    await render(
      <IconButton aria-label="Label" onChange={onChange}>
        <IconProbe />
      </IconButton>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Label' }))

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('follows isSelected when the call site holds the state', async () => {
    const onChange = jest.fn()
    await render(
      <IconButton aria-label="Label" isSelected onChange={onChange}>
        <IconProbe />
      </IconButton>,
    )

    const toggle = screen.getByRole('button', { name: 'Label' })
    await fireEvent.press(toggle)

    expect(onChange).toHaveBeenCalledWith(false)
    expect(toggle).toBeSelected()
  })

  it('reports no state when it is not a toggle', async () => {
    await render(
      <IconButton aria-label="Label" testID="button">
        <IconProbe />
      </IconButton>,
    )

    expect(button().props).not.toMatchObject({
      accessibilityState: { selected: expect.any(Boolean) },
    })
  })

  it.each(TOGGLES)(
    'draws a %s toggle on its own pair of colours',
    async (variant, unselected, unselectedIcon, selected, selectedIcon) => {
      await render(
        <IconButton
          aria-label="Label"
          defaultSelected={false}
          testID="button"
          variant={variant}
        >
          <IconProbe />
        </IconButton>,
      )

      expect(styleOf(button())).toMatchObject(unselected)
      expect(icon()).toHaveTextContent(`${unselectedIcon} 24`)

      await fireEvent.press(button())

      expect(styleOf(button())).toMatchObject(selected)
      expect(icon()).toHaveTextContent(`${selectedIcon} 24`)
    },
  )

  it.each(SIZES)(
    'rests a selected %s toggle at its pressed corner',
    async (size, _edge, _icon, _width, pressed) => {
      await render(
        <IconButton
          aria-label="Label"
          defaultSelected
          size={size}
          testID="button"
        >
          <IconProbe />
        </IconButton>,
      )

      expect(cornerOf(button())).toBe(pressed)
    },
  )

  it('keeps a selected toggle its corner while disabled', async () => {
    await render(
      <IconButton
        aria-label="Label"
        defaultSelected
        isDisabled
        testID="button"
        variant="filled"
      >
        <IconProbe />
      </IconButton>,
    )

    expect(cornerOf(button())).toBe(radii.sm)
    expect(styleOf(button())).toMatchObject({
      backgroundColor: DISABLED_CONTAINER,
    })
  })

  it('takes no href', async () => {
    await render(
      // @ts-expect-error A toggle is never a link.
      <IconButton aria-label="Label" defaultSelected href="/next">
        <IconProbe />
      </IconButton>,
    )

    expect(screen.getByRole('link', { name: 'Label' })).toBeTruthy()
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
        <IconButton aria-label="Label" href="/next" onPress={onPress}>
          <IconProbe />
        </IconButton>
      </RouterProvider>,
    )

    await fireEvent.press(screen.getByRole('link', { name: 'Label' }))

    expect(calls).toEqual(['press', '/next'])
  })
})

describe('the press feedback', () => {
  it('draws its layer in the icon colour', async () => {
    await render(
      <IconButton aria-label="Label" testID="button" variant="tonal">
        <IconProbe />
      </IconButton>,
    )

    await fireEvent(button(), 'hoverIn', {})

    expect(styleOf(layer())).toMatchObject({
      backgroundColor: colors.onSecondaryContainer,
      opacity: stateLayerOpacity.hover,
    })
  })

  it("draws a selected standard toggle's layer in primary", async () => {
    await render(
      <IconButton aria-label="Label" defaultSelected testID="button">
        <IconProbe />
      </IconButton>,
    )

    await fireEvent(button(), 'hoverIn', {})

    expect(styleOf(layer())).toMatchObject({ backgroundColor: colors.primary })
  })

  it('shows the focus ring when focus arrives from a key', async () => {
    await render(
      <IconButton aria-label="Label" testID="button">
        <IconProbe />
      </IconButton>,
    )

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
      <IconButton
        aria-label="Label"
        isPending
        onLongPress={onLongPress}
        onPress={onPress}
        testID="button"
      >
        {ICON}
      </IconButton>,
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
      <IconButton
        aria-label="Label"
        defaultSelected={false}
        isPending
        onChange={onChange}
        testID="button"
      >
        {ICON}
      </IconButton>,
    )

    await userEvent.setup().press(button())

    expect(onChange).not.toHaveBeenCalled()
    expect(button().props.accessibilityState).toMatchObject({ selected: false })
  })

  // Hidden in place rather than taken away, which keeps the icon's state.
  it('keeps its icon where it stands, undrawn and unread', async () => {
    await render(
      <IconButton aria-label="Label" isPending testID="button">
        {ICON}
      </IconButton>,
    )
    const hidden = screen.getByTestId('icon', { includeHiddenElements: true })

    expect(screen.queryByTestId('icon')).toBeNull()
    expect(hidden.parent && styleOf(hidden.parent).opacity).toBe(0)
    expect(screen.getByRole('button', { name: 'Label' })).toBe(button())
  })

  it('draws its icon again once it clears', async () => {
    const { rerender } = await render(
      <IconButton aria-label="Label" isPending>
        {ICON}
      </IconButton>,
    )

    await rerender(<IconButton aria-label="Label">{ICON}</IconButton>)

    expect(icon()).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('names its ring with pendingLabel', async () => {
    await render(
      <IconButton aria-label="Label" isPending pendingLabel="Pending label">
        {ICON}
      </IconButton>,
    )

    expect(ring('Pending label')).toBeTruthy()
  })

  it.each([
    ['en-US', 'Loading'],
    ['de-DE', 'Wird geladen'],
  ])('names its ring in the device’s locale, %s', async (locale, name) => {
    mockDeviceLocale = locale
    await render(
      <IconButton aria-label="Label" isPending>
        {ICON}
      </IconButton>,
    )

    expect(ring(name)).toBeTruthy()
  })

  it('reports itself busy, as a button still', async () => {
    await render(
      <IconButton aria-label="Label" isPending testID="button">
        {ICON}
      </IconButton>,
    )

    expect(button().props.accessibilityState).toMatchObject({
      busy: true,
      disabled: false,
    })
    expect(screen.getByRole('button', { busy: true })).toBe(button())
  })

  it.each(VARIANTS)(
    'draws its ring in the icon colour under %s',
    async (variant, _container, content) => {
      await render(
        <IconButton aria-label="Label" isPending variant={variant}>
          {ICON}
        </IconButton>,
      )

      expect(ringDrawing().strokes).toEqual([content])
    },
  )

  it.each(SIZES)(
    'draws its ring at the icon’s size at %s',
    async (size, _edge, iconSize) => {
      await render(
        <IconButton aria-label="Label" isPending size={size}>
          {ICON}
        </IconButton>,
      )

      expect(ringDrawing().size).toEqual([iconSize, iconSize])
    },
  )

  it('keeps its focus ring, and draws no hover or press', async () => {
    await render(
      <IconButton aria-label="Label" isPending testID="button">
        {ICON}
      </IconButton>,
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

  it.each(['ios', 'android'] as const)('says the change on %s', async (os) => {
    jest.replaceProperty(Platform, 'OS', os)
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const { rerender } = await render(
      <IconButton aria-label="Label">{ICON}</IconButton>,
    )

    await rerender(
      <IconButton aria-label="Label" isPending>
        {ICON}
      </IconButton>,
    )

    expect(announce.mock.calls).toEqual([['Loading']])
  })

  it('takes no isPending on a link', async () => {
    await render(
      // @ts-expect-error A link is never pending.
      <IconButton aria-label="Label" href="/next" isPending>
        {ICON}
      </IconButton>,
    )

    expect(screen.getByRole('link', { name: 'Label' })).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})
