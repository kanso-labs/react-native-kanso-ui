import { jest } from '@jest/globals'

// Worklets runs functions on a native runtime that Jest does not have, so the
// suite takes the mock its testing guide recommends, and Reanimated's own
// JavaScript implementation runs over it as it does on web.
jest.mock('react-native-worklets', () =>
  jest.requireActual('react-native-worklets/src/mock'),
)
