# react-native-kanso-ui

Kanso UI's Material Design components for React Native, built on the same design
tokens and theming as
[`@kanso-labs/kanso-ui`](https://github.com/kanso-labs/kanso-ui).

A theme is the web library's: a set of `--kui-*` custom properties with values
in CSS syntax, as kanso-ui's `tokens.css` declares them, so one theme object
serves a web app and a native app alike.

The package has not been released yet.

## Routing

A component with an `href` presses through the app's router once the app is
wrapped in `RouterProvider`, which takes the router's `navigate`. Without one,
and for any URL with a scheme of its own such as `https:` or `mailto:`, the
`href` is opened with React Native's `Linking.openURL`.

With Expo Router, the provider goes in the root layout:

```tsx
// app/_layout.tsx
import { RouterProvider } from '@kanso-labs/react-native-kanso-ui'
import { type Href, Stack, useRouter } from 'expo-router'

export default function RootLayout() {
  const router = useRouter()
  return (
    <RouterProvider navigate={(href) => router.push(href as Href)}>
      <Stack />
    </RouterProvider>
  )
}
```

The `as Href` is there for typed routes, which type `push` with the app's own
paths rather than any string.

With React Navigation, `useLinkTo` turns a path into a navigation through the
container's `linking` configuration, so the provider goes inside the container:

```tsx
import type { ReactNode } from 'react'

import { RouterProvider } from '@kanso-labs/react-native-kanso-ui'
import { NavigationContainer, useLinkTo } from '@react-navigation/native'

function Routed({ children }: { children: ReactNode }) {
  const linkTo = useLinkTo()
  return <RouterProvider navigate={linkTo}>{children}</RouterProvider>
}

export default function App() {
  return (
    <NavigationContainer linking={linking}>
      <Routed>
        <RootStack />
      </Routed>
    </NavigationContainer>
  )
}
```

## Development

Install with the Node version in `.tool-versions`:

```bash
mise exec node@"$(awk '/^nodejs/{print $2}' .tool-versions)" -- npm install
```

| Task   | Command                 |
| ------ | ----------------------- |
| Test   | `npm test`              |
| Lint   | `npm run lint`          |
| Build  | `npm run build`         |
| Verify | `npm run package:check` |

## License

[MIT](LICENSE.md)
