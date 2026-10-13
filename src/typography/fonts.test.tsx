import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useFontFamily } from './fonts'

const STACK = ['Roboto Flex', '-apple-system', 'Segoe UI', 'sans-serif']

// The import of expo-font has to have failed before the family is final.
async function settled(families: readonly string[]) {
  const { result } = await renderHook(() => useFontFamily(families))
  await act(async () => {
    await new Promise((resolve) => {
      setImmediate(resolve)
    })
  })
  return result.current
}

afterEach(() => {
  jest.restoreAllMocks()
})

// This file installs no expo-font, as an app without it has none.
describe('useFontFamily', () => {
  it('draws in the system font when expo-font is not installed', async () => {
    expect(await settled(STACK)).toBe('System')
  })

  it('hands React Native Web the whole list, as CSS writes it', async () => {
    jest.replaceProperty(Platform, 'OS', 'web')

    expect(await settled(STACK)).toBe(
      "'Roboto Flex', -apple-system, 'Segoe UI', sans-serif",
    )
  })
})
