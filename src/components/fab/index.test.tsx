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
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native'
import { createRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { FabSize, FabTone, FabVariant } from '.'

import { Fab } from '.'
import { PlusGlyph } from '../../glyphs'
import { useIconStyle } from '../../glyphs/icon-style'
import { RouterProvider } from '../../router'
import { ThemeScope } from '../../theme-scope'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'
import { Dialog } from '../dialog'
import { Popover } from '../popover'

const { theme } = scopeFor('light', {})
const { colors, radii, shadows, sizing, spacing, stateLayerOpacity } = theme
const { typography } = theme

const CALL_SITE = { marginTop: 4 }

// A press with no point on the page, on a control that measures nothing, so
// the ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// Each size's edge, corner and icon.
const SIZES: readonly (readonly [FabSize, number, number, number])[] = [
  ['md', sizing.controlLg, radii.lg, 24],
  ['lg', 80, 20, 28],
  ['xl', sizing.controlXl, radii.xl, 36],
]

// Each size's extended form: its height, padding, gap and type role.
const EXTENDED: readonly (readonly [
  FabSize,
  number,
  number,
  number,
  'headlineSmall' | 'titleLarge' | 'titleMedium',
])[] = [
  ['md', sizing.controlLg, spacing.lg, spacing.sm, 'titleMedium'],
  ['lg', 80, 26, spacing.md, 'titleLarge'],
  ['xl', sizing.controlXl, 28, spacing.lg, 'headlineSmall'],
]

// Each pair: its container and its content.
const PAIRS: readonly (readonly [FabVariant, FabTone, string, string])[] = [
  ['tonal', 'primary', colors.primaryContainer, colors.onPrimaryContainer],
  [
    'tonal',
    'secondary',
    colors.secondaryContainer,
    colors.onSecondaryContainer,
  ],
  ['tonal', 'tertiary', colors.tertiaryContainer, colors.onTertiaryContainer],
  ['filled', 'primary', colors.primary, colors.onPrimary],
  ['filled', 'secondary', colors.secondary, colors.onSecondary],
  ['filled', 'tertiary', colors.tertiary, colors.onTertiary],
]

function childOf(
  element: ReturnType<typeof fab>,
  message: string,
): ReturnType<typeof fab> {
  const child = element.children.at(0)
  if (child === undefined || typeof child === 'string') {
    throw new TypeError(message)
  }
  return child
}

// The view the feedback clips to the corner, and the state layer inside it.
function clip() {
  return childOf(fab(), 'expected the feedback to sit in a view')
}

function fab() {
  return screen.getByTestId('fab')
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
  return childOf(
    childOf(clip(), 'expected the feedback to draw a surface'),
    'expected a state layer',
  )
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
  jest.useRealTimers()
})

describe('Fab', () => {
  describe('structure', () => {
    it('is a button named by its aria-label', async () => {
      await render(<Fab aria-label="Label">{ICON}</Fab>)

      expect(screen.getByRole('button', { name: 'Label' })).toBeTruthy()
    })

    it('takes its name from the label in the extended form', async () => {
      await render(
        <Fab label="Label">
          <PlusGlyph />
        </Fab>,
      )

      expect(screen.getByRole('button', { name: 'Label' })).toBeTruthy()
    })

    it('requires an aria-label without a label', async () => {
      // @ts-expect-error An icon alone gives the FAB no name.
      await render(<Fab testID="fab">{ICON}</Fab>)

      expect(fab().props['aria-label']).toBeUndefined()
    })

    it('takes no pending state', async () => {
      await render(
        // @ts-expect-error The pages give the FAB no pending state.
        <Fab aria-label="Label" isPending testID="fab">
          {ICON}
        </Fab>,
      )

      expect(screen.queryByRole('progressbar')).toBeNull()
    })

    it('calls onPress when pressed', async () => {
      const onPress = jest.fn()
      await render(
        <Fab aria-label="Label" onPress={onPress}>
          {ICON}
        </Fab>,
      )

      await fireEvent.press(screen.getByRole('button', { name: 'Label' }))

      expect(onPress).toHaveBeenCalledTimes(1)
    })

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
          <Fab aria-label="Label" href="/next" onPress={onPress}>
            {ICON}
          </Fab>
        </RouterProvider>,
      )

      await fireEvent.press(screen.getByRole('link', { name: 'Label' }))

      expect(calls).toEqual(['press', '/next'])
    })

    it('closes the dialog it is in given the close slot', async () => {
      const user = userEvent.setup({
        advanceTimers: (delay) => {
          jest.advanceTimersByTime(delay)
        },
      })
      const onOpenChange = jest.fn()
      await render(
        <Dialog defaultOpen onOpenChange={onOpenChange}>
          <Fab aria-label="Open">{ICON}</Fab>
          <Dialog.Content aria-label="Panel">
            <Fab aria-label="Close" slot="close">
              {ICON}
            </Fab>
          </Dialog.Content>
        </Dialog>,
      )

      await user.press(screen.getByRole('button', { name: 'Close' }))

      expect(onOpenChange).toHaveBeenLastCalledWith(false)
    })

    it('opens the popover it is the trigger of', async () => {
      await render(
        <ThemeScope>
          <Popover>
            <Fab aria-label="Open" testID="fab">
              {ICON}
            </Fab>
            <Popover.Content aria-label="Panel">
              <Text>Panel</Text>
            </Popover.Content>
          </Popover>
        </ThemeScope>,
      )
      expect(fab()).toBeCollapsed()

      await fireEvent.press(fab())

      expect(fab()).toBeExpanded()
    })

    it('puts the style, ref and testID on the pressable', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        <Fab aria-label="Label" ref={ref} style={CALL_SITE} testID="fab">
          {ICON}
        </Fab>,
      )

      expect(styleOf(fab())).toMatchObject(CALL_SITE)
      expect(ref.current).not.toBeNull()
    })
  })

  describe('sizes', () => {
    it.each(SIZES)(
      'draws %s as a square of its edge, at its corner, with its icon',
      async (size, edge, corner, icon) => {
        await render(
          <Fab aria-label="Label" size={size} testID="fab">
            {ICON}
          </Fab>,
        )

        expect(styleOf(fab())).toMatchObject({
          borderRadius: corner,
          height: edge,
          width: edge,
        })
        expect(screen.getByTestId('icon')).toHaveTextContent(
          `${colors.onPrimaryContainer} ${String(icon)}`,
        )
      },
    )

    it.each(EXTENDED)(
      'draws an extended %s at its height, padding, gap and type role',
      async (size, height, padding, gap, role) => {
        await render(
          <Fab label="Label" size={size} testID="fab">
            {ICON}
          </Fab>,
        )

        expect(styleOf(fab())).toMatchObject({
          columnGap: gap,
          minHeight: height,
          paddingHorizontal: padding,
        })
        expect(styleOf(fab())).not.toHaveProperty('width')
        expect(styleOf(label())).toMatchObject({
          color: colors.onPrimaryContainer,
          fontSize: typography[`${role}Size`],
          letterSpacing: typography[`${role}Tracking`],
          lineHeight: typography[`${role}LineHeight`],
        })
      },
    )

    it.each(SIZES)(
      'keeps the corner of %s in the extended form',
      async (size, _edge, corner) => {
        await render(
          <Fab label="Label" size={size} testID="fab">
            {ICON}
          </Fab>,
        )

        expect(styleOf(fab()).borderRadius).toBe(corner)
      },
    )

    it('draws md by default', async () => {
      await render(
        <Fab aria-label="Label" testID="fab">
          {ICON}
        </Fab>,
      )

      expect(styleOf(fab())).toMatchObject({
        height: sizing.controlLg,
        width: sizing.controlLg,
      })
    })

    it('draws a label alone when given no icon', async () => {
      await render(<Fab label="Label" testID="fab" />)

      expect(label()).toBeTruthy()
      expect(screen.queryByTestId('icon')).toBeNull()
    })

    it('clips the press feedback to the same corner', async () => {
      await render(
        <Fab aria-label="Label" size="lg" testID="fab">
          {ICON}
        </Fab>,
      )

      expect(styleOf(clip())).toMatchObject({
        borderRadius: 20,
        overflow: 'hidden',
      })
    })

    it('keeps its corner while pressed', async () => {
      await render(
        <Fab aria-label="Label" testID="fab">
          {ICON}
        </Fab>,
      )

      await fireEvent(fab(), 'pressIn', PRESS)

      expect(styleOf(fab()).borderRadius).toBe(radii.lg)
    })
  })

  describe('colour', () => {
    it.each(PAIRS)(
      'draws %s %s on its pair',
      async (variant, tone, container, content) => {
        await render(
          <Fab aria-label="Label" testID="fab" tone={tone} variant={variant}>
            {ICON}
          </Fab>,
        )

        expect(styleOf(fab()).backgroundColor).toBe(container)
        expect(screen.getByTestId('icon')).toHaveTextContent(`${content} 24`)
      },
    )

    it('rests on primary container by default', async () => {
      await render(
        <Fab aria-label="Label" testID="fab">
          {ICON}
        </Fab>,
      )

      expect(styleOf(fab()).backgroundColor).toBe(colors.primaryContainer)
    })

    it('draws its layer in the content colour', async () => {
      await render(
        <Fab aria-label="Label" testID="fab" tone="tertiary" variant="filled">
          {ICON}
        </Fab>,
      )

      await fireEvent(fab(), 'hoverIn', {})

      expect(styleOf(layer())).toMatchObject({
        backgroundColor: colors.onTertiary,
        opacity: stateLayerOpacity.hover,
      })
    })

    it('reads its colours from the scheme around it', async () => {
      await render(
        <ThemeScope theme={RED_CONTAINER}>
          <Fab aria-label="Label" testID="fab">
            {ICON}
          </Fab>
        </ThemeScope>,
      )

      expect(styleOf(fab()).backgroundColor).toBe('#ff0000')
    })
  })

  describe('elevation and layers', () => {
    it('rests on the level 3 shadow and lifts to level 4 under a pointer', async () => {
      await render(
        <Fab aria-label="Label" testID="fab">
          {ICON}
        </Fab>,
      )
      expect(styleOf(fab()).boxShadow).toBe(shadows.elevation3)

      await fireEvent(fab(), 'hoverIn', {})
      expect(styleOf(fab()).boxShadow).toBe(shadows.elevation4)

      await fireEvent(fab(), 'pressIn', PRESS)
      expect(styleOf(fab()).boxShadow).toBe(shadows.elevation3)

      await fireEvent(fab(), 'pressOut', PRESS)
      await fireEvent(fab(), 'hoverOut', {})
      expect(styleOf(fab()).boxShadow).toBe(shadows.elevation3)
    })

    it('shows the focus ring when focus arrives from a key', async () => {
      await render(
        <Fab aria-label="Label" testID="fab">
          {ICON}
        </Fab>,
      )

      await fireEvent(fab(), 'focus', {})

      expect(styleOf(fab())).toMatchObject({
        outlineColor: colors.primary,
        outlineWidth: 2,
      })
      expect(styleOf(layer()).opacity).toBe(stateLayerOpacity.focus)
    })

    it('draws the disabled container, with no shadow and no press', async () => {
      const onPress = jest.fn()
      await render(
        <Fab
          aria-label="Label"
          isDisabled
          onPress={onPress}
          testID="fab"
          variant="filled"
        >
          {ICON}
        </Fab>,
      )

      await fireEvent(fab(), 'hoverIn', {})
      await fireEvent.press(fab())

      expect(styleOf(fab())).toMatchObject({
        backgroundColor: withOpacity(
          colors.onSurface,
          stateLayerOpacity.disabledContainer,
        ),
      })
      expect(styleOf(fab())).not.toHaveProperty('boxShadow')
      expect(screen.getByTestId('icon')).toHaveTextContent(
        `${withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)} 24`,
      )
      expect(styleOf(layer()).opacity).toBe(0)
      expect(onPress).not.toHaveBeenCalled()
      expect(
        screen.getByRole('button', { disabled: true, name: 'Label' }),
      ).toBeTruthy()
    })
  })
})

const RED_CONTAINER = { '--kui-color-primary-container': '#ff0000' }
