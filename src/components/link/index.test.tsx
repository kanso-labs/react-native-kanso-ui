import type { ComponentRef, ReactElement, ReactNode } from 'react'
import type { StyleProp, TextStyle } from 'react-native'

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import { createRef } from 'react'
import { Linking, Text as NativeText, Platform, StyleSheet } from 'react-native'

import type { LinkTone, LinkUnderline } from '.'

import { Link } from '.'
import { RouterProvider } from '../../router'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'
import { Text } from '../text'

const { theme } = scopeFor('light', {})
const { colors, radii, stateLayerOpacity } = theme

const DISABLED_CONTENT = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContent,
)

// The ring web draws under `:focus-visible`, which the press feedback's own
// stylesheet holds.
const RING = {
  outlineColor: colors.primary,
  outlineOffset: 2,
  outlineStyle: 'solid',
  outlineWidth: 2,
}

const CALL_SITE = { marginTop: 4 }

// Each tone's text and rule at rest. `inherit` sets no colour, so the Text
// around it lends its own.
const TONES: readonly (readonly [
  LinkTone,
  Readonly<Record<string, string>>,
])[] = [
  [
    'primary',
    {
      color: colors.primary,
      textDecorationColor: withOpacity(colors.primary, 0.7),
    },
  ],
  ['inherit', { textDecorationColor: colors.outline }],
]

const UNDERLINES: readonly (readonly [LinkUnderline, string])[] = [
  ['always', 'underline'],
  ['hover', 'none'],
  ['none', 'none'],
]

// The type a sentence sets, which a link nested in it must leave alone.
const TYPE_PROPERTIES = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
] as const

/** Focus arriving at the span, which the browser does or does not draw. */
function focusWith(visible: boolean) {
  return { currentTarget: { matches: () => visible } }
}

/** A key reaching the span, as React Native Web hands it on. */
function keyDown(key: string, click: () => void, repeat = false) {
  return { currentTarget: { click }, key, repeat }
}

// Renders as React Native Web would be handed the link, and returns it.
async function renderOnWeb(element: ReactElement) {
  jest.replaceProperty(Platform, 'OS', 'web')
  await render(element)
  return screen.getByTestId('link')
}

function Routed({
  children,
  navigate,
}: {
  readonly children: ReactNode
  readonly navigate: (href: string) => void
}) {
  return <RouterProvider navigate={navigate}>{children}</RouterProvider>
}

function styleOf(element: { props: { style?: StyleProp<TextStyle> } }) {
  return StyleSheet.flatten([element.props.style])
}

// The preset already mocks `Linking`, and a spy on a mock is that same mock,
// so its calls outlive a restore and are cleared as well.
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
})

describe('Link', () => {
  it('is announced as a link, named by its text', async () => {
    await render(<Link href="/first">Label</Link>)

    expect(screen.getByRole('link', { name: 'Label' })).toBeOnTheScreen()
  })

  it('nests in a Text and sets no type of its own', async () => {
    await render(
      <Text testID="sentence" variant="titleLarge">
        Supporting line with <Link testID="link">Label</Link>
      </Text>,
    )

    const link = within(screen.getByTestId('sentence')).getByTestId('link')

    for (const property of TYPE_PROPERTIES) {
      expect(styleOf(link)).not.toHaveProperty(property)
    }
  })

  it('takes the ring’s corner', async () => {
    await render(<Link testID="link">Label</Link>)

    expect(styleOf(screen.getByTestId('link'))).toMatchObject({
      borderRadius: radii.xs,
    })
  })

  it('passes style, ref and testID through to the Text', async () => {
    const ref = createRef<ComponentRef<typeof NativeText>>()

    await render(
      <Link href="/first" ref={ref} style={CALL_SITE} testID="link">
        Label
      </Link>,
    )

    const link = screen.getByTestId('link')

    expect(styleOf(link)).toMatchObject(CALL_SITE)
    expect(ref.current).not.toBeNull()
  })

  it('calls onPress', async () => {
    const onPress = jest.fn()

    await render(<Link onPress={onPress}>Label</Link>)
    await fireEvent.press(screen.getByRole('link'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('takes no press with nowhere to go and nothing to call', async () => {
    await render(<Link testID="link">Label</Link>)

    expect(screen.getByTestId('link').props.onPress).toBeUndefined()
  })

  describe('href', () => {
    it('is followed through the router, after onPress', async () => {
      const calls: string[] = []
      const navigate = jest.fn((href: string) => {
        calls.push(href)
      })
      const onPress = jest.fn(() => {
        calls.push('onPress')
      })

      await render(
        <Routed navigate={navigate}>
          <Link href="/first" onPress={onPress}>
            Label
          </Link>
        </Routed>,
      )
      await fireEvent.press(screen.getByRole('link'))

      expect(calls).toEqual(['onPress', '/first'])
    })

    it('is opened by the platform without a router', async () => {
      const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)

      await render(<Link href="https://example.com">Label</Link>)
      await fireEvent.press(screen.getByRole('link'))

      expect(openURL.mock.calls).toEqual([['https://example.com']])
    })
  })

  describe('disabled', () => {
    // The Text is handed no `onPress` at all, which is what keeps a tap
    // from reaching the call site's. Testing Library would otherwise find the
    // call site's own on the Link around the Text and call it regardless.
    it('takes no press and follows nothing', async () => {
      const navigate = jest.fn()

      await render(
        <Routed navigate={navigate}>
          <Link href="/first" isDisabled onPress={jest.fn()} testID="link">
            Label
          </Link>
        </Routed>,
      )

      const link = screen.getByTestId('link')

      expect(link.props.onPress).toBeUndefined()

      await fireEvent.press(link)

      expect(navigate).not.toHaveBeenCalled()
    })

    it('is announced as a disabled link', async () => {
      await render(
        <>
          <Link href="/first" isDisabled>
            Disabled
          </Link>
          <Link href="/first">Enabled</Link>
        </>,
      )

      expect(screen.getByRole('link', { name: 'Disabled' })).toBeDisabled()
      expect(screen.getByRole('link', { name: 'Enabled' })).toBeEnabled()
    })

    it.each(TONES)(
      'fades a %s link’s text and rule to the disabled content colour',
      async (tone) => {
        await render(
          <Link href="/first" isDisabled testID="link" tone={tone}>
            Label
          </Link>,
        )

        expect(styleOf(screen.getByTestId('link'))).toMatchObject({
          color: DISABLED_CONTENT,
          textDecorationColor: DISABLED_CONTENT,
        })
      },
    )
  })

  describe('tone', () => {
    it.each(TONES)('draws %s from the theme', async (tone, expected) => {
      await render(
        <Link href="/first" testID="link" tone={tone}>
          Label
        </Link>,
      )

      expect(styleOf(screen.getByTestId('link'))).toMatchObject(expected)
    })

    it('is primary unless told otherwise', async () => {
      await render(
        <Link href="/first" testID="link">
          Label
        </Link>,
      )

      expect(styleOf(screen.getByTestId('link'))).toMatchObject({
        color: colors.primary,
      })
    })

    it('leaves the colour to the Text around it when told to inherit', async () => {
      await render(
        <Text tone="muted">
          <Link href="/first" testID="link" tone="inherit">
            Label
          </Link>
        </Text>,
      )

      expect(styleOf(screen.getByTestId('link'))).not.toHaveProperty('color')
    })
  })

  describe('underline', () => {
    it.each(UNDERLINES)('draws %s as %s', async (underline, line) => {
      await render(
        <Link href="/first" testID="link" underline={underline}>
          Label
        </Link>,
      )

      expect(styleOf(screen.getByTestId('link'))).toMatchObject({
        textDecorationLine: line,
      })
    })

    it('is drawn unless told otherwise', async () => {
      await render(
        <Link href="/first" testID="link">
          Label
        </Link>,
      )

      expect(styleOf(screen.getByTestId('link'))).toMatchObject({
        textDecorationLine: 'underline',
      })
    })
  })

  describe('on native', () => {
    it('suppresses iOS’s pressed highlight unless told otherwise', async () => {
      await render(
        <>
          <Link href="/first" testID="default">
            Label
          </Link>
          <Link href="/first" suppressHighlighting={false} testID="lit">
            Label
          </Link>
        </>,
      )

      expect(screen.getByTestId('default').props).toMatchObject({
        suppressHighlighting: true,
      })
      expect(screen.getByTestId('lit').props).toMatchObject({
        suppressHighlighting: false,
      })
    })

    it('takes no pointer, focus or key events', async () => {
      await render(
        <Link href="/first" testID="link">
          Label
        </Link>,
      )

      const { props } = screen.getByTestId('link')

      for (const name of [
        'focusable',
        'onBlur',
        'onFocus',
        'onKeyDown',
        'onPointerEnter',
        'onPointerLeave',
      ]) {
        expect(props).not.toHaveProperty(name)
      }
    })
  })

  describe('on the web', () => {
    describe('hover', () => {
      it('lights the link and draws its rule under a mouse', async () => {
        const link = await renderOnWeb(
          <Link href="/first" testID="link" tone="inherit" underline="hover">
            Label
          </Link>,
        )

        await fireEvent(link, 'pointerEnter', { pointerType: 'mouse' })

        expect(styleOf(link)).toMatchObject({
          color: colors.primary,
          textDecorationColor: colors.primary,
          textDecorationLine: 'underline',
        })

        await fireEvent(link, 'pointerLeave')

        expect(styleOf(link)).toMatchObject({ textDecorationLine: 'none' })
        expect(styleOf(link)).not.toHaveProperty('color')
      })

      it('keeps an always rule drawn, and lights it', async () => {
        const link = await renderOnWeb(
          <Link href="/first" testID="link">
            Label
          </Link>,
        )

        await fireEvent(link, 'pointerEnter', { pointerType: 'pen' })

        expect(styleOf(link)).toMatchObject({
          textDecorationColor: colors.primary,
          textDecorationLine: 'underline',
        })
      })

      it('stays at rest under a touch', async () => {
        const link = await renderOnWeb(
          <Link href="/first" testID="link" tone="inherit" underline="hover">
            Label
          </Link>,
        )

        await fireEvent(link, 'pointerEnter', { pointerType: 'touch' })

        expect(styleOf(link)).toMatchObject({ textDecorationLine: 'none' })
        expect(styleOf(link)).not.toHaveProperty('color')
      })

      it('is never hovered while disabled', async () => {
        const link = await renderOnWeb(
          <Link href="/first" isDisabled testID="link" underline="hover">
            Label
          </Link>,
        )

        await fireEvent(link, 'pointerEnter', { pointerType: 'mouse' })

        expect(styleOf(link)).toMatchObject({
          color: DISABLED_CONTENT,
          textDecorationLine: 'none',
        })
      })
    })

    describe('focus', () => {
      it('shows the ring while the browser draws focus, and not after', async () => {
        const link = await renderOnWeb(
          <Link href="/first" testID="link">
            Label
          </Link>,
        )

        expect(styleOf(link)).not.toHaveProperty('outlineStyle')

        await fireEvent(link, 'focus', focusWith(true))

        expect(styleOf(link)).toMatchObject(RING)

        await fireEvent(link, 'blur')

        expect(styleOf(link)).not.toHaveProperty('outlineStyle')
      })

      it('shows no ring for focus a pointer brought', async () => {
        const link = await renderOnWeb(
          <Link href="/first" testID="link">
            Label
          </Link>,
        )

        await fireEvent(link, 'focus', focusWith(false))

        expect(styleOf(link)).not.toHaveProperty('outlineStyle')
      })

      it('shows no ring while disabled, and is no tab stop', async () => {
        const link = await renderOnWeb(
          <Link href="/first" isDisabled testID="link">
            Label
          </Link>,
        )

        await fireEvent(link, 'focus', focusWith(true))

        expect(styleOf(link)).not.toHaveProperty('outlineStyle')
        expect(link.props).toMatchObject({ focusable: false })
      })

      it('is a tab stop while enabled', async () => {
        const link = await renderOnWeb(
          <Link href="/first" testID="link">
            Label
          </Link>,
        )

        expect(link.props).toMatchObject({ focusable: true })
      })
    })

    describe('keys', () => {
      it('follows the link on Enter', async () => {
        const click = jest.fn()
        const link = await renderOnWeb(
          <Link href="/first" testID="link">
            Label
          </Link>,
        )

        await fireEvent(link, 'keyDown', keyDown('Enter', click))

        expect(click).toHaveBeenCalledTimes(1)
      })

      it.each([
        ['Space', keyDown(' ', jest.fn())],
        ['a held Enter', keyDown('Enter', jest.fn(), true)],
      ])('ignores %s', async (_, event) => {
        const link = await renderOnWeb(
          <Link href="/first" testID="link">
            Label
          </Link>,
        )

        await fireEvent(link, 'keyDown', event)

        expect(event.currentTarget.click).not.toHaveBeenCalled()
      })

      it('ignores Enter while disabled', async () => {
        const click = jest.fn()
        const link = await renderOnWeb(
          <Link href="/first" isDisabled testID="link">
            Label
          </Link>,
        )

        await fireEvent(link, 'keyDown', keyDown('Enter', click))

        expect(click).not.toHaveBeenCalled()
      })
    })
  })
})
