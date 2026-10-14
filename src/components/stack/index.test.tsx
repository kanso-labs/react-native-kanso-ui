import type { ComponentRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { StyleSheet, View } from 'react-native'

import type { StackAlign, StackGap, StackJustify } from '.'
import type { KuiTheme } from '../../tokens/defaults'

import { Stack } from '.'
import { ThemeScope } from '../../theme-scope'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})

const STEPS = [
  'xxs',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  'xxl',
  'xxxl',
] as const satisfies readonly StackGap[]

const ALIGNMENTS: readonly (readonly [StackAlign, ViewStyle['alignItems']])[] =
  [
    ['baseline', 'baseline'],
    ['center', 'center'],
    ['end', 'flex-end'],
    ['start', 'flex-start'],
    ['stretch', 'stretch'],
  ]

const JUSTIFICATIONS: readonly (readonly [
  StackJustify,
  ViewStyle['justifyContent'],
])[] = [
  ['around', 'space-around'],
  ['between', 'space-between'],
  ['center', 'center'],
  ['end', 'flex-end'],
  ['start', 'flex-start'],
]

const WIDER: KuiTheme = { '--kui-spacing-md': '20px' }

// Sets what the stack sets too, so it shows which one wins.
const CALL_SITE = { flexDirection: 'row-reverse', gap: 3, padding: 4 } as const

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

describe('Stack', () => {
  it('runs as a column with the middle gap by default', async () => {
    await render(<Stack testID="stack" />)

    const style = styleOf(screen.getByTestId('stack'))

    expect(style).toMatchObject({
      flexDirection: 'column',
      gap: theme.spacing.md,
    })
    expect(style.alignItems).toBeUndefined()
    expect(style.justifyContent).toBeUndefined()
    expect(style.flexWrap).toBeUndefined()
  })

  it.each(STEPS)('spaces its children by the %s spacing token', async (gap) => {
    await render(<Stack gap={gap} testID="stack" />)

    expect(styleOf(screen.getByTestId('stack')).gap).toBe(theme.spacing[gap])
  })

  it('closes the gap at none', async () => {
    await render(<Stack gap="none" testID="stack" />)

    expect(styleOf(screen.getByTestId('stack')).gap).toBe(0)
  })

  // The steps are distinct, so a gap reading the wrong token is caught by the
  // case above rather than agreeing with it by accident.
  it('reads eight distinct steps', () => {
    expect(new Set(STEPS.map((step) => theme.spacing[step])).size).toBe(8)
  })

  it('reads its gap from the scope around it', async () => {
    await render(
      <ThemeScope theme={WIDER}>
        <Stack testID="stack" />
      </ThemeScope>,
    )

    expect(styleOf(screen.getByTestId('stack')).gap).toBe(20)
    expect(theme.spacing.md).not.toBe(20)
  })

  it('runs as a row', async () => {
    await render(<Stack direction="row" testID="stack" />)

    expect(styleOf(screen.getByTestId('stack')).flexDirection).toBe('row')
  })

  it.each(ALIGNMENTS)('aligns its children at %s', async (align, value) => {
    await render(<Stack align={align} testID="stack" />)

    expect(styleOf(screen.getByTestId('stack')).alignItems).toBe(value)
  })

  it.each(JUSTIFICATIONS)(
    'distributes the leftover space at %s',
    async (justify, value) => {
      await render(<Stack justify={justify} testID="stack" />)

      expect(styleOf(screen.getByTestId('stack')).justifyContent).toBe(value)
    },
  )

  it('wraps a row onto further lines', async () => {
    await render(<Stack direction="row" testID="stack" wrap />)

    expect(styleOf(screen.getByTestId('stack')).flexWrap).toBe('wrap')
  })

  it('draws the call site’s style over its own, on the host view', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(
      <Stack ref={ref} style={CALL_SITE} testID="stack">
        <View testID="child" />
      </Stack>,
    )
    const host = screen.getByTestId('stack')

    expect(styleOf(host)).toMatchObject(CALL_SITE)
    expect(ref.current).not.toBeNull()
    expect(screen.getByTestId('child').parent).toBe(host)
  })
})
