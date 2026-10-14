import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle } from 'react-native'

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react-native'
import { createRef } from 'react'
import { Text as NativeText, StyleSheet } from 'react-native'

import type { KuiTheme } from '../../tokens/defaults'
import type { TypeRole } from '../../typography/roles'

import { Text } from '.'
import { ThemeScope } from '../../theme-scope'
import { scopeFor } from '../../theme/scope'

// The families the app has registered with expo-font, which a case fills in.
const mockLoaded = new Set<string>()

jest.mock(
  'expo-font',
  () => ({ isLoaded: (family: string) => mockLoaded.has(family) }),
  { virtual: true },
)

const ROLES: readonly TypeRole[] = [
  'bodyLarge',
  'bodyMedium',
  'bodySmall',
  'displayLarge',
  'displayMedium',
  'displaySmall',
  'headlineLarge',
  'headlineMedium',
  'headlineSmall',
  'labelLarge',
  'labelMedium',
  'labelSmall',
  'titleLarge',
  'titleMedium',
  'titleSmall',
]

const TONES = [
  ['error', 'error'],
  ['muted', 'onSurfaceVariant'],
  ['negative', 'negative'],
  ['neutral', 'onSurface'],
  ['positive', 'positive'],
  ['primary', 'primary'],
] as const

const INTER: KuiTheme = {
  '--kui-typography-font-family-plain': "'Inter', sans-serif",
}

// Sets what the role and the tone set too, so it shows which one wins.
const CALL_SITE = { color: 'red', fontSize: 30, marginTop: 4 }

const BETWEEN: KuiTheme = { '--kui-typography-weight-regular': '450' }

const { theme } = scopeFor('light', {})

function styleOf(element: {
  props: { style?: StyleProp<TextStyle> }
}): TextStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

afterEach(() => {
  mockLoaded.clear()
})

describe('Text', () => {
  it.each(ROLES)('draws %s at its tokens’ measures', async (role) => {
    await render(
      <Text testID="text" variant={role}>
        Label
      </Text>,
    )

    expect(styleOf(screen.getByTestId('text'))).toMatchObject({
      fontSize: theme.typography[`${role}Size`],
      fontWeight: theme.typography[`${role}Weight`],
      letterSpacing: theme.typography[`${role}Tracking`],
      lineHeight: theme.typography[`${role}LineHeight`],
    })
  })

  // A variable font on web takes 450 as it is, and React Native names only
  // the hundreds.
  it('rounds a weight between two to the nearer one native names', async () => {
    await render(
      <ThemeScope theme={BETWEEN}>
        <Text testID="text">Label</Text>
      </ThemeScope>,
    )

    expect(styleOf(screen.getByTestId('text')).fontWeight).toBe(500)
  })

  it('draws body medium in the neutral tone by default', async () => {
    await render(<Text testID="text">Label</Text>)

    expect(styleOf(screen.getByTestId('text'))).toMatchObject({
      color: theme.colors.onSurface,
      fontSize: theme.typography.bodyMediumSize,
    })
  })

  it.each(TONES.map(([tone, role]) => ({ role, tone })))(
    'draws the $tone tone in its colour role',
    async ({ role, tone }) => {
      await render(
        <Text testID="text" tone={tone}>
          Label
        </Text>,
      )

      expect(styleOf(screen.getByTestId('text')).color).toBe(theme.colors[role])
    },
  )

  it('sets no colour for the inherit tone', async () => {
    await render(
      <Text testID="text" tone="inherit">
        Label
      </Text>,
    )

    expect(styleOf(screen.getByTestId('text')).color).toBeUndefined()
  })

  it('draws in a role’s first family once the app has registered it', async () => {
    mockLoaded.add('Roboto Flex')
    await render(<Text testID="text">Label</Text>)

    // expo-font is imported once the first Text renders, and answers a moment
    // later.
    await waitFor(() => {
      expect(styleOf(screen.getByTestId('text')).fontFamily).toBe('Roboto Flex')
    })
  })

  it('draws in the system font while the family is not registered', async () => {
    await render(<Text testID="text">Label</Text>)

    await waitFor(() => {
      expect(styleOf(screen.getByTestId('text')).fontFamily).toBe('System')
    })
  })

  it('reaches every role in a family whose token is overridden', async () => {
    mockLoaded.add('Inter')
    const plain = ROLES.filter(
      (role) =>
        theme.typography[`${role}Font`] === theme.typography.fontFamilyPlain ||
        theme.typography[`${role}Font`].join() ===
          theme.typography.fontFamilyPlain.join(),
    )

    await render(
      <ThemeScope theme={INTER}>
        {ROLES.map((role) => (
          <Text key={role} testID={role} variant={role}>
            Label
          </Text>
        ))}
      </ThemeScope>,
    )

    await waitFor(() => {
      expect(
        ROLES.filter(
          (role) => styleOf(screen.getByTestId(role)).fontFamily === 'Inter',
        ),
      ).toEqual(plain)
    })
    expect(plain.length).toBeGreaterThan(0)
    expect(plain.length).toBeLessThan(ROLES.length)
  })

  it('draws the call site’s style over its own, on the host text', async () => {
    const ref = createRef<ComponentRef<typeof NativeText>>()
    await render(
      <Text ref={ref} style={CALL_SITE} testID="text">
        Label
      </Text>,
    )
    const host = screen.getByTestId('text')

    expect(styleOf(host)).toMatchObject(CALL_SITE)
    expect(ref.current).not.toBeNull()
    expect(host.props.allowFontScaling).not.toBe(false)
  })
})
