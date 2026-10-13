// Jest's transform, through babel-jest. The build does not read this file: it
// passes the same compiler plugin to tsdown itself, in tsdown.config.ts, so the
// suite runs what the React Compiler emits, as the published package does.
//
// The compiler is kept to the repository's own code. Jest also transforms
// Storybook's packages through this file, since they ship ESM alone, and the
// compiler has no business rewriting them.
module.exports = {
  overrides: [
    {
      exclude: /node_modules/,
      plugins: [
        ['babel-plugin-react-compiler', { panicThreshold: 'all_errors' }],
      ],
    },
  ],
  presets: ['module:@react-native/babel-preset'],
}
