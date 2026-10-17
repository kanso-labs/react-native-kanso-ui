import type { Meta, StoryObj } from '@storybook/react'

import { TextArea } from '.'
import { CloseGlyph, SearchGlyph } from '../../glyphs'

const THREE_LINES = 'First line.\nSecond line.\nThird line.'
const FIVE_LINES = `${THREE_LINES}\nFourth line.\nFifth line.`

// The library's own glyphs stand in for an icon set, so the stories stay a
// demonstration of the field alone. Each reads its colour and size from the
// slot it sits in. Hoisted so each is one stable element per render, which is
// what react-perf's no-jsx-as-prop is after.
const LEADING_ICON = <SearchGlyph />
const TRAILING_ICON = <CloseGlyph />

const meta = {
  args: {
    defaultValue: THREE_LINES,
    label: 'Label',
  },
  component: TextArea,
  title: 'Components/TextArea',
} satisfies Meta<typeof TextArea>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// The resting label on the first line, which no populated story can show.
const Empty: Story = {
  args: {
    defaultValue: '',
  },
}

// Five lines in a field held at three, which scrolls the rest.
const FixedRows: Story = {
  args: {
    autosize: false,
    defaultValue: FIVE_LINES,
  },
}

const WithDescription: Story = {
  args: {
    description: 'Supporting line',
  },
}

const WithError: Story = {
  args: {
    error: 'Enter a value.',
  },
}

const Disabled: Story = {
  args: {
    isDisabled: true,
  },
}

const Outlined: Story = {
  args: {
    variant: 'outlined',
  },
}

const WithCharacterCount: Story = {
  args: {
    characterCount: true,
    maxLength: 200,
  },
}

// The icons stay centred in the box's height as it grows.
const WithIcons: Story = {
  args: {
    leadingIcon: LEADING_ICON,
    trailingIcon: TRAILING_ICON,
  },
}

export {
  Default,
  Disabled,
  Empty,
  FixedRows,
  Outlined,
  WithCharacterCount,
  WithDescription,
  WithError,
  WithIcons,
}

export default meta
