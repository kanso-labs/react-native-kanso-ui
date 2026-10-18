import type { Meta, StoryObj } from '@storybook/react'

import { LoadingIndicator } from '.'

const meta = {
  args: {
    'aria-label': 'Label',
  },
  component: LoadingIndicator,
  title: 'Components/LoadingIndicator',
} satisfies Meta<typeof LoadingIndicator>

type Story = StoryObj<typeof meta>

// On its primary container circle, as drawn over content.
const Contained: Story = {
  args: {
    contained: true,
  },
}

const Default: Story = {}

export { Contained, Default }

export default meta
