import type { ComponentRef, ReactNode, Ref } from 'react'
import type { TextStyle, ViewProps, ViewStyle } from 'react-native'

import { use } from 'react'
import { Text as NativeText, View } from 'react-native'

import { BadgeInFlowContext } from '../../badge'
import { useLocaleOf } from '../../i18n/provider'
import { formatCount } from '../../number/count'
import { useTheme } from '../../theme/scope'
import { composeStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'
import { styles, stylesOf } from './styles'

// The badges page's badge, as kanso-ui's Badge draws it: a mark on the corner
// of an icon that flags something new there, either as the 6dp small badge
// or as the 16dp large badge holding a count. Both are the error pair, the
// error role with the count in on error, on a full corner, and the count is
// label small, capped with a plus, as "999+".
//
// The badge wraps what it is drawn on, usually an icon, and places the mark
// against that view's box, which is what the page measures from. The small
// badge fills the icon's top trailing 6dp square. The large badge's bottom
// leading corner sits 14dp down and 12dp in from the icon's top trailing
// corner, so it stands 2dp above the icon and grows toward the end as its
// count lengthens. Both are placed by `start` and `end`, so the mark stays on
// the trailing corner under right-to-left.
//
// Given nothing to wrap, the badge is the mark alone, standing in the line
// rather than over a corner. That is the form the tabs page draws after a
// label with no icon above it.
//
// The mark is hidden from a screen reader. A count read on its own is a
// number with no subject; it belongs in the name of the control it sits on,
// where a reader meets it with what it counts, "First item, 3 new".
//
// The count is set apart from the text before it by a space drawn out of the
// flow. Under React Native Web the count is still text inside the control,
// and with nothing between them a label and its count ran together as
// "Second item3", a word in no name: what axe's label-in-name check fails,
// and not what a speech-input user would say. Web draws the count as
// generated content instead, which a style here has no counterpart for.

type BadgeProps = Omit<ViewProps, 'children'> & {
  /**
   * What the badge is drawn on, usually an icon at 24dp. Left out, the badge
   * is the mark alone, standing in the line after what comes before it.
   */
  readonly children?: ReactNode
  /**
   * The number to show, which draws the page's large badge. Left out, the
   * badge is the small 6dp dot, which flags without counting. A count of 0
   * still draws, so leave the badge out when there is nothing to count.
   */
  readonly count?: number | undefined
  /**
   * The largest count drawn as itself. Above it the badge reads `max` and a
   * plus, which is the page's 999+ at the default.
   * @default 999
   */
  readonly max?: number
  readonly ref?: Ref<ComponentRef<typeof View>>
}

/**
 * A badge on the top trailing corner of what it wraps, usually an icon: the
 * small dot, or with `count` the large badge holding a number. The mark is
 * hidden from a screen reader, so put what it says in the name of the
 * control it sits on.
 *
 * ```tsx
 * <IconButton aria-label="Label, 3 new">
 *   <Badge count={3}>{icon}</Badge>
 * </IconButton>
 * ```
 *
 * Given no children, the mark stands alone in the line, as a tab draws it
 * after its label. The count is written in the digits of the
 * `I18nProvider`'s locale, or the device's outside one.
 *
 * `style`, `ref` and `testID` land on the view wrapping what the badge is
 * drawn on, and a `style` there applies over the badge's own. Like any view,
 * it stretches across a column it sits in on its own, which moves the mark
 * to the column's edge, so a call site placing one there sets `alignSelf`.
 */
function Badge({ children, count, max = 999, style, ...props }: BadgeProps) {
  const own = stylesOf(useTheme())
  const role = useTypeRole('labelSmall')
  const locale = useLocaleOf(undefined)
  const inFlow = use(BadgeInFlowContext)
  const label = count === undefined ? undefined : countOf(count, max, locale)
  const alone = children === undefined || children === null

  return (
    <View {...props} style={composeStyles<ViewStyle>(styles.anchor, style)}>
      {children}
      <View
        aria-hidden
        style={composeStyles<ViewStyle>(
          own.mark,
          label === undefined
            ? [styles.small, alone ? styles.alone : styles.smallOver]
            : [
                own.large,
                alone ? styles.alone : inFlow ? styles.inFlow : styles.over,
              ],
        )}
      >
        {label === undefined ? null : (
          <>
            <NativeText style={styles.space}> </NativeText>
            <NativeText style={composeStyles<TextStyle>(role, own.count)}>
              {label}
            </NativeText>
          </>
        )}
      </View>
    </View>
  )
}

// The count in the locale's digits and grouping, as web writes it in the
// provider's.
function countOf(count: number, max: number, locale: string) {
  return count > max
    ? `${formatCount(max, locale)}+`
    : formatCount(count, locale)
}

export type { BadgeProps }

export { Badge }
