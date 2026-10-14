import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet, View } from 'react-native'

import type { SnackbarOptions, SnackbarProps } from '.'

import { Snackbar } from '.'
import { useTheme } from '../../theme/scope'
import { themedStyles } from '../../theme/styles'
import { Button } from '../button'

// One queue for the page, as kanso-ui's stories have it. A real app makes one
// where it can be reached from anywhere and mounts the snackbar once, near the
// root; a story page is the same shape at a smaller scale. Seeded below so
// the page opens with a snackbar on it rather than with three buttons and
// nothing to look at.
const messages = new Snackbar.Queue()

// Two sample actions. Their handlers do nothing, since what a story shows is
// the snackbar rather than what pressing it would do.
const noop = () => {}
const UNDO = { label: 'Undo', onPress: noop }
const RETRY = { label: 'Retry', onPress: noop }

messages.add('First item saved', { action: UNDO, timeout: 0 })

// The snackbar draws at the bottom of the screen, over whatever is there, so
// each story is framed on the Overview page, in a frame tall enough to hold
// one, rather than drawn over the stories around it.
const FRAMED = { docs: { story: { height: '240px', inline: false } } }

// A phone's width, where a strip is as wide as the screen less its margins
// and its content runs out of room first. Storybook's viewport sets the
// window the snackbar reads its size class from.
const PHONE = {
  globals: { viewport: { isRotated: false, value: 'mobile1' } },
  parameters: FRAMED,
}

const stylesOf = themedStyles(({ spacing }) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
  }),
)

const meta = {
  args: {
    queue: messages,
  },
  component: Snackbar,
  title: 'Components/Snackbar',
} satisfies Meta<typeof Snackbar>

type Story = StoryObj<typeof meta>

function clear() {
  messages.clear()
}

// A message is added outside React, so a story showing what a snackbar looks
// like carries a queue with one already in it, at the page's indefinite
// length, so the message is still there whenever the snapshot is taken.
function seeded(options: SnackbarOptions, message = 'First item saved') {
  const queue = new Snackbar.Queue()
  queue.add(message, { ...options, timeout: 0 })
  return queue
}

// The handlers the story's buttons take, built by a call rather than written
// inline at the prop, which is what react-perf's no-new-function-as-prop is
// after. Each message takes the component's own duration, which is what the
// story is there to show.
function show(message: string, options: SnackbarOptions) {
  return () => {
    messages.add(message, options)
  }
}

// A button for each kind of message, and the snackbar they show it in.
function Triggers(props: SnackbarProps) {
  const styles = stylesOf(useTheme())

  return (
    <View style={styles.row}>
      <Button onPress={show('First item saved', {})} variant="tonal">
        Show a message
      </Button>
      <Button
        onPress={show('First item removed', { action: UNDO })}
        variant="tonal"
      >
        Show an action
      </Button>
      <Button
        onPress={show('Second item could not be saved', {
          action: RETRY,
          showCloseButton: true,
        })}
        variant="tonal"
      >
        Show a close button
      </Button>
      <Button onPress={clear} variant="text">
        Clear
      </Button>
      <Snackbar {...props} />
    </View>
  )
}

const Default: Story = {
  args: { queue: seeded({}) },
  parameters: FRAMED,
}

const WithAction: Story = {
  args: { queue: seeded({ action: UNDO }) },
  parameters: FRAMED,
}

const WithCloseButton: Story = {
  args: { queue: seeded({ action: RETRY, showCloseButton: true }) },
  parameters: FRAMED,
}

// A word longer than the strip holds, a file name or an address, breaks
// inside itself rather than running under the controls and past the strip's
// edge.
const LongWord: Story = {
  ...PHONE,
  args: {
    queue: seeded(
      { action: UNDO, showCloseButton: true },
      'Supporting'.repeat(8),
    ),
  },
}

// Material Design's two-line snackbar with a longer action: an action too
// long to leave the message half the strip drops onto a line of its own
// under it, with the close button, at the trailing edge.
const LongAction: Story = {
  ...PHONE,
  args: {
    queue: seeded(
      {
        action: { label: 'Long action label', onPress: noop },
        showCloseButton: true,
      },
      'Supporting text long enough to run onto a second line of the strip',
    ),
  },
}

// Its own story because the others are seeded to stay up. Here a press adds
// the message at the component's own duration: five seconds for a bare one,
// until closed for one with an action, and held while a pointer is over it
// or one of its controls has focus.
const OnDemand: Story = {
  parameters: FRAMED,
  render: (args) => <Triggers {...args} />,
}

export { Default, LongAction, LongWord, OnDemand, WithAction, WithCloseButton }

export default meta
