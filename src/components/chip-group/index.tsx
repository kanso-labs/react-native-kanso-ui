import type { ReactElement, ReactNode, Ref } from 'react'
import type {
  GestureResponderEvent,
  Insets,
  PressableProps,
  StyleProp,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { Key, Node, Selection, SelectionMode } from 'react-stately'
import type { ListProps, ListState } from 'react-stately/useListState'

import { useId, useState } from 'react'
import {
  Text as NativeText,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import Animated from 'react-native-reanimated'
import { useListState } from 'react-stately/useListState'

import { AnimatedPressable, toggleState } from '../../button'
import {
  ChipGlyph,
  ChipLabel,
  measureThen,
  paintOf,
  targetOf,
  useEasedColors,
} from '../../chip'
import { GLYPH_SIZE, RULE_WIDTH, stylesOf } from '../../chip/styles'
import { CloseGlyph } from '../../glyphs'
import { TARGET_SIZE, usePressFeedback } from '../../press'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// The chips page's filter and input chips as a set, as kanso-ui's ChipGroup
// draws them: one or more chosen from a row that wraps, each one removable.
// The pill is src/chip's, shared with Chip, so the two cannot drift; what is
// here is the group around them.
//
// **Selection is the group's, not each chip's.** It is React Stately's
// `useListState`, as web's is React Aria's, so `selectionMode`,
// `selectedKeys`, `defaultSelectedKeys`, `onSelectionChange` and
// `disabledKeys` behave as they do there. A press on a chip selects it, or
// clears it if it was selected; in a group that selects one, a press on
// another moves the selection there. A chip in a group that selects nothing is
// not a button at all, since a press there would change nothing.
//
// **A chip can be removed.** Give the group `onRemove` and each chip draws the
// page's trailing close glyph, an 18dp glyph in the label's colour, in a
// target of its own so a press there removes rather than selects. It is a
// sibling of the chip's own button rather than a child, laid over the pill's
// end: VoiceOver reaches nothing inside a button, so a close target inside one
// could never be focused. Its target is WCAG's 24dp, as on web, since the chip
// around it is no spacing to lean on when the group selects. It draws its
// hover and pressed layers in the label's colour, and on focus from a key a
// 2dp ring in the same colour, 1dp out, as web's does: a second ring in the
// focus role inside a chip would read as two focus treatments for one focus.
//
// The label, the line under the chips and the gaps between them are the
// field chrome's, as RadioGroup draws them: the label in label large and on
// surface variant, or error while the group has one; the chips 8dp apart and
// wrapping, from the start edge, so from the right under a right-to-left
// layout; and the line under them in body small, 4dp further down. The row
// keeps a chip's height while it is empty, so removing the last chip leaves
// what sits under the group where it was.
//
// Three departures from web. Arrow keys do not move between the chips, and
// Backspace and Delete do not remove one: each chip and each close target is
// a stop of its own for a hardware keyboard. The close target is named
// `Remove` and the chip's text in English unless `removeLabel` says
// otherwise, where web's follows the reader's locale. And the close glyph
// takes the label's colour at once rather than easing with it, as the check
// does.

type ChipGroupChipProps = Omit<
  PressableProps,
  'children' | 'disabled' | 'id' | 'style'
> & {
  /** The chip's label. */
  readonly children: ReactNode
  /**
   * An icon before the label, in the page's 18dp slot and the primary role,
   * which the slot hands it through `useIconStyle()`. The check takes its
   * place while the chip is chosen, so the chip keeps its width.
   */
  readonly icon?: ReactNode
  /**
   * The key selection and removal report the chip by. Without one, a chip
   * drawn from `items` takes its item's `id` or `key`.
   */
  readonly id?: Key
  /**
   * Draws the chip disabled, and takes no presses on it or on its close
   * target, as a key in the group's `disabledKeys` does.
   * @default false
   */
  readonly isDisabled?: boolean
  readonly ref?: Ref<View>
  readonly style?: StyleProp<ViewStyle>
  /**
   * The chip's text, which names its close target. Read off `children` when
   * they are a plain string, so a chip whose label is an element passes it.
   */
  readonly textValue?: string
}

type ChipGroupProps<T extends object = object> = Omit<
  ViewProps,
  'children' | 'style'
> & {
  /**
   * The chips, each a `ChipGroup.Chip` with an `id` of its own. With
   * `items`, a function from an item to its chip, called for each item in
   * turn.
   */
  readonly children?: ((item: T) => ReactElement) | ReactNode
  /** The keys selected at first, when the group keeps its own selection. */
  readonly defaultSelectedKeys?: 'all' | Iterable<Key>
  /**
   * A hint under the group. Replaced by `error` when there is one, so the
   * two never stack.
   */
  readonly description?: string
  /** The keys of the chips drawn disabled, which take no presses. */
  readonly disabledKeys?: Iterable<Key>
  /**
   * Keeps the last selected chip selected, so a press on it changes
   * nothing.
   * @default false
   */
  readonly disallowEmptySelection?: boolean
  /**
   * The problem with the current selection, in words. Its presence is what
   * puts the group in its error state: the message and the label's colour
   * both follow from it.
   */
  readonly error?: string
  /** The entries `children` draws a chip for, when it is a function. */
  readonly items?: Iterable<T>
  /**
   * What the group is for. Required rather than optional: a set of chips
   * with no name is a row a screen reader cannot introduce.
   */
  readonly label: string
  /**
   * Called with the key of the chip whose close target was pressed. Given
   * this, every chip draws one; the call site removes the chip from what it
   * renders.
   */
  readonly onRemove?: (keys: Set<Key>) => void
  /** Called with the selected keys whenever a press changes them. */
  readonly onSelectionChange?: (keys: Selection) => void
  readonly ref?: Ref<View>
  /**
   * What the close target on each chip is called, for a screen reader. The
   * chip's own text follows it, so this is the verb rather than the whole
   * phrase: "Remove" becomes "Remove First item".
   * @default 'Remove'
   */
  readonly removeLabel?: string
  /** What the row draws once it holds no chips. */
  readonly renderEmptyState?: () => ReactNode
  /**
   * The selected keys, for a call site holding the selection itself with
   * `onSelectionChange`.
   */
  readonly selectedKeys?: 'all' | Iterable<Key>
  /**
   * Whether a press selects a chip: one at a time, several, or none, in
   * which case the chips are not buttons.
   * @default 'none'
   */
  readonly selectionMode?: SelectionMode
  readonly style?: StyleProp<ViewStyle>
}

// The close target reaches 3dp past its 18dp glyph on every side, which is
// WCAG's 24dp.
const REMOVE_REACH: Insets = { bottom: 3, left: 3, right: 3, top: 3 }

const styles = StyleSheet.create({
  // Holds the pill and the close target laid over it, and is never wider
  // than the row, so the pill inside has a width to cut its label at.
  chip: {
    maxWidth: '100%',
  },
  layer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
})

const groupStylesOf = themedStyles(
  ({ colors, radii, sizing, spacing, stateLayerOpacity }) =>
    StyleSheet.create({
      label: {
        color: colors.onSurfaceVariant,
      },
      labelError: {
        color: colors.error,
      },
      // The chips, 8dp apart and wrapping rather than running off the end,
      // since a set is read all at once. A chip's height while empty.
      list: {
        alignItems: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        minHeight: sizing.controlXs,
      },
      message: {
        color: colors.onSurfaceVariant,
      },
      messageError: {
        color: colors.error,
      },
      messageLine: {
        marginTop: spacing.xs,
      },
      // A removable pill leaves room at its end for the close target, its 8dp
      // gap before it and the 8dp the page pads after it.
      removable: {
        paddingEnd: spacing.lg + GLYPH_SIZE,
      },
      // The close target, over the pill's end, where the pill's own padding
      // would end: the page pads 8dp on the side the glyph is on, and the
      // label keeps the chip's 8dp gap before it.
      remove: {
        alignItems: 'center',
        borderRadius: radii.circle,
        end: RULE_WIDTH + spacing.lg - spacing.sm,
        height: GLYPH_SIZE,
        justifyContent: 'center',
        marginTop: -GLYPH_SIZE / 2,
        position: 'absolute',
        top: '50%',
        width: GLYPH_SIZE,
      },
      removeHovered: {
        opacity: stateLayerOpacity.hover,
      },
      removeLayer: {
        borderRadius: radii.circle,
        opacity: 0,
      },
      removePressed: {
        opacity: stateLayerOpacity.pressed,
      },
      root: {
        flexDirection: 'column',
        rowGap: spacing.xs,
      },
    }),
)

/**
 * A labelled set of chips, one or more of which can be chosen, each of which
 * can be removed. Selection is React Stately's: set `selectionMode` to
 * `single` or `multiple`, and pass `selectedKeys` with `onSelectionChange` to
 * control it, or `defaultSelectedKeys` to let the group keep its own.
 *
 * ```tsx
 * <ChipGroup label="Label" onRemove={remove} selectionMode="multiple">
 *   <ChipGroup.Chip id="first">First item</ChipGroup.Chip>
 * </ChipGroup>
 * ```
 *
 * Give the group `onRemove` and each chip draws a close target. A chip that
 * toggles nothing else is Chip; this is for a set that shares a value.
 *
 * A screen reader hears a group named by its label, and each chip as a button
 * named by its label, selected or not. On the web the line under the group
 * describes it, as web's does; on iOS and Android it is read after the chips,
 * where it sits. `style`, `ref` and `testID` land on the group as a whole,
 * which is the element a layout positions.
 */
function ChipGroup<T extends object = object>({
  children,
  defaultSelectedKeys,
  description,
  disabledKeys,
  disallowEmptySelection,
  error,
  items,
  label,
  onRemove,
  onSelectionChange,
  removeLabel = 'Remove',
  renderEmptyState,
  selectedKeys,
  selectionMode = 'none',
  style,
  ...props
}: ChipGroupProps<T>) {
  const theme = useTheme()
  const state = useListState<T>({
    // Each chip builds its own entry in the collection; see
    // `ChipGroupChip.getCollectionNode`. The collection skips what is not an
    // element, as a ReactNode may be, and asks any element for its entry.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    children: children as ListProps<T>['children'],
    defaultSelectedKeys,
    disabledKeys,
    disallowEmptySelection,
    items,
    onSelectionChange,
    selectedKeys,
    selectionMode,
  })
  const labelId = useId()
  const messageId = useId()
  const labelRole = useTypeRole('labelLarge')
  const messageRole = useTypeRole('bodySmall')

  const own = groupStylesOf(theme)
  const invalid = error !== undefined
  const message = error ?? description
  const nodes = [...state.collection]

  return (
    <View
      {...props}
      aria-labelledby={labelId}
      role="group"
      {...lineOf(messageId, message)}
      style={composeStyles<ViewStyle>(own.root, style)}
    >
      <NativeText
        id={labelId}
        style={composeStyles<TextStyle>(
          labelRole,
          own.label,
          invalid ? own.labelError : undefined,
        )}
      >
        {label}
      </NativeText>
      <View style={own.list}>
        {nodes.length === 0
          ? renderEmptyState?.()
          : nodes.map((node) => (
              <GroupChip
                key={node.key}
                node={node}
                onRemove={onRemove}
                removeLabel={removeLabel}
                state={state}
              />
            ))}
      </View>
      {message === undefined ? null : (
        <View style={own.messageLine}>
          <NativeText
            id={messageId}
            style={composeStyles<TextStyle>(
              messageRole,
              own.message,
              invalid ? own.messageError : undefined,
            )}
          >
            {message}
          </NativeText>
        </View>
      )}
    </View>
  )
}

/**
 * One chip of a `ChipGroup`, which draws it: the group builds its set from
 * these, so one renders nothing on its own. Give every chip an `id`, which is
 * the key selection and removal report it by.
 */
function ChipGroupChip(_props: ChipGroupChipProps): null {
  return null
}

// The entry the group's collection holds for a chip, as React Stately's own
// `Item` gives one: keyed by the chip's `id`, and carrying the props the group
// draws it from.
ChipGroupChip.getCollectionNode = function* getCollectionNode(
  props: ChipGroupChipProps,
) {
  yield {
    'aria-label': props['aria-label'],
    hasChildNodes: false,
    key: props.id,
    props,
    rendered: props.children,
    textValue:
      props.textValue ??
      (typeof props.children === 'string' ? props.children : ''),
    type: 'item',
  }
}

/**
 * A chip as the group draws it, from its entry in the collection: the pill,
 * which is a button while the group selects, and the close target over its
 * end while the group removes.
 */
function GroupChip<T>({
  node,
  onRemove,
  removeLabel,
  state,
}: {
  readonly node: Node<T>
  readonly onRemove: ((keys: Set<Key>) => void) | undefined
  readonly removeLabel: string
  readonly state: ListState<T>
}) {
  const theme = useTheme()
  // A node carries the props its chip was written with, which
  // `getCollectionNode` puts there and React Stately types as `any`.
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- see above
  const {
    children,
    hitSlop,
    icon,
    id: _id,
    isDisabled: _isDisabled,
    onBlur,
    onFocus,
    onHoverIn,
    onHoverOut,
    onLayout,
    onPress,
    onPressIn,
    onPressOut,
    style,
    textValue: _textValue,
    ...props
  }: ChipGroupChipProps = node.props
  // Until the chip is measured it takes no reach across, rather than one
  // sized for a chip of no width.
  const [width, setWidth] = useState(TARGET_SIZE)

  const { selectionManager } = state
  // The selection manager reads a chip's own `isDisabled` off its node, beside
  // the group's `disabledKeys`, so it answers for both.
  const isDisabled = selectionManager.isDisabled(node.key)
  const selectable = selectionManager.selectionMode !== 'none'
  const selected = selectionManager.isSelected(node.key)
  const paint = paintOf(theme, {
    assist: false,
    disabled: isDisabled,
    elevated: false,
    selected,
  })
  const eased = useEasedColors(paint)

  const feedback = usePressFeedback({
    color: paint.layer,
    corners: { borderRadius: theme.radii.sm },
    disabled: isDisabled,
    onBlur,
    onFocus,
    onHoverIn,
    onHoverOut,
    onPressIn,
    onPressOut,
  })

  const pill = composeStyles<AnimatedStyle<ViewStyle>>(
    stylesOf(theme).pill,
    eased.container,
    onRemove === undefined ? undefined : groupStylesOf(theme).removable,
    feedback.ring,
    style,
  )
  const content = (
    <>
      {selectable ? feedback.layer : null}
      <ChipGlyph color={paint.glyph} icon={icon} selected={selected} />
      <ChipLabel color={eased.label}>{children}</ChipLabel>
    </>
  )
  const target = hitSlop ?? targetOf(width, theme)

  return (
    // The view holding the two takes the chip's target too: iOS and Android
    // hand a touch to a view only once its parent has taken it.
    <View hitSlop={selectable ? target : undefined} style={styles.chip}>
      {selectable ? (
        <AnimatedPressable
          role="button"
          {...toggleState(selected)}
          {...props}
          {...feedback.handlers}
          disabled={isDisabled}
          hitSlop={target}
          onLayout={measureThen(setWidth, onLayout)}
          onPress={selectThen(state, node.key, onPress)}
          style={pill}
        >
          {content}
        </AnimatedPressable>
      ) : (
        // A press here changes nothing, so the chip is a view, and takes the
        // props a view has; a press handler among them is never called.
        <Animated.View
          {...props}
          aria-disabled={isDisabled}
          onLayout={onLayout ?? undefined}
          style={pill}
        >
          {content}
        </Animated.View>
      )}
      {onRemove === undefined ? null : (
        <RemoveButton
          color={paint.content}
          isDisabled={isDisabled}
          label={
            node.textValue === ''
              ? removeLabel
              : `${removeLabel} ${node.textValue}`
          }
          onPress={removeThen(onRemove, node.key)}
        />
      )}
    </View>
  )
}

/**
 * How the group is described by the line under it. On the web it points at
 * the line with `aria-describedby`, as web's group does. iOS and Android
 * focus the chips rather than the group, so there the line is left where a
 * screen reader reaches it in order, after the last chip.
 */
function lineOf(id: string, message: string | undefined) {
  return Platform.OS === 'web' && message !== undefined
    ? { 'aria-describedby': id }
    : undefined
}

/**
 * A chip's close target: the close glyph in the label's colour, with a hover
 * and a pressed layer of its own and a ring for focus from a key, as the
 * header sets out.
 */
function RemoveButton({
  color,
  isDisabled,
  label,
  onPress,
}: {
  readonly color: string
  readonly isDisabled: boolean
  readonly label: string
  readonly onPress: () => void
}) {
  const theme = useTheme()
  const feedback = usePressFeedback({
    color,
    disabled: isDisabled,
    disableRipple: true,
  })
  const own = groupStylesOf(theme)

  return (
    <Pressable
      aria-label={label}
      role="button"
      {...feedback.handlers}
      disabled={isDisabled}
      hitSlop={REMOVE_REACH}
      onPress={onPress}
      style={composeStyles<ViewStyle>(
        own.remove,
        feedback.ring === undefined ? undefined : ringOf(color),
      )}
    >
      <View
        style={composeStyles<ViewStyle>(
          styles.layer,
          own.removeLayer,
          { backgroundColor: color },
          feedback.hovered ? own.removeHovered : undefined,
          feedback.pressed ? own.removePressed : undefined,
        )}
      />
      <CloseGlyph color={color} size={GLYPH_SIZE} />
    </Pressable>
  )
}

// What a press on a chip's close target reports. Built by a call rather than
// declared in the component, which is what react-perf's
// jsx-no-new-function-as-prop is after; the React Compiler memoises the
// result on its inputs.
function removeThen(onRemove: (keys: Set<Key>) => void, key: Key) {
  return () => {
    onRemove(new Set([key]))
  }
}

// The close target's ring: 2dp in the label's colour, 1dp out, as web's.
function ringOf(color: string): ViewStyle {
  return {
    outlineColor: color,
    outlineOffset: 1,
    outlineStyle: 'solid',
    outlineWidth: 2,
  }
}

// A press on a chip: the call site's own `onPress`, then the selection,
// which selects the chip, or clears it if it was selected and the group
// allows that.
function selectThen<T>(
  state: ListState<T>,
  key: Key,
  onPress: ((event: GestureResponderEvent) => void) | null | undefined,
) {
  return (event: GestureResponderEvent) => {
    onPress?.(event)
    state.selectionManager.select(key)
  }
}

ChipGroup.Chip = ChipGroupChip

export { ChipGroup, ChipGroupChip }
export type { ChipGroupChipProps, ChipGroupProps }
