import type { ComponentRef, ReactNode } from 'react'
import type {
  GestureResponderEvent,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
import type { EdgeInsets } from 'react-native-safe-area-context'
import type { TestInstance, TestNode } from 'test-renderer'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native'
import { createRef, useCallback, useEffect, useState } from 'react'
import {
  AccessibilityInfo,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
} from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

import type { DialogContentProps } from '.'

import { Dialog } from '.'
import { CloseGlyph } from '../../glyphs'
import { Overlay } from '../../overlay'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'
import { Button } from '../button'
import { IconButton } from '../icon-button'

// What the next dialog the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

const { theme } = scopeFor('light', {})
const { colors, motion, radii, sizing, spacing, typography } = theme

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

// A phone held upright, below the medium bound, and a tablet, above it.
const COMPACT = 412
const MEDIUM = 800

const INSETS: EdgeInsets = { bottom: 34, left: 12, right: 8, top: 47 }

const NO_GAP = { gap: 0 }

const OFFSET = { marginTop: 4 }

// How long the dialog takes to leave, the longer of the panel's exit and the
// scrim's fade.
const EXIT = Math.max(motion.durationShort2, motion.durationShort3)

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// The padding the body hands its scroll view's content.
function bodyStyle() {
  const body: {
    props: { contentContainerStyle?: StyleProp<ViewStyle> }
  } = screen.getByTestId('body')

  return StyleSheet.flatten([body.props.contentContainerStyle])
}

function child(node: TestNode | undefined): TestInstance {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

// A dialog whose open state the call site holds, opened from elsewhere on
// the screen.
function Held({
  onOpenChange,
}: {
  readonly onOpenChange: (isOpen: boolean) => void
}) {
  const [isOpen, setOpen] = useState(false)
  const open = useCallback(() => {
    setOpen(true)
  }, [])
  const change = useCallback(
    (next: boolean) => {
      onOpenChange(next)
      setOpen(next)
    },
    [onOpenChange],
  )

  return (
    <>
      <Text onPress={open}>Elsewhere</Text>
      <Dialog isOpen={isOpen} onOpenChange={change}>
        <Button>Open</Button>
        <Dialog.Content testID="panel">
          <Dialog.Footer>
            <Button slot="close">Cancel</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </>
  )
}

// The `Modal` the dialog is drawn in, which carries the back gesture and the
// moment the dialog shows.
function modal() {
  return child(screen.getByTestId('panel').parent?.parent ?? undefined)
}

// Counts its mounts, so a case can tell a dialog kept on screen from one
// drawn again.
function Probe({ onMount }: { readonly onMount: () => void }) {
  useEffect(() => {
    onMount()
  }, [onMount])

  return null
}

// A dialog the call site holds open or closed, with a probe in its body.
function probed(isOpen: boolean, onMount: () => void) {
  return (
    <Dialog.Content isOpen={isOpen} testID="panel">
      <Dialog.Body>
        <Probe onMount={onMount} />
      </Dialog.Body>
    </Dialog.Content>
  )
}

// Renders a dialog with a trigger, a header, a body and two actions, the
// shape a call site draws.
async function renderDialog(
  props: Partial<DialogContentProps> = {},
  {
    defaultOpen = false,
    insets,
  }: { defaultOpen?: boolean; insets?: EdgeInsets } = {},
) {
  const dialog = (
    <Dialog defaultOpen={defaultOpen}>
      <Button variant="outlined">Open</Button>
      <Dialog.Content testID="panel" {...props}>
        <Dialog.Header testID="header">
          <Dialog.Title>Headline</Dialog.Title>
          <IconButton aria-label="Close" slot="close">
            <CloseGlyph />
          </IconButton>
        </Dialog.Header>
        <Dialog.Body testID="body">Supporting text</Dialog.Body>
        <Dialog.Footer testID="footer">
          <Button slot="close" variant="text">
            Cancel
          </Button>
          <Button slot="close" variant="text">
            Confirm
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  )

  return render(insets === undefined ? dialog : withInsets(insets, dialog))
}

// The window as the platform reports it when it changes, which is what the
// size class follows.
function resize(width: number) {
  Dimensions.set({ ...INITIAL, window: { ...INITIAL.window, width } })
}

// The scrim, the first thing the `Modal` draws.
function scrim() {
  return child(modal().children[0])
}

// A user whose presses advance the fake clock.
function setUpUser() {
  return userEvent.setup({
    advanceTimers: (delay) => {
      jest.advanceTimersByTime(delay)
    },
  })
}

function styleOf(element: { props: { style?: StyleProp<ViewStyle> } }) {
  return StyleSheet.flatten([element.props.style])
}

function textStyleOf(element: { props: { style?: StyleProp<TextStyle> } }) {
  return StyleSheet.flatten([element.props.style])
}

// A body with actions under it, or without.
function withFooter(footer: boolean) {
  return (
    <Dialog.Content defaultOpen>
      <Dialog.Body testID="body">Supporting text</Dialog.Body>
      {footer ? (
        <Dialog.Footer>
          <Button slot="close">Cancel</Button>
        </Dialog.Footer>
      ) : null}
    </Dialog.Content>
  )
}

function withInsets(insets: EdgeInsets, children: ReactNode) {
  return (
    <SafeAreaInsetsContext value={insets}>{children}</SafeAreaInsetsContext>
  )
}

beforeEach(() => {
  jest.useFakeTimers()
  resize(MEDIUM)
})

afterEach(() => {
  mockReducedMotion = false
  Dimensions.set(INITIAL)
  // The preset's AccessibilityInfo is a mock already, which a spy hands
  // back as it is, so its calls are cleared rather than restored.
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('Dialog', () => {
  describe('semantics', () => {
    it('is a modal dialog named by its title', async () => {
      await renderDialog({}, { defaultOpen: true })

      const panel = screen.getByTestId('panel')
      const title = screen.getByText('Headline')

      expect(panel.props.role).toBe('dialog')
      expect(panel.props['aria-modal']).toBe(true)
      expect(panel.props['aria-labelledby']).toBe(title.props.nativeID)
      expect(title.props.nativeID).toEqual(expect.any(String))
    })

    it('draws its title as a heading', async () => {
      await renderDialog({}, { defaultOpen: true })

      expect(screen.getByRole('heading', { name: 'Headline' })).toBe(
        screen.getByText('Headline'),
      )
    })

    it('is an alert dialog given role="alertdialog"', async () => {
      await renderDialog({ role: 'alertdialog' }, { defaultOpen: true })

      expect(screen.getByTestId('panel').props.role).toBe('alertdialog')
    })

    it('names nothing when it has no title', async () => {
      await render(
        <Dialog.Content defaultOpen testID="panel">
          <Dialog.Body>Supporting text</Dialog.Body>
        </Dialog.Content>,
      )

      expect(screen.getByTestId('panel').props['aria-labelledby']).toBe(
        undefined,
      )
    })

    it('keeps the scrim from screen readers and the keyboard', async () => {
      await renderDialog({}, { defaultOpen: true })

      expect(scrim().props).toMatchObject({
        accessible: false,
        'aria-hidden': true,
        focusable: false,
        tabIndex: -1,
      })
    })

    it("names the Modal on web, and leaves the panel React Native Web's", async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      await renderDialog({}, { defaultOpen: true })

      const panel = screen.getByTestId('panel')

      expect(modal().props['aria-labelledby']).toBe(
        screen.getByText('Headline').props.nativeID,
      )
      expect(panel.props.role).toBe(undefined)
      expect(panel.props['aria-modal']).toBe(undefined)
    })

    it('leaves the Modal unnamed on iOS and Android', async () => {
      await renderDialog({}, { defaultOpen: true })

      expect(modal().props['aria-labelledby']).toBe(undefined)
    })

    it('throws for a part drawn outside Dialog.Content', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(
        render(<Dialog.Title>Headline</Dialog.Title>),
      ).rejects.toThrow('Dialog.Title is drawn inside Dialog.Content.')
    })
  })

  describe('opening and closing', () => {
    it('is closed until its trigger is pressed', async () => {
      const user = setUpUser()
      await renderDialog()

      expect(screen.queryByTestId('panel')).toBe(null)

      await user.press(screen.getByRole('button', { name: 'Open' }))

      expect(screen.getByTestId('panel')).toBeTruthy()
    })

    it('opens from a button anywhere in Dialog outside its content', async () => {
      const user = setUpUser()
      await render(
        <Dialog>
          <Text>Label</Text>
          <IconButton aria-label="Open">
            <CloseGlyph />
          </IconButton>
          <Dialog.Content testID="panel">
            <Dialog.Body>Supporting text</Dialog.Body>
          </Dialog.Content>
        </Dialog>,
      )

      await user.press(screen.getByRole('button', { name: 'Open' }))

      expect(screen.getByTestId('panel')).toBeTruthy()
    })

    it("calls the trigger's own onPress before it opens", async () => {
      const user = setUpUser()
      const seen: boolean[] = []
      const onPress = jest.fn(() => {
        seen.push(screen.queryByTestId('panel') !== null)
      })
      await render(
        <Dialog>
          <Button onPress={onPress}>Open</Button>
          <Dialog.Content testID="panel">
            <Dialog.Body>Supporting text</Dialog.Body>
          </Dialog.Content>
        </Dialog>,
      )

      await user.press(screen.getByRole('button', { name: 'Open' }))

      expect(seen).toEqual([false])
      expect(screen.getByTestId('panel')).toBeTruthy()
    })

    it('closes from a button given slot="close"', async () => {
      const user = setUpUser()
      const onOpenChange = jest.fn()
      await render(
        <Dialog defaultOpen onOpenChange={onOpenChange}>
          <Button>Open</Button>
          <Dialog.Content testID="panel">
            <Dialog.Footer>
              <Button slot="close">Cancel</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>,
      )

      await user.press(screen.getByRole('button', { name: 'Cancel' }))

      expect(onOpenChange).toHaveBeenLastCalledWith(false)
    })

    it('closes from an icon button given slot="close"', async () => {
      const user = setUpUser()
      const onOpenChange = jest.fn()
      await render(
        <Dialog defaultOpen onOpenChange={onOpenChange}>
          <Button>Open</Button>
          <Dialog.Content testID="panel">
            <Dialog.Header>
              <Dialog.Title>Headline</Dialog.Title>
              <IconButton aria-label="Close" slot="close">
                <CloseGlyph />
              </IconButton>
            </Dialog.Header>
          </Dialog.Content>
        </Dialog>,
      )

      await user.press(screen.getByRole('button', { name: 'Close' }))

      expect(onOpenChange).toHaveBeenLastCalledWith(false)
    })

    it("calls a close button's own onPress before it closes", async () => {
      const user = setUpUser()
      const onPress = jest.fn()
      const onOpenChange = jest.fn()
      await render(
        <Dialog defaultOpen onOpenChange={onOpenChange}>
          <Button>Open</Button>
          <Dialog.Content>
            <Dialog.Footer>
              <Button onPress={onPress} slot="close">
                Confirm
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>,
      )

      await user.press(screen.getByRole('button', { name: 'Confirm' }))

      expect(onPress).toHaveBeenCalledTimes(1)
      expect(onPress.mock.invocationCallOrder[0]).toBeLessThan(
        onOpenChange.mock.invocationCallOrder[0],
      )
    })

    it('leaves it open from a button inside its content with no slot', async () => {
      const user = setUpUser()
      const onPress = jest.fn()
      const onOpenChange = jest.fn()
      await render(
        <Dialog defaultOpen onOpenChange={onOpenChange}>
          <Button>Open</Button>
          <Dialog.Content testID="panel">
            <Dialog.Body>
              <Button onPress={onPress}>Label</Button>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog>,
      )

      await user.press(screen.getByRole('button', { name: 'Label' }))

      expect(onPress).toHaveBeenCalledTimes(1)
      expect(onOpenChange).not.toHaveBeenCalled()
      expect(screen.getByTestId('panel')).toBeTruthy()
    })

    it('leaves the trigger alone from a button in an overlay it hosts', async () => {
      const user = setUpUser()
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      const onOpen = jest.fn<(event: GestureResponderEvent) => void>()
      await render(
        <Dialog>
          <Button onPress={onOpen}>Open</Button>
          <Dialog.Content testID="panel">
            <Dialog.Footer>
              <Button slot="close">Cancel</Button>
            </Dialog.Footer>
            <Overlay>
              <Button>Label</Button>
            </Overlay>
          </Dialog.Content>
        </Dialog>,
      )

      await user.press(screen.getByRole('button', { name: 'Open' }))
      await user.press(screen.getByRole('button', { name: 'Label' }))

      expect(screen.getByTestId('panel')).toBeTruthy()

      await user.press(screen.getByRole('button', { name: 'Cancel' }))
      await advance(EXIT)

      expect(send).toHaveBeenCalledTimes(1)
      expect(send.mock.calls[0]?.[0]).toBe(
        onOpen.mock.calls[0]?.[0].currentTarget,
      )
    })

    it('closes from a press on the scrim', async () => {
      await renderDialog({}, { defaultOpen: true })

      await fireEvent.press(scrim())
      await advance(EXIT)

      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it('stays open on a press on the scrim when isDismissable is false', async () => {
      await renderDialog({ isDismissable: false }, { defaultOpen: true })

      await fireEvent.press(scrim())
      await advance(EXIT)

      expect(screen.getByTestId('panel')).toBeTruthy()
    })

    it('closes from the back gesture', async () => {
      await renderDialog({}, { defaultOpen: true })

      await fireEvent(modal(), 'requestClose')
      await advance(EXIT)

      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it('closes from the escape gesture', async () => {
      await renderDialog({}, { defaultOpen: true })

      await fireEvent(screen.getByTestId('panel'), 'accessibilityEscape')
      await advance(EXIT)

      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it('stays open on either gesture given isKeyboardDismissDisabled', async () => {
      await renderDialog(
        { isKeyboardDismissDisabled: true },
        { defaultOpen: true },
      )

      await fireEvent(modal(), 'requestClose')
      await advance(EXIT)

      expect(screen.getByTestId('panel').props.onAccessibilityEscape).toBe(
        undefined,
      )
      // Android warns about a `Modal` with no handler, so it is handed one
      // that does nothing.
      expect(modal().props.onRequestClose).toEqual(expect.any(Function))
    })

    it('keeps isDismissable and isKeyboardDismissDisabled apart', async () => {
      await renderDialog({ isDismissable: false }, { defaultOpen: true })

      await fireEvent(modal(), 'requestClose')
      await advance(EXIT)

      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it('follows isOpen when the call site holds the state', async () => {
      const user = setUpUser()
      const onOpenChange = jest.fn()

      await render(<Held onOpenChange={onOpenChange} />)
      await fireEvent.press(screen.getByText('Elsewhere'))

      expect(screen.getByTestId('panel')).toBeTruthy()

      await user.press(screen.getByRole('button', { name: 'Cancel' }))
      await advance(EXIT)

      expect(onOpenChange).toHaveBeenCalledWith(false)
      expect(screen.queryByTestId('panel')).toBe(null)
    })
  })

  describe('Dialog.Content on its own', () => {
    it('opens and closes on isOpen, reporting through onOpenChange', async () => {
      const onOpenChange = jest.fn()
      const content = (isOpen: boolean) => (
        <Dialog.Content
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          testID="panel"
        >
          <Dialog.Footer>
            <Button slot="close">Cancel</Button>
          </Dialog.Footer>
        </Dialog.Content>
      )
      await render(content(false))

      expect(screen.queryByTestId('panel')).toBe(null)

      await screen.rerender(content(true))
      await fireEvent.press(scrim())

      expect(onOpenChange).toHaveBeenLastCalledWith(false)
      expect(screen.getByTestId('panel')).toBeTruthy()

      await screen.rerender(content(false))
      await advance(EXIT)

      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it('keeps its own state given defaultOpen', async () => {
      const user = setUpUser()
      await render(
        <Dialog.Content defaultOpen testID="panel">
          <Dialog.Footer>
            <Button slot="close">Cancel</Button>
          </Dialog.Footer>
        </Dialog.Content>,
      )

      await user.press(screen.getByRole('button', { name: 'Cancel' }))
      await advance(EXIT)

      expect(screen.queryByTestId('panel')).toBe(null)
    })
  })

  describe('the basic dialog', () => {
    it('is drawn on surface container high with the 28dp corner, 280 to 560dp wide', async () => {
      await renderDialog({}, { defaultOpen: true })

      expect(styleOf(screen.getByTestId('panel'))).toMatchObject({
        backgroundColor: colors.surfaceContainerHigh,
        borderRadius: radii.xl,
        maxWidth: 560,
        minWidth: 280,
        overflow: 'hidden',
      })
    })

    it('is centred over the scrim, 24dp from its edges', async () => {
      await renderDialog({}, { defaultOpen: true })

      expect(
        styleOf(child(screen.getByTestId('panel').parent ?? undefined)),
      ).toMatchObject({
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
      })
    })

    it('draws the scrim in the scrim role at 32%', async () => {
      await renderDialog({}, { defaultOpen: true })

      expect(styleOf(scrim()).backgroundColor).toBe(
        withOpacity(colors.scrim, 0.32),
      )
    })

    it('draws its title in headline small on on-surface', async () => {
      await renderDialog({}, { defaultOpen: true })

      expect(textStyleOf(screen.getByText('Headline'))).toMatchObject({
        color: colors.onSurface,
        fontSize: typography.headlineSmallSize,
      })
    })

    it('pads the header 24dp above and 16dp below, and the actions 24dp', async () => {
      await renderDialog({}, { defaultOpen: true })

      expect(styleOf(screen.getByTestId('header'))).toMatchObject({
        paddingBottom: spacing.lg,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.xl,
      })
      expect(styleOf(screen.getByTestId('footer'))).toMatchObject({
        gap: spacing.sm,
        justifyContent: 'flex-end',
        padding: spacing.xl,
      })
      expect(styleOf(screen.getByTestId('header')).borderBottomWidth).toBe(
        undefined,
      )
      expect(styleOf(screen.getByTestId('footer')).borderTopWidth).toBe(
        undefined,
      )
    })

    it('leaves the safe area to the scrim', async () => {
      await renderDialog({}, { defaultOpen: true, insets: INSETS })

      expect(styleOf(screen.getByTestId('panel')).paddingTop).toBe(undefined)
    })

    it('stays basic below 600dp as an alert dialog', async () => {
      resize(COMPACT)
      await renderDialog({ role: 'alertdialog' }, { defaultOpen: true })

      expect(styleOf(screen.getByTestId('panel'))).toMatchObject({
        borderRadius: radii.xl,
        maxWidth: 560,
      })
      expect(textStyleOf(screen.getByText('Headline')).fontSize).toBe(
        typography.headlineSmallSize,
      )
    })
  })

  describe('the full-screen dialog', () => {
    beforeEach(() => {
      resize(COMPACT)
    })

    it('fills the window with square corners below 600dp', async () => {
      await renderDialog({}, { defaultOpen: true })

      const style = styleOf(screen.getByTestId('panel'))

      expect(style).toMatchObject({
        backgroundColor: colors.surfaceContainerHigh,
        flex: 1,
      })
      expect(style.borderRadius).toBe(undefined)
      expect(style.maxWidth).toBe(undefined)
      expect(style.minWidth).toBe(undefined)
      expect(
        styleOf(child(screen.getByTestId('panel').parent ?? undefined)),
      ).toMatchObject({ alignItems: 'stretch', padding: 0 })
    })

    it('draws its title in title large', async () => {
      await renderDialog({}, { defaultOpen: true })

      expect(textStyleOf(screen.getByText('Headline')).fontSize).toBe(
        typography.titleLargeSize,
      )
    })

    it('draws the header and the actions as 56dp bars with dividers', async () => {
      await renderDialog({}, { defaultOpen: true })

      expect(styleOf(screen.getByTestId('header'))).toMatchObject({
        borderBottomColor: colors.outlineVariant,
        borderBottomWidth: 1,
        minHeight: sizing.rowSm,
      })
      expect(styleOf(screen.getByTestId('footer'))).toMatchObject({
        borderTopColor: colors.outlineVariant,
        borderTopWidth: 1,
        minHeight: sizing.rowSm,
      })
      expect(sizing.rowSm).toBe(56)
    })

    it('keeps its content inside the safe area', async () => {
      await renderDialog({}, { defaultOpen: true, insets: INSETS })

      expect(styleOf(screen.getByTestId('panel'))).toMatchObject({
        paddingBottom: INSETS.bottom,
        paddingLeft: INSETS.left,
        paddingRight: INSETS.right,
        paddingTop: INSETS.top,
      })
    })

    it('turns into the basic dialog as the window widens', async () => {
      await renderDialog({}, { defaultOpen: true })

      await act(() => {
        resize(MEDIUM)
      })

      expect(styleOf(screen.getByTestId('panel')).borderRadius).toBe(radii.xl)
    })
  })

  describe('the body', () => {
    it('draws a string in body medium on on-surface variant', async () => {
      await renderDialog({}, { defaultOpen: true })

      expect(textStyleOf(screen.getByText('Supporting text'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: typography.bodyMediumSize,
      })
    })

    it('draws anything else as it is', async () => {
      await render(
        <Dialog.Content defaultOpen>
          <Dialog.Body testID="body">
            <Text testID="text">Supporting text</Text>
          </Dialog.Body>
        </Dialog.Content>,
      )

      expect(screen.getByTestId('text').props.style).toBe(undefined)
    })

    it('leaves the ends to the header and the actions', async () => {
      await renderDialog({}, { defaultOpen: true })

      expect(bodyStyle()).toMatchObject({
        gap: spacing.lg,
        paddingBottom: 0,
        paddingHorizontal: spacing.xl,
        paddingTop: 0,
      })
    })

    it('pads both ends 24dp on its own', async () => {
      await render(
        <Dialog.Content defaultOpen>
          <Dialog.Body testID="body">Supporting text</Dialog.Body>
        </Dialog.Content>,
      )

      expect(bodyStyle()).toMatchObject({
        paddingBottom: spacing.xl,
        paddingTop: spacing.xl,
      })
    })

    it('keeps 24dp under the header full screen', async () => {
      resize(COMPACT)
      await renderDialog({}, { defaultOpen: true })

      expect(bodyStyle()).toMatchObject({
        paddingBottom: 0,
        paddingTop: spacing.xl,
      })
    })

    it('takes the end back when a part leaves', async () => {
      await render(withFooter(true))
      await screen.rerender(withFooter(false))

      expect(bodyStyle().paddingBottom).toBe(spacing.xl)
    })

    it('takes focus once its content runs past its room', async () => {
      await renderDialog({}, { defaultOpen: true })

      const body = screen.getByTestId('body')

      expect(body.props.focusable).toBe(false)

      await fireEvent(body, 'layout', {
        nativeEvent: { layout: { height: 200, width: 320, x: 0, y: 0 } },
      })
      await fireEvent(body, 'contentSizeChange', 320, 200)

      expect(screen.getByTestId('body').props.focusable).toBe(false)

      await fireEvent(body, 'contentSizeChange', 320, 201)

      expect(screen.getByTestId('body').props.focusable).toBe(true)
    })

    it('hands its measurements on, and takes a focusable of its own', async () => {
      const onContentSizeChange = jest.fn()
      const onLayout = jest.fn()
      const layout = {
        nativeEvent: { layout: { height: 200, width: 320, x: 0, y: 0 } },
      }
      await render(
        <Dialog.Content defaultOpen>
          <Dialog.Body
            focusable={false}
            onContentSizeChange={onContentSizeChange}
            onLayout={onLayout}
            testID="body"
          >
            Supporting text
          </Dialog.Body>
        </Dialog.Content>,
      )

      await fireEvent(screen.getByTestId('body'), 'layout', layout)
      await fireEvent(screen.getByTestId('body'), 'contentSizeChange', 320, 900)

      expect(onLayout).toHaveBeenCalledWith(layout)
      expect(onContentSizeChange).toHaveBeenCalledWith(320, 900)
      expect(screen.getByTestId('body').props.focusable).toBe(false)
    })

    it("takes the call site's contentContainerStyle over its own", async () => {
      await render(
        <Dialog.Content defaultOpen>
          <Dialog.Body contentContainerStyle={NO_GAP} testID="body">
            Supporting text
          </Dialog.Body>
        </Dialog.Content>,
      )

      expect(bodyStyle().gap).toBe(0)
    })
  })

  describe('motion', () => {
    it('scales the panel up from 90% and fades the scrim in', async () => {
      await renderDialog({}, { defaultOpen: true })

      expect(getAnimatedStyle(screen.getByTestId('panel'))).toMatchObject({
        opacity: 0,
        transform: [{ scale: 0.9 }],
      })
      expect(getAnimatedStyle(scrim())).toMatchObject({ opacity: 0 })

      await advance(motion.durationMedium1)

      expect(getAnimatedStyle(screen.getByTestId('panel'))).toMatchObject({
        opacity: 1,
        transform: [{ scale: 1 }],
      })
      expect(getAnimatedStyle(scrim())).toMatchObject({ opacity: 1 })
    })

    it('raises the full-screen panel 3% of the window', async () => {
      resize(COMPACT)
      await renderDialog({}, { defaultOpen: true })

      expect(getAnimatedStyle(screen.getByTestId('panel'))).toMatchObject({
        opacity: 0,
        transform: [{ translateY: 0.03 * INITIAL.window.height }],
      })

      await advance(motion.durationMedium1)

      expect(getAnimatedStyle(screen.getByTestId('panel'))).toMatchObject({
        opacity: 1,
        transform: [{ translateY: 0 }],
      })
    })

    it('stays drawn until its exit has run', async () => {
      await renderDialog({}, { defaultOpen: true })
      await advance(motion.durationMedium1)

      await fireEvent.press(scrim())
      await advance(EXIT - 1)

      expect(screen.getByTestId('panel')).toBeTruthy()

      await advance(1)

      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it('runs the panel out on the short duration', async () => {
      await renderDialog({}, { defaultOpen: true })
      await advance(motion.durationMedium1)

      await fireEvent.press(scrim())
      await advance(motion.durationShort3 - 1)

      expect(
        getAnimatedStyle(screen.getByTestId('panel')).opacity,
      ).toBeGreaterThan(0)
    })

    it('stays open, and mounted, when it is opened again while it leaves', async () => {
      const onMount = jest.fn()

      await render(probed(true, onMount))
      await advance(motion.durationMedium1)
      await screen.rerender(probed(false, onMount))
      await advance(EXIT / 2)
      await screen.rerender(probed(true, onMount))
      await advance(EXIT)

      expect(screen.getByTestId('panel')).toBeTruthy()

      await advance(motion.durationMedium1)

      expect(getAnimatedStyle(screen.getByTestId('panel'))).toMatchObject({
        opacity: 1,
      })
      expect(onMount).toHaveBeenCalledTimes(1)
    })

    describe('under reduced motion', () => {
      beforeEach(() => {
        mockReducedMotion = true
      })

      it('shows the panel at once, and still fades the scrim', async () => {
        await renderDialog({}, { defaultOpen: true })
        await advance(0)

        expect(getAnimatedStyle(screen.getByTestId('panel'))).toMatchObject({
          opacity: 1,
          transform: [{ scale: 1 }],
        })
        expect(getAnimatedStyle(scrim()).opacity).toBe(0)
      })

      it('removes the panel at once, and leaves once the scrim has faded', async () => {
        await renderDialog({}, { defaultOpen: true })
        await advance(motion.durationMedium1)

        await fireEvent.press(scrim())
        await advance(0)

        expect(getAnimatedStyle(screen.getByTestId('panel')).opacity).toBe(0)

        await advance(motion.durationShort2 - 1)

        expect(screen.getByTestId('panel')).toBeTruthy()

        await advance(1)

        expect(screen.queryByTestId('panel')).toBe(null)
      })
    })
  })

  describe('focus', () => {
    it('sends the screen reader to the title once it shows', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      const ref = createRef<ComponentRef<typeof Text>>()
      await render(
        <Dialog.Content defaultOpen testID="panel">
          <Dialog.Header>
            <Dialog.Title ref={ref}>Headline</Dialog.Title>
          </Dialog.Header>
        </Dialog.Content>,
      )

      expect(send).not.toHaveBeenCalled()

      await fireEvent(modal(), 'show')

      expect(ref.current).not.toBe(null)
      expect(send).toHaveBeenCalledWith(ref.current, 'focus')
    })

    it('sends it back to the button that opened it once it has gone', async () => {
      const user = setUpUser()
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      await renderDialog()

      await user.press(screen.getByRole('button', { name: 'Open' }))
      await user.press(screen.getByRole('button', { name: 'Cancel' }))

      expect(send).not.toHaveBeenCalledWith(expect.anything(), 'focus')

      await advance(EXIT)

      expect(send).toHaveBeenCalledTimes(1)
      expect(send).toHaveBeenCalledWith(expect.anything(), 'focus')
    })

    it('sends it nowhere when nothing opened it', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      await renderDialog({}, { defaultOpen: true })

      await fireEvent.press(scrim())
      await advance(EXIT)

      expect(send).not.toHaveBeenCalled()
    })

    it("leaves focus to React Native Web's Modal on web", async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      const user = setUpUser()
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      await renderDialog()

      await user.press(screen.getByRole('button', { name: 'Open' }))
      await fireEvent(modal(), 'show')
      await user.press(screen.getByRole('button', { name: 'Cancel' }))
      await advance(EXIT)

      expect(send).not.toHaveBeenCalled()
    })
  })

  describe('the Modal', () => {
    it('is transparent, draws no animation of its own, and turns with the device', async () => {
      await renderDialog({}, { defaultOpen: true })

      expect(modal().props).toMatchObject({
        animationType: 'none',
        navigationBarTranslucent: true,
        statusBarTranslucent: true,
        supportedOrientations: [
          'portrait',
          'portrait-upside-down',
          'landscape',
          'landscape-left',
          'landscape-right',
        ],
        transparent: true,
        visible: true,
      })
    })
  })

  it('puts the style, ref and testID on the container', async () => {
    const ref = createRef<ComponentRef<typeof Text>>()
    await render(
      <Dialog.Content defaultOpen ref={ref} style={OFFSET} testID="panel">
        <Dialog.Body>Supporting text</Dialog.Body>
      </Dialog.Content>,
    )

    const panel = screen.getByTestId('panel')

    expect(styleOf(panel)).toMatchObject(OFFSET)
    expect(ref.current).not.toBe(null)
  })
})
