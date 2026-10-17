import { createContext } from 'react'

// What a component drawing a badge can say about where its large mark goes,
// as src/badge does on web. A module of its own rather than a part of the one
// place that uses it, since the badge reads it and that place draws the
// badge.

/**
 * Whether a large badge joins the flow after what it is drawn on rather than
 * standing over its corner. A navigation destination sets its label beside
 * its icon in its horizontal forms, and a count overhangs the icon by up to
 * 22dp on that side: the destination puts the mark in the flow there, so the
 * label starts after it rather than under it. The small badge stays inside
 * its icon's box, so nothing has to make room for it.
 */
const BadgeInFlowContext = createContext(false)

export { BadgeInFlowContext }
