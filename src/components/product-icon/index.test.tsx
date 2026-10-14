import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle } from 'react-native'

import { describe, expect, it } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { StyleSheet, View } from 'react-native'

import type { ProductIconProps } from '.'

import { ProductIcon } from '.'
import { scopeFor } from '../../theme/scope'
import { Avatar } from '../avatar'

const { theme } = scopeFor('light', {})
const { colors, radii, typography } = theme

const CALL_SITE = { marginTop: 4 }

const MARK = 'https://example.invalid/mark.png'

const NEXT_MARK = 'https://example.invalid/next.png'

const IMG_PROPS = {
  fadeDuration: 0,
  referrerPolicy: 'no-referrer',
  resizeMethod: 'resize',
} as const

type Host = ReturnType<typeof screen.getByTestId>

type Initial = {
  readonly initial: string
  readonly name: string
}

type Size = NonNullable<ProductIconProps['size']>

type Tone = NonNullable<ProductIconProps['tone']>

// One letter, number or emoji, passing over the punctuation a name opens
// with: a handle's at sign, a channel's hash, a bracket, a quote.
const INITIALS: readonly Initial[] = [
  { initial: 'L', name: 'Label' },
  { initial: 'L', name: '@label' },
  { initial: 'L', name: '#label' },
  { initial: 'T', name: '(third) item' },
  { initial: 'F', name: '"fourth"' },
  { initial: 'F', name: 'first item' },
  { initial: '𝒜', name: '𝒜 label' },
  { initial: '', name: '   ' },
]

// Each size's edge, and the size its initial is set at.
const SIZES: readonly (readonly [Size, number, number])[] = [
  ['sm', 36, typography.labelMediumSize],
  ['md', 40, typography.labelLargeSize],
  ['lg', 56, typography.bodyLargeSize],
]

// Each tone's container, and the on-container role its initial takes.
const TONES: readonly (readonly [Tone, string, string])[] = [
  ['primary', colors.primaryContainer, colors.onPrimaryContainer],
  ['secondary', colors.secondaryContainer, colors.onSecondaryContainer],
  ['tertiary', colors.tertiaryContainer, colors.onTertiaryContainer],
  ['positive', colors.positiveContainer, colors.onPositiveContainer],
  ['negative', colors.negativeContainer, colors.onNegativeContainer],
]

// What the square holds, by host type: `View` for the tinted fallback,
// `Image` for each mark.
function contents() {
  return icon().children.map((child) =>
    typeof child === 'string' ? child : child.type,
  )
}

// The tinted fallback, the square's first child while there is no mark.
function fallback() {
  const view = icon().children.at(0)
  if (view === undefined || typeof view === 'string' || view.type !== 'View') {
    throw new TypeError('expected the fallback to fill the square')
  }
  return view
}

// Found whether or not it is hidden from screen readers, since a decorative
// one is.
function icon() {
  return screen.getByTestId('icon', { includeHiddenElements: true })
}

function images() {
  return icon().children.filter(
    (child): child is Host =>
      typeof child !== 'string' && child.type === 'Image',
  )
}

function only<T>(list: readonly T[]) {
  const [item] = list
  if (item === undefined || list.length !== 1) {
    throw new TypeError(`expected one, found ${String(list.length)}`)
  }
  return item
}

async function setup(props: Partial<ProductIconProps> = {}) {
  return render(<ProductIcon name="First item" testID="icon" {...props} />)
}

function styleOf(element: { props: { style?: StyleProp<TextStyle> } }) {
  return StyleSheet.flatten([element.props.style])
}

function textOf(element: Host): string {
  return element.children
    .map((child) => (typeof child === 'string' ? child : textOf(child)))
    .join('')
}

describe('ProductIcon', () => {
  it('is an image named for the thing, showing its initial', async () => {
    await setup()

    expect(screen.getByRole('img', { name: 'First item' })).toBe(icon())
    expect(screen.queryByRole('img', { name: 'F' })).toBeNull()
    expect(textOf(icon())).toBe('F')
  })

  it.each(INITIALS)(
    'initialises $name as $initial',
    async ({ initial, name }) => {
      await setup({ name })

      expect(textOf(icon())).toBe(initial)
    },
  )

  // "Second item" is not a first and a last name, so initialising both words
  // would draw a pair of initials for something that was never two names.
  it('takes one initial where Avatar takes two', async () => {
    await setup({ name: 'Second item' })
    expect(textOf(icon())).toBe('S')

    await render(<Avatar name="Second item" testID="icon" />)
    expect(textOf(icon())).toBe('SI')
  })

  it('puts the style, ref and testID on its square', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await setup({ ref, style: CALL_SITE })

    expect(styleOf(icon())).toMatchObject(CALL_SITE)
    expect(typeof ref.current?.measure).toBe('function')
  })

  it('is hidden from screen readers while decorative, and still drawn', async () => {
    await setup({ decorative: true })

    expect(screen.queryByRole('img')).toBeNull()
    expect(icon().props).toMatchObject({ 'aria-hidden': true })
    expect(icon().props.role).toBeUndefined()
    expect(icon().props['aria-label']).toBeUndefined()
    expect(textOf(icon())).toBe('F')
  })

  it.each(['', '   '])('is not announced for the name %j', async (name) => {
    await setup({ name })

    expect(screen.queryByRole('img')).toBeNull()
    expect(icon().props.accessible).toBeUndefined()
    expect(icon().props['aria-label']).toBeUndefined()
  })

  // The anonymous person is a person's. A thing with no name draws its tint
  // alone.
  it('draws the tinted square alone for a blank name', async () => {
    await setup({ name: '' })

    expect(contents()).toEqual(['View'])
    expect(styleOf(fallback()).backgroundColor).toBe(colors.primaryContainer)
    expect(textOf(fallback())).toBe('')
  })
})

describe('the square', () => {
  it('rounds its corner to the small shape, and clips what it holds', async () => {
    await setup()

    expect(styleOf(icon())).toMatchObject({
      borderRadius: radii.sm,
      overflow: 'hidden',
    })
  })

  it.each(SIZES)(
    'draws %s at %ddp, with its initial at %ddp',
    async (size, edge, fontSize) => {
      await setup({ size })

      expect(styleOf(icon())).toMatchObject({ height: edge, width: edge })
      expect(styleOf(screen.getByText('F')).fontSize).toBe(fontSize)
    },
  )

  // Interchangeable with Avatar in a leading slot, which holds only while
  // the two agree on what each size means.
  it.each(SIZES)('matches Avatar at %s', async (size) => {
    await setup({ size })
    const square = styleOf(icon())

    await render(<Avatar name="Ada Lovelace" size={size} testID="icon" />)
    const disc = styleOf(icon())

    expect([square.width, square.height]).toEqual([disc.width, disc.height])
  })

  it('draws md by default', async () => {
    await setup()

    expect(styleOf(icon())).toMatchObject({ height: 40, width: 40 })
  })

  // A mark is letterboxed into the square and may have transparent parts, so
  // a tint on the square would show as a coloured box around it.
  it('puts no tint on the square itself', async () => {
    await setup()

    expect(styleOf(icon()).backgroundColor).toBeUndefined()
  })

  it.each(TONES)(
    'tints the fallback with the %s container, and draws the initial in its on-container role',
    async (tone, container, content) => {
      await setup({ tone })

      expect(styleOf(fallback())).toMatchObject({
        backgroundColor: container,
        height: '100%',
        width: '100%',
      })
      expect(styleOf(screen.getByText('F')).color).toBe(content)
    },
  )

  it('keeps its initial at its size whatever the device asks for', async () => {
    await setup()

    expect(screen.getByText('F').props.allowFontScaling).toBe(false)
  })
})

describe('the mark', () => {
  it('draws no image given no src', async () => {
    await setup()

    expect(images()).toEqual([])
  })

  // Cropping a face to fill a circle loses nothing anyone minds, and
  // cropping a wordmark loses the word.
  it('letterboxes the mark where Avatar crops its photo', async () => {
    await setup({ src: MARK })
    expect(only(images()).props.resizeMode).toBe('contain')

    await render(<Avatar name="Ada Lovelace" src={MARK} testID="icon" />)
    expect(only(images()).props.resizeMode).toBe('cover')
  })

  it('draws the mark from the start, hidden over the fallback until it loads', async () => {
    await setup({ src: MARK })

    expect(contents()).toEqual(['View', 'Image'])
    expect(only(images()).props.source).toEqual({ uri: MARK })
    expect(styleOf(only(images())).opacity).toBe(0)

    await fireEvent(only(images()), 'load')

    expect(contents()).toEqual(['Image'])
    expect(styleOf(only(images())).opacity).toBeUndefined()
    expect(styleOf(icon()).backgroundColor).toBeUndefined()
  })

  it('brings the tinted fallback back when the mark fails', async () => {
    await setup({ src: MARK })

    await fireEvent(only(images()), 'error')

    expect(contents()).toEqual(['View'])
    expect(textOf(fallback())).toBe('F')
  })

  it('keeps the mark before while a new one loads', async () => {
    const { rerender } = await setup({ src: MARK })
    await fireEvent(only(images()), 'load')

    await rerender(
      <ProductIcon name="First item" src={NEXT_MARK} testID="icon" />,
    )

    expect(contents()).toEqual(['Image', 'Image'])
    const [before, next] = images()
    expect(before.props).toMatchObject({
      resizeMode: 'contain',
      source: { uri: MARK },
    })
    expect(styleOf(before).opacity).toBeUndefined()
    expect(styleOf(next).opacity).toBe(0)
  })

  // The mark is not accessible on its own, so once it loads under a blank
  // name it does not become the image the square stopped being.
  it('is not announced once a mark loads under a blank name', async () => {
    await setup({ name: '   ', src: MARK })

    await fireEvent(only(images()), 'load')

    expect(screen.queryByRole('img')).toBeNull()
  })

  it('hands the image props it is given to the mark', async () => {
    await setup({ imgProps: IMG_PROPS, src: MARK })

    expect(only(images()).props).toMatchObject(IMG_PROPS)
  })
})
