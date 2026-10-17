import type { ComponentRef, ReactElement, ReactNode, Ref } from 'react'
import type { StyleProp, TextStyle, ViewProps, ViewStyle } from 'react-native'
import type { Key } from 'react-stately'

import { Children, createContext, Fragment, isValidElement, use } from 'react'
import { Text as NativeText, Platform, StyleSheet, View } from 'react-native'

import { ChevronEndGlyph } from '../../glyphs'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'
import { Link } from '../link'

// kanso-ui's Breadcrumbs: a trail of links back up a hierarchy, ending at the
// screen you are on. Material Design has no breadcrumbs page, so web's
// reading stands, taken from the two nearest pages: the row takes the top app
// bar's muted content role, on-surface variant, and each link the text
// button's label large type.
//
// Three things are this component's own, as they are web's.
//
// **The current item is text, not a link.** It is the last item, drawn in
// the full-strength on-surface role, so the screen you are on is the most
// legible thing in the row rather than a faded disabled link. Native has no
// counterpart to web's `aria-current`, so there it is told apart by being the
// one item that leads nowhere; on the web it carries `aria-current="page"`,
// as web's does.
//
// **The chevron belongs to the item before it.** Each item that is not the
// current one draws one after its link, which puts a separator between every
// pair and none at the end. It says "further in" rather than "to the right",
// so it mirrors under a right-to-left layout, and a screen reader skips it.
//
// **A link is drawn as a link in a place already understood to be links.**
// Each is the library's Link with `tone="inherit"`, taking the row's muted
// colour, and `underline="hover"`, leaving the rule for a pointer. A press
// goes through the `RouterProvider` around the trail, as any Link's does.
//
// The trail is one group named by its `aria-label`, and it wraps onto further
// lines rather than running off the edge.

type BreadcrumbsItemProps = Omit<ViewProps, 'children' | 'id' | 'style'> & {
  /** The item's label. */
  readonly children?: ReactNode
  /**
   * Where the item leads. Leave it out on an item the screen handles through
   * the trail's `onAction`, and on the current one, which is never a link.
   */
  readonly href?: string
  /** What the trail's `onAction` is handed when the item is pressed. */
  readonly id?: Key
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
}

type BreadcrumbsProps = Omit<ViewProps, 'children' | 'style'> & {
  /** The trail, as `Breadcrumbs.Item` entries. */
  readonly children?: ReactNode
  /**
   * Disables every link in the trail.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * Called with an item's `id` when its link is pressed, for a screen that
   * navigates without an `href`.
   */
  readonly onAction?: (key: Key) => void
  readonly ref?: Ref<ComponentRef<typeof View>>
  readonly style?: StyleProp<ViewStyle>
}

/** Where an item stands in its trail, which the trail tells each one. */
type ItemPosition = {
  readonly isCurrent: boolean
  readonly isDisabled: boolean
  readonly onAction: ((key: Key) => void) | undefined
}

// An item outside a trail is a link like any other.
const ItemContext = createContext<ItemPosition>({
  isCurrent: false,
  isDisabled: false,
  onAction: undefined,
})

// What marks the current item on the web, where a screen reader reads it.
const CURRENT_PAGE = { 'aria-current': 'page' } as const

// 18dp, a step under the 20dp the menus page gives the same glyph, as web's
// is: a separator inside a row of label large links sits heavier than the
// words either side of it at 20.
const CHEVRON_SIZE = 18

const stylesOf = themedStyles(({ colors, spacing }) =>
  StyleSheet.create({
    chevron: {
      flexShrink: 0,
    },
    // The item you are on: the links' type in the full-strength content role,
    // so it reads as the end of the trail.
    current: {
      color: colors.onSurface,
    },
    // An item's label and chevron. It shrinks to the row's width when its
    // label alone is wider, so the label wraps inside it.
    item: {
      alignItems: 'center',
      columnGap: spacing.xs,
      flexDirection: 'row',
      flexShrink: 1,
    },
    label: {
      color: colors.onSurfaceVariant,
      flexShrink: 1,
    },
    root: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
  }),
)

// What a press on an item's link reports, when the item has an `id` and the
// trail listens. A disabled trail hands its links nothing to call.
function actionOf(id: Key | undefined, onAction: ItemPosition['onAction']) {
  return id === undefined || onAction === undefined
    ? undefined
    : () => {
        onAction(id)
      }
}

/**
 * A trail of links back up a hierarchy, ending at the screen you are on. The
 * last item is the current one and is drawn as text; everything before it is
 * a link.
 *
 * ```tsx
 * <Breadcrumbs aria-label="Label">
 *   <Breadcrumbs.Item href="/first">First item</Breadcrumbs.Item>
 *   <Breadcrumbs.Item href="/second">Second item</Breadcrumbs.Item>
 *   <Breadcrumbs.Item>Third item</Breadcrumbs.Item>
 * </Breadcrumbs>
 * ```
 *
 * Name it with `aria-label`. A screen that navigates without an `href` gives
 * each item an `id` and the trail an `onAction`, which is handed the `id` of
 * the item pressed. The items may come as one fragment. `style`, `ref` and
 * `testID` land on the row, which is the element a layout positions.
 */
function Breadcrumbs({
  children,
  isDisabled = false,
  onAction,
  style,
  ...props
}: BreadcrumbsProps) {
  const theme = useTheme()
  const items = positionsOf(itemsOf(children), isDisabled, onAction)

  return (
    <View
      {...props}
      role="group"
      style={composeStyles<ViewStyle>(stylesOf(theme).root, style)}
    >
      {items.map(({ element, key, position }) => (
        <ItemContext key={key} value={position}>
          {element}
        </ItemContext>
      ))}
    </View>
  )
}

/**
 * One entry in the trail. Give it an `href` to navigate, or an `id` and let
 * the trail's `onAction` handle it. The last entry is the current screen and
 * is drawn as text rather than a link, whatever it is given. `style`, `ref`
 * and `testID` land on the entry's row, which holds its label and the
 * chevron after it.
 */
function BreadcrumbsItem({
  children,
  href,
  id,
  style,
  ...props
}: BreadcrumbsItemProps) {
  const theme = useTheme()
  const { isCurrent, isDisabled, onAction } = use(ItemContext)
  const labelRole = useTypeRole('labelLarge')

  const own = stylesOf(theme)
  const label = composeStyles<TextStyle>(
    labelRole,
    own.label,
    isCurrent ? own.current : undefined,
  )

  return (
    <View {...props} style={composeStyles<ViewStyle>(own.item, style)}>
      {isCurrent ? (
        <NativeText
          {...(Platform.OS === 'web' ? CURRENT_PAGE : undefined)}
          style={label}
        >
          {children}
        </NativeText>
      ) : (
        <>
          <NativeText style={label}>
            <Link
              href={href}
              isDisabled={isDisabled}
              onPress={actionOf(id, isDisabled ? undefined : onAction)}
              tone="inherit"
              underline="hover"
            >
              {children}
            </Link>
          </NativeText>
          <ChevronEndGlyph
            color={theme.colors.onSurfaceVariant}
            size={CHEVRON_SIZE}
            style={own.chevron}
          />
        </>
      )}
    </View>
  )
}

/**
 * The entries among a trail's children, with any fragment between them
 * opened, so a trail can take its items as one fragment. Each keeps a key
 * made of its own and its fragments', so two fragments' children never share
 * one.
 */
function itemsOf(
  children: ReactNode,
  prefix = '',
): { readonly element: ReactElement; readonly key: string }[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ readonly children?: ReactNode }>(child)) {
      return []
    }
    const key = `${prefix}${String(child.key)}`
    return child.type === Fragment
      ? itemsOf(child.props.children, `${key}/`)
      : [{ element: child, key }]
  })
}

/**
 * Each entry with where it stands: the last is the current one, and the
 * trail's `isDisabled` and `onAction` reach every one.
 */
function positionsOf(
  items: readonly { readonly element: ReactElement; readonly key: string }[],
  isDisabled: boolean,
  onAction: ItemPosition['onAction'],
) {
  return items.map((item, index) => ({
    ...item,
    position: {
      isCurrent: index === items.length - 1,
      isDisabled,
      onAction,
    } satisfies ItemPosition,
  }))
}

Breadcrumbs.Item = BreadcrumbsItem

export { Breadcrumbs, BreadcrumbsItem }
export type { BreadcrumbsItemProps, BreadcrumbsProps }
