import type { ReactNode } from 'react'
import type {
  HostInstance,
  MeasureInWindowOnSuccessCallback,
  StyleProp,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'
import type { Selection } from 'react-stately'
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
import {
  AccessibilityInfo,
  BackHandler,
  Dimensions,
  I18nManager,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { getAnimatedStyle } from 'react-native-reanimated'

import type { MenuContentProps, MenuProps } from '.'

import { Menu } from '.'
import { PersonGlyph } from '../../glyphs'
import { RouterProvider } from '../../router'
import { ThemeScope } from '../../theme-scope'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'
import { Button } from '../button'

// What the next menu the device draws is told about reduced motion.
let mockReducedMotion = false

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  useReducedMotion: () => mockReducedMotion,
}))

// What Android's back gesture is handed to.
type BackListener = Parameters<typeof BackHandler.addEventListener>[1]

type Frame = readonly [x: number, y: number, width: number, height: number]

// What React Native's Jest preset draws a View as: a class component holding
// its props, with the native methods on its prototype.
type MockedView = Pick<HostInstance, 'measureInWindow'> & {
  readonly props: ViewProps
}

const { theme } = scopeFor('light', {})
const { colors, motion, radii, shadows, sizing, spacing, stateLayerOpacity } =
  theme

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

// Where `measureInWindow` reports each view: the trigger and the item that
// opens a submenu by their test ids, and the overlay layer, the only other
// view measured, filling a 400 by 800 window.
const FRAMES: Readonly<Record<string, Frame>> = {
  send: [300, 400, 160, 48],
  trigger: [100, 300, 40, 40],
}
const LAYER: Frame = [0, 0, 400, 800]

// The paths the check and the chevron draw, which is how a test tells the
// two glyphs apart in what the renderer holds.
const CHECK = 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
const CHEVRON = 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z'

// Hoisted so no prop below is a new value on every render, which is what
// react-perf's array, object and JSX rules are after.
const BACK_PRESS = { timeStamp: 0, type: 'hardwareBackPress' }
const FIRST = ['first']
const SECOND = ['second']
const ENTRIES = [
  { id: 'first', name: 'First item' },
  { id: 'second', name: 'Second item' },
]
const NO_ENTRIES: readonly { id: string }[] = []
const PERSON = <PersonGlyph testID="person" />
const OTHER = <PersonGlyph testID="other" />
const OWN = StyleSheet.create({
  content: { marginTop: 3 },
  item: { marginTop: 5 },
})

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// The items a screen reader is told are checked. Testing Library's own
// `checked` option reads the state for checkboxes, radios and switches alone.
function checkedItems() {
  return screen
    .getAllByRole('menuitem')
    .filter((row) => checkedOf(row) === true)
}

// What a row tells a screen reader about whether it is checked.
function checkedOf(row: { props: { accessibilityState?: unknown } }) {
  const state = row.props.accessibilityState

  return typeof state === 'object' && state !== null && 'checked' in state
    ? state.checked
    : undefined
}

// Lays out every open menu, which places it and lets presses through, then
// presses the item named `name`.
async function choose(name: string) {
  await layOut()
  await fireEvent.press(item(name))
}

function contentStyleOf(scroll: {
  props: { contentContainerStyle?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([scroll.props.contentContainerStyle]) ?? {}
}

// The glyphs drawing `path`, within `scope` or anywhere.
function glyphsOf(path: string, scope?: TestInstance) {
  const matches = (node: TestInstance) =>
    node.type === 'RNSVGPath' && node.props.d === path

  return scope === undefined ? hostsWhere(matches) : scope.queryAll(matches)
}

// The views the renderer holds that match `predicate`, hidden ones included.
function hostsWhere(predicate: (node: TestInstance) => boolean) {
  return screen.root?.queryAll(predicate) ?? []
}

function isMockedView(value: unknown): value is MockedView {
  return (
    typeof value === 'object' && value !== null && 'measureInWindow' in value
  )
}

function item(name: string) {
  return screen.getByRole('menuitem', { name })
}

// Reports a surface's size, which is what places it.
async function laidOut(testID = 'panel', width = 200, height = 100) {
  await fireEvent(screen.getByTestId(testID), 'layout', {
    nativeEvent: { layout: { height, width, x: 0, y: 0 } },
  })
}

// The layer a press outside the menu lands on, drawn just before it.
function layer() {
  const siblings = panel().parent?.children ?? []
  const found = siblings.at(siblings.indexOf(panel()) - 1)

  if (found === undefined || typeof found === 'string') {
    throw new TypeError('expected the layer before the menu')
  }
  return found
}

// Reports every open menu's size, at 200 by 100.
async function layOut() {
  for (const surface of hostsWhere((node) => node.props.role === 'menu')) {
    // oxlint-disable-next-line no-await-in-loop -- each layout is an act of its own, and two acts may not overlap
    await fireEvent(surface, 'layout', {
      nativeEvent: { layout: { height: 100, width: 200, x: 0, y: 0 } },
    })
  }
}

function onlyHost(predicate: (node: TestInstance) => boolean) {
  const found = hostsWhere(predicate).at(0)

  if (found === undefined) {
    throw new TypeError('expected a view to match')
  }
  return found
}

function panel() {
  return screen.getByTestId('panel')
}

// Renders a menu with a trigger and three items, the shape a call site draws.
async function renderMenu(
  props: Partial<MenuProps> = {},
  content: Partial<MenuContentProps> = {},
) {
  return render(
    withScope(
      <Menu {...props}>
        <Button testID="trigger" variant="outlined">
          Open
        </Button>
        <Menu.Content testID="panel" {...content}>
          <Menu.Item id="first">First item</Menu.Item>
          <Menu.Item id="second">Second item</Menu.Item>
          <Menu.Item id="third">Third item</Menu.Item>
        </Menu.Content>
      </Menu>,
    ),
  )
}

// A menu whose second item opens a submenu of two.
async function renderSubmenu(props: Partial<MenuProps> = {}) {
  return render(
    withScope(
      <Menu {...props}>
        <Button testID="trigger">Open</Button>
        <Menu.Content testID="panel">
          <Menu.Item id="link">Copy link</Menu.Item>
          <Menu.Submenu>
            <Menu.Item id="send" testID="send">
              Send to
            </Menu.Item>
            <Menu.Content testID="submenu">
              <Menu.Item id="ada">Ada Lovelace</Menu.Item>
              <Menu.Item id="grace">Grace Hopper</Menu.Item>
            </Menu.Content>
          </Menu.Submenu>
        </Menu.Content>
      </Menu>,
    ),
  )
}

function resize(width: number, height: number) {
  const metrics = { fontScale: 1, height, scale: 1, width }

  Dimensions.set({ screen: metrics, window: metrics })
}

// The keys a call to `onSelectionChange` was handed, as a sorted list.
function selectionOf(call: undefined | unknown[]) {
  const keys = call?.[0]

  if (!(keys instanceof Set)) {
    throw new TypeError('expected a set of keys')
  }
  return [...(keys as Exclude<Selection, 'all'>)].map(String).toSorted()
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

function trigger() {
  return screen.getByTestId('trigger')
}

function withScope(children: ReactNode) {
  return <ThemeScope>{children}</ThemeScope>
}

beforeEach(() => {
  jest.useFakeTimers()
  resize(400, 800)
  const prototype: unknown = View.prototype

  if (!isMockedView(prototype)) {
    throw new TypeError('expected the View the Jest preset mocks')
  }

  jest.spyOn(prototype, 'measureInWindow').mockImplementation(function measure(
    this: MockedView,
    callback: MeasureInWindowOnSuccessCallback,
  ) {
    const testID = this.props.testID ?? ''

    callback(...(FRAMES[testID] ?? LAYER))
  })
})

afterEach(() => {
  mockReducedMotion = false
  Dimensions.set(INITIAL)
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('Menu', () => {
  describe('opening and closing', () => {
    it('opens from its trigger and shows its items by role and name', async () => {
      await renderMenu()

      expect(screen.queryByTestId('panel')).toBe(null)

      await fireEvent.press(trigger())

      expect(panel().props.role).toBe('menu')
      expect(item('First item')).toBeTruthy()
      expect(item('Second item')).toBeTruthy()
      expect(item('Third item')).toBeTruthy()
    })

    it('closes from a press outside it', async () => {
      await renderMenu({ defaultOpen: true })

      await fireEvent.press(layer())
      await advance(motion.durationShort2)

      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it('closes from a second press on its trigger', async () => {
      const onOpenChange = jest.fn()
      await renderMenu({ onOpenChange })

      await fireEvent.press(trigger())
      await fireEvent.press(trigger())

      expect(onOpenChange.mock.calls).toEqual([[true], [false]])
    })

    it("closes from Android's back gesture", async () => {
      const listeners: BackListener[] = []
      jest
        .spyOn(BackHandler, 'addEventListener')
        .mockImplementation((_, listener) => {
          listeners.push(listener)
          return { remove: jest.fn() }
        })
      const onOpenChange = jest.fn()
      await renderMenu({ defaultOpen: true, onOpenChange })

      let handled: boolean | undefined = false
      await act(() => {
        handled = listeners.at(-1)?.(BACK_PRESS)
      })

      expect(handled).toBe(true)
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it("closes from VoiceOver's escape gesture", async () => {
      const onOpenChange = jest.fn()
      await renderMenu({ defaultOpen: true, onOpenChange })

      await fireEvent(panel(), 'accessibilityEscape')

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('stays mounted until its exit has run', async () => {
      await renderMenu({ defaultOpen: true })
      await laidOut()

      await fireEvent.press(layer())
      await advance(motion.durationShort2 - 1)

      expect(panel()).toBeTruthy()

      await advance(1)

      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it('follows isOpen when the call site holds the state', async () => {
      const view = await renderMenu({ isOpen: false })

      expect(screen.queryByTestId('panel')).toBe(null)

      await view.rerender(
        withScope(
          <Menu isOpen>
            <Button>Open</Button>
            <Menu.Content testID="panel">
              <Menu.Item>First item</Menu.Item>
            </Menu.Content>
          </Menu>,
        ),
      )

      expect(panel()).toBeTruthy()
    })

    it('opens from a press held on its trigger with trigger="longPress"', async () => {
      const onPress = jest.fn()
      await render(
        withScope(
          <Menu trigger="longPress">
            <Button onPress={onPress} testID="trigger">
              Open
            </Button>
            <Menu.Content testID="panel">
              <Menu.Item>First item</Menu.Item>
            </Menu.Content>
          </Menu>,
        ),
      )

      await fireEvent.press(trigger())

      expect(onPress).toHaveBeenCalledTimes(1)
      expect(screen.queryByTestId('panel')).toBe(null)

      await fireEvent(trigger(), 'longPress')

      expect(panel()).toBeTruthy()
    })

    it('says on its trigger whether it is open', async () => {
      await renderMenu()

      expect(screen.getByRole('button', { expanded: false })).toBeTruthy()

      await fireEvent.press(trigger())

      expect(screen.getByRole('button', { expanded: true })).toBeTruthy()
    })

    it('is drawn inside Menu', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(
        render(
          withScope(
            <Menu.Content>
              <Menu.Item>First item</Menu.Item>
            </Menu.Content>,
          ),
        ),
      ).rejects.toThrow('Menu.Content is drawn inside Menu or Menu.Submenu.')
    })
  })

  describe('actions', () => {
    it("runs the menu's onAction with the item's key and closes", async () => {
      const onAction = jest.fn()
      const onClose = jest.fn()
      const onOpenChange = jest.fn()
      await renderMenu(
        { defaultOpen: true, onOpenChange },
        { onAction, onClose },
      )

      await choose('Second item')

      expect(onAction).toHaveBeenCalledWith('second')
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it("runs an item's own onAction in place of the menu's", async () => {
      const own = jest.fn()
      const onAction = jest.fn()
      await render(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content onAction={onAction}>
              <Menu.Item id="first" onAction={own}>
                First item
              </Menu.Item>
            </Menu.Content>
          </Menu>,
        ),
      )

      await choose('First item')

      expect(own).toHaveBeenCalledTimes(1)
      expect(onAction).not.toHaveBeenCalled()
    })

    it("keeps the item's own onPress", async () => {
      const onPress = jest.fn()
      const onAction = jest.fn()
      await render(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content onAction={onAction}>
              <Menu.Item id="first" onPress={onPress}>
                First item
              </Menu.Item>
            </Menu.Content>
          </Menu>,
        ),
      )

      await choose('First item')

      expect(onPress).toHaveBeenCalledTimes(1)
      expect(onAction).toHaveBeenCalledWith('first')
    })

    it('stays open when shouldCloseOnSelect is false', async () => {
      const onOpenChange = jest.fn()
      await renderMenu(
        { defaultOpen: true, onOpenChange },
        { shouldCloseOnSelect: false },
      )

      await choose('First item')

      expect(onOpenChange).not.toHaveBeenCalled()
    })

    it('takes no press on a disabled item', async () => {
      const onAction = jest.fn()
      await render(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content disabledKeys={SECOND} onAction={onAction}>
              <Menu.Item id="first" isDisabled>
                First item
              </Menu.Item>
              <Menu.Item id="second">Second item</Menu.Item>
            </Menu.Content>
          </Menu>,
        ),
      )

      await choose('First item')
      await choose('Second item')

      expect(onAction).not.toHaveBeenCalled()
      expect(screen.getAllByRole('menuitem', { disabled: true })).toHaveLength(
        2,
      )
    })

    it("follows an item's href through the app's router and closes", async () => {
      const navigate = jest.fn()
      const onOpenChange = jest.fn()
      await render(
        withScope(
          <RouterProvider navigate={navigate}>
            <Menu defaultOpen onOpenChange={onOpenChange}>
              <Button>Open</Button>
              <Menu.Content selectionMode="multiple">
                <Menu.Item href="/second" id="second">
                  Second item
                </Menu.Item>
              </Menu.Content>
            </Menu>
          </RouterProvider>,
        ),
      )

      await choose('Second item')

      expect(navigate).toHaveBeenCalledWith('/second')
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('selection', () => {
    it('selects one item at a time and closes', async () => {
      const onSelectionChange = jest.fn()
      const onOpenChange = jest.fn()
      await renderMenu(
        { defaultOpen: true, onOpenChange },
        {
          defaultSelectedKeys: ['first'],
          onSelectionChange,
          selectionMode: 'single',
        },
      )

      expect(checkedItems()).toEqual([item('First item')])

      await choose('Third item')

      expect(selectionOf(onSelectionChange.mock.calls[0])).toEqual(['third'])
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('toggles several items and stays open', async () => {
      const onSelectionChange = jest.fn()
      const onOpenChange = jest.fn()
      await renderMenu(
        { defaultOpen: true, onOpenChange },
        { onSelectionChange, selectionMode: 'multiple' },
      )

      await choose('First item')
      await choose('Third item')

      expect(selectionOf(onSelectionChange.mock.calls[0])).toEqual(['first'])
      expect(selectionOf(onSelectionChange.mock.calls[1])).toEqual([
        'first',
        'third',
      ])
      expect(onOpenChange).not.toHaveBeenCalled()
      expect(checkedItems()).toEqual([item('First item'), item('Third item')])
    })

    it('follows selectedKeys when the call site holds the selection', async () => {
      await renderMenu(
        { defaultOpen: true },
        { selectedKeys: ['second'], selectionMode: 'single' },
      )

      await choose('Third item')

      expect(checkedItems()).toEqual([item('Second item')])
    })

    it('reports no checked state while the menu selects nothing', async () => {
      await renderMenu({ defaultOpen: true })

      expect(checkedOf(item('First item'))).toBeUndefined()
    })

    it("draws a selected item on tertiary container, in its on-colour, with the check at the row's end", async () => {
      await render(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content defaultSelectedKeys={FIRST} selectionMode="single">
              <Menu.Item id="first" testID="first">
                First item
              </Menu.Item>
              <Menu.Item id="second" testID="second">
                Second item
              </Menu.Item>
            </Menu.Content>
          </Menu>,
        ),
      )

      expect(styleOf(screen.getByTestId('first'))).toMatchObject({
        backgroundColor: colors.tertiaryContainer,
      })
      expect(
        styleOf(screen.getByTestId('second')).backgroundColor,
      ).toBeUndefined()
      expect(textStyleOf(screen.getByText('First item')).color).toBe(
        colors.onTertiaryContainer,
      )
      expect(glyphsOf(CHECK)).toHaveLength(1)
      expect(glyphsOf(CHECK, screen.getByTestId('first'))).toHaveLength(1)
    })

    it('draws the check in place of the leading content', async () => {
      await render(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content defaultSelectedKeys={FIRST} selectionMode="single">
              <Menu.Item id="first" leading={PERSON}>
                First item
              </Menu.Item>
              <Menu.Item id="second" leading={OTHER}>
                Second item
              </Menu.Item>
            </Menu.Content>
          </Menu>,
        ),
      )

      // Glyphs are hidden from screen readers, so they are found among the
      // hidden views.
      expect(
        screen.queryByTestId('person', { includeHiddenElements: true }),
      ).toBe(null)
      expect(
        screen.getByTestId('other', { includeHiddenElements: true }),
      ).toBeTruthy()
      expect(glyphsOf(CHECK)).toHaveLength(1)
    })
  })

  describe('submenus', () => {
    it('opens a submenu from a press on its item, which says it has one', async () => {
      await renderSubmenu({ defaultOpen: true })

      expect(item('Send to').props['aria-haspopup']).toBe('menu')
      expect(screen.getByRole('menuitem', { expanded: false })).toBe(
        item('Send to'),
      )
      expect(screen.queryByTestId('submenu')).toBe(null)

      await choose('Send to')

      expect(screen.getByTestId('submenu')).toBeTruthy()
      expect(item('Ada Lovelace')).toBeTruthy()
      expect(screen.getByRole('menuitem', { expanded: true })).toBe(
        item('Send to'),
      )
    })

    it('closes the submenu from a second press on its item', async () => {
      await renderSubmenu({ defaultOpen: true })

      await choose('Send to')
      await choose('Send to')
      await advance(motion.durationShort2)

      expect(screen.queryByTestId('submenu')).toBe(null)
      expect(panel()).toBeTruthy()
    })

    it('closes with the menu it came from', async () => {
      const onOpenChange = jest.fn()
      await renderSubmenu({ defaultOpen: true, onOpenChange })

      await choose('Send to')
      await fireEvent.press(layer())
      await advance(motion.durationShort2)

      expect(onOpenChange).toHaveBeenCalledWith(false)
      expect(screen.queryByTestId('submenu')).toBe(null)
      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it('closes the whole menu from an action in the submenu', async () => {
      const onAction = jest.fn()
      const onOpenChange = jest.fn()
      await render(
        withScope(
          <Menu defaultOpen onOpenChange={onOpenChange}>
            <Button>Open</Button>
            <Menu.Content testID="panel">
              <Menu.Submenu>
                <Menu.Item id="send">Send to</Menu.Item>
                <Menu.Content onAction={onAction} testID="submenu">
                  <Menu.Item id="ada">Ada Lovelace</Menu.Item>
                </Menu.Content>
              </Menu.Submenu>
            </Menu.Content>
          </Menu>,
        ),
      )

      await choose('Send to')
      await choose('Ada Lovelace')
      await advance(motion.durationShort2)

      expect(onAction).toHaveBeenCalledWith('ada')
      expect(onOpenChange).toHaveBeenCalledWith(false)
      expect(screen.queryByTestId('panel')).toBe(null)
    })

    it('draws no layer of its own, so its parent stays in reach', async () => {
      await renderSubmenu({ defaultOpen: true })

      await choose('Send to')

      const submenu = screen.getByTestId('submenu')
      const siblings = submenu.parent?.children ?? []

      expect(siblings.indexOf(submenu)).toBe(0)
    })

    it("closes the submenu alone from Android's back gesture", async () => {
      const listeners: BackListener[] = []
      jest
        .spyOn(BackHandler, 'addEventListener')
        .mockImplementation((_, listener) => {
          listeners.push(listener)
          return {
            remove: () => {
              listeners.splice(listeners.indexOf(listener), 1)
            },
          }
        })
      const onOpenChange = jest.fn()
      await renderSubmenu({ defaultOpen: true, onOpenChange })
      await choose('Send to')

      await act(() => {
        listeners.at(-1)?.(BACK_PRESS)
      })
      await advance(motion.durationShort2)

      expect(screen.queryByTestId('submenu')).toBe(null)
      expect(panel()).toBeTruthy()
      expect(onOpenChange).not.toHaveBeenCalled()

      await act(() => {
        listeners.at(-1)?.(BACK_PRESS)
      })

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('opens at the inline end of its item, its first item level with it', async () => {
      resize(800, 800)
      await renderSubmenu({ defaultOpen: true })
      await choose('Send to')
      await laidOut('submenu', 100)

      expect(styleOf(screen.getByTestId('submenu'))).toMatchObject({
        left: 460,
        top: 400 - spacing.sm,
        transformOrigin: 'left',
      })
    })

    it('opens to the left under right-to-left', async () => {
      jest.replaceProperty(I18nManager, 'isRTL', true)
      resize(800, 800)
      await renderSubmenu({ defaultOpen: true })
      await choose('Send to')
      await laidOut('submenu', 100)

      expect(styleOf(screen.getByTestId('submenu'))).toMatchObject({
        transformOrigin: 'right',
      })
    })

    it('draws the chevron on its item only', async () => {
      await renderSubmenu({ defaultOpen: true })

      expect(glyphsOf(CHEVRON)).toHaveLength(1)
      expect(glyphsOf(CHEVRON, item('Send to'))).toHaveLength(1)
    })
  })

  describe('sections and separators', () => {
    it('draws a section as a group named by its header', async () => {
      await render(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content>
              <Menu.Section header="Order">
                <Menu.Item id="first">Ascending</Menu.Item>
              </Menu.Section>
              <Menu.Separator testID="rule" />
              <Menu.Section aria-label="Field">
                <Menu.Item id="third">Name</Menu.Item>
              </Menu.Section>
            </Menu.Content>
          </Menu>,
        ),
      )

      const header = screen.getByText('Order')
      const groups = hostsWhere((node) => node.props.role === 'group')
      const named = groups.find(
        (group) => group.props['aria-labelledby'] === header.props.nativeID,
      )

      expect(header.props.nativeID).toEqual(expect.any(String))
      expect(named).toBeDefined()
      expect(
        groups.some((group) => group.props['aria-label'] === 'Field'),
      ).toBe(true)
      expect(item('Ascending')).toBeTruthy()
      expect(item('Name')).toBeTruthy()
    })

    it("draws a header in title small, inset to the items' labels", async () => {
      await render(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content>
              <Menu.Section header="Order">
                <Menu.Item id="first">Ascending</Menu.Item>
              </Menu.Section>
            </Menu.Content>
          </Menu>,
        ),
      )

      expect(textStyleOf(screen.getByText('Order'))).toMatchObject({
        color: colors.onSurfaceVariant,
        fontSize: theme.typography.titleSmallSize,
        paddingBottom: spacing.xxs,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
      })
    })

    it('draws a rule with 8dp either side', async () => {
      await render(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content>
              <Menu.Item id="first">First item</Menu.Item>
              <Menu.Separator testID="rule" />
              <Menu.Item id="second">Second item</Menu.Item>
            </Menu.Content>
          </Menu>,
        ),
      )

      expect(screen.getByTestId('rule').props.role).toBe('separator')
      expect(styleOf(screen.getByTestId('rule'))).toMatchObject({
        backgroundColor: colors.outlineVariant,
        marginVertical: spacing.sm,
      })
    })
  })

  describe('items from data', () => {
    it('draws an item for each entry', async () => {
      const onAction = jest.fn()
      await render(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content items={ENTRIES} onAction={onAction}>
              {(entry) => <Menu.Item id={entry.id}>{entry.name}</Menu.Item>}
            </Menu.Content>
          </Menu>,
        ),
      )

      await choose('Second item')

      expect(onAction).toHaveBeenCalledWith('second')
    })
  })

  describe('empty and loading', () => {
    it('says "No results" when nothing is in it', async () => {
      await render(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content items={NO_ENTRIES}>
              {(entry: { id: string }) => <Menu.Item id={entry.id} />}
            </Menu.Content>
          </Menu>,
        ),
      )

      expect(textStyleOf(screen.getByText('No results'))).toMatchObject({
        color: colors.onSurfaceVariant,
      })
    })

    it('draws renderEmptyState in its place', async () => {
      await render(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content items={NO_ENTRIES} renderEmptyState={emptyText}>
              {(entry: { id: string }) => <Menu.Item id={entry.id} />}
            </Menu.Content>
          </Menu>,
        ),
      )

      expect(screen.getByText('Nothing here')).toBeTruthy()
      expect(screen.queryByText('No results')).toBe(null)
    })

    it('draws the ring, named "Loading more", while loading', async () => {
      await render(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content>
              <Menu.Item id="first">First item</Menu.Item>
              <Menu.LoadMore isLoading testID="loader" />
            </Menu.Content>
          </Menu>,
        ),
      )

      expect(screen.getByLabelText('Loading more')).toBeTruthy()
      expect(styleOf(screen.getByTestId('loader'))).toMatchObject({
        minHeight: sizing.rowXs,
      })
      expect(screen.getByTestId('loader').props.role).toBe('menuitem')
    })

    it('takes its own label', async () => {
      await render(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content>
              <Menu.Item id="first">First item</Menu.Item>
              <Menu.LoadMore isLoading label="Fetching" />
            </Menu.Content>
          </Menu>,
        ),
      )

      expect(screen.getByLabelText('Fetching')).toBeTruthy()
    })

    it('loads more once it comes within a visible height of the end', async () => {
      const onLoadMore = jest.fn()
      await render(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content>
              <Menu.Item id="first">First item</Menu.Item>
              <Menu.LoadMore onLoadMore={onLoadMore} testID="loader" />
            </Menu.Content>
          </Menu>,
        ),
      )
      const scroll = onlyHost((node) => node.type === 'RCTScrollView')

      await fireEvent(screen.getByTestId('loader'), 'layout', {
        nativeEvent: { layout: { height: 0, width: 200, x: 0, y: 1000 } },
      })
      await fireEvent(scroll, 'layout', {
        nativeEvent: { layout: { height: 200, width: 200, x: 0, y: 0 } },
      })

      expect(onLoadMore).not.toHaveBeenCalled()

      await fireEvent.scroll(scroll, {
        nativeEvent: { contentOffset: { x: 0, y: 600 } },
      })

      expect(onLoadMore).toHaveBeenCalledTimes(1)

      await fireEvent.scroll(scroll, {
        nativeEvent: { contentOffset: { x: 0, y: 700 } },
      })

      expect(onLoadMore).toHaveBeenCalledTimes(1)
    })

    it('loads more again once a load has moved it, and not while loading', async () => {
      const onLoadMore = jest.fn()
      const view = await render(loadingMenu(false, onLoadMore))
      const scroll = onlyHost((node) => node.type === 'RCTScrollView')

      await fireEvent(scroll, 'layout', {
        nativeEvent: { layout: { height: 200, width: 200, x: 0, y: 0 } },
      })
      await fireEvent(screen.getByTestId('loader'), 'layout', {
        nativeEvent: { layout: { height: 0, width: 200, x: 0, y: 48 } },
      })

      expect(onLoadMore).toHaveBeenCalledTimes(1)

      await view.rerender(loadingMenu(true, onLoadMore))
      await fireEvent(screen.getByTestId('loader'), 'layout', {
        nativeEvent: { layout: { height: 48, width: 200, x: 0, y: 48 } },
      })

      expect(onLoadMore).toHaveBeenCalledTimes(1)

      await view.rerender(loadingMenu(false, onLoadMore))
      await fireEvent(screen.getByTestId('loader'), 'layout', {
        nativeEvent: { layout: { height: 0, width: 200, x: 0, y: 48 } },
      })

      expect(onLoadMore).toHaveBeenCalledTimes(1)

      await fireEvent(screen.getByTestId('loader'), 'layout', {
        nativeEvent: { layout: { height: 0, width: 200, x: 0, y: 96 } },
      })

      expect(onLoadMore).toHaveBeenCalledTimes(2)
    })
  })

  describe('placement', () => {
    it('sits below its trigger, lined up with its start, spacing.sm away', async () => {
      await renderMenu({ defaultOpen: true })
      await laidOut()

      expect(styleOf(panel())).toMatchObject({
        left: 100,
        position: 'absolute',
        top: 340 + spacing.sm,
        transformOrigin: 'top',
      })
    })

    it('takes the side, the alignment and the offsets', async () => {
      await renderMenu(
        { defaultOpen: true },
        { align: 'center', alignOffset: 4, side: 'top', sideOffset: 20 },
      )
      await laidOut()

      expect(styleOf(panel())).toMatchObject({ left: 24, top: 180 })
    })

    it('is hidden until it is placed', async () => {
      await renderMenu({ defaultOpen: true })

      expect(styleOf(panel())).toMatchObject({ opacity: 0 })
    })
  })

  describe('appearance', () => {
    it('is the menus page surface: surface container low, the 4dp corner, the second elevation', async () => {
      await renderMenu({ defaultOpen: true })

      expect(styleOf(panel())).toMatchObject({
        backgroundColor: colors.surfaceContainerLow,
        borderRadius: radii.xs,
        boxShadow: shadows.elevation2,
        maxWidth: 280,
        minWidth: 112,
      })
    })

    it('is 8dp above and below its items', async () => {
      await renderMenu({ defaultOpen: true })

      const scroll = onlyHost((node) => node.type === 'RCTScrollView')

      expect(contentStyleOf(scroll)).toMatchObject({
        paddingVertical: spacing.sm,
      })
    })

    it('draws each item 48dp tall in label large, inset 16dp', async () => {
      await render(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content>
              <Menu.Item id="first" testID="first">
                First item
              </Menu.Item>
            </Menu.Content>
          </Menu>,
        ),
      )

      expect(styleOf(screen.getByTestId('first'))).toMatchObject({
        gap: spacing.lg,
        minHeight: sizing.rowXs,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
      })
      expect(textStyleOf(screen.getByText('First item'))).toMatchObject({
        color: colors.onSurface,
        fontSize: theme.typography.labelLargeSize,
      })
    })

    it('fades a disabled item', async () => {
      await render(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content>
              <Menu.Item id="first" isDisabled>
                First item
              </Menu.Item>
            </Menu.Content>
          </Menu>,
        ),
      )

      expect(textStyleOf(screen.getByText('First item')).color).toBe(
        withOpacity(colors.onSurface, stateLayerOpacity.disabledContent),
      )
    })

    it("lands the call site's style on the surface and on the row", async () => {
      await render(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content style={OWN.content} testID="panel">
              <Menu.Item id="first" style={OWN.item} testID="first">
                First item
              </Menu.Item>
            </Menu.Content>
          </Menu>,
        ),
      )

      expect(styleOf(panel())).toMatchObject({ marginTop: 3 })
      expect(styleOf(screen.getByTestId('first'))).toMatchObject({
        marginTop: 5,
      })
    })
  })

  describe('semantics', () => {
    it('reports menuitemradio and menuitemcheckbox on the web', async () => {
      jest.replaceProperty(Platform, 'OS', 'web')
      const view = await renderMenu(
        { defaultOpen: true },
        { selectionMode: 'single' },
      )

      expect(
        hostsWhere((node) => node.props.accessibilityRole === 'menuitemradio'),
      ).toHaveLength(3)

      await view.rerender(
        withScope(
          <Menu defaultOpen>
            <Button>Open</Button>
            <Menu.Content selectionMode="multiple" testID="panel">
              <Menu.Item id="first">First item</Menu.Item>
            </Menu.Content>
          </Menu>,
        ),
      )

      expect(
        hostsWhere(
          (node) => node.props.accessibilityRole === 'menuitemcheckbox',
        ),
      ).toHaveLength(1)
    })

    it('keeps the layer from screen readers and the keyboard', async () => {
      await renderMenu({ defaultOpen: true })

      expect(layer().props).toMatchObject({
        accessible: false,
        'aria-hidden': true,
        focusable: false,
        tabIndex: -1,
      })
    })
  })

  describe('motion', () => {
    it('fades and scales in from 95% once it is placed', async () => {
      await renderMenu({ defaultOpen: true })
      await advance(motion.durationShort3)

      expect(getAnimatedStyle(panel())).toMatchObject({ opacity: 0 })

      await laidOut()
      await advance(motion.durationShort3)

      expect(getAnimatedStyle(panel())).toMatchObject({
        opacity: 1,
        transform: [{ scale: 1 }],
      })
    })

    it('leaves at once under reduced motion', async () => {
      mockReducedMotion = true
      await renderMenu({ defaultOpen: true })
      await laidOut()

      await fireEvent.press(layer())

      expect(screen.queryByTestId('panel')).toBe(null)
    })
  })

  describe('focus', () => {
    it('sends the screen reader to the first item a press reaches once it is placed', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      await render(
        withScope(
          <Menu>
            <Button testID="trigger">Open</Button>
            <Menu.Content testID="panel">
              <Menu.Item id="first" isDisabled>
                First item
              </Menu.Item>
              <Menu.Item id="second" testID="second">
                Second item
              </Menu.Item>
            </Menu.Content>
          </Menu>,
        ),
      )

      await fireEvent.press(trigger())

      expect(send).not.toHaveBeenCalled()

      await laidOut()

      expect(send).toHaveBeenCalledTimes(1)
      expect(send.mock.calls[0]?.[1]).toBe('focus')
    })

    it('sends it back to the trigger once it has gone', async () => {
      const send = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      await renderMenu()

      await fireEvent.press(trigger())
      await laidOut()
      send.mockClear()
      await fireEvent.press(layer())
      await advance(motion.durationShort2)

      expect(send).toHaveBeenCalledTimes(1)
      expect(send).toHaveBeenCalledWith(expect.anything(), 'focus')
    })
  })
})

function emptyText() {
  return <Text>Nothing here</Text>
}

// A menu ending in `Menu.LoadMore`, loading or not.
function loadingMenu(isLoading: boolean, onLoadMore: () => void) {
  return withScope(
    <Menu defaultOpen>
      <Button>Open</Button>
      <Menu.Content>
        <Menu.Item id="first">First item</Menu.Item>
        <Menu.LoadMore
          isLoading={isLoading}
          onLoadMore={onLoadMore}
          testID="loader"
        />
      </Menu.Content>
    </Menu>,
  )
}
