import type { StorybookConfig } from '@storybook/react-native-web-vite'

import styleDictionary from '@kanso-labs/unplugin-style-dictionary/vite'
import path from 'node:path'
import { mergeConfig } from 'vite'

import {
  registerFormats,
  styleDictionaryConfig,
} from '../scripts/build-tokens.mjs'

// The web Storybook: the library rendered by React Native Web, which is what
// the published Storybook, the a11y checks and Chromatic all read. It is a
// stand-in for iOS and Android rather than either of them, so it catches token,
// layout and contrast drift and says nothing about how a platform draws text or
// shadows. The on-device Storybook in example/ reads the same story files.
// React Native SVG's sound module, which a pressable shape requires on Android
// alone; svg-sound-module.ts says why the web needs a stand-in all the same.
// The import is relative, inside the package, where an alias never looks, so
// a resolver answers it: in the bundle of dependencies Vite builds first, and
// ahead of Vite's own resolver for a module it serves on its own.
const svgSoundModule = {
  enforce: 'pre' as const,
  name: 'svg-sound-module',
  resolveId: (source: string, importer: string | undefined) =>
    source === '../fabric/NativeSvgSoundModule' &&
    importer?.includes('react-native-svg') === true
      ? path.join(import.meta.dirname, 'svg-sound-module.ts')
      : null,
}

const config: StorybookConfig = {
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  docs: {
    // As in kanso-ui: the page autodocs writes for a component is its
    // overview, so it takes that name rather than Storybook's own "Docs".
    defaultName: 'Overview',
  },
  framework: {
    name: '@storybook/react-native-web-vite',
    options: {
      pluginReactOptions: {
        babel: {
          // The library ships what the React Compiler emits, and the suite
          // tests it, so the stories render it too. The threshold is the one
          // babel.config.cjs and tsdown.config.ts set, for the reason the
          // latter gives. It stays in the top-level list because that is the
          // one list @vitejs/plugin-react reads to pre-bundle the compiler's
          // runtime: in an override, Vite finds that import only once a story
          // is loading and reloads the page under the test run, which fails
          // whichever files were mid-import on a cold cache, as CI's is.
          //
          // Reanimated's worklets plugin runs after it, as an app's Babel
          // runs it over the package, in an override because Babel appends an
          // override's plugins to the list. Without it every animated style
          // throws under React Native Web, where Reanimated asks for the
          // plugin or a dependency array.
          overrides: [{ plugins: ['react-native-worklets/plugin'] }],
          plugins: [
            ['babel-plugin-react-compiler', { panicThreshold: 'all_errors' }],
          ],
        },
      },
    },
  },
  stories: ['../src/**/*.stories.tsx'],
  viteFinal: (vite) =>
    mergeConfig(vite, {
      optimizeDeps: { rolldownOptions: { plugins: [svgSoundModule] } },
      plugins: [
        svgSoundModule,
        // src/tokens/defaults.ts is generated and not committed, so the
        // running Storybook writes it on start and again whenever the token
        // source changes, which a bump of @kanso-labs/kanso-ui does. The
        // configuration is the one `npm run tokens:build` runs.
        styleDictionary({
          config: () => {
            registerFormats()
            return styleDictionaryConfig
          },
        }),
      ],
      resolve: {
        alias: [
          // React Native SVG's web renderer reads its assets through
          // @react-native/assets-registry, which React Native stopped
          // installing at 0.87. React Native Web keeps the registry its own
          // Image reads, so the import is pointed at that one.
          {
            find: '@react-native/assets-registry/registry',
            replacement: 'react-native-web/dist/modules/AssetRegistry',
          },
          // An optional peer the root does not install; expo-clipboard.ts says
          // why, and what stands in for it.
          {
            find: 'expo-clipboard',
            replacement: path.join(import.meta.dirname, 'expo-clipboard.ts'),
          },
          // Two more, for FileTrigger and DropZone; expo-document-picker.ts
          // says why.
          {
            find: 'expo-document-picker',
            replacement: path.join(
              import.meta.dirname,
              'expo-document-picker.ts',
            ),
          },
          {
            find: 'expo-image-picker',
            replacement: path.join(import.meta.dirname, 'expo-image-picker.ts'),
          },
          // Gesture Handler probes a class Reanimated does not export by its
          // path under src/, which is TypeScript the Babel pass here cannot
          // read, and a second copy of Reanimated beside the one the package
          // entry loads. Each such path is pointed at its compiled twin under
          // lib/module, which is the file the entry itself imports.
          {
            find: /^react-native-reanimated\/src\/(.*)$/,
            replacement: 'react-native-reanimated/lib/module/$1',
          },
        ],
      },
    }),
}

export default config
