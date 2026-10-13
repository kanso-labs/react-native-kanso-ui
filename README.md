# react-native-kanso-ui

Kanso UI's Material Design components for React Native, built on the same design
tokens and theming as
[`@kanso-labs/kanso-ui`](https://github.com/kanso-labs/kanso-ui).

A theme is the web library's: a set of `--kui-*` custom properties with values
in CSS syntax, as kanso-ui's `tokens.css` declares them, so one theme object
serves a web app and a native app alike.

The package has not been released yet.

## Theming

`ThemeScope` themes everything inside it, and takes the same props as
kanso-ui's: `theme`, a map of `--kui-*` properties to CSS values, and `scheme`,
which pins the scope to light or dark and paints its surface. Left unset, the
scheme follows the scope around it, or the device's appearance at the root. A
nested scope's map applies over its parent's.

```tsx
import { type KuiTheme, ThemeScope } from '@kanso-labs/react-native-kanso-ui'

// The same object a web app hands kanso-ui's ThemeScope.
const brand: KuiTheme = {
  '--kui-color-primary': '#006a6a',
  '--kui-radius-md': '16px',
}

export default function App() {
  return (
    <ThemeScope style={{ flex: 1 }} theme={brand}>
      <Screen />
    </ThemeScope>
  )
}
```

`useTheme()` reads the tokens in the values React Native styles take, with the
keys of kanso-ui's token modules, so `var(--kui-color-primary)` on web is
`useTheme().colors.primary` here. Lengths are in dp, durations in milliseconds,
and an easing is the four points `Easing.bezier()` takes.

A value React Native cannot evaluate, such as a `calc()` or a `color-mix()`,
keeps its property at the library's default, and a development build names it in
a warning.

The outermost `ThemeScope` also hosts what the library draws above the screen,
over everything inside it, so it belongs at the root of the app and fills it, as
the one above does. What draws there follows the scope it was opened in rather
than the root's.

## Peer dependencies

Beside `react` and `react-native`, the package needs
`react-native-safe-area-context`, whose insets keep what the library draws above
the screen clear of a notch, the status bar and the home indicator. In an Expo
app, `npx expo install react-native-safe-area-context` installs the version the
SDK ships with. The insets come from its `SafeAreaProvider`, which Expo Router
puts around an app already; elsewhere, wrap the app in one. Without it, the
library keeps to the window's edge.

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
| Tokens | `npm run tokens:build`  |

## License

[MIT](LICENSE.md)
