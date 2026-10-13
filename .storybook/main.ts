import type { StorybookConfig } from '@storybook/react-native-web-vite'

import styleDictionary from '@kanso-labs/unplugin-style-dictionary/vite'
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
          // latter gives.
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
      plugins: [
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
    }),
}

export default config
