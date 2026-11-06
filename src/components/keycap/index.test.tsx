import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { TestInstance, TestNode } from 'test-renderer'

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
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

// Lays a Text out with its first line's baseline `descent` above the line's
// bottom, as the platform reports it.
async function layOut(text: TestInstance, descent: number) {
  await fireEvent(text, 'textLayout', {
    nativeEvent: { lines: [{ descender: descent }] },
  })
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

    it('moves down onto the sentence’s baseline by the system font’s figures until it is laid out', async () => {
      await render(
        <Text variant="bodyLarge">
          Press <Keycap testID="cap">Esc</Keycap>
        </Text>,
      )

      // iOS stands the cap 2.76pt above the bottom of the line, so it moves
      // down by that, the rule and its own baseline's height above its
      // bottom, less the sentence's.
      const around = theme.typography.bodyLargeSize
      const size = around * 0.8125
      const own = 0.2412 * size + (1.4 * size - 1.1934 * size) / 2
      const line =
        0.2412 * around +
        (theme.typography.bodyLargeLineHeight - 1.1934 * around) / 2
      expect(styleOf(cap()).transform).toEqual([
        { translateY: expect.closeTo(2.76 + 1 + own - line) },
      ])
    })

    it('moves down onto the sentence’s baseline by what the two Texts measure once laid out', async () => {
      await render(
        <Text testID="sentence" variant="bodyLarge">
          Press <Keycap testID="cap">Esc</Keycap>
        </Text>,
      )

      await layOut(screen.getByTestId('sentence'), 6.31)
      await layOut(label(), 4.67)

      expect(styleOf(cap()).transform).toEqual([
        { translateY: expect.closeTo(2.76 + 1 + 4.67 - 6.31) },
      ])
    })

    it('stands its bottom edge on the baseline on Android, so moves down by its own baseline’s height', async () => {
      Platform.OS = 'android'
      await render(
        <Text testID="sentence" variant="bodyLarge">
          Press <Keycap testID="cap">Esc</Keycap>
        </Text>,
      )

      await layOut(screen.getByTestId('sentence'), 6.31)
      await layOut(label(), 4.67)

      expect(styleOf(cap()).transform).toEqual([
        { translateY: expect.closeTo(1 + 4.67) },
      ])
    })

    it('lets the Text around it draw past its own box, and hands its layout on', async () => {
      const onTextLayout = jest.fn()
      await render(
        <Text onTextLayout={onTextLayout} testID="sentence">
          Press <Keycap>Esc</Keycap>
        </Text>,
      )

      await layOut(screen.getByTestId('sentence'), 5)

      expect(styleOf(screen.getByTestId('sentence')).overflow).toBe('visible')
      expect(onTextLayout).toHaveBeenCalledTimes(1)
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

  it('leaves a Text holding no Keycap unlabelled and clipped', async () => {
    await render(
      <Text testID="sentence">
        A sentence naming <Code>identifier</Code>
      </Text>,
    )

    expect(screen.getByTestId('sentence').props.accessibilityLabel).toBe(
      undefined,
    )
    expect(styleOf(screen.getByTestId('sentence'))).not.toHaveProperty(
      'overflow',
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
    expect(styleOf(screen.getByTestId('sentence'))).not.toHaveProperty(
      'overflow',
    )
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
