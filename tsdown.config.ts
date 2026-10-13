import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: true,
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'neutral',
  plugins: [
    // The library ships compiled by the React Compiler, because Expo and the
    // React Native CLI run it over an app's own code and never over its
    // dependencies.
    //
    // The threshold is `all_errors` rather than the default, as in kanso-ui.
    // Left to itself the compiler skips a function it cannot compile and says
    // nothing, so a component stops being memoised on an edit nobody reads as
    // a performance change.
    babel({
      plugins: [
        ['babel-plugin-react-compiler', { panicThreshold: 'all_errors' }],
      ],
    }),
  ],
  sourcemap: true,
  tsconfig: 'tsconfig.lib.json',
  unbundle: true,
})
