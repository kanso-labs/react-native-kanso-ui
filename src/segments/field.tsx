import type { ComponentRef, ReactNode, Ref } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { DateFieldState } from 'react-stately/useDateFieldState'

import { useId, useRef, useState } from 'react'
import { View } from 'react-native'

import type { FieldVariant } from '../field'
import type { Focusable } from '../form'

import { DateSegments } from '.'
import { describedBy, FieldBox, FieldMessage } from '../field'
import { useFieldValidation } from '../form'

// The field a date or a time is typed into: src/field's box, label and line
// under it around the segments, with the value taking part in the Form
// around it. DateField and TimeField differ in the state they build, and
// both draw it through this, as web's two draw the same chrome around React
// Aria's DateInput.

type SegmentedFieldProps = {
  readonly description?: string
  readonly error?: string
  readonly floatingLabel?: boolean
  readonly isDisabled: boolean
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
  readonly state: DateFieldState
  readonly style?: StyleProp<ViewStyle>
  /** What the Form around the field submits the value as, `''` while empty. */
  readonly submitted: string
  readonly testID?: string
  readonly trailingIcon?: ReactNode
  readonly variant?: FieldVariant
}

// The field's own blur handling, then the call site's.
function blurThen(
  onBlur: () => void,
  setFocused: (focused: boolean) => void,
  then: (() => void) | undefined,
) {
  return () => {
    setFocused(false)
    onBlur()
    then?.()
  }
}

// Draws the box focused, then tells the call site.
function focusThen(
  setFocused: (focused: boolean) => void,
  then: (() => void) | undefined,
) {
  return () => {
    setFocused(true)
    then?.()
  }
}

/**
 * A field of segments from React Stately's date field state, in the text
 * field's box: the label floated from the start, since the segments always
 * show, and the error what `error` says, else what the state's own
 * validation says, in React Stately's order and its words.
 */
function SegmentedField({
  description,
  error,
  floatingLabel = true,
  isDisabled,
  isReadOnly,
  isRequired,
  label,
  leadingIcon,
  locale,
  name,
  onBlur,
  onFocus,
  ref,
  state,
  style,
  submitted,
  testID,
  trailingIcon,
  variant = 'filled',
}: SegmentedFieldProps) {
  const id = useId()
  const control = useRef<Focusable>(null)
  const [focused, setFocused] = useState(false)
  // What `validate` says, and failing that what the bounds and
  // `isDateUnavailable` say, in React Stately's order and its words.
  const { validationErrors } = state.realtimeValidation
  const validation = useFieldValidation({
    control,
    error,
    isDisabled,
    isEmpty: state.value === null,
    isReadOnly,
    isRequired,
    name,
    submitted,
    validate: () => validationErrors,
    value: state.value,
  })
  const shownError = validation.error

  return (
    <View
      aria-label={label}
      ref={ref}
      role="group"
      style={style}
      testID={testID}
    >
      <FieldBox
        control={control}
        floatingLabel={floatingLabel}
        isDisabled={isDisabled}
        isFocused={focused}
        isInvalid={shownError !== undefined}
        isPopulated
        isRequired={isRequired}
        label={label}
        leading={leadingIcon}
        trailing={trailingIcon}
        variant={variant}
      >
        <DateSegments
          described={describedBy(id, { description, error: shownError })}
          isInvalid={shownError !== undefined}
          label={label}
          locale={locale}
          onBlur={blurThen(validation.onBlur, setFocused, onBlur)}
          onEdit={validation.onEdit}
          onFocus={focusThen(setFocused, onFocus)}
          ref={control}
          state={state}
        />
      </FieldBox>
      <FieldMessage description={description} error={shownError} id={id} />
    </View>
  )
}

export { SegmentedField }
export type { SegmentedFieldProps }
