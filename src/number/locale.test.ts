import { afterEach, describe, expect, it, jest } from '@jest/globals'

import { localeOf } from './locale'

afterEach(() => {
  jest.restoreAllMocks()
})

describe('localeOf', () => {
  it('takes a tag the runtime knows as given', () => {
    expect(localeOf('pt-BR')).toBe('pt-BR')
  })

  it('falls back to the device for a malformed tag', () => {
    expect(localeOf('not a tag!')).toBe(localeOf(undefined))
  })

  // A calendar's grid asks for its locale once a date, so the runtime is
  // asked about a tag once rather than on every call.
  it('checks a tag once, however often it is asked for', () => {
    const supported = jest.spyOn(Intl.NumberFormat, 'supportedLocalesOf')

    for (let call = 0; call < 35; call += 1) {
      expect(localeOf('fr-CA')).toBe('fr-CA')
    }
    for (let call = 0; call < 3; call += 1) {
      expect(localeOf('also not a tag!')).toBe(localeOf(undefined))
    }

    expect(supported).toHaveBeenCalledTimes(2)
  })
})
