import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { TestInstance, TestNode } from 'test-renderer'

import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { StyleSheet, View } from 'react-native'

import { Badge } from '.'
import { BadgeInFlowContext } from '../../badge'
import { I18nProvider } from '../../i18n/provider'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const { colors, radii, spacing, typography } = theme

const CALL_SITE = { marginTop: 4 }

const ICON = <View testID="icon" />

function anchor() {
  return screen.getByTestId('badge')
}

function child(node: TestNode | undefined): TestInstance {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

// The count's Text, after the space that sets it apart.
function countOf(of: TestInstance) {
  return child(of.children[1])
}

// The mark, which comes after what the badge is drawn on, or alone.
function mark() {
  const children = anchor().children
  return child(children.at(-1))
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

describe('badge', () => {
  describe('structure', () => {
    it('wraps what it is drawn on, then draws its mark', async () => {
      await render(<Badge testID="badge">{ICON}</Badge>)

      expect(anchor().children).toHaveLength(2)
      expect(child(anchor().children[0]).props.testID).toBe('icon')
    })

    it('lands `style`, `ref` and `testID` on the view it wraps with', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        <Badge ref={ref} style={CALL_SITE} testID="badge">
          {ICON}
        </Badge>,
      )

      expect(styleOf(anchor())).toMatchObject({
        alignItems: 'flex-start',
        flexDirection: 'row',
        marginTop: 4,
      })
      expect(ref.current).not.toBeNull()
    })

    it('stands in the line as the mark alone when it wraps nothing', async () => {
      await render(<Badge testID="badge" />)

      expect(anchor().children).toHaveLength(1)
      expect(styleOf(mark())).toMatchObject({
        height: 6,
        position: 'relative',
        width: 6,
      })
      expect(styleOf(mark())).not.toHaveProperty('end')
    })

    it('stands a count in the line too, overlapping nothing', async () => {
      await render(<Badge count={3} testID="badge" />)

      const style = styleOf(mark())
      expect(style).toMatchObject({ minHeight: 16, position: 'relative' })
      expect(style).not.toHaveProperty('marginStart')
      expect(style).not.toHaveProperty('top')
    })
  })

  describe('the small badge', () => {
    it("is the page's 6dp dot on the error role", async () => {
      await render(<Badge testID="badge">{ICON}</Badge>)

      expect(styleOf(mark())).toMatchObject({
        backgroundColor: colors.error,
        borderRadius: radii.pill,
        height: 6,
        width: 6,
      })
      expect(mark().children).toHaveLength(0)
    })

    it("fills the icon's top trailing corner, by its logical end", async () => {
      await render(<Badge testID="badge">{ICON}</Badge>)

      const style = styleOf(mark())
      expect(style).toMatchObject({ end: 0, position: 'absolute', top: 0 })
      expect(style).not.toHaveProperty('right')
      expect(style).not.toHaveProperty('left')
    })
  })

  describe('the large badge', () => {
    it('holds the count in label small on the error pair, 16dp tall', async () => {
      await render(
        <Badge count={3} testID="badge">
          {ICON}
        </Badge>,
      )

      expect(styleOf(mark())).toMatchObject({
        backgroundColor: colors.error,
        borderRadius: radii.pill,
        minHeight: 16,
        minWidth: 16,
        paddingHorizontal: spacing.xs,
      })
      const count = countOf(mark())
      expect(count.children).toEqual(['3'])
      expect(textStyleOf(count)).toMatchObject({
        color: colors.onError,
        fontSize: typography.labelSmallSize,
        fontVariant: ['tabular-nums'],
      })
    })

    it('stands 2dp above what it is on, its leading edge 12dp inside its end', async () => {
      await render(
        <Badge count={3} testID="badge">
          {ICON}
        </Badge>,
      )

      const style = styleOf(mark())
      expect(style).toMatchObject({
        marginStart: -12,
        position: 'absolute',
        start: '100%',
        top: -2,
      })
      expect(style).not.toHaveProperty('left')
    })

    it('grows toward the end as the count lengthens, at least 16dp wide', async () => {
      await render(
        <Badge count={120} testID="badge">
          {ICON}
        </Badge>,
      )

      const style = styleOf(mark())
      expect(style).toMatchObject({ minWidth: 16 })
      expect(style).not.toHaveProperty('width')
      expect(style).not.toHaveProperty('end')
    })

    it('caps a count above max with a plus', async () => {
      await render(
        <Badge count={1000} testID="badge">
          {ICON}
        </Badge>,
      )
      expect(countOf(mark()).children).toEqual(['999+'])

      await render(
        <Badge count={12} max={9} testID="badge">
          {ICON}
        </Badge>,
      )
      expect(countOf(mark()).children).toEqual(['9+'])
    })

    it('draws a count of max, and of 0, as itself', async () => {
      await render(
        <Badge count={999} testID="badge">
          {ICON}
        </Badge>,
      )
      expect(countOf(mark()).children).toEqual(['999'])

      await render(
        <Badge count={0} testID="badge">
          {ICON}
        </Badge>,
      )
      expect(countOf(mark()).children).toEqual(['0'])
    })

    it("writes the count in the provider's locale", async () => {
      await render(
        <I18nProvider locale="ar-EG">
          <Badge count={12} testID="badge">
            {ICON}
          </Badge>
        </I18nProvider>,
      )

      expect(countOf(mark()).children).toEqual([
        new Intl.NumberFormat('ar-EG').format(12),
      ])
    })

    it('joins the flow after the icon where what draws it asks', async () => {
      await render(
        <BadgeInFlowContext value>
          <Badge count={3} testID="badge">
            {ICON}
          </Badge>
        </BadgeInFlowContext>,
      )

      expect(styleOf(mark())).toMatchObject({
        marginStart: -12,
        position: 'relative',
        top: -2,
      })
    })

    it('keeps the small dot on the corner where the flow is asked for', async () => {
      await render(
        <BadgeInFlowContext value>
          <Badge testID="badge">{ICON}</Badge>
        </BadgeInFlowContext>,
      )

      expect(styleOf(mark())).toMatchObject({ end: 0, position: 'absolute' })
    })
  })

  describe('for a screen reader', () => {
    it('hides the mark, leaving the name to the control it sits on', async () => {
      await render(
        <Badge count={3} testID="badge">
          {ICON}
        </Badge>,
      )

      expect(mark().props['aria-hidden']).toBe(true)
      expect(screen.queryByText('3')).toBeNull()
    })

    it('sets the count apart from the text before it with a space out of the flow', async () => {
      await render(
        <Badge count={3} testID="badge">
          {ICON}
        </Badge>,
      )

      const space = child(mark().children[0])
      expect(space.children).toEqual([' '])
      expect(textStyleOf(space)).toMatchObject({ position: 'absolute' })
    })

    it('takes no touches, so a press lands on what it is drawn on', async () => {
      await render(
        <Badge count={3} testID="badge">
          {ICON}
        </Badge>,
      )

      expect(styleOf(mark())).toMatchObject({ pointerEvents: 'none' })
    })
  })
})
