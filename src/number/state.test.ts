import { describe, expect, it, jest } from '@jest/globals'
import { act, renderHook } from '@testing-library/react-native'
import { useNumberFieldState as useReference } from 'react-stately'

import type { NumberFieldState, NumberFieldStateOptions } from './state'

import { useNumberFieldState } from './state'

type Observed = Pick<
  NumberFieldState,
  'canDecrement' | 'canIncrement' | 'inputValue' | 'numberValue'
>

// What a person does to a field: types text, which the field keeps only if
// it could still become a number, commits it, or steps it either way.
type Step = 'commit' | 'decrement' | 'increment' | { readonly type: string }

const STEPS: readonly Step[] = [
  'commit',
  'increment',
  'increment',
  'decrement',
  { type: '' },
  'commit',
  'decrement',
  { type: '12.34' },
  { type: '12,34' },
  'commit',
  { type: '-3' },
  'commit',
  { type: '-' },
  'commit',
  { type: 'abc' },
  { type: '1.2.3' },
  'commit',
  { type: '١٢' },
  'commit',
  'increment',
  { type: '999999' },
  'commit',
  'increment',
  { type: '' },
  'decrement',
  { type: '0.25' },
  'commit',
  'decrement',
  'decrement',
]

const FIELDS: readonly (Omit<NumberFieldStateOptions, 'value'> & {
  readonly name: string
  readonly value?: number
})[] = [
  { defaultValue: 1234.5, locale: 'en-US', name: 'a default value' },
  {
    defaultValue: 1234.5,
    formatOptions: { currency: 'EUR', style: 'currency' },
    locale: 'de-DE',
    name: 'a currency in German',
  },
  {
    defaultValue: 3,
    locale: 'en-US',
    maxValue: 10,
    minValue: 0,
    name: 'a range and a step',
    step: 2,
  },
  {
    defaultValue: 0.5,
    formatOptions: { style: 'percent' },
    locale: 'en-US',
    name: 'a percentage',
  },
  { defaultValue: 12, locale: 'ar-EG', name: 'Arabic digits' },
  {
    locale: 'en-US',
    name: 'a controlled value the call site keeps',
    value: 5,
  },
  {
    locale: 'fr-FR',
    maxValue: 1,
    minValue: -1,
    name: 'a fractional step in French',
    step: 0.1,
  },
  { locale: 'en-US', minValue: 5, name: 'a minimum and no value' },
  { locale: 'en-US', maxValue: -5, name: 'a maximum and no value' },
  {
    defaultValue: 2,
    formatOptions: { maximumFractionDigits: 0 },
    locale: 'en-US',
    name: 'no fraction',
  },
  { defaultValue: 4, isDisabled: true, locale: 'en-US', name: 'disabled' },
  { defaultValue: 4, isReadOnly: true, locale: 'en-US', name: 'read only' },
]

function observe(state: Observed): Observed {
  return {
    canDecrement: state.canDecrement,
    canIncrement: state.canIncrement,
    inputValue: state.inputValue,
    numberValue: state.numberValue,
  }
}

function take(
  state: NumberFieldState | ReturnType<typeof useReference>,
  step: Step,
) {
  if (step === 'commit') {
    state.commit()
  } else if (step === 'increment') {
    state.increment()
  } else if (step === 'decrement') {
    state.decrement()
  } else if (state.validate(step.type)) {
    state.setInputValue(step.type)
  }
}

describe('useNumberFieldState', () => {
  it.each(FIELDS)(
    'takes every step as React Stately’s does, with $name',
    async ({ name: _name, ...options }) => {
      const reported = { ours: [] as number[], reference: [] as number[] }
      const { result } = await renderHook(() => ({
        ours: useNumberFieldState({
          ...options,
          onChange: (value) => {
            reported.ours.push(value)
          },
        }),
        reference: useReference({
          ...options,
          onChange: (value) => {
            reported.reference.push(value)
          },
        }),
      }))

      const ours: Observed[] = [observe(result.current.ours)]
      const reference: Observed[] = [observe(result.current.reference)]
      // One step at a time, each rendered before the next is taken.
      const walk = async (index: number): Promise<void> => {
        const step = STEPS.at(index)
        if (step === undefined) {
          return
        }
        await act(() => {
          take(result.current.ours, step)
          take(result.current.reference, step)
        })
        ours.push(observe(result.current.ours))
        reference.push(observe(result.current.reference))
        await walk(index + 1)
      }
      await walk(0)

      expect(ours).toEqual(reference)
      expect(reported.ours).toEqual(reported.reference)
    },
  )

  it('shows a controlled value set from outside, over what was typed', async () => {
    const { rerender, result } = await renderHook(
      (value: number) => useNumberFieldState({ locale: 'en-US', value }),
      { initialProps: 1 },
    )

    await act(() => {
      result.current.setInputValue('7')
    })
    await rerender(1234.5)

    expect(result.current.inputValue).toBe('1,234.5')
    expect(result.current.numberValue).toBe(1234.5)
  })

  it('writes the value again when the locale or the format changes', async () => {
    const { rerender, result } = await renderHook(
      ({ currency, locale }: { currency: string; locale: string }) =>
        useNumberFieldState({
          defaultValue: 1234.5,
          formatOptions: { currency, style: 'currency' },
          locale,
        }),
      { initialProps: { currency: 'USD', locale: 'en-US' } },
    )

    expect(result.current.inputValue).toBe('$1,234.50')
    await rerender({ currency: 'USD', locale: 'de-DE' })
    expect(result.current.inputValue).toBe('1.234,50\u00a0$')
    await rerender({ currency: 'EUR', locale: 'de-DE' })
    expect(result.current.inputValue).toBe('1.234,50\u00a0€')
  })

  it('does not report a commit that leaves the value as it was', async () => {
    const onChange = jest.fn<(value: number) => void>()
    const { result } = await renderHook(() =>
      useNumberFieldState({ defaultValue: 3, locale: 'en-US', onChange }),
    )

    await act(() => {
      result.current.setInputValue('3.0')
    })
    await act(() => {
      result.current.commit()
    })

    expect(onChange).not.toHaveBeenCalled()
    expect(result.current.inputValue).toBe('3')
  })
})
