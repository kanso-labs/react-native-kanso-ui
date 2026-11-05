// What the web Storybook resolves `react-native-keyboard-controller` to,
// through the alias in main.ts. The package is an optional peer with a native
// half the browser has none of, so the root does not install it. The library
// reads it on Android alone, and the browser draws no software keyboard over
// the page, so there is nothing to report: a listener is taken and never
// called.
const KeyboardEvents = {
  addListener: () => ({ remove: () => undefined }),
}

export { KeyboardEvents }
