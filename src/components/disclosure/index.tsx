import type { ComponentRef, ReactNode, Ref } from 'react'
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { Key } from 'react-stately'
import type { DisclosureGroupState } from 'react-stately/useDisclosureGroupState'
import type { DisclosureState } from 'react-stately/useDisclosureState'

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import { I18nManager, Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useDisclosureState } from 'react-stately/useDisclosureState'

import type { ResolvedTheme } from '../../theme/scope'

import { DisclosureGroupStateContext } from '../../disclosure'
import { ChevronEndGlyph } from '../../glyphs'
import { usePressFeedback } from '../../press'
import { RowContent, rowContentColor, rowStyleOf, rowStyles } from '../../row'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'

// kanso-ui's Disclosure: a section that opens to show what is under it, and
// closes again. The header is the row every list here draws, src/row, shared
// with ListItem and every menu item, so its 56dp floor, 72dp with a
// supporting line, body-large headline, body-medium supporting line and
// state layers are that module's, and a header above a list cannot drift
// from the rows below it. A 24dp chevron in its trailing slot turns a quarter
// to point down once the section is open, over the short3 duration on the
// standard curve, as web's does, and mirrors under right-to-left. The panel
// holds its content 16dp in, lined up with the headline above it.
//
// **The header is a button and not a heading.** Web renders the button
// inside a heading at `headingLevel`; React Native's screen readers have no
// heading levels, so the prop is dropped, as AppBar drops it. The button
// reports whether the section is expanded.
//
// **The panel moves its height on Reanimated**, from nothing to the height
// its content reports through `onLayout`, over the medium2 duration on the
// emphasised curve, web's. Under reduced motion it opens and closes at once.
// It closes the same way it opens, which web does not: there the collapsed
// panel takes React Aria's `hidden="until-found"`, which stops its content
// being laid out at once and leaves nothing to shrink, and native has no
// counterpart to it. Once closed, its content is laid out no longer, so
// nothing in it is reached by a press, a key or a screen reader, and it is
// hidden from a screen reader while it closes.
//
// The state is React Stately's `useDisclosureState`, the one web's React Aria
// keeps, handed to the two parts through context. Inside a DisclosureGroup
// the group's keys say whether the section is open, under its `id`, and the
// group's `isDisabled` disables it as its own does, as React Aria's do.

const stylesOf = themedStyles(({ spacing }: ResolvedTheme) =>
  StyleSheet.create({
    inner: {
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
  }),
)

const styles = StyleSheet.create({
  // What the panel's height moves inside: its content lays out at its own
  // height whatever the clip is, which is what `onLayout` measures.
  clip: {
    overflow: 'hidden',
  },
  // A closed panel's content, which takes no part in layout, presses, keys
  // or a screen reader once its close has run.
  closed: {
    display: 'none',
  },
})

type DisclosureContextValue = {
  readonly header: string
  readonly isDisabled: boolean
  readonly state: DisclosureState
}

type DisclosureHeaderProps = {
  /** The header's headline, what the section is about. */
  readonly children?: ReactNode
  /** Content before the headline: an avatar, an icon. */
  readonly leading?: ReactNode
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
  /** A second line under the headline, in the muted role. */
  readonly supporting?: ReactNode
  readonly testID?: string
}

type DisclosurePanelProps = {
  /** What the section shows while it is open. */
  readonly children?: ReactNode
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * `region` names the panel as a landmark, for a section a reader should be
   * able to jump to, where `group` only gathers what is in it.
   * @default 'group'
   */
  readonly role?: 'group' | 'region'
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

type DisclosureProps = {
  /** A `Disclosure.Header` and a `Disclosure.Panel`. */
  readonly children?: ReactNode
  /** Whether the section starts open, when it keeps its own state. */
  readonly defaultExpanded?: boolean
  /**
   * The section's key in a `DisclosureGroup`, which the group reports as
   * expanded. Outside a group it does nothing.
   */
  readonly id?: Key
  /**
   * Keeps the section from opening or closing, and draws its header
   * disabled.
   * @default false
   */
  readonly isDisabled?: boolean
  /** Whether the section is open, when the call site holds the state. */
  readonly isExpanded?: boolean
  /** Called with the new state as the section opens or closes. */
  readonly onExpandedChange?: (isExpanded: boolean) => void
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

const DisclosureContext = createContext<DisclosureContextValue | null>(null)

// The chevron in the header's trailing slot, pointing at what the section
// opens and turned a quarter to point down once it is open. The glyph
// mirrors itself under right-to-left, so the turn goes the other way there
// to point it down too.
function Chevron({ isExpanded }: { readonly isExpanded: boolean }) {
  const { motion } = useTheme()
  const reduceMotion = useReducedMotion()
  const turn = isExpanded ? (I18nManager.isRTL ? -90 : 90) : 0
  const angle = useSharedValue(turn)

  useEffect(() => {
    angle.set(
      reduceMotion
        ? turn
        : withTiming(turn, {
            duration: motion.durationShort3,
            easing: Easing.bezier(...motion.easingStandard),
          }),
    )
  }, [angle, motion, reduceMotion, turn])

  const turned = useAnimatedStyle(() => {
    'worklet'
    return { transform: [{ rotate: `${angle.get()}deg` }] }
  })

  return (
    <Animated.View style={turned}>
      <ChevronEndGlyph />
    </Animated.View>
  )
}

// The chevron, turned or not. A call rather than JSX written at the prop,
// which is what react-perf's jsx-no-jsx-as-prop is after; the React Compiler
// memoises the result on `isExpanded`.
function chevronFor(isExpanded: boolean) {
  return <Chevron isExpanded={isExpanded} />
}

/**
 * A section that opens to show what is under it. Pass `isExpanded` with
 * `onExpandedChange` to hold whether it is open, or `defaultExpanded` to let
 * it keep its own.
 *
 * ```tsx
 * <Disclosure>
 *   <Disclosure.Header>Headline</Disclosure.Header>
 *   <Disclosure.Panel>
 *     <Text>Supporting line</Text>
 *   </Disclosure.Panel>
 * </Disclosure>
 * ```
 *
 * The header is the row every list here draws, so a section above a list of
 * rows lines up with them. The panel opens to whatever height its content
 * reports, and opens and closes at once under reduced motion.
 *
 * Inside a `DisclosureGroup`, give it an `id`, the key the group reports.
 *
 * `style`, `ref` and `testID` land on the section's own view, as they do on
 * each part's.
 */
function Disclosure({
  children,
  defaultExpanded,
  id,
  isDisabled = false,
  isExpanded,
  onExpandedChange,
  ref,
  style,
  testID,
}: DisclosureProps) {
  const group = use(DisclosureGroupStateContext)
  const fallback = useId()
  const key = id ?? fallback
  const state = useDisclosureState({
    defaultExpanded,
    isExpanded: group === null ? isExpanded : group.expandedKeys.has(key),
    onExpandedChange: expandedChangeOf(group, key, onExpandedChange),
  })
  const header = useId()
  const disabled = isDisabled || (group?.isDisabled ?? false)
  const value = useMemo<DisclosureContextValue>(
    () => ({ header, isDisabled: disabled, state }),
    [disabled, header, state],
  )

  return (
    <DisclosureContext value={value}>
      <View ref={ref} style={style} testID={testID}>
        {children}
      </View>
    </DisclosureContext>
  )
}

/**
 * The row that opens and closes the section: a button announced as expanded
 * or collapsed, drawing the shared row's slots with a chevron in the
 * trailing one.
 */
function DisclosureHeader({
  children,
  leading,
  ref,
  style,
  supporting,
  testID,
}: DisclosureHeaderProps) {
  const { header, isDisabled, state } = useDisclosure('Disclosure.Header')
  const theme = useTheme()
  const feedback = usePressFeedback({
    color: rowContentColor(theme, { isDisabled }),
    disabled: isDisabled,
  })

  return (
    <Pressable
      aria-expanded={state.isExpanded}
      id={header}
      onPress={toggleOf(state)}
      ref={ref}
      role="button"
      testID={testID}
      {...feedback.handlers}
      disabled={isDisabled}
      style={composeStyles<ViewStyle>(
        rowStyleOf(theme, { supporting }),
        feedback.ring,
        feedback.ring === undefined ? undefined : rowStyles.ring,
        style,
      )}
    >
      {feedback.layer}
      <RowContent
        isDisabled={isDisabled}
        leading={leading}
        supporting={supporting}
        trailing={chevronFor(state.isExpanded)}
      >
        {children}
      </RowContent>
    </Pressable>
  )
}

/**
 * What the section shows while it is open. Its content sits 16dp in, lined
 * up with the headline above it, and it is named by the header.
 */
function DisclosurePanel({
  children,
  ref,
  role = 'group',
  style,
  testID,
}: DisclosurePanelProps) {
  const { header, state } = useDisclosure('Disclosure.Panel')
  const { isExpanded } = state
  const theme = useTheme()
  const own = stylesOf(theme)
  const { motion } = theme
  const reduceMotion = useReducedMotion()
  // Whether the content is laid out: from the moment the section opens until
  // its close has run.
  const [shown, setShown] = useState(isExpanded)
  const openness = useSharedValue(isExpanded ? 1 : 0)
  // The content's own height, once it has reported one while laid out. A
  // closed panel's content reports nothing worth keeping, and the handler is
  // there from the start all the same: React Native Web watches a view's size
  // only if it had a handler when it mounted.
  const height = useSharedValue(-1)
  const measure = useCallback(
    (event: LayoutChangeEvent) => {
      if (shown) {
        height.set(event.nativeEvent.layout.height)
      }
    },
    [height, shown],
  )

  // Laid out the moment it opens, and at once no longer when it closes with
  // no motion to run.
  if (isExpanded && !shown) {
    setShown(true)
  } else if (!isExpanded && shown && reduceMotion) {
    setShown(false)
  }

  useEffect(() => {
    const target = isExpanded ? 1 : 0

    if (reduceMotion) {
      openness.set(target)
      return undefined
    }

    openness.set(
      withTiming(target, {
        duration: motion.durationMedium2,
        easing: Easing.bezier(...motion.easingEmphasized),
      }),
    )
    if (isExpanded) {
      return undefined
    }

    const timer = setTimeout(() => {
      setShown(false)
    }, motion.durationMedium2)

    return () => {
      clearTimeout(timer)
    }
  }, [isExpanded, motion, openness, reduceMotion])

  // Open before the content has reported a height, the panel takes the
  // content's own, so a section that starts open draws it on the first
  // frame; otherwise it is the share of that height the motion has reached.
  const clip = useAnimatedStyle(() => {
    'worklet'
    const measured = height.get()
    const progress = openness.get()

    if (measured < 0) {
      return progress === 1 ? {} : { height: 0 }
    }

    return { height: measured * progress }
  })

  return (
    <Animated.View
      aria-hidden={!isExpanded}
      aria-labelledby={header}
      ref={ref}
      role={role}
      style={composeStyles<AnimatedStyle<ViewStyle>>(styles.clip, clip, style)}
      testID={testID}
    >
      <View
        onLayout={measure}
        style={composeStyles<ViewStyle>(
          own.inner,
          shown ? undefined : styles.closed,
        )}
      >
        {children}
      </View>
    </Animated.View>
  )
}

// What a section calls as it opens or closes: inside a group, the group's
// toggle of its key first, then the call site's own handler either way.
function expandedChangeOf(
  group: DisclosureGroupState | null,
  key: Key,
  onExpandedChange: ((isExpanded: boolean) => void) | undefined,
) {
  return (expanded: boolean) => {
    group?.toggleKey(key)
    onExpandedChange?.(expanded)
  }
}

// A press's toggle. Built by a call rather than declared in the component,
// which is what react-perf's jsx-no-new-function-as-prop is after; the React
// Compiler memoises the result on its input.
function toggleOf(state: DisclosureState) {
  return () => {
    state.toggle()
  }
}

function useDisclosure(part: string): DisclosureContextValue {
  const value = use(DisclosureContext)
  if (value === null) {
    throw new Error(`${part} is drawn inside Disclosure.`)
  }
  return value
}

Disclosure.Header = DisclosureHeader
Disclosure.Panel = DisclosurePanel

export { Disclosure, DisclosureHeader, DisclosurePanel }
export type { DisclosureHeaderProps, DisclosurePanelProps, DisclosureProps }
