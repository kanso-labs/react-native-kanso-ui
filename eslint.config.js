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
  // has to be named here, and so does the generated token module.
  globalIgnores(['.claude', 'coverage', 'dist', 'src/tokens/defaults.ts']),
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
  ...eslintPluginOxlint.buildFromOxlintConfigFile('./.oxlintrc.json'),
])
