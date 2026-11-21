import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { TestInstance } from 'test-renderer'

import { describe, expect, it, jest } from '@jest/globals'
import { checkPath } from '@kanso-labs/kanso-ui-core/glyphs'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet, View } from 'react-native'

import type { EmptyStateProps } from '.'

import { EmptyState } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const { colors, radii, sizing, spacing, typography } = theme

// An icon of the app's own, which writes out the colour and size its slot
// hands it.
function Probe() {
  const { color, size } = useIconStyle()

  return <View style={probeStyle(color, size)} testID="icon" />
}

function probeStyle(color: unknown, size: number): ViewStyle {
  return { borderColor: String(color), height: size }
}

const ICON = <Probe />

const ACTION = { label: 'Label', onPress: () => {} }

function child(node: TestInstance['children'][number] | undefined) {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

// The mark around the icon probe.
function mark() {
  return child(screen.getByTestId('icon').parent ?? undefined)
}

function paths(node: TestInstance): unknown[] {
  return [
    ...(node.type === 'RNSVGPath' ? [node.props.d as unknown] : []),
    ...node.children.flatMap((item) =>
      typeof item === 'string' ? [] : paths(item),
    ),
  ]
}

function probe() {
  return styleOf(screen.getByTestId('icon'))
}

async function renderState(props: Partial<EmptyStateProps> = {}) {
  return render(
    <EmptyState
      action={ACTION}
      description="Supporting line"
      icon={ICON}
      testID="state"
      title="Headline"
      {...props}
    />,
  )
}

function root() {
  return screen.getByTestId('state')
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle & ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

describe('EmptyState', () => {
  describe('first', () => {
    it('starts 40dp under what is above, centred across', async () => {
      await renderState()

      expect(styleOf(root())).toMatchObject({
        alignItems: 'center',
        paddingTop: spacing.xxxl,
      })
      expect(styleOf(root()).justifyContent).toBeUndefined()
      expect(styleOf(root()).flexGrow).toBeUndefined()
    })

    it('draws a 64dp round mark on primary container, its glyph at 32dp', async () => {
      await renderState()

      expect(styleOf(mark())).toMatchObject({
        backgroundColor: colors.primaryContainer,
        borderRadius: radii.pill,
        height: 64,
        marginBottom: spacing.lg,
        width: 64,
      })
      expect(probe()).toMatchObject({
        borderColor: colors.onPrimaryContainer,
        height: 32,
      })
    })

    it('sets the title in title large as a heading', async () => {
      await renderState()

      const title = screen.getByRole('heading', { name: 'Headline' })

      expect(styleOf(title)).toMatchObject({
        fontSize: typography.titleLargeSize,
        textAlign: 'center',
      })
    })

    it('sets the line in body medium on on-surface-variant, at most 280dp wide, 8dp under the title', async () => {
      await renderState()

      expect(styleOf(screen.getByText('Supporting line'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.bodyMediumSize,
        marginTop: spacing.sm,
        maxWidth: 280,
        textAlign: 'center',
      })
    })

    it('draws one filled button, 24dp under the line, that runs the action', async () => {
      const onPress = jest.fn()
      await renderState({ action: { label: 'Label', onPress } })

      const button = screen.getByRole('button', { name: 'Label' })
      const holder = child(root().children.at(-1))

      expect(styleOf(holder).marginTop).toBe(spacing.xl)
      expect(styleOf(button).backgroundColor).toBe(colors.primary)

      await fireEvent.press(button)

      expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('makes its button a link where the action has an href', async () => {
      await renderState({ action: { href: '/first', label: 'Label' } })

      expect(screen.getByRole('link', { name: 'Label' })).toBeTruthy()
    })

    it('draws only the parts it is given', async () => {
      await render(<EmptyState description="Supporting line" testID="state" />)

      expect(screen.queryByRole('heading')).toBeNull()
      expect(screen.queryByRole('button')).toBeNull()
      expect(root().children).toHaveLength(1)
      expect(styleOf(screen.getByText('Supporting line')).marginTop).toBe(
        undefined,
      )
    })
  })

  describe('inline', () => {
    it("draws a 40dp mark with a 20dp glyph and the line alone, in the list's 72dp row", async () => {
      await renderState({ size: 'inline' })

      expect(styleOf(root())).toMatchObject({
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.lg,
        minHeight: sizing.rowMd,
        paddingHorizontal: spacing.lg,
      })
      expect(styleOf(mark())).toMatchObject({
        backgroundColor: colors.primaryContainer,
        borderRadius: radii.pill,
        height: 40,
        width: 40,
      })
      expect(probe()).toMatchObject({
        borderColor: colors.onPrimaryContainer,
        height: 20,
      })
      expect(screen.queryByRole('heading')).toBeNull()
      expect(screen.queryByRole('button')).toBeNull()
      expect(screen.getByText('Supporting line')).toBeTruthy()
    })
  })

  describe('done', () => {
    it("draws a 24dp check in primary and the line, in the list's 56dp row", async () => {
      await renderState({ kind: 'done' })

      const [check, line] = root().children.map(child)

      expect(styleOf(root())).toMatchObject({
        flexDirection: 'row',
        minHeight: sizing.rowSm,
        paddingHorizontal: spacing.lg,
      })
      expect(paths(check)).toEqual([checkPath])
      expect(check.props.color).toBe(colors.primary)
      expect([check.props.width, check.props.height]).toEqual([24, 24])
      expect(line.props.children).toBe('Supporting line')
    })

    it('draws no title, no button and no mark of the app', async () => {
      await renderState({ kind: 'done' })

      expect(screen.queryByRole('heading')).toBeNull()
      expect(screen.queryByRole('button')).toBeNull()
      expect(screen.queryByTestId('icon')).toBeNull()
    })
  })

  describe('status', () => {
    it('draws the first layout with a neutral mark', async () => {
      await renderState({ kind: 'status' })

      expect(styleOf(root()).paddingTop).toBe(spacing.xxxl)
      expect(styleOf(mark()).backgroundColor).toBe(
        colors.surfaceContainerHighest,
      )
      expect(probe().borderColor).toBe(colors.onSurfaceVariant)
      expect(screen.getByRole('heading', { name: 'Headline' })).toBeTruthy()
    })

    it('draws an outlined button', async () => {
      await renderState({ kind: 'status' })

      const button = screen.getByRole('button', { name: 'Label' })

      expect(styleOf(button).backgroundColor).not.toBe(colors.primary)
      expect(styleOf(button).borderColor ?? styleOf(button).outlineColor).toBe(
        colors.outlineVariant,
      )
    })
  })
})
