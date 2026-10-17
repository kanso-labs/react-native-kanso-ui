import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle } from 'react-native'

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react-native'
import { createRef } from 'react'
import { Text as NativeText, StyleSheet } from 'react-native'

import type { TypeRole } from '../../typography/roles'

import { Code } from '.'
import { scopeFor } from '../../theme/scope'
import { Text } from '../text'

// The families the app has registered with expo-font, which a case fills in.
const mockLoaded = new Set<string>()

jest.mock(
  'expo-font',
  () => ({ isLoaded: (family: string) => mockLoaded.has(family) }),
  { virtual: true },
)

const { theme } = scopeFor('light', {})

const ROLES: readonly TypeRole[] = [
  'bodyLarge',
  'bodySmall',
  'displaySmall',
  'headlineSmall',
  'labelLarge',
  'titleMedium',
]

const CALL_SITE = { marginTop: 4 }

const LARGER = { fontSize: 32 }

afterEach(() => {
  mockLoaded.clear()
})

function code() {
  return screen.getByTestId('code')
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle> }
}): TextStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

describe('code', () => {
  it('sets the mono family the theme names', async () => {
    mockLoaded.add('Roboto Mono')
    await render(
      <Text>
        A sentence naming <Code testID="code">identifier</Code>
      </Text>,
    )

    await waitFor(() => {
      expect(styleOf(code())).toMatchObject({ fontFamily: 'Roboto Mono' })
    })
  })

  it.each(ROLES)(
    'sets 0.875 of the size of the %s text around it',
    async (role) => {
      await render(
        <Text variant={role}>
          A sentence naming <Code testID="code">identifier</Code>
        </Text>,
      )

      expect(styleOf(code()).fontSize).toBeCloseTo(
        theme.typography[`${role}Size`] * 0.875,
      )
    },
  )

  it('follows a size the call site gives the text around it', async () => {
    await render(
      <Text style={LARGER}>
        A sentence naming <Code testID="code">identifier</Code>
      </Text>,
    )

    expect(styleOf(code()).fontSize).toBeCloseTo(28)
  })

  it('takes the colour, the weight and the line height of the text around it', async () => {
    await render(
      <Text tone="muted" variant="titleMedium">
        A sentence naming <Code testID="code">identifier</Code>
      </Text>,
    )

    expect(styleOf(code())).not.toHaveProperty('color')
    expect(styleOf(code())).not.toHaveProperty('fontWeight')
    expect(styleOf(code())).not.toHaveProperty('lineHeight')
    expect(styleOf(code())).not.toHaveProperty('letterSpacing')
  })

  it('draws in body medium on surface with no text around it', async () => {
    await render(<Code testID="code">identifier</Code>)

    expect(styleOf(code())).toMatchObject({
      color: theme.colors.onSurface,
      lineHeight: theme.typography.bodyMediumLineHeight,
    })
    expect(styleOf(code()).fontSize).toBeCloseTo(
      theme.typography.bodyMediumSize * 0.875,
    )
  })

  it('draws nothing behind itself', async () => {
    await render(
      <Text>
        A sentence naming <Code testID="code">identifier</Code>
      </Text>,
    )

    expect(styleOf(code())).not.toHaveProperty('backgroundColor')
    expect(styleOf(code())).not.toHaveProperty('padding')
  })

  it('takes the share of a Code around it, as an em does', async () => {
    await render(
      <Text variant="bodyLarge">
        <Code>
          outer <Code testID="code">inner</Code>
        </Code>
      </Text>,
    )

    expect(styleOf(code()).fontSize).toBeCloseTo(
      theme.typography.bodyLargeSize * 0.875 * 0.875,
    )
  })

  it('lands `style`, `ref` and `testID` on the native text', async () => {
    const ref = createRef<ComponentRef<typeof NativeText>>()
    await render(
      <Text>
        A sentence naming{' '}
        <Code ref={ref} style={CALL_SITE} testID="code">
          identifier
        </Code>
      </Text>,
    )

    expect(styleOf(code())).toMatchObject({ marginTop: 4 })
    expect(ref.current).not.toBeNull()
  })
})
