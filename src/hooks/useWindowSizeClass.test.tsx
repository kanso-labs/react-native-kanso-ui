import { afterEach, describe, expect, it } from '@jest/globals'
import { act, renderHook } from '@testing-library/react-native'
import { Dimensions } from 'react-native'

import { breakpoints } from '../tokens/defaults'
import { useWindowSizeClass, type WindowSizeClass } from './useWindowSizeClass'

// Narrowest first, whatever order the token file lists them in.
const BOUNDS = Object.entries(breakpoints).toSorted(([, a], [, b]) => a - b)

// Each class, the width a dp below the next class's bound, and that class.
const BELOW = BOUNDS.slice(1).map(([next, bound], index) => [
  BOUNDS[index][0],
  bound - 1,
  next,
])

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

// The window as the platform reports it when it changes, which is what
// `useWindowDimensions()` listens for.
function resize(width: number) {
  Dimensions.set({ ...INITIAL, window: { ...INITIAL.window, width } })
}

afterEach(() => {
  Dimensions.set(INITIAL)
})

describe('useWindowSizeClass', () => {
  it.each(BOUNDS)(
    'is %s from its lower bound, %idp',
    async (sizeClass, bound) => {
      resize(bound)
      const { result } = await renderHook(() => useWindowSizeClass())

      expect(result.current).toBe(sizeClass)
    },
  )

  it.each(BELOW)('is %s at %idp, a dp below %s', async (sizeClass, width) => {
    resize(Number(width))
    const { result } = await renderHook(() => useWindowSizeClass())

    expect(result.current).toBe(sizeClass)
  })

  it('re-renders its caller as the window changes', async () => {
    resize(breakpoints.medium - 1)
    const seen: WindowSizeClass[] = []
    await renderHook(() => {
      const sizeClass = useWindowSizeClass()
      seen.push(sizeClass)
      return sizeClass
    })

    await act(() => {
      resize(breakpoints.expanded)
    })

    expect(seen.at(0)).toBe('compact')
    expect(seen.at(-1)).toBe('expanded')
  })
})
