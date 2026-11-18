import type { StyleProp, ViewStyle } from 'react-native'
import type { TestInstance } from 'test-renderer'

import { CalendarDate, CalendarDateTime, Time } from '@internationalized/date'
import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react-native'
import { Platform, StyleSheet } from 'react-native'

import { DateField } from '../components/date-field'
import { TimeField } from '../components/time-field'
import { scopeFor } from '../theme/scope'

const TIME = new Time(9, 30)

const { spacing } = scopeFor('light', {}).theme

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

// The literals a field draws, by their text, with the room either side.
function literals() {
  return screen
    .queryAllByText(/^[/:]$/u, { includeHiddenElements: true })
    .map((literal) => ({
      paddingHorizontal: styleOf(literal).paddingHorizontal,
      text: literal.children
        .filter((child) => typeof child === 'string')
        .join(''),
    }))
}

// React Native Web ignores `hitSlop`, so there a single digit's 13dp was its
// whole target, and with the literals drawn tight the 9 and the 30 of 9:30,
// or the 9 and the 8 of 9/8/2026, sat under 24px apart, centre to centre,
// short of what WCAG lets an undersized target lean on.
describe('the literals between segments', () => {
  it('keeps room either side on the web', async () => {
    jest.replaceProperty(Platform, 'OS', 'web')
    await render(
      <TimeField
        defaultValue={TIME}
        granularity="second"
        label="Label"
        locale="en-US"
      />,
    )

    expect(literals()).toEqual([
      { paddingHorizontal: spacing.xs, text: ':' },
      { paddingHorizontal: spacing.xs, text: ':' },
    ])
  })

  it('keeps room either side of a date’s slashes on the web', async () => {
    jest.replaceProperty(Platform, 'OS', 'web')
    await render(
      <DateField
        defaultValue={new CalendarDate(2026, 9, 8)}
        label="Label"
        locale="en-US"
      />,
    )

    expect(literals()).toEqual([
      { paddingHorizontal: spacing.xs, text: '/' },
      { paddingHorizontal: spacing.xs, text: '/' },
    ])
  })

  // The comma between a date and its time hangs off the year, as in prose,
  // and the space before the day period sets the period apart already.
  it('hangs the comma before a time off the date, and spaces no space', async () => {
    jest.replaceProperty(Platform, 'OS', 'web')
    await render(
      <DateField
        defaultValue={new CalendarDateTime(2026, 9, 8, 9, 30)}
        granularity="minute"
        label="Label"
        locale="en-US"
      />,
    )

    const comma = screen.getByText(/^,\s/u, {
      includeHiddenElements: true,
      normalizer: (text) => text,
    })
    expect(StyleSheet.flatten([comma.props.style])).toMatchObject({
      paddingEnd: spacing.xs,
    })
    expect(StyleSheet.flatten([comma.props.style])).not.toHaveProperty(
      'paddingHorizontal',
    )
    const space = screen.getByText(/^\s+$/u, {
      includeHiddenElements: true,
      normalizer: (text) => text,
    })
    expect(StyleSheet.flatten([space.props.style])).not.toHaveProperty(
      'paddingHorizontal',
    )
  })

  it('is drawn tight on iOS and Android, where each segment reaches by its hitSlop', async () => {
    await render(
      <TimeField
        defaultValue={TIME}
        granularity="minute"
        label="Label"
        locale="en-US"
      />,
    )

    expect(literals()).toEqual([{ paddingHorizontal: undefined, text: ':' }])
  })
})
