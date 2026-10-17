import type { ComponentRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import { afterEach, describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { Platform, StyleSheet, View } from 'react-native'

import type { IconStyle } from '../../glyphs/icon-style'

import { Toolbar } from '.'
import { PlusGlyph } from '../../glyphs'
import { useIconStyle } from '../../glyphs/icon-style'
import { ThemeScope } from '../../theme-scope'
import { scopeFor } from '../../theme/scope'
import { Dialog } from '../dialog'
import { IconButton } from '../icon-button'
import { Popover } from '../popover'
import { Separator } from '../separator'

const { theme } = scopeFor('light', {})
const { colors, radii, spacing } = theme

const CALL_SITE = { marginTop: 4 }

const OS = Platform.OS

afterEach(() => {
  Platform.OS = OS
})

// What a bare icon in the bar is handed, written where a case can read it.
const seen: IconStyle[] = []

// The bar, which is not an accessibility element itself, since that would
// hide its controls, so it is not one Testing Library finds by role.
function bar() {
  return screen.getByTestId('bar')
}

function Probe() {
  seen.push(useIconStyle())
  return null
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

// The svg a glyph draws, whose colour is the one it was handed.
function svgOf(testID: string) {
  return screen.getByTestId(testID, { includeHiddenElements: true })
}

describe('Toolbar', () => {
  afterEach(() => {
    seen.length = 0
  })

  it('passes style, ref and testID through to the bar', async () => {
    const ref = createRef<ComponentRef<typeof View>>()

    await render(
      <Toolbar aria-label="Label" ref={ref} style={CALL_SITE} testID="bar" />,
    )

    expect(styleOf(bar())).toMatchObject(CALL_SITE)
    expect(ref.current).not.toBeNull()
  })

  it('lets the call site square the corner', async () => {
    await render(<Toolbar aria-label="Label" style={SQUARE} testID="bar" />)

    expect(styleOf(bar()).borderRadius).toBe(0)
  })

  describe('semantics', () => {
    it('is a toolbar, named by its label', async () => {
      await render(<Toolbar aria-label="Label" testID="bar" />)

      expect(bar().props).toMatchObject({
        'aria-label': 'Label',
        role: 'toolbar',
      })
    })

    it('says which way a vertical bar runs on the web', async () => {
      Platform.OS = 'web'
      await render(
        <Toolbar aria-label="Label" orientation="vertical" testID="bar" />,
      )

      expect(bar().props['aria-orientation']).toBe('vertical')
    })

    it('says nothing of the orientation on iOS and Android', async () => {
      await render(
        <Toolbar aria-label="Label" orientation="vertical" testID="bar" />,
      )

      expect(bar().props).not.toHaveProperty('aria-orientation')
    })

    it('leaves a horizontal bar to the role’s own default on the web', async () => {
      Platform.OS = 'web'
      await render(<Toolbar aria-label="Label" testID="bar" />)

      expect(bar().props).not.toHaveProperty('aria-orientation')
    })
  })

  describe('layout', () => {
    it('lays a horizontal bar out as the page measures it', async () => {
      await render(<Toolbar aria-label="Label" testID="bar" />)

      expect(styleOf(bar())).toMatchObject({
        alignItems: 'center',
        alignSelf: 'flex-start',
        borderRadius: radii.pill,
        flexDirection: 'row',
        gap: spacing.sm,
        justifyContent: 'center',
        minHeight: 64,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
      })
      expect(styleOf(bar())).not.toHaveProperty('minWidth')
    })

    it('turns the measurements with a vertical bar', async () => {
      await render(
        <Toolbar aria-label="Label" orientation="vertical" testID="bar" />,
      )

      expect(styleOf(bar())).toMatchObject({
        flexDirection: 'column',
        gap: spacing.sm,
        minWidth: 64,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.lg,
      })
      expect(styleOf(bar())).not.toHaveProperty('minHeight')
    })
  })

  describe('tone', () => {
    it('draws the neutral bar on surface container', async () => {
      await render(
        <Toolbar aria-label="Label" testID="bar">
          <Probe />
        </Toolbar>,
      )

      expect(styleOf(bar()).backgroundColor).toBe(colors.surfaceContainer)
      expect(seen.at(-1)).toEqual({ color: colors.onSurfaceVariant, size: 24 })
    })

    it('draws the vibrant bar on primary container', async () => {
      await render(
        <Toolbar aria-label="Label" testID="bar" tone="vibrant">
          <Probe />
        </Toolbar>,
      )

      expect(styleOf(bar()).backgroundColor).toBe(colors.primaryContainer)
      expect(seen.at(-1)).toEqual({
        color: colors.onPrimaryContainer,
        size: 24,
      })
    })

    it('leaves a control its own colours', async () => {
      await render(
        <Toolbar aria-label="Label" tone="vibrant">
          <PlusGlyph testID="bare" />
          <IconButton aria-label="Add">
            <PlusGlyph testID="button" />
          </IconButton>
        </Toolbar>,
      )

      expect(svgOf('bare').props.color).toBe(colors.onPrimaryContainer)
      expect(svgOf('button').props.color).toBe(colors.onSurfaceVariant)
    })

    it('reads its colours from the scheme around it', async () => {
      await render(
        <ThemeScope theme={RED_CONTAINER}>
          <Toolbar aria-label="Label" testID="bar" />
        </ThemeScope>,
      )

      expect(styleOf(bar()).backgroundColor).toBe('#ff0000')
    })
  })

  describe('a separator', () => {
    it('runs across a horizontal bar', async () => {
      await render(
        <Toolbar aria-label="Label">
          <Separator testID="rule" />
        </Toolbar>,
      )

      expect(styleOf(screen.getByTestId('rule'))).toMatchObject({ width: 1 })
      expect(styleOf(screen.getByTestId('rule'))).not.toHaveProperty('height')
    })

    it('runs across a vertical bar', async () => {
      await render(
        <Toolbar aria-label="Label" orientation="vertical">
          <Separator testID="rule" />
        </Toolbar>,
      )

      expect(styleOf(screen.getByTestId('rule'))).toMatchObject({ height: 1 })
    })

    it('runs the way its call site says, when it says', async () => {
      await render(
        <Toolbar aria-label="Label">
          <Separator orientation="horizontal" testID="rule" />
        </Toolbar>,
      )

      expect(styleOf(screen.getByTestId('rule'))).toMatchObject({ height: 1 })
    })

    it('runs as it does anywhere in a dialog opened from the bar', async () => {
      await render(
        <Toolbar aria-label="Label">
          <Dialog.Content defaultOpen>
            <Separator testID="rule" />
          </Dialog.Content>
        </Toolbar>,
      )

      expect(styleOf(screen.getByTestId('rule'))).toMatchObject({ height: 1 })
    })

    it('runs as it does anywhere in a popover opened from the bar', async () => {
      await render(
        <ThemeScope>
          <Toolbar aria-label="Label">
            <Popover defaultOpen>
              <IconButton aria-label="Open">
                <PlusGlyph />
              </IconButton>
              <Popover.Content aria-label="Panel">
                <Separator testID="rule" />
              </Popover.Content>
            </Popover>
          </Toolbar>
        </ThemeScope>,
      )

      expect(styleOf(screen.getByTestId('rule'))).toMatchObject({ height: 1 })
    })
  })
})

const SQUARE = { borderRadius: 0 }

const RED_CONTAINER = { '--kui-color-surface-container': '#ff0000' }
