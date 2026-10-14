import type { ComponentRef, ReactElement, ReactNode, Ref } from 'react'
import type {
  GestureResponderEvent,
  LayoutChangeEvent,
  PressableProps,
  StyleProp,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { Key } from 'react-stately'
import type { ToggleGroupState } from 'react-stately/useToggleGroupState'

import {
  Children,
  createContext,
  Fragment,
  isValidElement,
  use,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Text as NativeText, Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useToggleGroupState } from 'react-stately/useToggleGroupState'

import type { IconStyle } from '../../glyphs/icon-style'
import type { ResolvedTheme } from '../../theme/scope'

import { toggleState } from '../../button'
import { CheckGlyph } from '../../glyphs'
import { IconStyleContext } from '../../glyphs/icon-style'
import { hitSlop, usePressFeedback } from '../../press'
import { withOpacity } from '../../theme/color'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// The segmented buttons page's outlined segmented button, as kanso-ui's
// SegmentedButton draws it: two to five segments joined into one outlined
// track, of which one or several are chosen. A segment is Button's default
// size and type role, a 40dp container with a label-large label, which is
// what that page gives too.
//
// What a screen reader hears follows the selection mode, as on web. Choosing
// one is a radio group, so the track is a `radiogroup` and each segment a
// `radio` reporting whether it is checked. Choosing several is a `toolbar` of
// buttons, each reporting whether it is selected through `toggleState`, as a
// toggle Button does. The selection is React Stately's toggle group state, as
// web's is React Aria's, and in a set that chooses one, the chosen segment
// stays chosen when pressed again unless `disallowEmptySelection` is `false`.
//
// **The segments are one track.** Each carries the page's 1dp outline, and
// each after the first drops its leading edge, so neighbours share one rule.
// The outer ends take the page's fully rounded shape and the joins are
// square. Every segment is the same width, as wide as the widest one asks
// for: the labels are measured off screen, and each segment is handed the
// widest one's width, so a track squeezed into less room shares it out
// equally. The track is as wide as that, and never wider than what
// holds it.
//
// **A chosen segment draws a check** in the page's 18dp icon slot, in place
// of its `icon`. `showSelectedIcon={false}` turns it off, and the chosen
// segment then takes the secondary role with its label on it, since the
// page's own chosen container is too faint to say which is chosen by itself.
// A segment with an icon and no label keeps its icon when chosen, and takes
// the secondary role too. Every segment that could draw the slot keeps room
// for it whether or not it does, split either side of the label while
// nothing is drawn, so the track never changes width with the choice. That
// room gives way before the label does: a squeezed segment gives back the
// room first, then 4dp of its 12dp padding, and only then cuts its label
// short with an ellipsis. The slot and the room around it ease over
// `durationShort2` on the standard curve, and the check opens from its
// centre.
//
// **The chosen container moves.** In a set that chooses one it is a view of
// the track's own, behind the segments, so the labels and the rules are
// drawn over it, and it slides between segments over `durationMedium1` on the
// emphasized curve. It is drawn inside the track's outline, so it takes the
// rounded shape at either end and square corners between. It can only be
// placed once the segments are laid out, so until the choice first moves, the
// segment the set opened on draws a container of its own in the same place.
// Without it, the chosen label would stand on the bare surface in the frames
// before that layout, which is unreadable where no check marks it, since its
// colour is then the one meant for the secondary role. In a set that chooses
// several there is no one segment for it to be at, so each segment fades its
// own in and out where it is, over `durationShort2`. Both happen at once
// under reduced motion.
//
// The state layer, the ripple and the focus ring are src/press's, in the
// label's colour, over the chosen container. A segment's target reaches 4dp
// above and below the 40dp track, to the page's 48dp, and not across, since
// the segments sit flush.
//
// **Disabled is the page's colour at an opacity, translucent**, as a
// button's is: the label on-surface at `disabledContent`, and the rule and a
// chosen segment's container on-surface at `disabledContainer`.
//
// Two departures from web. The arrow keys do not move between the segments
// or choose one: each segment is a stop of its own for a hardware keyboard,
// and activating it there chooses it. And a label cut short has no `title` to
// show it whole, which a screen reader does not need, since it reads all of
// it.

/** What the set reads from the segments, and a segment from the set. */
type GroupContextValue = {
  /** The basis each segment takes, once every label is measured. */
  readonly basis: number | undefined
  readonly count: number
  /** Records where a segment was laid out, for the chosen container. */
  readonly onPlace: (key: Key, place: Place) => void
  /**
   * The segment a set that chooses one opened on, until the choice first
   * moves, which draws the chosen container itself meanwhile.
   */
  readonly opening: Key | undefined
  readonly places: ReadonlyMap<Key, Place>
  readonly selectionMode: SelectionMode
  readonly showSelectedIcon: boolean
  readonly state: ToggleGroupState
}

/** A name for the set: its own label, or the id of what labels it. */
type LabelledBy =
  | { readonly 'aria-label': string; readonly 'aria-labelledby'?: string }
  | { readonly 'aria-label'?: string; readonly 'aria-labelledby': string }

/** Where a segment was laid out in the track. */
type Place = {
  readonly width: number
  readonly x: number
}

type SegmentedButtonProps = LabelledBy &
  Omit<ViewProps, 'aria-label' | 'aria-labelledby' | 'children' | 'style'> & {
    /** The segments, each a `SegmentedButton.Segment` with an `id`. */
    readonly children?: ReactNode
    /** The keys chosen at first, when the set keeps its own selection. */
    readonly defaultSelectedKeys?: Iterable<Key>
    /**
     * Whether the chosen segment stays chosen when it is pressed again. On
     * by default while one is chosen, since a radio group always holds a
     * choice; `false` lets a press clear it. Off by default while several
     * may be, where any of them can be turned off.
     * @default true while one is chosen, false while several may be
     */
    readonly disallowEmptySelection?: boolean
    /**
     * Disables every segment.
     * @default false
     */
    readonly isDisabled?: boolean
    /** Called with the chosen keys when the choice changes. */
    readonly onSelectionChange?: (keys: Set<Key>) => void
    readonly ref?: Ref<ComponentRef<typeof View>>
    /** The chosen keys, when the call site holds the selection. */
    readonly selectedKeys?: Iterable<Key>
    /**
     * Whether one segment is chosen at a time, or several.
     * @default 'single'
     */
    readonly selectionMode?: SelectionMode
    /**
     * Whether a chosen segment draws a check before its label, as the page
     * has it. `false` leaves the segment's own icon in place while chosen,
     * and draws the chosen segment on the stronger secondary container.
     * @default true
     */
    readonly showSelectedIcon?: boolean
    readonly style?: StyleProp<ViewStyle>
  }

type SegmentedButtonSegmentProps = Omit<
  PressableProps,
  'children' | 'disabled' | 'id' | 'style'
> & {
  /** The segment's label. */
  readonly children?: ReactNode
  /**
   * Draws no press ripple. The hover and pressed state layers are unaffected.
   * @default false
   */
  readonly disableRipple?: boolean
  /**
   * An icon before the label, in the page's 18dp slot, which hands it the
   * label's colour and its size through `useIconStyle()`. Replaced by the
   * check while the segment is chosen, unless the set turns that off.
   *
   * Given with no label, the icon is the segment, centred in it and kept
   * while chosen; name the segment with `aria-label` then.
   */
  readonly icon?: ReactNode
  /** The key the selection reports the segment by. */
  readonly id: Key
  /**
   * Disables the segment alone.
   * @default false
   */
  readonly isDisabled?: boolean
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
}

type SelectionMode = 'multiple' | 'single'

// The page's 18dp icon slot, and the room a segment keeps for it: the slot
// and the 8dp gap between it and the label. A literal, as on web: the theme
// has no scale for icon sizes.
const GLYPH_SIZE = 18

// The rule every segment draws.
const RULE_WIDTH = 1

const CHECK = <CheckGlyph />

const GroupContext = createContext<GroupContextValue | null>(null)

// Where in the track a segment sits, which decides its corners and its rule.
const IndexContext = createContext(0)

const styles = StyleSheet.create({
  // A glyph sized rather than filling its slot, so a slot part way through
  // opening clips it instead of squashing it.
  glyph: {
    alignItems: 'center',
    flexShrink: 0,
    height: GLYPH_SIZE,
    justifyContent: 'center',
    width: GLYPH_SIZE,
  },
  // Opens from its centre, so the check wipes out from the middle rather
  // than arriving at full size.
  glyphSlot: {
    alignItems: 'center',
    flexShrink: 0,
    height: GLYPH_SIZE,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // The chosen container of a set that chooses one: the track's own view,
  // behind the segments, at the start of the track and moved from there to
  // the chosen segment.
  indicator: {
    bottom: 0,
    position: 'absolute',
    start: 0,
    top: 0,
  },
  // A label holds its width while the spacers beside it give theirs back,
  // and is cut short only at the width it is handed.
  label: {
    flexShrink: 0,
    minWidth: 0,
  },
  // The labels measured off screen, at their own widths, for the basis.
  measurer: {
    alignItems: 'flex-start',
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
    start: 0,
    top: 0,
  },
  // A segment's own chosen container, inside its rule: in a set that chooses
  // several, and in the segment a set that chooses one opened on.
  ownIndicator: {
    bottom: 0,
    end: 0,
    position: 'absolute',
    start: 0,
    top: 0,
  },
  // Either side of the label, holding the room a glyph needs, given back
  // before the label is cut.
  spacer: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
})

const stylesOf = themedStyles(({ colors, radii, sizing, spacing }) =>
  StyleSheet.create({
    // What the chosen container of a set that chooses one is drawn in: the
    // track's own outline, so the container takes an end's rounded shape at
    // either end and square corners between, wherever it is.
    clip: {
      borderRadius: radii.pill,
      bottom: 0,
      end: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      position: 'absolute',
      start: 0,
      top: 0,
    },
    // The first segment draws the leading rule the others leave to it.
    first: {
      borderStartWidth: RULE_WIDTH,
    },
    segment: {
      alignItems: 'center',
      borderColor: colors.outline,
      borderStartWidth: 0,
      borderWidth: RULE_WIDTH,
      flexDirection: 'row',
      flexShrink: 1,
      justifyContent: 'center',
      minHeight: sizing.controlSm,
      minWidth: 0,
      paddingHorizontal: spacing.sm,
    },
    // As wide as what is in it and never wider than what holds it, from the
    // start edge.
    track: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      maxWidth: '100%',
    },
  }),
)

// The track reaches as far as its segments' targets, since iOS and Android
// hand a touch to a view only once its parent has taken it.
const reachOf = themedStyles(({ sizing }) => hitSlop(sizing.controlSm))

/**
 * The width every segment takes: the widest one's, which is its label, its
 * padding, the room it keeps for a glyph and its rule. Undefined until every
 * label has been measured.
 */
function basisOf(
  segments: readonly ReactElement<SegmentedButtonSegmentProps>[],
  labels: ReadonlyMap<Key, number>,
  showSelectedIcon: boolean,
  { spacing }: ResolvedTheme,
): number | undefined {
  let basis = 0

  for (const [index, { props }] of segments.entries()) {
    const labelled = hasLabel(props.children)
    const label = labels.get(props.id)

    if (labelled && label === undefined) {
      return undefined
    }

    const content = labelled
      ? (label ?? 0) +
        (reservesGlyph(props, showSelectedIcon) ? GLYPH_SIZE + spacing.sm : 0)
      : props.icon === undefined
        ? 0
        : GLYPH_SIZE

    basis = Math.max(
      basis,
      content + spacing.md * 2 + ruleOf(index) + RULE_WIDTH,
    )
  }

  return basis
}

/**
 * The chosen container's colour: the page's secondary container, the
 * stronger secondary where no check marks the choice, and on-surface at the
 * disabled opacity while the segment is disabled.
 */
function containerOf(
  { colors, stateLayerOpacity }: ResolvedTheme,
  disabled: boolean,
  marked: boolean,
): string {
  if (disabled) {
    return withOpacity(colors.onSurface, stateLayerOpacity.disabledContainer)
  }
  return marked ? colors.secondaryContainer : colors.secondary
}

/**
 * The label's colour, which the glyph, the state layer and the ripple take
 * too.
 */
function contentOf(
  { colors, stateLayerOpacity }: ResolvedTheme,
  {
    disabled,
    marked,
    selected,
  }: {
    readonly disabled: boolean
    readonly marked: boolean
    readonly selected: boolean
  },
): string {
  if (disabled) {
    return withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)
  }
  if (!selected) {
    return colors.onSurface
  }
  return marked ? colors.onSecondaryContainer : colors.onSecondary
}

/** A segment's corners: rounded at the ends of the track, square between. */
function cornersOf(
  radius: number,
  first: boolean,
  last: boolean,
): Pick<
  ViewStyle,
  | 'borderBottomEndRadius'
  | 'borderBottomStartRadius'
  | 'borderTopEndRadius'
  | 'borderTopStartRadius'
> {
  return {
    borderBottomEndRadius: last ? radius : 0,
    borderBottomStartRadius: first ? radius : 0,
    borderTopEndRadius: last ? radius : 0,
    borderTopStartRadius: first ? radius : 0,
  }
}

// Whether a segment has a label, rather than an icon alone. An empty string
// and a `false` from a condition at the call site are no label either.
function hasLabel(children: ReactNode) {
  return (
    children !== undefined &&
    children !== null &&
    children !== false &&
    children !== ''
  )
}

function iconStyleOf(color: string): IconStyle {
  return { color, size: GLYPH_SIZE }
}

/**
 * The chosen container of a set that chooses one, which slides to the
 * segment chosen from the one chosen before it, fades in where nothing was
 * chosen, and fades out where nothing now is.
 */
function Indicator({
  color,
  place,
  selected,
}: {
  readonly color: string
  readonly place: Place | undefined
  readonly selected: Key | undefined
}) {
  const theme = useTheme()
  const { motion } = theme
  const reduceMotion = useReducedMotion()
  // Where the container rests before it is moved: the start of the track,
  // which is its right end under a right-to-left layout, so that where it
  // rests there depends on how wide it is. It is only read at the width it
  // was measured at, which keeps a resize from drawing it a frame out of
  // place.
  const [rest, setRest] = useState<Place | undefined>(undefined)
  const shift = useSharedValue(0)
  const shown = useSharedValue(0)
  // The key the container was last drawn at, and whether it has been drawn
  // at all, which tells a choice made on a set already drawn from the first
  // one the set opens with.
  const drawnAt = useRef<Key | undefined>(undefined)
  const drawn = useRef(false)

  const offset =
    place === undefined ||
    rest === undefined ||
    Math.abs(rest.width - place.width) >= 1
      ? undefined
      : place.x - rest.x

  useLayoutEffect(() => {
    const slide = {
      duration: motion.durationMedium1,
      easing: Easing.bezier(...motion.easingEmphasized),
    }

    if (selected === undefined) {
      if (drawnAt.current !== undefined) {
        shown.set(reduceMotion ? 0 : withTiming(0, slide))
      }
      drawnAt.current = undefined
      return
    }

    if (offset === undefined) {
      return
    }

    const from = drawnAt.current
    // A move from another segment slides; a layout that moved under the
    // same choice, or a choice from nothing, is drawn where it lands.
    const moves = from !== undefined && from !== selected && !reduceMotion

    shift.set(moves ? withTiming(offset, slide) : offset)

    if (from === undefined) {
      shown.set(drawn.current && !reduceMotion ? withTiming(1, slide) : 1)
    }

    drawnAt.current = selected
    drawn.current = true
  }, [motion, offset, reduceMotion, selected, shift, shown])

  const motionStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: shown.get(),
      transform: [{ translateX: shift.get() }],
    }
  })

  return (
    <View style={stylesOf(theme).clip}>
      <Animated.View
        onLayout={restThen(setRest)}
        style={composeStyles<AnimatedStyle<ViewStyle>>(
          styles.indicator,
          { backgroundColor: color, width: place?.width ?? 0 },
          motionStyle,
        )}
      />
    </View>
  )
}

/**
 * Records a label's width off screen, for the basis. Built by a call rather
 * than written inline at the prop, which is what react-perf's
 * jsx-no-new-function-as-prop is after; the React Compiler memoises the
 * result on its inputs.
 */
function measureThen(
  setLabels: (
    update: (labels: ReadonlyMap<Key, number>) => ReadonlyMap<Key, number>,
  ) => void,
  key: Key,
) {
  return (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout

    setLabels((labels) =>
      labels.get(key) === width ? labels : new Map(labels).set(key, width),
    )
  }
}

/**
 * Records where a segment was laid out, then calls the call site's own
 * `onLayout`.
 */
function placeThen(
  onPlace: (key: Key, place: Place) => void,
  key: Key,
  onLayout: PressableProps['onLayout'],
) {
  return (event: LayoutChangeEvent) => {
    const { width, x } = event.nativeEvent.layout

    onPlace(key, { width, x })
    onLayout?.(event)
  }
}

// Whether a segment can ever draw a glyph, and so keeps room for one: a set
// that draws the check, or an icon of its own. A segment that never needs
// the slot keeps no room for it, which would be dead space in every segment.
function reservesGlyph(
  { children, icon }: SegmentedButtonSegmentProps,
  showSelectedIcon: boolean,
) {
  return (showSelectedIcon && hasLabel(children)) || icon !== undefined
}

/** Records where the chosen container rests before it is moved. */
function restThen(setRest: (rest: Place) => void) {
  return (event: LayoutChangeEvent) => {
    const { width, x } = event.nativeEvent.layout

    setRest({ width, x })
  }
}

// The leading rule only the first segment draws.
function ruleOf(index: number) {
  return index === 0 ? RULE_WIDTH : 0
}

function samePlace(known: Place | undefined, place: Place) {
  return (
    known !== undefined && known.width === place.width && known.x === place.x
  )
}

/**
 * A row of two to five joined segments, of which one, or with
 * `selectionMode="multiple"` several, is chosen. Pass `selectedKeys` with
 * `onSelectionChange` to hold the choice, or `defaultSelectedKeys` to let the
 * set keep its own. Give every segment an `id`, which is the key the choice
 * is reported by.
 *
 * ```tsx
 * <SegmentedButton aria-label="Label" defaultSelectedKeys={['first']}>
 *   <SegmentedButton.Segment id="first">First item</SegmentedButton.Segment>
 *   <SegmentedButton.Segment id="second">Second item</SegmentedButton.Segment>
 * </SegmentedButton>
 * ```
 *
 * Name the set with `aria-label` or `aria-labelledby`, one of which the
 * props require. Choosing one is announced as a radio group, and choosing
 * several as a toolbar of buttons that each say whether they are selected.
 *
 * `style`, `ref` and `testID` land on the track.
 */
function SegmentedButton({
  children,
  defaultSelectedKeys,
  disallowEmptySelection,
  isDisabled = false,
  onSelectionChange,
  selectedKeys,
  selectionMode = 'single',
  showSelectedIcon = true,
  style,
  ...props
}: SegmentedButtonProps) {
  const theme = useTheme()
  const role = useTypeRole('labelLarge')
  const single = selectionMode === 'single'
  const state = useToggleGroupState({
    defaultSelectedKeys,
    disallowEmptySelection: disallowEmptySelection ?? single,
    isDisabled,
    onSelectionChange,
    selectedKeys,
    selectionMode,
  })
  const segments = segmentsOf(children)
  const [labels, setLabels] = useState<ReadonlyMap<Key, number>>(new Map())
  const [places, setPlaces] = useState<ReadonlyMap<Key, Place>>(new Map())

  // The segment the chosen container is at in a set that chooses one, or
  // was last at, which it fades out at once the choice is cleared.
  const chosen = [...state.selectedKeys].at(0)
  const [held, setHeld] = useState(chosen)
  if (chosen !== undefined && chosen !== held) {
    setHeld(chosen)
  }
  // The segment the set opened on, until the choice first moves, which draws
  // the chosen container itself while the track's waits on the layout.
  const [opening, setOpening] = useState(chosen)
  if (opening !== undefined && opening !== chosen) {
    setOpening(undefined)
  }

  const basis = basisOf(segments, labels, showSelectedIcon, theme)
  const context = useMemo(
    () => ({
      basis,
      count: segments.length,
      onPlace: (key: Key, place: Place) => {
        setPlaces((current) =>
          samePlace(current.get(key), place)
            ? current
            : new Map(current).set(key, place),
        )
      },
      opening,
      places,
      selectionMode,
      showSelectedIcon,
      state,
    }),
    [
      basis,
      opening,
      places,
      segments.length,
      selectionMode,
      setPlaces,
      showSelectedIcon,
      state,
    ],
  )

  const segment = segments.find(({ props: own }) => own.id === (chosen ?? held))

  return (
    <View
      hitSlop={reachOf(theme)}
      role={single ? 'radiogroup' : 'toolbar'}
      {...props}
      style={composeStyles<ViewStyle>(stylesOf(theme).track, style)}
    >
      {single ? (
        <Indicator
          color={containerOf(
            theme,
            isDisabled || segment?.props.isDisabled === true,
            showSelectedIcon && hasLabel(segment?.props.children),
          )}
          place={
            segment === undefined ? undefined : places.get(segment.props.id)
          }
          selected={segment === undefined ? undefined : chosen}
        />
      ) : null}
      <GroupContext value={context}>
        {segments.map((each, at) => (
          <IndexContext key={each.props.id} value={at}>
            {each}
          </IndexContext>
        ))}
      </GroupContext>
      <View aria-hidden style={styles.measurer}>
        {segments.map(({ props: own }) =>
          hasLabel(own.children) ? (
            <NativeText
              key={own.id}
              numberOfLines={1}
              onLayout={measureThen(setLabels, own.id)}
              style={role}
            >
              {own.children}
            </NativeText>
          ) : null,
        )}
      </View>
    </View>
  )
}

/**
 * One segment. Its `id` is the key the choice reports it by, and its label is
 * what names it. A chosen segment draws a check before its label; one not
 * chosen draws its `icon`, if it has one. Renders nothing outside a
 * `SegmentedButton`.
 *
 * `style`, `ref` and `testID` land on the segment's `Pressable`.
 */
function SegmentedButtonSegment({
  children,
  disableRipple = false,
  hitSlop: ownHitSlop,
  icon,
  id,
  isDisabled: ownDisabled = false,
  onBlur,
  onFocus,
  onHoverIn,
  onHoverOut,
  onLayout,
  onPress,
  onPressIn,
  onPressOut,
  style,
  ...props
}: SegmentedButtonSegmentProps) {
  const theme = useTheme()
  const group = use(GroupContext)
  const index = use(IndexContext)
  const role = useTypeRole('labelLarge')

  const state = group?.state
  const several = group?.selectionMode === 'multiple'
  const showSelectedIcon = group?.showSelectedIcon ?? true
  const selected = state?.selectedKeys.has(id) ?? false
  const disabled = ownDisabled || state?.isDisabled === true
  const labelled = hasLabel(children)
  const marked = showSelectedIcon && labelled
  const reserves = reservesGlyph({ children, icon, id }, showSelectedIcon)
  const glyph = selected && marked ? CHECK : (icon ?? null)
  const drawn = glyph !== null
  const first = index === 0
  const last = index === (group?.count ?? 0) - 1

  const { radii, spacing } = theme
  const content = contentOf(theme, { disabled, marked, selected })
  const corners = cornersOf(radii.pill, first, last)
  const own = stylesOf(theme)

  // The room for a glyph, as the header sets it out: either side of the
  // label while nothing is drawn, all of it before the label once something
  // is, and the glyph alone before an icon with no label.
  const give = spacing.md - spacing.sm
  const reserve = GLYPH_SIZE + spacing.sm
  const leading = reserves
    ? drawn
      ? give + (labelled ? reserve : GLYPH_SIZE)
      : give + reserve / 2
    : give
  const leadingFloor = drawn ? (labelled ? reserve : GLYPH_SIZE) : 0
  const trailing = reserves && !drawn ? give + reserve / 2 : give
  // The most the label takes: what is left of the segment once its rule, its
  // padding and a drawn glyph are taken out.
  const width = group?.places.get(id)?.width
  const room =
    width === undefined
      ? undefined
      : width -
        ruleOf(index) -
        RULE_WIDTH -
        spacing.sm * 2 -
        (drawn && labelled ? reserve : 0)

  const motion = useSegmentMotion({
    content,
    drawn,
    fades: several,
    filled: several ? selected : id === group?.opening,
    labelled,
    leading,
    leadingFloor,
    room,
    trailing,
  })

  const feedback = usePressFeedback({
    color: content,
    corners,
    disabled,
    disableRipple,
    onBlur,
    onFocus,
    onHoverIn,
    onHoverOut,
    onPressIn,
    onPressOut,
  })

  if (group === null) {
    return null
  }

  return (
    <Pressable
      role={several ? 'button' : 'radio'}
      {...(several ? toggleState(selected) : { 'aria-checked': selected })}
      {...props}
      {...feedback.handlers}
      disabled={disabled}
      hitSlop={ownHitSlop ?? reachOf(theme)}
      onLayout={placeThen(group.onPlace, id, onLayout)}
      onPress={toggleThen(group.state, id, onPress)}
      style={composeStyles<ViewStyle>(
        own.segment,
        first ? own.first : undefined,
        corners,
        disabled
          ? {
              borderColor: withOpacity(
                theme.colors.onSurface,
                theme.stateLayerOpacity.disabledContainer,
              ),
            }
          : undefined,
        group.basis === undefined
          ? undefined
          : { flexGrow: 0, width: group.basis },
        feedback.ring,
        style,
      )}
    >
      <Animated.View
        style={composeStyles<AnimatedStyle<ViewStyle>>(
          styles.ownIndicator,
          corners,
          { backgroundColor: containerOf(theme, disabled, marked) },
          motion.fill,
        )}
      />
      {feedback.layer}
      <Animated.View
        style={composeStyles<AnimatedStyle<ViewStyle>>(
          styles.spacer,
          motion.leading,
        )}
      >
        {reserves ? (
          <Animated.View
            style={composeStyles<AnimatedStyle<ViewStyle>>(
              styles.glyphSlot,
              motion.slot,
            )}
          >
            <IconStyleContext value={iconStyleOf(content)}>
              <View style={styles.glyph}>{glyph}</View>
            </IconStyleContext>
          </Animated.View>
        ) : null}
        {reserves ? <Animated.View style={motion.gap} /> : null}
      </Animated.View>
      {labelled ? (
        <Animated.Text
          numberOfLines={1}
          style={composeStyles<AnimatedStyle<TextStyle>>(
            role,
            styles.label,
            motion.label,
          )}
        >
          {children}
        </Animated.Text>
      ) : null}
      <Animated.View
        style={composeStyles<AnimatedStyle<ViewStyle>>(
          styles.spacer,
          motion.trailing,
        )}
      />
    </Pressable>
  )
}

/**
 * The segments among a set's children, with any fragment between them opened,
 * so a set can take its segments as one fragment.
 */
function segmentsOf(
  children: ReactNode,
): ReactElement<SegmentedButtonSegmentProps>[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ readonly children?: ReactNode }>(child)) {
      return []
    }
    if (child.type === Fragment) {
      return segmentsOf(child.props.children)
    }
    return isValidElement<SegmentedButtonSegmentProps>(child) ? [child] : []
  })
}

/**
 * A press on a segment: the call site's own `onPress`, then the choice, which
 * chooses the segment, or clears it if it was chosen and the set allows that.
 */
function toggleThen(
  state: ToggleGroupState,
  key: Key,
  onPress: PressableProps['onPress'],
) {
  return (event: GestureResponderEvent) => {
    onPress?.(event)
    state.toggleKey(key)
  }
}

/**
 * What a segment eases: the room either side of its label and the glyph slot
 * between them over `durationShort2`, the label's colour and the most it
 * takes with them, and its own chosen container where it `fades`, in a set
 * that chooses several. All of it is there at once under reduced motion, and
 * the container is in a set that chooses one, where it only stands in for the
 * track's until the choice first moves.
 */
function useSegmentMotion({
  content,
  drawn,
  fades,
  filled,
  labelled,
  leading,
  leadingFloor,
  room,
  trailing,
}: {
  readonly content: string
  readonly drawn: boolean
  readonly fades: boolean
  readonly filled: boolean
  readonly labelled: boolean
  readonly leading: number
  readonly leadingFloor: number
  readonly room: number | undefined
  readonly trailing: number
}) {
  const { motion, spacing } = useTheme()
  const reduceMotion = useReducedMotion()
  const timing = {
    duration: motion.durationShort2,
    easing: Easing.bezier(...motion.easingStandard),
  }
  const gap = drawn && labelled ? spacing.sm : 0
  const slot = drawn ? GLYPH_SIZE : 0
  const opacity = filled ? 1 : 0

  return {
    fill: useAnimatedStyle(() => {
      'worklet'
      return {
        opacity: reduceMotion || !fades ? opacity : withTiming(opacity, timing),
      }
    }),
    // A view of its own rather than an end margin on the slot: under React
    // Native Web, Reanimated writes an animated style to the element without
    // the step that turns `marginEnd` into a side, so it would never arrive.
    gap: useAnimatedStyle(() => {
      'worklet'
      return { width: reduceMotion ? gap : withTiming(gap, timing) }
    }),
    label: useAnimatedStyle(() => {
      'worklet'
      return {
        color: reduceMotion ? content : withTiming(content, timing),
        ...(room === undefined
          ? undefined
          : { maxWidth: reduceMotion ? room : withTiming(room, timing) }),
      }
    }),
    leading: useAnimatedStyle(() => {
      'worklet'
      return {
        minWidth: reduceMotion
          ? leadingFloor
          : withTiming(leadingFloor, timing),
        width: reduceMotion ? leading : withTiming(leading, timing),
      }
    }),
    slot: useAnimatedStyle(() => {
      'worklet'
      return { width: reduceMotion ? slot : withTiming(slot, timing) }
    }),
    trailing: useAnimatedStyle(() => {
      'worklet'
      return { width: reduceMotion ? trailing : withTiming(trailing, timing) }
    }),
  }
}

SegmentedButton.Segment = SegmentedButtonSegment

export { SegmentedButton, SegmentedButtonSegment }
export type { SegmentedButtonProps, SegmentedButtonSegmentProps }
