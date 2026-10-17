import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'

import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { StyleSheet, View } from 'react-native'

import type { TagProps, TagTone, TagVariant } from '.'

import { Tag } from '.'
import { useIconStyle } from '../../glyphs/icon-style'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const { colors, radii, spacing, typography } = theme

const CALL_SITE = { marginTop: 4 }

// Each tone and variant's container fill, its rule, and the colour its label
// and icon are drawn in. Filled is a container under its own on-colour, and
// neutral the surface pairing; outlined is the tone at full strength, and
// neutral the outline-variant rule every border draws from.
const TONES: readonly (readonly [
  TagVariant,
  TagTone,
  string,
  string,
  string,
])[] = [
  [
    'filled',
    'negative',
    colors.negativeContainer,
    'transparent',
    colors.onNegativeContainer,
  ],
  [
    'filled',
    'neutral',
    colors.surfaceContainerHighest,
    'transparent',
    colors.onSurfaceVariant,
  ],
  [
    'filled',
    'positive',
    colors.positiveContainer,
    'transparent',
    colors.onPositiveContainer,
  ],
  [
    'filled',
    'primary',
    colors.primaryContainer,
    'transparent',
    colors.onPrimaryContainer,
  ],
  ['outlined', 'negative', 'transparent', colors.negative, colors.negative],
  [
    'outlined',
    'neutral',
    'transparent',
    colors.outlineVariant,
    colors.onSurfaceVariant,
  ],
  ['outlined', 'positive', 'transparent', colors.positive, colors.positive],
  ['outlined', 'primary', 'transparent', colors.primary, colors.primary],
]

// Draws what the slot it sits in hands an icon, as an icon of the app's own
// reads it.
function Probe() {
  const { color, size } = useIconStyle()

  return <View testID="probe" {...{ color, size }} />
}

const PROBE = <Probe />

// What the tag holds, by host type: `Text` for each label, and whatever an
// icon draws for an icon.
function contents() {
  return tag().children.map((child) =>
    typeof child === 'string' ? child : child.type,
  )
}

function labels() {
  return tag().children.flatMap((child) =>
    typeof child !== 'string' && child.type === 'Text'
      ? [String(child.props.children)]
      : [],
  )
}

async function setup(props: Partial<TagProps> = {}) {
  return render(
    <Tag testID="tag" {...props}>
      {props.children ?? 'Label'}
    </Tag>,
  )
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function tag() {
  return screen.getByTestId('tag')
}

describe('Tag', () => {
  it('draws its label as text', async () => {
    await setup()

    expect(screen.getByText('Label')).toBeTruthy()
  })

  // A tag states something and is never the thing you press, so it carries
  // no role a screen reader would announce as a control.
  it('takes no role and no press', async () => {
    await setup()

    expect(tag().props.role).toBeUndefined()
    expect(tag().props.accessibilityRole).toBeUndefined()
    expect(tag().props.onPress).toBeUndefined()
    expect(tag().props.accessible).toBeUndefined()
  })

  it('puts the style, ref and testID on its view', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await setup({ ref, style: CALL_SITE })

    expect(styleOf(tag())).toMatchObject(CALL_SITE)
    expect(typeof ref.current?.measure).toBe('function')
  })

  it('applies a style over its own', async () => {
    await setup({ style: { borderRadius: 0 } })

    expect(styleOf(tag()).borderRadius).toBe(0)
  })
})

describe('the container', () => {
  it('is a row on the small corner, holding its padding and gap', async () => {
    await setup()

    expect(styleOf(tag())).toMatchObject({
      alignItems: 'center',
      borderRadius: radii.sm,
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
    })
  })

  // A tag labels something else, so a row short of room gives way somewhere
  // other than the tag.
  it('never shrinks', async () => {
    await setup()

    expect(styleOf(tag()).flexShrink).toBe(0)
  })

  // Filled keeps its rule and makes it transparent, so emphasising one tag
  // does not nudge its neighbours.
  it.each(['filled', 'outlined'] as const)(
    'carries a 1dp rule when %s',
    async (variant) => {
      await setup({ variant })

      expect(styleOf(tag()).borderWidth).toBe(1)
    },
  )

  it('is filled and neutral by default', async () => {
    await setup()

    expect(styleOf(tag())).toMatchObject({
      backgroundColor: colors.surfaceContainerHighest,
      borderColor: 'transparent',
    })
  })

  it.each(TONES)(
    'draws %s %s in its roles',
    async (variant, tone, background, border, content) => {
      await setup({ tone, variant })

      expect(styleOf(tag())).toMatchObject({
        backgroundColor: background,
        borderColor: border,
      })
      expect(styleOf(screen.getByText('Label')).color).toBe(content)
    },
  )
})

describe('the label', () => {
  it('is label small, in tabular figures, on one line', async () => {
    await setup()

    const label = screen.getByText('Label')

    expect(styleOf(label)).toMatchObject({
      fontSize: typography.labelSmallSize,
      fontVariant: ['tabular-nums'],
      lineHeight: typography.labelSmallLineHeight,
    })
    expect(label.props.numberOfLines).toBe(1)
  })

  // A number and the words around it are one label, so they are read and
  // laid out as one run rather than as three.
  it('joins a run of strings and numbers into one text', async () => {
    await setup({ children: [3, ' of ', 12n] })

    expect(contents()).toEqual(['Text'])
    expect(labels()).toEqual(['3 of 12'])
  })

  it('draws a number on its own', async () => {
    await setup({ children: 7 })

    expect(labels()).toEqual(['7'])
  })

  it('draws nothing for an empty tag', async () => {
    await setup({ children: [null, false] })

    expect(contents()).toEqual([])
  })
})

describe('an icon', () => {
  it('is drawn as given, before the label', async () => {
    await setup({ children: [PROBE, 'Label'] })

    expect(contents()).toEqual(['View', 'Text'])
    expect(tag().children[0]).toBe(screen.getByTestId('probe'))
    expect(labels()).toEqual(['Label'])
  })

  // At the label's line height, so a tag with an icon is the same height as
  // one without.
  it.each(TONES)(
    'is handed the label colour and line height of %s %s',
    async (variant, tone, _background, _border, content) => {
      await setup({ children: [PROBE, 'Label'], tone, variant })

      expect(screen.getByTestId('probe').props).toMatchObject({
        color: content,
        size: typography.labelSmallLineHeight,
      })
    },
  )

  it('splits the label into the runs either side of it', async () => {
    await setup({ children: ['First', PROBE, 'Second'] })

    expect(contents()).toEqual(['Text', 'View', 'Text'])
    expect(labels()).toEqual(['First', 'Second'])
  })
})
