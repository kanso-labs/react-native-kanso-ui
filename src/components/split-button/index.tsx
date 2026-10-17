import type { ComponentRef, ReactNode, Ref } from 'react'
import type { StyleProp, ViewProps, ViewStyle } from 'react-native'
import type { Key } from 'react-stately'

import { createContext, use, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import type { ControlSize } from '../../button'
import type { ButtonGroupItem, GroupButtonState } from '../../button/group'
import type { ResolvedTheme } from '../../theme/scope'
import type { ButtonProps } from '../button'

import { HEIGHTS } from '../../button'
import { ButtonGroupItemContext } from '../../button/group'
import { ChevronDownGlyph } from '../../glyphs'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { Button } from '../button'
import { Menu } from '../menu'

// The split button page's split button, as kanso-ui's SplitButton draws it:
// an action and the menu of alternatives beside it, drawn as two Buttons 2dp
// apart, which the page calls a special connected button group. The outer
// ends keep the button's round, and the two edges that meet take the inner
// corner the size gives them, 4dp up to the page's M, 8dp at L and 12dp at
// XL, opening out to 8dp, 12dp and 20dp while either half is hovered, shows
// its focus ring or is pressed. The corners ease as a button's own do, and
// follow the layout's direction. The values are the page's size token sets,
// read from Material Design's own split button tokens; the 20dp corner, and
// the paddings that are not steps of the spacing scale, are written out.
//
// **The leading half is a Button**, with an icon, a label or both, and the
// page's own padding either side of what it holds: 12dp and 10dp at XS, for
// instance, where a lone Button takes 16dp on both.
//
// **The trailing half is the menu's trigger**: a Button holding the down
// chevron at the size's icon size, 22dp up to 50dp, with the menu below its
// end edge. The chevron sits a dp or more toward the start while the menu is
// closed, the page's optical centring, 1dp to 6dp by size, and centres once
// it opens, when the inner corners round off entirely. The page keeps the
// colours as they are while the menu is open and lays the pressed state
// layer over them, which the half draws for as long as the menu shows.
//
// Both halves take the variant the root names, out of Button's four with a
// container: the page gives text no split button. The paddings are the
// page's whatever the variant, as on web, so an outlined pair's rule sits
// inside them.

// Omitted form by form: ButtonProps is a union of the plain, link and toggle
// forms, and an Omit of the whole union keeps only the keys all three share,
// which would let a link's and a toggle's props back together.
type SplitButtonActionProps = ButtonProps extends infer Props
  ? Props extends unknown
    ? Omit<Props, 'shape' | 'size' | 'variant'>
    : never
  : never

type SplitButtonMenuProps = {
  /** What the menu offers, in words: the trailing half is an icon alone. */
  readonly 'aria-label': string
  /** The menu's items, as `Menu.Item`s and the rest of Menu's parts. */
  readonly children: ReactNode
  /**
   * Whether the menu starts open, when it keeps its own state.
   * @default false
   */
  readonly defaultOpen?: boolean
  /** Whether the trailing half can be pressed. */
  readonly isDisabled?: boolean
  /** Whether the menu is open, when the call site holds the state. */
  readonly isOpen?: boolean
  /** Called with an item's `id` when it is chosen. */
  readonly onAction?: (key: Key) => void
  /** Called when the menu opens or closes. */
  readonly onOpenChange?: (isOpen: boolean) => void
}

type SplitButtonProps = Omit<ViewProps, 'children' | 'role' | 'style'> & {
  /** What the pair is, in words, for the group around the two halves. */
  readonly 'aria-label'?: string
  /** The two halves: a `SplitButton.Action`, then a `SplitButton.Menu`. */
  readonly children: ReactNode
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * The size both halves take, as Button's: `xs` to `xxl`.
   * @default 'md'
   */
  readonly size?: ControlSize
  readonly style?: StyleProp<ViewStyle>
  /**
   * The colour style both halves take: Button's four with a container.
   * @default 'filled'
   */
  readonly variant?: SplitButtonVariant
}

type SplitButtonVariant = 'elevated' | 'filled' | 'outlined' | 'tonal'

// The trailing half's padding either side of the chevron, and how far the
// chevron sits toward the start while the menu is closed.
const TRAILING_PADDING = { lg: 15, md: 13, xl: 29, xs: 13, xxl: 43 }
const CLOSED_OFFSET = { lg: 2, md: 1, xl: 3, xs: 1, xxl: 6 }

// The chevron the trailing half holds, at each size's icon size.
const CHEVRONS: Readonly<Record<ControlSize, ReactNode>> = {
  lg: <ChevronDownGlyph size={26} />,
  md: <ChevronDownGlyph size={22} />,
  xl: <ChevronDownGlyph size={38} />,
  xs: <ChevronDownGlyph size={22} />,
  xxl: <ChevronDownGlyph size={50} />,
}

// What the root hands its two halves, as `contextOf` builds it.
const SplitButtonContext = createContext<{
  readonly size: ControlSize
  readonly variant: SplitButtonVariant
}>({ size: 'md', variant: 'filled' })

// A row as wide as its halves, 2dp apart, as web's inline-flex group is.
const groupOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    group: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      flexDirection: 'row',
      gap: spacing.xxs,
    },
  }),
)

// The leading half's padding either side of what it holds.
const leadingPaddingsOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    lg: { paddingEnd: spacing.xl, paddingStart: spacing.xl },
    md: { paddingEnd: spacing.md, paddingStart: spacing.lg },
    xl: { paddingEnd: 48, paddingStart: 48 },
    xs: { paddingEnd: 10, paddingStart: spacing.md },
    xxl: { paddingEnd: 64, paddingStart: 64 },
  }),
)

// The trailing half's padding: centred once the menu is open, and moved
// toward the start by the page's offset while it is closed.
const trailingPaddings = {
  closed: StyleSheet.create(paddingsBy(CLOSED_OFFSET)),
  open: StyleSheet.create(paddingsBy({ lg: 0, md: 0, xl: 0, xs: 0, xxl: 0 })),
}

// The three corners at each size: where the halves meet at rest and while a
// half is active, and the round end, half the button's height. Not the
// pill: a corner larger than half its side scales down every corner beside
// it, so a pill end beside a 4dp inner corner would shrink the inner one.
const cornersOf = themedStyles(({ radii, sizing }: ResolvedTheme) => {
  const round = (size: ControlSize) => sizing[HEIGHTS[size]] / 2

  return {
    active: { lg: radii.md, md: radii.md, xl: 20, xs: radii.sm, xxl: 20 },
    inner: {
      lg: radii.xs,
      md: radii.xs,
      xl: radii.sm,
      xs: radii.xs,
      xxl: radii.md,
    },
    round: {
      lg: round('lg'),
      md: round('md'),
      xl: round('xl'),
      xs: round('xs'),
      xxl: round('xxl'),
    },
  } satisfies Record<string, Readonly<Record<ControlSize, number>>>
})

// The leading half's place in the pair: the round end at the start, and the
// inner corner at the end, opening out while the half is active. Built by a
// call rather than written at the prop, which is what react-perf's
// jsx-no-new-object-as-prop is after; the React Compiler memoises the result
// on its inputs.
function actionItemOf(
  theme: ResolvedTheme,
  size: ControlSize,
): ButtonGroupItem {
  const corners = cornersOf(theme)

  return {
    corners: ({ active }: GroupButtonState) => ({
      end: active ? corners.active[size] : corners.inner[size],
      start: corners.round[size],
    }),
    isDisabled: false,
    keepsTarget: false,
    shift: 0,
    size,
    style: leadingPaddingsOf(theme)[size],
  }
}

// What the menu opening or closing runs: the half's own state, then the call
// site's handler.
function changeThen(
  setOwnOpen: (isOpen: boolean) => void,
  onOpenChange: ((isOpen: boolean) => void) | undefined,
) {
  return (next: boolean) => {
    setOwnOpen(next)
    onOpenChange?.(next)
  }
}

// What the root hands its two halves.
function contextOf(size: ControlSize, variant: SplitButtonVariant) {
  return { size, variant }
}

// The trailing half's place in the pair: the round end at the end, and the
// inner corner at the start, opening out while the half is active and
// rounding off while the menu is open, when the pressed layer is held too.
function menuItemOf(
  theme: ResolvedTheme,
  size: ControlSize,
  open: boolean,
): ButtonGroupItem {
  const corners = cornersOf(theme)

  return {
    corners: ({ active }: GroupButtonState) => ({
      end: corners.round[size],
      start: open
        ? corners.round[size]
        : active
          ? corners.active[size]
          : corners.inner[size],
    }),
    held: open,
    isDisabled: false,
    keepsTarget: false,
    shift: 0,
    size,
    style: trailingPaddings[open ? 'open' : 'closed'][size],
  }
}

// The trailing half's padding at each size, moved toward the start by
// `offset`.
function paddingsBy(offset: Readonly<Record<ControlSize, number>>) {
  const by = (size: ControlSize) => ({
    paddingEnd: TRAILING_PADDING[size] + offset[size],
    paddingStart: TRAILING_PADDING[size] - offset[size],
  })

  return {
    lg: by('lg'),
    md: by('md'),
    xl: by('xl'),
    xs: by('xs'),
    xxl: by('xxl'),
  }
}

/**
 * An action and a menu of alternatives beside it, drawn as one control.
 *
 * ```tsx
 * <SplitButton>
 *   <SplitButton.Action onPress={save}>Label</SplitButton.Action>
 *   <SplitButton.Menu aria-label="More options">
 *     <Menu.Item id="first">First item</Menu.Item>
 *   </SplitButton.Menu>
 * </SplitButton>
 * ```
 *
 * `style`, `ref` and `testID` land on the group around the two halves.
 */
function SplitButton({
  children,
  size = 'md',
  style,
  variant = 'filled',
  ...props
}: SplitButtonProps) {
  const theme = useTheme()
  const context = contextOf(size, variant)

  return (
    <SplitButtonContext value={context}>
      <View
        role="group"
        {...props}
        style={composeStyles<ViewStyle>(groupOf(theme).group, style)}
      >
        {children}
      </View>
    </SplitButtonContext>
  )
}

/**
 * The split button's leading half: a Button, with an icon, a label or both,
 * in the root's size and variant.
 */
function SplitButtonAction(props: SplitButtonActionProps) {
  const theme = useTheme()
  const { size, variant } = use(SplitButtonContext)

  return (
    <ButtonGroupItemContext value={actionItemOf(theme, size)}>
      <Button {...props} variant={variant} />
    </ButtonGroupItemContext>
  )
}

/**
 * The split button's trailing half: the down chevron, which opens the menu
 * of alternatives its children describe, below its end edge.
 */
function SplitButtonMenu({
  'aria-label': label,
  children,
  defaultOpen = false,
  isDisabled,
  isOpen,
  onAction,
  onOpenChange,
}: SplitButtonMenuProps) {
  const theme = useTheme()
  const { size, variant } = use(SplitButtonContext)
  const [ownOpen, setOwnOpen] = useState(defaultOpen)
  const open = isOpen ?? ownOpen

  return (
    <Menu isOpen={open} onOpenChange={changeThen(setOwnOpen, onOpenChange)}>
      <ButtonGroupItemContext value={menuItemOf(theme, size, open)}>
        <Button
          aria-label={label}
          icon={CHEVRONS[size]}
          isDisabled={isDisabled}
          variant={variant}
        />
      </ButtonGroupItemContext>
      <Menu.Content align="end" onAction={onAction}>
        {children}
      </Menu.Content>
    </Menu>
  )
}

SplitButton.Action = SplitButtonAction
SplitButton.Menu = SplitButtonMenu

export { SplitButton, SplitButtonAction, SplitButtonMenu }
export type {
  SplitButtonActionProps,
  SplitButtonMenuProps,
  SplitButtonProps,
  SplitButtonVariant,
}
