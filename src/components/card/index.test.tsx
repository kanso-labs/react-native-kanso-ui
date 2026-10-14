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
import { fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { CardVariant } from '.'

import { Card } from '.'
import { RouterProvider } from '../../router'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const { colors, radii, shadows, spacing, stateLayerOpacity } = theme

const CALL_SITE = { marginTop: 4 }

// A style as a case expects it, which `toMatchObject` takes as a record.
type Style = Readonly<Record<string, number | string>>

// A press with no point on the page, on a card that measures nothing, so the
// ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// Each variant's container at rest.
const VARIANTS: readonly (readonly [CardVariant, Style])[] = [
  [
    'elevated',
    {
      backgroundColor: colors.surfaceContainerLow,
      boxShadow: shadows.elevation1,
    },
  ],
  ['filled', { backgroundColor: colors.surfaceContainerHighest }],
  [
    'outlined',
    {
      backgroundColor: colors.surface,
      borderColor: colors.outlineVariant,
      borderWidth: 1,
    },
  ],
]

// Each variant's container once disabled.
const DISABLED: readonly (readonly [CardVariant, Style])[] = [
  [
    'elevated',
    {
      backgroundColor: withOpacity(
        colors.surfaceContainerLow,
        stateLayerOpacity.disabledContent,
      ),
    },
  ],
  [
    'filled',
    {
      backgroundColor: withOpacity(
        colors.surfaceContainerHighest,
        stateLayerOpacity.disabledContent,
      ),
    },
  ],
  [
    'outlined',
    {
      backgroundColor: colors.surface,
      borderColor: withOpacity(
        colors.outline,
        stateLayerOpacity.disabledContainer,
      ),
    },
  ],
]

function card() {
  return screen.getByTestId('card')
}

// What an interactive card's children sit in, its first child.
function content() {
  const view = card().children.at(0)
  if (view === undefined || typeof view === 'string') {
    throw new TypeError('expected the children to sit in a view')
  }
  return view
}

// The state layer, inside the surface that is an interactive card's last
// child, over what the card holds.
function layer() {
  const surface = card().children.at(-1)
  if (surface === undefined || typeof surface === 'string') {
    throw new TypeError('expected the feedback to draw a surface')
  }
  const view = surface.children.at(0)
  if (view === undefined || typeof view === 'string') {
    throw new TypeError('expected a state layer')
  }
  return view
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
  jest.useRealTimers()
})

describe('Card', () => {
  it('is a view with no role, holding its children', async () => {
    await render(
      <Card testID="card">
        <Text>Headline</Text>
      </Card>,
    )

    expect(card().props.role).toBeUndefined()
    expect(card().props.onPress).toBeUndefined()
    expect(screen.getByText('Headline')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('rounds its corner to the medium shape, and clips what it holds to it', async () => {
    await render(<Card testID="card" />)

    expect(styleOf(card())).toMatchObject({
      borderRadius: radii.md,
      overflow: 'hidden',
    })
  })

  it('pads its content 16dp in, and not at all given padding none', async () => {
    await render(<Card testID="card" />)
    expect(styleOf(card()).padding).toBe(spacing.lg)

    await render(<Card padding="none" testID="card" />)
    expect(styleOf(card()).padding).toBe(0)
  })

  it('puts the style, ref and testID on its view', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(<Card ref={ref} style={CALL_SITE} testID="card" />)

    expect(styleOf(card())).toMatchObject(CALL_SITE)
    expect(typeof ref.current?.measure).toBe('function')
  })

  it('takes no onPress unless it is interactive', async () => {
    const onPress = jest.fn()

    // @ts-expect-error A static card takes no press.
    await render(<Card onPress={onPress} testID="card" />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('fades nothing given isDisabled, since it takes no press to begin with', async () => {
    await render(<Card isDisabled testID="card" />)

    expect(styleOf(card())).toMatchObject({
      backgroundColor: colors.surfaceContainerLow,
      boxShadow: shadows.elevation1,
    })
  })
})

describe('the variants', () => {
  it.each(VARIANTS)('draws %s on its container', async (variant, container) => {
    await render(<Card testID="card" variant={variant} />)

    expect(styleOf(card())).toMatchObject(container)
  })

  it('draws elevated by default', async () => {
    await render(<Card testID="card" />)

    expect(styleOf(card())).toMatchObject({
      backgroundColor: colors.surfaceContainerLow,
      boxShadow: shadows.elevation1,
    })
  })

  it.each(['filled', 'outlined'] as const)(
    'casts no shadow under %s',
    async (variant) => {
      await render(<Card testID="card" variant={variant} />)

      expect(styleOf(card()).boxShadow).toBeUndefined()
    },
  )

  it.each(VARIANTS)(
    'draws %s on its container when interactive too',
    async (variant, container) => {
      await render(<Card interactive testID="card" variant={variant} />)

      expect(styleOf(card())).toMatchObject({
        ...container,
        borderRadius: radii.md,
        overflow: 'hidden',
        padding: spacing.lg,
      })
    },
  )
})

describe('the interactive card', () => {
  it('is a button, and calls onPress when pressed', async () => {
    const onPress = jest.fn()
    await render(
      <Card interactive onPress={onPress}>
        <Text>Headline</Text>
      </Card>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Headline' }))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('is a link given href, and presses through the router after onPress', async () => {
    const calls: string[] = []
    const navigate = jest.fn((href: string) => {
      calls.push(href)
    })
    const onPress = jest.fn(() => {
      calls.push('press')
    })
    await render(
      <RouterProvider navigate={navigate}>
        <Card href="/next" interactive onPress={onPress}>
          <Text>Headline</Text>
        </Card>
      </RouterProvider>,
    )

    await fireEvent.press(screen.getByRole('link', { name: 'Headline' }))

    expect(calls).toEqual(['press', '/next'])
  })

  it('holds its children in a view that fills it, under its padding', async () => {
    await render(
      <Card interactive testID="card">
        <Text>Headline</Text>
      </Card>,
    )

    expect(styleOf(content())).toMatchObject({ flexGrow: 1 })
    expect(screen.getByText('Headline')).toBeTruthy()
  })

  it('puts the style, ref and testID on its pressable', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(<Card interactive ref={ref} style={CALL_SITE} testID="card" />)

    expect(styleOf(card())).toMatchObject(CALL_SITE)
    expect(typeof ref.current?.measure).toBe('function')
  })

  it("calls the call site's own press and hover handlers", async () => {
    const onHoverIn = jest.fn()
    const onPressIn = jest.fn()
    await render(
      <Card
        interactive
        onHoverIn={onHoverIn}
        onPressIn={onPressIn}
        testID="card"
      />,
    )

    await fireEvent(card(), 'hoverIn', {})
    await fireEvent(card(), 'pressIn', PRESS)

    expect(onHoverIn).toHaveBeenCalledTimes(1)
    expect(onPressIn).toHaveBeenCalledTimes(1)
  })
})

describe('the shadow', () => {
  it('lifts elevated a level under a pointer, and settles it while pressed', async () => {
    await render(<Card interactive testID="card" />)
    expect(styleOf(card()).boxShadow).toBe(shadows.elevation1)

    await fireEvent(card(), 'hoverIn', {})
    expect(styleOf(card()).boxShadow).toBe(shadows.elevation2)

    await fireEvent(card(), 'pressIn', PRESS)
    expect(styleOf(card()).boxShadow).toBe(shadows.elevation1)

    await fireEvent(card(), 'pressOut', PRESS)
    await fireEvent(card(), 'hoverOut', {})
    expect(styleOf(card()).boxShadow).toBe(shadows.elevation1)
  })

  it.each(['filled', 'outlined'] as const)(
    'keeps %s flat under a pointer',
    async (variant) => {
      await render(<Card interactive testID="card" variant={variant} />)

      await fireEvent(card(), 'hoverIn', {})

      expect(styleOf(card()).boxShadow).toBeUndefined()
    },
  )
})

describe('the press feedback', () => {
  it('draws its layer in on-surface, over what the card holds', async () => {
    await render(
      <Card interactive testID="card" variant="filled">
        <Text>Headline</Text>
      </Card>,
    )

    await fireEvent(card(), 'hoverIn', {})

    expect(styleOf(layer())).toMatchObject({
      backgroundColor: colors.onSurface,
      opacity: stateLayerOpacity.hover,
    })
    expect(card().children).toHaveLength(2)
  })

  it('draws the pressed layer while pressed', async () => {
    await render(<Card interactive testID="card" />)

    await fireEvent(card(), 'pressIn', PRESS)

    expect(styleOf(layer()).opacity).toBe(stateLayerOpacity.pressed)
  })

  it('shows the focus ring when focus arrives from a key', async () => {
    await render(<Card interactive testID="card" />)

    await fireEvent(card(), 'focus', {})

    expect(styleOf(card())).toMatchObject({
      outlineColor: colors.primary,
      outlineWidth: 2,
    })
  })
})

describe('the disabled card', () => {
  it('is disabled, and takes no press', async () => {
    const onPress = jest.fn()
    await render(
      <Card interactive isDisabled onPress={onPress}>
        <Text>Headline</Text>
      </Card>,
    )

    const disabled = screen.getByRole('button', {
      disabled: true,
      name: 'Headline',
    })
    await fireEvent.press(disabled)

    expect(onPress).not.toHaveBeenCalled()
  })

  it.each(DISABLED)(
    'fades %s to the disabled container',
    async (variant, container) => {
      await render(
        <Card interactive isDisabled testID="card" variant={variant} />,
      )

      expect(styleOf(card())).toMatchObject(container)
    },
  )

  it('lays the elevated card flat, under a pointer too', async () => {
    await render(<Card interactive isDisabled testID="card" />)
    expect(styleOf(card()).boxShadow).toBeUndefined()

    await fireEvent(card(), 'hoverIn', {})
    expect(styleOf(card()).boxShadow).toBeUndefined()
  })

  it('fades what it holds to the disabled content opacity', async () => {
    await render(
      <Card interactive isDisabled testID="card">
        <Text>Headline</Text>
      </Card>,
    )

    expect(styleOf(content()).opacity).toBe(stateLayerOpacity.disabledContent)
  })

  it('fades nothing it holds while enabled', async () => {
    await render(
      <Card interactive testID="card">
        <Text>Headline</Text>
      </Card>,
    )

    expect(styleOf(content()).opacity).toBeUndefined()
  })

  it('takes down the layer of a card disabled under a pointer', async () => {
    const { rerender } = await render(<Card interactive testID="card" />)
    await fireEvent(card(), 'hoverIn', {})
    expect(styleOf(layer()).opacity).toBe(stateLayerOpacity.hover)

    await rerender(<Card interactive isDisabled testID="card" />)

    expect(styleOf(layer()).opacity).toBe(0)
  })

  it('draws no layer and no ring', async () => {
    await render(<Card interactive isDisabled testID="card" />)

    await fireEvent(card(), 'focus', {})

    expect(styleOf(layer()).opacity).toBe(0)
    expect(styleOf(card()).outlineWidth).toBeUndefined()
  })
})
