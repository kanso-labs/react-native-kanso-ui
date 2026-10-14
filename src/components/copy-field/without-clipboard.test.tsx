import { describe, expect, it } from '@jest/globals'
import { act, render, screen } from '@testing-library/react-native'

import { CopyField } from '.'

// This file installs no expo-clipboard, as an app without it has none, and
// the import is settled once per file, so the field with it installed is
// index.test.tsx.
describe('CopyField without expo-clipboard', () => {
  it('shows the value and no button', async () => {
    await render(<CopyField value="first.second.third" />)
    await act(async () => {
      await new Promise((resolve) => {
        setImmediate(resolve)
      })
    })

    expect(screen.getByText('first.second.third')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(
      screen.queryByText('Copy', { includeHiddenElements: true }),
    ).toBeNull()
  })
})
