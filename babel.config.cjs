// Jest's transform, through babel-jest. The build does not read this file: it
// passes the same compiler plugin to tsdown itself, in tsdown.config.ts, so the
// suite runs what the React Compiler emits, as the published package does.
//
// The compiler is kept to the repository's own code. Jest also transforms
// Storybook's packages through this file, since they ship ESM alone, and the
// compiler has no business rewriting them.
//
// The worklets plugin comes after it, as its install guide asks, and is the
// suite's and the web Storybook's, which .storybook/main.ts gives it in the
// same order. The package ships its worklets as functions marked
// `'worklet'`, and an app's own Babel runs this plugin over them, through
// babel-preset-expo or the line Reanimated's install guide adds, so the
// package never carries code compiled for one release of worklets. It is an
// override of its own, after the compiler's, because Babel appends an
// override's plugins to the list in order.
//
// React Native's preset leaves `import()` for Metro, which bundles it, and
// Jest runs a module without a bundler, so the suite turns it into a
// `require` that Jest's module registry, mocks included, can answer.
module.exports = {
  overrides: [
    {
      exclude: /node_modules/,
      plugins: [
        ['babel-plugin-react-compiler', { panicThreshold: 'all_errors' }],
      ],
    },
    {
      plugins: ['react-native-worklets/plugin'],
    },
  ],
  plugins: ['@babel/plugin-transform-dynamic-import'],
  presets: ['module:@react-native/babel-preset'],
}
