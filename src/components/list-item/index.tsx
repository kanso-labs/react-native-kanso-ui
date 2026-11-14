import type { ComponentRef, ReactNode, Ref } from 'react'
import type {
  PressableProps,
  StyleProp,
  ViewProps,
  ViewStyle,
} from 'react-native'

import { isValidElement } from 'react'
import { Pressable, View } from 'react-native'

import { textOf } from '../../plain-text'
import { usePressFeedback } from '../../press'
import {
  hasContent,
  RowContent,
  rowContentColor,
  rowStyleOf,
  rowStyles,
} from '../../row'
import { useTheme } from '../../theme/scope'
import { composeStyles } from '../../theme/styles'

// kanso-ui's ListItem, from the lists page: the one-line item's 56dp
// container with a body-large headline, the two-line item's 72dp with a
// body-medium supporting line, and the three-line item's 88dp, where an
// overline joins them and the slots are held at the top rather than
// centred. The heights are minimums, so a larger OS text size grows the
// row. The layout is src/row's, shared with every menu item; what is here
// is the view around it, a `View` that presents or a `Pressable` that
// ripples, and the props that fill the slots. Both slots lie along the
// writing direction, so they swap sides under right-to-left.
//
// **A row that presents is one element to a screen reader**, as Material
// Design's list item is on Android and as an interactive row already is:
// left as loose texts, Android read them by where they sit, so a trailing
// "01" came between the headline and its supporting line. Its name is its
// overline, headline, supporting line and trailing text, in that order, when
// each is text, and the platform's reading of what it holds otherwise. A row
// whose slot holds a control of its own, something pressed, chosen or
// typed into, is left ungrouped, so the control stays a stop of its own.

type InteractiveListItemForm = Omit<
  PressableProps,
  'children' | 'disabled' | 'style'
> & {
  /**
   * Makes the row the thing you press: a `Pressable` announced as a button,
   * with the state layers, the ripple and the focus ring. Leave it off for a
   * row that only presents.
   */
  readonly interactive: true
}

type ListItemBaseProps = {
  /** The row's headline, the one thing it is mostly about. */
  readonly children?: ReactNode
  /**
   * Draws the row disabled: its headline, slots and lines fade to on surface
   * at the disabled content opacity. An interactive row takes no press and
   * is announced as disabled; a row that only presents has nothing to
   * disable, and says it is disabled so the state it draws is announced too.
   * @default false
   */
  readonly isDisabled?: boolean
  /** Content before the headline: an avatar, an icon, a checkbox. */
  readonly leading?: ReactNode
  /**
   * A line above the headline, in label small and the muted role. Given
   * beside `supporting`, it makes the row the three-line item.
   */
  readonly overline?: ReactNode
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
  /** A second line under the headline, in body medium and the muted role. */
  readonly supporting?: ReactNode
  /** Content after the headline, such as an amount or a control. */
  readonly trailing?: ReactNode
}

type ListItemProps = (InteractiveListItemForm | StaticListItemForm) &
  ListItemBaseProps

/** A row that presents and takes no press: a `View` with no role. */
type StaticListItemForm = Omit<ViewProps, 'children' | 'style'> & {
  readonly interactive?: false
  readonly onPress?: never
}

function InteractiveListItem({
  children,
  interactive: _interactive,
  isDisabled = false,
  leading,
  onBlur,
  onFocus,
  onHoverIn,
  onHoverOut,
  onPressIn,
  onPressOut,
  overline,
  style,
  supporting,
  trailing,
  ...props
}: InteractiveListItemForm & ListItemBaseProps) {
  const theme = useTheme()
  const feedback = usePressFeedback({
    color: rowContentColor(theme, { isDisabled }),
    disabled: isDisabled,
    onBlur,
    onFocus,
    onHoverIn,
    onHoverOut,
    onPressIn,
    onPressOut,
  })

  return (
    <Pressable
      role="button"
      {...props}
      {...feedback.handlers}
      disabled={isDisabled}
      style={composeStyles<ViewStyle>(
        rowStyleOf(theme, { overline, supporting }),
        feedback.ring,
        feedback.ring === undefined ? undefined : rowStyles.ring,
        style,
      )}
    >
      {feedback.layer}
      <RowContent
        isDisabled={isDisabled}
        leading={leading}
        overline={overline}
        supporting={supporting}
        trailing={trailing}
      >
        {children}
      </RowContent>
    </Pressable>
  )
}

/**
 * A row of a list, with a headline and up to two lines beside it, and
 * content before and after.
 *
 * ```tsx
 * <ListItem interactive leading={<Avatar name="Ada Lovelace" />} onPress={open} supporting="Supporting line">
 *   Headline
 * </ListItem>
 * ```
 *
 * Which of the lists page's three items it is comes from what it holds: a
 * `supporting` line or an `overline` makes it the two-line item, and both
 * the three-line one. It is a `View` with no role unless `interactive`,
 * when it is a `Pressable` announced as a button. Either is one element to a
 * screen reader, unless a slot holds a control of its own. The press props belong to
 * an interactive row alone. `style`, `ref` and `testID` land on the row's
 * own view.
 */
function ListItem(props: ListItemProps) {
  return props.interactive === true ? (
    <InteractiveListItem {...props} />
  ) : (
    <StaticListItem {...props} />
  )
}

function StaticListItem({
  children,
  interactive: _interactive,
  isDisabled = false,
  leading,
  overline,
  style,
  supporting,
  trailing,
  ...props
}: ListItemBaseProps & StaticListItemForm) {
  const theme = useTheme()
  const grouped = !holdsControl(leading) && !holdsControl(trailing)

  return (
    <View
      accessible={grouped}
      aria-disabled={isDisabled || undefined}
      aria-label={
        grouped ? nameOf([overline, children, supporting, trailing]) : undefined
      }
      {...props}
      style={composeStyles<ViewStyle>(
        rowStyleOf(theme, { overline, supporting }),
        style,
      )}
    >
      <RowContent
        isDisabled={isDisabled}
        leading={leading}
        overline={overline}
        supporting={supporting}
        trailing={trailing}
      >
        {children}
      </RowContent>
    </View>
  )
}

// The props that make an element a control of its own: something pressed,
// chosen or typed into.
const CONTROL_PROPS = [
  'defaultSelected',
  'defaultValue',
  'href',
  'isSelected',
  'onChange',
  'onPress',
  'onSelectionChange',
  'onValueChange',
  'value',
]

/** Whether a slot holds a control of its own, which keeps the row ungrouped. */
function holdsControl(node: ReactNode): boolean {
  if (Array.isArray(node)) {
    return node.some((part: ReactNode) => holdsControl(part))
  }
  if (
    !isValidElement<Record<string, unknown> & { children?: ReactNode }>(node)
  ) {
    return false
  }
  return (
    CONTROL_PROPS.some((prop) => node.props[prop] !== undefined) ||
    holdsControl(node.props.children)
  )
}

/**
 * A static row's name: the text of each part it holds, in reading order,
 * when every part it holds is text, and `undefined` otherwise, which leaves
 * the name to the platform's reading of the row.
 */
function nameOf(parts: readonly ReactNode[]): string | undefined {
  const held = parts.filter((part) => hasContent(part))
  const texts = held.map((part) => wordsOf(part))

  return texts.every((text) => text !== undefined) && texts.length > 0
    ? texts.join(', ')
    : undefined
}

// What a part says: its text, or the text of the element holding it, as a
// Text holds a trailing "01".
function wordsOf(node: ReactNode): string | undefined {
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return wordsOf(node.props.children)
  }
  return textOf(node)
}

export type { ListItemProps }

export { ListItem }
