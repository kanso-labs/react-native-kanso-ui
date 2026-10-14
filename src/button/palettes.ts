import type { TextStyle, ViewStyle } from 'react-native'

import { withOpacity } from '../theme/color'
import { themedStyles } from '../theme/styles'

/** What a container draws: its own style, and the colour of what is on it. */
type Palette = {
  readonly container: ViewStyle
  readonly content: string
  readonly label: TextStyle
}

// Every container a button or an icon button draws, by the name web's styles
// give it. The two pages share their pairs, so the two components share the
// table: a filled icon button is a filled button's colours around an icon.
// Three of a toggle's unselected containers are the plain variant's own, so
// they have no name of their own here.
type PaletteName =
  | 'elevated'
  | 'elevatedToggleSelected'
  | 'filled'
  | 'filledDisabled'
  | 'filledToggle'
  | 'filledToggleSelected'
  | 'outlined'
  | 'outlinedDisabled'
  | 'outlinedToggleSelected'
  | 'standard'
  | 'standardToggleSelected'
  | 'text'
  | 'textDisabled'
  | 'tonal'
  | 'tonalToggleSelected'

function palette(content: string, container: ViewStyle = {}): Palette {
  return { container, content, label: { color: content } }
}

/**
 * The containers, from the theme's colour roles. Disabled is the pages'
 * colour at an opacity, translucent: a container is on-surface at the
 * `disabledContainer` opacity, and its content on-surface at
 * `disabledContent`. Web mixes both over the surface role, since a
 * `color-mix()` needs a colour to mix with; React Native has none, and the
 * pages give the two as opacities over whatever the button sits on, which is
 * what they are drawn as here.
 */
const palettesOf = themedStyles(
  ({ colors, stateLayerOpacity }): Readonly<Record<PaletteName, Palette>> => {
    const disabledContainer = withOpacity(
      colors.onSurface,
      stateLayerOpacity.disabledContainer,
    )
    const disabledContent = withOpacity(
      colors.onSurface,
      stateLayerOpacity.disabledContent,
    )

    return {
      elevated: palette(colors.primary, {
        backgroundColor: colors.surfaceContainerLow,
      }),
      elevatedToggleSelected: palette(colors.onPrimary, {
        backgroundColor: colors.primary,
      }),
      filled: palette(colors.onPrimary, { backgroundColor: colors.primary }),
      filledDisabled: palette(disabledContent, {
        backgroundColor: disabledContainer,
      }),
      filledToggle: palette(colors.onSurfaceVariant, {
        backgroundColor: colors.surfaceContainer,
      }),
      filledToggleSelected: palette(colors.onPrimary, {
        backgroundColor: colors.primary,
      }),
      outlined: palette(colors.onSurfaceVariant, {
        borderColor: colors.outlineVariant,
      }),
      outlinedDisabled: palette(disabledContent, {
        borderColor: disabledContainer,
      }),
      // The rule keeps its width, drawn transparent, so a toggle does not
      // change size as it is selected.
      outlinedToggleSelected: palette(colors.inverseOnSurface, {
        backgroundColor: colors.inverseSurface,
        borderColor: 'transparent',
      }),
      // Transparent, tinting whatever it sits on: the icon button's standard
      // style, whose icon moves to primary once a toggle is selected.
      standard: palette(colors.onSurfaceVariant),
      standardToggleSelected: palette(colors.primary),
      text: palette(colors.primary),
      // A text button's and a standard icon button's disabled colours, which
      // both pages give as the content alone, over no container.
      textDisabled: palette(disabledContent),
      tonal: palette(colors.onSecondaryContainer, {
        backgroundColor: colors.secondaryContainer,
      }),
      tonalToggleSelected: palette(colors.onSecondary, {
        backgroundColor: colors.secondary,
      }),
    }
  },
)

export { palettesOf }
export type { Palette, PaletteName }
