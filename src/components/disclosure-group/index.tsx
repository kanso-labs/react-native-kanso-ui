import type { ComponentRef, ReactNode, Ref } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { Key } from 'react-stately'

import { Children, Fragment, isValidElement } from 'react'
import { View } from 'react-native'
import { useDisclosureGroupState } from 'react-stately/useDisclosureGroupState'

import { DisclosureGroupStateContext } from '../../disclosure'
import { Separator } from '../separator'

// kanso-ui's DisclosureGroup: a stack of Disclosures that agree with each
// other about what is open, the lists page's accordion. The sections are the
// library's own `Disclosure`, unchanged: this adds only the agreement between
// them and the rule that divides them.
//
// Give each section an `id`, which is the key the group reports as expanded.
// Whether one opens at a time or several is `allowsMultipleExpanded`, and the
// keys are React Stately's `useDisclosureGroupState`, the state web's React
// Aria keeps, handed to the sections through context.
//
// **A rule between the sections, and none at the ends.** The group draws the
// library's `Separator` between each pair rather than asking each section to
// draw a border, so a section drawn on its own and a section in a group stay
// the same component. `divided={false}` leaves them undivided, for a stack
// sitting on cards of its own.
//
// **Nothing else is added.** The group draws no container, no corner and no
// colour: an accordion inside a card and one running down a screen want
// different surroundings, and the screen is what knows which it is.

type DisclosureGroupProps = {
  /**
   * Whether several sections may be open at once. Otherwise opening one
   * closes the one that was open.
   * @default false
   */
  readonly allowsMultipleExpanded?: boolean
  /** The sections, as `Disclosure` elements each given an `id`. */
  readonly children?: ReactNode
  /** The keys of the sections open at first, when the group keeps its own. */
  readonly defaultExpandedKeys?: Iterable<Key>
  /**
   * Whether a rule is drawn between the sections. There is never one above
   * the first or below the last.
   * @default true
   */
  readonly divided?: boolean
  /** The keys of the open sections, when the call site holds them. */
  readonly expandedKeys?: Iterable<Key>
  /**
   * Keeps every section from opening or closing, and draws their headers
   * disabled.
   * @default false
   */
  readonly isDisabled?: boolean
  /** Called with the keys of the open sections as one opens or closes. */
  readonly onExpandedChange?: (keys: Set<Key>) => void
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

/**
 * A stack of `Disclosure` sections that agree about what is open. Pass
 * `expandedKeys` with `onExpandedChange` to hold which are open, or
 * `defaultExpandedKeys` to let the group keep its own.
 *
 * ```tsx
 * <DisclosureGroup defaultExpandedKeys={FIRST}>
 *   <Disclosure id="first">
 *     <Disclosure.Header>Headline</Disclosure.Header>
 *     <Disclosure.Panel>
 *       <Text>Supporting line</Text>
 *     </Disclosure.Panel>
 *   </Disclosure>
 * </DisclosureGroup>
 * ```
 *
 * One section opens at a time unless `allowsMultipleExpanded` says otherwise.
 * Give every section an `id`, which is the key the group reports.
 *
 * `style`, `ref` and `testID` land on the group's own view, the one a layout
 * positions.
 */
function DisclosureGroup({
  allowsMultipleExpanded,
  children,
  defaultExpandedKeys,
  divided = true,
  expandedKeys,
  isDisabled,
  onExpandedChange,
  ref,
  style,
  testID,
}: DisclosureGroupProps) {
  const state = useDisclosureGroupState({
    allowsMultipleExpanded,
    defaultExpandedKeys,
    expandedKeys,
    isDisabled,
    onExpandedChange,
  })

  return (
    <DisclosureGroupStateContext value={state}>
      <View ref={ref} style={style} testID={testID}>
        {divided ? dividedChildren(children) : children}
      </View>
    </DisclosureGroupStateContext>
  )
}

// The sections with a rule between each pair, and none at the ends.
function dividedChildren(children: ReactNode) {
  return flatten(children).map((section, index) => (
    <Fragment key={keyOf(section, index)}>
      {index === 0 ? null : <Separator />}
      {section}
    </Fragment>
  ))
}

// The sections, with any fragment around them opened up first.
// `Children.toArray` flattens arrays but hands back a fragment as one child,
// and a call site that writes its sections inside one, or maps over data and
// wraps the result, would otherwise get a single entry and no rules at all.
// Recursive, since a fragment may hold another.
function flatten(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      isValidElement<{ children?: ReactNode }>(child) &&
      child.type === Fragment
    ) {
      return flatten(child.props.children)
    }
    return [child]
  })
}

// The key `Children.toArray` put on each element, or the entry's position for
// anything that is not one.
function keyOf(section: ReactNode, index: number) {
  return isValidElement(section) && section.key !== null
    ? section.key
    : String(index)
}

export { DisclosureGroup }
export type { DisclosureGroupProps }
