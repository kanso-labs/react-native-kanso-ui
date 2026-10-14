import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle } from 'react-native'

import { describe, expect, it } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { StyleSheet, View } from 'react-native'

import type { AvatarProps } from '.'

import { Avatar } from '.'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const { colors, radii, typography } = theme

const CALL_SITE = { marginTop: 4 }

const PHOTO = 'https://example.invalid/photo.png'

const NEXT_PHOTO = 'https://example.invalid/next.png'

const IMG_PROPS = {
  fadeDuration: 0,
  referrerPolicy: 'no-referrer',
  resizeMethod: 'resize',
} as const

// Each size's diameter, and the size its initials are set at.
const SIZES: readonly (readonly [Size, number, number, number])[] = [
  ['sm', 36, typography.labelMediumSize, typography.labelMediumLineHeight],
  ['md', 40, typography.labelLargeSize, typography.labelLargeLineHeight],
  ['lg', 56, typography.bodyLargeSize, typography.bodyLargeLineHeight],
]

// Each tone's container, and the on-container role its content takes.
const TONES: readonly (readonly [Tone, string, string])[] = [
  ['primary', colors.primaryContainer, colors.onPrimaryContainer],
  ['secondary', colors.secondaryContainer, colors.onSecondaryContainer],
  ['tertiary', colors.tertiaryContainer, colors.onTertiaryContainer],
  ['positive', colors.positiveContainer, colors.onPositiveContainer],
  ['negative', colors.negativeContainer, colors.onNegativeContainer],
]

type Host = ReturnType<typeof screen.getByTestId>

type Size = NonNullable<AvatarProps['size']>

type Tone = NonNullable<AvatarProps['tone']>

// Found whether or not it is hidden from screen readers, since a decorative
// one is.
function avatar() {
  return screen.getByTestId('avatar', { includeHiddenElements: true })
}

// What the disc holds, by host type: `Text` for the initials,
// `RNSVGSvgView` for the anonymous person, `Image` for each picture.
function contents() {
  return avatar().children.map((child) =>
    typeof child === 'string' ? child : child.type,
  )
}

function images() {
  return avatar().children.filter(
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

async function setup(props: Partial<AvatarProps> = {}) {
  return render(<Avatar name="Ada Lovelace" testID="avatar" {...props} />)
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle> }
}): TextStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

describe('Avatar', () => {
  it('is an image named for the person, showing their initials', async () => {
    await setup()

    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toBe(avatar())
    expect(screen.getByText('AL')).toBeTruthy()
    expect(contents()).toEqual(['Text'])
  })

  // The initials are drawn, and the name is what is read: "AL" names
  // nothing a listener would recognise.
  it('is not named by its initials', async () => {
    await setup()

    expect(screen.queryByRole('img', { name: 'AL' })).toBeNull()
    expect(avatar().props.accessible).toBe(true)
  })

  it('takes the initials of the first and last word', async () => {
    await setup({ name: 'Dr. Ada King Lovelace (she/her)' })

    expect(screen.getByText('AL')).toBeTruthy()
  })

  it('puts the style, ref and testID on its disc', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await setup({ ref, style: CALL_SITE })

    expect(styleOf(avatar())).toMatchObject(CALL_SITE)
    expect(typeof ref.current?.measure).toBe('function')
  })

  // Beside the name it stands for, the avatar would read the name a second
  // time. Hidden, its initials are not read as bare letters either, and are
  // still drawn.
  it('is hidden from screen readers while decorative', async () => {
    await setup({ decorative: true })

    expect(screen.queryByRole('img')).toBeNull()
    expect(avatar().props).toMatchObject({ 'aria-hidden': true })
    expect(avatar().props.role).toBeUndefined()
    expect(avatar().props['aria-label']).toBeUndefined()
    expect(contents()).toEqual(['Text'])
  })

  it('is shown to screen readers while not decorative', async () => {
    await setup()

    expect(avatar().props['aria-hidden']).toBeUndefined()
  })
})

describe('a blank name', () => {
  it.each(['', '   '])(
    'draws the anonymous person for %j, and announces nothing',
    async (name) => {
      await setup({ name })

      expect(screen.queryByRole('img')).toBeNull()
      expect(avatar().props.accessible).toBeUndefined()
      expect(avatar().props['aria-label']).toBeUndefined()
      expect(contents()).toEqual(['RNSVGSvgView'])
    },
  )

  it('hides the anonymous person from screen readers', async () => {
    await setup({ name: '' })

    expect(only(avatar().children)).toMatchObject({
      props: { accessibilityElementsHidden: true },
    })
  })

  it('leaves the disc empty given showPersonIcon false', async () => {
    await setup({ name: '', showPersonIcon: false })

    expect(contents()).toEqual([])
  })

  it.each(SIZES)(
    'draws the person three fifths of the %s disc',
    async (size, diameter) => {
      await setup({ name: '', size })

      expect(only(avatar().children)).toMatchObject({
        props: { height: diameter * 0.6, width: diameter * 0.6 },
      })
    },
  )

  it.each(TONES)(
    'draws the person in the on-container role of %s',
    async (tone, _container, content) => {
      await setup({ name: '', tone })

      expect(only(avatar().children)).toMatchObject({
        props: { color: content },
      })
    },
  )
})

describe('the disc', () => {
  it('is a circle that clips what it holds', async () => {
    await setup()

    expect(styleOf(avatar())).toMatchObject({
      borderRadius: radii.circle,
      overflow: 'hidden',
    })
  })

  it.each(SIZES)(
    'draws %s at %ddp, with its initials at %ddp',
    async (size, diameter, fontSize, lineHeight) => {
      await setup({ size })

      expect(styleOf(avatar())).toMatchObject({
        height: diameter,
        width: diameter,
      })
      expect(styleOf(screen.getByText('AL'))).toMatchObject({
        fontSize,
        lineHeight,
      })
    },
  )

  it('draws md by default', async () => {
    await setup()

    expect(styleOf(avatar())).toMatchObject({ height: 40, width: 40 })
  })

  it.each(TONES)(
    'tints %s with its container, and draws the initials in its on-container role',
    async (tone, container, content) => {
      await setup({ tone })

      expect(styleOf(avatar()).backgroundColor).toBe(container)
      expect(styleOf(screen.getByText('AL')).color).toBe(content)
    },
  )

  it('tints with primary by default', async () => {
    await setup()

    expect(styleOf(avatar()).backgroundColor).toBe(colors.primaryContainer)
  })

  it("sets the initials in the label face at the label role's weight", async () => {
    await setup()

    expect(styleOf(screen.getByText('AL'))).toMatchObject({
      fontWeight: typography.labelLargeWeight,
    })
  })

  // The disc does not grow with the device's text size, so the initials do
  // not either, where they would run past its edge.
  it('keeps its initials at their size whatever the device asks for', async () => {
    await setup()

    expect(screen.getByText('AL').props.allowFontScaling).toBe(false)
  })
})

describe('the photo', () => {
  it('draws no image given no src', async () => {
    await setup()

    expect(images()).toEqual([])
  })

  it('draws the photo from the start, hidden over the initials until it loads', async () => {
    await setup({ src: PHOTO })

    expect(contents()).toEqual(['Text', 'Image'])
    expect(only(images()).props.source).toEqual({ uri: PHOTO })
    expect(styleOf(only(images())).opacity).toBe(0)

    await fireEvent(only(images()), 'load')

    expect(contents()).toEqual(['Image'])
    expect(styleOf(only(images())).opacity).toBeUndefined()
  })

  it('fills the disc and crops the photo to it', async () => {
    await setup({ src: PHOTO })

    expect(only(images()).props.resizeMode).toBe('cover')
    expect(styleOf(only(images()))).toMatchObject({
      height: '100%',
      position: 'absolute',
      width: '100%',
    })
  })

  // A photo is not interface colour, so Smart Invert leaves it as it is.
  it('is not inverted by Smart Invert', async () => {
    await setup({ src: PHOTO })

    expect(only(images()).props.accessibilityIgnoresInvertColors).toBe(true)
  })

  it('brings the initials back when the photo fails', async () => {
    await setup({ src: PHOTO })

    await fireEvent(only(images()), 'error')

    expect(contents()).toEqual(['Text'])
  })

  it('keeps the photo before while a new one loads', async () => {
    const { rerender } = await setup({ src: PHOTO })
    await fireEvent(only(images()), 'load')

    await rerender(
      <Avatar name="Ada Lovelace" src={NEXT_PHOTO} testID="avatar" />,
    )

    expect(contents()).toEqual(['Image', 'Image'])
    const [before, next] = images()
    expect(before.props.source).toEqual({ uri: PHOTO })
    expect(styleOf(before).opacity).toBeUndefined()
    expect(next.props.source).toEqual({ uri: NEXT_PHOTO })
    expect(styleOf(next).opacity).toBe(0)

    await fireEvent(next, 'load')

    expect(contents()).toEqual(['Image'])
    expect(only(images()).props.source).toEqual({ uri: NEXT_PHOTO })
  })

  it('brings the initials back when the new photo fails', async () => {
    const { rerender } = await setup({ src: PHOTO })
    await fireEvent(only(images()), 'load')
    await rerender(
      <Avatar name="Ada Lovelace" src={NEXT_PHOTO} testID="avatar" />,
    )

    await fireEvent(images().at(-1) ?? avatar(), 'error')

    expect(contents()).toEqual(['Text'])
  })

  it('reads a new photo as loading, whatever the one before did', async () => {
    const { rerender } = await setup({ src: PHOTO })
    await fireEvent(only(images()), 'error')

    await rerender(
      <Avatar name="Ada Lovelace" src={NEXT_PHOTO} testID="avatar" />,
    )

    expect(contents()).toEqual(['Text', 'Image'])
    expect(styleOf(only(images())).opacity).toBe(0)
  })

  it('draws the anonymous person until a photo loads for a blank name', async () => {
    await setup({ name: '', src: PHOTO })

    expect(contents()).toEqual(['RNSVGSvgView', 'Image'])

    await fireEvent(only(images()), 'load')

    expect(contents()).toEqual(['Image'])
  })

  it('hands the image props it is given to the photo', async () => {
    await setup({ imgProps: IMG_PROPS, src: PHOTO })

    expect(only(images()).props).toMatchObject(IMG_PROPS)
  })
})
