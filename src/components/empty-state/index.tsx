import type { ComponentRef, ReactNode, Ref } from 'react'
import type { StyleProp, TextStyle, ViewProps, ViewStyle } from 'react-native'

import { StyleSheet, View } from 'react-native'

import type { IconStyle } from '../../glyphs/icon-style'

import { CheckGlyph } from '../../glyphs'
import { IconStyleContext } from '../../glyphs/icon-style'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { Button } from '../button'
import { Text } from '../text'

// What a screen, a list or a section draws when it has nothing to show, in
// one of four layouts. No Material Design page draws an empty state, so the
// layouts are kanso's own, built from the page's parts: a mark in a filled
// circle, a title in title large, a line in body medium on
// on-surface-variant, and one common button.
//
// - **`first`**, a module or a list with nothing in it yet: a 64dp mark at
//   the full corner in the primary container, its glyph at 32dp in on
//   primary container; the title; the line, at most 280dp wide; and one
//   filled button. 16dp from the mark to the title, 8dp to the line and 24dp
//   to the button. It starts 40dp under what is above it and is centred
//   across, never down the screen's height, so it reads as the top of the
//   screen rather than floating in its middle.
// - **`first` at `size="inline"`**, a section with nothing in it yet: a 40dp
//   mark with a 20dp glyph and the line alone, in the lists page's 72dp row.
// - **`done`**, a list some things were in and none are left: a 24dp check
//   in the primary role and the line, in the lists page's 56dp row, lined up
//   where the rows were. No title and no button: nothing is wrong.
// - **`status`**, a screen that cannot show what it was opened for: the first
//   layout with a neutral mark, on surface container highest with its glyph
//   in on-surface-variant, and an outlined button, since what it offers is a
//   way round rather than the screen's main action.
//
// **The title is a heading with no level.** Web sets it at `headingLevel`;
// React Native's screen readers have no heading levels, so the prop is
// dropped, as AppBar and Disclosure drop it. The 280dp measure is a
// literal: it bounds a line of reading rather than measuring anything a
// theme resizes.

const MEASURE = 280

// The marks' sides and their glyphs', by layout: 64dp and 32dp for a screen,
// 40dp and 20dp inline. The 64dp mark falls between steps of the sizing
// scale and is written out.
const MARK = 64
const MARK_GLYPH = 32
const INLINE_GLYPH = 20
const CHECK = 24

type EmptyStateAction = {
  /** Where the button leads, through the app's router. */
  readonly href?: string
  /** What the button says. */
  readonly label: string
  /** Run when the button is pressed. */
  readonly onPress?: () => void
}

type EmptyStateKind = 'done' | 'first' | 'status'

type EmptyStateProps = Omit<ViewProps, 'children' | 'style'> & {
  /**
   * The one button of `first` and `status`: filled for `first`, outlined
   * for `status`. `done` and an inline state draw none.
   */
  readonly action?: EmptyStateAction
  /** The line saying what is empty, or what can be done about it. */
  readonly description?: ReactNode
  /**
   * The glyph in the mark of `first` and `status`, which takes the mark's
   * colour and size through `useIconStyle()`. `done` draws a check of its
   * own.
   */
  readonly icon?: ReactNode
  /**
   * `first`, nothing there yet; `done`, nothing left; `status`, what was
   * opened cannot be shown.
   * @default 'first'
   */
  readonly kind?: EmptyStateKind
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * `inline` draws `first` as a 72dp row for a section, with a 40dp mark
   * and the line alone. The other kinds keep their own layouts.
   * @default 'default'
   */
  readonly size?: EmptyStateSize
  readonly style?: StyleProp<ViewStyle>
  /** The title of `first` and `status`, a heading for a screen reader. */
  readonly title?: ReactNode
}

type EmptyStateSize = 'default' | 'inline'

const styles = StyleSheet.create({
  centred: {
    textAlign: 'center',
  },
  // The line beside an inline mark or a check, taking the room left.
  rowLine: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
})

const stylesOf = themedStyles(({ colors, radii, sizing, spacing }) =>
  StyleSheet.create({
    action: {
      marginTop: spacing.xl,
    },
    // The screen layouts: centred across, 40dp under what is above.
    block: {
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xxxl,
    },
    inlineMark: {
      alignItems: 'center',
      backgroundColor: colors.primaryContainer,
      borderRadius: radii.pill,
      height: sizing.controlSm,
      justifyContent: 'center',
      width: sizing.controlSm,
    },
    line: {
      maxWidth: MEASURE,
    },
    lineUnderTitle: {
      marginTop: spacing.sm,
    },
    mark: {
      alignItems: 'center',
      borderRadius: radii.pill,
      height: MARK,
      justifyContent: 'center',
      marginBottom: spacing.lg,
      width: MARK,
    },
    markFirst: {
      backgroundColor: colors.primaryContainer,
    },
    markStatus: {
      backgroundColor: colors.surfaceContainerHighest,
    },
    // The lists page's row: 16dp inline and 12dp block padding, 16dp
    // between the mark and the line.
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    rowMd: {
      minHeight: sizing.rowMd,
    },
    rowSm: {
      minHeight: sizing.rowSm,
    },
  }),
)

// The one button, filled or outlined, as a link where it has somewhere to
// go.
function ActionButton({
  action,
  variant,
}: {
  readonly action: EmptyStateAction
  readonly variant: 'filled' | 'outlined'
}) {
  return action.href === undefined ? (
    <Button onPress={action.onPress} variant={variant}>
      {action.label}
    </Button>
  ) : (
    <Button href={action.href} onPress={action.onPress} variant={variant}>
      {action.label}
    </Button>
  )
}

/**
 * What a screen, a list or a section draws when it has nothing to show.
 *
 * ```tsx
 * <EmptyState
 *   action={{ label: 'Label', onPress: add }}
 *   description="Supporting line"
 *   icon={<Icon />}
 *   title="Headline"
 * />
 * ```
 *
 * `kind="first"` is a screen with nothing in it yet, `size="inline"` the
 * same for a section, `kind="done"` a list emptied, and `kind="status"` a
 * screen that cannot show what it was opened for. Draw it where the content
 * would be, under the screen's bar. `style`, `ref` and `testID` land on its
 * own view.
 */
function EmptyState({
  action,
  description,
  icon,
  kind = 'first',
  size = 'default',
  style,
  title,
  ...props
}: EmptyStateProps) {
  const theme = useTheme()
  const own = stylesOf(theme)
  const { colors } = theme

  if (kind === 'done') {
    return (
      <View
        {...props}
        style={composeStyles<ViewStyle>(own.row, own.rowSm, style)}
      >
        <CheckGlyph color={colors.primary} size={CHECK} />
        <Line style={styles.rowLine}>{description}</Line>
      </View>
    )
  }

  if (kind === 'first' && size === 'inline') {
    return (
      <View
        {...props}
        style={composeStyles<ViewStyle>(own.row, own.rowMd, style)}
      >
        {icon === undefined ? null : (
          <View style={own.inlineMark}>
            <IconStyleContext
              value={iconStyleOf(colors.onPrimaryContainer, INLINE_GLYPH)}
            >
              {icon}
            </IconStyleContext>
          </View>
        )}
        <Line style={styles.rowLine}>{description}</Line>
      </View>
    )
  }

  const status = kind === 'status'

  return (
    <View {...props} style={composeStyles<ViewStyle>(own.block, style)}>
      {icon === undefined ? null : (
        <View
          style={composeStyles<ViewStyle>(
            own.mark,
            status ? own.markStatus : own.markFirst,
          )}
        >
          <IconStyleContext
            value={iconStyleOf(
              status ? colors.onSurfaceVariant : colors.onPrimaryContainer,
              MARK_GLYPH,
            )}
          >
            {icon}
          </IconStyleContext>
        </View>
      )}
      {title === undefined ? null : (
        <Text role="heading" style={styles.centred} variant="titleLarge">
          {title}
        </Text>
      )}
      {description === undefined ? null : (
        <Line
          style={composeStyles<TextStyle>(
            styles.centred,
            own.line,
            title === undefined ? undefined : own.lineUnderTitle,
          )}
        >
          {description}
        </Line>
      )}
      {action === undefined ? null : (
        <View style={own.action}>
          <ActionButton
            action={action}
            variant={status ? 'outlined' : 'filled'}
          />
        </View>
      )}
    </View>
  )
}

// Built by a call rather than written inline at the prop, which is what
// react-perf's jsx-no-new-object-as-prop is after.
function iconStyleOf(color: string, size: number): IconStyle {
  return { color, size }
}

// The line, in body medium on on-surface-variant.
function Line({
  children,
  style,
}: {
  readonly children: ReactNode
  readonly style?: StyleProp<TextStyle>
}) {
  return (
    <Text style={style} tone="muted" variant="bodyMedium">
      {children}
    </Text>
  )
}

export { EmptyState }
export type {
  EmptyStateAction,
  EmptyStateKind,
  EmptyStateProps,
  EmptyStateSize,
}
