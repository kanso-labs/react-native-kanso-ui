import type { ComponentRef, ReactNode } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { TestInstance } from 'test-renderer'

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { I18nManager, Platform, StyleSheet, View } from 'react-native'

import { Breadcrumbs, BreadcrumbsItem } from '.'
import { RouterProvider } from '../../router'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

const { theme } = scopeFor('light', {})
const { colors, spacing, stateLayerOpacity, typography } = theme

// The path ChevronEndGlyph draws, which tells its svg apart from any other.
const CHEVRON = 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z'

const CALL_SITE = { marginTop: 4 }

const OS = Platform.OS

afterEach(() => {
  jest.restoreAllMocks()
  Platform.OS = OS
})

// The one chevron an item draws after its link.
function chevronOf(testID: string) {
  const all = chevrons(item(testID))
  const [chevron] = all
  if (all.length !== 1) {
    throw new TypeError(`expected one chevron in ${testID}`)
  }
  return chevron
}

// The svgs drawing a chevron, hidden ones included, since a screen reader is
// kept from every one of them.
function chevrons(scope?: TestInstance) {
  const svgs = (scope ?? screen.root)?.queryAll(
    (node) =>
      node.type === 'RNSVGSvgView' &&
      node.queryAll(
        (path) => path.type === 'RNSVGPath' && path.props.d === CHEVRON,
      ).length > 0,
  )
  return svgs ?? []
}

function item(testID: string) {
  return screen.getByTestId(testID, { includeHiddenElements: true })
}

// The labels of the links given, in order.
function namesOf(links: readonly TestInstance[]) {
  return links.map((link) => String(link.props.children))
}

function parentOf(node: TestInstance) {
  if (node.parent === null) {
    throw new TypeError('expected a parent')
  }
  return node.parent
}

function Routed({
  children,
  navigate,
}: {
  readonly children: ReactNode
  readonly navigate: (href: string) => void
}) {
  return <RouterProvider navigate={navigate}>{children}</RouterProvider>
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle & ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function textOf(name: string) {
  return screen.getByText(name, { includeHiddenElements: true })
}

/** The three-item trail every case starts from, with an id on each item. */
function Trail({
  isDisabled,
  onAction,
}: {
  readonly isDisabled?: boolean
  readonly onAction?: (key: number | string) => void
}) {
  return (
    <Breadcrumbs aria-label="Label" isDisabled={isDisabled} onAction={onAction}>
      <BreadcrumbsItem href="/first" id="first" testID="first">
        First item
      </BreadcrumbsItem>
      <BreadcrumbsItem href="/second" id="second" testID="second">
        Second item
      </BreadcrumbsItem>
      <BreadcrumbsItem id="third" testID="third">
        Third item
      </BreadcrumbsItem>
    </Breadcrumbs>
  )
}

describe('Breadcrumbs', () => {
  it('passes style, ref and testID through to the row', async () => {
    const ref = createRef<ComponentRef<typeof View>>()

    await render(
      <Breadcrumbs
        aria-label="Label"
        ref={ref}
        style={CALL_SITE}
        testID="trail"
      >
        <BreadcrumbsItem>First item</BreadcrumbsItem>
      </Breadcrumbs>,
    )

    expect(styleOf(screen.getByTestId('trail'))).toMatchObject(CALL_SITE)
    expect(ref.current).not.toBeNull()
  })

  it('passes style, ref and testID through to an item’s row', async () => {
    const ref = createRef<ComponentRef<typeof View>>()

    await render(
      <Breadcrumbs aria-label="Label">
        <BreadcrumbsItem ref={ref} style={CALL_SITE} testID="first">
          First item
        </BreadcrumbsItem>
      </Breadcrumbs>,
    )

    expect(styleOf(item('first'))).toMatchObject(CALL_SITE)
    expect(ref.current).not.toBeNull()
  })

  describe('semantics', () => {
    // The trail is not an accessibility element itself, which would hide its
    // links, so it is not one Testing Library finds by role.
    it('is one group, named by its label', async () => {
      await render(<Trail />)

      expect(parentOf(item('first')).props).toMatchObject({
        'aria-label': 'Label',
        role: 'group',
      })
    })

    it('draws every item before the last as a link', async () => {
      await render(<Trail />)

      expect(namesOf(screen.getAllByRole('link'))).toEqual([
        'First item',
        'Second item',
      ])
    })

    it('draws the last item as text, which leads nowhere', async () => {
      await render(<Trail />)

      expect(screen.queryByRole('link', { name: 'Third item' })).toBeNull()
      expect(textOf('Third item').props.onPress).toBeUndefined()
      expect(textOf('Third item').props).not.toHaveProperty('aria-current')
    })

    it('marks the last item as the page on the web', async () => {
      Platform.OS = 'web'
      await render(<Trail />)

      expect(textOf('Third item').props['aria-current']).toBe('page')
      expect(textOf('Second item').props).not.toHaveProperty('aria-current')
    })

    it('puts a chevron after every item but the last', async () => {
      await render(<Trail />)

      expect(chevrons(item('first'))).toHaveLength(1)
      expect(chevrons(item('second'))).toHaveLength(1)
      expect(chevrons(item('third'))).toHaveLength(0)
    })

    it('keeps every chevron from a screen reader', async () => {
      await render(<Trail />)

      for (const chevron of chevrons()) {
        expect(chevron.props).toMatchObject({
          accessibilityElementsHidden: true,
          importantForAccessibility: 'no-hide-descendants',
        })
      }
      expect(chevrons()).toHaveLength(2)
    })

    it('takes its items as one fragment', async () => {
      await render(
        <Breadcrumbs aria-label="Label">
          <>
            <BreadcrumbsItem href="/first">First item</BreadcrumbsItem>
            <BreadcrumbsItem>Second item</BreadcrumbsItem>
          </>
        </Breadcrumbs>,
      )

      expect(namesOf(screen.getAllByRole('link'))).toEqual(['First item'])
      expect(screen.queryByRole('link', { name: 'Second item' })).toBeNull()
    })

    it('ends at the last item of the last fragment', async () => {
      const error = jest.spyOn(console, 'error')

      await render(
        <Breadcrumbs aria-label="Label">
          <>
            <BreadcrumbsItem href="/first">First item</BreadcrumbsItem>
          </>
          <>
            <BreadcrumbsItem href="/second">Second item</BreadcrumbsItem>
            <BreadcrumbsItem>Third item</BreadcrumbsItem>
          </>
        </Breadcrumbs>,
      )

      expect(screen.getAllByRole('link')).toHaveLength(2)
      expect(screen.queryByRole('link', { name: 'Third item' })).toBeNull()
      expect(error).not.toHaveBeenCalled()
    })
  })

  describe('pressing', () => {
    it('follows an item’s href through the router', async () => {
      const navigate = jest.fn()

      await render(
        <Routed navigate={navigate}>
          <Trail />
        </Routed>,
      )
      await fireEvent.press(screen.getByRole('link', { name: 'Second item' }))

      expect(navigate.mock.calls).toEqual([['/second']])
    })

    it('hands onAction the id of the item pressed', async () => {
      const navigate = jest.fn()
      const onAction = jest.fn()

      await render(
        <Routed navigate={navigate}>
          <Trail onAction={onAction} />
        </Routed>,
      )
      await fireEvent.press(screen.getByRole('link', { name: 'First item' }))

      expect(onAction.mock.calls).toEqual([['first']])
      expect(navigate.mock.calls).toEqual([['/first']])
    })

    it('calls onAction for an item with no href', async () => {
      const onAction = jest.fn()

      await render(
        <Breadcrumbs aria-label="Label" onAction={onAction}>
          <BreadcrumbsItem id={1}>First item</BreadcrumbsItem>
          <BreadcrumbsItem id={2}>Second item</BreadcrumbsItem>
        </Breadcrumbs>,
      )
      await fireEvent.press(screen.getByRole('link', { name: 'First item' }))

      expect(onAction.mock.calls).toEqual([[1]])
    })

    it('reports nothing for an item with no id', async () => {
      const onAction = jest.fn()

      await render(
        <Breadcrumbs aria-label="Label" onAction={onAction}>
          <BreadcrumbsItem>First item</BreadcrumbsItem>
          <BreadcrumbsItem>Second item</BreadcrumbsItem>
        </Breadcrumbs>,
      )

      expect(
        screen.getByRole('link', { name: 'First item' }).props.onPress,
      ).toBeUndefined()
    })

    it('disables every link while the trail is disabled', async () => {
      const navigate = jest.fn()
      const onAction = jest.fn()

      await render(
        <Routed navigate={navigate}>
          <Trail isDisabled onAction={onAction} />
        </Routed>,
      )

      const links = screen.getAllByRole('link')

      expect(links).toHaveLength(2)
      expect(links.map((link) => link.props['aria-disabled'] === true)).toEqual(
        [true, true],
      )
      await fireEvent.press(screen.getByRole('link', { name: 'First item' }))
      await fireEvent.press(screen.getByRole('link', { name: 'Second item' }))
      expect(navigate).not.toHaveBeenCalled()
      expect(onAction).not.toHaveBeenCalled()
    })
  })

  describe('appearance', () => {
    it('lays the items out in a row that wraps', async () => {
      await render(
        <Breadcrumbs aria-label="Label" testID="trail">
          <BreadcrumbsItem>First item</BreadcrumbsItem>
        </Breadcrumbs>,
      )

      expect(styleOf(screen.getByTestId('trail'))).toMatchObject({
        alignItems: 'center',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
      })
    })

    it('lets an item shrink to the row, so its label wraps inside it', async () => {
      await render(<Trail />)

      expect(styleOf(item('first'))).toMatchObject({
        alignItems: 'center',
        columnGap: spacing.xs,
        flexDirection: 'row',
        flexShrink: 1,
      })
      expect(styleOf(textOf('Third item'))).toMatchObject({ flexShrink: 1 })
    })

    it('sets every item in label large', async () => {
      await render(<Trail />)

      const link = screen.getByRole('link', { name: 'First item' })

      for (const label of [parentOf(link), textOf('Third item')]) {
        expect(styleOf(label)).toMatchObject({
          fontSize: typography.labelLargeSize,
          letterSpacing: typography.labelLargeTracking,
        })
      }
    })

    it('draws the links in the muted role and the current item at full strength', async () => {
      await render(<Trail />)

      const link = screen.getByRole('link', { name: 'First item' })

      expect(styleOf(parentOf(link)).color).toBe(colors.onSurfaceVariant)
      expect(styleOf(link).color).toBeUndefined()
      expect(styleOf(link).textDecorationLine).toBe('none')
      expect(styleOf(textOf('Third item')).color).toBe(colors.onSurface)
    })

    it('draws a disabled link at the disabled opacity', async () => {
      await render(<Trail isDisabled />)

      expect(
        styleOf(screen.getByRole('link', { name: 'First item' })).color,
      ).toBe(withOpacity(colors.onSurface, stateLayerOpacity.disabledContent))
    })

    it('draws the chevron at 18dp in the muted role', async () => {
      await render(<Trail />)

      const chevron = chevronOf('first')

      expect(chevron.props).toMatchObject({
        color: colors.onSurfaceVariant,
        height: 18,
        width: 18,
      })
      expect(styleOf(chevron)).toMatchObject({ flexShrink: 0 })
    })

    it('mirrors the chevron under right-to-left', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await render(<Trail />)

      const chevron = chevronOf('first')

      expect(styleOf(chevron).transform).toEqual([{ scaleX: -1 }])
    })

    it('leaves the chevron as drawn under left-to-right', async () => {
      await render(<Trail />)

      const chevron = chevronOf('first')

      expect(styleOf(chevron).transform).toBeUndefined()
    })
  })
})
