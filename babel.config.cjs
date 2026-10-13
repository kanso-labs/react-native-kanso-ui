// Jest's transform, through babel-jest. The build does not read this file: it
// passes the same compiler plugin to tsdown itself, in tsdown.config.ts, so the
// suite runs what the React Compiler emits, as the published package does.
//
// React Native's preset leaves `import()` for Metro, which bundles it, and
// Jest runs a module without a bundler, so the suite turns it into a
// `require` that Jest's module registry, mocks included, can answer.
module.exports = {
  plugins: [
    ['babel-plugin-react-compiler', { panicThreshold: 'all_errors' }],
    '@babel/plugin-transform-dynamic-import',
  ],
  presets: ['module:@react-native/babel-preset'],
}
