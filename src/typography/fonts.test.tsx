import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { useFontFamily } from './fonts'

const STACK = ['Roboto Flex', '-apple-system', 'Segoe UI', 'sans-serif']
const MONO = ['Roboto Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace']
const SERIF = ['Roboto Serif', 'Iowan Old Style', 'Georgia', 'serif']

// The import of expo-font has to have failed before the family is final.
async function settled(families: readonly string[], weight?: number) {
  const { result } = await renderHook(() => useFontFamily(families, weight))
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

  it('draws a monospace list in iOS’s monospaced system face when its first family is not there', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios')

    expect(await settled(MONO)).toBe('ui-monospace')
  })

  it('draws a monospace list in Android’s monospace face when its first family is not there', async () => {
    jest.replaceProperty(Platform, 'OS', 'android')

    expect(await settled(MONO)).toBe('monospace')
  })

  it('draws a list naming no monospace family in the system font', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios')

    expect(await settled(SERIF)).toBe('System')
  })

  // Android draws `sans-serif` at 500 and 600 exactly as at 400.
  it.each([500, 600])(
    'draws a weight of %i in Android’s medium system face',
    async (weight) => {
      jest.replaceProperty(Platform, 'OS', 'android')

      expect(await settled(STACK, weight)).toBe('sans-serif-medium')
    },
  )

  it.each([undefined, 400, 700])(
    'draws a weight of %s in Android’s system font',
    async (weight) => {
      jest.replaceProperty(Platform, 'OS', 'android')

      expect(await settled(STACK, weight)).toBe('sans-serif')
    },
  )

  it('keeps a medium monospace list in Android’s monospace face', async () => {
    jest.replaceProperty(Platform, 'OS', 'android')

    expect(await settled(MONO, 500)).toBe('monospace')
  })

  it('draws every weight in iOS’s system font', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios')

    expect(await settled(STACK, 500)).toBe('System')
  })

  it('hands React Native Web the whole list, as CSS writes it', async () => {
    jest.replaceProperty(Platform, 'OS', 'web')

    expect(await settled(STACK)).toBe(
      "'Roboto Flex', -apple-system, 'Segoe UI', sans-serif",
    )
  })
})
