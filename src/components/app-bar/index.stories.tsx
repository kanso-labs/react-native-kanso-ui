import type { Meta, StoryObj } from '@storybook/react'
import type { ViewStyle } from 'react-native'

import { ScrollView, StyleSheet, View } from 'react-native'

import type { AppBarProps } from '.'

import { AppBar } from '.'
import { ArrowBackGlyph, SearchGlyph } from '../../glyphs'
import { useAppBarScroll } from '../../hooks/useAppBarScroll'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { IconButton } from '../icon-button'
import { Stack } from '../stack'
import { Text } from '../text'

// How far the screen scrolls before the bar collapses. The figure is the
// call site's to choose.
const COLLAPSE_AFTER = 24

// The slots, hoisted so neither is a new element on every render, which is
// what react-perf's JSX rule is after. Each glyph is the library's own, at
// the 24dp the bar's layout centres in each button's target.
const LEADING = (
  <IconButton aria-label="Back">
    <ArrowBackGlyph />
  </IconButton>
)
const TRAILING = (
  <IconButton aria-label="Search">
    <SearchGlyph />
  </IconButton>
)

// One German word, as wide as a headline gets without a space to break at.
const LONG_WORD = 'Unterstützungszeilenüberschrift'

// The scrolling screen's paragraphs, enough that the bar has somewhere to
// collapse into.
const PARAGRAPHS = Array.from({ length: 12 }, (_unused, index) => index)

const styles = StyleSheet.create({
  // Narrow enough to make the headline wrap, which is what the flexible bars
  // were redesigned to handle.
  narrow: {
    width: 320,
  },
  // The scrolling screen's height, which the bar and the scroll view share.
  screen: {
    height: 420,
  },
  scroller: {
    flex: 1,
  },
})

const stylesOf = themedStyles(({ colors, radii, spacing }) =>
  StyleSheet.create({
    body: {
      gap: spacing.md,
      padding: spacing.lg,
    },
    // A frame around each sample, so a bar's own surface shows against the
    // page rather than blending into it.
    frame: {
      borderColor: colors.outlineVariant,
      borderRadius: radii.md,
      borderWidth: 1,
      overflow: 'hidden',
    },
  }),
)

type SampleProps = AppBarProps & {
  readonly label: string
}

function Sample({ label, ...props }: SampleProps) {
  const own = stylesOf(useTheme())

  return (
    <Stack gap="xs">
      <View style={own.frame}>
        <AppBar {...props} />
      </View>
      <Text tone="muted" variant="labelSmall">
        {label}
      </Text>
    </Stack>
  )
}

// Both props come off one hook, because both answer the same scroll. The
// bar is pinned: drawn above the scroll view, which its content scrolls
// beneath.
function ScrollingScreen() {
  const own = stylesOf(useTheme())
  const { collapsed, onLayout, onScroll, scrolled } = useAppBarScroll({
    collapseAfter: COLLAPSE_AFTER,
  })

  return (
    <View style={composeStyles<ViewStyle>(own.frame, styles.screen)}>
      <AppBar
        collapsed={collapsed}
        headline="Headline"
        leading={LEADING}
        onLayout={onLayout}
        pinned
        scrolled={scrolled}
        size="lg"
        subtitle="Supporting line"
        trailing={TRAILING}
      />
      {/* Focusable, so a keyboard can scroll it: its content holds nothing a
          keyboard can reach otherwise. */}
      <ScrollView
        contentContainerStyle={own.body}
        focusable
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.scroller}
      >
        {PARAGRAPHS.map((index) => (
          <Text key={index} tone="muted">
            Supporting line. Scroll this screen to watch the bar give its height
            back to the content.
          </Text>
        ))}
      </ScrollView>
    </View>
  )
}

const meta = {
  args: {
    headline: 'Headline',
    leading: LEADING,
    trailing: TRAILING,
  },
  component: AppBar,
  title: 'Components/AppBar',
} satisfies Meta<typeof AppBar>

type Story = StoryObj<typeof meta>

const Default: Story = {}

// Its own story because the flexible sizes are the ones with behaviour a
// capture of the default never reaches: a taller bar and a larger headline.
const Large: Story = {
  args: {
    size: 'lg',
    subtitle: 'Supporting line',
  },
}

// The one story that has to be driven rather than described: both props are
// controlled, so what a reader needs to see is the wiring. The device
// Storybook draws a story in a scroll view of its own, which a screen
// scrolling by itself must not sit inside, so this one opts out of it.
const Collapsing: Story = {
  parameters: { scrolls: true },
  render: () => <ScrollingScreen />,
}

// Its own story because the heights are minimums rather than fixed: in a
// window too narrow for the headline the bar grows to a second line rather
// than cutting it off, and a word wider than the room breaks inside itself
// rather than running under the trailing slot.
const LongHeadline: Story = {
  render: () => (
    <Stack gap="lg" style={styles.narrow}>
      <Sample
        headline="A headline long enough to need more than one line"
        label="lg, in a narrow window"
        leading={LEADING}
        size="lg"
      />
      <Sample
        headline={LONG_WORD}
        label="sm, one word wider than the room"
        leading={LEADING}
        trailing={TRAILING}
      />
    </Stack>
  ),
}

// Material Design's center-aligned configuration, at the small size and at
// a flexible one.
const Centered: Story = {
  render: () => (
    <Stack gap="lg">
      <Sample
        align="center"
        headline="Headline"
        label="sm, centered"
        leading={LEADING}
        trailing={TRAILING}
      />
      <Sample
        align="center"
        headline="Headline"
        label="md, centered, with a subtitle"
        leading={LEADING}
        size="md"
        subtitle="Supporting line"
        trailing={TRAILING}
      />
    </Stack>
  ),
}

export { Centered, Collapsing, Default, Large, LongHeadline }

export default meta
