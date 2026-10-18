import type { Meta, StoryObj } from '@storybook/react'
import type { ReactNode } from 'react'

import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import type { DropEvent } from '../../drop'
import type { PickedFile } from '../../files'

import { DropZone, FileTrigger } from '.'
import { isFileDropItem } from '../../drop'
import { Button } from '../button'
import { Text } from '../text'

const IMAGES = ['image/png', 'image/jpeg']

const styles = StyleSheet.create({
  // Web's width, so the two Storybooks draw the target at one size.
  width: {
    maxWidth: 420,
    width: '100%',
  },
})

const meta = {
  args: {
    label: 'Drop a file here',
  },
  component: DropZone,
  title: 'Components/DropZone',
} satisfies Meta<typeof DropZone>

type Story = StoryObj<typeof meta>

/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- the handlers set the story's own state */

// What a screen actually builds: a target that takes a drop, with a picker
// inside it for the person who would rather press a button. On iOS and
// Android the target opens the chooser too, so both name what was picked.
function Sample() {
  const [picked, setPicked] = useState<string | undefined>(undefined)

  const onDrop = (event: DropEvent) => {
    setPicked(event.items.find(isFileDropItem)?.name ?? 'Dropped')
  }
  const onSelect = (files: readonly PickedFile[]) => {
    setPicked(files.at(0)?.name)
  }

  return (
    <DropZone label="Drop a file here" onDrop={onDrop}>
      <FileTrigger onSelect={onSelect}>
        <Button variant="outlined">Choose a file</Button>
      </FileTrigger>
      {picked === undefined ? null : (
        <Text tone="muted" variant="labelSmall">
          {picked}
        </Text>
      )}
    </DropZone>
  )
}

function Width({ children }: { readonly children: ReactNode }) {
  return <View style={styles.width}>{children}</View>
}

const Default: Story = {
  render: () => (
    <Width>
      <Sample />
    </Width>
  ),
}

// Its own story because the label is the whole of a bare target, and a
// screen that already says what it takes uses `aria-label` instead.
const Bare: Story = {
  render: (args) => (
    <Width>
      <DropZone {...args} />
    </Width>
  ),
}

// Its own story because a target that takes nothing is a state a consumer
// has to be able to look at: the fade is what says so before anything is
// dragged onto it or pressed.
const Disabled: Story = {
  args: {
    isDisabled: true,
  },
  render: (args) => (
    <Width>
      <DropZone {...args} />
    </Width>
  ),
}

// Its own story because FileTrigger draws nothing of its own, so what is seen
// is whatever it wraps, normally a Button. It needs no target near it, which
// is why the two are separate exports.
const StandalonePicker: Story = {
  render: () => (
    <FileTrigger acceptedFileTypes={IMAGES} allowsMultiple>
      <Button variant="outlined">Choose images</Button>
    </FileTrigger>
  ),
}

export { Bare, Default, Disabled, StandalonePicker }

export default meta
