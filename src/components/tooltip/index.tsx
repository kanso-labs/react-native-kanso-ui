import type { ReactNode, Ref, RefObject } from 'react'
import type {
  HostInstance,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'

import { useMemo, useRef, useState } from 'react'
import { Text as NativeText, StyleSheet } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTooltipTriggerState } from 'react-stately/useTooltipTriggerState'

import type { ButtonTooltip } from '../../button/slots'
import type { OverlayAlign, OverlaySide } from '../../overlay'
import type { ResolvedTheme } from '../../theme/scope'

import { ButtonTooltipContext } from '../../button/slots'
import { Overlay, useAnchoredPlacement } from '../../overlay'
import { PANEL_ORIGINS, usePanelMotion } from '../../overlay/panel'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// kanso-ui's Tooltip, the tooltips page's plain tooltip: a container on
// inverse surface with 8dp of padding at the ends and 4dp above and below,
// holding a line of supporting text in body small on inverse on surface, so
// one line is the page's 24dp. The page names a shape token without giving
// its value, so it takes the extra-small corner, as web's does, and it lies
// flat: the plain tooltip's tokens give no elevation. A long label wraps at
// 320dp rather than running the width of the window.
//
// **It is placed by src/overlay's anchored placement**, in the overlay host
// above the screen: on `side`, `top` unless told otherwise, lined up by
// `align`, flipped to the opposite side at the edge of the window and kept
// inside the safe area. It grows and fades in and out from the edge facing
// the trigger as every anchored panel does, through src/overlay's panel
// motion. It takes no press and draws no layer under it, so the screen stays
// usable while it shows.
//
// **Touch has no hover, so a press held on the trigger for `delay` opens it**,
// as Android's own tooltips open on a long press, and the press then ends
// without pressing the trigger. A pointer resting on the trigger for `delay`
// opens it as well, an iPad's or an Android mouse's. It closes `closeDelay`
// after the pointer leaves, or after a held press ends while no pointer is on
// the trigger, and at once on a press of the trigger unless
// `shouldCloseOnPress` is off. `trigger="focus"` leaves the pointer out, so
// only the held press opens it. The state is React Stately's, the one web's
// React Aria keeps, so once one tooltip has shown, the next a pointer rests on
// opens at once, and only one shows at a time.
//
// **A screen reader never reaches the surface.** The label is the trigger's
// accessibility hint instead, read after its name, which is what web's
// `aria-describedby` gives a reader, and why the label is text.
//
// **The trigger is a Button, an IconButton, a FAB or a Chip placed directly
// inside it**, which takes the tooltip through src/button's slots.ts, as a
// popover's trigger takes the popover. A tooltip and a popover or menu can
// wrap the same button in either order.

// How long a pointer rests on the trigger, or a press is held on it, before
// the tooltip opens, and how long it stays once the pointer or the press has
// gone, React Aria's own defaults, which web's takes.
const DEFAULT_DELAY = 1500
const DEFAULT_CLOSE_DELAY = 500

// The widest it draws, web's cap.
const MAX_WIDTH = 320

const stylesOf = themedStyles(({ colors, radii, spacing }: ResolvedTheme) =>
  StyleSheet.create({
    label: {
      color: colors.inverseOnSurface,
    },
    surface: {
      backgroundColor: colors.inverseSurface,
      borderRadius: radii.xs,
      maxWidth: MAX_WIDTH,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      pointerEvents: 'none',
    },
  }),
)

type SurfaceProps = Pick<
  TooltipProps,
  'align' | 'alignOffset' | 'label' | 'ref' | 'side' | 'sideOffset' | 'style'
> & {
  readonly anchor: RefObject<HostInstance | null>
  readonly isOpen: boolean
  readonly setPresent: (present: boolean) => void
  readonly testID: string | undefined
}

/** Where the tooltip sits along the side it opens on. */
type TooltipAlign = OverlayAlign

type TooltipProps = {
  /**
   * Where the tooltip sits along the side it opens on. On `top` and
   * `bottom`, `start` and `end` follow a right-to-left layout.
   * @default 'center'
   */
  readonly align?: TooltipAlign
  /** Moves the tooltip along that side, in dp: right or down when positive. */
  readonly alignOffset?: number
  /**
   * The button the tooltip describes, and nothing else: a `Button`,
   * `IconButton`, `Fab` or `Chip`, or a `Popover` or `Menu` whose trigger is
   * one.
   */
  readonly children?: ReactNode
  /**
   * How long the tooltip stays once the pointer has left the trigger, or a
   * held press has ended, in milliseconds.
   * @default 500
   */
  readonly closeDelay?: number
  /** Whether the tooltip starts open, when it keeps its own state. */
  readonly defaultOpen?: boolean
  /**
   * How long a pointer rests on the trigger, or a press is held on it,
   * before the tooltip opens, in milliseconds.
   * @default 1500
   */
  readonly delay?: number
  /**
   * Keeps the tooltip from opening, and its label off the trigger's hint.
   * @default false
   */
  readonly isDisabled?: boolean
  /** Whether the tooltip is open, when the call site holds the state. */
  readonly isOpen?: boolean
  /**
   * What the tooltip says. Text, since it is also the trigger's
   * accessibility hint, which a screen reader reads after its name.
   */
  readonly label: string
  /** Called with the new state as the tooltip opens or closes. */
  readonly onOpenChange?: (isOpen: boolean) => void
  readonly ref?: Ref<HostInstance>
  /**
   * Whether a press of the trigger closes the tooltip.
   * @default true
   */
  readonly shouldCloseOnPress?: boolean
  /**
   * Which side of the trigger the tooltip opens on. It flips to the opposite
   * side when there is no room.
   * @default 'top'
   */
  readonly side?: TooltipSide
  /**
   * The gap between the trigger and the tooltip, in dp.
   * @default spacing.sm
   */
  readonly sideOffset?: number
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
  /**
   * `focus` leaves a pointer resting on the trigger out, so only a press
   * held on it opens the tooltip.
   */
  readonly trigger?: 'focus'
}

/** Which side of the trigger the tooltip opens on. */
type TooltipSide = OverlaySide

/**
 * A label for the button it wraps, the tooltips spec page's plain tooltip,
 * shown while a press is held on the button or a pointer rests on it.
 *
 * ```tsx
 * <Tooltip label="Search">
 *   <IconButton aria-label="Search">
 *     <SearchGlyph />
 *   </IconButton>
 * </Tooltip>
 * ```
 *
 * Pass `isOpen` with `onOpenChange` to hold the open state, or `defaultOpen`
 * to let it keep its own, and `delay` and `closeDelay` for how long it waits
 * before it opens and closes. What it says has to repeat what the button
 * already means, since a screen reader hears it as the button's hint and
 * touch only shows it to someone who holds a press: anything with a button
 * in it, or worth reading twice, is a `Popover`.
 *
 * `style`, `ref` and `testID` land on the tooltip itself.
 */
function Tooltip({
  align = 'center',
  alignOffset,
  children,
  closeDelay = DEFAULT_CLOSE_DELAY,
  defaultOpen,
  delay = DEFAULT_DELAY,
  isDisabled = false,
  isOpen,
  label,
  onOpenChange,
  ref,
  shouldCloseOnPress = true,
  side = 'top',
  sideOffset,
  style,
  testID,
  trigger,
}: TooltipProps) {
  const state = useTooltipTriggerState({
    closeDelay,
    defaultOpen,
    delay,
    isOpen,
    onOpenChange,
  })
  const anchor = useRef<HostInstance>(null)
  const hovered = useRef(false)
  const [present, setPresent] = useState(state.isOpen)
  const pointer = trigger !== 'focus'
  // What the trigger takes on: the pointer resting on it and leaving it, the
  // held press that opens the tooltip, and a press that closes it, at once as
  // it starts and after `closeDelay` as a held one ends, unless a pointer
  // still rests on the trigger, which keeps it until the pointer leaves.
  const described = useMemo<ButtonTooltip | null>(
    () =>
      isDisabled
        ? null
        : {
            delayLongPress: delay,
            hint: label,
            onHoverIn: pointer
              ? () => {
                  hovered.current = true
                  state.open(false)
                }
              : undefined,
            onHoverOut: pointer
              ? () => {
                  hovered.current = false
                  state.close(false)
                }
              : undefined,
            onLongPress: () => {
              state.open(true)
            },
            onPressIn: shouldCloseOnPress
              ? () => {
                  state.close(true)
                }
              : undefined,
            onPressOut: () => {
              if (!hovered.current) {
                state.close(false)
              }
            },
            ref: anchor,
          },
    [delay, isDisabled, label, pointer, shouldCloseOnPress, state],
  )

  // Mounted the moment it opens, and kept until its exit has run.
  if (state.isOpen && !present) {
    setPresent(true)
  }

  return (
    <>
      <ButtonTooltipContext value={described}>{children}</ButtonTooltipContext>
      {present ? (
        <Overlay>
          <TooltipSurface
            align={align}
            alignOffset={alignOffset}
            anchor={anchor}
            isOpen={state.isOpen}
            label={label}
            ref={ref}
            setPresent={setPresent}
            side={side}
            sideOffset={sideOffset}
            style={style}
            testID={testID}
          />
        </Overlay>
      ) : null}
    </>
  )
}

// The tooltip itself, drawn in the overlay host and placed beside the
// trigger once it has reported its size.
function TooltipSurface({
  align,
  alignOffset,
  anchor,
  isOpen,
  label,
  ref,
  setPresent,
  side,
  sideOffset,
  style,
  testID,
}: SurfaceProps) {
  const styles = stylesOf(useTheme())
  const role = useTypeRole('bodySmall')
  const placement = useAnchoredPlacement({
    align,
    alignOffset,
    anchor,
    side,
    sideOffset,
  })
  const motion = usePanelMotion(isOpen, placement.placed, setPresent)

  return (
    <Animated.View
      aria-hidden
      onLayout={placement.onLayout}
      ref={ref}
      style={composeStyles<AnimatedStyle<ViewStyle>>(
        styles.surface,
        placement.style,
        { transformOrigin: PANEL_ORIGINS[placement.side] },
        motion,
        style,
      )}
      testID={testID}
    >
      <NativeText style={composeStyles<TextStyle>(role, styles.label)}>
        {label}
      </NativeText>
    </Animated.View>
  )
}

export { Tooltip }
export type { TooltipAlign, TooltipProps, TooltipSide }
