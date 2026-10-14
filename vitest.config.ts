import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

// The web Storybook's stories, run in Chromium through Storybook's Vitest
// addon, which is where addon-a11y fails a story: the preview sets its `test`
// to 'error', so a contrast or labelling violation in what React Native Web
// draws fails `npm run test:storybook`. Jest renders the same stories through
// React Native's own host components in `npm test`; this run is the one with a
// browser, so it is the one that can measure colour and read the accessibility
// tree.
//
// The plugin builds the Vite configuration from .storybook/main.ts, the token
// plugin and the React Compiler included, so the stories run exactly as the
// Storybook serves them. `test:storybook` passes `--mode development` for the
// same reason: React Native Web's Vite plugin sets `__DEV__` from the mode, and
// under Vitest's own `test` mode it is false, which turns off every check a
// library makes only in development, so a story that throws in the Storybook
// on one of them would pass a run in `test` mode.
export default defineConfig({
  plugins: [
    storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
  ],
  test: {
    browser: {
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }],
      provider: playwright(),
    },
    name: 'storybook',
    // The file `Upload test results to Codecov` hands over, beside Jest's.
    // `default` stays in the list because naming `reporters` at all replaces
    // the terminal output rather than adding to it.
    outputFile: { junit: '.vitest/test-results.junit.xml' },
    reporters: ['default', 'junit'],
  },
})
