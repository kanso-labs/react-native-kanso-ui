// What keeps a container that carries a role or a name a node of its own on
// Android. Fabric flattens a View whose props form no view, and `role` and
// `aria-label` are not among the props that do, so a radio group, a toolbar
// or a tab list that draws nothing of its own left its controls loose in the
// tree, its name with it, and could change the order a screen reader read
// them in.

/** Spread on a View that carries a role or a name and draws nothing. */
const GROUP = { collapsable: false } as const

/**
 * The name of a scroll view that is the group itself. A ScrollView forms a
 * view of its own, but it hands Android no `aria-label`, so the name goes in
 * as the label React Native reads on every platform as well.
 */
function scrollNameOf(name: string | undefined) {
  return { accessibilityLabel: name, 'aria-label': name }
}

export { GROUP, scrollNameOf }
