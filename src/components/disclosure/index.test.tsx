import type { ComponentRef, ReactNode } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import type { TestInstance } from 'test-renderer'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { I18nManager, StyleSheet, Text, View } from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { DisclosureProps } from '.'

import { Disclosure, DisclosureHeader, DisclosurePanel } from '.'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'

// What the next section the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

const { theme } = scopeFor('light', {})
const { colors, motion, sizing, spacing, stateLayerOpacity, typography } = theme

const FADED = withOpacity(colors.onSurface, stateLayerOpacity.disabledContent)

// The panel is hidden from screen readers while closed, which a query
// leaves out unless told otherwise.
const HIDDEN = { includeHiddenElements: true }

// A press with no point on the page, on a row that measures nothing, so the
// ripple waits and the press is all a case sees.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

// The height a case's content reports.
const CONTENT = 120

// Hoisted so the slot and the call sites' styles are stable, which is what
// react-perf's no-jsx-as-prop and no-new-object-as-prop are after.
const LEADING = <Text testID="leading">Lead</Text>
const CALL_SITE = { marginTop: 4 }
const PANEL_SITE = { marginTop: 8 }

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// The view the header's chevron turns, around the glyph's svg.
function chevron(): TestInstance {
  const glyph = header()
    .queryAll((each) => each.type.startsWith('RNSVGSvgView'))
    .at(0)
  const turned = glyph?.parent

  if (turned === null || turned === undefined) {
    throw new TypeError('expected the chevron in the header')
  }
  return turned
}

// How far the chevron is turned, in degrees.
function chevronAngle(): number {
  const { transform }: { transform?: unknown } = getAnimatedStyle(chevron())
  const turn: unknown = Array.isArray(transform) ? transform.at(0) : undefined

  if (
    typeof turn !== 'object' ||
    turn === null ||
    !('rotate' in turn) ||
    typeof turn.rotate !== 'string'
  ) {
    throw new TypeError('expected the chevron to be turned')
  }
  return Number.parseFloat(turn.rotate)
}

// The view the panel's content lays out in, inside the clip.
function content(): TestInstance {
  const inner = panel().children.at(0)

  if (inner === undefined || typeof inner === 'string') {
    throw new TypeError('expected the panel to hold a view')
  }
  return inner
}

function header() {
  return screen.getByTestId('header')
}

// The panel's height as its motion has it, or undefined while it takes the
// content's own.
function heightOf(): number | undefined {
  const { height }: { height?: unknown } = getAnimatedStyle(panel())
  return typeof height === 'number' ? height : undefined
}

// Reports the content's height, which is what the panel opens to, and runs
// the frame the panel's style follows it on.
async function laidOut(height = CONTENT) {
  await fireEvent(content(), 'layout', {
    nativeEvent: { layout: { height, width: 360, x: 0, y: 0 } },
  })
  await advance(0)
}

function panel() {
  return screen.getByTestId('panel', HIDDEN)
}

async function press() {
  await fireEvent(header(), 'pressIn', PRESS)
  await fireEvent.press(header())
  await fireEvent(header(), 'pressOut', PRESS)
}

async function renderDisclosure(
  props: Omit<DisclosureProps, 'children'> = {},
  panelChildren: ReactNode = <Text>Supporting line</Text>,
) {
  await render(
    <Disclosure {...props}>
      <Disclosure.Header testID="header">Headline</Disclosure.Header>
      <Disclosure.Panel testID="panel">{panelChildren}</Disclosure.Panel>
    </Disclosure>,
  )
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function textStyleOf(element: {
  props: { style?: StyleProp<TextStyle> }
}): TextStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

beforeEach(() => {
  jest.useFakeTimers()
  mockReducedMotion = false
})

afterEach(() => {
  jest.useRealTimers()
})

describe('Disclosure', () => {
  describe('its state', () => {
    it('starts closed', async () => {
      await renderDisclosure()

      expect(header()).toBeCollapsed()
      expect(panel().props['aria-hidden']).toBe(true)
      expect(styleOf(content()).display).toBe('none')
    })

    it('starts open with defaultExpanded', async () => {
      await renderDisclosure({ defaultExpanded: true })

      expect(header()).toBeExpanded()
      expect(panel().props['aria-hidden']).toBe(false)
      expect(styleOf(content()).display).toBeUndefined()
    })

    it('opens and closes on a press of the header', async () => {
      const onExpandedChange = jest.fn()
      await renderDisclosure({ onExpandedChange })

      await press()

      expect(header()).toBeExpanded()

      await press()

      expect(header()).toBeCollapsed()
      expect(onExpandedChange.mock.calls).toEqual([[true], [false]])
    })

    it('follows isExpanded when the call site holds the state', async () => {
      const onExpandedChange = jest.fn()
      await renderDisclosure({ isExpanded: false, onExpandedChange })

      await press()

      expect(onExpandedChange.mock.calls).toEqual([[true]])
      expect(header()).toBeCollapsed()

      await screen.rerender(
        <Disclosure isExpanded onExpandedChange={onExpandedChange}>
          <Disclosure.Header testID="header">Headline</Disclosure.Header>
          <Disclosure.Panel testID="panel">
            <Text>Supporting line</Text>
          </Disclosure.Panel>
        </Disclosure>,
      )

      expect(header()).toBeExpanded()
      expect(panel().props['aria-hidden']).toBe(false)
    })

    it('keeps the content of a closed panel, so what it holds survives', async () => {
      await renderDisclosure({}, <Text testID="kept">Supporting line</Text>)

      expect(screen.getByTestId('kept', HIDDEN)).toBeTruthy()
    })

    it.each([
      [
        'Disclosure.Header',
        <DisclosureHeader key="part">Headline</DisclosureHeader>,
      ],
      [
        'Disclosure.Panel',
        <DisclosurePanel key="part">Supporting line</DisclosurePanel>,
      ],
    ])('says %s is drawn inside Disclosure', async (part, element) => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {
        // React reports the throw as well; the assertion is on the throw.
      })
      try {
        await expect(render(element)).rejects.toThrow(
          `${part} is drawn inside Disclosure.`,
        )
      } finally {
        error.mockRestore()
      }
    })
  })

  describe('the header', () => {
    it('is a button', async () => {
      await renderDisclosure()

      expect(screen.getByRole('button', { name: 'Headline' })).toBe(header())
    })

    it('is the one-line list row, 56dp, with a headline alone', async () => {
      await renderDisclosure()

      expect(styleOf(header())).toMatchObject({
        alignItems: 'center',
        gap: spacing.lg,
        minHeight: sizing.rowSm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
      })
    })

    it('is the two-line list row, 72dp, with a supporting line in body medium', async () => {
      await render(
        <Disclosure>
          <Disclosure.Header supporting="Supporting line" testID="header">
            Headline
          </Disclosure.Header>
        </Disclosure>,
      )

      expect(styleOf(header()).minHeight).toBe(sizing.rowMd)
      expect(textStyleOf(screen.getByText('Supporting line'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.bodyMediumSize,
      })
    })

    it('sets its headline in body large on surface', async () => {
      await renderDisclosure()

      expect(textStyleOf(screen.getByText('Headline'))).toMatchObject({
        color: colors.onSurface,
        fontSize: typography.bodyLargeSize,
      })
    })

    it('draws content before the headline', async () => {
      await render(
        <Disclosure>
          <Disclosure.Header leading={LEADING} testID="header">
            Headline
          </Disclosure.Header>
        </Disclosure>,
      )

      expect(screen.getByTestId('leading')).toBeTruthy()
    })

    it('names the panel', async () => {
      await renderDisclosure()

      expect(panel().props['aria-labelledby']).toBe(header().props.id)
      expect(header().props.id).toEqual(expect.any(String))
    })
  })

  describe('disabled', () => {
    it('takes no press and stays as it is', async () => {
      const onExpandedChange = jest.fn()
      await renderDisclosure({ isDisabled: true, onExpandedChange })

      await press()

      expect(header()).toBeDisabled()
      expect(header()).toBeCollapsed()
      expect(onExpandedChange).not.toHaveBeenCalled()
    })

    it('fades its headline', async () => {
      await renderDisclosure({ isDisabled: true })

      expect(textStyleOf(screen.getByText('Headline')).color).toBe(FADED)
    })

    it('keeps an open section open', async () => {
      await renderDisclosure({ defaultExpanded: true, isDisabled: true })

      await press()

      expect(header()).toBeExpanded()
    })
  })

  describe('the chevron', () => {
    it('is 24dp, in the row content colour', async () => {
      await renderDisclosure()
      const glyph = chevron().children[0]

      expect(glyph).toMatchObject({
        props: { color: colors.onSurface, height: 24, width: 24 },
      })
    })

    it('starts turned a quarter when the section starts open', async () => {
      await renderDisclosure({ defaultExpanded: true })

      expect(chevronAngle()).toBe(90)
    })

    it('turns a quarter over short3 as the section opens, and back as it closes', async () => {
      await renderDisclosure()

      expect(chevronAngle()).toBe(0)

      await press()
      await advance(motion.durationShort3 / 2)

      expect(chevronAngle()).toBeGreaterThan(0)
      expect(chevronAngle()).toBeLessThan(90)

      await advance(motion.durationShort3 / 2)

      expect(chevronAngle()).toBe(90)

      await press()
      await advance(motion.durationShort3)

      expect(chevronAngle()).toBe(0)
    })

    it('turns at once under reduced motion', async () => {
      mockReducedMotion = true
      await renderDisclosure()

      await press()
      await advance(0)

      expect(chevronAngle()).toBe(90)
    })

    it('mirrors under right-to-left, and turns the other way to point down', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      await renderDisclosure({ defaultExpanded: true })
      const glyph = chevron().children[0]

      expect(chevronAngle()).toBe(-90)
      expect(
        typeof glyph === 'string' ? undefined : styleOf(glyph).transform,
      ).toEqual([{ scaleX: -1 }])
    })
  })

  describe('the panel', () => {
    it('holds its content 16dp in, lined up with the headline', async () => {
      await renderDisclosure({ defaultExpanded: true })

      expect(styleOf(content())).toMatchObject({
        paddingBottom: spacing.lg,
        paddingHorizontal: spacing.lg,
      })
      expect(styleOf(panel()).overflow).toBe('hidden')
    })

    it("takes its content's own height when it starts open, before it is measured", async () => {
      await renderDisclosure({ defaultExpanded: true })

      expect(heightOf()).toBeUndefined()

      await laidOut()

      expect(heightOf()).toBe(CONTENT)
    })

    it('keeps nothing a closed panel reports, and opens to the height it last measured', async () => {
      await renderDisclosure({ defaultExpanded: true })
      await laidOut()
      await press()
      await advance(motion.durationMedium2)

      expect(heightOf()).toBe(0)

      await laidOut(0)
      await press()
      await advance(motion.durationMedium2)

      expect(heightOf()).toBe(CONTENT)
    })

    it('measures its content however it starts, as React Native Web needs', async () => {
      await renderDisclosure()

      expect(content().props.onLayout).toEqual(expect.any(Function))
    })

    it('opens to the height its content reports over medium2', async () => {
      await renderDisclosure()

      await press()
      await laidOut()

      expect(heightOf()).toBe(0)
      expect(styleOf(content()).display).toBeUndefined()

      await advance((motion.durationMedium2 * 3) / 4)

      expect(heightOf()).toBeGreaterThan(0)
      expect(heightOf()).toBeLessThan(CONTENT)

      await advance(motion.durationMedium2 / 4)

      expect(heightOf()).toBe(CONTENT)
    })

    it('closes back to nothing over medium2, and lays its content out no longer', async () => {
      await renderDisclosure({ defaultExpanded: true })
      await laidOut()

      await press()

      expect(panel().props['aria-hidden']).toBe(true)
      expect(styleOf(content()).display).toBeUndefined()

      await advance((motion.durationMedium2 * 3) / 4)

      expect(heightOf()).toBeGreaterThan(0)
      expect(heightOf()).toBeLessThan(CONTENT)
      expect(styleOf(content()).display).toBeUndefined()

      await advance(motion.durationMedium2 / 4)

      expect(heightOf()).toBe(0)
      expect(styleOf(content()).display).toBe('none')
    })

    it('follows a change in its content while open', async () => {
      await renderDisclosure({ defaultExpanded: true })
      await laidOut()

      await laidOut(CONTENT * 2)

      expect(heightOf()).toBe(CONTENT * 2)
    })

    it('stays laid out when it opens again before its close has run', async () => {
      await renderDisclosure({ defaultExpanded: true })
      await laidOut()

      await press()
      await advance(motion.durationMedium2 / 2)
      await press()
      await advance(motion.durationMedium2)

      expect(styleOf(content()).display).toBeUndefined()
      expect(heightOf()).toBe(CONTENT)
    })

    it('opens and closes at once under reduced motion', async () => {
      mockReducedMotion = true
      await renderDisclosure()

      await press()
      await laidOut()

      expect(heightOf()).toBe(CONTENT)

      await press()
      await advance(0)

      expect(heightOf()).toBe(0)
      expect(styleOf(content()).display).toBe('none')
    })

    it('is a group unless told to be a region', async () => {
      await renderDisclosure()

      expect(panel().props.role).toBe('group')

      await render(
        <Disclosure>
          <Disclosure.Panel role="region" testID="region">
            <Text>Supporting line</Text>
          </Disclosure.Panel>
        </Disclosure>,
      )

      expect(screen.getByTestId('region', HIDDEN).props.role).toBe('region')
    })
  })

  describe('the call site', () => {
    it("lands style, ref, testID and id on the section's own view", async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await render(
        <Disclosure id="section" ref={ref} style={CALL_SITE} testID="section">
          <Disclosure.Header>Headline</Disclosure.Header>
        </Disclosure>,
      )
      const section = screen.getByTestId('section')

      expect(styleOf(section).marginTop).toBe(4)
      expect(section.props.id).toBe('section')
      expect(ref.current).not.toBeNull()
    })

    it("lands style and ref on the header's and the panel's own views", async () => {
      const headerRef = createRef<ComponentRef<typeof View>>()
      const panelRef = createRef<ComponentRef<typeof View>>()
      await render(
        <Disclosure defaultExpanded>
          <Disclosure.Header ref={headerRef} style={CALL_SITE} testID="header">
            Headline
          </Disclosure.Header>
          <Disclosure.Panel ref={panelRef} style={PANEL_SITE} testID="panel">
            <Text>Supporting line</Text>
          </Disclosure.Panel>
        </Disclosure>,
      )

      expect(styleOf(header()).marginTop).toBe(4)
      expect(styleOf(panel()).marginTop).toBe(PANEL_SITE.marginTop)
      expect(headerRef.current).not.toBeNull()
      expect(panelRef.current).not.toBeNull()
    })
  })
})
