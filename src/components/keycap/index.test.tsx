import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { TestInstance, TestNode } from 'test-renderer'

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react-native'
import { createRef } from 'react'
import { Platform, StyleSheet, View } from 'react-native'

import type { TypeRole } from '../../typography/roles'

import { Keycap, sentenceLabel } from '.'
import { scopeFor } from '../../theme/scope'
import { Code } from '../code'
import { Link } from '../link'
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
  'headlineSmall',
  'titleMedium',
]

const CALL_SITE = { marginTop: 4 }

const LABEL = <Link onPress={pressNothing}>Label</Link>

const ICON = <View />

const OS = Platform.OS

afterEach(() => {
  mockLoaded.clear()
  Platform.OS = OS
})

// The cap, which a screen reader is kept from inside a sentence on iOS and
// Android, and which a query therefore has to be told to look for.
function cap() {
  return screen.getByTestId('cap', { includeHiddenElements: true })
}

function child(node: TestNode | undefined): TestInstance {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

function label() {
  return child(cap().children[0])
}

function pressNothing() {
  // A link that goes nowhere, for the case reading a sentence holding one.
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

describe('keycap', () => {
  it('draws the assist chip’s rule with the extra-small corner and no fill', async () => {
    await render(<Keycap testID="cap">Enter</Keycap>)

    expect(styleOf(cap())).toMatchObject({
      borderColor: theme.colors.outline,
      borderRadius: theme.radii.xs,
      borderWidth: 1,
      paddingHorizontal: theme.spacing.xxs,
    })
    expect(styleOf(cap())).not.toHaveProperty('backgroundColor')
    expect(styleOf(cap())).not.toHaveProperty('paddingVertical')
  })

  it('sets its key on surface in the mono face, on one line', async () => {
    mockLoaded.add('Roboto Mono')
    await render(<Keycap testID="cap">Enter</Keycap>)

    await waitFor(() => {
      expect(styleOf(label())).toMatchObject({ fontFamily: 'Roboto Mono' })
    })
    expect(styleOf(label())).toMatchObject({ color: theme.colors.onSurface })
    expect(label().props.numberOfLines).toBe(1)
    expect(screen.getByText('Enter')).toBeTruthy()
  })

  it.each(ROLES)(
    'sets 0.8125 of the size of the %s text around it, on a 1.4 line height',
    async (role) => {
      await render(
        <Text variant={role}>
          Press <Keycap testID="cap">Enter</Keycap>
        </Text>,
      )

      const size = theme.typography[`${role}Size`] * 0.8125
      expect(styleOf(label()).fontSize).toBeCloseTo(size)
      expect(styleOf(label()).lineHeight).toBeCloseTo(size * 1.4)
    },
  )

  it('sizes itself from body medium and shrinks to its key outside a Text', async () => {
    await render(<Keycap testID="cap">Enter</Keycap>)

    expect(styleOf(label()).fontSize).toBeCloseTo(
      theme.typography.bodyMediumSize * 0.8125,
    )
    expect(styleOf(cap())).toMatchObject({ alignSelf: 'flex-start' })
    expect(styleOf(cap())).not.toHaveProperty('transform')
  })

  describe('inside a Text on iOS and Android', () => {
    it('lies inline in the Text around it', async () => {
      await render(
        <Text testID="sentence">
          Press <Keycap testID="cap">Esc</Keycap> to dismiss
        </Text>,
      )

      const sentence = screen.getByTestId('sentence')
      expect(sentence.type).toBe('Text')
      expect(sentence.children).toContain(cap())
      expect(styleOf(cap())).not.toHaveProperty('alignSelf')
    })

    it('moves down until its baseline meets the sentence’s', async () => {
      await render(
        <Text variant="bodyLarge">
          Press <Keycap testID="cap">Esc</Keycap>
        </Text>,
      )

      // Its bottom edge stands on the baseline, so it moves down by the rule,
      // half the leading and Roboto Mono's descent at its own size.
      const size = theme.typography.bodyLargeSize * 0.8125
      const below = 1 + ((1.4 - 1.048 - 0.271) / 2 + 0.271) * size
      expect(styleOf(cap()).transform).toEqual([
        { translateY: expect.closeTo(below) },
      ])
    })

    it('says the sentence with the key’s name in its place', async () => {
      await render(
        <Text testID="sentence">
          Press <Keycap testID="cap">Ctrl</Keycap> + <Keycap>K</Keycap>, or{' '}
          <Code>esc</Code> to dismiss
        </Text>,
      )

      expect(screen.getByTestId('sentence').props.accessibilityLabel).toBe(
        'Press Ctrl + K, or esc to dismiss',
      )
      expect(cap().props).toMatchObject({
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      })
    })

    it('keeps a label the call site gives the sentence', async () => {
      await render(
        <Text accessibilityLabel="Press Escape" testID="sentence">
          Press <Keycap>Esc</Keycap>
        </Text>,
      )

      expect(screen.getByTestId('sentence').props.accessibilityLabel).toBe(
        'Press Escape',
      )
    })
  })

  it('leaves to the platform a sentence whose words its children do not hold', () => {
    expect(
      sentenceLabel(['Press ', LABEL, ' or ', <Keycap key="k">K</Keycap>]),
    ).toBe(undefined)
    expect(sentenceLabel(['Press ', ICON, <Keycap key="k">K</Keycap>])).toBe(
      undefined,
    )
  })

  it('leaves a Text holding no Keycap unlabelled', async () => {
    await render(
      <Text testID="sentence">
        A sentence naming <Code>identifier</Code>
      </Text>,
    )

    expect(screen.getByTestId('sentence').props.accessibilityLabel).toBe(
      undefined,
    )
  })

  it('lies on the baseline as it is and keeps its words in the sentence on the web', async () => {
    Platform.OS = 'web'
    await render(
      <Text testID="sentence">
        Press <Keycap testID="cap">Esc</Keycap>
      </Text>,
    )

    expect(styleOf(cap())).not.toHaveProperty('transform')
    expect(cap().props).not.toHaveProperty('accessibilityElementsHidden')
    expect(screen.getByTestId('sentence').props.accessibilityLabel).toBe(
      undefined,
    )
  })

  it('lands `style`, `ref` and `testID` on the cap', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(
      <Keycap ref={ref} style={CALL_SITE} testID="cap">
        Enter
      </Keycap>,
    )

    expect(styleOf(cap())).toMatchObject({ marginTop: 4 })
    expect(ref.current).not.toBeNull()
  })
})
