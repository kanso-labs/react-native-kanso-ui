/** @type {import('jest').Config} */
export default {
  // The library's own source. Stories, tests, the generated tokens and the
  // Theming pages are left out: the last are Storybook material that nothing
  // under src/index.ts reaches, as on web.
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.stories.tsx',
    '!src/**/*.test.{ts,tsx}',
    '!src/theming/**',
    '!src/tokens/defaults.ts',
  ],
  coverageReporters: ['text', 'cobertura'],
  preset: '@react-native/jest-preset',
  // The file `Upload test results to Codecov` hands over, beside Vitest's.
  // Jest writes no JUnit of its own, so jest-junit does; `default` stays
  // first, because naming `reporters` at all replaces the terminal output
  // rather than adding to it. `.jest/` is ignored in `.gitignore`.
  reporters: [
    'default',
    [
      'jest-junit',
      { outputDirectory: '.jest', outputName: 'test-results.junit.xml' },
    ],
  ],
  // Reanimated's own resolver, which its testing guide names: it hands Jest the
  // web implementation of Reanimated's initializers and of worklets, where the
  // preset's platforms would pick the native files, whose native module Jest
  // has none of.
  resolver: 'react-native-reanimated/jest/resolver',
  // Gesture Handler's own mocks for its native module and components, which
  // its testing guide loads before anything imports the package.
  setupFiles: ['react-native-gesture-handler/jestSetup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  // The preset's own pattern, with Gesture Handler, Reanimated, worklets and
  // Storybook's packages added: all of them ship ES modules, which Jest runs only once
  // Babel has transformed them, as Metro does in an app, and
  // src/stories.test.tsx renders every story through Storybook's.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native(-gesture-handler|-reanimated|-worklets)?|@react-native(-community)?|storybook|@storybook)/)',
  ],
}
