import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'

import { DropZone, FileTrigger } from '.'
import { Button } from '../button'

// An app with neither picker installed, as index.test.tsx is an app with
// both: an import resolves once per file, so the two cases need a file each.
jest.mock(
  'expo-document-picker',
  () => {
    throw new Error("Cannot find module 'expo-document-picker'")
  },
  { virtual: true },
)

jest.mock(
  'expo-image-picker',
  () => {
    throw new Error("Cannot find module 'expo-image-picker'")
  },
  { virtual: true },
)

const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: { locationX: 0, locationY: 0 },
}

// What the press wrote to the console, read before the spy is restored.
async function errorsOf(press: () => Promise<void>) {
  const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)

  try {
    await press()
    await settle()
    return error.mock.calls.map(([logged]) =>
      logged instanceof Error ? logged.message : String(logged),
    )
  } finally {
    error.mockRestore()
  }
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => {
      setImmediate(resolve)
    })
  })
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('without the pickers', () => {
  it('says a DropZone needs expo-document-picker, and drops nothing', async () => {
    const onDrop = jest.fn()
    await render(<DropZone label="Label" onDrop={onDrop} />)

    const errors = await errorsOf(async () => {
      await fireEvent.press(
        screen.getByRole('button', { name: 'Label' }),
        PRESS,
      )
    })

    expect(errors).toEqual([
      'Picking a file needs expo-document-picker, which is not installed',
    ])
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('says a FileTrigger’s camera needs expo-image-picker, and selects nothing', async () => {
    const onSelect = jest.fn()
    await render(
      <FileTrigger defaultCamera="user" onSelect={onSelect}>
        <Button>Label</Button>
      </FileTrigger>,
    )

    const errors = await errorsOf(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Label' }))
    })

    expect(errors).toEqual([
      'Taking a photo needs expo-image-picker, which is not installed',
    ])
    expect(onSelect).not.toHaveBeenCalled()
  })
})
