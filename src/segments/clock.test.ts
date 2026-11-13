import { afterEach, describe, expect, it, jest } from '@jest/globals'

import { fieldClockOf } from './clock'

// Reports `h24` wherever a formatter resolves to `h23` without asking for it
// through its locale, as Hermes on Android does for `hour12: false` in en-US.
function resolveAsAndroid() {
  // oxlint-disable-next-line typescript/unbound-method -- called with the formatter as `this`, through `call`
  const resolve = Intl.DateTimeFormat.prototype.resolvedOptions

  jest
    .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
    .mockImplementation(function resolved(this: Intl.DateTimeFormat) {
      const options = resolve.call(this)

      return options.hourCycle === 'h23' && !options.locale.includes('-hc-')
        ? { ...options, hourCycle: 'h24' }
        : options
    })
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('fieldClockOf', () => {
  it('hands on what it is given where a twenty-four hour clock resolves to h23', () => {
    expect(fieldClockOf('en-US', 24)).toEqual({
      hourCycle: 24,
      locale: 'en-US',
    })
    expect(fieldClockOf('en-US', 12)).toEqual({
      hourCycle: 12,
      locale: 'en-US',
    })
    expect(fieldClockOf('en-US', undefined)).toEqual({
      hourCycle: undefined,
      locale: 'en-US',
    })
  })

  it('asks for h23 through the locale where it would resolve to h24', () => {
    resolveAsAndroid()

    expect(fieldClockOf('en-US', 24)).toEqual({
      hourCycle: undefined,
      locale: 'en-US-u-hc-h23',
    })
  })

  it('keeps the extensions a locale already has, and replaces its own hour cycle', () => {
    resolveAsAndroid()

    expect(fieldClockOf('en-US-u-nu-latn', 24).locale).toBe(
      'en-US-u-hc-h23-nu-latn',
    )
    expect(fieldClockOf('en-US-u-hc-h12-nu-latn', 24).locale).toBe(
      'en-US-u-hc-h23-nu-latn',
    )
  })

  it('leaves a twelve hour clock alone wherever it resolves', () => {
    resolveAsAndroid()

    expect(fieldClockOf('en-US', 12)).toEqual({
      hourCycle: 12,
      locale: 'en-US',
    })
  })
})
