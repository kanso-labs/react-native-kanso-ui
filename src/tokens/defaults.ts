// The token defaults, from @kanso-labs/kanso-ui-core: every `--kui-*` property
// at its light and its dark value, each in CSS syntax exactly as tokens.css
// declares it, the `KuiTheme` type, and the window size class breakpoints.
// That package is the one copy of the tokens both libraries read, and this
// repository writes none of its own.
//
// It is a devDependency, so tsdown bundles what this module reaches into dist
// and an app never installs it; scripts/check-package.mjs fails a build that
// still imports it.
export { breakpoints, dark, light } from '@kanso-labs/kanso-ui-core'
export type { KuiTheme } from '@kanso-labs/kanso-ui-core'
