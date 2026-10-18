import type { RefObject } from 'react'

import { createContext, use, useEffect, useId, useRef, useState } from 'react'

// What a Form tells the fields inside it, and what each field tells it back,
// as React Aria's Form and its fields do through context on web. The form
// hands down how its fields validate and the errors a server sent back, by
// field name. Each field registers with the form around it while it is
// mounted, in the order the tree mounts them, which is the order they are
// drawn in, and the form reads that list when it is submitted: the values by
// name, and under `native` which fields hold it back and which of them takes
// focus.

type FieldValidationOptions<T> = {
  /**
   * A second name the field submits a value under, beside `name`'s, with
   * that value, as a date range picker submits its end beside its start.
   * The form's `validationErrors` reach the field under either name.
   */
  readonly alongside?: readonly [name: string | undefined, submitted: string]
  /** The control a failed native submission focuses. */
  readonly control: RefObject<Focusable | null>
  /** The field's own error, which wins over anything the form says. */
  readonly error: string | undefined
  readonly isDisabled: boolean
  /** Whether the value is what a required field must not be left as. */
  readonly isEmpty: boolean
  readonly isReadOnly: boolean
  readonly isRequired: boolean
  readonly name: string | undefined
  /**
   * The value as the form submits it: one string, a list of them for a field
   * holding several, as a checkbox group does, or `undefined` for a field
   * that submits nothing.
   */
  readonly submitted: FormValues[string] | undefined
  readonly validate: ((value: T) => ValidationResult) | undefined
  readonly value: T
}

/** What a failed native submission moves focus to: a field's control. */
type Focusable = {
  readonly focus: () => void
}

/** What a field tells the form it is in, as of its last render. */
type FormEntry = {
  /** Whether the field holds a native submission back. */
  readonly blocks: boolean
  /** Moves focus to the field's control. */
  readonly focus: () => void
  /** Shows the field's own error, once a submission it held back is tried. */
  readonly show: () => void
  /** The names and values the field submits: none, one, or a range's two. */
  readonly submits: readonly (readonly [string, FormValues[string]])[]
}

type FormRegistry = {
  readonly entries: () => readonly FormEntry[]
  readonly remove: (id: string) => void
  readonly set: (id: string, entry: FormEntry) => void
}

type FormState = {
  readonly registry: FormRegistry
  readonly requestSubmit: () => void
  readonly validationBehavior: FormValidationBehavior
  readonly validationErrors: ValidationErrors
}

/**
 * `aria` shows a field's error as soon as the field says so, and lets the
 * form submit regardless. `native` holds the form back while a field in it is
 * required and empty, or rejected by its `validate`, and shows that field's
 * error once a submission is tried.
 */
type FormValidationBehavior = 'aria' | 'native'

/**
 * The values a form submits by each field's `name`: a string, or a list of
 * them for a field holding several, as a checkbox group does.
 */
type FormValues = Readonly<Record<string, readonly string[] | string>>

/** A field's problem in words: one message, or several read as one line. */
type ValidationError = readonly string[] | string

/** Errors keyed by each field's `name`, such as a server's answer. */
type ValidationErrors = Readonly<Record<string, ValidationError>>

/**
 * What a field's `validate` returns for a value: its problem in words, or
 * `true`, `null` or `undefined` where there is none, as on web.
 */
type ValidationResult = null | true | undefined | ValidationError

/**
 * What a field outside a form, and a form told nothing, validates by. The
 * library shows its own message under a field, so an error shows as the
 * field reports it rather than once a submission is tried.
 */
const FIELD_VALIDATION_BEHAVIOR: FormValidationBehavior = 'aria'

/** The error a required field left empty shows under `native`. */
const REQUIRED_ERROR = 'Fill out this field.'

const NO_ERRORS: ValidationErrors = {}

const NO_MESSAGES: readonly string[] = []

// What a field with no second name submits beside its first: nothing.
const NO_SUBMISSION = [undefined, undefined] as const

const NO_SUBMISSIONS: FormEntry['submits'] = []

const FormContext = createContext<FormState | null>(null)

/**
 * The fields a form holds, in the order they registered. A field that is
 * already in it keeps its place as it reports again, so the order is the one
 * they mounted in.
 */
function createRegistry(): FormRegistry {
  const fields = new Map<string, FormEntry>()

  return {
    entries: () => [...fields.values()],
    remove: (id) => {
      fields.delete(id)
    },
    set: (id, entry) => {
      fields.set(id, entry)
    },
  }
}

// Focuses a field's control, through the ref the field holds it in.
function focusOf(control: RefObject<Focusable | null>) {
  return () => {
    control.current?.focus()
  }
}

// One line of a field's messages, or nothing where there are none.
function lineOf(messages: readonly string[]): string | undefined {
  return messages.length === 0 ? undefined : messages.join(' ')
}

// A validation result as the messages it holds.
function messagesOf(result: ValidationResult): readonly string[] {
  if (typeof result === 'string') {
    return result === '' ? NO_MESSAGES : [result]
  }

  return result === null || result === undefined || result === true
    ? NO_MESSAGES
    : result
}

/**
 * Submits a form: under `native`, holds it back while any field blocks,
 * showing each blocking field's error and focusing the first, and otherwise
 * hands `onSubmit` every named field's value.
 */
function submitOf(
  registry: FormRegistry,
  validationBehavior: FormValidationBehavior,
  onSubmit: ((values: FormValues) => void) | undefined,
) {
  return () => {
    const entries = registry.entries()

    if (validationBehavior === 'native') {
      const blocking = entries.filter((entry) => entry.blocks)
      const first = blocking.at(0)

      if (first !== undefined) {
        for (const entry of blocking) {
          entry.show()
        }
        first.focus()
        return
      }
    }

    onSubmit?.(Object.fromEntries(entries.flatMap((entry) => entry.submits)))
  }
}

/**
 * A field's validation, as React Aria's is on web, and its place in the form
 * around it. It hands back the error the field shows, and two handlers the
 * field calls: `onEdit` as its value is edited, and `onBlur` as its control
 * loses focus.
 *
 * The error is the field's own `error` where it has one. Otherwise it is the
 * server's, from the form's `validationErrors` under the field's `name`,
 * until the field is edited; a new `validationErrors` from the form shows it
 * again. Otherwise, under `aria`, it is what `validate` says about the value
 * as it changes.
 *
 * Under `native` that last one, or the required field's own error when it is
 * empty, is shown late and taken back early, as on web: once a submission it
 * holds back is tried, or once the control loses focus after an edit, and no
 * longer once the value is right, so a field shows nothing new in the middle
 * of being typed in. A disabled or read-only field holds nothing back, and a
 * disabled one submits nothing, as a browser bars both from validation and
 * leaves a disabled input out of what a form submits.
 */
function useFieldValidation<T>({
  alongside,
  control,
  error,
  isDisabled,
  isEmpty,
  isReadOnly,
  isRequired,
  name,
  submitted,
  validate,
  value,
}: FieldValidationOptions<T>) {
  const form = use(FormContext)
  const id = useId()
  const behavior = form?.validationBehavior ?? FIELD_VALIDATION_BEHAVIOR
  const serverErrors = form?.validationErrors ?? NO_ERRORS
  const registry = form?.registry
  // The errors object the field was edited under. Its server error stays
  // cleared until the form is handed a new one.
  const [clearedFrom, setClearedFrom] = useState<null | ValidationErrors>(null)
  const [showing, setShowing] = useState(false)
  // Whether the value has been edited since the control last lost focus,
  // which is when a browser fires `change`, and so when React Aria commits.
  const edited = useRef(false)
  const native = behavior === 'native'
  const barred = isDisabled || isReadOnly
  const submissions = [[name, submitted], alongside ?? NO_SUBMISSION] as const
  const server =
    clearedFrom === serverErrors
      ? NO_MESSAGES
      : submissions.flatMap(([each]) =>
          each === undefined ? NO_MESSAGES : messagesOf(serverErrors[each]),
        )
  const client =
    validate === undefined ? NO_MESSAGES : messagesOf(validate(value))
  const own =
    client.length > 0
      ? client
      : native && isRequired && isEmpty && !barred
        ? [REQUIRED_ERROR]
        : NO_MESSAGES

  // Taken back as soon as the value is right, however it got there.
  if (showing && own.length === 0) {
    setShowing(false)
  }

  const shown = native ? (showing ? own : NO_MESSAGES) : client
  const entry: FormEntry = {
    blocks:
      !barred && (error !== undefined || server.length > 0 || own.length > 0),
    focus: focusOf(control),
    show: () => {
      setShowing(true)
    },
    submits: isDisabled
      ? NO_SUBMISSIONS
      : submissions.flatMap(([each, sent]) =>
          each === undefined || sent === undefined ? [] : [[each, sent]],
        ),
  }

  // Reported after every render, so the form reads what the field shows.
  useEffect(() => {
    registry?.set(id, entry)
  })

  useEffect(
    () => () => {
      registry?.remove(id)
    },
    [id, registry],
  )

  return {
    error: error ?? lineOf(server) ?? lineOf(shown),
    onBlur: () => {
      if (edited.current) {
        edited.current = false
        setClearedFrom(serverErrors)
        setShowing(native)
      }
    },
    onEdit: () => {
      edited.current = true
      setClearedFrom(serverErrors)
    },
  }
}

/** Whether the field is inside a form, which keeps its message line drawn. */
function useInsideForm() {
  return use(FormContext) !== null
}

export {
  createRegistry,
  FIELD_VALIDATION_BEHAVIOR,
  FormContext,
  submitOf,
  useFieldValidation,
  useInsideForm,
}
export type {
  Focusable,
  FormValidationBehavior,
  FormValues,
  ValidationError,
  ValidationErrors,
  ValidationResult,
}
