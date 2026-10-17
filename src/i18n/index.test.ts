import { describe, expect, it } from '@jest/globals'

import { messagesFor, resultsFor } from '.'
import { localeOf } from '../number/locale'
import { MESSAGES } from './messages'

describe('the library’s words', () => {
  it.each([
    ['en-US', 'Loading'],
    ['de-DE', 'Wird geladen'],
    ['ja-JP', '読み込み中'],
  ])('names the ring in %s', (locale, word) => {
    expect(messagesFor(locale).loading).toBe(word)
  })

  it('reads a regional locale the table lacks in its language', () => {
    expect(messagesFor('de-AT').loading).toBe('Wird geladen')
    expect(messagesFor('fr-CA').loading).toBe('Chargement')
  })

  it('keeps the region a locale names when the table has it', () => {
    expect(messagesFor('pt-PT').loading).toBe('A carregar')
    expect(messagesFor('pt-BR').loading).toBe('Carregando')
  })

  // A device's locale can say how its numbers are written, which is no reason
  // to read Portugal's words as Brazil's.
  it('sets a Unicode extension aside', () => {
    expect(messagesFor('pt-PT-u-nu-latn').loading).toBe('A carregar')
  })

  it('reads a language the table lacks in English', () => {
    expect(messagesFor('cy-GB').loading).toBe('Loading')
  })

  it('reads the device’s locale when given none', () => {
    expect(messagesFor()).toBe(messagesFor(localeOf(undefined)))
  })

  // A calendar puts the date in full where each of these says, so one that
  // lost its placeholder would name every date the same.
  it.each(Object.entries(MESSAGES))(
    'leaves room for the date in each calendar phrase in %s',
    (_locale, { calendar }) => {
      expect(calendar.dateSelected).toContain('{date}')
      expect(calendar.todayDate).toContain('{date}')
      expect(calendar.todayDateSelected).toContain('{date}')
    },
  )
})

describe('how many rows a search leaves', () => {
  it.each([
    [1, 'en-US', '1 option available.'],
    [3, 'en-US', '3 options available.'],
    [1, 'de-DE', '1 Option verfügbar.'],
    [1200, 'de-DE', '1.200 Optionen verfügbar.'],
    [2, 'ja-JP', '2 個のオプションを利用できます。'],
  ])('says %i in %s', (count, locale, words) => {
    expect(resultsFor(count, locale)).toBe(words)
  })

  // Russian's singular form is for any count ending in one but eleven, not
  // for one alone.
  it('takes the form the locale’s plural rules pick', () => {
    expect(resultsFor(21, 'ru-RU')).toBe('21 параметр доступно.')
    expect(resultsFor(11, 'ru-RU')).toBe('11 параметров доступно.')
  })

  it('says there are none in the empty row’s words', () => {
    expect(resultsFor(0, 'en-US')).toBe('No results')
    expect(resultsFor(0, 'de-DE')).toBe('Keine Ergebnisse')
  })

  // Jest replaces no function-valued property, so the runtime's own is set
  // aside by hand and put back after.
  it('takes the singular for one alone without plural rules', () => {
    const rules = Object.getOwnPropertyDescriptor(Intl, 'PluralRules')
    Object.defineProperty(Intl, 'PluralRules', {
      configurable: true,
      value: undefined,
    })

    try {
      expect(resultsFor(1, 'ru-RU')).toBe('1 параметр доступно.')
      expect(resultsFor(21, 'ru-RU')).toBe('21 параметров доступно.')
    } finally {
      if (rules !== undefined) {
        Object.defineProperty(Intl, 'PluralRules', rules)
      }
    }
  })
})
