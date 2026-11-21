import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet } from 'react-native'

import type { KuiTheme } from '../../tokens/defaults'

import { EmptyState } from '.'
import { PersonGlyph, PlusGlyph, SearchGlyph } from '../../glyphs'
import { ThemeScope } from '../../theme-scope'
import { Card } from '../card'
import { Stack } from '../stack'

const styles = StyleSheet.create({
  // A phone's width, no wider than the page, so a phone shows it whole.
  width: {
    maxWidth: '100%',
    width: 380,
  },
})

// Hoisted so each is one stable value per render, which is what react-perf's
// JSX rules are after. The handlers do nothing, since what a story shows is
// the empty state rather than what its button would do.
const noop = () => {}
const ADD = { label: 'Label', onPress: noop }
const PERSON = <PersonGlyph />
const PLUS = <PlusGlyph />
const SEARCH = <SearchGlyph />

// A part of an app with colours of its own, as a module's scope hands them:
// the primary container pair pointed at the tertiary one, so it reads in
// either scheme.
const OWN_SCOPE: KuiTheme = {
  '--kui-color-on-primary-container': 'var(--kui-color-on-tertiary-container)',
  '--kui-color-primary-container': 'var(--kui-color-tertiary-container)',
}

const meta = {
  args: {
    action: ADD,
    description: 'Supporting line',
    icon: PLUS,
    title: 'Headline',
  },
  component: EmptyState,
  title: 'Components/EmptyState',
} satisfies Meta<typeof EmptyState>

type Story = StoryObj<typeof meta>

// A screen with nothing in it yet.
const Default: Story = {}

// A section with nothing in it yet, inside an outlined card as a list's
// section is drawn.
const Inline: Story = {
  render: () => (
    <Card padding="none" style={styles.width} variant="outlined">
      <EmptyState description="Supporting line" icon={PERSON} size="inline" />
    </Card>
  ),
}

// A list some things were in and none are left.
const Done: Story = {
  render: () => (
    <Card padding="none" style={styles.width} variant="outlined">
      <EmptyState description="Supporting line" kind="done" />
    </Card>
  ),
}

// A screen that cannot show what it was opened for.
const Status: Story = {
  args: {
    action: ADD,
    icon: SEARCH,
    kind: 'status',
  },
}

// Every kind inside a scope with colours of its own, which the marks follow.
const InAScope: Story = {
  render: () => (
    <ThemeScope theme={OWN_SCOPE}>
      <Stack gap="lg" style={styles.width}>
        <EmptyState
          action={ADD}
          description="Supporting line"
          icon={PLUS}
          title="Headline"
        />
        <EmptyState description="Supporting line" icon={PERSON} size="inline" />
        <EmptyState description="Supporting line" kind="done" />
        <EmptyState
          action={ADD}
          description="Supporting line"
          icon={SEARCH}
          kind="status"
          title="Headline"
        />
      </Stack>
    </ThemeScope>
  ),
}

export { Default, Done, InAScope, Inline, Status }

export default meta
