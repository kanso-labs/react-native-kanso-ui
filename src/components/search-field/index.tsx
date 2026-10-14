import type { ComponentRef, ReactNode, Ref, RefObject } from 'react'
import type {
  StyleProp,
  TextInput,
  TextInputKeyPressEvent,
  TextInputProps,
  TextInputSubmitEditingEvent,
  ViewStyle,
} from 'react-native'

import { useId, useImperativeHandle, useRef, useState } from 'react'
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'

import type { ValidationResult } from '../../form'
import type { IconStyle } from '../../glyphs/icon-style'

import {
  describedBy,
  FieldInput,
  FieldMessage,
  FieldStates,
  FieldStroke,
  useFieldFocus,
  useStrokeMotion,
} from '../../field'
import { useFieldValidation } from '../../form'
import { CloseGlyph, SearchGlyph } from '../../glyphs'
import { IconStyleContext } from '../../glyphs/icon-style'
import { usePressFeedback } from '../../press'
import { withOpacity } from '../../theme/color'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { IconButton } from '../icon-button'

// kanso-ui's SearchField: the search page's search bar on its own, rather
// than the box the other fields share. A pill on surface container high, the
// page's 24dp magnifier in on surface variant at the start, the value in body
// large on surface, and a clear button at the end while the field holds
// anything. The page's 16dp of padding is to a 48dp tap target and the icon
// sits 12dp inside that, so the magnifier starts 28dp in and the value 4dp
// past the target, at 68dp. The clear button is the medium icon button, 40dp
// around a 24dp icon, 4dp in from the padding, so its icon ends 28dp from the
// end. The bar follows its own width up to the page's 720dp; the page's 360dp
// floor is left to the call site, since a phone's width less its margins is
// under it.
//
// The bar is the large control height, 56dp, as web's is, and grows by as
// much as the value's line does at the device's text size.
//
// Under a pointer and while pressed, the bar draws the state layer every
// control draws through `usePressFeedback`, on surface at the hover and
// pressed opacities, and a press anywhere on it focuses the control, as a
// press anywhere on the other fields' boxes does. The page names a focused
// state and draws nothing for it, so the bar takes the 2dp primary ring the
// text fields page gives a focused field, inside the pill, as web's does. An
// error is the text fields page's too, which the search page does not name:
// the ring in the error role, 1dp at rest and 2dp once focused. The ring is a
// border on a view of its own over the bar rather than a shadow, so the
// colour and the width ease together and showing it moves nothing.
//
// **Disabled is the chrome's, translucent**, on surface at the disabled
// opacities over whatever the bar sits on, as the text field's box is, rather
// than mixed over the surface role as web's is.
//
// The label is the control's name and is never drawn, since the bar has no
// place for one: the placeholder is what a person reads.

type SearchBarProps = {
  /** The field's input, between the magnifier and the clear button. */
  readonly children: ReactNode
  readonly clearLabel: string
  /** The control a press on the bar, or on the clear button, focuses. */
  readonly control: RefObject<ComponentRef<typeof TextInput> | null>
  readonly isDisabled: boolean
  readonly isFocused: boolean
  readonly isInvalid: boolean
  readonly isRequired: boolean
  /** Empties the field, from the clear button. */
  readonly onClear: () => void
  /** Whether the field holds anything, which shows the clear button. */
  readonly showsClear: boolean
}

type SearchFieldProps = Omit<
  TextInputProps,
  | 'accessibilityHint'
  | 'accessibilityLabel'
  | 'aria-disabled'
  | 'aria-label'
  | 'children'
  | 'cursorColor'
  | 'defaultValue'
  | 'editable'
  | 'multiline'
  | 'numberOfLines'
  | 'onChange'
  | 'onChangeText'
  | 'placeholderTextColor'
  | 'readOnly'
  | 'returnKeyType'
  | 'role'
  | 'selectionColor'
  | 'style'
  | 'underlineColorAndroid'
  | 'value'
> & {
  /**
   * The name of the button that clears the field, for a screen reader.
   * Left out, it is "Clear search", the English name web's takes from React
   * Aria.
   */
  readonly clearLabel?: string
  /** The value the field opens with, when it keeps its own. */
  readonly defaultValue?: string
  /**
   * A hint shown under the bar. Replaced by `error` when there is one, so the
   * two never stack.
   */
  readonly description?: string
  /**
   * The problem with the current value, in words. Its presence is what puts
   * the field in its error state: the message, the ring in the error role,
   * and the invalid state a screen reader reads all follow from it. The line
   * under the bar arrives with the message, so the field grows when this
   * does, unless it is inside a `Form`, which keeps the line drawn. It wins
   * over what `validate` and the form say, and holds a `native` form back.
   */
  readonly error?: string
  /**
   * A ref to the field's own `TextInput`, which is what a call site moves
   * focus to. `ref` is the field as a whole.
   */
  readonly inputRef?: Ref<ComponentRef<typeof TextInput>>
  /**
   * Draws the field disabled: it takes no focus and no input, and its clear
   * button no press.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * Whether the field has to be filled in, which a screen reader reads.
   * Inside a `native` form, an empty one holds the submission back and shows
   * its error once a submission is tried. The bar draws no label, so there
   * is no asterisk to show it.
   * @default false
   */
  readonly isRequired?: boolean
  /**
   * What the field searches, for a screen reader. The bar draws no label, so
   * this is read and never shown; `placeholder` is what is seen.
   */
  readonly label: string
  /**
   * The name the value is submitted under by the `Form` around the field,
   * and the key its `validationErrors` reach the field by.
   */
  readonly name?: string
  /** Called with the new value as it is edited, and with `''` once cleared. */
  readonly onChange?: (value: string) => void
  /** Called once the field is emptied, from its clear button or Escape. */
  readonly onClear?: () => void
  /** Called with the value when the keyboard's search key submits it. */
  readonly onSubmit?: (value: string) => void
  /** The supporting text in the empty bar, which is what a person reads. */
  readonly placeholder?: string
  readonly ref?: Ref<ComponentRef<typeof View>>
  /** Positions and sizes the field as a whole. */
  readonly style?: StyleProp<ViewStyle>
  /**
   * Checks the value, and returns its problem in words, or several, where
   * there is one, and `true`, `null` or `undefined` where there is none.
   * Under the default `aria` validation the error shows as the value
   * changes; inside a `native` form it shows once a submission is tried, or
   * once the field loses focus after an edit, and holds the form back.
   */
  readonly validate?: (value: string) => ValidationResult
  /** The value, when the call site keeps it. */
  readonly value?: string
}

// The page's icon, which the magnifier is drawn at.
const ICON_SIZE = 24

// The widest the page draws a search bar.
const MAX_WIDTH = 720

// The clear button's name when the call site gives none, as React Aria names
// web's in English.
const CLEAR_LABEL = 'Clear search'

const stylesOf = themedStyles(({ colors, radii, spacing, stateLayerOpacity }) =>
  StyleSheet.create({
    bar: {
      alignItems: 'center',
      backgroundColor: colors.surfaceContainerHigh,
      borderRadius: radii.pill,
      flexDirection: 'row',
      gap: spacing.lg,
      maxWidth: MAX_WIDTH,
      paddingEnd: spacing.lg,
      paddingStart: spacing.lg + spacing.md,
    },
    barDisabled: {
      backgroundColor: withOpacity(
        colors.onSurface,
        stateLayerOpacity.disabledContainer,
      ),
    },
    // 4dp in from the padding, so the icon inside the 40dp button ends
    // 28dp from the end, where the page's 48dp target puts it.
    clear: {
      marginEnd: spacing.xs,
    },
    // The ring, over the whole bar and its corners. It takes no touches,
    // so a press lands on the bar under it.
    ring: {
      borderRadius: radii.pill,
      bottom: 0,
      left: 0,
      pointerEvents: 'none',
      position: 'absolute',
      right: 0,
      top: 0,
    },
  }),
)

// Empties the field: the value goes, and the call site is told twice over.
// The field's own blur handling, then the call site's.
function blurThen(
  onBlur: () => void,
  then: TextInputProps['onBlur'],
): TextInputProps['onBlur'] {
  return (event) => {
    onBlur()
    then?.(event)
  }
}

// Empties the field from its button, and hands focus back to the control, so
// the next keyword is typed straight in.
function clearFrom(
  onClear: () => void,
  control: RefObject<ComponentRef<typeof TextInput> | null>,
) {
  return () => {
    onClear()
    control.current?.focus()
  }
}

function clearInto(
  setOwn: (value: string) => void,
  onChange: ((value: string) => void) | undefined,
  onClear: (() => void) | undefined,
  onEdit: () => void,
) {
  return () => {
    setOwn('')
    onEdit()
    onChange?.('')
    onClear?.()
  }
}

// Keeps an edit as the field's own value and reports it, so a field the call
// site controls is told and one it does not still shows what was typed, and
// tells the field's validation it was edited.
function editInto(
  setOwn: (value: string) => void,
  onChange: ((value: string) => void) | undefined,
  onEdit: () => void,
) {
  return (text: string) => {
    setOwn(text)
    onEdit()
    onChange?.(text)
  }
}

function focusOf(control: RefObject<ComponentRef<typeof TextInput> | null>) {
  return () => {
    control.current?.focus()
  }
}

function iconStyleOf(color: string): IconStyle {
  return { color, size: ICON_SIZE }
}

// Escape empties a field that holds anything, from a hardware keyboard or
// under React Native Web, as it does web's. The call site's own handler is
// called after.
function keyInto(
  clear: (() => void) | undefined,
  onKeyPress: TextInputProps['onKeyPress'],
) {
  return (event: TextInputKeyPressEvent) => {
    if (clear !== undefined && event.nativeEvent.key === 'Escape') {
      clear()
    }
    onKeyPress?.(event)
  }
}

function minHeightOf(minHeight: number): ViewStyle {
  return { minHeight }
}

/**
 * The bar around the control: the pill with its state layer and ring, the
 * magnifier at the start and the clear button at the end. A press anywhere on
 * it focuses the control.
 */
function SearchBar({
  children,
  clearLabel,
  control,
  isDisabled,
  isFocused,
  isInvalid,
  isRequired,
  onClear,
  showsClear,
}: SearchBarProps) {
  const theme = useTheme()
  const styles = stylesOf(theme)
  const { fontScale } = useWindowDimensions()
  const { colors, radii, sizing, stateLayerOpacity, typography } = theme
  const feedback = usePressFeedback({
    color: colors.onSurface,
    corners: { borderRadius: radii.pill },
    disabled: isDisabled,
    disableRipple: true,
  })
  const ring = useStrokeMotion(
    isInvalid ? colors.error : colors.primary,
    isDisabled ? 0 : isFocused ? 2 : isInvalid ? 1 : 0,
  )

  return (
    <Pressable
      accessible={false}
      disabled={isDisabled}
      focusable={false}
      onHoverIn={feedback.handlers.onHoverIn}
      onHoverOut={feedback.handlers.onHoverOut}
      onPress={focusOf(control)}
      onPressIn={feedback.handlers.onPressIn}
      onPressOut={feedback.handlers.onPressOut}
      style={composeStyles<ViewStyle>(
        styles.bar,
        isDisabled ? styles.barDisabled : undefined,
        minHeightOf(
          sizing.controlLg + typography.bodyLargeLineHeight * (fontScale - 1),
        ),
      )}
    >
      {feedback.layer}
      <FieldStroke
        color={ring.color}
        sides="all"
        style={styles.ring}
        width={ring.width}
      />
      <IconStyleContext
        value={iconStyleOf(
          isDisabled
            ? withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)
            : colors.onSurfaceVariant,
        )}
      >
        <SearchGlyph />
      </IconStyleContext>
      <FieldStates
        isDisabled={isDisabled}
        isInvalid={isInvalid}
        isRequired={isRequired}
      >
        {children}
      </FieldStates>
      {showsClear ? (
        <IconButton
          aria-label={clearLabel}
          isDisabled={isDisabled}
          onPress={clearFrom(onClear, control)}
          style={styles.clear}
        >
          <CloseGlyph />
        </IconButton>
      ) : null}
    </Pressable>
  )
}

/**
 * A search bar: a keyword typed into a pill, submitted with the keyboard's
 * search key and cleared with its button. Pass `value` with `onChange` to
 * control it, or `defaultValue` to let it keep its own; `onSubmit` is handed
 * the value when the search key is pressed, and `onClear` is called when the
 * field is emptied.
 *
 * The bar is the search page's rather than the box the other fields share;
 * the control and the line under it are the field chrome in `src/field`.
 * React Native's own `TextInput` props reach the control; `style` and `ref`
 * are the field as a whole, and `inputRef` the control.
 *
 * ```tsx
 * <SearchField label="Label" placeholder="Supporting text" />
 * ```
 */
function SearchField({
  clearLabel = CLEAR_LABEL,
  defaultValue = '',
  description,
  error,
  inputRef,
  isDisabled = false,
  isRequired = false,
  label,
  name,
  onBlur,
  onChange,
  onClear,
  onFocus,
  onKeyPress,
  onSubmit,
  onSubmitEditing,
  ref,
  style,
  validate,
  value,
  ...props
}: SearchFieldProps) {
  const id = useId()
  const control = useRef<ComponentRef<typeof TextInput>>(null)
  const [own, setOwn] = useState(defaultValue)
  const current = value ?? own
  const validation = useFieldValidation({
    control,
    error,
    isDisabled,
    isEmpty: current === '',
    isReadOnly: false,
    isRequired,
    name,
    submitted: current,
    validate,
    value: current,
  })
  const focus = useFieldFocus({
    onBlur: blurThen(validation.onBlur, onBlur),
    onFocus,
  })
  const clear = clearInto(setOwn, onChange, onClear, validation.onEdit)
  const shownError = validation.error

  useImperativeHandle<
    ComponentRef<typeof TextInput> | null,
    ComponentRef<typeof TextInput> | null
  >(inputRef, () => control.current, [])

  return (
    <View ref={ref} style={style}>
      <SearchBar
        clearLabel={clearLabel}
        control={control}
        isDisabled={isDisabled}
        isFocused={focus.focused}
        isInvalid={shownError !== undefined}
        isRequired={isRequired}
        onClear={clear}
        showsClear={current !== ''}
      >
        <FieldInput
          {...props}
          {...focus.handlers}
          aria-label={label}
          described={describedBy(id, { description, error: shownError })}
          editable={!isDisabled}
          onChangeText={editInto(setOwn, onChange, validation.onEdit)}
          onKeyPress={keyInto(
            current === '' || isDisabled ? undefined : clear,
            onKeyPress,
          )}
          onSubmitEditing={submitInto(current, onSubmit, onSubmitEditing)}
          ref={control}
          returnKeyType="search"
          role="searchbox"
          value={current}
        />
      </SearchBar>
      <FieldMessage description={description} error={shownError} id={id} />
    </View>
  )
}

// Hands the value to `onSubmit` when the keyboard's search key is pressed,
// and the event to the call site's own handler after.
function submitInto(
  value: string,
  onSubmit: ((value: string) => void) | undefined,
  onSubmitEditing: TextInputProps['onSubmitEditing'],
) {
  return (event: TextInputSubmitEditingEvent) => {
    onSubmit?.(value)
    onSubmitEditing?.(event)
  }
}

export { SearchField }
export type { SearchFieldProps }
