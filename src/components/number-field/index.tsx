import type { ReactNode, Ref } from 'react'
import type {
  BlurEvent,
  Insets,
  KeyboardTypeOptions,
  StyleProp,
  TextInput,
  TextInputProps,
  TextInputSubmitEditingEvent,
  ViewStyle,
} from 'react-native'

import { NumberFormatter } from '@internationalized/number'
import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'

import type { FieldVariant } from '../../field'
import type { IconStyle } from '../../glyphs/icon-style'
import type { NumberFieldState } from '../../number/state'
import type { ResolvedTheme } from '../../theme/scope'

import {
  describedBy,
  FieldBox,
  FieldInput,
  FieldMessage,
  useFieldFocus,
} from '../../field'
import { MinusGlyph, PlusGlyph } from '../../glyphs'
import { IconStyleContext } from '../../glyphs/icon-style'
import { useNumberFieldState } from '../../number/state'
import { hitSlop, usePressFeedback } from '../../press'
import { withOpacity } from '../../theme/color'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { IconButton } from '../icon-button'

// kanso-ui's NumberField: the text fields page's field holding a number,
// drawn through the field chrome in src/field as TextField is, with the value
// in the mono face and tabular figures by default and two steppers at the
// box's end.
//
// The steppers come in web's two layouts. Stacked, the plus over the minus,
// they are a column flush with the box's top, end and bottom, each half of
// the box and 32dp wide, drawing the icon buttons page's 20dp glyph in on
// surface variant with the state layer and the ripple every control draws.
// The top one takes the box's top-end corner, and the bottom one the outlined
// box's bottom-end corner, so the column reads as the box's own edge. Side by
// side, they are extra-small icon buttons, 8dp apart and 12dp from the end
// where the page puts a field's icons, centred on the box. Either way a tap
// steps once, on release, and a hold keeps stepping until the press ends or
// the value reaches its bound, as React Aria's steppers do for a touch, and
// the box shows focus while a stepper has it, as web's does.
//
// **The stacked pair reaches 48dp outward**, through `hitSlop`: the top one
// up and the bottom one down, each 8dp to either side. Web keeps the pair to
// its drawn size, since two 48dp targets inside the column would overlap;
// reaching away from each other, the two never meet.
//
// The value is React Stately's, through src/number: a keystroke is kept only
// where the text could still become a number in the field's locale and
// format, and the text is read, clamped to the range, snapped to the step
// and written back formatted when the field loses focus or the return key is
// pressed, as web's is on blur and Enter. The keyboard is the one that types
// what the field takes: a minus where the range reaches below zero, and a
// decimal separator where the format shows a fraction. On iOS a minus is on
// the numbers and punctuation keyboard alone, so a field that takes one gets
// that.
//
// **The locale is a prop**, defaulting to the device's, where web reads it
// from React Aria's `I18nProvider`. It decides how the value is written and
// read, so a field in a German app reads "1.234,5" as 1234.5.
//
// A stepper press is announced on iOS and Android, by the value it leaves,
// since VoiceOver and TalkBack stay on the stepper rather than reading the
// field again.

type NumberFieldProps = Omit<
  TextInputProps,
  | 'accessibilityHint'
  | 'accessibilityLabel'
  | 'aria-disabled'
  | 'aria-label'
  | 'autoComplete'
  | 'autoCorrect'
  | 'children'
  | 'cursorColor'
  | 'defaultValue'
  | 'editable'
  | 'inputMode'
  | 'keyboardType'
  | 'maxLength'
  | 'multiline'
  | 'numberOfLines'
  | 'onChange'
  | 'onChangeText'
  | 'placeholder'
  | 'placeholderTextColor'
  | 'readOnly'
  | 'selectionColor'
  | 'spellCheck'
  | 'style'
  | 'underlineColorAndroid'
  | 'value'
> & {
  /**
   * The name of the stepper that lowers the value, for a screen reader. Left
   * out, it is the English "Decrease" followed by the field's own label.
   */
  readonly decrementLabel?: string
  /** The value the field opens with, when it keeps its own. */
  readonly defaultValue?: number
  /**
   * A hint shown under the field. Replaced by `error` when there is one, so
   * the two never stack.
   */
  readonly description?: string
  /**
   * The problem with the current value, in words. Its presence is what puts
   * the field in its error state: the message, the error colours, and the
   * invalid state a screen reader reads all follow from it. The line under
   * the field arrives with the message, so the field grows when this does.
   */
  readonly error?: string
  /**
   * Whether the label sits in the empty box and floats to the top once the
   * field is focused or holds a value, as the text fields page draws it.
   * `false` keeps it small at the top in every state.
   * @default true
   */
  readonly floatingLabel?: boolean
  /**
   * How the value is written and read: a currency, a percentage, a unit, a
   * number of fraction digits. It also decides what can be typed.
   */
  readonly formatOptions?: Intl.NumberFormatOptions
  /**
   * The name of the stepper that raises the value, for a screen reader. Left
   * out, it is the English "Increase" followed by the field's own label.
   */
  readonly incrementLabel?: string
  /**
   * A ref to the field's own `TextInput`, which is what a call site moves
   * focus to, after a server's error, say. `ref` is the field as a whole.
   */
  readonly inputRef?: Ref<TextInput>
  /**
   * Draws the field disabled: it takes no focus, no input and no steps.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * Shows the value and takes focus, but takes no input and no steps.
   * @default false
   */
  readonly isReadOnly?: boolean
  /**
   * Marks the label with an asterisk, as the text fields page marks a field
   * that must be filled.
   * @default false
   */
  readonly isRequired?: boolean
  /**
   * What the field is for, and the name a screen reader reads for it.
   * Required, since a field with no label is a box nobody can name.
   */
  readonly label: string
  /**
   * The BCP 47 locale the value is written and read in. Defaults to the
   * device's.
   */
  readonly locale?: string
  /** The highest value the field takes. A committed value is clamped to it. */
  readonly maxValue?: number
  /** The lowest value the field takes. A committed value is clamped to it. */
  readonly minValue?: number
  /**
   * Renders the value in the mono face with tabular figures, for amounts and
   * other numbers meant to be compared down a column. On by default, since a
   * number field holds nothing else.
   * @default true
   */
  readonly numeric?: boolean
  /**
   * Called with the committed value, once it is read from what was typed or
   * stepped to. `NaN` is an empty field.
   */
  readonly onChange?: (value: number) => void
  readonly ref?: Ref<View>
  /**
   * The amount the steppers move the value by, and the multiple of it, from
   * `minValue`, that a committed value snaps to.
   */
  readonly step?: number
  /**
   * How the two steppers sit at the end of the box: stacked, the plus over
   * the minus, flush with the box's edge, or side by side as extra-small
   * icon buttons.
   * @default 'vertical'
   */
  readonly steppers?: 'horizontal' | 'vertical'
  /** Positions and sizes the field as a whole. */
  readonly style?: StyleProp<ViewStyle>
  /** The value, when the call site keeps it. `NaN` is an empty field. */
  readonly value?: number
  /**
   * The filled box, or the outlined one: no fill, an outline that thickens
   * and takes the primary role while focused, and the label cutting it once
   * it floats, the text fields page's two fields.
   * @default 'filled'
   */
  readonly variant?: FieldVariant
}

// What a stepper hands its control so a tap steps once and a hold keeps
// stepping.
type Spin = {
  readonly onPress: () => void
  readonly onPressIn: () => void
  readonly onPressOut: () => void
}

type StepperProps = Spin & {
  readonly 'aria-label': string
  readonly children: ReactNode
  readonly half: number
  readonly isDisabled: boolean
  readonly onBlur: () => void
  readonly onFocus: () => void
  readonly outlined: boolean
  readonly place: 'bottom' | 'top'
}

type SteppersProps = {
  readonly canDecrement: boolean
  readonly canIncrement: boolean
  readonly decrementLabel: string
  readonly incrementLabel: string
  readonly inline: boolean
  readonly onBlur: () => void
  readonly onDecrement: () => void
  readonly onFocus: () => void
  readonly onIncrement: () => void
  readonly outlined: boolean
}

// A stacked stepper's width, and the glyph it draws: the icon buttons page's
// 20dp, for the extra-small size the pair stands in for.
const STEPPER_WIDTH = 32
const GLYPH_SIZE = 20

// How long a stepper is held before it starts stepping on its own, and how
// often it steps after that: React Aria's timings for a stepper held by
// touch.
const SPIN_DELAY = 600
const SPIN_INTERVAL = 60

let deviceLocale: string | undefined

const stylesOf = themedStyles(({ radii, spacing }) =>
  StyleSheet.create({
    // One stacked stepper: half the column, its glyph in the middle.
    stepper: {
      alignItems: 'center',
      flexBasis: 0,
      flexGrow: 1,
      justifyContent: 'center',
      width: STEPPER_WIDTH,
    },
    stepperBottomOutlined: {
      borderBottomEndRadius: radii.xs,
    },
    // The ring inside the stepper, as web draws it, since outside it would
    // fall over the box's edge and the other stepper.
    stepperRing: {
      outlineOffset: -2,
    },
    // Stacked: the column reaches out of the box's padding to sit flush with
    // its top, end and bottom, 8dp after the value rather than the box's 16.
    steppers: {
      alignSelf: 'stretch',
      flexDirection: 'column',
      marginEnd: -spacing.lg,
      marginStart: spacing.sm - spacing.lg,
      marginVertical: -spacing.sm,
    },
    // Side by side: 12dp from the end, as the page places a field's icons,
    // and 8dp apart, which is how far each button's target reaches past it,
    // so neither target falls over the other's glyph. They centre on the
    // box, as the page centres a trailing icon and as web draws them, and
    // take no more of its height than the value's line, so the outlined
    // box, whose content is that line alone, is not made taller by them.
    // The margins that do it are worked out where they render, since the
    // line follows the device's text size.
    steppersInline: {
      alignSelf: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      marginEnd: spacing.md - spacing.lg,
      marginStart: spacing.sm - spacing.lg,
    },
    // In the outlined box the column has 16dp to reach rather than 8.
    steppersOutlined: {
      marginVertical: -spacing.lg,
    },
    stepperTop: {
      borderTopEndRadius: radii.xs,
    },
  }),
)

// Reads the text as the field's value, then hands the event on.
function commitBefore<Event>(
  state: NumberFieldState,
  handler: ((event: Event) => void) | undefined,
) {
  return (event: Event) => {
    state.commit()
    handler?.(event)
  }
}

// The text typed, kept only where it could still become a number.
function editInto(state: NumberFieldState) {
  return (text: string) => {
    if (state.validate(text)) {
      state.setInputValue(text)
    }
  }
}

function glyphOf(color: string): IconStyle {
  return { color, size: GLYPH_SIZE }
}

// A stacked stepper's half of the box: the box's padding above and below
// and the lines it holds, at the device's text size, halved.
function halfOf(
  { spacing, typography }: ResolvedTheme,
  outlined: boolean,
  fontScale: number,
) {
  return outlined
    ? spacing.lg + (typography.bodyLargeLineHeight * fontScale) / 2
    : spacing.sm +
        ((typography.bodySmallLineHeight + typography.bodyLargeLineHeight) *
          fontScale) /
          2
}

// The keyboard that types what the field takes. React Aria's own choice of
// input mode, in React Native's keyboards.
function keyboardOf(
  minValue: number | undefined,
  hasDecimals: boolean,
): KeyboardTypeOptions {
  const hasNegative =
    minValue === undefined || Number.isNaN(minValue) || minValue < 0

  if (hasNegative) {
    return Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'
  }

  return hasDecimals ? 'decimal-pad' : 'number-pad'
}

// The locale the field writes in: the one given, where the runtime takes it
// as a locale at all, or the device's.
function localeOf(locale: string | undefined) {
  if (locale !== undefined) {
    try {
      Intl.NumberFormat.supportedLocalesOf(locale)
      return locale
    } catch {
      // A malformed tag, which falls back to the device's.
    }
  }

  deviceLocale ??= new Intl.NumberFormat().resolvedOptions().locale
  return deviceLocale
}

// The margin that gives a side-by-side stepper the value's line in the
// box's height: half the difference between the two, negative where the
// button is taller.
function marginVerticalOf(margin: number): ViewStyle {
  return { marginVertical: margin }
}

/**
 * A labelled number input with steppers, the text fields page's filled or
 * outlined field. Pass `value` with `onChange` to control it, or
 * `defaultValue` to let it keep its own; `onChange` is handed the committed
 * number, `NaN` for an empty field. `minValue`, `maxValue` and `step` shape
 * it, and `formatOptions` says how it reads, in `locale`: a currency, a
 * percentage, a unit.
 *
 * React Native's own `TextInput` props, the return key among them, reach the
 * control; `style` and `ref` are the field as a whole, and `inputRef` the
 * control.
 *
 * ```tsx
 * <NumberField defaultValue={1234.5} label="Label" />
 * ```
 */
function NumberField({
  decrementLabel,
  defaultValue,
  description,
  error,
  floatingLabel = true,
  formatOptions,
  incrementLabel,
  inputRef,
  isDisabled = false,
  isReadOnly = false,
  isRequired = false,
  label,
  locale,
  maxValue,
  minValue,
  numeric = true,
  onBlur,
  onChange,
  onFocus,
  onSubmitEditing,
  ref,
  returnKeyType = 'done',
  step,
  steppers = 'vertical',
  style,
  value,
  variant = 'filled',
  ...props
}: NumberFieldProps) {
  const id = useId()
  const control = useRef<TextInput>(null)
  const writtenIn = localeOf(locale)
  const state = useNumberFieldState({
    defaultValue,
    formatOptions,
    isDisabled,
    isReadOnly,
    locale: writtenIn,
    maxValue,
    minValue,
    onChange,
    step,
    value,
  })
  const focus = useFieldFocus({
    onBlur: commitBefore<BlurEvent>(state, onBlur),
    onFocus,
  })
  const hasDecimals =
    (new NumberFormatter(writtenIn, formatOptions).resolvedOptions()
      .maximumFractionDigits ?? 0) > 0
  const announced = useStepAnnouncement(state.inputValue)
  // The box is focused while focus is anywhere in it, a stepper's included,
  // as web's is through `:focus-within`.
  const [stepperFocused, setStepperFocused] = useState(false)

  useImperativeHandle<null | TextInput, null | TextInput>(
    inputRef,
    () => control.current,
    [],
  )

  return (
    <View ref={ref} style={style}>
      <FieldBox
        control={control}
        end={steppersOf({
          canDecrement: state.canDecrement,
          canIncrement: state.canIncrement,
          decrementLabel: decrementLabel ?? `Decrease ${label}`,
          incrementLabel: incrementLabel ?? `Increase ${label}`,
          inline: steppers === 'horizontal',
          onBlur: () => {
            setStepperFocused(false)
          },
          onDecrement: announced(state.decrement),
          onFocus: () => {
            setStepperFocused(true)
          },
          onIncrement: announced(state.increment),
          outlined: variant === 'outlined',
        })}
        floatingLabel={floatingLabel}
        isDisabled={isDisabled}
        isFocused={focus.focused || stepperFocused}
        isInvalid={error !== undefined}
        isPopulated={state.inputValue !== ''}
        isRequired={isRequired}
        label={label}
        variant={variant}
      >
        <FieldInput
          {...props}
          {...focus.handlers}
          aria-label={label}
          autoComplete="off"
          autoCorrect={false}
          described={describedBy(id, { description, error })}
          editable={!isDisabled && !isReadOnly}
          keyboardType={keyboardOf(minValue, hasDecimals)}
          numeric={numeric}
          onChangeText={editInto(state)}
          onSubmitEditing={commitBefore<TextInputSubmitEditingEvent>(
            state,
            onSubmitEditing,
          )}
          ref={control}
          returnKeyType={returnKeyType}
          spellCheck={false}
          value={state.inputValue}
        />
      </FieldBox>
      <FieldMessage description={description} error={error} id={id} />
    </View>
  )
}

// The 48dp target a stacked stepper reaches to, all of its height on the
// side away from the other stepper, and its width either side.
function outwardSlop(
  half: number,
  place: 'bottom' | 'top',
): Insets | undefined {
  const slop = hitSlop(half, STEPPER_WIDTH)
  if (slop === undefined) {
    return undefined
  }

  const reach = (slop.top ?? 0) + (slop.bottom ?? 0)
  return place === 'top'
    ? { ...slop, bottom: 0, top: reach }
    : { ...slop, bottom: reach, top: 0 }
}

/**
 * One of the stacked pair: half the column, the glyph in on surface
 * variant, and the state layer, the ripple and the ring every control
 * draws, the ring inside it. Disabled at the end of the range, where the
 * glyph takes on surface at the disabled opacity.
 */
function Stepper({
  'aria-label': ariaLabel,
  children,
  half,
  isDisabled,
  onBlur,
  onFocus,
  onPress,
  onPressIn,
  onPressOut,
  outlined,
  place,
}: StepperProps) {
  const theme = useTheme()
  const styles = stylesOf(theme)
  const { colors, stateLayerOpacity } = theme
  const corner =
    place === 'top'
      ? styles.stepperTop
      : outlined
        ? styles.stepperBottomOutlined
        : undefined
  const feedback = usePressFeedback({
    color: colors.onSurfaceVariant,
    corners: corner,
    disabled: isDisabled,
    onBlur,
    onFocus,
    onPressIn,
    onPressOut,
  })

  return (
    <Pressable
      {...feedback.handlers}
      aria-label={ariaLabel}
      disabled={isDisabled}
      hitSlop={outwardSlop(half, place)}
      onPress={onPress}
      role="button"
      style={composeStyles<ViewStyle>(
        styles.stepper,
        corner,
        feedback.ring,
        feedback.ring === undefined ? undefined : styles.stepperRing,
      )}
    >
      {feedback.layer}
      <IconStyleContext
        value={glyphOf(
          isDisabled
            ? withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)
            : colors.onSurfaceVariant,
        )}
      >
        {children}
      </IconStyleContext>
    </Pressable>
  )
}

/**
 * The two steppers at the box's end, stacked or side by side, each
 * disabled where it would not move the value.
 */
function Steppers({
  canDecrement,
  canIncrement,
  decrementLabel,
  incrementLabel,
  inline,
  onBlur,
  onDecrement,
  onFocus,
  onIncrement,
  outlined,
}: SteppersProps) {
  const theme = useTheme()
  const styles = stylesOf(theme)
  const { fontScale } = useWindowDimensions()
  const { sizing, typography } = theme
  const up = useSpin(onIncrement, canIncrement)
  const down = useSpin(onDecrement, canDecrement)

  if (inline) {
    return (
      <View
        style={composeStyles<ViewStyle>(
          styles.steppersInline,
          marginVerticalOf(
            (typography.bodyLargeLineHeight * fontScale - sizing.controlXs) / 2,
          ),
        )}
      >
        <IconButton
          {...down}
          aria-label={decrementLabel}
          isDisabled={!canDecrement}
          onBlur={onBlur}
          onFocus={onFocus}
          size="xs"
        >
          <MinusGlyph />
        </IconButton>
        <IconButton
          {...up}
          aria-label={incrementLabel}
          isDisabled={!canIncrement}
          onBlur={onBlur}
          onFocus={onFocus}
          size="xs"
        >
          <PlusGlyph />
        </IconButton>
      </View>
    )
  }

  const half = halfOf(theme, outlined, fontScale)

  return (
    <View
      style={composeStyles<ViewStyle>(
        styles.steppers,
        outlined ? styles.steppersOutlined : undefined,
      )}
    >
      <Stepper
        {...up}
        aria-label={incrementLabel}
        half={half}
        isDisabled={!canIncrement}
        onBlur={onBlur}
        onFocus={onFocus}
        outlined={outlined}
        place="top"
      >
        <PlusGlyph />
      </Stepper>
      <Stepper
        {...down}
        aria-label={decrementLabel}
        half={half}
        isDisabled={!canDecrement}
        onBlur={onBlur}
        onFocus={onFocus}
        outlined={outlined}
        place="bottom"
      >
        <MinusGlyph />
      </Stepper>
    </View>
  )
}

// The steppers as the box's end, built by a call rather than written at the
// prop, which is what react-perf's no-jsx-as-prop is after.
function steppersOf(props: SteppersProps) {
  return <Steppers {...props} />
}

/**
 * A stepper's press handlers: a tap steps once, when it is released, and a
 * hold keeps stepping, from `SPIN_DELAY` on and every `SPIN_INTERVAL` after,
 * until the press ends or the value reaches its bound. A hold steps nothing
 * more on release, and a press the finger slides off steps nothing at all,
 * as React Aria's stepper does for a touch.
 */
function useSpin(step: () => void, canStep: boolean): Spin {
  // The step and whether it can move, as of the last render, since a hold
  // steps from timers that outlive the render that started them.
  const latest = useRef({ canStep, step })
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const spun = useRef(false)

  useEffect(() => {
    latest.current = { canStep, step }
  })
  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [],
  )

  const tick = () => {
    if (!latest.current.canStep) {
      return
    }
    spun.current = true
    latest.current.step()
    timer.current = setTimeout(tick, SPIN_INTERVAL)
  }

  return {
    onPress: () => {
      if (!spun.current) {
        latest.current.step()
      }
    },
    onPressIn: () => {
      clearTimeout(timer.current)
      spun.current = false
      timer.current = setTimeout(tick, SPIN_DELAY)
    },
    onPressOut: () => {
      clearTimeout(timer.current)
    },
  }
}

/**
 * Says the field's text after a stepper press, once the field has written
 * it, on iOS and Android, where the screen reader stays on the stepper.
 * Wrap each step in what it returns.
 */
function useStepAnnouncement(text: string) {
  const pending = useRef(false)

  useEffect(() => {
    if (pending.current) {
      pending.current = false
      AccessibilityInfo.announceForAccessibility(text)
    }
  }, [text])

  return (step: () => void) => () => {
    pending.current = Platform.OS === 'ios' || Platform.OS === 'android'
    step()
  }
}

export { NumberField }
export type { NumberFieldProps }
