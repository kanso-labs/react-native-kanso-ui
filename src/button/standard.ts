import { createContext } from 'react'

// The colour a standard IconButton's icon rests in, and its state layer is
// drawn in, where the surface it sits on gives its icon buttons a role of
// its own, as web's `--icon-button-standard-color` does: a vibrant Toolbar's
// on primary container. Null is no such surface, and the button keeps its
// on surface variant. A disabled button and a selected toggle keep their own
// colours. A modal window clears it, so a button in a dialog, sheet or
// popover opened from the bar draws as it does anywhere else.
const StandardIconColorContext = createContext<null | string>(null)

export { StandardIconColorContext }
