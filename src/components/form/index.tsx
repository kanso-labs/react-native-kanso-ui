import type { ReactNode, Ref } from 'react'

import { useImperativeHandle, useMemo, useState } from 'react'

import type {
  FormValidationBehavior,
  FormValues,
  ValidationErrors,
} from '../../form'

import {
  createRegistry,
  FIELD_VALIDATION_BEHAVIOR,
  FormContext,
  submitOf,
} from '../../form'

// No Material Design page of its own, as on web: a form is the fields inside
// it, and the text fields page is what each of them draws. The error a form
// reports lands in the field's supporting text, in the error role, under the
// box.
//
// Native has no form element, so this is a context around its fields rather
// than an element of its own. It draws nothing and lays nothing out; a Stack
// inside it is what spaces the fields. It hands each field inside it two
// things, as React Aria's Form does on web: `validationErrors`, keyed by each
// field's `name`, which is how a server's answer reaches the fields without
// any of them changing, and `validationBehavior`, which every field reads in
// place of its own. And it reserves each field's message line, so an error
// that arrives later moves nothing below the field.
//
// Native has no browser to validate or submit either, so the form does both.
// A Button with `type="submit"` inside it submits it, as does
// `requestSubmit()` on its ref, which is how the keyboard's return key does.

/** What a form's ref holds. */
type FormHandle = {
  /**
   * Submits the form, as a Button with `type="submit"` inside it does: under
   * `native` it is held back while a field blocks it, and otherwise
   * `onSubmit` is handed the values. Named after the web form's method that
   * does the same.
   */
  readonly requestSubmit: () => void
}

type FormProps = {
  readonly children?: ReactNode
  /**
   * Called with the values when the form is submitted: each field with a
   * `name` and not disabled, as the string a web form submits for it, so a
   * number field's value is its number written out, and an empty one is
   * `''`. Under `native` it is not called while a field blocks the
   * submission.
   */
  readonly onSubmit?: (values: FormValues) => void
  readonly ref?: Ref<FormHandle>
  /**
   * How the fields inside validate. `aria` marks a field invalid and shows
   * its error as soon as the field says so, through its `validate`, and
   * lets the form submit regardless. `native` holds the submission back
   * while a field is required and empty or rejected by its `validate`, shows
   * each such field's error once submission is tried, and focuses the first
   * of them.
   *
   * Under `aria`, moving focus after a server answers is the call site's.
   * Each error is announced as it appears under its field, but nothing
   * moves, because no part of the form knows a round trip happened:
   * `validationErrors` is a prop rather than an event, so a form cannot tell
   * a submission coming back from a first render that was given errors to
   * begin with. Focus the first field that came back invalid through its
   * `inputRef`, as the Async submit story does.
   * @default 'aria'
   */
  readonly validationBehavior?: FormValidationBehavior
  /**
   * Errors to show under the fields, keyed by each field's `name`, such as
   * what a server sent back: one message, or several shown as one line. A
   * field's error stays until the field is edited, and a new object shows
   * them all again.
   */
  readonly validationErrors?: ValidationErrors
}

const NO_ERRORS: ValidationErrors = {}

/**
 * A form: the fields inside it and what they are told about validation. Pass
 * `validationErrors`, an object keyed by field `name`, to show what a server
 * sent back under each field, and `validationBehavior="native"` to hold the
 * submission back while a required field is empty or a field's `validate`
 * rejects its value. A Button with `type="submit"` inside it submits it, and
 * `onSubmit` is handed the values by name.
 *
 * ```tsx
 * <Form onSubmit={(values) => save(values)}>
 *   <Stack gap="md">
 *     <TextField label="Headline" name="headline" />
 *     <Button type="submit">Save changes</Button>
 *   </Stack>
 * </Form>
 * ```
 *
 * Handing `validationErrors` back from a submission is where a reader has to
 * be told something arrived: see `validationBehavior` for what the form does
 * and what it leaves to the call site.
 *
 * A form also reserves each field's message line. A field on its own draws
 * that line only once it has something to say, so an error arriving after a
 * submit or an async check makes the field taller and moves everything below
 * it down the screen. Inside a form the line is there from the start, empty,
 * and nothing moves when it fills.
 *
 * It draws nothing, so it takes no `style`; its ref is a handle whose
 * `requestSubmit()` submits it.
 */
function Form({
  children,
  onSubmit,
  ref,
  validationBehavior = FIELD_VALIDATION_BEHAVIOR,
  validationErrors = NO_ERRORS,
}: FormProps) {
  const [registry] = useState(createRegistry)
  const requestSubmit = submitOf(registry, validationBehavior, onSubmit)
  const state = useMemo(
    () => ({ registry, requestSubmit, validationBehavior, validationErrors }),
    [registry, requestSubmit, validationBehavior, validationErrors],
  )

  useImperativeHandle(ref, () => ({ requestSubmit }), [requestSubmit])

  return <FormContext value={state}>{children}</FormContext>
}

export { Form }
export type { FormHandle, FormProps }
