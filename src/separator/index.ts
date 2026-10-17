import { createContext } from 'react'

// Which way a Separator runs where its call site does not say, as React
// Aria's separator context does on web. A Toolbar provides the direction
// across its own, so a rule between two of its controls divides them rather
// than running along the bar; a modal window clears it, so a rule in a
// dialog, sheet or popover opened from the bar draws as it does anywhere
// else. Null is no direction provided, and a Separator then runs
// horizontally.
const SeparatorOrientationContext = createContext<
  'horizontal' | 'vertical' | null
>(null)

export { SeparatorOrientationContext }
