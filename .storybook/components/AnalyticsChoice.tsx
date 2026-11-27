import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Button, Text, ThemeScope } from '../../src'

// The switch on the Privacy page. The counting is the manager's:
// manager-head.html loads https://kansolabs.org/analytics.js there, and this
// page renders in the preview iframe, so it reads and changes the setting
// through its parent frame, which is the same origin.

const EVENT = 'kanso-analytics'

const styles = StyleSheet.create({
  column: {
    alignItems: 'flex-start',
    gap: 12,
  },
})

type Analytics = {
  deny: () => void
  grant: () => void
  status: () => 'denied' | 'granted'
}

// The docs page is drawn light whatever the reader's own scheme, and nothing
// wraps MDX in the decorators that scope a story, so the switch is scoped to
// the light scheme here or it would follow the OS onto a white page.
export function AnalyticsChoice() {
  const [state, setState] = useState<{
    analytics: Analytics
    status: ReturnType<Analytics['status']>
  }>()

  useEffect(() => {
    const target = manager()
    const update = () => {
      const analytics = target?.kansoAnalytics

      if (analytics) {
        setState({ analytics, status: analytics.status() })
      }
    }

    update()
    target?.addEventListener(EVENT, update)

    return () => target?.removeEventListener(EVENT, update)
  }, [])

  if (!state) {
    return (
      <ThemeScope scheme="light">
        <Text variant="bodyLarge">
          The setting for this browser appears here when the page is opened in
          the published Storybook. If it never does there, something in this
          browser is blocking the analytics, and nothing is sent.
        </Text>
      </ThemeScope>
    )
  }

  const { analytics, status } = state
  const on = status === 'granted'

  // One button whose label follows the setting, so focus stays on it when it
  // is pressed, and a status line that is announced when it changes.
  return (
    <ThemeScope scheme="light">
      <View style={styles.column}>
        <Text accessibilityLiveRegion="polite" variant="bodyLarge">
          {on
            ? 'Analytics is on for Kanso Labs sites in this browser.'
            : 'Analytics is off for Kanso Labs sites in this browser.'}
        </Text>
        <Button
          onPress={on ? analytics.deny : analytics.grant}
          variant="outlined"
        >
          {on ? 'Turn it off' : 'Turn it on'}
        </Button>
      </View>
    </ThemeScope>
  )
}

// A parent on another origin, as in a composed Storybook, throws on any read,
// so the read that would throw is made here.
function manager(): undefined | (Window & { kansoAnalytics?: Analytics }) {
  try {
    const parent: Window & { kansoAnalytics?: Analytics } = window.parent
    return parent.location.href ? parent : undefined
  } catch {
    return undefined
  }
}
