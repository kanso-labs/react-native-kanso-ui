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
