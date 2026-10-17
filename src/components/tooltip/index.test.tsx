import type { ReactNode } from 'react'
import type {
  HostInstance,
  MeasureInWindowOnSuccessCallback,
  StyleProp,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'

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
import { createRef, useCallback, useState } from 'react'
import { Dimensions, StyleSheet, Text, View } from 'react-native'

import type { TooltipProps } from '.'

import { Tooltip } from '.'
import { PlusGlyph } from '../../glyphs'
import { ThemeScope } from '../../theme-scope'
import { scopeFor } from '../../theme/scope'
import { Button } from '../button'
import { Fab } from '../fab'
import { IconButton } from '../icon-button'
import { Popover } from '../popover'

type Frame = readonly [x: number, y: number, width: number, height: number]

// What React Native's Jest preset draws a View as: a class component holding
// its props, with the native methods on its prototype.
type MockedView = Pick<HostInstance, 'measureInWindow'> & {
  readonly props: ViewProps
}

const { theme } = scopeFor('light', {})
const { colors, motion, radii, spacing, typography } = theme

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

// Where `measureInWindow` reports each view: the triggers by their test ids,
// one in the middle of the window and one at its top edge, and the overlay
// layer, the only other view measured, filling a 400 by 800 window.
const FRAMES: Readonly<Record<string, Frame>> = {
  edge: [180, 10, 40, 40],
  trigger: [180, 300, 40, 40],
}
const LAYER: Frame = [0, 0, 400, 800]

const PLUS = <PlusGlyph />

// A press as the ripple reads it, which measures the view it landed on.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: {},
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds)
  })
}

// Every tooltip shares one warm-up, as on web: once one has shown, the next
// opens at once until the cool-down after a close has run. The tests start
// cold, so a close is asked for here and the cool-down run, which does nothing
// when nothing is warm.
async function coolDown() {
  const view = await render(
    <ThemeScope>
      <Tooltip isOpen={false} label="Label">
        <Button testID="cool">Label</Button>
      </Tooltip>
    </ThemeScope>,
  )

  await fireEvent(screen.getByTestId('cool'), 'pressOut')
  await advance(2000)
  await view.unmount()
}

// A tooltip whose open state the call site holds, opened from a press on
// something other than its trigger.
function Held() {
  const [isOpen, setOpen] = useState(false)
  const open = useCallback(() => {
    setOpen(true)
  }, [])

  return withScope(
    <>
      <Text onPress={open}>Elsewhere</Text>
      <Tooltip
        isOpen={isOpen}
        label="Supporting text"
        onOpenChange={setOpen}
        testID="tooltip"
      >
        <Button testID="trigger">Label</Button>
      </Tooltip>
    </>,
  )
}

function hint() {
  const value: unknown = trigger().props.accessibilityHint

  return value
}

function isMockedView(value: unknown): value is MockedView {
  return (
    typeof value === 'object' && value !== null && 'measureInWindow' in value
  )
}

// Reports the tooltip's size, which is what places it.
async function laidOut(width = 100, height = 24) {
  await fireEvent(surface(), 'layout', {
    nativeEvent: { layout: { height, width, x: 0, y: 0 } },
  })
}

async function renderTooltip(
  props: Partial<TooltipProps> = {},
  onPress?: () => void,
) {
  return render(
    <ThemeScope>
      <Tooltip label="Supporting text" testID="tooltip" {...props}>
        <Button onPress={onPress} testID="trigger" variant="outlined">
          Label
        </Button>
      </Tooltip>
    </ThemeScope>,
  )
}

function resize(width: number, height: number) {
  const metrics = { fontScale: 1, height, scale: 1, width }

  Dimensions.set({ screen: metrics, window: metrics })
}

// A user whose presses advance the fake clock.
function setUpUser() {
  return userEvent.setup({
    advanceTimers: (delay) => {
      jest.advanceTimersByTime(delay)
    },
  })
}

// The tooltip is hidden from screen readers, which a query leaves out unless
// told otherwise.
const HIDDEN = { includeHiddenElements: true }

function shown() {
  return screen.queryByTestId('tooltip', HIDDEN) !== null
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function surface() {
  return screen.getByTestId('tooltip', HIDDEN)
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

beforeEach(async () => {
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

  await coolDown()
})

afterEach(() => {
  Dimensions.set(INITIAL)
  jest.clearAllMocks()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('Tooltip', () => {
  describe('a held press', () => {
    it('opens it once the press has been held for delay', async () => {
      const user = setUpUser()
      await renderTooltip()

      await user.longPress(trigger(), { duration: 1400 })

      expect(shown()).toBe(false)

      await user.longPress(trigger(), { duration: 1500 })

      expect(shown()).toBe(true)
    })

    it('takes its own delay', async () => {
      const user = setUpUser()
      await renderTooltip({ delay: 800 })

      await user.longPress(trigger(), { duration: 700 })

      expect(shown()).toBe(false)

      await user.longPress(trigger(), { duration: 800 })

      expect(shown()).toBe(true)
    })

    it('closes it closeDelay after the press ends', async () => {
      const onOpenChange = jest.fn()
      await renderTooltip({ closeDelay: 300, onOpenChange })

      await fireEvent(trigger(), 'longPress')
      await fireEvent(trigger(), 'pressOut')
      await advance(299)

      expect(onOpenChange.mock.calls).toEqual([[true]])

      await advance(1)

      expect(onOpenChange.mock.calls).toEqual([[true], [false]])

      await advance(motion.durationShort2)

      expect(shown()).toBe(false)
    })

    it('does not also press the trigger', async () => {
      const user = setUpUser()
      const onPress = jest.fn()
      await renderTooltip({}, onPress)

      await user.longPress(trigger(), { duration: 1500 })

      expect(onPress).not.toHaveBeenCalled()

      await user.press(trigger())

      expect(onPress).toHaveBeenCalledTimes(1)
    })
  })

  describe('a resting pointer', () => {
    it('opens it once it has rested on the trigger for delay', async () => {
      await renderTooltip()

      await fireEvent(trigger(), 'hoverIn')
      await advance(1499)

      expect(shown()).toBe(false)

      await advance(1)

      expect(shown()).toBe(true)
    })

    it('opens nothing for a pointer that leaves before delay', async () => {
      await renderTooltip()

      await fireEvent(trigger(), 'hoverIn')
      await advance(1000)
      await fireEvent(trigger(), 'hoverOut')
      await advance(2000)

      expect(shown()).toBe(false)
    })

    it('closes it closeDelay after the pointer leaves', async () => {
      const onOpenChange = jest.fn()
      await renderTooltip({ closeDelay: 300, delay: 100, onOpenChange })

      await fireEvent(trigger(), 'hoverIn')
      await advance(100)
      await fireEvent(trigger(), 'hoverOut')
      await advance(299)

      expect(onOpenChange.mock.calls).toEqual([[true]])

      await advance(1)

      expect(onOpenChange.mock.calls).toEqual([[true], [false]])
    })

    it('closes it at once on a press of the trigger', async () => {
      const onOpenChange = jest.fn()
      await renderTooltip({ delay: 100, onOpenChange })

      await fireEvent(trigger(), 'hoverIn')
      await advance(100)
      await fireEvent(trigger(), 'pressIn', PRESS)

      expect(onOpenChange.mock.calls).toEqual([[true], [false]])
    })

    it('keeps it through a press with shouldCloseOnPress off, while the pointer rests', async () => {
      const onOpenChange = jest.fn()
      await renderTooltip({
        delay: 100,
        onOpenChange,
        shouldCloseOnPress: false,
      })

      await fireEvent(trigger(), 'hoverIn')
      await advance(100)
      await fireEvent(trigger(), 'pressIn', PRESS)
      await fireEvent(trigger(), 'pressOut')
      await advance(2000)

      expect(onOpenChange.mock.calls).toEqual([[true]])
    })

    it('is left out by trigger="focus", which opens on the held press alone', async () => {
      await renderTooltip({ trigger: 'focus' })

      await fireEvent(trigger(), 'hoverIn')
      await advance(2000)

      expect(shown()).toBe(false)

      await fireEvent(trigger(), 'longPress')

      expect(shown()).toBe(true)
    })

    it('opens the next tooltip at once once one has shown, and closes the first', async () => {
      await render(
        withScope(
          <>
            <Tooltip label="First item" testID="first">
              <Button testID="trigger">First item</Button>
            </Tooltip>
            <Tooltip label="Second item" testID="second">
              <Button testID="next">Second item</Button>
            </Tooltip>
          </>,
        ),
      )

      await fireEvent(trigger(), 'hoverIn')
      await advance(1500)
      await fireEvent(trigger(), 'hoverOut')
      await fireEvent(screen.getByTestId('next'), 'hoverIn')

      expect(screen.getByTestId('second', HIDDEN)).toBeTruthy()

      await advance(motion.durationShort2)

      expect(screen.queryByTestId('first', HIDDEN)).toBe(null)
    })
  })

  describe('its state', () => {
    it('starts open with defaultOpen', async () => {
      await renderTooltip({ defaultOpen: true })

      expect(shown()).toBe(true)
    })

    it('follows isOpen when the call site holds the state', async () => {
      await render(<Held />)

      expect(shown()).toBe(false)

      await fireEvent.press(screen.getByText('Elsewhere'))

      expect(shown()).toBe(true)
    })

    it('stays mounted until its exit has run', async () => {
      await renderTooltip({ closeDelay: 0, defaultOpen: true })
      await laidOut()

      await fireEvent(trigger(), 'pressIn', PRESS)
      await advance(motion.durationShort2 - 1)

      expect(shown()).toBe(true)

      await advance(1)

      expect(shown()).toBe(false)
    })

    it('opens from nothing with isDisabled', async () => {
      const user = setUpUser()
      await renderTooltip({ isDisabled: true })

      await fireEvent(trigger(), 'hoverIn')
      await advance(2000)
      await user.longPress(trigger(), { duration: 1500 })

      expect(shown()).toBe(false)
    })
  })

  describe('placement', () => {
    it('sits above its trigger, centred on it, spacing.sm away', async () => {
      await renderTooltip({ defaultOpen: true })
      await laidOut()

      expect(styleOf(surface())).toMatchObject({
        left: 150,
        position: 'absolute',
        top: 300 - spacing.sm - 24,
      })
    })

    it('takes the side, the alignment and the offsets', async () => {
      await renderTooltip({
        align: 'start',
        alignOffset: 4,
        defaultOpen: true,
        side: 'bottom',
        sideOffset: 20,
      })
      await laidOut()

      expect(styleOf(surface())).toMatchObject({ left: 184, top: 360 })
    })

    it('grows from the edge facing its trigger', async () => {
      await renderTooltip({ defaultOpen: true, side: 'right' })
      await laidOut()

      expect(styleOf(surface()).transformOrigin).toBe('left')
    })

    it('flips below its trigger at the top of the window', async () => {
      await render(
        withScope(
          <Tooltip defaultOpen label="Supporting text" testID="tooltip">
            <Button testID="edge">Label</Button>
          </Tooltip>,
        ),
      )
      await laidOut()

      expect(styleOf(surface())).toMatchObject({
        top: 50 + spacing.sm,
        transformOrigin: 'top',
      })
    })

    it('is hidden until it is placed', async () => {
      await renderTooltip({ defaultOpen: true })

      expect(styleOf(surface())).toMatchObject({ opacity: 0 })
    })
  })

  describe('appearance', () => {
    it('is the plain tooltip: inverse surface, the extra-small corner, flat', async () => {
      await renderTooltip({ defaultOpen: true })

      const style = styleOf(surface())

      expect(style).toMatchObject({
        backgroundColor: colors.inverseSurface,
        borderRadius: radii.xs,
      })
      expect(style.boxShadow).toBe(undefined)
    })

    it('pads its line 8dp at the ends and 4dp above and below, and wraps at 320dp', async () => {
      await renderTooltip({ defaultOpen: true })

      expect(styleOf(surface())).toMatchObject({
        maxWidth: 320,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
      })
    })

    it('draws its label in body small on inverse on surface', async () => {
      await renderTooltip({ defaultOpen: true })

      expect(
        textStyleOf(screen.getByText('Supporting text', HIDDEN)),
      ).toMatchObject({
        color: colors.inverseOnSurface,
        fontSize: typography.bodySmallSize,
        lineHeight: typography.bodySmallLineHeight,
      })
    })

    it("lands the call site's style and ref on the tooltip", async () => {
      const ref = createRef<HostInstance>()
      await renderTooltip({ defaultOpen: true, ref, style: { minWidth: 120 } })

      expect(styleOf(surface()).minWidth).toBe(120)
      expect(ref.current).not.toBe(null)
    })
  })

  describe('semantics', () => {
    it('keeps the tooltip from screen readers and lets presses through', async () => {
      await renderTooltip({ defaultOpen: true })
      await laidOut()

      expect(surface().props['aria-hidden']).toBe(true)
      expect(styleOf(surface()).pointerEvents).toBe('none')
      expect(surface().parent?.children).toHaveLength(1)
    })

    it("gives its label to the trigger as the trigger's hint", async () => {
      await renderTooltip()

      expect(hint()).toBe('Supporting text')
    })

    it.each([
      [
        'a Button',
        <Button accessibilityHint="Own hint" key="trigger" testID="trigger">
          Label
        </Button>,
      ],
      [
        'an IconButton',
        <IconButton
          accessibilityHint="Own hint"
          aria-label="Add"
          key="trigger"
          testID="trigger"
        >
          {PLUS}
        </IconButton>,
      ],
      [
        'a FAB',
        <Fab
          accessibilityHint="Own hint"
          aria-label="Add"
          key="trigger"
          testID="trigger"
        >
          {PLUS}
        </Fab>,
      ],
    ])("keeps a hint of %s's own", async (_, button) => {
      await render(
        withScope(<Tooltip label="Supporting text">{button}</Tooltip>),
      )

      expect(hint()).toBe('Own hint')
    })

    it('gives no hint while disabled', async () => {
      await renderTooltip({ isDisabled: true })

      expect(hint()).toBe(undefined)
    })

    it.each([
      [
        'an IconButton',
        <IconButton aria-label="Add" key="trigger" testID="trigger">
          {PLUS}
        </IconButton>,
      ],
      [
        'a FAB',
        <Fab aria-label="Add" key="trigger" testID="trigger">
          {PLUS}
        </Fab>,
      ],
      [
        'a close button',
        <Button key="trigger" slot="close" testID="trigger">
          Label
        </Button>,
      ],
      [
        'a link',
        <Button href="/elsewhere" key="trigger" testID="trigger">
          Label
        </Button>,
      ],
    ])('describes %s, and opens and closes from it', async (_, button) => {
      const onOpenChange = jest.fn()
      await render(
        withScope(
          <Tooltip
            closeDelay={300}
            label="Supporting text"
            onOpenChange={onOpenChange}
          >
            {button}
          </Tooltip>,
        ),
      )

      expect(hint()).toBe('Supporting text')

      await fireEvent(trigger(), 'longPress')
      await fireEvent(trigger(), 'pressOut')
      await advance(300)
      await fireEvent(trigger(), 'longPress')
      await fireEvent(trigger(), 'pressIn', PRESS)

      expect(onOpenChange.mock.calls).toEqual([
        [true],
        [false],
        [true],
        [false],
      ])
    })

    it("keeps the trigger's own handlers, which run first", async () => {
      const calls: string[] = []
      const record = (name: string) => () => {
        calls.push(name)
      }
      await render(
        withScope(
          <Tooltip label="Supporting text" onOpenChange={record('open')}>
            <Button
              onHoverIn={record('hoverIn')}
              onHoverOut={record('hoverOut')}
              onLongPress={record('longPress')}
              onPressIn={record('pressIn')}
              onPressOut={record('pressOut')}
              testID="trigger"
            >
              Label
            </Button>
          </Tooltip>,
        ),
      )

      await fireEvent(trigger(), 'hoverIn')
      await fireEvent(trigger(), 'hoverOut')
      await fireEvent(trigger(), 'pressIn', PRESS)
      await fireEvent(trigger(), 'longPress')
      await fireEvent(trigger(), 'pressOut', PRESS)

      expect(calls).toEqual([
        'hoverIn',
        'hoverOut',
        'pressIn',
        'longPress',
        'open',
        'pressOut',
      ])
    })

    it('leaves a button outside it untouched', async () => {
      await render(withScope(<Button testID="trigger">Label</Button>))

      expect(hint()).toBe(undefined)
    })
  })

  describe('beside a popover', () => {
    it.each([
      [
        'around',
        <Tooltip key="tooltip" label="Supporting text" testID="tooltip">
          <Popover>
            <Button testID="trigger">Open</Button>
            <Popover.Content testID="panel">
              <Popover.Title>Headline</Popover.Title>
            </Popover.Content>
          </Popover>
        </Tooltip>,
      ],
      [
        'inside',
        <Popover key="popover">
          <Tooltip label="Supporting text" testID="tooltip">
            <Button testID="trigger">Open</Button>
          </Tooltip>
          <Popover.Content testID="panel">
            <Popover.Title>Headline</Popover.Title>
          </Popover.Content>
        </Popover>,
      ],
    ])(
      'describes the trigger from %s it, which still opens the popover',
      async (_, tree) => {
        await render(withScope(tree))

        await fireEvent(trigger(), 'longPress')

        expect(shown()).toBe(true)
        expect(hint()).toBe('Supporting text')

        await fireEvent.press(trigger())

        expect(screen.getByTestId('panel')).toBeTruthy()
      },
    )

    it('leaves the buttons in a modal popover it describes the trigger of untouched', async () => {
      await render(
        withScope(
          <Tooltip label="Supporting text">
            <Popover defaultOpen modal>
              <Button>Open</Button>
              <Popover.Content>
                <Popover.Title>Headline</Popover.Title>
                <Button slot="close" testID="trigger">
                  Dismiss
                </Button>
              </Popover.Content>
            </Popover>
          </Tooltip>,
        ),
      )

      expect(hint()).toBe(undefined)
    })
  })
})
