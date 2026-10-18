import type { ComponentRef, ReactNode, Ref } from 'react'
import type {
  PressableProps,
  StyleProp,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { Color } from 'react-stately'
import type { ColorPickerState } from 'react-stately/useColorPickerState'

import { createContext, use } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useColorPickerState } from 'react-stately/useColorPickerState'

import { useLocaleOf, useMessages } from '../../i18n/provider'
import { hitSlop, usePressFeedback } from '../../press'
import {
  colorNameOf,
  colorOf,
  SwatchColorContext,
  usePickedColor,
} from '../../swatch'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { ColorSwatch } from '../color-swatch'

// A set of colours to choose one from, as kanso-ui's ColorSwatchPicker draws
// it: each a swatch, one of them chosen. Material Design carries no page for
// this either, so what an item looks like when it is chosen is the library's
// own, and web's choices hold here.
//
// **Selection is a ring around the swatch, not a mark on it.** A tick drawn
// over a colour has to be readable against every colour in the set, which no
// single ink is; a ring sits outside the swatch and needs only to read
// against the surface behind it. It is 2dp of primary with 2dp clear of the
// swatch, the border of a view laid around it, so it leaves the colour whole
// and is not a shadow, which a high-contrast mode drops. Its corner follows
// the swatch's 4dp further out, and stays square where a scheme squares the
// swatch.
//
// **Hover and press are a ring too, in the place selection takes.** Every
// other interactive element here answers the pointer with a state layer, but
// a state layer is a fill and a swatch's fill is the colour being chosen. So
// an unchosen swatch takes a ring where the chosen one's would be, in the
// outline roles rather than primary so it cannot be read as chosen: outline
// variant under a pointer, and outline while it is pressed.
//
// **Focus is an outline further out**, 2dp of primary 6dp from the swatch,
// so a swatch that is chosen and focused keeps both rings.
//
// The value is React Stately's colour picker state, as React Aria's own
// picker holds it, and an item stands for its colour in hexadecimal with its
// alpha, so two items of one colour are one choice. A screen reader hears a
// radio group, named "Color swatches" in the locale unless `aria-label` or
// `aria-labelledby` names it, and each swatch a radio named by its colour and
// reporting whether it is checked; what the item draws is hidden from it,
// since the radio's name already says it.
//
// Two departures from web. The arrow keys do not move between the swatches:
// each is a stop of its own for a hardware keyboard, and activating it there
// chooses it. And `layout` says how the swatches are laid out rather than
// which keys move between them, since there are none: a grid wraps them onto
// rows, and a stack lines them up in one column, as React Aria's own stack
// does.

type ColorSwatchPickerItemProps = Omit<
  PressableProps,
  'children' | 'disabled' | 'style'
> & {
  /**
   * What the item draws. A `ColorSwatch` by default, which draws the item's
   * colour, as any `ColorSwatch` inside it does unless given one of its own.
   */
  readonly children?: ReactNode
  /**
   * The colour the item stands for: a CSS colour string, or a `Color` from
   * `parseColor`. The item is named by it unless given an `aria-label`.
   * @default '#0000'
   */
  readonly color?: Color | string
  /**
   * Rules the colour out, so the swatch cannot be chosen.
   * @default false
   */
  readonly isDisabled?: boolean
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
}

/** How a `ColorSwatchPicker` lays out its swatches. */
type ColorSwatchPickerLayout = 'grid' | 'stack'

type ColorSwatchPickerProps = Omit<ViewProps, 'children' | 'style'> & {
  /** The swatches, each a `ColorSwatchPicker.Item` with a `color`. */
  readonly children?: ReactNode
  /**
   * The colour chosen at first, when the picker keeps its own value: a CSS
   * colour string, or a `Color` from `parseColor`.
   */
  readonly defaultValue?: Color | string
  /**
   * Whether the swatches wrap onto rows, or line up in one column.
   * @default 'grid'
   */
  readonly layout?: ColorSwatchPickerLayout
  /** Called with the item's colour when another swatch is chosen. */
  readonly onChange?: (value: Color) => void
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
  /** The colour chosen, when the call site holds the value. */
  readonly value?: Color | string
}

// The swatch's side, which the item's target is brought up to 48dp from, and
// the ring's width and the room it keeps clear of the swatch.
const SWATCH = 40
const RING = 2
const RING_GAP = 2
const FOCUS_OFFSET = 6

const PickerContext = createContext<ColorPickerState | null>(null)

const styles = StyleSheet.create({
  stack: {
    flexDirection: 'column',
  },
})

const stylesOf = themedStyles(({ colors, radii, spacing, stateLayerOpacity }) =>
  StyleSheet.create({
    disabled: {
      opacity: stateLayerOpacity.disabledContent,
    },
    focused: {
      outlineColor: colors.primary,
      outlineOffset: FOCUS_OFFSET,
      outlineStyle: 'solid',
      outlineWidth: RING,
    },
    hovered: {
      borderColor: colors.outlineVariant,
    },
    item: {
      borderRadius: radii.xs,
    },
    picker: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    pressed: {
      borderColor: colors.outline,
    },
    ring: {
      borderRadius: radii.xs + Math.min(radii.xs, RING + RING_GAP),
      borderWidth: RING,
      bottom: -(RING + RING_GAP),
      left: -(RING + RING_GAP),
      pointerEvents: 'none',
      position: 'absolute',
      right: -(RING + RING_GAP),
      top: -(RING + RING_GAP),
    },
    selected: {
      borderColor: colors.primary,
    },
  }),
)

const REACH = hitSlop(SWATCH, SWATCH)

// A press on a swatch: the call site's own `onPress`, then the choice, which
// the chosen swatch leaves as it is, as React Aria's picker keeps its one
// choice. Built by a call rather than declared in the component, which is
// what react-perf's jsx-no-new-function-as-prop is after; the React Compiler
// memoises the result on its inputs.
function chooseThen(
  state: ColorPickerState,
  color: Color,
  isSelected: boolean,
  onPress: PressableProps['onPress'],
) {
  return (event: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    onPress?.(event)

    if (!isSelected) {
      state.setColor(color)
    }
  }
}

/**
 * A set of colours to choose one from, drawn as swatches. Pass `value` with
 * `onChange` to control it, or `defaultValue`, as a CSS colour string or a
 * `Color` from `parseColor`, which this package re-exports.
 *
 * ```tsx
 * <ColorSwatchPicker defaultValue="#6750A4">
 *   <ColorSwatchPicker.Item color="#6750A4" />
 *   <ColorSwatchPicker.Item color="#625B71" />
 * </ColorSwatchPicker>
 * ```
 *
 * The chosen swatch carries a ring. A screen reader hears a radio group
 * named by `aria-label` or `aria-labelledby`, and "Color swatches" in the
 * `I18nProvider`'s locale otherwise. `style`, `ref` and `testID` land on the
 * set as a whole, which is the element a layout positions.
 *
 * Inside a `ColorPicker` it takes the picker's colour where it is given no
 * `value`, and reports a change to the picker before its own `onChange`.
 */
function ColorSwatchPicker({
  'aria-label': ariaLabel,
  children,
  defaultValue,
  layout = 'grid',
  onChange,
  style,
  value,
  ...props
}: ColorSwatchPickerProps) {
  const own = stylesOf(useTheme())
  const messages = useMessages()
  const picked = usePickedColor(value, onChange)
  const state = useColorPickerState({
    defaultValue,
    onChange: picked.onChange,
    value: picked.value,
  })
  const label =
    ariaLabel ??
    (props['aria-labelledby'] === undefined
      ? messages.colorSwatches
      : undefined)

  return (
    <View
      {...props}
      aria-label={label}
      role="radiogroup"
      style={composeStyles<ViewStyle>(
        own.picker,
        layout === 'stack' ? styles.stack : undefined,
        style,
      )}
    >
      <PickerContext value={state}>{children}</PickerContext>
    </View>
  )
}

/**
 * One swatch in a {@link ColorSwatchPicker}, which chooses its `color` when
 * pressed. Draws a `ColorSwatch` of that colour unless given other children,
 * and is named by the colour in the picker's locale.
 *
 * `style`, `ref` and `testID` land on the pressable item around the swatch.
 */
function ColorSwatchPickerItem({
  'aria-label': ariaLabel,
  children,
  color: own = '#0000',
  isDisabled = false,
  onPress,
  style,
  ...props
}: ColorSwatchPickerItemProps) {
  const theme = useTheme()
  const state = use(PickerContext)
  const locale = useLocaleOf(undefined)
  const messages = useMessages()
  const color = colorOf(own)
  const feedback = usePressFeedback({
    color: theme.colors.primary,
    disabled: isDisabled,
    disableRipple: true,
  })

  if (state === null) {
    throw new Error(
      'A ColorSwatchPicker.Item is drawn inside a ColorSwatchPicker, which holds its value.',
    )
  }

  const styled = stylesOf(theme)
  const isSelected = state.color.toString('hexa') === color.toString('hexa')
  const ring = ringOf(styled, {
    hovered: feedback.hovered,
    isSelected,
    pressed: feedback.pressed,
  })

  return (
    <Pressable
      aria-checked={isSelected}
      aria-label={ariaLabel ?? colorNameOf(color, locale, messages.transparent)}
      role="radio"
      {...props}
      {...feedback.handlers}
      disabled={isDisabled}
      hitSlop={REACH}
      onPress={chooseThen(state, color, isSelected, onPress)}
      style={composeStyles<ViewStyle>(
        styled.item,
        feedback.ring === undefined ? undefined : styled.focused,
        isDisabled ? styled.disabled : undefined,
        style,
      )}
    >
      <View aria-hidden>
        <SwatchColorContext value={color}>
          {children ?? <ColorSwatch />}
        </SwatchColorContext>
      </View>
      {ring === undefined ? null : (
        <View style={composeStyles<ViewStyle>(styled.ring, ring)} />
      )}
    </Pressable>
  )
}

// The ring a swatch draws, if any: primary while chosen, which the pointer
// cannot take away, else outline while pressed and outline variant while a
// pointer is over it. A disabled swatch reports neither.
function ringOf(
  styled: ReturnType<typeof stylesOf>,
  {
    hovered,
    isSelected,
    pressed,
  }: { hovered: boolean; isSelected: boolean; pressed: boolean },
): undefined | ViewStyle {
  if (isSelected) {
    return styled.selected
  }
  if (pressed) {
    return styled.pressed
  }
  return hovered ? styled.hovered : undefined
}

ColorSwatchPicker.Item = ColorSwatchPickerItem

export { ColorSwatchPicker, ColorSwatchPickerItem }
export type {
  ColorSwatchPickerItemProps,
  ColorSwatchPickerLayout,
  ColorSwatchPickerProps,
}
