import type { ComponentRef, ReactNode, Ref, RefObject } from 'react'
import type {
  HostInstance,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
import type { DateFieldState } from 'react-stately/useDateFieldState'

import { useId, useRef, useState } from 'react'
import { Text, View } from 'react-native'

import type { SegmentsHandle } from '.'
import type { FieldVariant } from '../field'

import { DateSegments } from '.'
import { describedBy, FieldBox, FieldMessage, FieldSegments } from '../field'
import { useFieldValidation } from '../form'
import { messagesFor } from '../i18n'
import { useTheme } from '../theme/scope'
import { composeStyles } from '../theme/styles'
import { useTypeRole } from '../typography/roles'
import { segmentStylesOf } from './styles'

// The field a date or a time is typed into: src/field's box, label and line
// under it around the segments, with the value taking part in the Form
// around it. DateField and TimeField differ in the state they build, and
// both draw it through this, as web's two draw the same chrome around React
// Aria's DateInput. DatePicker draws it with the calendar's button in the
// trailing slot, and DateRangePicker with two dates on its line.
//
// **A range is two sets of segments with a separator between them**, the
// start's and the end's, each its own React Stately field and each named for
// its date before the label, "Start Date" and "End Date" in React Aria's
// words. Focus runs on from the start's last segment to the end's first, as
// a full segment or an arrow key moves it, and back from the end's first as
// a backspace does, as React Aria's picker moves it across both. The
// separator is decoration in the segments' muted role, hidden from a screen
// reader, which already hears which date each segment is part of.
//
// Focus moving from one date to the other is not focus leaving the field: a
// date's blur waits for the other's focus before the field draws itself
// blurred and tells the call site, as React Aria's picker hears focus leave
// the whole group. A field of one date has nothing to wait for, so its blur
// is the field's at once. A press on the box while either date has focus
// leaves focus where it is, rather than taking it back to the start's first
// segment.

// What the field keeps for its line: each date's segments, the timer a
// date's blur waits on, and whether it draws itself focused.
type FieldLineProps = SegmentedFieldProps & {
  readonly control: RefObject<null | SegmentsHandle>
  readonly endControl: RefObject<null | SegmentsHandle>
  readonly focused: boolean
  readonly leaving: RefObject<ReturnType<typeof setTimeout> | undefined>
  readonly setFocused: (focused: boolean) => void
}

type SegmentedFieldProps = {
  /** The box, which a picker measures to place its calendar under. */
  readonly box?: Ref<HostInstance>
  readonly description?: string
  /** A range's end, whose segments follow the separator. */
  readonly end?: DateFieldState
  /** The name a range's end is submitted under. */
  readonly endName?: string
  /** What the Form submits a range's end as, `''` while empty. */
  readonly endSubmitted?: string
  readonly error?: string
  /** What React Stately's validation of the value says, in its words. */
  readonly errors: readonly string[]
  readonly floatingLabel?: boolean
  /**
   * What the segments are read as holding, after their own names: the date
   * written out by default, a range picker's whole range where given.
   */
  readonly holding?: string
  readonly isDisabled: boolean
  /** Whether the value is what a required field must not be left as. */
  readonly isEmpty: boolean
  readonly isReadOnly: boolean
  readonly isRequired: boolean
  readonly label: string
  readonly leadingIcon?: ReactNode
  /** The locale the segments are written in, already resolved. */
  readonly locale: string
  readonly name?: string
  readonly onBlur?: () => void
  readonly onFocus?: () => void
  readonly ref?: Ref<ComponentRef<typeof View>>
  /** What is drawn between a range's two dates. */
  readonly separator?: string
  /** The field's state, or a range's start. */
  readonly state: DateFieldState
  readonly style?: StyleProp<ViewStyle>
  /** What the Form around the field submits the value as, `''` while empty. */
  readonly submitted: string
  readonly testID?: string
  readonly trailingIcon?: ReactNode
  readonly variant?: FieldVariant
}

// A date's segments arriving in focus: the field's focus where focus comes
// from outside it, and nothing new where it comes from the other date, whose
// leaving is then called off. The timer's id is kept until the next blur
// replaces it, since focus arrives nowhere else before one.
function arrivedOf({ leaving, onFocus, setFocused }: FieldLineProps) {
  return () => {
    if (leaving.current === undefined) {
      setFocused(true)
      onFocus?.()
    } else {
      clearTimeout(leaving.current)
    }
  }
}

// Moves focus back from the end's first segment to the start's last.
function backToStart({ control }: FieldLineProps) {
  return () => {
    control.current?.focusLast()
  }
}

// The field's box, label and line under it around its segments.
function FieldLine(line: FieldLineProps) {
  const {
    box,
    control,
    description,
    end,
    endControl,
    endName,
    endSubmitted = '',
    error,
    errors,
    floatingLabel = true,
    focused,
    holding,
    isDisabled,
    isEmpty,
    isReadOnly,
    isRequired,
    label,
    leadingIcon,
    locale,
    name,
    ref,
    separator,
    state,
    style,
    submitted,
    testID,
    trailingIcon,
    variant = 'filled',
  } = line
  const id = useId()
  const theme = useTheme()
  const own = segmentStylesOf(theme)
  const role = useTypeRole('bodyLarge')
  const words = messagesFor(locale).segments
  const validation = useFieldValidation({
    alongside: end === undefined ? undefined : [endName, endSubmitted],
    control,
    error,
    isDisabled,
    isEmpty,
    isReadOnly,
    isRequired,
    name,
    submitted,
    validate: () => errors,
    value: null,
  })
  const shownError = validation.error
  const described = describedBy(id, { description, error: shownError })
  const arrived = arrivedOf(line)
  const left = leftOf(line, validation.onBlur)

  return (
    <View
      aria-label={label}
      ref={ref}
      role="group"
      style={style}
      testID={testID}
    >
      <FieldBox
        control={focused ? undefined : control}
        floatingLabel={floatingLabel}
        isDisabled={isDisabled}
        isFocused={focused}
        isInvalid={shownError !== undefined}
        isPopulated
        isRequired={isRequired}
        label={label}
        leading={leadingIcon}
        ref={box}
        trailing={trailingIcon}
        variant={variant}
      >
        {end === undefined ? (
          <DateSegments
            described={described}
            holding={holding}
            isInvalid={shownError !== undefined}
            label={label}
            locale={locale}
            onBlur={left}
            onEdit={validation.onEdit}
            onFocus={arrived}
            ref={control}
            state={state}
          />
        ) : (
          <FieldSegments>
            <DateSegments
              described={described}
              holding={holding}
              isInvalid={shownError !== undefined}
              label={`${words.startDate}, ${label}`}
              locale={locale}
              onBlur={left}
              onEdit={validation.onEdit}
              onFocus={arrived}
              onPastEnd={onToEnd(line)}
              ref={control}
              state={state}
            />
            <Text
              aria-hidden
              style={composeStyles<TextStyle>(
                role,
                own.separator,
                isDisabled ? own.textDisabled : own.textMuted,
              )}
            >
              {separator}
            </Text>
            <DateSegments
              described={described}
              holding={holding}
              isInvalid={shownError !== undefined}
              label={`${words.endDate}, ${label}`}
              locale={locale}
              onBeforeStart={backToStart(line)}
              onBlur={left}
              onEdit={validation.onEdit}
              onFocus={arrived}
              ref={endControl}
              state={end}
            />
          </FieldSegments>
        )}
      </FieldBox>
      <FieldMessage description={description} error={shownError} id={id} />
    </View>
  )
}

// A date's segments losing focus: the validation's blur at once, as each of
// React Aria's date fields commits its own, and the field's blur once the
// other date has not taken focus, or at once where there is no other.
function leftOf(
  { end, leaving, onBlur, setFocused }: FieldLineProps,
  validationBlur: () => void,
) {
  const left = () => {
    leaving.current = undefined
    setFocused(false)
    onBlur?.()
  }

  return () => {
    validationBlur()

    if (end === undefined) {
      left()
    } else {
      leaving.current = setTimeout(left, 0)
    }
  }
}

// Moves focus on from the start's last segment to the end's first.
function onToEnd({ endControl }: FieldLineProps) {
  return () => {
    endControl.current?.focus()
  }
}

/**
 * A field of segments from React Stately's date field state, in the text
 * field's box: the label floated from the start, since the segments always
 * show, and the error what `error` says, else what `errors` says, in React
 * Stately's order and its words. Given an `end` it draws a range.
 */
function SegmentedField(props: SegmentedFieldProps) {
  const control = useRef<SegmentsHandle>(null)
  const endControl = useRef<SegmentsHandle>(null)
  const leaving = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [focused, setFocused] = useState(false)

  return (
    <FieldLine
      {...props}
      control={control}
      endControl={endControl}
      focused={focused}
      leaving={leaving}
      setFocused={setFocused}
    />
  )
}

export { SegmentedField }
export type { SegmentedFieldProps }
