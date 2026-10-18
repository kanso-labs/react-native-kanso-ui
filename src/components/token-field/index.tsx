import type { ComponentRef, ReactNode, Ref, RefObject } from 'react'
import type {
  AccessibilityActionEvent,
  StyleProp,
  TextInput,
  TextInputProps,
  TextStyle,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type {
  TokenFieldSegment,
  TokenFieldState,
  TokenFieldValue,
  TokenSegment,
} from 'react-stately'

import { useId, useImperativeHandle, useRef, useState } from 'react'
import {
  Text as NativeText,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { useTokenFieldState } from 'react-stately'

import type { FieldVariant } from '../../field'

import { AnimatedPressable, toggleState } from '../../button'
import {
  ChipLabel,
  measureThen,
  paintOf,
  targetOf,
  useEasedColors,
} from '../../chip'
import { stylesOf } from '../../chip/styles'
import {
  describedBy,
  FieldBox,
  FieldInput,
  FieldMessage,
  FieldWrap,
  useFieldFocus,
} from '../../field'
import { useLocaleOf, useMessages } from '../../i18n/provider'
import { TARGET_SIZE, usePressFeedback } from '../../press'
import { withOpacity } from '../../theme/color'
import { useTheme } from '../../theme/scope'
import { composeStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// kanso-ui's TokenField: the chips page's input chips inside a text field, a
// field whose value is text with pills in it, such as a tag input, a mention
// field or a structured search box. The box, label, supporting line and error
// are the field chrome in src/field, shared with every other field, and the
// pill is src/chip's, shared with Chip and ChipGroup's chip, as on web.
//
// The value is React Stately's `TokenFieldValue`, a list of text and token
// segments rather than a string, and the field does not wrap it. What counts
// as a token is the call site's to decide, by subclassing it and overriding
// `tokenize`, which the package re-exports for that, as web's does.
//
// **What is typed goes into a text input after the last pill**, since a
// TextInput holds no views, where web's editable area is a contenteditable
// element holding both. The pills and any text before the last of them are
// drawn in a row that wraps, the text with the spaces at its ends given to the
// row's gaps, and the control holds what follows the last pill, which each
// edit hands to `tokenize` together. So a token is made where it is typed, at
// the end, and text before the last pill is shown and kept rather than edited
// in place: it comes back into the control once the pills after it are
// removed.
//
// **Backspace takes a pill out in two presses.** In an empty control the
// first selects the pill before it, and the second removes it. A press on a
// pill selects it, or lets it go if it was selected, and moves focus to the
// control, so Backspace there takes it out next. Typing, or leaving the
// field, lets the selection go. A selected pill is the selected input chip,
// on the secondary container pair, with no check, as web draws it.
//
// **Each pill is one element to a screen reader**, named by its text whatever
// `renderToken` draws in it, and a toggle reporting whether it is selected, as
// a filter chip reports its state. VoiceOver and TalkBack offer it a remove
// action named in the provider's locale, which takes a pill out without a
// keyboard. Read-only, a pill is its text and nothing to press.
//
// The control keeps three characters' width at the least after the last pill,
// starting a line of its own when the line has less left, and scrolls what is
// typed past its width, as any one-line field does.

/** What the field's parts do to its value and its selected pill. */
type Editor = {
  /** Takes what the control holds, after the last pill, as typed. */
  readonly edit: (text: string) => void
  /** Takes the token at a segment's index out of the value. */
  readonly remove: (index: number) => void
  /** Selects the pill at a segment's index, or none. */
  readonly select: (index: null | number) => void
}

type TokenFieldProps<T extends TokenFieldValue = TokenFieldValue> = Omit<
  TextInputProps,
  | 'accessibilityHint'
  | 'accessibilityLabel'
  | 'aria-disabled'
  | 'aria-label'
  | 'children'
  | 'cursorColor'
  | 'defaultValue'
  | 'editable'
  | 'maxLength'
  | 'multiline'
  | 'numberOfLines'
  | 'onChange'
  | 'onChangeText'
  | 'placeholder'
  | 'placeholderTextColor'
  | 'readOnly'
  | 'rows'
  | 'selectionColor'
  | 'style'
  | 'underlineColorAndroid'
  | 'value'
> & {
  /** The value the field opens with, when it keeps its own. */
  readonly defaultValue?: T
  /**
   * A hint shown under the field. Replaced by `error` when there is one, so
   * the two never stack.
   */
  readonly description?: string
  /**
   * The problem with the current value, in words. Its presence is what puts
   * the field in its error state: the message, the error colours, and the
   * invalid state a screen reader reads all follow from it. The line under
   * the field arrives with the message, so the field grows when this does,
   * unless it is inside a `Form`, which keeps the line drawn.
   */
  readonly error?: string
  /**
   * Whether the label sits in the empty box and floats to the top once the
   * field is focused or holds something. `false` keeps it small at the top in
   * every state.
   * @default true
   */
  readonly floatingLabel?: boolean
  /**
   * A ref to the field's own `TextInput`, which is what a call site moves
   * focus to. `ref` is the field as a whole.
   */
  readonly inputRef?: Ref<ComponentRef<typeof TextInput>>
  /**
   * Draws the field disabled: it takes no focus and no input, and its pills
   * take no presses.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * Shows the value and takes focus, but takes no input, and its pills are
   * neither selected nor removed.
   * @default false
   */
  readonly isReadOnly?: boolean
  /**
   * What the field is for, and the name a screen reader reads for it.
   * Required, since a field with no label is a box nobody can name.
   */
  readonly label: string
  /**
   * An icon at the start of the box, before the label and the value: the
   * page's 24dp leading icon, in the muted role. The slot hands it that
   * colour and size through `useIconStyle()`.
   */
  readonly leadingIcon?: ReactNode
  /** Called with the new value as it is edited. */
  readonly onChange?: (value: T) => void
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * What each token holds. Given a segment, return what to draw inside its
   * pill; without it the pill holds the segment's own text, which is what a
   * screen reader reads either way.
   */
  readonly renderToken?: (segment: TokenSegment) => ReactNode
  /** Positions and sizes the field as a whole. */
  readonly style?: StyleProp<ViewStyle>
  /**
   * An icon at the end of the box, after the value: the page's 24dp trailing
   * icon, in the muted role and the error role while the field has an
   * error. The slot hands it that colour and size through `useIconStyle()`.
   */
  readonly trailingIcon?: ReactNode
  /** The value, when the call site keeps it. Pass it with `onChange`. */
  readonly value?: T
  /**
   * The filled box, or the outlined one, as the text fields page draws them.
   * @default 'filled'
   */
  readonly variant?: FieldVariant
}

// How many characters' width the control keeps after the last pill, in its
// own type's size.
const CONTROL_ROOM = 3

const styles = StyleSheet.create({
  // Takes what the line has left after the pills, from nothing: a basis of
  // its own would start a new line while the line still had room to type in.
  control: {
    flexBasis: 0,
    flexGrow: 1,
  },
  // Text before the last pill gives way to the line it is on, and wraps
  // within it, rather than running out of the box.
  text: {
    flexShrink: 1,
  },
})

/**
 * Backspace in an empty control: removes the selected pill where there is
 * one, and selects the last otherwise. With no pill, `last` is -1, which no
 * token holds, so it selects nothing. The call site's own handler runs after.
 */
function backspaceThen(
  editor: Editor,
  {
    editable,
    last,
    selected,
    trailing,
  }: {
    readonly editable: boolean
    readonly last: number
    readonly selected: null | number
    readonly trailing: string
  },
  then: TextInputProps['onKeyPress'],
): TextInputProps['onKeyPress'] {
  return (event) => {
    if (editable && event.nativeEvent.key === 'Backspace' && trailing === '') {
      if (selected !== null) {
        editor.remove(selected)
      } else {
        editor.select(last)
      }
    }
    then?.(event)
  }
}

// The field's own blur handling, then the call site's.
function blurThen(
  editor: Editor,
  then: TextInputProps['onBlur'],
): TextInputProps['onBlur'] {
  return (event) => {
    editor.select(null)
    then?.(event)
  }
}

function colorOf(color: string): TextStyle {
  return { color }
}

function editorOf<T extends TokenFieldValue>(
  state: TokenFieldState<T>,
  setSelected: (index: null | number) => void,
): Editor {
  return {
    edit: (text) => {
      setSelected(null)
      state.setValue(withTrailing(state.value, text))
    },
    remove: (index) => {
      setSelected(null)
      state.setValue(withoutToken(state.value, index))
    },
    select: setSelected,
  }
}

// Whether the field holds anything, for the floating label: a token, or text
// of any length.
function isPopulated(segments: readonly TokenFieldSegment[]) {
  return segments.some((segment) => segment.text.length > 0)
}

// The index of the last token among the segments, or -1 where there is none.
function lastTokenOf(segments: readonly TokenFieldSegment[]) {
  return segments.findLastIndex((segment) => segment.type === 'token')
}

function minWidthOf(minWidth: number): ViewStyle {
  return { minWidth }
}

// What a screen reader is offered on a pill: an action that removes it.
function removeActionsOf(label: string, onRemove: () => void) {
  return {
    accessibilityActions: [{ label, name: 'remove' }],
    onAccessibilityAction: (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'remove') {
        onRemove()
      }
    },
  }
}

function removeOf(editor: Editor, index: number) {
  return () => {
    editor.remove(index)
  }
}

// A press on a pill: selects it, or lets it go if it was selected, and moves
// focus to the control, where Backspace removes a selected pill.
function toggleOf(
  editor: Editor,
  index: number,
  selected: boolean,
  control: RefObject<ComponentRef<typeof TextInput> | null>,
) {
  return () => {
    editor.select(selected ? null : index)
    control.current?.focus()
  }
}

/**
 * A labelled field whose value is text with tokens in it, drawn as pills: a
 * tag input, a mention field, a structured search box. Its value is React
 * Stately's `TokenFieldValue`, which the package re-exports: pass `value` with
 * `onChange` to control it, or `defaultValue` to let it keep its own.
 *
 * ```tsx
 * const [value, setValue] = useState(new TokenFieldValue([]))
 *
 * <TokenField label="Label" onChange={setValue} value={value} />
 * ```
 *
 * What counts as a token is the call site's: subclass `TokenFieldValue` and
 * override `tokenize`, which is handed what is typed after the last pill.
 * `renderToken` decides what each pill holds; without it, the segment's own
 * text.
 *
 * React Native's own `TextInput` props reach the control; `style` and `ref`
 * are the field as a whole, and `inputRef` the control.
 */
function TokenField<T extends TokenFieldValue = TokenFieldValue>({
  defaultValue,
  description,
  error,
  floatingLabel = true,
  inputRef,
  isDisabled = false,
  isReadOnly = false,
  label,
  leadingIcon,
  onBlur,
  onChange,
  onFocus,
  onKeyPress,
  ref,
  renderToken,
  style,
  trailingIcon,
  value,
  variant = 'filled',
  ...props
}: TokenFieldProps<T>) {
  const id = useId()
  const theme = useTheme()
  const { fontScale } = useWindowDimensions()
  const control = useRef<ComponentRef<typeof TextInput>>(null)
  const state = useTokenFieldState<T>({ defaultValue, onChange, value })
  const [selected, setSelected] = useState<null | number>(null)
  const editor = editorOf(state, setSelected)
  const focus = useFieldFocus({ onBlur: blurThen(editor, onBlur), onFocus })
  const locale = useLocaleOf(undefined)
  const messages = useMessages()
  const editable = !isDisabled && !isReadOnly
  const { segments } = state.value
  const last = lastTokenOf(segments)
  const trailing = segments
    .slice(last + 1)
    .map((segment) => segment.text)
    .join('')
  // A selection the value has moved out from under, by an edit the call site
  // made, selects nothing.
  const chosen =
    selected !== null && segments[selected]?.type === 'token' ? selected : null

  useImperativeHandle<
    ComponentRef<typeof TextInput> | null,
    ComponentRef<typeof TextInput> | null
  >(inputRef, () => control.current, [])

  return (
    <View ref={ref} style={style}>
      <FieldBox
        control={control}
        floatingLabel={floatingLabel}
        isDisabled={isDisabled}
        isFocused={focus.focused}
        isInvalid={error !== undefined}
        isPopulated={isPopulated(segments)}
        label={label}
        leading={leadingIcon}
        trailing={trailingIcon}
        variant={variant}
      >
        <FieldWrap>
          {segments.slice(0, last + 1).map((segment, index) => {
            const key = `${String(index)}:${segment.text}`

            if (segment.type === 'token') {
              return (
                <TokenPill
                  control={control}
                  editor={editor}
                  index={index}
                  isDisabled={isDisabled}
                  isReadOnly={isReadOnly}
                  isSelected={chosen === index}
                  key={key}
                  removeLabel={messages.remove}
                  text={segment.text}
                >
                  {renderToken === undefined
                    ? segment.text
                    : renderToken(segment)}
                </TokenPill>
              )
            }

            const words = segment.text.trim()

            return words === '' ? null : (
              <TokenText isDisabled={isDisabled} key={key}>
                {words}
              </TokenText>
            )
          })}
          <View
            style={composeStyles<ViewStyle>(
              styles.control,
              minWidthOf(
                CONTROL_ROOM * theme.typography.bodyLargeSize * fontScale,
              ),
            )}
          >
            <FieldInput
              {...props}
              {...focus.handlers}
              aria-label={label}
              described={describedBy(id, { description, error, locale })}
              editable={editable}
              onChangeText={editor.edit}
              onKeyPress={backspaceThen(
                editor,
                { editable, last, selected: chosen, trailing },
                onKeyPress,
              )}
              ref={control}
              value={trailing}
            />
          </View>
        </FieldWrap>
      </FieldBox>
      <FieldMessage description={description} error={error} id={id} />
    </View>
  )
}

/**
 * One token's pill: the chips page's input chip, unselected at rest and the
 * selected chip while it is selected, holding what `renderToken` draws, or
 * its text.
 */
function TokenPill({
  children,
  control,
  editor,
  index,
  isDisabled,
  isReadOnly,
  isSelected,
  removeLabel,
  text,
}: {
  readonly children: ReactNode
  /** The field's control, which a press on the pill moves focus to. */
  readonly control: RefObject<ComponentRef<typeof TextInput> | null>
  readonly editor: Editor
  /** The token's index among the value's segments. */
  readonly index: number
  readonly isDisabled: boolean
  readonly isReadOnly: boolean
  readonly isSelected: boolean
  readonly removeLabel: string
  readonly text: string
}) {
  const theme = useTheme()
  // Until the pill is measured it takes no reach across, rather than one
  // sized for a pill of no width.
  const [width, setWidth] = useState(TARGET_SIZE)
  const editable = !isDisabled && !isReadOnly
  const paint = paintOf(theme, {
    assist: false,
    disabled: isDisabled,
    elevated: false,
    selected: isSelected,
  })
  const eased = useEasedColors(paint)
  const feedback = usePressFeedback({
    color: paint.layer,
    corners: { borderRadius: theme.radii.sm },
    disabled: !editable,
  })

  return (
    <AnimatedPressable
      {...(isReadOnly
        ? undefined
        : { role: 'button' as const, ...toggleState(isSelected) })}
      {...(editable
        ? removeActionsOf(removeLabel, removeOf(editor, index))
        : undefined)}
      {...feedback.handlers}
      aria-label={text}
      disabled={isDisabled}
      hitSlop={targetOf(width, theme)}
      onLayout={measureThen(setWidth, undefined)}
      onPress={
        editable ? toggleOf(editor, index, isSelected, control) : undefined
      }
      style={composeStyles<AnimatedStyle<ViewStyle>>(
        stylesOf(theme).pill,
        eased.container,
        feedback.ring,
      )}
    >
      {feedback.layer}
      <ChipLabel color={eased.label}>{children}</ChipLabel>
    </AnimatedPressable>
  )
}

/**
 * Text before the last pill, in the value's type and colour, with the spaces
 * at its ends left to the row's gaps.
 */
function TokenText({
  children,
  isDisabled,
}: {
  readonly children: string
  readonly isDisabled: boolean
}) {
  const { colors, stateLayerOpacity } = useTheme()
  const role = useTypeRole('bodyLarge')

  return (
    <NativeText
      style={composeStyles<TextStyle>(
        role,
        colorOf(
          isDisabled
            ? withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)
            : colors.onSurface,
        ),
        styles.text,
      )}
    >
      {children}
    </NativeText>
  )
}

// Takes the token at `index` out, joining the text either side of it.
function withoutToken<T extends TokenFieldValue>(value: T, index: number): T {
  return value.replaceRange(
    { index, offset: 0 },
    { index, offset: value.segments[index]?.text.length ?? 0 },
    '',
  )
}

// Puts `text` in place of everything after the last token, which hands it to
// `tokenize`: with no token, the whole value, and with nothing after the last
// token, the end of it.
function withTrailing<T extends TokenFieldValue>(value: T, text: string): T {
  const { segments } = value
  const end = segments.length - 1

  return value.replaceRange(
    { index: lastTokenOf(segments) + 1, offset: 0 },
    { index: end, offset: segments[end]?.text.length ?? 0 },
    text,
  )
}

export { TokenField }
export type { TokenFieldProps, TokenSegment }
