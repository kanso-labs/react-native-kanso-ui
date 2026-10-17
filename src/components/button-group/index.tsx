import type { ComponentRef, ReactElement, ReactNode, Ref } from 'react'
import type { StyleProp, ViewProps, ViewStyle } from 'react-native'
import type { Key } from 'react-stately'

import { Children, Fragment, isValidElement, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useToggleGroupState } from 'react-stately/useToggleGroupState'

import type { ControlSize } from '../../button'
import type {
  ButtonGroupItem,
  GroupButtonState,
  GroupCorners,
} from '../../button/group'
import type { ResolvedTheme } from '../../theme/scope'
import type { ButtonShape } from '../button'

import { HEIGHTS } from '../../button'
import { ButtonGroupItemContext } from '../../button/group'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// The button groups page's two groups, around Buttons and IconButtons placed
// inside, as kanso-ui's ButtonGroup draws them: the standard group, buttons
// set apart by the page's 18dp, 12dp, 8dp, 8dp and 8dp across the sizes, and
// the connected group, buttons 2dp apart whose inner corners square off,
// 4dp, 8dp, 8dp, 16dp and 20dp, while the group's two ends keep the buttons'
// own round. A square connected group takes the same corner at its ends. The
// group draws nothing itself; it hands each button its size, its corners and
// its part in the press interaction through src/button's group.ts.
//
// **A press is felt across a standard group.** The pressed button widens by
// 15% of its width, the share Material Design's own group widens it by, and
// its neighbours narrow to make the room, so the group's width holds: both
// neighbours by half the gain each, or the one neighbour of a button at the
// group's end by all of it. Button takes the change as inline padding and
// IconButton as width, and both ease it over the motion tokens' short
// duration on the emphasised curve, or at once under reduced motion.
//
// **A connected group answers a press and a selection in the corner
// instead.** Its buttons stay where they are; a pressed one's inner corners
// tighten, and a selected one's round off entirely. The page gives the
// pressed corner for its small group alone, 4dp against the 8dp it rests at;
// the other sizes press to half their resting corner the same way. The
// page also gives XS and S buttons in a connected group a 48dp minimum
// width, which is their touch target. The corners ease as a button's own
// do, and follow the layout's direction, so a right-to-left group keeps its
// round end at its start, on the right.
//
// Given `selectionMode` the group keeps a selection of its buttons by their
// `id`s, as web's React Aria `ToggleButtonGroup` does, and every button in
// it is a toggle of the group's: a radio group for `single`, and a toolbar
// of buttons that each say whether they are selected for `multiple`.
// Without it the group is a plain group of buttons.

// The press interaction's share, from Material Design's own button group.
const EXPANDED_RATIO = 0.15

// The 18dp a standard group sets its smallest buttons apart by falls between
// two steps of the spacing scale and is written out, as on web.
const XS_GAP = 18

type ButtonGroupNaming =
  | { readonly 'aria-label': string; readonly 'aria-labelledby'?: string }
  | { readonly 'aria-label'?: string; readonly 'aria-labelledby': string }

type ButtonGroupProps = ButtonGroupNaming &
  Omit<
    ViewProps,
    'aria-label' | 'aria-labelledby' | 'children' | 'role' | 'style'
  > & {
    /**
     * The buttons: Buttons and IconButtons, each with an `id` in a group
     * that selects.
     */
    readonly children?: ReactNode
    /** The keys chosen at first, when the group keeps its own selection. */
    readonly defaultSelectedKeys?: Iterable<Key>
    /**
     * Whether a press on the last chosen button leaves it chosen rather
     * than clearing the choice.
     * @default false
     */
    readonly disallowEmptySelection?: boolean
    /**
     * Disables every button in the group.
     * @default false
     */
    readonly isDisabled?: boolean
    /** Called with the chosen keys when the choice changes. */
    readonly onSelectionChange?: (keys: Set<Key>) => void
    readonly ref?: Ref<ComponentRef<typeof View>>
    /** The chosen keys, when the call site holds the selection. */
    readonly selectedKeys?: Iterable<Key>
    /**
     * Makes the group select: `single` for one button at a time, `multiple`
     * for any number. Left out, the group's buttons are plain buttons.
     */
    readonly selectionMode?: 'multiple' | 'single'
    /**
     * The shape a connected group gives its two ends: `round`, the pill, or
     * `square`, the size's inner corner, which its inner corners take as
     * well.
     * @default 'round'
     */
    readonly shape?: ButtonShape
    /**
     * The size every button in the group takes, unless it names its own,
     * and the size the group spaces and shapes them for.
     * @default 'md'
     */
    readonly size?: ControlSize
    readonly style?: StyleProp<ViewStyle>
    /**
     * `standard` sets the buttons apart and widens a pressed one;
     * `connected` sets them 2dp apart with square inner corners.
     * @default 'standard'
     */
    readonly variant?: ButtonGroupVariant
  }

type ButtonGroupVariant = 'connected' | 'standard'

type Press = { readonly delta: number; readonly index: number }

const styles = StyleSheet.create({
  // A row as wide as its buttons, as web's inline-flex group is.
  group: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
  },
})

// The space between buttons, by variant and size.
const gapsOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    connected: { gap: spacing.xxs },
    lg: { gap: spacing.sm },
    md: { gap: spacing.md },
    xl: { gap: spacing.sm },
    xs: { gap: XS_GAP },
    xxl: { gap: spacing.sm },
  }),
)

// A connected button's three corners at each size: the inner corner it
// rests at, the one it presses to, and the round end, half the button's
// height. Not the pill: a corner larger than half its side scales down every
// corner beside it, so a pill end beside an 8dp inner corner would shrink
// the inner one. The 20dp at `xxl` and the 2dp and 10dp halves fall between
// steps of the radius scale and are written out, as on web.
const cornersOf = themedStyles(({ radii, sizing }: ResolvedTheme) => {
  const round = (size: ControlSize) => sizing[HEIGHTS[size]] / 2

  return {
    inner: { lg: radii.sm, md: radii.sm, xl: radii.lg, xs: radii.xs, xxl: 20 },
    pressed: { lg: radii.xs, md: radii.xs, xl: radii.sm, xs: 2, xxl: 10 },
    round: {
      lg: round('lg'),
      md: round('md'),
      xl: round('xl'),
      xs: round('xs'),
      xxl: round('xxl'),
    },
  } satisfies Record<string, Readonly<Record<ControlSize, number>>>
})

/**
 * A row of Buttons and IconButtons drawn as the button groups page's
 * standard or connected group. Given `selectionMode`, its buttons are
 * toggles whose selection the group keeps, by their `id`s.
 *
 * ```tsx
 * <ButtonGroup aria-label="Label" selectionMode="single" variant="connected">
 *   <Button id="first">First item</Button>
 *   <Button id="second">Second item</Button>
 *   <Button id="third">Third item</Button>
 * </ButtonGroup>
 * ```
 *
 * Name the group with `aria-label` or `aria-labelledby`, one of which the
 * props require. Choosing one is announced as a radio group, choosing
 * several as a toolbar, and a group that selects nothing as a group.
 *
 * `style`, `ref` and `testID` land on the row.
 */
function ButtonGroup({
  children,
  defaultSelectedKeys,
  disallowEmptySelection = false,
  isDisabled = false,
  onSelectionChange,
  selectedKeys,
  selectionMode,
  shape = 'round',
  size,
  style,
  variant = 'standard',
  ...props
}: ButtonGroupProps) {
  const theme = useTheme()
  const [press, setPress] = useState<null | Press>(null)
  // The state is kept whether or not the group selects, since a hook cannot
  // be called conditionally; a group that selects nothing never reads it.
  const state = useToggleGroupState({
    defaultSelectedKeys,
    disallowEmptySelection,
    isDisabled,
    onSelectionChange,
    selectedKeys,
    selectionMode: selectionMode ?? 'single',
  })
  const items = buttonsOf(children)
  const sized = size ?? 'md'
  const selection =
    selectionMode === undefined
      ? undefined
      : { single: selectionMode === 'single', state }

  return (
    <View
      role={
        selectionMode === undefined
          ? 'group'
          : selection?.single === true
            ? 'radiogroup'
            : 'toolbar'
      }
      {...props}
      style={composeStyles<ViewStyle>(
        styles.group,
        gapsOf(theme)[variant === 'connected' ? 'connected' : sized],
        style,
      )}
    >
      {items.map(({ element, key }, index) => (
        <ButtonGroupItemContext
          key={key}
          value={itemFor({
            corners: cornersOf(theme),
            count: items.length,
            index,
            isDisabled,
            press,
            selection,
            setPress,
            shape,
            size,
            variant,
          })}
        >
          {element}
        </ButtonGroupItemContext>
      ))}
    </View>
  )
}

// The buttons among a group's children, with any fragment between them
// opened, so a group can take its buttons as one fragment and still know
// which is first and which last. Each keeps a key made of its own and its
// fragments', so two fragments' children never share one.
function buttonsOf(
  children: ReactNode,
  prefix = '',
): { readonly element: ReactElement; readonly key: string }[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ readonly children?: ReactNode }>(child)) {
      return []
    }
    const key = `${prefix}${String(child.key)}`
    return child.type === Fragment
      ? buttonsOf(child.props.children, `${key}/`)
      : [{ element: child, key }]
  })
}

// A connected button's corners: the group's ends keep the outer shape, and
// every edge it shares with a neighbour takes the inner corner, tighter
// while pressed and round once selected; a press wins over a selection.
function connectedCorners(
  corners: ReturnType<typeof cornersOf>,
  index: number,
  count: number,
  size: ControlSize,
  shape: ButtonShape,
  { pressed, selected }: GroupButtonState,
): GroupCorners {
  const outer = shape === 'square' ? corners.inner[size] : corners.round[size]
  const inner = pressed
    ? corners.pressed[size]
    : selected
      ? corners.round[size]
      : corners.inner[size]

  return {
    end: index === count - 1 ? outer : inner,
    start: index === 0 ? outer : inner,
  }
}

// One button's part in the group: its size, whether it is disabled, the
// group's selection, its corners in a connected group, and its share of a
// press in a standard one.
function itemFor({
  corners,
  count,
  index,
  isDisabled,
  press,
  selection,
  setPress,
  shape,
  size,
  variant,
}: {
  readonly corners: ReturnType<typeof cornersOf>
  readonly count: number
  readonly index: number
  readonly isDisabled: boolean
  readonly press: null | Press
  readonly selection: ButtonGroupItem['selection']
  readonly setPress: (press: null | Press) => void
  readonly shape: ButtonShape
  readonly size: ControlSize | undefined
  readonly variant: ButtonGroupVariant
}): ButtonGroupItem {
  const sized = size ?? 'md'

  if (variant === 'connected') {
    return {
      corners: (state) =>
        connectedCorners(corners, index, count, sized, shape, state),
      isDisabled,
      keepsTarget: sized === 'xs' || sized === 'md',
      selection,
      shift: 0,
      size,
    }
  }

  return {
    isDisabled,
    keepsTarget: false,
    onPressEnd: () => {
      setPress(null)
    },
    onPressStart: (width) => {
      setPress({ delta: width * EXPANDED_RATIO, index })
    },
    selection,
    shift: shiftFor(index, count, press),
    size,
  }
}

// How far a standard group moves one button's width while a press is held:
// the pressed button gains the whole share, and its neighbours give it up,
// half each, or all of it from the one neighbour of a button at an end.
function shiftFor(index: number, count: number, press: null | Press) {
  if (press === null) {
    return 0
  }
  if (index === press.index) {
    return press.delta
  }
  if (Math.abs(index - press.index) !== 1) {
    return 0
  }

  const atEnd = press.index === 0 || press.index === count - 1

  return -(atEnd ? press.delta : press.delta / 2)
}

export { ButtonGroup }
export type { ButtonGroupProps, ButtonGroupVariant }
