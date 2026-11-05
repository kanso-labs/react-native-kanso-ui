import eslintJs from '@eslint/js'
import eslintPluginOxlint from 'eslint-plugin-oxlint'
import eslintPluginPerfectionist from 'eslint-plugin-perfectionist'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import typescriptEslint from 'typescript-eslint'

export default defineConfig([
  // `.claude/worktrees/` holds per-session checkouts of this repository, so
  // without this ESLint lints every other branch alongside the current one.
  // Flat config does not read .gitignore the way oxlint and oxfmt do, so it
  // has to be named here, and so does what the token build, Storybook and the
  // example app's Metro write.
  globalIgnores([
    '.claude',
    'coverage',
    'dist',
    'example/.expo',
    'example/.rnstorybook/storybook.requires.ts',
    'example/dist',
    'storybook-static',
  ]),
  {
    extends: [
      eslintJs.configs.recommended,
      typescriptEslint.configs.recommended,
      eslintPluginPerfectionist.configs['recommended-natural'],
      eslintPluginReactHooks.configs.flat.recommended,
    ],
    files: ['**/*.{cjs,js,mjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
    },
    rules: {
      // A type from React is imported by name rather than read off the
      // `React` namespace @types/react declares globally. The global
      // type-checks with no import at all, so a file could depend on React's
      // types without saying so anywhere a reader or a tool would look.
      'no-restricted-syntax': [
        'error',
        {
          message:
            "Import the type from 'react' by name rather than reading it off the global React namespace.",
          selector: "TSQualifiedName[left.name='React']",
        },
      ],
    },
  },
  // The configuration files at the root and the scripts run under Node.
  // Library source runs under Hermes, which has neither Node's globals nor a
  // browser's.
  {
    files: ['*.{cjs,js,ts}', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
  // The example app's Metro configuration is CommonJS, the format Metro loads
  // it in, so `require` is how it imports.
  {
    files: ['example/metro.config.js'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs',
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // The library and its stories run under Hermes, and the Hermes in Expo Go
  // has none of ES2023's copying array methods: a call to `toSorted` threw
  // "undefined is not a function" on a device, in every NumberField story,
  // while Node and Chromium, which run every check here, have it. Copy the
  // array and sort, reverse or splice the copy instead, which is why
  // `.oxlintrc.json` turns off unicorn's `no-array-sort` and
  // `no-array-reverse`: they ask for the very methods this forbids. Tests run
  // under Node alone, so they keep the methods.
  {
    files: ['example/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...['toReversed', 'toSorted', 'toSpliced', 'with'].map((property) => ({
          message:
            'Hermes in Expo Go lacks the copying array methods; copy the array and sort, reverse or splice the copy.',
          property,
        })),
      ],
    },
  },
  // safe-area-context's `SafeAreaView` pads by its nearest provider's insets
  // rather than its own overlap with the system bars, so a view below an app
  // bar or above a screen's foot took the whole screen's inset. `SafeArea` in
  // `src/safe-area` holds the view in a provider of its own, which is what
  // makes the insets its own box's.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/safe-area/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              importNames: ['SafeAreaView'],
              message:
                "SafeAreaView pads by the root provider's insets wherever it sits; use SafeArea from src/safe-area.",
              name: 'react-native-safe-area-context',
            },
          ],
        },
      ],
    },
  },
  ...eslintPluginOxlint.buildFromOxlintConfigFile('./.oxlintrc.json'),
])
