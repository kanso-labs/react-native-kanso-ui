/** @type {import('jest').Config} */
export default {
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/tokens/defaults.ts',
  ],
  coverageReporters: ['text', 'cobertura'],
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  // The preset's own pattern, with Reanimated and worklets added: both ship
  // ES modules, which Jest runs only once Babel has transformed them, as Metro
  // does in an app.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native(-reanimated|-worklets)?|@react-native(-community)?)/)',
  ],
}
