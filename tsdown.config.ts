import { codecovRollupPlugin } from '@codecov/rollup-plugin'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'tsdown'

// Where an unbundled build would put a module of @kanso-labs/kanso-ui-core.
const CORE_MODULES = 'node_modules/@kanso-labs/kanso-ui-core/dist/'

export default defineConfig({
  dts: true,
  entry: ['src/index.ts'],
  format: ['esm'],
  // The token defaults come from @kanso-labs/kanso-ui-core, a devDependency
  // no app installs, so the build writes its modules into dist. Unbundled, a
  // module from node_modules keeps its path, and `dist/kanso-ui-core/` is the
  // same file under a path that reads as this package's own rather than as a
  // dependency nested inside it — the name kanso-ui gives the same modules.
  outputOptions: (options) => ({
    ...options,
    entryFileNames: (chunk) =>
      chunk.name.startsWith(CORE_MODULES)
        ? `kanso-ui-core/${chunk.name.slice(CORE_MODULES.length)}.js`
        : '[name].js',
  }),
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
    // Last, as Codecov's own instructions ask. Codecov's rollup plugin, as in
    // kanso-ui: tsdown drives rolldown, whose plugin API is rollup's.
    //
    // `enableBundleAnalysis` is what keeps a local `npm run build` inert: the
    // token is an organisation secret, so it is unset everywhere but CI and
    // empty in a pull request from a fork, and either way the plugin then
    // neither writes its stats file nor uploads anything.
    //
    // The stats file it writes lands in dist/, which `files` in package.json
    // publishes wholesale — the plugin deletes it again once the upload
    // returns, which is what keeps it out of the tarball.
    codecovRollupPlugin({
      bundleName: 'react-native-kanso-ui',
      enableBundleAnalysis: Boolean(process.env.CODECOV_TOKEN),
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
  sourcemap: true,
  tsconfig: 'tsconfig.lib.json',
  unbundle: true,
})
