import { StyleSheet } from 'react-native'

import type { ResolvedTheme } from '../theme/scope'

import { withOpacity } from '../theme/color'
import { themedStyles } from '../theme/styles'

// The row every list and menu item draws, as web's src/row draws it: the
// lists page's 16dp inline and 12dp block padding, 16dp between the slots
// and the text, and a height per spec page and line count. Each height is a
// `minHeight`, since the lines inside are set in type roles whose sizes are
// tokens, and a larger OS text size grows the row rather than clipping it.
// The navigation drawer page gives its row the lists page's 56dp too, with a
// menu's label large label, and marks the current one with a secondary
// container pill held 12dp off each edge, as web's drawer row does.

/**
 * Which spec page's row this is: the lists page's, the menus page's or the
 * navigation drawer page's.
 */
type RowVariant = 'drawer' | 'list' | 'menu'

// The on-colour of each variant's selected container.
const SELECTED_CONTENT = {
  drawer: 'onSecondaryContainer',
  list: 'onPrimaryContainer',
  menu: 'onTertiaryContainer',
} as const satisfies Record<RowVariant, keyof ResolvedTheme['colors']>

const rowStylesOf = themedStyles(
  ({ colors, radii, sizing, spacing }: ResolvedTheme) =>
    StyleSheet.create({
      base: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
      },
      // The navigation drawer page's row: the lists page's floor, and a pill
      // held off each edge, since what marks the current row there is a shape
      // as much as a colour. The row hands the same corners to its state layer
      // and ripple, which clip to them.
      drawer: {
        borderRadius: radii.pill,
        marginHorizontal: spacing.md,
        minHeight: sizing.rowSm,
      },
      // The lists page's one-line item.
      list: {
        minHeight: sizing.rowSm,
      },
      // The headline and the lines beside it take what the slots leave and
      // wrap past it, so a long one never runs under the trailing slot.
      // `minWidth: 0` is for React Native Web, where a text in a row keeps
      // CSS's automatic minimum, the width of its longest word.
      main: {
        flexGrow: 1,
        flexShrink: 1,
        gap: spacing.xxs,
        minWidth: 0,
      },
      // The menus page's item.
      menu: {
        minHeight: sizing.rowXs,
      },
      muted: {
        color: colors.onSurfaceVariant,
      },
      // The drawer page's current row, on secondary container rather than the
      // lists page's primary one, which keeps it apart from a selected row in
      // a list beside it.
      selectedDrawer: {
        backgroundColor: colors.secondaryContainer,
      },
      selectedList: {
        backgroundColor: colors.primaryContainer,
      },
      selectedMenu: {
        backgroundColor: colors.tertiaryContainer,
      },
      // The three-line item, the only one whose slots move: they are held
      // level with the overline rather than centred on the three lines.
      threeLine: {
        alignItems: 'flex-start',
        minHeight: sizing.rowLg,
      },
      twoLine: {
        minHeight: sizing.rowMd,
      },
    }),
)

const rowStyles = StyleSheet.create({
  // The focus ring, drawn inside the row as web's is, so a container that
  // clips its rows, such as a menu's surface, leaves the whole ring showing.
  ring: {
    outlineOffset: -2,
  },
  slot: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
  },
})

/**
 * The colour a row's headline, slots and feedback are drawn in: on surface,
 * the selected container's own on-colour, or on surface faded to the
 * disabled content opacity, which wins over the selected one.
 */
function rowContentColor(
  { colors, stateLayerOpacity }: ResolvedTheme,
  {
    isDisabled = false,
    isSelected = false,
    variant = 'list',
  }: {
    readonly isDisabled?: boolean
    readonly isSelected?: boolean
    readonly variant?: RowVariant
  },
): string {
  if (isDisabled) {
    return withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)
  }
  if (isSelected) {
    return colors[SELECTED_CONTENT[variant]]
  }
  return colors.onSurface
}

export type { RowVariant }

export { rowContentColor, rowStyles, rowStylesOf }
