import { useEffect, useState } from 'react'

import { Button, Text } from '../../src'

// The switch on the Privacy page. The counting is the manager's:
// manager-head.html loads public/analytics.js there, and this page renders in
// the preview iframe, so it reads and changes the setting through its parent
// frame, which is the same origin.

const EVENT = 'kanso-analytics'

type Analytics = {
  deny: () => void
  grant: () => void
  status: () => 'denied' | 'granted'
}

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
      <Text variant="bodyLarge">
        The setting for this browser appears here when the page is opened in the
        published Storybook.
      </Text>
    )
  }

  const { analytics, status } = state

  return (
    <>
      <Text variant="bodyLarge">
        {status === 'granted'
          ? 'Analytics is on for this Storybook in this browser.'
          : 'Analytics is off for this Storybook in this browser.'}
      </Text>
      <Button
        onPress={status === 'granted' ? analytics.deny : analytics.grant}
        variant="outlined"
      >
        {status === 'granted' ? 'Turn it off' : 'Turn it on'}
      </Button>
    </>
  )
}

function manager(): undefined | (Window & { kansoAnalytics?: Analytics }) {
  try {
    return window.parent
  } catch {
    return undefined
  }
}
