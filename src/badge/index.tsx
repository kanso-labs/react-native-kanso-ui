import type { ReactNode } from 'react'
import type { TextStyle, ViewStyle } from 'react-native'

import { Text as NativeText, View } from 'react-native'

import { useLocaleOf } from '../i18n/provider'
import { formatCount } from '../number/count'
import { useTheme } from '../theme/scope'
import { composeStyles } from '../theme/styles'
import { useTypeRole } from '../typography/roles'
import { styles, stylesOf } from './styles'

// The badges page's badge, as kanso-ui's Badge draws it on a navigation
// destination: a mark on the corner of an icon that flags something new
// there, either as the 6dp small badge or as the 16dp large badge holding a
// count. Both are the error pair, the error role with the count in on error,
// on a full corner, and the count is label small, capped with a plus, as
// "999+".
//
// The badge wraps the icon and places the mark against the icon's box,
// which is what the page measures from. The small badge fills the icon's top
// trailing 6dp square. The large badge's bottom leading corner sits 14dp
// down and 12dp in from the icon's top trailing corner, so it stands 2dp
// above the icon and grows toward the end as its count lengthens. Both are
// placed by `start` and `end`, so the mark stays on the trailing corner under
// right-to-left.
//
// Where a label stands beside the icon rather than under it, the large badge
// joins the flow after the icon instead, so the label starts after it rather
// than under it: `inFlow`. The small badge stays inside the icon's box, so
// nothing has to make room for it.
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

type BadgeProps = {
  /** What the badge is drawn on: an icon, at 24dp. */
  readonly children?: ReactNode
  /**
   * The number to show, which draws the large badge. Left out, the badge is
   * the small dot, which flags without counting.
   */
  readonly count?: number | undefined
  /**
   * Draws the large badge in the flow after the icon rather than over its
   * corner, for a label beside the icon.
   * @default false
   */
  readonly inFlow?: boolean
  /**
   * The largest count drawn as itself. Above it the badge reads `max` and a
   * plus, which is the page's 999+ at the default.
   * @default 999
   */
  readonly max?: number
}

/**
 * A badge on the top trailing corner of the icon it wraps: the small dot, or
 * with `count` the large badge holding the number.
 */
function Badge({ children, count, inFlow = false, max = 999 }: BadgeProps) {
  const own = stylesOf(useTheme())
  const role = useTypeRole('labelSmall')
  const locale = useLocaleOf(undefined)
  const label = count === undefined ? undefined : countOf(count, max, locale)

  return (
    <View style={styles.anchor}>
      {children}
      <View
        aria-hidden
        style={composeStyles<ViewStyle>(
          own.mark,
          label === undefined
            ? styles.small
            : [own.large, inFlow ? styles.inFlow : styles.over],
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
