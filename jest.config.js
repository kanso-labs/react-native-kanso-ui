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
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  // The preset's own list, with Storybook's packages added: they ship ESM
  // alone, and src/stories.test.tsx renders every story through them.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|storybook|@storybook)/)',
  ],
}
