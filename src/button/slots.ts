import type { RefObject } from 'react'
import type { GestureResponderEvent, HostInstance } from 'react-native'

import { createContext } from 'react'

/**
 * What a button does past its own press when it sits in an overlay's trigger
 * or content, as web's React Aria hands the same through a button's `slot`:
 * the default slot opens the overlay, which a button inside `Dialog`,
 * `Popover` or `Sheet` and outside its content takes, and `close` closes it,
 * which one given `slot="close"` inside the content takes. The overlay
 * provides the slots it fills, and resets the default one inside its content,
 * so a button there opens nothing.
 */
type ButtonSlots = {
  readonly close?: (event: GestureResponderEvent) => void
  readonly default?: (event: GestureResponderEvent) => void
  /**
   * What the button filling the default slot takes on beside its press, for
   * an overlay drawn beside it.
   */
  readonly trigger?: ButtonSlotTrigger
}

/**
 * What a button filling the default slot takes on for an overlay drawn beside
 * it: its node, which the overlay is placed against, whether the overlay is
 * open, which a screen reader announces, and the hover and long press a
 * hovered popover opens on. The handlers run after the button's own.
 */
type ButtonSlotTrigger = {
  /** How long a press is held before it is a long press, in milliseconds. */
  readonly delayLongPress?: number
  /** Whether the overlay the button opens is open. */
  readonly expanded: boolean
  readonly onHoverIn?: () => void
  readonly onHoverOut?: () => void
  readonly onLongPress?: () => void
  /** Where the button's node is kept, for the overlay to be placed against. */
  readonly ref: RefObject<HostInstance | null>
}

/**
 * What a button takes on inside a `Tooltip`, whichever slot it fills: its
 * node, which the tooltip is placed against, the tooltip's label as its
 * accessibility hint, and the pointer and the held press that open and close
 * the tooltip. The handlers run after the button's own and an overlay
 * trigger's. Kept apart from the slots so that a tooltip and the overlay a
 * button opens can wrap it in either order, and a close button and a link
 * take one too.
 */
type ButtonTooltip = {
  /** How long a press is held before it opens the tooltip, in milliseconds. */
  readonly delayLongPress: number
  /** The tooltip's label, read after the button's name. */
  readonly hint: string
  readonly onHoverIn?: (() => void) | undefined
  readonly onHoverOut?: (() => void) | undefined
  readonly onLongPress: () => void
  readonly onPressIn?: (() => void) | undefined
  readonly onPressOut: () => void
  /** Where the button's node is kept, for the tooltip to be placed against. */
  readonly ref: RefObject<HostInstance | null>
}

const ButtonSlotContext = createContext<ButtonSlots | null>(null)
const ButtonTooltipContext = createContext<ButtonTooltip | null>(null)

export { ButtonSlotContext, ButtonTooltipContext }
export type { ButtonSlots, ButtonSlotTrigger, ButtonTooltip }
