import type { ReactNode } from 'react'

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { renderHook } from '@testing-library/react-native'
import { Linking } from 'react-native'

import { RouterProvider, useOpenLink } from '.'

const navigate = jest.fn<(href: string) => void>()

async function press(href: string, wrapper?: typeof Routed) {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  const { result } = await renderHook(() => useOpenLink(), { wrapper })
  result.current(href)
  return openURL
}

function Routed({ children }: { readonly children: ReactNode }) {
  return <RouterProvider navigate={navigate}>{children}</RouterProvider>
}

// The preset already mocks `Linking`, and a spy on a mock is that same mock,
// so its calls outlive a restore and are cleared as well.
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
})

describe('useOpenLink', () => {
  it.each(['/second', 'second', '/list?sort=name', '#section'])(
    'routes %s through the provider',
    async (href) => {
      const openURL = await press(href, Routed)

      expect(navigate.mock.calls).toEqual([[href]])
      expect(openURL).not.toHaveBeenCalled()
    },
  )

  it.each([
    'https://example.com/second',
    'mailto:ada@example.com',
    'tel:+15550100',
    'example-app://second',
  ])('opens %s on the platform under a provider', async (href) => {
    const openURL = await press(href, Routed)

    expect(openURL.mock.calls).toEqual([[href]])
    expect(navigate).not.toHaveBeenCalled()
  })

  it.each(['/second', 'https://example.com/second'])(
    'opens %s on the platform without a provider',
    async (href) => {
      const openURL = await press(href)

      expect(openURL.mock.calls).toEqual([[href]])
    },
  )

  it('reports a URL nothing on the device opens', async () => {
    const failure = new Error('No app handles this URL')
    jest.spyOn(Linking, 'openURL').mockRejectedValue(failure)
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = await renderHook(() => useOpenLink())

    result.current('example-app://second')
    await new Promise((resolve) => {
      setImmediate(resolve)
    })

    expect(warn.mock.calls).toEqual([
      ['Could not open example-app://second', failure],
    ])
  })
})
