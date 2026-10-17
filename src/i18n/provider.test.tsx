import type { ReactElement } from 'react'

import { CalendarDate } from '@internationalized/date'
import { describe, expect, it, jest } from '@jest/globals'
import { act, render, screen } from '@testing-library/react-native'
import { Text, View } from 'react-native'

import { messagesFor } from '.'
import { Badge } from '../components/badge'
import { Button } from '../components/button'
import { Calendar } from '../components/calendar'
import { ChipGroup } from '../components/chip-group'
import { CopyField } from '../components/copy-field'
import { Currency } from '../components/currency'
import { List } from '../components/list'
import { Meter } from '../components/meter'
import { NumberField } from '../components/number-field'
import { SearchField } from '../components/search-field'
import { Snackbar } from '../components/snackbar'
import { TextField } from '../components/text-field'
import { localeOf } from '../number/locale'
import { ThemeScope } from '../theme-scope'
import { I18nProvider, useLocale } from './provider'

// The app has expo-clipboard installed, so a CopyField draws its button.
jest.mock(
  'expo-clipboard',
  () => ({ setStringAsync: async () => Promise.resolve(true) }),
  { virtual: true },
)

// A locale the runtime cannot parse, which gives way to the device's.
const MALFORMED = 'xx_YY'

const SEPTEMBER = new CalendarDate(2026, 9, 15)

function amountIn(locale: string | undefined) {
  return new Intl.NumberFormat(locale, {
    currency: 'USD',
    style: 'currency',
  }).format(1234.5)
}

// The calendar's own view, which a provider draws nothing around.
function calendarName(): unknown {
  return screen.root?.props['aria-label']
}

// What a TextField's control is told to read after its label.
function hintOf(label: string): unknown {
  return screen.getByLabelText(label).props.accessibilityHint
}

// Writes what `useLocale()` returns, so a case reads it off the screen.
function LocaleProbe() {
  const { direction, locale } = useLocale()

  return <Text testID="probe">{`${locale} ${direction}`}</Text>
}

async function renderIn(locale: string | undefined, ui: ReactElement) {
  return render(<I18nProvider locale={locale}>{ui}</I18nProvider>)
}

describe('I18nProvider', () => {
  describe('numbers', () => {
    it('writes a Currency in its locale', async () => {
      await renderIn('de-DE', <Currency testID="amount" value={1234.5} />)

      expect(screen.getByTestId('amount')).toHaveTextContent(amountIn('de-DE'))
    })

    it('writes a NumberField in its locale', async () => {
      await renderIn(
        'de-DE',
        <NumberField defaultValue={1234.5} label="Label" />,
      )

      expect(screen.getByLabelText('Label').props.value).toBe(
        new Intl.NumberFormat('de-DE').format(1234.5),
      )
    })

    it('writes a Meter in its locale', async () => {
      await renderIn('de-DE', <Meter label="Label" value={40} />)

      expect(
        screen.getByText(
          new Intl.NumberFormat('de-DE', { style: 'percent' }).format(0.4),
        ),
      ).toBeTruthy()
    })

    it('writes a Calendar’s month in its locale', async () => {
      await renderIn(
        'fr-FR',
        <Calendar aria-label="Label" defaultValue={SEPTEMBER} />,
      )

      expect(calendarName()).toBe('Label, septembre 2026')
    })

    it('writes a field’s count in its locale', async () => {
      await renderIn(
        'ar-EG',
        <TextField
          characterCount
          defaultValue="Label"
          label="Label"
          maxLength={20}
        />,
      )
      const count = new Intl.NumberFormat('ar-EG')

      expect(
        screen.getByText(`${count.format(5)}/${count.format(20)}`, {
          includeHiddenElements: true,
        }),
      ).toBeTruthy()
    })

    it('writes a badge’s count in its locale', async () => {
      await renderIn(
        'de-DE',
        <Badge count={1234} max={9999}>
          <View />
        </Badge>,
      )

      expect(
        screen.getByText(new Intl.NumberFormat('de-DE').format(1234), {
          includeHiddenElements: true,
        }),
      ).toBeTruthy()
    })
  })

  describe('a component’s own locale', () => {
    it('wins over the provider’s for a Currency', async () => {
      await renderIn(
        'de-DE',
        <Currency locale="en-US" testID="amount" value={1234.5} />,
      )

      expect(screen.getByTestId('amount')).toHaveTextContent(amountIn('en-US'))
    })

    it('wins over the provider’s for a NumberField', async () => {
      await renderIn(
        'de-DE',
        <NumberField defaultValue={1234.5} label="Label" locale="en-US" />,
      )

      expect(screen.getByLabelText('Label').props.value).toBe('1,234.5')
    })

    it('wins over the provider’s for a Meter', async () => {
      await renderIn('fr-FR', <Meter label="Label" locale="en-US" value={40} />)

      expect(screen.getByText('40%')).toBeTruthy()
    })

    it('wins over the provider’s for a Calendar', async () => {
      await renderIn(
        'fr-FR',
        <Calendar aria-label="Label" defaultValue={SEPTEMBER} locale="en-US" />,
      )

      expect(calendarName()).toBe('Label, September 2026')
    })

    // A NumberField writes its number in its own locale, so its steppers
    // are named in it too, as a Calendar's chevrons are.
    it('wins over the provider’s for a NumberField’s steppers', async () => {
      await renderIn('de-DE', <NumberField label="Label" locale="en-US" />)

      expect(screen.getByLabelText('Decrease Label')).toBeTruthy()
      expect(screen.getByLabelText('Increase Label')).toBeTruthy()
    })
  })

  describe('a component’s own words', () => {
    it('win over the provider’s for a field’s limit', async () => {
      await renderIn(
        'de-DE',
        <TextField characterLimitLabel="Label" label="Field" maxLength={20} />,
      )

      expect(hintOf('Field')).toBe('Label')
    })

    it('win over the provider’s for a CopyField', async () => {
      await renderIn(
        'de-DE',
        <CopyField
          copiedLabel="Second label"
          copyLabel="First label"
          label="Label"
          value="Label"
        />,
      )

      expect(
        screen.getByRole('button', { name: 'First label Label' }),
      ).toBeTruthy()
      expect(
        screen.getByText('Second label', { includeHiddenElements: true }),
      ).toBeTruthy()
    })

    it('win over the provider’s for a SearchField', async () => {
      await renderIn(
        'de-DE',
        <SearchField clearLabel="Clear" defaultValue="Label" label="Label" />,
      )

      expect(screen.getByLabelText('Clear')).toBeTruthy()
    })

    it('win over the provider’s for a NumberField', async () => {
      await renderIn(
        'de-DE',
        <NumberField
          decrementLabel="Fewer"
          incrementLabel="More"
          label="Label"
        />,
      )

      expect(screen.getByLabelText('Fewer')).toBeTruthy()
      expect(screen.getByLabelText('More')).toBeTruthy()
    })
  })

  describe('the library’s words', () => {
    it('names a pending Button’s ring in its locale', async () => {
      await renderIn('de-DE', <Button isPending>Label</Button>)

      expect(
        screen.getByRole('progressbar', { name: 'Wird geladen' }),
      ).toBeTruthy()
    })

    it('words an empty List in its locale', async () => {
      await renderIn('de-DE', <List aria-label="Label" />)

      expect(screen.getByText('Keine Ergebnisse')).toBeTruthy()
    })

    it('names a Calendar’s chevrons in its locale', async () => {
      await renderIn(
        'fr-FR',
        <Calendar aria-label="Label" defaultValue={SEPTEMBER} />,
      )

      expect(screen.getByRole('button', { name: 'Précédent' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Suivant' })).toBeTruthy()
    })

    it('reads a regional locale its table lacks in its language', async () => {
      await renderIn('de-AT', <List aria-label="Label" />)

      expect(screen.getByText('Keine Ergebnisse')).toBeTruthy()
    })

    it('says a field’s limit in its locale', async () => {
      await renderIn('de-DE', <TextField label="Label" maxLength={20} />)

      expect(hintOf('Label')).toBe('Bis zu 20 Zeichen')
    })

    // Arabic has six plural forms where English has two, and writes the
    // limit in its own digits.
    it.each([
      [1, 'حتى حرف واحد'],
      [2, 'حتى حرفين'],
      [3, `حتى ${new Intl.NumberFormat('ar-EG').format(3)} أحرف`],
      [20, `حتى ${new Intl.NumberFormat('ar-EG').format(20)} حرفًا`],
    ])(
      'says a limit of %i in the form Arabic gives it',
      async (maxLength, words) => {
        await renderIn(
          'ar-EG',
          <TextField label="Label" maxLength={maxLength} />,
        )

        expect(hintOf('Label')).toBe(words)
      },
    )

    it('names a CopyField’s button in its locale', async () => {
      await renderIn('de-DE', <CopyField label="Label" value="Label" />)

      expect(
        screen.getByRole('button', { name: 'Kopieren Label' }),
      ).toBeTruthy()
      // The confirmation the button is sized to hold, drawn hidden at rest.
      expect(
        screen.getByText('Kopiert', { includeHiddenElements: true }),
      ).toBeTruthy()
    })

    it('names a SearchField’s clear button in its locale', async () => {
      await renderIn(
        'de-DE',
        <SearchField defaultValue="Label" label="Label" />,
      )

      expect(screen.getByLabelText('Suche zurücksetzen')).toBeTruthy()
    })

    it('names a removable chip’s close target in its locale', async () => {
      await renderIn(
        'de-DE',
        <ChipGroup label="Label" onRemove={jest.fn()}>
          <ChipGroup.Chip id="first">First item</ChipGroup.Chip>
        </ChipGroup>,
      )

      expect(
        screen.getByRole('button', { name: 'Entfernen First item' }),
      ).toBeTruthy()
    })

    it('names a Snackbar’s close button in its locale', async () => {
      jest.useFakeTimers()
      try {
        const queue = new Snackbar.Queue()
        await renderIn(
          'de-DE',
          <ThemeScope>
            <Snackbar queue={queue} />
          </ThemeScope>,
        )
        await act(() => {
          queue.add('Label', { showCloseButton: true })
        })

        expect(screen.getByRole('button', { name: 'Schließen' })).toBeTruthy()
      } finally {
        jest.useRealTimers()
      }
    })

    // React Aria words web's steppers around the field's label, which German
    // puts first.
    it('names a NumberField’s steppers in its locale', async () => {
      await renderIn('de-DE', <NumberField label="Label" />)

      expect(screen.getByLabelText('Label verringern')).toBeTruthy()
      expect(screen.getByLabelText('Label erhöhen')).toBeTruthy()
    })
  })

  describe('the device’s locale', () => {
    it('is what a Currency writes in without a provider', async () => {
      await render(<Currency testID="amount" value={1234.5} />)

      expect(screen.getByTestId('amount')).toHaveTextContent(
        amountIn(localeOf(undefined)),
      )
    })

    it('is what a provider given no locale writes in', async () => {
      await renderIn(undefined, <Currency testID="amount" value={1234.5} />)

      expect(screen.getByTestId('amount')).toHaveTextContent(
        amountIn(localeOf(undefined)),
      )
    })

    it('stands in for a malformed one', async () => {
      await renderIn(MALFORMED, <Currency testID="amount" value={1234.5} />)

      expect(screen.getByTestId('amount')).toHaveTextContent(
        amountIn(localeOf(undefined)),
      )
    })

    it('words the library in it for a malformed one', async () => {
      await renderIn(MALFORMED, <List aria-label="Label" />)

      expect(
        screen.getByText(messagesFor(localeOf(undefined)).noResults),
      ).toBeTruthy()
    })

    // React Aria's provider does not inherit either: one given no locale
    // reads the browser's.
    it('is what an inner provider given no locale reads', async () => {
      await render(
        <I18nProvider locale="de-DE">
          <I18nProvider>
            <LocaleProbe />
          </I18nProvider>
        </I18nProvider>,
      )

      expect(screen.getByTestId('probe')).toHaveTextContent(
        `${localeOf(undefined)} ltr`,
      )
    })
  })

  describe('useLocale', () => {
    it('reads the provider’s locale and the layout’s direction', async () => {
      await renderIn('de-DE', <LocaleProbe />)

      expect(screen.getByTestId('probe')).toHaveTextContent('de-DE ltr')
    })

    it('reads the nearest provider’s locale', async () => {
      await render(
        <I18nProvider locale="de-DE">
          <I18nProvider locale="fr-FR">
            <LocaleProbe />
          </I18nProvider>
        </I18nProvider>,
      )

      expect(screen.getByTestId('probe')).toHaveTextContent('fr-FR ltr')
    })

    it('reads the device’s outside any provider', async () => {
      await render(<LocaleProbe />)

      expect(screen.getByTestId('probe')).toHaveTextContent(
        `${localeOf(undefined)} ltr`,
      )
    })
  })
})
