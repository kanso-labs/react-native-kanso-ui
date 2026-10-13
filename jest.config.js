/** @type {import('jest').Config} */
export default {
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.stories.tsx',
    '!src/**/*.test.{ts,tsx}',
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
