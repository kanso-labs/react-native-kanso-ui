// Jest's transform, through babel-jest. The build does not read this file: it
// passes the same compiler plugin to tsdown itself, in tsdown.config.ts, so the
// suite runs what the React Compiler emits, as the published package does.
//
// The compiler is kept to the repository's own code. Jest also transforms
// Storybook's packages through this file, since they ship ESM alone, and the
// compiler has no business rewriting them.
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
  ],
  plugins: ['@babel/plugin-transform-dynamic-import'],
  presets: ['module:@react-native/babel-preset'],
}
