import type { Ref } from 'react'
import type { TextStyle, ViewProps, ViewStyle } from 'react-native'

import { useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Text as NativeText,
  Platform,
  StyleSheet,
  View,
} from 'react-native'

import { useClipboardAvailable, writeClipboard } from '../../clipboard'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useFontFamily } from '../../typography/fonts'
import { useTypeRole } from '../../typography/roles'
import { Button } from '../button'

// No Material Design page draws a read-only value with a copy control, so it
// follows the outlined text field, as kanso-ui's CopyField does: the 1dp rule
// in the outline role, the surface behind it, and the control at its end. The
// value is body small beside a 32dp text button, so the box is shorter than
// the field's 56, which suits a value that is read rather than edited, and
// its corner is the shape scale's small step for the same reason. The box has
// no height of its own: it is the button's, or the value's once that is
// taller, so a larger OS text size grows it rather than running the value out
// of it.
//
// The copy goes through expo-clipboard, an optional peer. In an app without
// it the field shows the value and no button, since a button that could not
// copy would be one that lies about what it does.

// How long the confirmation stands before the button offers the copy again,
// as on web: long enough to be read without leaving the button lying about
// what it will do.
const COPIED_RESET_MS = 2000

// The two labels the button is as wide as: laid out at no height, and kept
// from a screen reader.
const RESERVE: ViewProps = {
  accessibilityElementsHidden: true,
  'aria-hidden': true,
  importantForAccessibility: 'no-hide-descendants',
}

// What a web-only atomic live region adds, so a confirmation is read whole.
// React Native's types carry no `aria-atomic`, which React Native Web takes.
const ATOMIC = { 'aria-atomic': true } as const

const styles = StyleSheet.create({
  // Under React Native Web the confirmation is said through a live region, as
  // web's `<output>` says it, which is drawn nowhere and still read.
  announcement: {
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    position: 'absolute',
    width: 1,
  },
  // The button stretches to the width the column takes, which is the wider of
  // the two labels below it, so a copy swaps the label rather than resizing
  // the button. The button sits at the end of the row, so a width that grew
  // on press would move it under the finger that had just pressed it.
  button: {
    alignSelf: 'stretch',
  },
  // Holds both labels for their width alone.
  reserve: {
    alignItems: 'center',
    height: 0,
    overflow: 'hidden',
  },
})

const stylesOf = themedStyles(({ colors, radii, spacing }) =>
  StyleSheet.create({
    // The button's own label padding at `xs`, so the reserve is exactly as
    // wide as the button drawing the wider label.
    reserve: {
      paddingHorizontal: spacing.md,
    },
    root: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.outline,
      borderRadius: radii.sm,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    // The column the value sits in, beside the button. `minWidth: 0` lets a
    // long unbroken value wrap rather than push the button out of the box.
    // The value keeps to the column's start, which is its left, or its right
    // in a right-to-left layout.
    value: {
      alignItems: 'flex-start',
      flex: 1,
      minWidth: 0,
    },
    // The value in the mono face at the body small role, where a `0` and an
    // `O`, an `l`, a `1` and an `I` have to be told apart, with ligatures off
    // so what shows is each character that is copied. It reads left to right
    // whatever the layout's direction, since it is a literal: a path, a flag
    // or a command whose leading `/`, `--` or `$` would otherwise move to the
    // other end. iOS and React Native Web take `writingDirection`; Android
    // takes the direction of the value's first letter, which is the value's
    // own. Under React Native Web one click selects the whole value, which is
    // what someone copying it by hand wants, and on iOS and Android a long
    // press offers the platform's own copy.
    valueText: {
      color: colors.onSurface,
      fontVariant: [
        'no-common-ligatures',
        'no-contextual',
        'no-discretionary-ligatures',
        'no-historical-ligatures',
      ],
      userSelect: 'all',
      writingDirection: 'ltr',
    },
  }),
)

type CopyFieldProps = Omit<ViewProps, 'children'> & {
  /**
   * What the button says once the value has been copied, and what is
   * announced. It reverts to `copyLabel` on its own after a couple of
   * seconds.
   * @default 'Copied'
   */
  readonly copiedLabel?: string
  /**
   * What the button says at rest.
   * @default 'Copy'
   */
  readonly copyLabel?: string
  /**
   * What the value is, such as "Repository URL" or "Access token", for a
   * screen with more than one field. It names the field as a group and joins
   * the button's name, so a screen reader hears "Copy Repository URL" rather
   * than one "Copy" after another; it is not shown. The value itself stays
   * out of the button's name, since a token would be read aloud. Left out,
   * the button is "Copy" alone.
   */
  readonly label?: string
  /**
   * Called with the value after it reaches the clipboard, never before.
   * Named as web's is, where the root's own `onCopy` is taken.
   */
  readonly onCopied?: (value: string) => void
  /**
   * Called with the error when the value did not reach the clipboard: under
   * React Native Web, where the browser refuses the write, and anywhere
   * expo-clipboard turns out not to be installed after a press. Nothing is
   * announced and the button keeps offering the copy, so this is for an app
   * that wants to say more, in a snackbar say.
   */
  readonly onCopyFailed?: (error: unknown) => void
  readonly ref?: Ref<View>
  /** The text shown, and the text copied. */
  readonly value: string
}

/**
 * A value to be read and taken away, such as a repository URL, a token or a
 * command. It shows the value in the mono face and copies it on request,
 * confirming on the button itself and to a screen reader.
 *
 * ```tsx
 * <CopyField label="Access token" value="first.second.third" />
 * ```
 *
 * The copy goes through expo-clipboard, which an app installs alongside the
 * library. Without it the field shows the value and no button.
 *
 * `style`, `ref` and `testID` land on the box.
 */
function CopyField({
  copiedLabel = 'Copied',
  copyLabel = 'Copy',
  label,
  onCopied,
  onCopyFailed,
  style,
  value,
  ...props
}: CopyFieldProps) {
  const theme = useTheme()
  const themed = stylesOf(theme)
  const bodySmall = useTypeRole('bodySmall')
  const labelLarge = useTypeRole('labelLarge')
  const mono = useFontFamily(theme.typography.fontFamilyMono)
  const available = useClipboardAvailable()
  const { confirmation, onPress } = useCopy({
    copiedLabel,
    onCopied,
    onCopyFailed,
    value,
  })
  const copied = confirmation !== undefined
  const shown = copied ? copiedLabel : copyLabel

  return (
    <View
      {...(label === undefined ? undefined : { 'aria-label': label })}
      role={label === undefined ? undefined : 'group'}
      {...props}
      style={composeStyles<ViewStyle>(themed.root, style)}
    >
      <View style={themed.value}>
        <NativeText
          style={composeStyles<TextStyle>(bodySmall, themed.valueText, {
            fontFamily: mono,
          })}
        >
          {value}
        </NativeText>
      </View>
      {available ? (
        <View>
          <Button
            aria-label={label === undefined ? undefined : `${shown} ${label}`}
            onPress={onPress}
            size="xs"
            style={styles.button}
            variant="text"
          >
            {shown}
          </Button>
          <View
            {...RESERVE}
            style={composeStyles<ViewStyle>(styles.reserve, themed.reserve)}
          >
            <NativeText style={labelLarge}>{copyLabel}</NativeText>
            <NativeText style={labelLarge}>{copiedLabel}</NativeText>
          </View>
        </View>
      ) : null}
      {Platform.OS === 'web' ? (
        <View aria-live="polite" {...ATOMIC} style={styles.announcement}>
          {copied ? (
            <NativeText key={confirmation}>{copiedLabel}</NativeText>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

/**
 * Hands the call site the value it copied. What its handler throws is raised
 * on its own, outside the copy, as a throw from a press handler is, so it
 * reaches the app's error reporting rather than rejecting a promise nothing
 * awaits, which React Native reports nowhere in a release build.
 */
function reportCopied(
  onCopied: ((value: string) => void) | undefined,
  value: string,
) {
  if (onCopied === undefined) {
    return
  }

  try {
    onCopied(value)
  } catch (thrown) {
    setTimeout(() => {
      throw thrown
    }, 0)
  }
}

/**
 * Copies the value on press and holds the confirmation for the dwell.
 * `confirmation` counts the copies while the button says Copied, and is
 * `undefined` otherwise.
 */
function useCopy({
  copiedLabel,
  onCopied,
  onCopyFailed,
  value,
}: {
  readonly copiedLabel: string
  readonly onCopied: ((value: string) => void) | undefined
  readonly onCopyFailed: ((error: unknown) => void) | undefined
  readonly value: string
}) {
  // What the last copy put on the clipboard, and how many copies there have
  // been. The confirmation is that text still being the value shown, so a
  // value that changes inside the dwell, a token regenerated say, takes the
  // label back to the copy at once rather than confirming a copy of something
  // else. The count gives each confirmation its own node in the live region,
  // so a second copy inside the dwell is said again.
  const [copy, setCopy] = useState<null | {
    readonly count: number
    readonly text: string
  }>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Without this, a field unmounted inside the dwell leaves a timer holding a
  // state update for a tree that is gone.
  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [],
  )

  // The field's own state first, the dwell and the announcement included, and
  // the call site's handler after it, so a handler that throws cannot leave
  // the button on Copied for good.
  const confirm = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setCopy(null)
    }, COPIED_RESET_MS)
    setCopy((current) => ({
      count: (current?.count ?? 0) + 1,
      text: value,
    }))

    // VoiceOver and TalkBack stay on the button, and a label changing under
    // them is not reliably read, so the confirmation is said outright. Under
    // React Native Web the field's live region says it.
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      AccessibilityInfo.announceForAccessibility(copiedLabel)
    }

    reportCopied(onCopied, value)
  }

  return {
    confirmation: copy?.text === value ? copy.count : undefined,
    onPress: () => {
      void writeClipboard(value).then(confirm, (error: unknown) => {
        onCopyFailed?.(error)
      })
    },
  }
}

export { CopyField }
export type { CopyFieldProps }
