// Jest's transform, through babel-jest. The build does not read this file: it
// passes the same compiler plugin to tsdown itself, in tsdown.config.ts, so the
// suite runs what the React Compiler emits, as the published package does.
module.exports = {
  plugins: [['babel-plugin-react-compiler', { panicThreshold: 'all_errors' }]],
  presets: ['module:@react-native/babel-preset'],
}
