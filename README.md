# react-native-kanso-ui

Kanso UI's Material Design components for React Native, built on the same design
tokens and theming as
[`@kanso-labs/kanso-ui`](https://github.com/kanso-labs/kanso-ui).

A theme is the web library's: a set of `--kui-*` custom properties with values
in CSS syntax, as kanso-ui's `tokens.css` declares them, so one theme object
serves a web app and a native app alike.

The package has not been released yet.

## Peer dependencies

Beside `react` and `react-native`, the package needs `react-native-svg`, which
draws the icons its controls show. In an Expo app,
`npx expo install react-native-svg` installs the version the SDK ships with.

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
