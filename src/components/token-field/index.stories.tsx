import type { Meta, StoryObj } from '@storybook/react'
import type { TokenFieldSegment } from 'react-stately'

import { useState } from 'react'
import { TokenFieldValue } from 'react-stately'

import { TokenField } from '.'

// What counts as a token is the call site's, which is what subclassing the
// value is for: here, a word beginning with a hash, once a space follows it,
// so a tag being typed stays text until it is finished.
class TaggedValue extends TokenFieldValue {
  protected override tokenize(text: string): TokenFieldSegment[] {
    return text
      .split(/(#[\w-]+)(?=\s)/u)
      .map((part, index): TokenFieldSegment =>
        index % 2 === 1
          ? { text: part, type: 'token' }
          : { text: part, type: 'text' },
      )
      .filter((segment) => segment.text.length > 0)
  }
}

const EMPTY = new TokenFieldValue([])
const TAGGED = new TaggedValue([
  { text: '#first', type: 'token' },
  { text: ' and ', type: 'text' },
  { text: '#second', type: 'token' },
])

// A field that tokenises as it is typed, since that is the one thing a static
// story cannot show.
function Editable() {
  const [value, setValue] = useState<TokenFieldValue>(
    () => new TaggedValue([{ text: 'Type a #tag', type: 'text' }]),
  )

  return <TokenField label="Tags" onChange={setValue} value={value} />
}

const meta = {
  args: {
    defaultValue: TAGGED,
    label: 'Label',
  },
  component: TokenField,
  title: 'Components/TokenField',
} satisfies Meta<typeof TokenField>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// The resting label on the value's line, which no populated story can show.
const Empty: Story = {
  args: { defaultValue: EMPTY },
}

const Outlined: Story = {
  args: { variant: 'outlined' },
}

const WithDescription: Story = {
  args: { description: 'Supporting line' },
}

const Invalid: Story = {
  args: { error: 'Add at least one tag' },
}

const Disabled: Story = {
  args: { isDisabled: true },
}

// Type a word beginning with a hash, then a space, and it becomes a token;
// Backspace in the empty control selects the pill before it, and a second
// takes it out. The box is the one every other field draws and the pill is
// the one Chip and ChipGroup draw; what counts as a token is the call site's,
// through the TaggedValue above.
const Editing: Story = {
  render: () => <Editable />,
}

export { Default, Disabled, Editing, Empty, Invalid, Outlined, WithDescription }

export default meta
