import type { ComponentRef, ReactNode, Ref, RefObject } from 'react'
import type {
  HostInstance,
  StyleProp,
  TextInput,
  ViewStyle,
} from 'react-native'
import type { AnimatedStyle } from 'react-native-reanimated'
import type { EdgeInsets } from 'react-native-safe-area-context'
import type { OverlayTriggerState } from 'react-stately/useOverlayTriggerState'

import {
  createContext,
  use,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'
import { useOverlayTriggerState } from 'react-stately/useOverlayTriggerState'

import type { AutocompleteValue } from '../../autocomplete'
import type { ButtonSlots } from '../../button/slots'
import type { AnchoredPlacement } from '../../overlay'
import type { ResolvedTheme } from '../../theme/scope'
import type { AutocompleteProps } from '../autocomplete'

import { AutocompleteContext } from '../../autocomplete'
import { ButtonSlotContext } from '../../button/slots'
import { FieldInput } from '../../field'
import { ArrowBackGlyph, CloseGlyph } from '../../glyphs'
import { useWindowSizeClass } from '../../hooks/useWindowSizeClass'
import { useMessages } from '../../i18n/provider'
import { insetsOf, ModalWindow, NO_INSETS, panelRoleOf } from '../../modal'
import { useAnchoredPlacement } from '../../overlay'
import { useKeyboardTop } from '../../overlay/keyboard'
import {
  PANEL_ORIGINS,
  useFocusOnPlaced,
  usePanelMotion,
  useReturnFocus,
} from '../../overlay/panel'
import { refsOf } from '../../ref'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { Autocomplete } from '../autocomplete'
import { IconButton } from '../icon-button'

// kanso-ui's SearchView, the search page's search view: what a search opens
// into. A header holds a back button, the input and a clear button, over a
// 1dp divider in the outline role, and the results run under it. Both of the
// page's forms are surface container high, with the input in body large on
// surface over a supporting text in on surface variant, the back icon in on
// surface and the clear icon in on surface variant.
//
// **Which form is the window's.** In a compact window it is the page's
// full-screen view: the whole window, square, with a 72dp header, its content
// inside the safe area while its fill runs on under it. From the medium
// window up, the docked view: dropped under what opened it, as wide as that
// and held between the page's 360dp and 720dp, with a 28dp corner, a 56dp
// header, results at least 240dp tall and the whole view no taller than two
// thirds of the window, at elevation 3, as web's takes them from Compose's
// docked search bar. Both headers grow by as much as the input's line does at
// the device's text size.
//
// **Both forms are drawn in a `Modal`**, through src/modal, as web's is a
// dialog in a modal popover: a screen reader stays inside the view until it
// closes, and a press outside the docked one lands on a scrim that draws
// nothing and closes it. The docked one is placed by src/overlay's anchored
// placement under its trigger, flipped above it where there is no room, and
// kept above the software keyboard. Full screen, the results stop at the
// keyboard's top edge, so the last of them can be scrolled into sight above
// the keys.
//
// **It is Autocomplete around the header and the results**, as web's is: the
// header's input is the autocomplete's field, so a ListBox or a List among
// the results narrows as it is typed into, says how many rows a search leaves
// to a screen reader, and takes a press on its first tap while the keyboard
// is up, as it does anywhere inside an Autocomplete.
//
// **The header lines up with the search bar's.** The back button sits where
// SearchField's magnifier does, its icon 28dp in, and the text starts at
// 68dp, as the bar's does; the clear button's icon ends 28dp from the end. So
// a view opened from a bar puts its input where the bar's was.
//
// **Focus goes to the input and back.** The input takes the keyboard's focus
// as the view opens, and a screen reader is sent to it once the view shows,
// and back to the trigger once it has gone. The back button closes it, as
// Android's back gesture, VoiceOver's escape gesture and Escape on web do.
// It fades and scales in and out, as src/overlay's anchored panels do, and
// at once under reduced motion.

// The page's full-screen header, and the docked view's bounds.
const FULL_HEADER = 72
const MIN_WIDTH = 360
const MAX_WIDTH = 720
const MIN_RESULTS = 240

// The docked view's scrim takes presses and draws nothing.
const UNSEEN: ViewStyle = { opacity: 0 }

const stylesOf = themedStyles(
  ({ colors, radii, shadows, spacing }: ResolvedTheme) =>
    StyleSheet.create({
      // 4dp in from the header's padding, so the icon inside the 40dp button
      // sits 28dp in, where the search bar draws its magnifier.
      back: {
        marginStart: spacing.xs,
      },
      // 4dp in from the padding, so the icon inside the 40dp button ends 28dp
      // from the end, as the search bar's does.
      clear: {
        marginEnd: spacing.xs,
      },
      // The page's divider under the header, in the outline role.
      divider: {
        backgroundColor: colors.outline,
        flexShrink: 0,
        height: 1,
      },
      docked: {
        borderRadius: radii.xl,
        boxShadow: shadows.elevation3,
      },
      full: {
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      header: {
        alignItems: 'center',
        flexDirection: 'row',
        flexShrink: 0,
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
      },
      // Full screen, the results take what the header leaves, and scroll
      // inside it.
      resultsFull: {
        flex: 1,
      },
      surface: {
        backgroundColor: colors.surfaceContainerHigh,
        overflow: 'hidden',
      },
    }),
)

type PanelProps = Omit<
  SearchViewContentProps,
  | 'backLabel'
  | 'clearLabel'
  | 'defaultInputValue'
  | 'filter'
  | 'inputValue'
  | 'onInputChange'
> & {
  readonly anchor: RefObject<HostInstance | null>
  readonly backLabel: string
  readonly clearLabel: string
  readonly close: () => void
  readonly docked: boolean
  readonly isOpen: boolean
  readonly setInput: (input: ComponentRef<typeof TextInput> | null) => void
  readonly setPresent: (present: boolean) => void
}

type SearchViewContentProps<T extends object = object> = Omit<
  AutocompleteProps<T>,
  'children'
> & {
  /**
   * What the back button is called, for a screen reader. Left out, the
   * library names it in the `I18nProvider`'s locale, or the device's outside
   * one, "Back" in English.
   */
  readonly backLabel?: string
  /** The results: a ListBox or a List, which typing narrows. */
  readonly children?: ReactNode
  /**
   * What the clear button is called, for a screen reader. Left out, it is
   * the name React Aria gives web's in the `I18nProvider`'s locale, or the
   * device's outside one, "Clear search" in English.
   */
  readonly clearLabel?: string
  /**
   * What is searched, for a screen reader. It names both the view and its
   * input, and is read rather than shown; `placeholder` is what is seen.
   */
  readonly label: string
  /** The supporting text in the empty input, which is what a person reads. */
  readonly placeholder?: string
  readonly ref?: Ref<HostInstance>
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

type SearchViewProps = {
  /**
   * The Button or IconButton that opens the view, and `SearchView.Content`.
   */
  readonly children?: ReactNode
  /** Whether the view starts open, when it keeps its own state. */
  readonly defaultOpen?: boolean
  /** Whether the view is open, when the call site holds the state. */
  readonly isOpen?: boolean
  /** Called with the new state as the view opens or closes. */
  readonly onOpenChange?: (isOpen: boolean) => void
}

// What the content reads from the root: the open state, and the trigger's
// node, which the docked view is placed under and focus goes back to.
type SearchViewRoot = {
  readonly anchor: RefObject<HostInstance | null>
  readonly state: OverlayTriggerState
}

const SearchViewContext = createContext<null | SearchViewRoot>(null)

// Empties the input from the clear button, and hands the keyboard back to it,
// so the next search is typed straight in.
function clearOf(
  autocomplete: AutocompleteValue,
  input: ComponentRef<typeof TextInput> | null,
) {
  return () => {
    autocomplete.setInputValue('')
    input?.focus()
  }
}

// The docked view: as wide as what opened it, between the page's bounds,
// and placed under it.
function dockedOf(placement: AnchoredPlacement): ViewStyle {
  return {
    ...placement.style,
    transformOrigin: PANEL_ORIGINS[placement.side],
    width: Math.min(
      MAX_WIDTH,
      Math.max(MIN_WIDTH, placement.anchorWidth ?? MIN_WIDTH),
    ),
  }
}

// The full-screen view's content inside the safe area, and above the
// keyboard where the keyboard reaches further up than the safe area's own
// bottom inset.
function fullOf(insets: EdgeInsets, covered: number): ViewStyle {
  return {
    ...insetsOf(insets),
    paddingBottom: Math.max(insets.bottom, covered),
    transformOrigin: 'top',
  }
}

// Where the view's bottom edge is in the window, kept for the keyboard to be
// measured against.
function measureBottomOf(
  panel: HostInstance | null,
  setBottom: (bottom: number) => void,
) {
  return () => {
    panel?.measureInWindow((_x, y, _width, height) => {
      setBottom(y + height)
    })
  }
}

function minHeightOf(minHeight: number): ViewStyle {
  return { minHeight }
}

// The docked view's results: at least the page's 240dp, and short enough
// that the view stays within two thirds of the window.
function resultsOf(windowHeight: number, header: number): ViewStyle {
  return {
    maxHeight: (windowHeight * 2) / 3 - header - 1,
    minHeight: MIN_RESULTS,
  }
}

/**
 * The view a search opens into: full screen in a compact window, docked
 * under what opened it in a wider one. Pass `isOpen` with `onOpenChange` to
 * hold the open state, or `defaultOpen` to let it keep its own.
 *
 * ```tsx
 * <SearchView>
 *   <IconButton aria-label="Search">
 *     <SearchIcon />
 *   </IconButton>
 *   <SearchView.Content label="Search" placeholder="Search">
 *     <ListBox aria-label="Results">…</ListBox>
 *   </SearchView.Content>
 * </SearchView>
 * ```
 *
 * Composed as Popover is: a `Button` or `IconButton` placed directly inside
 * `SearchView` opens the view, and `SearchView.Content` is the view itself.
 */
function SearchView({
  children,
  defaultOpen,
  isOpen,
  onOpenChange,
}: SearchViewProps) {
  const state = useOverlayTriggerState({ defaultOpen, isOpen, onOpenChange })
  const anchor = useRef<HostInstance>(null)
  const slots = useMemo<ButtonSlots>(
    () => ({
      default: () => {
        state.open()
      },
      trigger: { expanded: state.isOpen, ref: anchor },
    }),
    [state],
  )
  const root = useMemo<SearchViewRoot>(() => ({ anchor, state }), [state])

  return (
    <SearchViewContext value={root}>
      <ButtonSlotContext value={slots}>{children}</ButtonSlotContext>
    </SearchViewContext>
  )
}

/**
 * The view: the header with its back button, input and clear button, and
 * the results under it, inside an Autocomplete, so typing narrows them. What
 * has been typed is the autocomplete's: pass `inputValue` with
 * `onInputChange` to control it, or `defaultInputValue` to let it keep its
 * own, which starts again each time the view opens.
 *
 * `style`, `ref` and `testID` land on the view's surface.
 */
function SearchViewContent<T extends object = object>({
  backLabel,
  clearLabel,
  defaultInputValue,
  filter,
  inputValue,
  label,
  onInputChange,
  ...props
}: SearchViewContentProps<T>) {
  const root = use(SearchViewContext)

  if (root === null) {
    throw new Error('SearchView.Content is drawn inside SearchView.')
  }

  const { anchor, state } = root
  const messages = useMessages()
  const docked = useWindowSizeClass() !== 'compact'
  const [present, setPresent] = useState(state.isOpen)
  const [input, setInput] = useState<ComponentRef<typeof TextInput> | null>(
    null,
  )
  const close = useCallback(() => {
    state.close()
  }, [state])
  const slots = useMemo<ButtonSlots>(() => ({ close }), [close])

  // Mounted the moment it opens, and kept until its exit has run.
  if (state.isOpen && !present) {
    setPresent(true)
  }

  useReturnFocus(present, false, anchor)

  if (!present) {
    return null
  }

  return (
    <Autocomplete<T>
      defaultInputValue={defaultInputValue}
      filter={filter}
      inputValue={inputValue}
      onInputChange={onInputChange}
    >
      <ModalWindow
        isKeyboardDismissDisabled={false}
        label={label}
        labelledBy={undefined}
        onClose={close}
        onScrimPress={state.isOpen ? close : undefined}
        scrim={UNSEEN}
        // Full screen it is shown at once, so the screen reader goes to the
        // input as the window shows; docked, once the view has been placed.
        title={docked ? null : input}
      >
        <ButtonSlotContext value={slots}>
          <SearchViewPanel
            {...props}
            anchor={anchor}
            backLabel={backLabel ?? messages.back}
            clearLabel={clearLabel ?? messages.clearSearch}
            close={close}
            docked={docked}
            isOpen={state.isOpen}
            label={label}
            setInput={setInput}
            setPresent={setPresent}
          />
        </ButtonSlotContext>
      </ModalWindow>
    </Autocomplete>
  )
}

// The surface, drawn in the `Modal` so the anchored placement measures the
// layer it is drawn in. Read inside the Autocomplete, whose value the input
// shows and reports each edit to.
function SearchViewPanel({
  anchor,
  backLabel,
  children,
  clearLabel,
  close,
  docked,
  isOpen,
  label,
  placeholder,
  ref,
  setInput,
  setPresent,
  style,
  ...props
}: PanelProps) {
  const theme = useTheme()
  const styles = stylesOf(theme)
  const { colors, sizing, typography } = theme
  const autocomplete = use(AutocompleteContext)
  const window = useWindowDimensions()
  const insets = use(SafeAreaInsetsContext) ?? NO_INSETS
  const keyboardTop = useKeyboardTop()
  const placement = useAnchoredPlacement({ align: 'start', anchor })
  const motion = usePanelMotion(isOpen, !docked || placement.placed, setPresent)
  const [panel, setPanel] = useState<HostInstance | null>(null)
  const [input, setOwnInput] = useState<ComponentRef<typeof TextInput> | null>(
    null,
  )
  const [bottom, setBottom] = useState<null | number>(null)
  const header =
    (docked ? sizing.controlLg : FULL_HEADER) +
    typography.bodyLargeLineHeight * (window.fontScale - 1)
  // Full screen, how far the keyboard reaches up over the view. iOS draws it
  // over the window, where Android's `Modal` shrinks the window to make room
  // and leaves it nothing to cover.
  const covered =
    keyboardTop === null || bottom === null ? 0 : bottom - keyboardTop

  useFocusOnPlaced(docked && placement.placed, input)

  if (autocomplete === null) {
    return null
  }

  return (
    <Animated.View
      {...panelRoleOf('dialog', undefined)}
      aria-label={Platform.OS === 'web' ? undefined : label}
      onAccessibilityEscape={close}
      {...props}
      onLayout={docked ? placement.onLayout : measureBottomOf(panel, setBottom)}
      ref={refsOf(setPanel, ref)}
      style={composeStyles<AnimatedStyle<ViewStyle>>(
        styles.surface,
        docked ? styles.docked : styles.full,
        docked ? dockedOf(placement) : fullOf(insets, covered),
        motion,
        style,
      )}
    >
      <View
        style={composeStyles<ViewStyle>(styles.header, minHeightOf(header))}
      >
        <IconButton aria-label={backLabel} slot="close" style={styles.back}>
          <ArrowBackGlyph color={colors.onSurface} />
        </IconButton>
        <FieldInput
          aria-label={label}
          // A search view opens to be typed into, so the input takes the
          // keyboard as it shows rather than leaving it to the back button.
          autoFocus
          onChangeText={autocomplete.setInputValue}
          placeholder={placeholder}
          ref={refsOf(setOwnInput, setInput)}
          returnKeyType="search"
          role="searchbox"
          value={autocomplete.inputValue}
        />
        {autocomplete.inputValue === '' ? null : (
          <IconButton
            aria-label={clearLabel}
            onPress={clearOf(autocomplete, input)}
            style={styles.clear}
          >
            <CloseGlyph />
          </IconButton>
        )}
      </View>
      <View style={styles.divider} />
      <View
        style={docked ? resultsOf(window.height, header) : styles.resultsFull}
      >
        {children}
      </View>
    </Animated.View>
  )
}

SearchView.Content = SearchViewContent

export { SearchView, SearchViewContent }
export type { SearchViewContentProps, SearchViewProps }
