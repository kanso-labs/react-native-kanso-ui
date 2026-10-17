import type { ViewStyle } from 'react-native'

import { StyleSheet } from 'react-native'

import type { Palette } from '../button/palettes'
import type { ResolvedTheme } from '../theme/scope'
import type { TypeRole } from '../typography/roles'

import { palettesOf } from '../button/palettes'
import { themedStyles } from '../theme/styles'

// The FAB's metrics and colours, shared by Fab and by the FAB that opens
// FabMenu, which is the same button until its menu opens, as web's
// src/fab/styles.ts is shared. Apart from either component, and outside
// `src/components`, which holds the public components alone. Fab's header
// gives the values and where they come from.

/**
 * The pages' three sizes: `md` the FAB at 56dp, `lg` the medium FAB at 80dp
 * and `xl` the large FAB at 96dp.
 */
type FabSize = 'lg' | 'md' | 'xl'

/** The colour role a FAB is drawn in. */
type FabTone = 'primary' | 'secondary' | 'tertiary'

/**
 * `tonal` draws the tone's container pair, the pages' default; `filled`
 * draws the tone itself.
 */
type FabVariant = 'filled' | 'tonal'

// The medium FAB's container and corner, between the steps of the control
// and radius scales, so written out as web writes them.
const MEDIUM_SIZE = 80
const MEDIUM_CORNER = 20

/** The icon each size draws, from the pages' size token sets. */
const FAB_ICON_SIZES: Readonly<Record<FabSize, number>> = {
  lg: 28,
  md: 24,
  xl: 36,
}

/** The type role the extended form sets its label in at each size. */
const EXTENDED_FAB_ROLES: Readonly<Record<FabSize, TypeRole>> = {
  lg: 'titleLarge',
  md: 'titleMedium',
  xl: 'headlineSmall',
}

/**
 * Each size's corner, apart from its size so the press feedback can clip to
 * the same one.
 */
const fabCornersOf = themedStyles(({ radii }) =>
  StyleSheet.create({
    lg: { borderRadius: MEDIUM_CORNER },
    md: { borderRadius: radii.lg },
    xl: { borderRadius: radii.xl },
  }),
)

/** The FAB on its own: a square of the size's edge. */
const fabSizesOf = themedStyles(({ sizing }) =>
  StyleSheet.create({
    lg: { height: MEDIUM_SIZE, width: MEDIUM_SIZE },
    md: { height: sizing.controlLg, width: sizing.controlLg },
    xl: { height: sizing.controlXl, width: sizing.controlXl },
  }),
)

/**
 * The extended form: the size's height, with its padding at either end and
 * the gap before the label. The 26dp and 28dp paddings fall between steps of
 * the spacing scale and are written out, as on web.
 *
 * The height is a floor rather than a fixed size, so a label the device's
 * text size enlarges grows the button rather than spilling out of it, which
 * web's fixed height has no need to allow for.
 */
const extendedFabSizesOf = themedStyles(({ sizing, spacing }) =>
  StyleSheet.create({
    lg: {
      columnGap: spacing.md,
      minHeight: MEDIUM_SIZE,
      paddingHorizontal: 26,
    },
    md: {
      columnGap: spacing.sm,
      minHeight: sizing.controlLg,
      paddingHorizontal: spacing.lg,
    },
    xl: {
      columnGap: spacing.lg,
      minHeight: sizing.controlXl,
      paddingHorizontal: 28,
    },
  }),
)

/** A FAB's container colour and the colour drawn on it. */
type FabColors = { readonly container: string; readonly content: string }

/**
 * The six colour pairs, by variant and tone: each tone's container pair, and
 * the tone itself. Plain colours, for FabMenu's FAB, which eases from one
 * pair to another as its menu opens.
 */
const fabColorsOf = themedStyles(
  ({
    colors,
  }): Readonly<Record<FabVariant, Readonly<Record<FabTone, FabColors>>>> => ({
    filled: {
      primary: { container: colors.primary, content: colors.onPrimary },
      secondary: { container: colors.secondary, content: colors.onSecondary },
      tertiary: { container: colors.tertiary, content: colors.onTertiary },
    },
    tonal: {
      primary: {
        container: colors.primaryContainer,
        content: colors.onPrimaryContainer,
      },
      secondary: {
        container: colors.secondaryContainer,
        content: colors.onSecondaryContainer,
      },
      tertiary: {
        container: colors.tertiaryContainer,
        content: colors.onTertiaryContainer,
      },
    },
  }),
)

/**
 * The six colour pairs as the palettes a button draws, and the one disabled
 * container every button shares: on-surface at the two disabled opacities,
 * as src/button/palettes.ts draws it.
 */
const fabPalettesOf = themedStyles(
  (
    theme,
  ): {
    readonly disabled: Palette
    readonly filled: Readonly<Record<FabTone, Palette>>
    readonly tonal: Readonly<Record<FabTone, Palette>>
  } => {
    const pairs = fabColorsOf(theme)

    return {
      disabled: palettesOf(theme).filledDisabled,
      filled: palettesFor(pairs.filled),
      tonal: palettesFor(pairs.tonal),
    }
  },
)

const fabShadowsOf = themedStyles(({ shadows }) =>
  StyleSheet.create({
    elevation3: { boxShadow: shadows.elevation3 },
    elevation4: { boxShadow: shadows.elevation4 },
  }),
)

/**
 * The shadow a FAB draws in its state: level 3 at rest and while pressed,
 * level 4 under a hovering pointer, and none while disabled, since a shadow
 * says a control is there to press.
 */
function fabShadowOf(
  {
    hovered,
    pressed,
  }: { readonly hovered: boolean; readonly pressed: boolean },
  isDisabled: boolean,
  theme: ResolvedTheme,
): undefined | ViewStyle {
  if (isDisabled) {
    return undefined
  }

  return fabShadowsOf(theme)[hovered && !pressed ? 'elevation4' : 'elevation3']
}

function palette({ container, content }: FabColors): Palette {
  return {
    container: { backgroundColor: container },
    content,
    label: { color: content },
  }
}

function palettesFor(
  pairs: Readonly<Record<FabTone, FabColors>>,
): Readonly<Record<FabTone, Palette>> {
  return {
    primary: palette(pairs.primary),
    secondary: palette(pairs.secondary),
    tertiary: palette(pairs.tertiary),
  }
}

export {
  EXTENDED_FAB_ROLES,
  extendedFabSizesOf,
  FAB_ICON_SIZES,
  fabColorsOf,
  fabCornersOf,
  fabPalettesOf,
  fabShadowOf,
  fabSizesOf,
}
export type { FabColors, FabSize, FabTone, FabVariant }
