import type { ComponentRef, ReactNode, Ref, RefObject } from 'react'
import type {
  HostInstance,
  LayoutChangeEvent,
  StyleProp,
  TextInputProps,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle, DerivedValue } from 'react-native-reanimated'

import {
  createContext,
  use,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AccessibilityInfo,
  Text as NativeText,
  Platform,
  Pressable,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated'

import type { Focusable } from '../form'
import type { IconStyle } from '../glyphs/icon-style'
import type { ResolvedTheme } from '../theme/scope'

import { useInsideForm } from '../form'
import { IconStyleContext } from '../glyphs/icon-style'
import { limitFor } from '../i18n'
import { useLocaleOf } from '../i18n/provider'
import { formatCount } from '../number/count'
import { usePressFeedback } from '../press'
import { withOpacity } from '../theme/color'
import { useTheme } from '../theme/scope'
import { composeStyles } from '../theme/styles'
import { useFontFamily } from '../typography/fonts'
import { useTypeRole } from '../typography/roles'
import { fieldStylesOf } from './styles'

// The chrome every field shares, as on web: the box with its label, the
// control inside it, and the line of supporting text under it. Each field is
// the parts it renders inside a root of its own, and these are not exported
// from the package.
//
// The text fields page draws two boxes. The filled one carries surface
// container highest with an active indicator along its bottom, 1dp in the
// outline role at rest and 2dp in primary while focused, and its label floats
// within it. The outlined one has no fill and a 1dp outline all round that
// thickens the same way, and its label floats up onto the outline, cutting a
// notch in it.
//
// **The label floats by changing its type and its place**, eased by
// Reanimated over `durationShort3` on the standard curve, as web transitions
// them: body large on the value's line while the field is empty and
// unfocused, body small at the top once it is focused or holds a value.
// `floatingLabel={false}` keeps it small at the top in label medium, as web's
// fixed label is. Under reduced motion it moves at once.
//
// **The box grows with the device's text size.** Its height is a floor rather
// than a height, the padding above and below plus the lines it holds, and the
// lines are the type tokens' line heights at the device's font scale, which
// is what React Native draws the text at. So the 56dp the page gives is the
// floor at the default text size, and a larger one makes the box taller
// rather than running the value out of it.
//
// **The outline is drawn from views**, since there is no fieldset to cut it:
// three pieces in a row, the stretch before the label, the notch under it,
// which draws only the bottom of the outline, and the stretch after it. The
// notch is the label's width in its floated type, measured from a copy of it
// out of sight, as web's legend holds one. Before the label floats it is
// closed, and the two stretches meet.
//
// **A pointer over the filled box draws the state layer**, the one every
// control draws through `usePressFeedback`, on surface at the hover opacity,
// and turns the indicator on surface, as the page's hovered state does; one
// over the outlined box turns the outline on surface. Web's filled box draws
// neither. Focus wins over hover, and an error takes the
// error role, or on error container under a pointer.
//
// **Disabled is the page's colour at an opacity, translucent**: the filled
// container and the rule are on surface at the `disabledContainer` opacity,
// and the label, the value and the icons on surface at `disabledContent`,
// over whatever the field sits on rather than mixed over the surface role as
// web's are.

// What a control needs to know about the box around it: how the label is
// drawn, whether the control clears it, and the states it takes its colours
// from.
type BoxControl = {
  readonly disabled: boolean
  readonly floated: boolean
  readonly invalid: boolean
  readonly label: 'fixed' | 'floating' | 'none'
  readonly required: boolean
  readonly underLabel: boolean
}

type DescribedBy = Pick<ViewProps, 'accessibilityHint'> & {
  readonly 'aria-describedby'?: string
}

type FieldBoxProps = {
  readonly children?: ReactNode
  /**
   * The control the box focuses when it is pressed anywhere, as the whole
   * of a native text field's box takes a press.
   */
  readonly control?: RefObject<Focusable | null>
  /**
   * What the box holds after the label and the control's column, drawn as
   * it is rather than in an icon's slot, for a part laid out against the
   * box's own edges: a number field's steppers. The column, and the label
   * in it, end where this starts, 16dp before it.
   */
  readonly end?: ReactNode
  /**
   * Whether the label sits in the empty box and floats to the top once the
   * field is focused or holds a value. `false` keeps it small at the top.
   * @default true
   */
  readonly floatingLabel?: boolean
  /** @default false */
  readonly isDisabled?: boolean
  /** Whether the control has focus, which the box draws. */
  readonly isFocused?: boolean
  /** @default false */
  readonly isInvalid?: boolean
  /** Whether the control holds anything, which floats the label. */
  readonly isPopulated?: boolean
  /**
   * Marks the label with an asterisk, as the text fields page marks a field
   * that must be filled.
   * @default false
   */
  readonly isRequired?: boolean
  /** What the field is for. */
  readonly label: string
  /** An icon at the start of the box, before the label and the control. */
  readonly leading?: ReactNode
  /**
   * The box itself, which a field opening a list from it measures to place
   * the list.
   */
  readonly ref?: Ref<HostInstance>
  /** An icon at the end of the box, after the control. */
  readonly trailing?: ReactNode
  /**
   * Makes the box itself the control, for a field holding something chosen
   * rather than typed: a button a screen reader reads by `aria-label`, which
   * a press anywhere on the box runs, in place of a `control` to focus.
   */
  readonly trigger?: FieldTriggerProps
  /** @default 'filled' */
  readonly variant?: FieldVariant
}

/**
 * One piece of what describes a field's control: the text a screen reader
 * hears on iOS and Android, and the id of the element showing it, which the
 * control points at under React Native Web.
 */
type FieldDescriptionPart = {
  readonly id: string
  readonly text: string
}

type FieldInputProps = Omit<
  TextInputProps,
  | 'accessibilityHint'
  | 'cursorColor'
  | 'multiline'
  | 'numberOfLines'
  | 'placeholderTextColor'
  | 'rows'
  | 'selectionColor'
  | 'style'
  | 'underlineColorAndroid'
> & {
  /**
   * Whether a multi-line control grows with the text it holds, from `rows`
   * up. `false` holds it at `rows` and scrolls the text inside.
   * @default true
   */
  readonly autosize?: boolean
  /**
   * The options a field holding several has chosen, written as one list,
   * drawn before the control on its line in the value's own role and cut
   * short with an ellipsis where the line runs out. The control keeps three
   * characters' width beside them at the least, so there is always
   * somewhere to type, and is described by them first.
   */
  readonly chosen?: string
  /** What describes the control, after its prefix and suffix. */
  readonly described?: readonly FieldDescriptionPart[]
  /**
   * Whether the control holds several lines rather than one, the return key
   * starting a new one.
   * @default false
   */
  readonly multiline?: boolean
  /**
   * The value in the mono face with tabular figures.
   * @default false
   */
  readonly numeric?: boolean
  /** Text before the value on its line. */
  readonly prefix?: ReactNode
  readonly ref?: Ref<ComponentRef<typeof TextInput>>
  /**
   * How many lines a multi-line control shows: the least it shows while it
   * grows, or all it shows when it does not.
   * @default 1
   */
  readonly rows?: number
  /** Text after the value on its line. */
  readonly suffix?: ReactNode
}

type FieldMessageProps = {
  /**
   * Counts the characters, against `maxLength` where there is one.
   * @default false
   */
  readonly characterCount?: boolean
  /** How the limit is said to a screen reader. */
  readonly characterLimitLabel?: string | undefined
  /** The hint, which the error replaces while there is one. */
  readonly description?: string | undefined
  /** The problem with the value, in words. */
  readonly error?: string | undefined
  /** The field's id, as handed to {@link describedBy}. */
  readonly id: string
  /** How many characters the control holds. */
  readonly length?: number
  readonly maxLength?: number | undefined
}

type FieldState = {
  readonly disabled: boolean
  readonly focused: boolean
  readonly hovered: boolean
  readonly invalid: boolean
}

type FieldStatesProps = {
  readonly children?: ReactNode
  /** @default false */
  readonly isDisabled?: boolean
  /** @default false */
  readonly isInvalid?: boolean
  /** @default false */
  readonly isRequired?: boolean
}

type FieldStrokeProps = StrokeMotion & {
  /** Every side of the view, or the top alone. */
  readonly sides: 'all' | 'top'
  readonly style: StyleProp<ViewStyle>
}

/**
 * What a box that is itself the control is read and pressed as: web's
 * `FieldTrigger`, which covers the box with one press target.
 */
type FieldTriggerProps = {
  /** Whether what the box opens is open, which a screen reader reads. */
  readonly 'aria-expanded'?: boolean
  /** The name a screen reader reads: the label, then the value shown. */
  readonly 'aria-label': string
  /** What describes the box, the line under it, as a control is described. */
  readonly described?: readonly FieldDescriptionPart[]
  readonly onBlur?: () => void
  readonly onFocus?: () => void
  readonly onPress: () => void
  readonly testID?: string
}

type FieldValueProps = {
  /** The value, or the placeholder. */
  readonly children?: ReactNode
  /**
   * Whether nothing has been chosen, so what is drawn is the placeholder,
   * in the muted role, and under a label at rest on its line not at all.
   * @default false
   */
  readonly isPlaceholder?: boolean
}

/**
 * The filled box, or the outlined one: no fill, an outline that thickens and
 * takes the primary role while focused, and the label cutting it once it
 * floats, the text fields page's two fields.
 */
type FieldVariant = 'filled' | 'outlined'

// Where the label is and what type it is in, at rest or floated.
type LabelPlace = {
  readonly fontSize: number
  readonly letterSpacing: number
  readonly lineHeight: number
  readonly top: number
}

// The control's state as React Native Web hands it to a browser, which reads
// `aria-invalid` and `aria-required` off the input. React Native has neither.
// A rule's colour and width as they ease.
type StrokeMotion = {
  readonly color: DerivedValue<string>
  readonly width: DerivedValue<number>
}

type WebState = {
  readonly 'aria-invalid'?: true
  readonly 'aria-required'?: true
}

// The page's icon, which the box's outline is laid out around.
const ICON_SIZE = 24

// A control outside any box has no label over it.
const OUTSIDE_BOX: BoxControl = {
  disabled: false,
  floated: true,
  invalid: false,
  label: 'none',
  required: false,
  underLabel: false,
}

const BoxContext = createContext<BoxControl>(OUTSIDE_BOX)

// Whether a FieldSegments sits on the line of another, as a date range
// picker's two dates sit on the one line it draws, which clears the label
// once for both.
const SegmentsLineContext = createContext(false)

const NO_PARTS: readonly FieldDescriptionPart[] = []

/**
 * How a field's control is described by the line under it: the error while
 * there is one, otherwise the description, then the limit where there is a
 * `maxLength`. Hand the result to {@link FieldInput} as `described`, and the
 * same `id` to {@link FieldMessage}.
 */
function describedBy(
  id: string,
  {
    characterLimitLabel,
    description,
    error,
    locale,
    maxLength,
  }: Pick<
    FieldMessageProps,
    'characterLimitLabel' | 'description' | 'error' | 'maxLength'
  > & {
    /**
     * The locale the limit is said in, the field's `useLocaleOf`, or the
     * device's when left out.
     */
    readonly locale?: string
  },
): readonly FieldDescriptionPart[] {
  const ids = idsOf(id)
  const message =
    error === undefined
      ? { id: ids.description, text: description ?? '' }
      : { id: ids.error, text: error }
  const limit = limitOf(maxLength, characterLimitLabel, locale)

  return [
    ...(message.text === '' ? [] : [message]),
    ...(limit === undefined ? [] : [{ id: ids.limit, text: limit }]),
  ]
}

/**
 * The box a control sits in, filled or outlined, with its label. Pressed
 * anywhere, it focuses its control, or runs its `trigger` where the box is
 * the control itself. The states it draws are handed to it, since the field
 * around it is what knows them.
 */
function FieldBox({
  children,
  control,
  end,
  floatingLabel = true,
  isDisabled = false,
  isFocused = false,
  isInvalid = false,
  isPopulated = false,
  isRequired = false,
  label,
  leading,
  ref,
  trailing,
  trigger,
  variant = 'filled',
}: FieldBoxProps) {
  const theme = useTheme()
  const styles = fieldStylesOf(theme)
  const { fontScale } = useWindowDimensions()
  const [notch, setNotch] = useState(0)
  const { colors, radii, spacing, stateLayerOpacity, typography } = theme
  // The hover layer alone: a text field's box takes no pressed or focus
  // layer, since the indicator and the label are what mark its focus.
  const feedback = usePressFeedback({
    color: colors.onSurface,
    corners: {
      borderTopEndRadius: radii.xs,
      borderTopStartRadius: radii.xs,
    },
    disabled: isDisabled,
    disableRipple: true,
  })
  const outlined = variant === 'outlined'
  const floated = !floatingLabel || isFocused || isPopulated
  const state: FieldState = {
    disabled: isDisabled,
    focused: isFocused,
    hovered: feedback.hovered,
    invalid: isInvalid,
  }
  const rule = useRuleMotion(theme, state)
  const boxControl = useMemo(
    () =>
      boxControlOf(
        floatingLabel,
        floated,
        isDisabled,
        isInvalid,
        isRequired,
        !outlined,
      ),
    [floatingLabel, floated, isDisabled, isInvalid, isRequired, outlined],
  )
  const disabledContent = withOpacity(
    colors.onSurface,
    stateLayerOpacity.disabledContent,
  )

  return (
    <Pressable
      {...(trigger === undefined ? NOT_A_CONTROL : triggerOf(trigger))}
      disabled={isDisabled}
      onHoverIn={feedback.handlers.onHoverIn}
      onHoverOut={feedback.handlers.onHoverOut}
      onPress={trigger?.onPress ?? focusOf(control)}
      ref={ref}
      style={composeStyles<ViewStyle>(
        styles.box,
        trigger === undefined ? undefined : styles.boxTrigger,
        leading === undefined ? undefined : styles.boxLeading,
        trailing === undefined ? undefined : styles.boxTrailing,
        outlined ? styles.boxOutlined : undefined,
        isDisabled && !outlined ? styles.boxDisabled : undefined,
        minHeightOf(
          outlined
            ? 2 * spacing.lg + typography.bodyLargeLineHeight * fontScale
            : 2 * spacing.sm +
                (typography.bodySmallLineHeight +
                  typography.bodyLargeLineHeight) *
                  fontScale,
        ),
      )}
    >
      {outlined ? (
        <View aria-hidden style={styles.outline}>
          <View
            style={composeStyles<ViewStyle>(
              styles.outlineStart,
              widthOf(outlineInset(spacing, leading)),
            )}
          >
            <FieldStroke
              color={rule.color}
              sides="all"
              style={styles.outlineStartBox}
              width={rule.width}
            />
          </View>
          <View
            style={composeStyles<ViewStyle>(
              styles.outlineNotch,
              widthOf(floated ? notch : 0),
            )}
          >
            <FieldStroke
              color={rule.color}
              sides="all"
              style={styles.outlineNotchBox}
              width={rule.width}
            />
          </View>
          <View
            style={composeStyles<ViewStyle>(
              styles.outlineEnd,
              minWidthOf(outlineInset(spacing, trailing)),
            )}
          >
            <FieldStroke
              color={rule.color}
              sides="all"
              style={styles.outlineEndBox}
              width={rule.width}
            />
          </View>
        </View>
      ) : (
        <>
          {feedback.layer}
          <FieldStroke
            color={rule.color}
            sides="top"
            style={styles.indicator}
            width={rule.width}
          />
        </>
      )}
      {leading === undefined ? null : (
        <View style={styles.icon}>
          <IconStyleContext
            value={iconStyleOf(
              isDisabled ? disabledContent : colors.onSurfaceVariant,
            )}
          >
            {leading}
          </IconStyleContext>
        </View>
      )}
      <View style={styles.column}>
        <BoxLabel
          floated={floated}
          floatingLabel={floatingLabel}
          isDisabled={isDisabled}
          isFocused={isFocused}
          isInvalid={isInvalid}
          isRequired={isRequired}
          variant={variant}
        >
          {label}
        </BoxLabel>
        {outlined ? (
          <NotchMeasure
            floatingLabel={floatingLabel}
            isRequired={isRequired}
            onMeasure={setNotch}
          >
            {label}
          </NotchMeasure>
        ) : null}
        <BoxContext value={boxControl}>{children}</BoxContext>
      </View>
      {end}
      {trailing === undefined ? null : (
        <View style={styles.icon}>
          <IconStyleContext
            value={iconStyleOf(
              isDisabled
                ? disabledContent
                : isInvalid
                  ? colors.error
                  : colors.onSurfaceVariant,
            )}
          >
            {trailing}
          </IconStyleContext>
        </View>
      )}
    </Pressable>
  )
}

/**
 * A field's text control, in a {@link FieldBox}, or in {@link FieldStates}
 * inside a container of a field's own. In a box it clears the label at the
 * top where the box is filled, and shows a prefix and a suffix only while the
 * label has floated, since at rest the label sits on their line. It takes the
 * error role for its caret while the field has an error, and draws a
 * placeholder in the muted role.
 *
 * It is described by what it holds chosen, its prefix and its suffix, ahead
 * of what the field hands it in `described`, so a reader hears the options
 * chosen beside the text and the unit the value is read against as a sighted
 * one sees them on the value's line: on iOS and Android as its hint, and
 * under React Native Web through `aria-describedby`, which drops the hint.
 *
 * `multiline` makes it a text area, `rows` lines of body large tall at the
 * least, its text from the top. iOS and Android grow a multi-line input with
 * what it holds by themselves, so a height floor is all `autosize` asks of
 * them, and `autosize={false}` sets the height instead, which they scroll
 * inside. React Native Web's textarea keeps the height it is given, so there
 * the control lies over a hidden copy of `value` that takes the height the
 * text would, as web's text area lies over its replica. A control that grows
 * is therefore handed its `value`.
 */
function FieldInput({
  autosize = true,
  chosen = '',
  described = NO_PARTS,
  multiline = false,
  numeric = false,
  prefix,
  rows = 1,
  suffix,
  ...props
}: FieldInputProps) {
  const box = use(BoxContext)
  const theme = useTheme()
  const styles = fieldStylesOf(theme)
  const { fontScale } = useWindowDimensions()
  const role = useTypeRole('bodyLarge')
  const mono = useFontFamily(theme.typography.fontFamilyMono)
  const id = useId()
  const { colors, stateLayerOpacity, typography } = theme
  const content = box.disabled
    ? withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)
    : colors.onSurface
  const caret = box.invalid ? colors.error : colors.primary
  const muted = box.disabled
    ? withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)
    : colors.onSurfaceVariant
  const affixed = prefix !== undefined || suffix !== undefined
  const holdsChosen = chosen !== ''
  const clearance = box.underLabel
    ? marginTopOf(typography.bodySmallLineHeight * fontScale)
    : undefined
  const affixStyle = composeStyles<TextStyle>(role, colorOf(muted))
  const lines =
    typography.bodyLargeLineHeight * fontScale * (multiline ? rows : 1)
  const copied = multiline && autosize && Platform.OS === 'web'
  const extent = multiline && !autosize ? heightOf(lines) : minHeightOf(lines)

  const control = (
    <TextInput
      {...(Platform.OS === 'web' ? INHERITS_DIRECTION : undefined)}
      {...props}
      {...descriptionOf([
        ...affixPart(`${id}-chosen`, holdsChosen ? chosen : undefined),
        ...affixPart(`${id}-prefix`, prefix),
        ...affixPart(`${id}-suffix`, suffix),
        ...described,
      ])}
      {...webStateOf(box)}
      aria-disabled={box.disabled}
      cursorColor={caret}
      multiline={multiline}
      placeholderTextColor={muted}
      selectionColor={caret}
      style={composeStyles<TextStyle>(
        role,
        styles.input,
        colorOf(content),
        numeric ? numericOf(mono) : undefined,
        multiline ? styles.inputMultiline : undefined,
        copied ? styles.inputOverCopy : extent,
        holdsChosen
          ? minWidthOf(CHOSEN_ROOM * typography.bodyLargeSize * fontScale)
          : undefined,
        affixed || copied || holdsChosen ? undefined : clearance,
      )}
      underlineColorAndroid="transparent"
    />
  )

  if (copied) {
    // The space keeps a final line break a line of the copy, as the control
    // draws one.
    return (
      <View style={composeStyles<ViewStyle>(styles.copied, clearance)}>
        <NativeText
          aria-hidden
          style={composeStyles<TextStyle>(role, styles.copy, extent)}
        >
          {`${props.value ?? ''} `}
        </NativeText>
        {control}
      </View>
    )
  }

  if (!affixed && !holdsChosen) {
    return control
  }

  return (
    <View style={composeStyles<ViewStyle>(styles.affixLine, clearance)}>
      {holdsChosen ? (
        <NativeText
          id={`${id}-chosen`}
          numberOfLines={1}
          style={composeStyles<TextStyle>(role, colorOf(content), SHRINKS)}
        >
          {chosen}
        </NativeText>
      ) : null}
      {prefix === undefined ? null : (
        <Affix floated={box.floated} id={`${id}-prefix`} style={affixStyle}>
          {prefix}
        </Affix>
      )}
      {control}
      {suffix === undefined ? null : (
        <Affix floated={box.floated} id={`${id}-suffix`} style={affixStyle}>
          {suffix}
        </Affix>
      )}
    </View>
  )
}

/**
 * The line under a field: the error while there is one, the description
 * otherwise, and the count of characters at its end. With nothing to show it
 * is out of the flow, so the field ends at its box. Inside a form it is drawn
 * anyway, empty, since a form is where an error arrives after the fact, from
 * a server or on a submission, and every field below this one would
 * otherwise move by the line's height when it does.
 *
 * On iOS and Android the control reads the line out as its hint, so the line
 * itself is hidden from VoiceOver and TalkBack rather than read twice. An
 * error is announced as it arrives, since a hint that changes is not read
 * again: on iOS through `announceForAccessibility`, and on Android, where the
 * error is left reachable for it, by a polite live region around it, which
 * is also what announces it under React Native Web. An error the field opens
 * with is not announced, as a live region in a browser does not read what it
 * was mounted holding.
 *
 * The count is hidden everywhere. It changes on every keystroke, and read
 * back at that rate it is worse than not hearing it, so the limit is said
 * once in the control's description instead.
 */
function FieldMessage({
  characterCount = false,
  characterLimitLabel,
  description,
  error,
  id,
  length = 0,
  maxLength,
}: FieldMessageProps) {
  const theme = useTheme()
  const styles = fieldStylesOf(theme)
  const role = useTypeRole('bodySmall')
  const { fontScale } = useWindowDimensions()
  const ids = idsOf(id)
  const invalid = error !== undefined
  const locale = useLocaleOf(undefined)
  const limit = limitOf(maxLength, characterLimitLabel, locale)
  const insideForm = useInsideForm()
  const collapsed =
    !invalid && description === undefined && !characterCount && !insideForm
  const { colors, typography } = theme
  const messageStyle = composeStyles<TextStyle>(
    role,
    colorOf(invalid ? colors.error : colors.onSurfaceVariant),
    SHRINKS,
  )

  useErrorAnnouncement(error)

  return (
    <View
      style={composeStyles<ViewStyle>(
        styles.messageLine,
        collapsed
          ? styles.messageLineCollapsed
          : minHeightOf(typography.bodySmallLineHeight * fontScale),
      )}
    >
      <View
        aria-live="polite"
        {...(Platform.OS === 'web' ? ATOMIC : undefined)}
        {...(Platform.OS === 'ios' ? HIDDEN : undefined)}
        style={invalid && error !== '' ? SHRINKS : OUT_OF_FLOW}
      >
        {invalid && error !== '' ? (
          <NativeText id={ids.error} style={messageStyle}>
            {error}
          </NativeText>
        ) : null}
      </View>
      {invalid || description === undefined ? null : (
        <NativeText
          {...(Platform.OS === 'web' ? undefined : HIDDEN)}
          id={ids.description}
          style={messageStyle}
        >
          {description}
        </NativeText>
      )}
      {limit === undefined || Platform.OS !== 'web' ? null : (
        <NativeText id={ids.limit} style={NOT_DRAWN}>
          {limit}
        </NativeText>
      )}
      {characterCount ? (
        <NativeText
          aria-hidden
          style={composeStyles<TextStyle>(messageStyle, styles.counter)}
        >
          {countOf(length, maxLength, locale)}
        </NativeText>
      ) : null}
    </View>
  )
}

/**
 * A date or a time's segments on the value's line of a {@link FieldBox}, in
 * a row, clearing the label at the top where the box is filled, as a control
 * does: web's `FieldSegments`. One inside another is a row on the outer
 * one's line, which has already cleared the label.
 */
function FieldSegments({ children }: { readonly children?: ReactNode }) {
  const box = use(BoxContext)
  const onLine = use(SegmentsLineContext)
  const theme = useTheme()
  const styles = fieldStylesOf(theme)
  const { fontScale } = useWindowDimensions()

  return (
    <View
      style={composeStyles<ViewStyle>(
        styles.segments,
        box.underLabel && !onLine
          ? marginTopOf(theme.typography.bodySmallLineHeight * fontScale)
          : undefined,
      )}
    >
      <SegmentsLineContext value>{children}</SegmentsLineContext>
    </View>
  )
}

/**
 * Hands a control outside a box the states it is drawn in, for a field that
 * draws a container of its own around the control, as SearchField's bar is.
 * The control takes its colours and the state a screen reader reads from
 * these, as it does from the box around it.
 */
function FieldStates({
  children,
  isDisabled = false,
  isInvalid = false,
  isRequired = false,
}: FieldStatesProps) {
  const states = useMemo(
    () => ({
      ...OUTSIDE_BOX,
      disabled: isDisabled,
      invalid: isInvalid,
      required: isRequired,
    }),
    [isDisabled, isInvalid, isRequired],
  )

  return <BoxContext value={states}>{children}</BoxContext>
}

/**
 * A field's value where it was chosen rather than typed, on the value's line
 * of a {@link FieldBox} whose `trigger` makes the box the control: body
 * large, one line cut short with an ellipsis, clearing the label at the top
 * as a control does. Hidden from a screen reader, which reads the value in
 * the trigger's name.
 *
 * `isPlaceholder` says nothing has been chosen, which takes the muted role;
 * under a floating label at rest it is not drawn until the label floats,
 * exactly as an input's placeholder is, so the two never overlap.
 *
 * On web the value opens with a space, which a browser drops at the start
 * of the line. It keeps the label and the value two words in the box's text,
 * which axe reads as one string with nothing between its parts, and holds to
 * the trigger's name, as WCAG's label in name asks; without it the label
 * runs into the value's first word.
 */
function FieldValue({ children, isPlaceholder = false }: FieldValueProps) {
  const box = use(BoxContext)
  const theme = useTheme()
  const { fontScale } = useWindowDimensions()
  const role = useTypeRole('bodyLarge')
  const { colors, stateLayerOpacity, typography } = theme
  const color =
    isPlaceholder && !box.floated
      ? 'transparent'
      : box.disabled
        ? withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)
        : isPlaceholder
          ? colors.onSurfaceVariant
          : colors.onSurface

  return (
    <NativeText
      aria-hidden
      numberOfLines={1}
      style={composeStyles<TextStyle>(
        role,
        colorOf(color),
        box.underLabel
          ? marginTopOf(typography.bodySmallLineHeight * fontScale)
          : undefined,
      )}
    >
      {Platform.OS === 'web' ? ' ' : null}
      {children}
    </NativeText>
  )
}

/**
 * What a field holds on lines that wrap, on the value's line of a
 * {@link FieldBox}: a token field's pills, with its control after them. It
 * clears the label at the top where the box is filled, once for every line,
 * as a control does, and the control inside takes the box's states without
 * clearing it again.
 */
function FieldWrap({ children }: { readonly children?: ReactNode }) {
  const box = use(BoxContext)
  const theme = useTheme()
  const styles = fieldStylesOf(theme)
  const { fontScale } = useWindowDimensions()
  const inside = useMemo(() => ({ ...box, underLabel: false }), [box])

  return (
    <View
      style={composeStyles<ViewStyle>(
        styles.wrap,
        box.underLabel
          ? marginTopOf(theme.typography.bodySmallLineHeight * fontScale)
          : undefined,
      )}
    >
      <BoxContext value={inside}>{children}</BoxContext>
    </View>
  )
}

/**
 * Tracks whether the control has focus, around the handlers the field was
 * given, which are called after.
 */
function useFieldFocus({
  onBlur,
  onFocus,
}: Pick<TextInputProps, 'onBlur' | 'onFocus'>) {
  const [focused, setFocused] = useState(false)

  return {
    focused,
    handlers: {
      onBlur: ((event) => {
        setFocused(false)
        onBlur?.(event)
      }) satisfies TextInputProps['onBlur'],
      onFocus: ((event) => {
        setFocused(true)
        onFocus?.(event)
      }) satisfies TextInputProps['onFocus'],
    },
  }
}

// What a web-only atomic live region adds, so a changed message is read whole.
// React Native's types carry no `aria-atomic`, which React Native Web takes.
const ATOMIC = { 'aria-atomic': true } as const

// What hides a part of the line under a field from VoiceOver and TalkBack,
// where the control reads it out as its hint.
const HIDDEN = { 'aria-hidden': true } as const

// What leaves the control's writing direction to the page under React Native
// Web, which gives a TextInput `dir="auto"` otherwise and so aligns a value by
// its own script: a Latin value at the left of a right-to-left field, away
// from its label. Null rather than left out, since left out is what it writes
// `auto` for. React Native's types carry no `dir`.
const INHERITS_DIRECTION = { dir: null } as const

// A box around a control of its own: the press lands on the box and moves
// focus to the control, which is what a screen reader and a keyboard reach.
const NOT_A_CONTROL = { accessible: false, focusable: false } as const

// The limit under React Native Web: in the document for the control to point
// at, and drawn nowhere.
const NOT_DRAWN: TextStyle = { display: 'none' }

// The live region with nothing in it, which takes no place in the line.
const OUT_OF_FLOW: ViewStyle = { position: 'absolute' }

const SHRINKS: TextStyle = { flexShrink: 1 }

// How many characters' width a control holding chosen options keeps beside
// them, in its own type's size, web's 3em.
const CHOSEN_ROOM = 3

/**
 * A prefix or a suffix, faded in once the label has floated and out when it
 * comes back to rest, over the label's own `durationShort3`.
 */
function Affix({
  children,
  floated,
  id,
  style,
}: {
  readonly children: ReactNode
  readonly floated: boolean
  readonly id: string
  readonly style: StyleProp<TextStyle>
}) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const opacity = floated ? 1 : 0
  const timing = {
    duration: motion.durationShort3,
    easing: Easing.bezier(...motion.easingStandard),
  }
  const fade = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: reduceMotion ? opacity : withTiming(opacity, timing),
    }
  })

  return (
    <Animated.Text
      id={id}
      style={composeStyles<AnimatedStyle<TextStyle>>(style, fade)}
    >
      {children}
    </Animated.Text>
  )
}

function affixPart(
  id: string,
  affix: ReactNode,
): readonly FieldDescriptionPart[] {
  if (affix === undefined) {
    return []
  }

  return [
    {
      id,
      text:
        typeof affix === 'string' || typeof affix === 'number'
          ? String(affix)
          : '',
    },
  ]
}

function boxControlOf(
  floatingLabel: boolean,
  floated: boolean,
  disabled: boolean,
  invalid: boolean,
  required: boolean,
  underLabel: boolean,
): BoxControl {
  return {
    disabled,
    floated,
    invalid,
    label: floatingLabel ? 'floating' : 'fixed',
    required,
    underLabel,
  }
}

/**
 * The box's label: one line, cut short with an ellipsis, moving between its
 * resting place and its floated one. Hidden from screen readers, since the
 * control is named by the same words.
 */
function BoxLabel({
  children,
  floated,
  floatingLabel,
  isDisabled,
  isFocused,
  isInvalid,
  isRequired,
  variant,
}: {
  readonly children: string
  readonly floated: boolean
  readonly floatingLabel: boolean
  readonly isDisabled: boolean
  readonly isFocused: boolean
  readonly isInvalid: boolean
  readonly isRequired: boolean
  readonly variant: FieldVariant
}) {
  const theme = useTheme()
  const styles = fieldStylesOf(theme)
  const { fontScale } = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  const large = useTypeRole('bodyLarge')
  const small = useTypeRole(floatingLabel ? 'bodySmall' : 'labelMedium')
  const { colors, motion, spacing, stateLayerOpacity, typography } = theme
  const outlined = variant === 'outlined'
  const smallRole = floatingLabel ? 'bodySmall' : 'labelMedium'
  const place: LabelPlace = floated
    ? {
        fontSize: typography[`${smallRole}Size`],
        letterSpacing: typography[`${smallRole}Tracking`],
        lineHeight: typography[`${smallRole}LineHeight`],
        top: outlined
          ? -(
              spacing.lg +
              (typography[`${smallRole}LineHeight`] * fontScale) / 2
            )
          : 0,
      }
    : {
        fontSize: typography.bodyLargeSize,
        letterSpacing: typography.bodyLargeTracking,
        lineHeight: typography.bodyLargeLineHeight,
        top: outlined ? 0 : (typography.bodySmallLineHeight * fontScale) / 2,
      }
  const color = isDisabled
    ? withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)
    : isInvalid
      ? colors.error
      : isFocused
        ? colors.primary
        : colors.onSurfaceVariant
  const timing = {
    duration: motion.durationShort3,
    easing: Easing.bezier(...motion.easingStandard),
  }

  const motionStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      color: reduceMotion ? color : withTiming(color, timing),
      fontSize: reduceMotion
        ? place.fontSize
        : withTiming(place.fontSize, timing),
      letterSpacing: reduceMotion
        ? place.letterSpacing
        : withTiming(place.letterSpacing, timing),
      lineHeight: reduceMotion
        ? place.lineHeight
        : withTiming(place.lineHeight, timing),
      top: reduceMotion ? place.top : withTiming(place.top, timing),
    }
  })

  return (
    <View
      aria-hidden
      style={composeStyles<ViewStyle>(
        styles.label,
        outlined ? styles.labelOutlined : undefined,
      )}
    >
      <Animated.Text
        numberOfLines={1}
        style={composeStyles<AnimatedStyle<TextStyle>>(
          floated ? small : large,
          outlined ? styles.labelTextOutlined : undefined,
          motionStyle,
        )}
      >
        {children}
        {isRequired ? REQUIRED_MARK : null}
      </Animated.Text>
    </View>
  )
}

function colorOf(color: string): TextStyle {
  return { color }
}

// The count in the locale's digits and grouping, as web writes it in the
// provider's.
function countOf(
  length: number,
  maxLength: number | undefined,
  locale: string,
) {
  return maxLength === undefined
    ? formatCount(length, locale)
    : `${formatCount(length, locale)}/${formatCount(maxLength, locale)}`
}

/**
 * What describes a control by `parts`, as a field's control is described: the
 * ids of the elements showing them under React Native Web, and their text as
 * the hint VoiceOver and TalkBack read out on iOS and Android.
 */
function descriptionOf(
  parts: readonly FieldDescriptionPart[],
): DescribedBy | undefined {
  if (Platform.OS === 'web') {
    return parts.length === 0
      ? undefined
      : { 'aria-describedby': parts.map((part) => part.id).join(' ') }
  }

  const said = parts.map((part) => part.text).filter((text) => text !== '')

  return said.length === 0 ? undefined : { accessibilityHint: said.join(' ') }
}

function focusOf(control: RefObject<Focusable | null> | undefined) {
  return () => {
    control?.current?.focus()
  }
}

function heightOf(height: number): ViewStyle {
  return { height }
}

function iconStyleOf(color: string): IconStyle {
  return { color, size: ICON_SIZE }
}

function idsOf(id: string) {
  return {
    description: `${id}-description`,
    error: `${id}-error`,
    limit: `${id}-limit`,
  }
}

/**
 * The limit in words where there is one: the field's own, or the library's
 * in `locale`.
 */
function limitOf(
  maxLength: number | undefined,
  label: string | undefined,
  locale: string | undefined,
) {
  if (maxLength === undefined) {
    return undefined
  }

  return label ?? limitFor(maxLength, locale)
}

function marginTopOf(marginTop: number): ViewStyle {
  return { marginTop }
}

function minHeightOf(minHeight: number): ViewStyle {
  return { minHeight }
}

function minWidthOf(minWidth: number): ViewStyle {
  return { minWidth }
}

/**
 * The label's text in its floated type, out of sight, measured for the
 * outlined box's notch.
 */
function NotchMeasure({
  children,
  floatingLabel,
  isRequired,
  onMeasure,
}: {
  readonly children: string
  readonly floatingLabel: boolean
  readonly isRequired: boolean
  readonly onMeasure: (width: number) => void
}) {
  const styles = fieldStylesOf(useTheme())
  const small = useTypeRole(floatingLabel ? 'bodySmall' : 'labelMedium')

  return (
    <View
      aria-hidden
      style={composeStyles<ViewStyle>(
        styles.label,
        styles.labelOutlined,
        styles.notchMeasure,
      )}
    >
      <NativeText
        numberOfLines={1}
        onLayout={widthTo(onMeasure)}
        style={composeStyles<TextStyle>(small, styles.labelTextOutlined)}
      >
        {children}
        {isRequired ? REQUIRED_MARK : null}
      </NativeText>
    </View>
  )
}

function numericOf(fontFamily: string | undefined): TextStyle {
  return { fontFamily, fontVariant: ['tabular-nums'] }
}

// How far an outline stretch reaches along the box before the label's place
// begins or after it ends: the box's padding at that end, and past an icon
// the page's 12dp, the icon and its 16dp, less the notch's own 4dp beside the
// label.
function outlineInset(spacing: ResolvedTheme['spacing'], icon: ReactNode) {
  return (
    (icon === undefined ? spacing.lg : spacing.md + ICON_SIZE + spacing.lg) -
    spacing.xs
  )
}

// The asterisk after a required field's label, which is how the text fields
// page marks one. In the label rather than beside it, so it floats and takes
// the label's colour with it.
const REQUIRED_MARK = '*'

/**
 * One view drawing a field's rule in its eased colour and width, from
 * {@link useStrokeMotion}: on every side, for the outlined box's outline,
 * which the piece around it clips, and a bar's ring, or on the top alone,
 * for the filled box's indicator.
 */
function FieldStroke({ color, sides, style, width }: FieldStrokeProps) {
  const stroke = useAnimatedStyle(() => {
    'worklet'
    return sides === 'all'
      ? { borderColor: color.get(), borderWidth: width.get() }
      : { borderColor: color.get(), borderTopWidth: width.get() }
  })

  return (
    <Animated.View
      aria-hidden
      style={composeStyles<AnimatedStyle<ViewStyle>>(style, stroke)}
    />
  )
}

/**
 * The box as the control: a button named by the trigger and described by the
 * line under the field, which a keyboard and a screen reader reach.
 */
function triggerOf({
  described = NO_PARTS,
  onPress: _onPress,
  ...trigger
}: FieldTriggerProps) {
  return {
    ...trigger,
    ...descriptionOf(described),
    role: 'button' as const,
  }
}

/**
 * Says an error on iOS as it arrives, where a live region says nothing. An
 * error the field opened with is not said, and neither is one that has not
 * changed.
 */
function useErrorAnnouncement(error: string | undefined) {
  const said = useRef(error)

  useEffect(() => {
    if (
      Platform.OS === 'ios' &&
      error !== undefined &&
      error !== '' &&
      error !== said.current
    ) {
      AccessibilityInfo.announceForAccessibility(error)
    }
    said.current = error
  }, [error])
}

/**
 * The rule the box draws, the filled box's indicator or the outlined box's
 * outline: its colour and its width by state.
 */
function useRuleMotion(theme: ResolvedTheme, state: FieldState) {
  const { colors, stateLayerOpacity } = theme
  const width = !state.disabled && state.focused ? 2 : 1
  const color = state.disabled
    ? withOpacity(colors.onSurface, stateLayerOpacity.disabledContainer)
    : state.focused
      ? state.invalid
        ? colors.error
        : colors.primary
      : state.hovered
        ? state.invalid
          ? colors.onErrorContainer
          : colors.onSurface
        : state.invalid
          ? colors.error
          : colors.outline

  return useStrokeMotion(color, width)
}

/**
 * A rule's colour and width, eased to each new pair over `durationShort2` as
 * web transitions them, and moved at once under reduced motion. Hand the
 * result to {@link FieldStroke}.
 */
function useStrokeMotion(color: string, width: number): StrokeMotion {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const timing = {
    duration: motion.durationShort2,
    easing: Easing.bezier(...motion.easingStandard),
  }

  return {
    color: useDerivedValue<string>(() =>
      reduceMotion ? color : withTiming(color, timing),
    ),
    width: useDerivedValue<number>(() =>
      reduceMotion ? width : withTiming(width, timing),
    ),
  }
}

function webStateOf(box: BoxControl): undefined | WebState {
  if (Platform.OS !== 'web') {
    return undefined
  }

  return {
    ...(box.invalid ? { 'aria-invalid': true } : undefined),
    ...(box.required ? { 'aria-required': true } : undefined),
  }
}

function widthOf(width: number): ViewStyle {
  return { width }
}

function widthTo(onMeasure: (width: number) => void) {
  return (event: LayoutChangeEvent) => {
    onMeasure(event.nativeEvent.layout.width)
  }
}

export { FieldChevron } from './chevron'

export {
  describedBy,
  descriptionOf,
  FieldBox,
  FieldInput,
  FieldMessage,
  FieldSegments,
  FieldStates,
  FieldStroke,
  FieldValue,
  FieldWrap,
  useErrorAnnouncement,
  useFieldFocus,
  useStrokeMotion,
}
export type {
  FieldBoxProps,
  FieldDescriptionPart,
  FieldInputProps,
  FieldMessageProps,
  FieldStatesProps,
  FieldStrokeProps,
  FieldTriggerProps,
  FieldValueProps,
  FieldVariant,
}
