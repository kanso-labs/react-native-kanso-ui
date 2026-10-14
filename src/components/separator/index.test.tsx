import type { ComponentRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { StyleSheet, View } from 'react-native'

import type { SeparatorInset } from '.'
import type { KuiTheme } from '../../tokens/defaults'

import { Separator } from '.'
import { ThemeScope } from '../../theme-scope'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})

const MARGINS = [
  'marginBottom',
  'marginEnd',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginTop',
] as const

// The margins each inset sets, for each orientation, and nothing else.
const INSETS: readonly (readonly [
  'horizontal' | 'vertical',
  SeparatorInset,
  ViewStyle,
])[] = [
  ['horizontal', 'none', {}],
  ['horizontal', 'start', { marginStart: theme.spacing.lg }],
  [
    'horizontal',
    'both',
    { marginEnd: theme.spacing.lg, marginStart: theme.spacing.lg },
  ],
  ['vertical', 'none', {}],
  ['vertical', 'start', { marginTop: theme.spacing.lg }],
  [
    'vertical',
    'both',
    { marginBottom: theme.spacing.lg, marginTop: theme.spacing.lg },
  ],
]

const RED_RULE: KuiTheme = { '--kui-color-outline-variant': '#ff0000' }

// Sets what the rule sets too, so it shows which one wins.
const CALL_SITE = { backgroundColor: 'red', height: 2, marginTop: 4 }

// The margins a style sets, and nothing for the ones it leaves alone, so a
// case says exactly which ends an inset moves.
function marginsOf(style: ViewStyle) {
  return Object.fromEntries(
    MARGINS.filter((margin) => style[margin] !== undefined).map((margin) => [
      margin,
      style[margin],
    ]),
  )
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

// The rule is not an accessibility element of its own, so Testing Library's
// role query, which finds only those, does not reach it. A screen reader on
// either platform passes over a rule rather than stopping on it, which is the
// point, and React Native Web still writes the role onto the element.
describe('Separator', () => {
  it('draws a horizontal 1dp rule in the outline-variant role', async () => {
    await render(<Separator testID="rule" />)

    const rule = screen.getByTestId('rule')
    const style = styleOf(rule)

    expect(style).toMatchObject({
      alignSelf: 'stretch',
      backgroundColor: theme.colors.outlineVariant,
      height: 1,
    })
    expect(style.width).toBeUndefined()
    expect(rule.props.role).toBe('separator')
    expect(rule.props['aria-orientation']).toBeUndefined()
  })

  it('draws a vertical 1dp rule in the outline-variant role', async () => {
    await render(<Separator orientation="vertical" testID="rule" />)

    const rule = screen.getByTestId('rule')
    const style = styleOf(rule)

    expect(style).toMatchObject({
      alignSelf: 'stretch',
      backgroundColor: theme.colors.outlineVariant,
      width: 1,
    })
    expect(style.height).toBeUndefined()
    expect(rule.props.role).toBe('separator')
    expect(rule.props['aria-orientation']).toBe('vertical')
  })

  it('reads its colour from the scope around it', async () => {
    await render(
      <ThemeScope theme={RED_RULE}>
        <Separator testID="rule" />
      </ThemeScope>,
    )

    expect(styleOf(screen.getByTestId('rule')).backgroundColor).toBe('#ff0000')
    expect(theme.colors.outlineVariant).not.toBe('#ff0000')
  })

  it.each(INSETS)(
    'holds a %s rule off its ends by the %s inset',
    async (orientation, inset, margins) => {
      await render(
        <Separator inset={inset} orientation={orientation} testID="rule" />,
      )

      expect(marginsOf(styleOf(screen.getByTestId('rule')))).toEqual(margins)
    },
  )

  // The page's inset divider is 16dp, which is the lg step.
  it('insets by 16dp under the default tokens', () => {
    expect(theme.spacing.lg).toBe(16)
  })

  it('draws the call site’s style over its own, on the host view', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(<Separator ref={ref} style={CALL_SITE} testID="rule" />)

    const rule = screen.getByTestId('rule')

    expect(styleOf(rule)).toMatchObject(CALL_SITE)
    expect(ref.current).not.toBeNull()
  })
})
