// Jest's transform, through babel-jest. The build does not read this file: it
// passes the same compiler plugin to tsdown itself, in tsdown.config.ts, so the
// suite runs what the React Compiler emits, as the published package does.
//
// The worklets plugin comes last, as its install guide asks, and is the suite's
// alone. The package ships its worklets as functions marked `'worklet'`, and an
// app's own Babel runs this plugin over them, through babel-preset-expo or the
// line Reanimated's install guide adds, so the package never carries code
// compiled for one release of worklets.
module.exports = {
  plugins: [
    ['babel-plugin-react-compiler', { panicThreshold: 'all_errors' }],
    'react-native-worklets/plugin',
  ],
  presets: ['module:@react-native/babel-preset'],
}
