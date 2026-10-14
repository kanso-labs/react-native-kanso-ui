import type { ReactNode } from 'react'
import type { TextStyle, ViewProps } from 'react-native'

import { Text as NativeText, Platform, View } from 'react-native'

import { useTheme } from '../theme/scope'
import { composeStyles } from '../theme/styles'
import { useTypeRole } from '../typography/roles'
import { controlStylesOf, LAYER_SIZE } from './styles'

type ControlLabelProps = {
  /** The label's text. Nothing renders when there is none. */
  readonly children?: ReactNode
  /**
   * Fades the label to the disabled content colour.
   * @default false
   */
  readonly isDisabled?: boolean
}

type ControlMessageProps = {
  /** The hint, which the error replaces while there is one. */
  readonly description?: string | undefined
  /** The problem with the control's value, in words. */
  readonly error?: string | undefined
  /** The id the control names the message by under React Native Web. */
  readonly id: string
}

/** How the control names the line under it to a screen reader. */
type DescribedBy = Pick<ViewProps, 'accessibilityHint'> & {
  readonly 'aria-describedby'?: string
}

// What hides the line under a control on iOS and Android, where the control
// reads it out as its hint.
const HIDDEN: ViewProps = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
}

/**
 * The label beside a selection control, set in body large. Renders nothing
 * without children, which is what a control labelled some other way, by
 * `aria-label` or a group's label, needs.
 */
function ControlLabel({ children, isDisabled = false }: ControlLabelProps) {
  const theme = useTheme()
  const own = controlStylesOf(theme)
  const role = useTypeRole('bodyLarge')

  if (children === undefined) {
    return null
  }

  return (
    <NativeText
      style={composeStyles<TextStyle>(
        role,
        own.label,
        isDisabled ? own.labelDisabled : undefined,
      )}
    >
      {children}
    </NativeText>
  )
}

/**
 * The line under a selection control's label: the error while there is one,
 * otherwise the description, so the two never stack. Renders nothing when
 * there is neither. Hand the control `describedBy(id, message)` with the same
 * `id`, so a screen reader reads the line with the control.
 */
function ControlMessage({ description, error, id }: ControlMessageProps) {
  const theme = useTheme()
  const own = controlStylesOf(theme)
  const role = useTypeRole('bodySmall')
  const message = messageOf(description, error)

  if (message === undefined) {
    return null
  }

  return (
    <View
      {...(Platform.OS === 'web' ? undefined : HIDDEN)}
      style={own.messages}
    >
      <NativeText
        id={id}
        style={composeStyles<TextStyle>(
          role,
          own.message,
          error === undefined ? undefined : own.messageError,
        )}
      >
        {message}
      </NativeText>
    </View>
  )
}

/**
 * How a control is described by the line under it, to spread onto the
 * control. On iOS and Android the message is the control's accessibility
 * hint, which VoiceOver and TalkBack read after its name and state, and
 * `ControlMessage` hides the line itself from them so it is not read twice.
 * React Native Web drops the hint, so there the control points at the line
 * with `aria-describedby`, as web's controls do.
 */
function describedBy(id: string, message: string | undefined): DescribedBy {
  return Platform.OS === 'web'
    ? { 'aria-describedby': message === undefined ? undefined : id }
    : { accessibilityHint: message }
}

/**
 * What the line under a control says: the error while there is one,
 * otherwise the description, and nothing for an empty string.
 */
function messageOf(description: string | undefined, error: string | undefined) {
  const message = error ?? description
  return message === '' ? undefined : message
}

export { ControlLabel, ControlMessage, describedBy, LAYER_SIZE, messageOf }
export type { ControlLabelProps, ControlMessageProps }
