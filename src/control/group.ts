import type { RefObject } from 'react'

import { createContext } from 'react'

import type { Focusable } from '../form'

// What a CheckboxGroup tells the checkboxes inside it, as React Aria's group
// state does on web: which entries are selected, how to change one, and the
// states that reach every box from the group. Beside src/control's row
// rather than in the group's own module, so Checkbox reads it without
// importing the group.

type CheckboxGroupContextValue = {
  readonly isDisabled: boolean
  readonly isInvalid: boolean
  readonly isReadOnly: boolean
  readonly isSelected: (value: string) => boolean
  readonly members: CheckboxGroupMembers
  /** Selects or clears one entry, as a press on its checkbox does. */
  readonly set: (value: string, isSelected: boolean) => void
}

/**
 * A group's checkboxes, in the order they mounted, which is the order they
 * are drawn in. As a ref it holds the first of them that has a control, which
 * is what the form around the group focuses when the group holds a native
 * submission back.
 */
type CheckboxGroupMembers = RefObject<Focusable | null> & {
  /** Adds a checkbox's control, keeping its place if it is already there. */
  readonly add: (id: string, control: RefObject<Focusable | null>) => void
  readonly remove: (id: string) => void
}

const CheckboxGroupContext = createContext<CheckboxGroupContextValue | null>(
  null,
)

/** An empty list of a group's checkboxes, made once per group. */
function createMembers(): CheckboxGroupMembers {
  const controls = new Map<string, RefObject<Focusable | null>>()

  return {
    add: (id, control) => {
      controls.set(id, control)
    },
    get current() {
      for (const control of controls.values()) {
        if (control.current !== null) {
          return control.current
        }
      }
      return null
    },
    remove: (id) => {
      controls.delete(id)
    },
  }
}

export { CheckboxGroupContext, createMembers }
export type { CheckboxGroupContextValue, CheckboxGroupMembers }
