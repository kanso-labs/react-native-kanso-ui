import { describe, expect, it } from '@jest/globals'

import { limitFor, messagesFor, resultsFor, slideLabelFor } from '.'
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
      expect(calendar.selectedDateDescription).toContain('{date}')
    },
  )

  // A range calendar names a range by its two ends, and says it at each of
  // them, so one losing a placeholder would drop an end, or the range itself.
  it.each(Object.entries(MESSAGES))(
    'leaves room for both ends of a range in %s',
    (_locale, { calendar }) => {
      expect(calendar.dateRange).toContain('{startDate}')
      expect(calendar.dateRange).toContain('{endDate}')
      expect(calendar.selectedRangeDescription).toContain('{dateRange}')
    },
  )

  // A stepper is named around the field's label, and a limit's other form
  // is the one any count may land in, so either losing its placeholder
  // would name every field, or every limit, the same.
  it.each(Object.entries(MESSAGES))(
    'leaves room for the label and the count in %s',
    (_locale, { characterLimit, decrease, increase }) => {
      expect(decrease).toContain('{label}')
      expect(increase).toContain('{label}')
      expect(characterLimit.other).toContain('{count}')
    },
  )
})

describe('a field’s character limit', () => {
  it.each([
    [1, 'en-US', 'Up to 1 character'],
    [20, 'en-US', 'Up to 20 characters'],
    [1200, 'en-US', 'Up to 1,200 characters'],
    [1200, 'de-DE', 'Bis zu 1.200 Zeichen'],
    [3, 'ru-RU', 'Не более 3 символов'],
  ])('says %i in %s', (count, locale, words) => {
    expect(limitFor(count, locale)).toBe(words)
  })

  // Russian's singular form is for any count ending in one but eleven.
  it('takes the form the locale’s plural rules pick', () => {
    expect(limitFor(21, 'ru-RU')).toBe('Не более 21 символа')
    expect(limitFor(25, 'ru-RU')).toBe('Не более 25 символов')
  })

  // German has no singular of its own here, so every count reads `other`.
  it('takes the other form for one the locale’s entry leaves out', () => {
    expect(limitFor(1, 'de-DE')).toBe('Bis zu 1 Zeichen')
  })

  it('writes the count in the locale’s digits', () => {
    expect(limitFor(20, 'ar-EG')).toBe(
      `حتى ${new Intl.NumberFormat('ar-EG').format(20)} حرفًا`,
    )
  })

  it('reads the device’s locale when given none', () => {
    expect(limitFor(20)).toBe(limitFor(20, localeOf(undefined)))
  })

  it('takes the singular for one alone without plural rules', () => {
    const rules = Object.getOwnPropertyDescriptor(Intl, 'PluralRules')
    Object.defineProperty(Intl, 'PluralRules', {
      configurable: true,
      value: undefined,
    })

    try {
      expect(limitFor(1, 'en-US')).toBe('Up to 1 character')
      expect(limitFor(21, 'en-US')).toBe('Up to 21 characters')
    } finally {
      if (rules !== undefined) {
        Object.defineProperty(Intl, 'PluralRules', rules)
      }
    }
  })
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

describe('what a carousel’s item is called', () => {
  it.each([
    [2, 6, 'en-US', '2 of 6'],
    [2, 6, 'de-DE', '2 von 6'],
    [2, 6, 'ja-JP', '2/6'],
    [2, 6, 'zh-CN', '第 2 项，共 6 项'],
  ])('calls item %i of %i in %s', (index, count, locale, words) => {
    expect(slideLabelFor(index, count, locale)).toBe(words)
  })

  // Web writes both numbers in the locale's digits, so Egyptian Arabic's
  // place reads in Arabic-Indic ones.
  it('writes both numbers in the locale’s digits', () => {
    expect(slideLabelFor(2, 6, 'ar-EG')).toBe('٢ من ٦')
    expect(slideLabelFor(1200, 1500, 'en-US')).toBe('1,200 of 1,500')
  })
})
