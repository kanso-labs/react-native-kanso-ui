import type { ReactNode } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'

import { useMemo } from 'react'
import { Text as NativeText, View } from 'react-native'

import type { IconStyle } from '../glyphs/icon-style'
import type { ResolvedTheme } from '../theme/scope'
import type { RowVariant } from './styles'

import { IconStyleContext } from '../glyphs/icon-style'
import { useTheme } from '../theme/scope'
import { composeStyles } from '../theme/styles'
import { nativeWeight, useTypeRole } from '../typography/roles'
import { rowContentColor, rowStyles, rowStylesOf } from './styles'

// The size an icon in either slot is drawn at, the lists and menus pages'.
const ICON_SIZE = 24

// The style of each variant's selected container.
const SELECTED_CONTAINER = {
  drawer: 'selectedDrawer',
  list: 'selectedList',
  menu: 'selectedMenu',
} as const satisfies Record<RowVariant, string>

type RowContentProps = {
  /** The row's headline, the one thing it is mostly about. */
  readonly children?: ReactNode
  /**
   * Whether the row is disabled. Its headline, slots and lines take the
   * faded on-surface colour, the supporting line included.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * Whether the headline is drawn in the bold weight rather than its role's
   * own, for a row marked without the container a selected one takes. The
   * navigation drawer's trail to the current row is what asks for it.
   * @default false
   */
  readonly isEmphasized?: boolean
  /**
   * Whether the row is selected. Its headline, slots and lines take the
   * selected container's own on-colour, since the muted role is not
   * guaranteed to be readable over it.
   * @default false
   */
  readonly isSelected?: boolean
  /** Content before the headline: an avatar, an icon, a checkbox. */
  readonly leading?: ReactNode
  /** A line above the headline, in label small and the muted role. */
  readonly overline?: ReactNode
  /** A second line under the headline, in body medium and the muted role. */
  readonly supporting?: ReactNode
  /** Content after the headline, such as an amount or a control. */
  readonly trailing?: ReactNode
  /**
   * Which spec page's row this is. A list item's headline is body large, and
   * a menu item's and a navigation drawer row's label large.
   * @default 'list'
   */
  readonly variant?: RowVariant
}

/** Whether a slot was given something to draw. */
function hasContent(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== false && node !== ''
}

/**
 * The inside of a row: the leading slot, the headline with the lines beside
 * it, and the trailing slot, each drawn only when given. The view around it
 * is the caller's, ListItem's or a menu's item, and takes `rowStyleOf`; this
 * is what each of them puts inside it, so a list and a menu draw the same
 * row. Both slots hand an icon the row's content colour at 24dp, through
 * `useIconStyle()`. Not a component of the library's own and not exported.
 */
function RowContent({
  children,
  isDisabled = false,
  isEmphasized = false,
  isSelected = false,
  leading,
  overline,
  supporting,
  trailing,
  variant = 'list',
}: RowContentProps) {
  const theme = useTheme()
  const own = rowStylesOf(theme)
  const headlineRole = useTypeRole(
    variant === 'list' ? 'bodyLarge' : 'labelLarge',
  )
  const overlineRole = useTypeRole('labelSmall')
  const supportingRole = useTypeRole('bodyMedium')
  const color = rowContentColor(theme, { isDisabled, isSelected, variant })
  const icons = useMemo<IconStyle>(() => ({ color, size: ICON_SIZE }), [color])
  // The muted role on the surface; the row's own colour over a selected
  // container, and on a disabled row, which fades the lines with the rest.
  const tone = isDisabled || isSelected ? { color } : own.muted

  return (
    <IconStyleContext value={icons}>
      {hasContent(leading) ? (
        <View style={rowStyles.slot}>{leading}</View>
      ) : null}
      <View style={own.main}>
        {hasContent(overline) ? (
          <NativeText style={composeStyles<TextStyle>(overlineRole, tone)}>
            {overline}
          </NativeText>
        ) : null}
        <NativeText
          style={composeStyles<TextStyle>(
            headlineRole,
            { color },
            isEmphasized
              ? { fontWeight: nativeWeight(theme.typography.weightBold) }
              : undefined,
          )}
        >
          {children}
        </NativeText>
        {hasContent(supporting) ? (
          <NativeText style={composeStyles<TextStyle>(supportingRole, tone)}>
            {supporting}
          </NativeText>
        ) : null}
      </View>
      {hasContent(trailing) ? (
        <View style={rowStyles.slot}>{trailing}</View>
      ) : null}
    </IconStyleContext>
  )
}

/**
 * The style of the view around a row's content: the padding and gap, the
 * variant's height, the taller item its lines make it, and the selected
 * container. Which of the lists page's three items a row is comes from its
 * content rather than a prop, so a row holding all three lines already says
 * it is the three-line item. A line that wraps grows the shorter item and
 * keeps its slots centred.
 */
function rowStyleOf(
  theme: ResolvedTheme,
  {
    isSelected = false,
    overline,
    supporting,
    variant = 'list',
  }: Pick<
    RowContentProps,
    'isSelected' | 'overline' | 'supporting' | 'variant'
  >,
): StyleProp<ViewStyle> {
  const own = rowStylesOf(theme)
  const lines =
    (hasContent(overline) ? 1 : 0) + (hasContent(supporting) ? 1 : 0)

  return composeStyles<ViewStyle>(
    own.base,
    own[variant],
    lines === 1 ? own.twoLine : undefined,
    lines === 2 ? own.threeLine : undefined,
    isSelected ? own[SELECTED_CONTAINER[variant]] : undefined,
  )
}

export type { RowContentProps, RowVariant }

export { hasContent, RowContent, rowContentColor, rowStyleOf, rowStyles }
