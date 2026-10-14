import { describe, expect, it } from '@jest/globals'

import { messagesFor } from '.'
import { localeOf } from '../number/locale'

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
})
