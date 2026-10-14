/** @type {import('jest').Config} */
export default {
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/tokens/defaults.ts',
  ],
  coverageReporters: ['text', 'cobertura'],
  preset: '@react-native/jest-preset',
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
}
