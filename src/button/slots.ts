import type { GestureResponderEvent } from 'react-native'

import { createContext } from 'react'

/**
 * What a button does past its own press when it sits in an overlay's trigger
 * or content, as web's React Aria hands the same through a button's `slot`:
 * the default slot opens the overlay, which a button inside `Dialog` or
 * `Sheet` and outside its content takes, and `close` closes it, which one
 * given `slot="close"` inside the content takes. The overlay provides the
 * slots it fills, and resets the default one inside its content, so a button
 * there opens nothing.
 */
type ButtonSlots = {
  readonly close?: (event: GestureResponderEvent) => void
  readonly default?: (event: GestureResponderEvent) => void
}

const ButtonSlotContext = createContext<ButtonSlots | null>(null)

export { ButtonSlotContext }
export type { ButtonSlots }
