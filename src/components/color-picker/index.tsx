import type { ComponentRef, ReactNode, Ref } from 'react'
import type {
  HostInstance,
  StyleProp,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native'
import type { Color } from 'react-stately'
import type { ColorPickerState } from 'react-stately/useColorPickerState'

import { useRef, useState } from 'react'
import { View as NativeView, Pressable, StyleSheet, Text } from 'react-native'
import { parseColor } from 'react-stately'
import { useColorPickerState } from 'react-stately/useColorPickerState'
import { useOverlayTriggerState } from 'react-stately/useOverlayTriggerState'

import type { PickedColor } from '../../swatch'

import { useLocaleOf, useMessages } from '../../i18n/provider'
import { PickerPopup } from '../../picker'
import { hitSlop, usePressFeedback } from '../../press'
import { refsOf } from '../../ref'
import { colorNameOf, PickedColorContext } from '../../swatch'
import { withOpacity } from '../../theme/color'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'
import { ColorArea } from '../color-area'
import { ColorField } from '../color-field'
import { ColorSlider } from '../color-slider'
import { ColorSwatch } from '../color-swatch'

// Every colour control in one, as kanso-ui's ColorPicker composes them: a
// swatch and a label as the trigger, and a plane, a hue slider, an alpha
// slider and a hex field on the surface it opens. The value is React
// Stately's `useColorPickerState`, which the controls on the surface take
// through src/swatch's PickedColorContext, as React Aria's picker hands its
// value to each control's context on web. So an arrangement passed as
// `children` shares the value the same way, whatever it holds.
//
// Material Design carries no page for a colour picker. What it does carry is
// the text fields page, which the field inside draws through, and the surface
// a date picker opens on, which this one shares through src/picker. Three
// choices are web's own, and kept.
//
// **The trigger is a swatch beside a name, not a swatch alone.** A swatch on
// its own is a coloured square with no affordance, and a screen reader would
// be told a colour rather than an action. It is a pill on surface container
// low, the swatch at 24dp, the height of the label's line rather than a
// swatch's own 40dp, and the label in label large, with the state layer and
// ripple every control here draws in on surface. A screen reader hears the
// label and then the colour, "Label, dark purple", where web's reads the
// swatch's name first: the visible label leads, so a voice command that says
// it finds the button.
//
// **Hue is a slider rather than a wheel.** A wheel and the plane want the
// same room, and would make the surface square and large; the strip sits
// under the plane at the width it already has. ColorWheel is for a picker
// that wants to be round, which a call site builds as `children`.
//
// **It is docked from the medium window size up and modal below it**, the
// date picker's pairing, through the same src/picker surface: a 280dp
// surface anchored to a trigger is out of reach on a phone, and a centred one
// on a tablet covers a form for no reason. Its dismissal, its motion and
// where a screen reader goes are the date picker's.
//
// One thing the picker does that its parts do not. **The plane and the hue
// slider are read in HSL.** A channel has to belong to the value's own space
// or React Stately throws, and a hex is read as RGB, which has no saturation,
// so `<ColorPicker defaultValue="#6750A4" />` would throw outright. Reading
// the two in HSL is what lets the picker take any notation. A change made on
// either reports the colour in HSL, as React Stately's area and slider do on
// web, and the field shows it as hex whatever space it is in.
//
// **Disabled reaches every control on the surface**, not only the trigger.
// React Stately's picker state carries no disabled state, and the surface
// opens independently of the trigger, so a disabled picker can still be on
// screen: already open when a form disables it, or opened from outside. An
// arrangement passed as `children` is the call site's own to disable.

// The swatch in the trigger, at the height of the label's line rather than
// the 40dp a swatch takes on its own.
const SWATCH = 24

// The surface's width, as web's: room for the plane and a hex field.
const SURFACE_WIDTH = 280

// Any HSL colour names the channels the two sliders draw. Their labels are
// read off it in the locale, as React Stately words them, rather than written
// here in English.
const CHANNELS = parseColor('hsl(0, 0%, 0%)')

const stylesOf = themedStyles(({ colors, radii, spacing, stateLayerOpacity }) =>
  StyleSheet.create({
    // What the surface holds, stacked: the plane, the sliders, then the
    // field. One column, so a picker reads top to bottom.
    body: {
      boxSizing: 'border-box',
      gap: spacing.md,
      maxWidth: '100%',
      padding: spacing.lg,
      width: SURFACE_WIDTH,
    },
    disabled: {
      backgroundColor: withOpacity(
        colors.onSurface,
        stateLayerOpacity.disabledContainer,
      ),
    },
    swatch: {
      height: SWATCH,
      width: SWATCH,
    },
    trigger: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radii.pill,
      boxSizing: 'border-box',
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
  }),
)

type ColorPickerProps = {
  /** Whether the alpha slider is drawn under the hue one. @default false */
  readonly alpha?: boolean
  /**
   * Replaces everything on the surface, for a picker that arranges its own
   * parts. The colour controls in it take the picker's value.
   */
  readonly children?: ReactNode
  /** Whether the surface starts open, when the picker keeps its own open state. */
  readonly defaultOpen?: boolean
  /**
   * The colour the picker holds at first, when it keeps its own: a CSS colour
   * string, or a `Color` from `parseColor`.
   * @default '#000000'
   */
  readonly defaultValue?: Color | string
  /**
   * Whether the whole picker is inert: the trigger, and the plane, sliders
   * and field on the surface, which can be on screen while disabled since
   * the surface opens independently of the trigger. An arrangement passed as
   * `children` is the call site's own to disable.
   * @default false
   */
  readonly isDisabled?: boolean
  /** Whether the surface is open, for a call site holding it with `onOpenChange`. */
  readonly isOpen?: boolean
  /**
   * What the trigger says beside its swatch. Required: it is the button's
   * name, the surface's and the field's.
   */
  readonly label: string
  /** Called with the colour each time a control on the surface changes it. */
  readonly onChange?: (value: Color) => void
  /** Called when the surface opens or closes. */
  readonly onOpenChange?: (isOpen: boolean) => void
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
  /** The colour, for a call site holding it itself with `onChange`. */
  readonly value?: Color | string
}

/**
 * A colour picked from a plane, a hue slider and a hex field, behind a
 * trigger showing the colour. Pass `value` with `onChange` to control it, or
 * `defaultValue`, as a CSS colour string or a `Color` from `parseColor`,
 * which this package re-exports.
 *
 * ```tsx
 * <ColorPicker defaultValue="#6750A4" label="Label" />
 * ```
 *
 * `alpha` adds the transparency slider. From the medium window size up the
 * surface is docked under the trigger; below it, it opens centred over a
 * scrim, as a date picker's does. `defaultOpen`, `isOpen` and `onOpenChange`
 * reach the surface.
 *
 * Every part on the surface is this package's own, `ColorArea`,
 * `ColorSlider` and `ColorField`, and they share the picker's value rather
 * than taking it as props. Passing `children` replaces all of them, and a
 * `ColorArea`, `ColorField`, `ColorSlider`, `ColorSwatch`,
 * `ColorSwatchPicker` or `ColorWheel` among them takes the picker's value
 * where it is given none of its own.
 *
 * `style`, `ref` and `testID` land on the trigger, which is what a layout
 * places.
 */
function ColorPicker({
  alpha = false,
  children,
  defaultOpen,
  defaultValue,
  isDisabled = false,
  isOpen,
  label,
  onChange,
  onOpenChange,
  ref,
  style,
  testID,
  value,
}: ColorPickerProps) {
  const theme = useTheme()
  const { colors, radii, spacing, stateLayerOpacity } = theme
  const styles = stylesOf(theme)
  const locale = useLocaleOf(undefined)
  const messages = useMessages()
  const labelRole = useTypeRole('labelLarge')
  const state = useColorPickerState({ defaultValue, onChange, value })
  const overlay = useOverlayTriggerState({ defaultOpen, isOpen, onOpenChange })
  // oxlint-disable-next-line typescript/unbound-method -- React Stately's setters are callbacks, and read no `this`
  const { close, open: show } = overlay
  const anchor = useRef<HostInstance | null>(null)
  const [trigger, setTrigger] = useState<HostInstance | null>(null)
  const feedback = usePressFeedback({
    color: colors.onSurface,
    corners: { borderRadius: radii.pill },
    disabled: isDisabled,
  })
  const name = colorNameOf(state.color, locale, messages.transparent)

  return (
    <>
      <Pressable
        {...feedback.handlers}
        aria-expanded={overlay.isOpen}
        aria-label={`${label}, ${name}`}
        disabled={isDisabled}
        hitSlop={hitSlop(SWATCH + 2 * spacing.sm)}
        onPress={show}
        ref={refsOf<HostInstance>(ref, anchor, setTrigger)}
        role="button"
        style={composeStyles<ViewStyle>(
          styles.trigger,
          isDisabled ? styles.disabled : undefined,
          feedback.ring,
          style,
        )}
        testID={testID}
      >
        {feedback.layer}
        <ColorSwatch color={state.color} style={styles.swatch} />
        <Text
          style={composeStyles<TextStyle>(labelRole, {
            color: isDisabled
              ? withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)
              : colors.onSurface,
          })}
        >
          {label}
        </Text>
      </Pressable>
      <PickerPopup
        anchor={anchor}
        close={close}
        isOpen={overlay.isOpen}
        label={label}
        trigger={trigger}
      >
        {/*
          Inside the surface rather than around the picker, since the surface
          is drawn in the overlay host, which context set around the picker
          does not reach.
        */}
        <PickedColorContext value={pickedOf(state)}>
          {children ?? (
            <NativeView style={styles.body}>
              <ColorArea
                aria-label={label}
                colorSpace="hsl"
                isDisabled={isDisabled}
                xChannel="saturation"
                yChannel="lightness"
              />
              <ColorSlider
                channel="hue"
                colorSpace="hsl"
                isDisabled={isDisabled}
                label={CHANNELS.getChannelName('hue', locale)}
              />
              {alpha ? (
                <ColorSlider
                  channel="alpha"
                  isDisabled={isDisabled}
                  label={CHANNELS.getChannelName('alpha', locale)}
                />
              ) : null}
              <ColorField isDisabled={isDisabled} label={label} />
            </NativeView>
          )}
        </PickedColorContext>
      </PickerPopup>
    </>
  )
}

// Built by a call rather than written inline at the prop, which is what
// react-perf's jsx-no-new-object-as-prop is after; the React Compiler
// memoises the result on its inputs.
function pickedOf(state: ColorPickerState): PickedColor {
  return {
    onChange: (color) => {
      state.setColor(color)
    },
    value: state.color,
  }
}

export { ColorPicker }
export type { ColorPickerProps }
