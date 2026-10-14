import type { ReactNode } from 'react'

import { createContext, use } from 'react'
import { Linking } from 'react-native'

// A URL with a scheme of its own, such as `https:`, `mailto:`, `tel:` or an
// app's deep link, is the platform's to open rather than the app router's.
const SCHEME = /^[a-z][\d+.a-z-]*:/iu

type Navigate = (href: string) => void

const RouterContext = createContext<Navigate | null>(null)

type RouterProviderProps = {
  readonly children?: ReactNode
  /** Takes the app to the screen a pressed link's `href` names. */
  readonly navigate: Navigate
}

// `openURL` rejects when nothing on the device handles the URL, and a press
// has nobody to hand that to, so it is reported here rather than left
// unhandled.
async function openExternally(href: string) {
  try {
    await Linking.openURL(href)
  } catch (error: unknown) {
    console.warn(`Could not open ${href}`, error)
  }
}

/**
 * Sends the `href` of every link the components draw through the app's own
 * router, as React Aria's `RouterProvider` does for kanso-ui on web, so a
 * component with an `href` moves between screens rather than leaving the app.
 *
 * It takes `navigate` alone. React Aria's also takes `useHref`, which turns an
 * `href` into the one a rendered `<a>` carries, and native renders no anchor.
 *
 * ```tsx
 * const router = useRouter()
 *
 * <RouterProvider navigate={(href) => router.push(href)}>
 *   <Stack />
 * </RouterProvider>
 * ```
 */
function RouterProvider({ children, navigate }: RouterProviderProps) {
  return <RouterContext value={navigate}>{children}</RouterContext>
}

/**
 * The handler every component with an `href` presses through. Under a
 * `RouterProvider` it hands the `href` to `navigate`; without one, or for a
 * URL with a scheme of its own, it asks the platform to open it.
 */
function useOpenLink(): Navigate {
  const navigate = use(RouterContext)
  return (href) => {
    if (navigate === null || SCHEME.test(href)) {
      void openExternally(href)
    } else {
      navigate(href)
    }
  }
}

export { RouterProvider, useOpenLink }
export type { RouterProviderProps }
