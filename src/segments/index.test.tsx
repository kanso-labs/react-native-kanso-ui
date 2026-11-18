import type { StyleProp, ViewStyle } from 'react-native'
import type { TestInstance } from 'test-renderer'

import { Time } from '@internationalized/date'
import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react-native'
import { Platform, StyleSheet } from 'react-native'

import { TimeField } from '../components/time-field'

const TIME = new Time(9, 30)

afterEach(() => {
  jest.restoreAllMocks()
})

// The view a time's hour is held in, the run its parts are isolated in. The
// hour is the segment that runs to 12, since its name is Arabic here.
function runOf(): TestInstance {
  const hour = screen
    .queryAllByRole(Platform.OS === 'web' ? 'spinbutton' : 'adjustable')
    .find((segment) => segment.props['aria-valuemax'] === 12)
  const run = hour?.parent ?? null
  if (run === null) {
    throw new TypeError('expected the hour inside its run')
  }
  return run
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

describe('a time’s run', () => {
  // React Native Web knows no `direction` style: held in the stylesheet, it
  // logged "Invalid style property" in every story's console and was dropped,
  // so the run was not held left to right on the web at all.
  it('is held left to right by its `dir` on the web, in a right-to-left locale', async () => {
    jest.replaceProperty(Platform, 'OS', 'web')
    await render(
      <TimeField
        defaultValue={TIME}
        granularity="minute"
        label="Label"
        locale="ar-EG"
      />,
    )

    const run = runOf()
    expect(run.props.dir).toBe('ltr')
    expect(styleOf(run).direction).toBeUndefined()
    expect(styleOf(run).flexDirection).toBe('row')
  })

  it('is held left to right by its style on iOS and Android', async () => {
    await render(
      <TimeField
        defaultValue={TIME}
        granularity="minute"
        label="Label"
        locale="ar-EG"
      />,
    )

    const run = runOf()
    expect(styleOf(run).direction).toBe('ltr')
    expect(run.props.dir).toBeUndefined()
  })
})
