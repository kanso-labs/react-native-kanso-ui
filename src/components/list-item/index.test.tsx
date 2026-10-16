import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { TestInstance } from 'test-renderer'

import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { I18nManager, StyleSheet, Text, View } from 'react-native'

import { ListItem } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const { colors, sizing, spacing, stateLayerOpacity, typography } = theme

const FADED = withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)

// A press with no point on the page, on a row that measures nothing, so the
// ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// Hoisted so the slots are stable elements, which is what react-perf's
// no-jsx-as-prop is after.
const LEADING = <Text testID="leading">Lead</Text>
const TRAILING = <Text testID="trailing">Trail</Text>
const ICON = <Icon />
const CALL_SITE = { marginTop: 4 }

// What the slot hands an icon, written out where a case can read it.
function Icon() {
  const { color, size } = useIconStyle()

  return <Text testID="icon">{`${String(color)} ${String(size)}`}</Text>
}

// The row's own view: the parent of the view holding its headline.
function rowOf(headline: string): TestInstance {
  const row = screen.getByText(headline).parent?.parent

  if (row === null || row === undefined) {
    throw new TypeError('expected the headline inside a row')
  }
  return row
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

describe('ListItem', () => {
  describe('heights', () => {
    it('is the one-line item, 56dp, with a headline alone', async () => {
      await render(<ListItem testID="row">Headline</ListItem>)

      expect(styleOf(screen.getByTestId('row'))).toMatchObject({
        alignItems: 'center',
        gap: spacing.lg,
        minHeight: sizing.rowSm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
      })
    })

    it('is the two-line item, 72dp, with a supporting line', async () => {
      await render(
        <ListItem supporting="Supporting line" testID="row">
          Headline
        </ListItem>,
      )

      expect(styleOf(screen.getByTestId('row'))).toMatchObject({
        alignItems: 'center',
        minHeight: sizing.rowMd,
      })
    })

    it('is the two-line item with an overline in place of the supporting line', async () => {
      await render(
        <ListItem overline="Overline" testID="row">
          Headline
        </ListItem>,
      )

      expect(styleOf(screen.getByTestId('row')).minHeight).toBe(sizing.rowMd)
    })

    it('is the three-line item, 88dp, with its slots at the top, given both', async () => {
      await render(
        <ListItem overline="Overline" supporting="Supporting line" testID="row">
          Headline
        </ListItem>,
      )

      expect(styleOf(screen.getByTestId('row'))).toMatchObject({
        alignItems: 'flex-start',
        minHeight: sizing.rowLg,
      })
    })

    it('sets a minimum rather than a height, so larger text grows the row', async () => {
      await render(<ListItem testID="row">Headline</ListItem>)

      expect(styleOf(screen.getByTestId('row')).height).toBeUndefined()
    })
  })

  describe('lines', () => {
    it('draws the headline in body large on on-surface', async () => {
      await render(<ListItem>Headline</ListItem>)

      expect(textStyleOf(screen.getByText('Headline'))).toMatchObject({
        color: colors.onSurface,
        fontSize: typography.bodyLargeSize,
        lineHeight: typography.bodyLargeLineHeight,
      })
    })

    it('draws the supporting line in body medium and the overline in label small, both muted', async () => {
      await render(
        <ListItem overline="Overline" supporting="Supporting line">
          Headline
        </ListItem>,
      )

      expect(textStyleOf(screen.getByText('Supporting line'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.bodyMediumSize,
      })
      expect(textStyleOf(screen.getByText('Overline'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.labelSmallSize,
      })
    })

    it('draws the overline above the headline and the supporting line under it', async () => {
      await render(
        <ListItem overline="Overline" supporting="Supporting line">
          Headline
        </ListItem>,
      )

      const lines = screen.getByText('Headline').parent?.children ?? []

      expect(lines).toEqual([
        screen.getByText('Overline'),
        screen.getByText('Headline'),
        screen.getByText('Supporting line'),
      ])
    })

    it('fades every line once disabled', async () => {
      await render(
        <ListItem isDisabled overline="Overline" supporting="Supporting line">
          Headline
        </ListItem>,
      )

      for (const line of ['Overline', 'Headline', 'Supporting line']) {
        expect(textStyleOf(screen.getByText(line)).color).toBe(FADED)
      }
    })
  })

  describe('slots', () => {
    it('draws the leading slot before the lines and the trailing slot after them', async () => {
      await render(
        <ListItem leading={LEADING} trailing={TRAILING}>
          Headline
        </ListItem>,
      )

      const row = rowOf('Headline')
      const [first, , last] = row.children

      expect(row.children).toHaveLength(3)
      expect(first).toBe(screen.getByTestId('leading').parent)
      expect(last).toBe(screen.getByTestId('trailing').parent)
    })

    it('draws neither slot when neither is given', async () => {
      await render(<ListItem>Headline</ListItem>)

      expect(rowOf('Headline').children).toHaveLength(1)
    })

    it("hands an icon the row's colour at 24dp, faded once disabled", async () => {
      await render(<ListItem leading={ICON}>Headline</ListItem>)

      expect(screen.getByTestId('icon')).toHaveTextContent(
        `${colors.onSurface} 24`,
      )

      await render(
        <ListItem isDisabled leading={ICON}>
          Headline
        </ListItem>,
      )

      expect(screen.getByTestId('icon')).toHaveTextContent(`${FADED} 24`)
    })

    // React Native lays a row out from the start edge, which is the right
    // under right-to-left, so a row that names no physical side swaps its
    // slots there with nothing of its own.
    it('lies along the writing direction, so its slots swap sides under right-to-left', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(
        <ListItem leading={LEADING} testID="row" trailing={TRAILING}>
          Headline
        </ListItem>,
      )

      const style = styleOf(screen.getByTestId('row'))

      expect(style.flexDirection).toBe('row')
      expect(style).not.toHaveProperty('paddingLeft')
      expect(style).not.toHaveProperty('paddingRight')
      expect(rowOf('Headline').children[0]).toBe(
        screen.getByTestId('leading').parent,
      )
    })
  })

  describe('interactive', () => {
    it('is a button named by its headline, and runs onPress', async () => {
      const onPress = jest.fn()
      await render(
        <ListItem interactive onPress={onPress} supporting="Supporting line">
          Headline
        </ListItem>,
      )

      await fireEvent.press(
        screen.getByRole('button', { name: /Headline/ }),
        PRESS,
      )

      expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('takes no press and says it is disabled once disabled', async () => {
      const onPress = jest.fn()
      await render(
        <ListItem interactive isDisabled onPress={onPress}>
          Headline
        </ListItem>,
      )

      const row = screen.getByRole('button', {
        disabled: true,
        name: 'Headline',
      })
      await fireEvent.press(row, PRESS)

      expect(onPress).not.toHaveBeenCalled()
    })

    it("lands a call site's style, ref and testID on the row", async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        <ListItem interactive ref={ref} style={CALL_SITE} testID="row">
          Headline
        </ListItem>,
      )

      expect(styleOf(screen.getByTestId('row'))).toMatchObject({
        marginTop: 4,
        minHeight: sizing.rowSm,
      })
      expect(ref.current).not.toBe(null)
    })
  })

  describe('static', () => {
    it('has no role and no press', async () => {
      await render(<ListItem testID="row">Headline</ListItem>)

      const row = screen.getByTestId('row')

      expect(screen.queryByRole('button')).toBe(null)
      expect(row.props.role).toBeUndefined()
      expect(row.props.onClick).toBeUndefined()
      expect(row.props.onResponderRelease).toBeUndefined()
    })

    it('says it is disabled, and says nothing otherwise', async () => {
      await render(
        <ListItem isDisabled testID="row">
          Headline
        </ListItem>,
      )

      expect(screen.getByTestId('row').props['aria-disabled']).toBe(true)

      await render(<ListItem testID="row">Headline</ListItem>)

      expect(screen.getByTestId('row').props['aria-disabled']).toBeUndefined()
    })
  })
})
