import type { DisclosureGroupState } from 'react-stately/useDisclosureGroupState'

import { createContext } from 'react'

// The open keys of the DisclosureGroup around a Disclosure, as React Aria's
// group state context is on web. A Disclosure inside one reads whether it is
// open from the group's keys, under its `id`, and toggles that key when its
// header is pressed. Null is no group, and a Disclosure then keeps its own
// state.
const DisclosureGroupStateContext = createContext<DisclosureGroupState | null>(
  null,
)

export { DisclosureGroupStateContext }
