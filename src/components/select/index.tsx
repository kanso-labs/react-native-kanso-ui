import type { ComponentRef, ReactNode, Ref, RefObject } from 'react'
import type { HostInstance, StyleProp, ViewStyle } from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { Key } from 'react-stately'
import type { ListProps as StatelyListProps } from 'react-stately/useListState'
import type {
  ChangeValueType,
  SelectionMode,
  SelectState,
  ValueType,
} from 'react-stately/useSelectState'

import { useEffect, useId, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSelectState } from 'react-stately/useSelectState'

import type { FieldTriggerProps, FieldVariant } from '../../field'
import type { ValidationResult } from '../../form'
import type { ResolvedTheme } from '../../theme/scope'

import { CollectionView } from '../../collection'
import { describedBy, FieldBox, FieldMessage, FieldValue } from '../../field'
import { useFieldValidation } from '../../form'
import { ChevronDownGlyph } from '../../glyphs'
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
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// kanso-ui's Select, the menus page's exposed dropdown menu: a field that
// opens a list rather than taking a keystroke. Everything above the list is
// the field chrome in src/field, the box, the label, the supporting line and
// the error every field here draws, and the list is ListBox's, through
// src/collection, on the surface every anchored panel here draws, placed by
// src/overlay. What is here is React Stately's select state around the two,
// and the things that are this component's own, which are web's.
//
// **The whole box opens the list.** The box is the control, a button a
// screen reader reads as the label and then the value, so its padding, its
// label and its icons all open the list, as the page draws it and as web's
// does. Web's names its button the other way round, the value first, but its
// label sits outside the button; here the label is inside it, drawn before
// the value, and a name that reads what the box draws in the order it draws
// it is what WCAG's label in name asks for.
//
// **The chevron turns.** The page's trailing icon points down while the list
// is closed and up while it is open, turned on the step the list arrives on,
// short3 on the standard curve, and at once under reduced motion. It is the
// down chevron turned half a turn rather than web's end chevron turned a
// quarter either way, which draws the same two states; the down one does not
// mirror under right-to-left, so the turn needs no second direction.
//
// **The list is the field's width**, under the field, and above it where the
// window has no room below. It grows from the edge facing the field, as
// every anchored panel here does, on surface container low with the
// extra-small corner and the second elevation. A press outside it closes it,
// as do Android's back gesture and VoiceOver's escape gesture.
//
// **A screen reader is sent to the chosen option as the list opens**, or to
// the first option that takes a press where nothing is chosen, and back to
// the field as it closes. A list taller than its room opens scrolled to the
// chosen option.
//
// The value shown is each chosen option's `textValue`, its headline where
// that is a string, and the chosen options' values joined into a list in the
// locale's words where several are chosen. Where nothing is, the box shows
// `placeholder`, or "Select an item" in the locale's words, React Aria's.
//
// Two things web's has that this does not, each because React Native has no
// counterpart. A keyboard on web moves through the options and picks one by
// typing its first letters; on a phone the list is touched or read by a
// screen reader, which moves through it itself. And web's box tells a screen
// reader it opens a listbox; React Native has neither the popup property nor
// the listbox role, so the box is a button that says whether its list is
// expanded, and the options are buttons that say whether they are chosen.

type SelectListProps = {
  readonly anchor: RefObject<HostInstance | null>
  readonly isOpen: boolean
  readonly label: string
  readonly setPresent: (present: boolean) => void
  readonly state: SelectState<object, SelectionMode>
}

type SelectProps<M extends SelectionMode = 'single'> = {
  /**
   * Lets the list open with no options in it, showing its empty state.
   * Left off, a press on a select with no options does nothing.
   * @default false
   */
  readonly allowsEmptyCollection?: boolean
  /** Whether the list is open at first, when the select keeps its own. */
  readonly defaultOpen?: boolean
  /**
   * What is chosen at first, when the select keeps its own value: an
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
   * list is open or something is chosen. `false` keeps it small at the top
   * in every state.
   * @default true
   */
  readonly floatingLabel?: boolean
  /**
   * Draws the field disabled: it takes no presses and its list never opens.
   * @default false
   */
  readonly isDisabled?: boolean
  /** Whether the list is open, when the call site holds it. */
  readonly isOpen?: boolean
  /**
   * Marks the label with an asterisk, as the text fields page marks a field
   * that must be filled. Inside a `native` form, a field left empty holds
   * the form back.
   * @default false
   */
  readonly isRequired?: boolean
  /**
   * What the field is for, and the name a screen reader reads for it before
   * its value. Required, since a select with no label is a box nobody can
   * name.
   */
  readonly label: string
  /**
   * An icon at the start of the box, before the label and the value: the
   * page's 24dp leading icon, in the muted role. The slot hands it that
   * colour and size through `useIconStyle()`.
   */
  readonly leadingIcon?: ReactNode
  /**
   * The name the value is submitted under by the `Form` around the field,
   * and the key its `validationErrors` reach the field by. A select with
   * nothing chosen submits an empty string, and one choosing several
   * submits the list of their `id`s.
   */
  readonly name?: string
  /**
   * Called with what is chosen whenever it changes: an option's `id`, or
   * the list of them with `selectionMode="multiple"`.
   */
  readonly onChange?: (value: ChangeValueType<M>) => void
  /** Called with whether the list is open whenever that changes. */
  readonly onOpenChange?: (isOpen: boolean) => void
  /**
   * The options, a `ListBox.Item` for each and `ListBox.Section` to group
   * them. The list is a ListBox's, and draws every slot one does. Give
   * every option an `id`, which is what the value holds.
   */
  readonly options?: ReactNode
  /**
   * What the box shows while nothing is chosen. Left out, it is "Select an
   * item" in the `I18nProvider`'s language, or the device's outside one.
   */
  readonly placeholder?: string
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * Whether one option is chosen, or several. A select choosing several
   * stays open as they are pressed.
   * @default 'single'
   */
  readonly selectionMode?: M
  /**
   * Whether a press on an option closes the list.
   * @default true with one option chosen, false with several
   */
  readonly shouldCloseOnSelect?: boolean
  /** Positions and sizes the field as a whole. */
  readonly style?: StyleProp<ViewStyle>
  /** The test id of the box, which is the control. */
  readonly testID?: string
  /**
   * Checks the value, and returns its problem in words, or several, where
   * there is one, and `true`, `null` or `undefined` where there is none.
   * Under the default `aria` validation the error shows as the value
   * changes; inside a `native` form it shows once a submission is tried, or
   * once something is chosen, and holds the form back.
   */
  readonly validate?: (value: ValueType<M>) => ValidationResult
  /** What is chosen, when the call site holds it. */
  readonly value?: ValueType<M>
  /**
   * The filled box, or the outlined one, as the text fields page draws them.
   * @default 'filled'
   */
  readonly variant?: FieldVariant
}

// How far the chevron turns while the list is open: half a turn, against
// the clock as web's end chevron turns from pointing down to pointing up.
const OPEN_TURN = -180

// The list never grows past its room, and the rows scroll inside it.
const SHRINKS: ViewStyle = { flexGrow: 0 }

const stylesOf = themedStyles(({ colors, radii, shadows }: ResolvedTheme) =>
  StyleSheet.create({
    // The menus page's list surface: surface container low, the
    // extra-small corner and the second elevation, clipping its rows to
    // the corner.
    list: {
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radii.xs,
      boxShadow: shadows.elevation2,
      overflow: 'hidden',
    },
  }),
)

// The chevron in the box's trailing slot, pointing down at the list it
// opens and turned to point up while the list is open.
function Chevron({ isOpen }: { readonly isOpen: boolean }) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const turn = isOpen ? OPEN_TURN : 0
  const angle = useSharedValue(turn)

  useEffect(() => {
    angle.set(
      reduceMotion
        ? turn
        : withTiming(turn, {
            duration: motion.durationShort3,
            easing: Easing.bezier(...motion.easingStandard),
          }),
    )
  }, [angle, motion, reduceMotion, turn])

  const turned = useAnimatedStyle(() => {
    'worklet'
    return { transform: [{ rotate: `${angle.get()}deg` }] }
  })

  return (
    <Animated.View style={turned}>
      <ChevronDownGlyph />
    </Animated.View>
  )
}

// The chevron, turned or not. A call rather than JSX written at the prop,
// which is what react-perf's jsx-no-jsx-as-prop is after; the React Compiler
// memoises the result on `isOpen`.
function chevronFor(isOpen: boolean) {
  return <Chevron isOpen={isOpen} />
}

/**
 * The option a screen reader is sent to as the list opens: the first one
 * chosen, or the first that takes a press where none is.
 */
function focusKeyOf(state: SelectState<object, SelectionMode>): Key | null {
  const chosen = state.selectionManager.firstSelectedKey

  if (chosen !== null) {
    return chosen
  }

  for (const node of state.collection) {
    if (node.type === 'item' && !state.disabledKeys.has(node.key)) {
      return node.key
    }

    if (node.type === 'section') {
      for (const row of state.collection.getChildren?.(node.key) ?? []) {
        if (!state.disabledKeys.has(row.key)) {
          return row.key
        }
      }
    }
  }

  return null
}

// The keys a select's value holds, one or several, as a list.
function keysOf(value: Key | null | readonly Key[]): readonly Key[] {
  if (value === null) {
    return []
  }

  return typeof value === 'object' ? value : [value]
}

/**
 * A labelled field that opens a list to choose from. Pass `value` with
 * `onChange` to hold what is chosen, or `defaultValue` to let the select
 * keep its own. The value is an option's `id`, so give every option one;
 * with `selectionMode="multiple"` it is a list of them.
 *
 * ```tsx
 * <Select
 *   label="Label"
 *   options={[
 *     <ListBox.Item id="first" key="first">First item</ListBox.Item>,
 *     <ListBox.Item id="second" key="second">Second item</ListBox.Item>,
 *   ]}
 * />
 * ```
 *
 * The box, the label, the supporting line and the error are the field chrome
 * every field here draws; the list is a ListBox's, on the surface every
 * anchored panel here draws. `style` and `ref` are the field as a whole, and
 * `testID` the box.
 */
function Select<M extends SelectionMode = 'single'>({
  allowsEmptyCollection,
  defaultOpen,
  defaultValue,
  description,
  disabledKeys,
  error,
  floatingLabel = true,
  isDisabled = false,
  isOpen,
  isRequired = false,
  label,
  leadingIcon,
  name,
  onChange,
  onOpenChange,
  options,
  placeholder,
  ref,
  selectionMode,
  shouldCloseOnSelect,
  style,
  testID,
  validate,
  value,
  variant = 'filled',
}: SelectProps<M>) {
  const id = useId()
  const box = useRef<HostInstance>(null)
  const [focused, setFocused] = useState(false)
  const messages = useMessages()
  const locale = useLocaleOf(undefined)
  const state = useSelectState<object, M>({
    allowsEmptyCollection,
    // Each option builds its own entry in the collection, as a ListBox's
    // does. The collection skips what is not an element, as a ReactNode may
    // be, and asks any element for its entry.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    children: options as StatelyListProps<object>['children'],
    defaultOpen,
    defaultValue,
    disabledKeys,
    isDisabled,
    isOpen,
    onChange: (changed) => {
      // A choice is made once, rather than typed, so it is committed as it
      // lands, as a checkbox group commits a tick.
      validation.onEdit()
      validation.onBlur()
      onChange?.(changed)
    },
    onOpenChange,
    selectionMode,
    shouldCloseOnSelect,
    value,
  })
  const chosen = keysOf(state.value)
  const several = state.selectionManager.selectionMode === 'multiple'
  const validation = useFieldValidation({
    control: box,
    error,
    isDisabled,
    isEmpty: chosen.length === 0,
    isReadOnly: false,
    isRequired,
    name,
    submitted: several ? chosen.map(String) : String(chosen[0] ?? ''),
    validate,
    value: state.value,
  })
  const shownError = validation.error
  const isPlaceholder = state.selectedItems.length === 0
  const shown = isPlaceholder
    ? (placeholder ?? messages.selectPlaceholder)
    : textOf(
        state.selectedItems.map((item) => item.textValue),
        locale,
      )

  return (
    <View ref={ref} style={style}>
      <FieldBox
        floatingLabel={floatingLabel}
        isDisabled={isDisabled}
        // The list takes the reader away from the box while it is open, so
        // the box is told it is focused then, or its label would fall back
        // onto the placeholder.
        isFocused={state.isOpen || focused}
        isInvalid={shownError !== undefined}
        isPopulated={!isPlaceholder}
        isRequired={isRequired}
        label={label}
        leading={leadingIcon}
        ref={box}
        trailing={chevronFor(state.isOpen)}
        trigger={triggerFor(state, {
          described: describedBy(id, { description, error: shownError }),
          name: `${label} ${shown}`,
          setFocused,
          testID,
        })}
        variant={variant}
      >
        <FieldValue isPlaceholder={isPlaceholder}>{shown}</FieldValue>
      </FieldBox>
      <FieldMessage description={description} error={shownError} id={id} />
      <SelectPopup anchor={box} label={label} state={state} />
    </View>
  )
}

/**
 * The list, drawn in the overlay host above the screen and placed under the
 * box: as wide as the box, flipped above it at the edge of the window, and
 * scrolled to the option a screen reader is sent to once it has been placed.
 */
function SelectList({
  anchor,
  isOpen,
  label,
  setPresent,
  state,
}: SelectListProps) {
  const styles = stylesOf(useTheme())
  const placement = useAnchoredPlacement({ align: 'start', anchor })
  const motion = usePanelMotion(isOpen, placement.placed, setPresent)
  const [panel, setPanel] = useState<HostInstance | null>(null)
  const [option, setOption] = useState<HostInstance | null>(null)
  // oxlint-disable-next-line typescript/unbound-method -- React Stately's `close` is a callback, and reads no `this`
  const close = state.close

  useBackToClose(close, isOpen)
  useFocusOnPlaced(placement.placed, option ?? panel)

  return (
    <>
      {isOpen ? <DismissLayer onPress={close} /> : null}
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
          aria-label={label}
          focusKey={focusKeyOf(state)}
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
 * select opens, and kept until the list has faded out. A screen reader goes
 * back to the box once it has gone.
 */
function SelectPopup({
  anchor,
  label,
  state,
}: Omit<SelectListProps, 'isOpen' | 'setPresent'>) {
  const [present, setPresent] = useState(state.isOpen)

  if (state.isOpen && !present) {
    setPresent(true)
  }

  useReturnFocus(present, false, anchor)

  if (!present) {
    return null
  }

  return (
    <Overlay>
      <SelectList
        anchor={anchor}
        isOpen={state.isOpen}
        label={label}
        setPresent={setPresent}
        state={state}
      />
    </Overlay>
  )
}

/**
 * What the box shows for the chosen options: one option's text as it is, or
 * several joined into a list the locale's way, "First item and Second item"
 * in English. Hermes may lack `Intl.ListFormat`, and a comma between them is
 * the list there.
 */
function textOf(texts: readonly string[], locale: string) {
  if (typeof Intl.ListFormat === 'function') {
    return new Intl.ListFormat(locale, { type: 'conjunction' }).format(texts)
  }

  return texts.join(', ')
}

/**
 * The box as the select's control: named by its label and what it shows,
 * described by the line under it, saying whether its list is open, and
 * opening or closing the list when pressed. It tracks its own focus, for a
 * keyboard reaching it, which the box draws as it draws a focused field.
 */
function triggerFor(
  state: SelectState<object, SelectionMode>,
  {
    described,
    name,
    setFocused,
    testID,
  }: {
    readonly described: FieldTriggerProps['described']
    readonly name: string
    readonly setFocused: (focused: boolean) => void
    readonly testID: string | undefined
  },
): FieldTriggerProps {
  return {
    'aria-expanded': state.isOpen,
    'aria-label': name,
    described,
    onBlur: () => {
      setFocused(false)
    },
    onFocus: () => {
      setFocused(true)
    },
    onPress: () => {
      state.toggle()
    },
    testID,
  }
}

export { Select }
export type { SelectProps }
