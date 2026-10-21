// The demo schemes, which exist to be looked at, as on web: Storybook material
// rather than library API, since nothing under src/index.ts reaches them, and
// what they document is the shape of a theme rather than a palette anyone
// should ship.
//
// They are @kanso-labs/kanso-ui-core's seven, the same ones kanso-ui's
// Storybook renders, so the two showcases draw the same schemes. Each is a
// `--kui-*` map, the one a consumer would hand either library's ThemeScope.
//
// **Every colour is stated.** The scope fills a property a map leaves out from
// the library's defaults in the scheme around it, so a colour left out would
// take its light or dark value from the device's appearance. No other group
// differs between the schemes, so a partial map over the others reads the
// same everywhere. src/theming/themes.test.ts holds them to that, and to
// values the resolver can read.
//
// Every pair a component renders clears WCAG AA, 4.5:1 for text and 3:1 for
// the outline rule, the bar the library's own tokens hold to. The a11y check
// fails the Theming stories otherwise.

export type { DemoTheme, DemoThemeName } from '@kanso-labs/kanso-ui-core/themes'
export { demoThemes } from '@kanso-labs/kanso-ui-core/themes'
