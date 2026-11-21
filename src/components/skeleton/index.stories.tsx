import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet } from 'react-native'

import { Skeleton } from '.'
import { Card } from '../card'

const styles = StyleSheet.create({
  // A row fills the column it sits in, so it needs one to have a width, and
  // no wider than the page, so a phone shows it whole.
  width: {
    maxWidth: '100%',
    width: 380,
  },
})

// Hoisted so each slot is one stable element per render, which is what
// react-perf's no-jsx-as-prop is after.
const MARK = <Skeleton.Circle />
const FIGURE = <Skeleton.Bar size="md" width={48} />

const meta = {
  component: Skeleton,
  title: 'Components/Skeleton',
} satisfies Meta<typeof Skeleton>

type Story = StoryObj<typeof meta>

// Rows at both of the list's heights, in an outlined card as a list of rows
// is drawn: one line with a mark, two lines with a mark and a figure, and
// two lines alone.
const Default: Story = {
  render: () => (
    <Card padding="none" style={styles.width} variant="outlined">
      <Skeleton>
        <Skeleton.Row leading={MARK}>
          <Skeleton.Bar size="md" width="50%" />
        </Skeleton.Row>
        <Skeleton.Row leading={MARK} lines={2} trailing={FIGURE}>
          <Skeleton.Bar size="md" width="60%" />
          <Skeleton.Bar width="40%" />
        </Skeleton.Row>
        <Skeleton.Row lines={2}>
          <Skeleton.Bar width="30%" />
          <Skeleton.Bar size="md" width="70%" />
        </Skeleton.Row>
      </Skeleton>
    </Card>
  ),
}

// A headline over rows, as a screen's first read draws its shape: the 28dp
// bar where the headline will be.
const WithHeadline: Story = {
  render: () => (
    <Card padding="none" style={styles.width} variant="outlined">
      <Skeleton>
        <Skeleton.Row>
          <Skeleton.Bar size="lg" width="70%" />
        </Skeleton.Row>
        <Skeleton.Row leading={MARK} lines={2}>
          <Skeleton.Bar size="md" width="60%" />
          <Skeleton.Bar width="40%" />
        </Skeleton.Row>
      </Skeleton>
    </Card>
  ),
}

export { Default, WithHeadline }

export default meta
