/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 *
 * Modified by Kanso Labs: ported from React Stately's useNumberFieldState and
 * the number utilities beside it, reading values through ./parser and
 * leaving form validation to the field.
 */

import type { NumberFormatOptions } from '@internationalized/number'

import { NumberFormatter } from '@internationalized/number'
import { useMemo, useState } from 'react'

import { NumberParser } from './parser'

// The state behind NumberField: the text in its input, the number that text
// reads as, and the steps either way. It is React Stately's
// `useNumberFieldState`, which web's NumberField reads through React Aria,
// so the two take a value alike: a keystroke is kept only where the text
// could still become a number in the field's locale and format, and a
// commit, on blur or the return key, reads the text, clamps it to the
// range, snaps it to the step and rounds it as the format shows it, then
// writes it back formatted. The field's validity is its `error` alone, so
// none of React Stately's form validation comes with it.

type NumberFieldState = {
  /** Whether a decrement would lower the value, given the range and step. */
  readonly canDecrement: boolean
  /** Whether an increment would raise the value, given the range and step. */
  readonly canIncrement: boolean
  /**
   * Reads the text as a number, clamps and snaps it, reports it through
   * `onChange`, and writes it back formatted.
   */
  readonly commit: () => void
  /** Steps the value down to the step boundary below it. */
  readonly decrement: () => void
  /** Steps the value up to the step boundary above it. */
  readonly increment: () => void
  /** The text in the input, as typed until it is committed. */
  readonly inputValue: string
  /** The number the text reads as, or `NaN` while it reads as none. */
  readonly numberValue: number
  /** Sets the text in the input. */
  readonly setInputValue: (value: string) => void
  /** Whether the text could still become a number, as it is typed. */
  readonly validate: (value: string) => boolean
}

type NumberFieldStateOptions = {
  readonly defaultValue?: number | undefined
  readonly formatOptions?: NumberFormatOptions | undefined
  readonly isDisabled?: boolean | undefined
  readonly isReadOnly?: boolean | undefined
  readonly locale: string
  readonly maxValue?: number | undefined
  readonly minValue?: number | undefined
  readonly onChange?: ((value: number) => void) | undefined
  readonly step?: number | undefined
  readonly value?: null | number | undefined
}

function clamp(value: number, min = -Infinity, max = Infinity) {
  return Math.min(Math.max(value, min), max)
}

// Adds or subtracts on whole numbers when either side has a fraction, so
// 0.1 + 0.2 steps to 0.3 rather than to 0.30000000000000004.
function handleDecimalOperation(
  operator: '+' | '-',
  value1: number,
  value2: number,
) {
  let result = operator === '+' ? value1 + value2 : value1 - value2

  if (value1 % 1 !== 0 || value2 % 1 !== 0) {
    const value1Decimal = value1.toString().split('.')
    const value2Decimal = value2.toString().split('.')
    const value1DecimalLength = value1Decimal[1]?.length ?? 0
    const value2DecimalLength = value2Decimal[1]?.length ?? 0
    const multiplier = 10 ** Math.max(value1DecimalLength, value2DecimalLength)

    const whole1 = Math.round(value1 * multiplier)
    const whole2 = Math.round(value2 * multiplier)
    result = operator === '+' ? whole1 + whole2 : whole1 - whole2
    result /= multiplier
  }

  return result
}

// Shallow, since every value a format takes is a primitive.
function isEqualFormatOptions(
  a: NumberFormatOptions | undefined,
  b: NumberFormatOptions | undefined,
) {
  if (a === b) {
    return true
  }
  if (a === undefined || b === undefined) {
    return false
  }

  const bValues = new Map<string, unknown>(Object.entries(b))
  const aEntries: [string, unknown][] = Object.entries(a)
  return (
    aEntries.length === bValues.size &&
    aEntries.every(
      ([key, value]) => bValues.has(key) && bValues.get(key) === value,
    )
  )
}

// A value rounded to as many decimal places as the step has, which takes
// the floating point error off a value a step was added to.
function roundToStepPrecision(value: number, step: number) {
  let precision = 0
  const stepString = step.toString()
  const exponent = stepString.toLowerCase().indexOf('e-')

  if (exponent > 0) {
    precision = Math.abs(Math.floor(Math.log10(Math.abs(step)))) + exponent
  } else {
    const point = stepString.indexOf('.')
    if (point >= 0) {
      precision = stepString.length - point
    }
  }

  if (precision > 0) {
    const pow = 10 ** precision
    return Math.round(value * pow) / pow
  }

  return value
}

// The nearest value a whole number of steps from the minimum, or from zero
// with no minimum, inside the range.
function snapValueToStep(
  value: number,
  minValue: number | undefined,
  maxValue: number | undefined,
  step: number,
) {
  const min = Number(minValue)
  const max = Number(maxValue)
  const remainder = (value - (Number.isNaN(min) ? 0 : min)) % step
  let snapped = roundToStepPrecision(
    Math.abs(remainder) * 2 >= step
      ? value + Math.sign(remainder) * (step - Math.abs(remainder))
      : value - remainder,
    step,
  )

  if (!Number.isNaN(min)) {
    if (snapped < min) {
      snapped = min
    } else if (!Number.isNaN(max) && snapped > max) {
      snapped =
        min + Math.floor(roundToStepPrecision((max - min) / step, step)) * step
    }
  } else if (!Number.isNaN(max) && snapped > max) {
    snapped = Math.floor(roundToStepPrecision(max / step, step)) * step
  }

  return roundToStepPrecision(snapped, step)
}

/**
 * The state of a number field: what its input holds, the number that reads
 * as, and stepping and committing it. Pass `value` with `onChange` to
 * control it, or `defaultValue` to let it keep its own; `onChange` is handed
 * the committed number, `NaN` for an empty field.
 */
function useNumberFieldState({
  defaultValue: givenDefault = Number.NaN,
  formatOptions,
  isDisabled = false,
  isReadOnly = false,
  locale,
  maxValue,
  minValue,
  onChange,
  step,
  value: givenValue,
}: NumberFieldStateOptions): NumberFieldState {
  const stepless = step === undefined || Number.isNaN(step)
  const snapValue = (value: number) =>
    stepless
      ? clamp(value, minValue, maxValue)
      : snapValueToStep(value, minValue, maxValue, step)

  const nulled = givenValue === null ? Number.NaN : givenValue
  const value =
    nulled === undefined || Number.isNaN(nulled) ? nulled : snapValue(nulled)
  const defaultValue = Number.isNaN(givenDefault)
    ? givenDefault
    : snapValue(givenDefault)

  const [own, setOwn] = useState(defaultValue)
  const controlled = value !== undefined
  const numberValue = controlled ? value : own
  const setNumberValue = (next: number) => {
    if (!controlled) {
      setOwn(next)
    }
    if (!Object.is(numberValue, next)) {
      onChange?.(next)
    }
  }

  const [inputValue, setInputValue] = useState(() =>
    Number.isNaN(numberValue)
      ? ''
      : new NumberFormatter(locale, formatOptions).format(numberValue),
  )
  const parser = useMemo(
    () => new NumberParser(locale, formatOptions),
    [locale, formatOptions],
  )
  // The numbering system the text is in, which the value is written back
  // in: digits typed in another script than the locale's stay in it.
  const numberingSystem = parser.getNumberingSystem(inputValue)
  const formatter = new NumberFormatter(locale, {
    ...formatOptions,
    numberingSystem,
  })
  const format = (next: number) =>
    Number.isNaN(next) ? '' : formatter.format(next)

  // A percentage steps by a whole percent when no step is given.
  const clampStep = stepless
    ? formatter.resolvedOptions().style === 'percent'
      ? 0.01
      : 1
    : step

  // The text follows the value, the locale and the format whenever one of
  // them changes, so a controlled value set from outside is shown.
  const [previousValue, setPreviousValue] = useState(numberValue)
  const [previousLocale, setPreviousLocale] = useState(locale)
  const [previousFormat, setPreviousFormat] = useState(formatOptions)
  if (
    !Object.is(numberValue, previousValue) ||
    locale !== previousLocale ||
    !isEqualFormatOptions(formatOptions, previousFormat)
  ) {
    setInputValue(format(numberValue))
    setPreviousValue(numberValue)
    setPreviousLocale(locale)
    setPreviousFormat(formatOptions)
  }

  const parsedValue = parser.parse(inputValue)

  const commit = () => {
    // An empty field is empty.
    if (inputValue.length === 0) {
      setNumberValue(Number.NaN)
      setInputValue(value === undefined ? '' : format(numberValue))
      return
    }

    // Text that reads as no number goes back to the value.
    if (Number.isNaN(parsedValue)) {
      setInputValue(format(numberValue))
      return
    }

    // Clamped, snapped, and rounded as the format shows it.
    const next = parser.parse(format(snapValue(parsedValue)))
    setNumberValue(next)
    // A controlled value the call site keeps is what the text goes back to.
    setInputValue(format(value === undefined ? next : numberValue))
  }

  // From an empty field, the bound the step heads away from, or zero. From
  // a value, the step boundary in the step's direction: the value snapped,
  // where that moves it that way, or a step on from it.
  const safeNextStep = (operation: '+' | '-', bound = 0) => {
    if (Number.isNaN(parsedValue)) {
      return snapValueToStep(
        Number.isNaN(bound) ? 0 : bound,
        minValue,
        maxValue,
        clampStep,
      )
    }

    const snapped = snapValueToStep(parsedValue, minValue, maxValue, clampStep)
    if (
      (operation === '+' && snapped > parsedValue) ||
      (operation === '-' && snapped < parsedValue)
    ) {
      return snapped
    }

    return snapValueToStep(
      handleDecimalOperation(operation, parsedValue, clampStep),
      minValue,
      maxValue,
      clampStep,
    )
  }

  const stepTo = (next: number) => {
    // Stepping to the value the field already holds changes no state, so
    // the text, which may have been edited since, is written back here.
    if (next === numberValue) {
      setInputValue(format(next))
    }
    setNumberValue(next)
  }

  const editable = !isDisabled && !isReadOnly
  const canIncrement =
    editable &&
    (Number.isNaN(parsedValue) ||
      maxValue === undefined ||
      Number.isNaN(maxValue) ||
      snapValueToStep(parsedValue, minValue, maxValue, clampStep) >
        parsedValue ||
      handleDecimalOperation('+', parsedValue, clampStep) <= maxValue)
  const canDecrement =
    editable &&
    (Number.isNaN(parsedValue) ||
      minValue === undefined ||
      Number.isNaN(minValue) ||
      snapValueToStep(parsedValue, minValue, maxValue, clampStep) <
        parsedValue ||
      handleDecimalOperation('-', parsedValue, clampStep) >= minValue)

  return {
    canDecrement,
    canIncrement,
    commit,
    decrement: () => {
      stepTo(safeNextStep('-', maxValue))
    },
    increment: () => {
      stepTo(safeNextStep('+', minValue))
    },
    inputValue,
    numberValue: parsedValue,
    setInputValue,
    validate: (next) => parser.isValidPartialNumber(next, minValue, maxValue),
  }
}

export { useNumberFieldState }
export type { NumberFieldState, NumberFieldStateOptions }
