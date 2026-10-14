import type { ComponentRef } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'

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
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native'

import type { CopyFieldProps } from '.'

import { CopyField } from '.'
import { scopeFor } from '../../theme/scope'

const mockSetStringAsync = jest.fn<(text: string) => Promise<boolean>>()

// The app has expo-clipboard installed in this file. Without it is
// without-clipboard.test.tsx, since the import is settled once per file.
jest.mock(
  'expo-clipboard',
  () => ({
    setStringAsync: async (text: string) => mockSetStringAsync(text),
  }),
  { virtual: true },
)

// The families the app has registered with expo-font, which a case fills in.
const mockLoaded = new Set<string>()

jest.mock(
  'expo-font',
  () => ({ isLoaded: (family: string) => mockLoaded.has(family) }),
  { virtual: true },
)

const { theme } = scopeFor('light', {})
const { colors, radii, spacing, typography } = theme

const VALUE = 'first.second.third'

const CALL_SITE = { marginTop: 4 }

// How long the button says Copied, as on web.
const DWELL = 2000

type Host = ReturnType<typeof screen.getByTestId>

function button() {
  return screen.getByRole('button')
}

// Presses the button and lets the write land.
async function copy() {
  await fireEvent.press(button())
  await settle()
}

function flatStyleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}) {
  return StyleSheet.flatten([element.props.style])
}

// An element's children that are elements, rather than text.
function hostsOf(element: Host | undefined): Host[] {
  if (element === undefined) {
    return missing('element')
  }
  return element.children.filter((child) => typeof child !== 'string')
}

// The button and the two labels it is as wide as.
function labels() {
  return hostsOf(root())[1] ?? missing('labels')
}

// Under React Native Web, the region the confirmation is said through.
function liveRegion() {
  return hostsOf(root()).find((host) => host.props['aria-live'] === 'polite')
}

function missing(name: string): never {
  throw new Error(`No ${name}`)
}

async function renderField(props: Partial<CopyFieldProps> = {}) {
  await render(<CopyField testID="field" value={VALUE} {...props} />)
  await settle()
}

// What holds the two labels for their width.
function reserve() {
  return hostsOf(labels())[1] ?? missing('reserve')
}

function root() {
  return screen.getByTestId('field')
}

// Lets the promises the copy runs through settle, and React render what they
// set, without moving the clock: the clock is faked and the next turn of the
// event loop is not.
async function settle() {
  await act(async () => {
    await new Promise((resolve) => {
      setImmediate(resolve)
    })
  })
}

function valueText() {
  return screen.getByText(VALUE)
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['setImmediate'] })
  mockSetStringAsync.mockResolvedValue(true)
})

// The preset already mocks `AccessibilityInfo`, and a spy on a mock is that
// same mock, so its calls outlive a restore and are cleared as well.
afterEach(() => {
  mockLoaded.clear()
  jest.useRealTimers()
  jest.restoreAllMocks()
  jest.clearAllMocks()
  mockSetStringAsync.mockReset()
})

describe('CopyField', () => {
  describe('structure', () => {
    it('shows the value it would copy', async () => {
      await renderField()

      expect(valueText()).toBeTruthy()
    })

    it('offers the copy at rest', async () => {
      await renderField()

      expect(screen.getByRole('button', { name: 'Copy' })).toBe(button())
    })

    it('takes its labels from the call site', async () => {
      await renderField({ copiedLabel: 'Taken', copyLabel: 'Take' })

      expect(screen.getByRole('button', { name: 'Take' })).toBe(button())

      await copy()

      expect(screen.getByRole('button', { name: 'Taken' })).toBe(button())
    })

    it('draws the outlined box around the value and the button', async () => {
      await renderField()

      expect(flatStyleOf(root())).toEqual({
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.outline,
        borderRadius: radii.sm,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      })
    })

    it('hands style, ref and testID to the box', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await renderField({ ref, style: CALL_SITE })

      expect(flatStyleOf(root())).toMatchObject(CALL_SITE)
      expect(ref.current).not.toBeNull()
    })

    it('lets the call site set what the box sets', async () => {
      await renderField({ style: { borderRadius: 0 } })

      expect(flatStyleOf(root())).toMatchObject({ borderRadius: 0 })
    })
  })

  describe('the value', () => {
    it('is the body small role, in on surface', async () => {
      await renderField()

      expect(flatStyleOf(valueText())).toMatchObject({
        color: colors.onSurface,
        fontSize: typography.bodySmallSize,
        fontWeight: typography.bodySmallWeight,
        letterSpacing: typography.bodySmallTracking,
        lineHeight: typography.bodySmallLineHeight,
      })
    })

    it('is drawn in the mono face once the app has registered it', async () => {
      const [mono = missing('mono family')] = typography.fontFamilyMono
      mockLoaded.add(mono)
      await renderField()

      expect(flatStyleOf(valueText())).toMatchObject({ fontFamily: mono })
    })

    it('draws each character it copies, with ligatures off', async () => {
      await renderField()

      expect(flatStyleOf(valueText())).toMatchObject({
        fontVariant: [
          'no-common-ligatures',
          'no-contextual',
          'no-discretionary-ligatures',
          'no-historical-ligatures',
        ],
      })
    })

    it('reads left to right whatever the layout', async () => {
      await renderField()

      expect(flatStyleOf(valueText())).toMatchObject({
        writingDirection: 'ltr',
      })
    })

    // React Native reads `userSelect` as `selectable` on iOS and Android, so
    // a long press offers the platform's copy, and React Native Web hands it
    // to CSS, where one press selects the whole value.
    it('can be selected whole, for a copy by hand', async () => {
      await renderField()

      expect(flatStyleOf(valueText())).toMatchObject({ userSelect: 'all' })
    })

    it('shows white space as it is copied', async () => {
      const value = 'npm install \\\n  --save-dev    first-package'
      await renderField({ value })

      expect(
        screen.getByText(value, { normalizer: (text) => text }),
      ).toBeTruthy()
    })

    it('takes the room the button leaves, and keeps to its start', async () => {
      await renderField()

      const column = hostsOf(root())[0] ?? missing('value column')

      expect(flatStyleOf(column)).toEqual({
        alignItems: 'flex-start',
        flex: 1,
        minWidth: 0,
      })
      expect(hostsOf(column)).toEqual([valueText()])
    })
  })

  describe('copying', () => {
    it('writes the value to the clipboard', async () => {
      await renderField()

      await copy()

      expect(mockSetStringAsync.mock.calls).toEqual([[VALUE]])
    })

    it('confirms on the button once the write lands, not before', async () => {
      const writes: ((copied: boolean) => void)[] = []
      mockSetStringAsync.mockImplementation(
        async () =>
          new Promise((resolve) => {
            writes.push(resolve)
          }),
      )
      await renderField()

      await copy()

      expect(screen.getByRole('button', { name: 'Copy' })).toBe(button())

      writes.at(0)?.(true)
      await settle()

      expect(screen.getByRole('button', { name: 'Copied' })).toBe(button())
    })

    it('reports the value to the call site', async () => {
      const onCopied = jest.fn<(value: string) => void>()
      await renderField({ onCopied })

      await copy()

      expect(onCopied.mock.calls).toEqual([[VALUE]])
    })

    it('reports nothing as failed when the write lands', async () => {
      const onCopyFailed = jest.fn<(error: unknown) => void>()
      await renderField({ onCopyFailed })

      await copy()

      expect(onCopyFailed).not.toHaveBeenCalled()
    })
  })

  describe('the dwell', () => {
    it('returns to offering the copy after the dwell', async () => {
      await renderField()
      await copy()

      await act(() => {
        jest.advanceTimersByTime(DWELL - 1)
      })

      expect(screen.getByRole('button', { name: 'Copied' })).toBe(button())

      await act(() => {
        jest.advanceTimersByTime(1)
      })

      expect(screen.getByRole('button', { name: 'Copy' })).toBe(button())
    })

    it('restarts the dwell when copied again', async () => {
      await renderField()
      await copy()
      await act(() => {
        jest.advanceTimersByTime(DWELL - 500)
      })

      await copy()
      await act(() => {
        jest.advanceTimersByTime(DWELL - 1)
      })

      expect(screen.getByRole('button', { name: 'Copied' })).toBe(button())
    })

    it('stops confirming once the value is no longer what was copied', async () => {
      await renderField()
      await copy()

      await screen.rerender(<CopyField testID="field" value="fourth" />)

      expect(screen.getByRole('button', { name: 'Copy' })).toBe(button())
    })

    it('leaves no timer behind when unmounted mid-dwell', async () => {
      const set = jest.spyOn(globalThis, 'setTimeout')
      const clear = jest.spyOn(globalThis, 'clearTimeout')
      await renderField()
      await copy()
      const dwell =
        set.mock.results[
          set.mock.calls.findIndex(([, delay]) => delay === DWELL)
        ]?.value ?? missing('dwell')

      await screen.unmount()

      expect(clear).toHaveBeenCalledWith(dwell)
    })
  })

  describe('a label', () => {
    it('names the field as a group and joins the button name', async () => {
      await renderField({ label: 'Repository URL' })

      expect(root().props).toMatchObject({
        'aria-label': 'Repository URL',
        role: 'group',
      })
      expect(screen.getByRole('button', { name: 'Copy Repository URL' })).toBe(
        button(),
      )
    })

    it('follows the label on show once copied', async () => {
      await renderField({ label: 'Repository URL' })

      await copy()

      expect(
        screen.getByRole('button', { name: 'Copied Repository URL' }),
      ).toBe(button())
    })

    it('leaves the value out of the button name', async () => {
      await renderField({ label: 'Access token' })

      expect(screen.queryByRole('button', { name: /first/u })).toBeNull()
      expect(screen.getByRole('button', { name: 'Copy Access token' })).toBe(
        button(),
      )
    })

    it('leaves a field without one unnamed', async () => {
      await renderField()

      expect(root().props['aria-label']).toBeUndefined()
      expect(root().props.role).toBeUndefined()
      expect(button().props.accessibilityLabel).toBeUndefined()
      expect(screen.getByRole('button', { name: 'Copy' })).toBe(button())
    })
  })

  describe('the confirmation', () => {
    it.each(['ios', 'android'] as const)('is announced on %s', async (os) => {
      jest.replaceProperty(Platform, 'OS', os)
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
      await renderField({ copiedLabel: 'Taken' })

      await copy()

      expect(announce.mock.calls).toEqual([['Taken']])
      expect(liveRegion()).toBeUndefined()
    })

    it('is announced again for a second copy inside the dwell', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
      await renderField()

      await copy()
      await copy()

      expect(announce).toHaveBeenCalledTimes(2)
    })

    it('says nothing at rest', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
      await renderField()

      expect(announce).not.toHaveBeenCalled()
    })

    it('is said through a live region under React Native Web', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
      await renderField()

      expect(liveRegion()?.props['aria-atomic']).toBe(true)
      expect(hostsOf(liveRegion())).toEqual([])

      await copy()

      expect(announce).not.toHaveBeenCalled()
      expect(hostsOf(liveRegion()).map((host) => host.children)).toEqual([
        ['Copied'],
      ])
    })

    it('puts a new node in the live region for a second copy', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await renderField()

      await copy()
      const first = hostsOf(liveRegion())[0]
      await copy()

      expect(hostsOf(liveRegion())).toHaveLength(1)
      expect(hostsOf(liveRegion())[0]).not.toBe(first)
    })

    it('clears the live region after the dwell', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await renderField()
      await copy()

      await act(() => {
        jest.advanceTimersByTime(DWELL)
      })

      expect(hostsOf(liveRegion())).toEqual([])
    })

    it('keeps the live region out of sight', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await renderField()

      expect(flatStyleOf(liveRegion() ?? missing('live region'))).toEqual({
        height: 1,
        opacity: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        position: 'absolute',
        width: 1,
      })
    })

    it('returns to Copy after the dwell when onCopied throws', async () => {
      const thrown = new Error('From the call site')
      await renderField({
        onCopied: () => {
          throw thrown
        },
      })

      await copy()

      expect(screen.getByRole('button', { name: 'Copied' })).toBe(button())
      // Raised on its own, as a press handler's throw is, rather than
      // rejecting a promise nothing awaits.
      expect(() => {
        jest.advanceTimersByTime(0)
      }).toThrow(thrown)

      await act(() => {
        jest.advanceTimersByTime(DWELL)
      })

      expect(screen.getByRole('button', { name: 'Copy' })).toBe(button())
    })
  })

  describe('when the copy fails', () => {
    it('hands the error to the call site', async () => {
      const failure = new Error('Refused')
      mockSetStringAsync.mockRejectedValue(failure)
      const onCopyFailed = jest.fn<(error: unknown) => void>()
      await renderField({ onCopyFailed })

      await copy()

      expect(onCopyFailed.mock.calls).toEqual([[failure]])
    })

    it('reports a write expo-clipboard says did not land', async () => {
      mockSetStringAsync.mockResolvedValue(false)
      const onCopyFailed = jest.fn<(error: unknown) => void>()
      await renderField({ onCopyFailed })

      await copy()

      expect(onCopyFailed.mock.calls).toEqual([
        [new Error('The clipboard refused the write')],
      ])
    })

    it('announces nothing and keeps offering the copy', async () => {
      mockSetStringAsync.mockResolvedValue(false)
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
      const onCopied = jest.fn<(value: string) => void>()
      await renderField({ onCopied })

      await copy()

      expect(announce).not.toHaveBeenCalled()
      expect(onCopied).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Copy' })).toBe(button())
    })

    it('says nothing in the live region under React Native Web', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      mockSetStringAsync.mockResolvedValue(false)
      await renderField()

      await copy()

      expect(hostsOf(liveRegion())).toEqual([])
    })
  })

  describe('the button', () => {
    it('is the extra-small text button', async () => {
      await renderField()

      expect(flatStyleOf(button())).toMatchObject({
        minHeight: theme.sizing.controlXs,
        paddingHorizontal: spacing.md,
      })
      expect(flatStyleOf(screen.getByText('Copy'))).toMatchObject({
        color: colors.primary,
      })
    })

    it('stretches to the width both labels ask for', async () => {
      await renderField({ copiedLabel: 'Taken', copyLabel: 'Take' })

      expect(flatStyleOf(button())).toMatchObject({ alignSelf: 'stretch' })
      expect(hostsOf(reserve()).map((host) => host.children)).toEqual([
        ['Take'],
        ['Taken'],
      ])
      expect(flatStyleOf(reserve())).toEqual({
        alignItems: 'center',
        height: 0,
        overflow: 'hidden',
        paddingHorizontal: spacing.md,
      })
    })

    it('sets the labels it is as wide as in its own type', async () => {
      await renderField()

      for (const label of hostsOf(reserve())) {
        expect(flatStyleOf(label)).toMatchObject({
          fontSize: typography.labelLargeSize,
          lineHeight: typography.labelLargeLineHeight,
        })
      }
    })

    it('keeps those labels from a screen reader', async () => {
      await renderField()

      expect(reserve().props).toMatchObject({
        accessibilityElementsHidden: true,
        'aria-hidden': true,
        importantForAccessibility: 'no-hide-descendants',
      })
      expect(screen.getAllByText('Copy')).toHaveLength(1)
    })
  })
})
