import { describe, expect, it } from '@jest/globals'
import { act, renderHook } from '@testing-library/react-native'

import { useClipboardAvailable, writeClipboard } from '.'

// This file installs no expo-clipboard, as an app without it has none.
describe('the clipboard without expo-clipboard', () => {
  it('reports it there until the import fails, then not', async () => {
    const seen: boolean[] = []

    await renderHook(() => {
      seen.push(useClipboardAvailable())
    })
    await act(async () => {
      await new Promise((resolve) => {
        setImmediate(resolve)
      })
    })

    expect(seen.at(0)).toBe(true)
    expect(seen.at(-1)).toBe(false)
  })

  it('rejects a write', async () => {
    await expect(writeClipboard('first')).rejects.toThrow(
      'expo-clipboard is not installed',
    )
  })
})
