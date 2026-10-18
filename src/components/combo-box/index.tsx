import type {
  ComponentRef,
  ReactElement,
  ReactNode,
  Ref,
  RefObject,
} from 'react'
import type {
  HostInstance,
  StyleProp,
  TextInput,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { Key } from 'react-stately'
import type {
  ComboBoxState,
  ComboBoxValidationValue,
  MenuTriggerAction,
} from 'react-stately/useComboBoxState'
import type { ListProps as StatelyListProps } from 'react-stately/useListState'
import type { ChangeValueType, ValueType } from 'react-stately/useSelectState'

import { useId, useImperativeHandle, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useComboBoxState } from 'react-stately/useComboBoxState'

import type { FieldVariant } from '../../field'
import type { ValidationResult } from '../../form'
import type { ResolvedTheme } from '../../theme/scope'

import { containsIn } from '../../autocomplete'
import {
  CollectionView,
  focusKeyOf,
  ResultsStatus,
  rowCountOf,
} from '../../collection'
import {
  describedBy,
  FieldBox,
  FieldChevron,
  FieldInput,
  FieldMessage,
  useFieldFocus,
} from '../../field'
import { useFieldValidation } from '../../form'
import { listFor } from '../../i18n'
import { useLocaleOf, useMessages } from '../../i18n/provider'
import { Overlay, useAnchoredPlacement } from '../../overlay'
import {
  DismissLayer,
  PANEL_ORIGINS,
  useBackToClose,
  useFocusOnPlaced,
  usePanelMotion,
  useReturnFocus,
} from '../../overlay/panel'
import { hitSlop, usePressFeedback } from '../../press'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// kanso-ui's ComboBox, the text fields page's autocomplete field: a text
// field whose typing narrows a list of options under it. Everything above
// the list is the field chrome in src/field, the box, the label, the input,
// the supporting line and the error every field here draws, and the list is
// ListBox's, through src/collection, on the surface every anchored panel
// here draws, placed by src/overlay exactly as Select's is. What is here is
// React Stately's combo box state around the two, and the things that are
// this component's own.
//
// It is Select's shape with differences that are web's too. The control is
// a real input, so typing reaches it and a press on the box focuses it, and
// only the chevron at the end opens the list on its own: an autocomplete
// field is a text field with a button on it.
//
// **Filtering is on by default,** as on web: `defaultFilter` falls back to a
// match anywhere in an option's text, compared by an `Intl.Collator` in the
// `I18nProvider`'s locale, or the device's outside one, at base sensitivity,
// so case and accents are ignored, which is Autocomplete's filter and what
// web's `useFilter` makes. Options passed through `items` are the call
// site's to filter, as on web.
//
// **A value that is not in the list is allowed or refused, not corrected.**
// With `allowsCustomValue` off, the text goes back to the chosen option's as
// the field loses focus or the list is dismissed.
//
// **The keyboard stays up.** Typing opens the list as `menuTrigger` says,
// and an option is reached on the first tap rather than the one that would
// otherwise only close the keyboard. A press outside the list closes it and
// takes the focus out of the field, as a click outside does on web, but a
// press on the box itself leaves the list open, as a click in the input does
// there, so a tap that places the caret does not throw away what was typed.
// Android's back gesture and VoiceOver's escape gesture close it too.
//
// **The count is announced,** as React Aria's ComboBox announces it on web:
// how many options are listed, as the list opens and each time a search
// changes the number, through a polite live region on Android and under
// React Native Web and `AccessibilityInfo` on iOS. A screen reader stays in
// the input while the list opens from typing, so typing goes on, and is
// sent to the chosen option, or the first, where the chevron opens it, and
// back to the input as it closes.
//
// Choosing more than one is `selectionMode="multiple"`, which draws the
// chosen options before the input on its line, written as one list in the
// locale's words, the label floated over them, and keeps the list open as
// they are chosen.
//
// What web's has that this does not, each because React Native has no
// counterpart: web's arrow keys move through the list while the keyboard
// stays in the input, through React Aria's virtual focus, which a touch
// screen has no keys for, as Autocomplete drops it; and web's input tells a
// screen reader it is a combo box with a listbox, roles React Native does
// not have, so the chevron is the button that says whether the list is
// expanded.

type ComboBoxListProps = {
  readonly anchor: RefObject<HostInstance | null>
  readonly control: RefObject<ComponentRef<typeof TextInput> | null>
  readonly isOpen: boolean
  readonly label: string
  readonly openedBy: MenuTriggerAction | undefined
  readonly setPresent: (present: boolean) => void
  readonly state: ComboBoxState<object, ComboBoxSelectionMode>
}

type ComboBoxProps<
  T extends object = object,
  M extends ComboBoxSelectionMode = 'single',
> = {
  /**
   * Lets the field keep text that matches no option. With it on, the text is
   * what the field holds and submits; with it off, the text goes back to the
   * chosen option's as the field loses focus.
   * @default false
   */
  readonly allowsCustomValue?: boolean
  /**
   * Lets the list open with no options in it, showing its empty state. Left
   * off, the list closes when a search leaves nothing.
   * @default false
   */
  readonly allowsEmptyCollection?: boolean
  /**
   * Which options a search keeps, handed an option's text and what has been
   * typed. Left out, an option is kept when its text contains what has been
   * typed anywhere in it, ignoring case and accents.
   */
  readonly defaultFilter?: (textValue: string, inputValue: string) => boolean
  /** The text the field opens with, when it keeps its own. */
  readonly defaultInputValue?: string
  /** The items the options are built from, when the field keeps its own. */
  readonly defaultItems?: Iterable<T>
  /**
   * What is chosen at first, when the field keeps its own value: an
   * option's `id`, or a list of them with `selectionMode="multiple"`.
   */
  readonly defaultValue?: ValueType<M>
  /**
   * A hint shown under the field. Replaced by `error` when there is one, so
   * the two never stack.
   */
  readonly description?: string
  /** The `id`s of the options drawn disabled, which take no presses. */
  readonly disabledKeys?: Iterable<Key>
  /**
   * The problem with the current value, in words. Its presence is what puts
   * the field in its error state: the message, the error colours, and the
   * error a screen reader reads with the field all follow from it. The line
   * under the field arrives with the message, so the field grows when this
   * does, unless it is inside a `Form`, which keeps the line drawn. It wins
   * over what `validate` and the form say, and holds a `native` form back.
   */
  readonly error?: string
  /**
   * Whether the label sits in the empty box and floats to the top once the
   * field is focused or holds a value. `false` keeps it small at the top in
   * every state.
   * @default true
   */
  readonly floatingLabel?: boolean
  /**
   * Whether the `Form` around the field submits the chosen option's `id` or
   * the text in the field. A field allowing a custom value, which may hold
   * text that is no option's, always submits the text, and one choosing
   * several always submits the list of their `id`s.
   * @default 'key'
   */
  readonly formValue?: 'key' | 'text'
  /**
   * A ref to the field's own `TextInput`, which is what a call site moves
   * focus to, after a server's error, say. `ref` is the field as a whole.
   */
  readonly inputRef?: Ref<ComponentRef<typeof TextInput>>
  /** The text in the field, when the call site holds it. */
  readonly inputValue?: string
  /**
   * Draws the field disabled: it takes no focus and no input, and its list
   * never opens.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * Shows the value and takes focus, but takes no input, and its list never
   * opens.
   * @default false
   */
  readonly isReadOnly?: boolean
  /**
   * Marks the label with an asterisk, as the text fields page marks a field
   * that must be filled. Inside a `native` form, a field with nothing chosen
   * holds the form back, or with nothing typed where it submits its text.
   * @default false
   */
  readonly isRequired?: boolean
  /** The items the options are built from, when the call site holds them. */
  readonly items?: Iterable<T>
  /**
   * What the field is for, and the name a screen reader reads for it.
   * Required, since a combo box with no label is a box nobody can name.
   */
  readonly label: string
  /**
   * An icon at the start of the box, before the label and the value: the
   * page's 24dp leading icon, in the muted role. The slot hands it that
   * colour and size through `useIconStyle()`.
   */
  readonly leadingIcon?: ReactNode
  /**
   * What opens the list besides the chevron: typing into the field, the
   * field taking focus, or nothing else.
   * @default 'input'
   */
  readonly menuTrigger?: MenuTriggerAction
  /**
   * The name the value is submitted under by the `Form` around the field,
   * and the key its `validationErrors` reach the field by. What is
   * submitted is set out under `formValue`.
   */
  readonly name?: string
  /**
   * Called with what is chosen whenever it changes: an option's `id`, or
   * the list of them with `selectionMode="multiple"`.
   */
  readonly onChange?: (value: ChangeValueType<M>) => void
  /** Called with the text in the field whenever an edit changes it. */
  readonly onInputChange?: (value: string) => void
  /**
   * Called with whether the list is open whenever that changes, and, as it
   * opens, with what opened it.
   */
  readonly onOpenChange?: (
    isOpen: boolean,
    menuTrigger?: MenuTriggerAction,
  ) => void
  /**
   * The options, a `ListBox.Item` for each and `ListBox.Section` to group
   * them. The list is a ListBox's, and draws every slot one does. Give
   * every option an `id`, which is what the value holds. With `items` or
   * `defaultItems`, a function from an item to its option.
   */
  readonly options?: ((item: T) => ReactElement) | ReactNode
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * Whether one option is chosen, or several.
   * @default 'single'
   */
  readonly selectionMode?: M
  /** Positions and sizes the field as a whole. */
  readonly style?: StyleProp<ViewStyle>
  /** The test id of the field's `TextInput`, which is the control. */
  readonly testID?: string
  /**
   * Checks the value, handed the text in the field and what is chosen, and
   * returns its problem in words, or several, where there is one, and
   * `true`, `null` or `undefined` where there is none. Under the default
   * `aria` validation the error shows as the value changes; inside a
   * `native` form it shows once a submission is tried, or once the field
   * loses focus after an edit, and holds the form back.
   */
  readonly validate?: (value: ComboBoxValidationValue<M>) => ValidationResult
  /** What is chosen, when the call site holds it. */
  readonly value?: ValueType<M>
  /**
   * The filled box, or the outlined one, as the text fields page draws them.
   * @default 'filled'
   */
  readonly variant?: FieldVariant
}

// React Stately's combo box takes its own two-value selection mode rather
// than the collection-wide one, which also has `none`, as web's does.
type ComboBoxSelectionMode = 'multiple' | 'single'

type ToggleProps = {
  readonly isDisabled: boolean
  readonly isOpen: boolean
  readonly label: string
  readonly onPress: () => void
}

// The chevron is the page's 24dp trailing icon, which takes a press, and
// reaches to the 48dp target every control here has.
const TOGGLE_SIZE = 24
const TOGGLE_SLOP = hitSlop(TOGGLE_SIZE, TOGGLE_SIZE)

// The list never grows past its room, and the rows scroll inside it.
const SHRINKS: ViewStyle = { flexGrow: 0 }

const stylesOf = themedStyles(({ colors, radii, shadows }: ResolvedTheme) =>
  StyleSheet.create({
    // The menus page's list surface: surface container low, the
    // extra-small corner and the second elevation, clipping its rows to
    // the corner, as Select's list draws it.
    list: {
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radii.xs,
      boxShadow: shadows.elevation2,
      overflow: 'hidden',
    },
    // The chevron as a button: the glyph alone, as web draws it, since the
    // box around it already carries the fill, the indicator and the focus.
    // Round, for the ring a keyboard's focus draws around it.
    toggle: {
      alignItems: 'center',
      borderRadius: radii.circle,
      height: TOGGLE_SIZE,
      justifyContent: 'center',
      width: TOGGLE_SIZE,
    },
  }),
)

/**
 * A labelled text field that filters a list of options as it is typed. Its
 * value is React Stately's: pass `value` with `onChange` to hold which
 * option is chosen, `inputValue` with `onInputChange` to hold the text, or
 * the `default` forms of either to let it keep its own. The value is an
 * option's `id`, so give every option one; with `selectionMode="multiple"`
 * it is a list of them.
 *
 * ```tsx
 * <ComboBox
 *   label="Label"
 *   options={[
 *     <ListBox.Item id="first" key="first">First item</ListBox.Item>,
 *     <ListBox.Item id="second" key="second">Second item</ListBox.Item>,
 *   ]}
 * />
 * ```
 *
 * The box, the label, the input, the supporting line and the error are the
 * field chrome every field here draws; the list is a ListBox's, on the
 * surface every anchored panel here draws. `style` and `ref` are the field
 * as a whole, and `inputRef` and `testID` its `TextInput`.
 */
function ComboBox<
  T extends object = object,
  M extends ComboBoxSelectionMode = 'single',
>({
  allowsCustomValue = false,
  allowsEmptyCollection,
  defaultFilter,
  defaultInputValue,
  defaultItems,
  defaultValue,
  description,
  disabledKeys,
  error,
  floatingLabel = true,
  formValue = 'key',
  inputRef,
  inputValue,
  isDisabled = false,
  isReadOnly = false,
  isRequired = false,
  items,
  label,
  leadingIcon,
  menuTrigger,
  name,
  onChange,
  onInputChange,
  onOpenChange,
  options,
  ref,
  selectionMode,
  style,
  testID,
  validate,
  value,
  variant = 'filled',
}: ComboBoxProps<T, M>) {
  const id = useId()
  const box = useRef<HostInstance>(null)
  const control = useRef<ComponentRef<typeof TextInput>>(null)
  const [openedBy, setOpenedBy] = useState<MenuTriggerAction | undefined>()
  const messages = useMessages()
  const locale = useLocaleOf(undefined)
  const state = useComboBoxState<T, M>({
    allowsCustomValue,
    allowsEmptyCollection,
    // Each option builds its own entry in the collection, as a ListBox's
    // does. The collection skips what is not an element, as a ReactNode may
    // be, and asks any element for its entry.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    children: options as StatelyListProps<T>['children'],
    defaultFilter: defaultFilter ?? containsIn(locale),
    defaultInputValue,
    defaultItems,
    defaultValue,
    disabledKeys,
    inputValue,
    isDisabled,
    isReadOnly,
    items,
    menuTrigger,
    onChange: (changed) => {
      // A choice is made once, rather than typed, so it is committed as it
      // lands, as Select commits one.
      validation.onEdit()
      validation.onBlur()
      onChange?.(changed)
    },
    onInputChange,
    onOpenChange: (isOpen, trigger) => {
      if (isOpen) {
        setOpenedBy(trigger)
      }
      // The chevron moves the focus into the input as it opens the list, as
      // web's button does, so what is typed next narrows what it opened.
      if (isOpen && trigger === 'manual') {
        control.current?.focus()
      }
      onOpenChange?.(isOpen, trigger)
    },
    selectionMode,
    // React Native Web takes the focus out of the input as an option is
    // clicked, before the click lands, and closing on that blur would close
    // the list under the pointer. A press outside the list closes it there,
    // as it does everywhere. iOS and Android keep the focus in the input
    // through a tap on an option, so the list closes on blur there, as on
    // web.
    shouldCloseOnBlur: Platform.OS !== 'web',
    value,
  })
  const chosen = keysOf(state.value)
  const several = state.selectionManager.selectionMode === 'multiple'
  const submitsText = !several && (allowsCustomValue || formValue === 'text')
  const validation = useFieldValidation({
    control,
    error,
    isDisabled,
    isEmpty: submitsText ? state.inputValue === '' : chosen.length === 0,
    isReadOnly,
    isRequired,
    name,
    submitted: several
      ? chosen.map(String)
      : submitsText
        ? state.inputValue
        : String(chosen[0] ?? ''),
    validate,
    value: validationValueOf<M>(state),
  })
  const focus = useFieldFocus({
    onBlur: () => {
      state.setFocused(false)
      validation.onBlur()
    },
    onFocus: () => {
      state.setFocused(true)
    },
  })
  const shownError = validation.error

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
        // A list opened from the chevron takes the reader away from the
        // input, so the box is told it is focused while the list is open,
        // or its label would fall back over an empty input.
        isFocused={focus.focused || state.isOpen}
        isInvalid={shownError !== undefined}
        isPopulated={state.inputValue !== '' || (several && chosen.length > 0)}
        isRequired={isRequired}
        label={label}
        leading={leadingIcon}
        ref={box}
        trailing={toggleFor(state, {
          isDisabled: isDisabled || isReadOnly,
          label: `${messages.showSuggestions} ${label}`,
          onPress: () => {
            state.toggle(null, 'manual')
          },
        })}
        variant={variant}
      >
        <FieldInput
          {...focus.handlers}
          aria-label={label}
          chosen={
            several
              ? listFor(
                  state.selectedItems.map((item) => item.textValue),
                  locale,
                )
              : undefined
          }
          described={describedBy(id, { description, error: shownError })}
          editable={!isDisabled && !isReadOnly}
          onChangeText={editOf(state, validation.onEdit)}
          ref={control}
          testID={testID}
          value={state.inputValue}
        />
      </FieldBox>
      <FieldMessage description={description} error={shownError} id={id} />
      <ResultsStatus count={state.isOpen ? rowCountOf(state) : null} />
      <ComboBoxPopup
        anchor={box}
        control={control}
        label={label}
        openedBy={openedBy}
        state={state}
      />
    </View>
  )
}

/**
 * The list, drawn in the overlay host above the screen and placed under the
 * box: as wide as the box, flipped above it at the edge of the window, over
 * a layer that closes it on a press anywhere but the list and the box.
 */
function ComboBoxList({
  anchor,
  control,
  isOpen,
  label,
  openedBy,
  setPresent,
  state,
}: ComboBoxListProps) {
  const styles = stylesOf(useTheme())
  const messages = useMessages()
  const placement = useAnchoredPlacement({ align: 'start', anchor })
  const motion = usePanelMotion(isOpen, placement.placed, setPresent)
  const [panel, setPanel] = useState<HostInstance | null>(null)
  const [option, setOption] = useState<HostInstance | null>(null)
  // Only the chevron sends a screen reader into the list. Typing keeps it in
  // the input.
  const sendsReader = openedBy === 'manual'
  // oxlint-disable-next-line typescript/unbound-method -- React Stately's `close` is a callback, and reads no `this`
  const close = state.close

  useBackToClose(close, isOpen)
  // Only while open: a choice moves the focus key to the option just chosen
  // as the list leaves, and the reader belongs back at the input by then.
  useFocusOnPlaced(sendsReader && isOpen && placement.placed, option ?? panel)

  return (
    <>
      {isOpen ? (
        <DismissLayer
          hole={placement.anchorFrame}
          onPress={dismissOf(control, close)}
        />
      ) : null}
      <Animated.View
        onAccessibilityEscape={close}
        onLayout={placement.onLayout}
        ref={setPanel}
        style={composeStyles<AnimatedStyle<ViewStyle>>(
          styles.list,
          { width: placement.anchorWidth },
          placement.style,
          { transformOrigin: PANEL_ORIGINS[placement.side] },
          motion,
        )}
      >
        <CollectionView
          aria-label={`${messages.suggestions} ${label}`}
          focusKey={sendsReader ? focusKeyOf(state) : null}
          keyboardShouldPersistTaps="handled"
          kind="listbox"
          onFocusTarget={setOption}
          revealFocus={placement.placed}
          state={state}
          style={SHRINKS}
        />
      </Animated.View>
    </>
  )
}

/**
 * The list while it is open and while its exit runs: mounted the moment the
 * field opens it, and kept until the list has faded out. A screen reader the
 * chevron sent into the list goes back to the input once it has gone.
 */
function ComboBoxPopup({
  anchor,
  control,
  label,
  openedBy,
  state,
}: Omit<ComboBoxListProps, 'isOpen' | 'setPresent'>) {
  const [present, setPresent] = useState(state.isOpen)

  if (state.isOpen && !present) {
    setPresent(true)
  }

  useReturnFocus(present, openedBy !== 'manual', control)

  if (!present) {
    return null
  }

  return (
    <Overlay>
      <ComboBoxList
        anchor={anchor}
        control={control}
        isOpen={state.isOpen}
        label={label}
        openedBy={openedBy}
        setPresent={setPresent}
        state={state}
      />
    </Overlay>
  )
}

// A combo box's value with any list of keys in it copied.
function copyOf(value: Key | null | readonly Key[]): Key | Key[] | null {
  return typeof value === 'object' && value !== null ? [...value] : value
}

// A press outside the list closes it and takes the focus out of the input,
// as a click outside does on web. iOS and Android leave a field focused
// through a press outside a scroll view, which would keep the keyboard up
// over a list that has gone.
function dismissOf(
  control: RefObject<ComponentRef<typeof TextInput> | null>,
  close: () => void,
) {
  return () => {
    control.current?.blur()
    close()
  }
}

// What an edit of the input does: the text goes to the state, which narrows
// the list and opens it, and counts as an edit for the field's validation.
function editOf(
  state: ComboBoxState<object, ComboBoxSelectionMode>,
  onEdit: () => void,
) {
  return (text: string) => {
    state.setInputValue(text)
    onEdit()
  }
}

// The keys a combo box's value holds, one or several, as a list.
function keysOf(value: Key | null | readonly Key[]): readonly Key[] {
  if (value === null) {
    return []
  }

  return typeof value === 'object' ? value : [value]
}

/**
 * The chevron as the button opening the list, named in React Aria's words
 * before the field's label, saying whether the list is open, and drawing the
 * ring a keyboard's focus draws. It takes its colour from the box's trailing
 * slot, so it follows the field into its error and disabled states.
 */
function Toggle({ isDisabled, isOpen, label, onPress }: ToggleProps) {
  const theme = useTheme()
  const styles = stylesOf(theme)
  const feedback = usePressFeedback({
    color: theme.colors.onSurfaceVariant,
    corners: styles.toggle,
    disabled: isDisabled,
    disableRipple: true,
  })

  return (
    <Pressable
      {...feedback.handlers}
      aria-expanded={isOpen}
      aria-label={label}
      disabled={isDisabled}
      hitSlop={TOGGLE_SLOP}
      onPress={onPress}
      role="button"
      style={composeStyles<ViewStyle>(styles.toggle, feedback.ring)}
    >
      <FieldChevron isOpen={isOpen} />
    </Pressable>
  )
}

/**
 * The chevron button for the box's trailing slot, which opens the list with
 * every option in it, whatever has been typed, as web's does, and closes it
 * again. A call rather than JSX written at the prop, which is what
 * react-perf's jsx-no-jsx-as-prop is after.
 */
function toggleFor(
  state: ComboBoxState<object, ComboBoxSelectionMode>,
  props: Omit<ToggleProps, 'isOpen'>,
) {
  return <Toggle {...props} isOpen={state.isOpen} />
}

/**
 * What `validate` is handed, as React Aria's ComboBox hands it on web: the
 * text in the field and what is chosen, with the first chosen option's `id`
 * under the older name.
 */
function validationValueOf<M extends ComboBoxSelectionMode>(
  state: ComboBoxState<object, M>,
): ComboBoxValidationValue<M> {
  return {
    inputValue: state.inputValue,
    // oxlint-disable-next-line typescript/no-deprecated -- React Aria still hands it to `validate`
    selectedKey: state.selectedKey,
    // A list of keys is copied, since `validate` is typed to take one it may
    // change, and the state's own is read-only.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the value's shape follows the mode, which TypeScript cannot follow through the copy
    value: copyOf(state.value) as ComboBoxValidationValue<M>['value'],
  }
}

export { ComboBox }
export type { ComboBoxProps, ComboBoxSelectionMode }
