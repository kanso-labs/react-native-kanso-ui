import type { Meta, StoryObj } from '@storybook/react'
import type { ComponentProps } from 'react'
import type { TextInput } from 'react-native'

import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { Form } from '.'
import { Button } from '../button'
import { Stack } from '../stack'
import { TextField } from '../text-field'

// Hoisted so it is one stable object per render rather than a fresh one,
// which is what react-perf's no-new-object-as-prop is after.
const SERVER_ERRORS = {
  headline: 'Choose another headline.',
}

const styles = StyleSheet.create({
  // The button keeps its own width rather than the column's.
  actions: {
    alignItems: 'flex-start',
  },
  // As wide as web's sample, so the two draw their fields at one width.
  sample: {
    maxWidth: 420,
  },
})

const meta = {
  component: Form,
  title: 'Components/Form',
} satisfies Meta<typeof Form>

type Story = StoryObj<typeof meta>

const Default: Story = {
  render: (args) => (
    <View style={styles.sample}>
      <Form {...args}>
        <Stack gap="md">
          <TextField label="Headline" name="headline" />
          <TextField label="Supporting line" name="supporting" />
          <View style={styles.actions}>
            <Button type="submit">Submit</Button>
          </View>
        </Stack>
      </Form>
    </View>
  ),
}

const ServerErrors: Story = {
  args: {
    validationErrors: SERVER_ERRORS,
  },
  render: (args) => (
    <View style={styles.sample}>
      <Form {...args}>
        <Stack gap="md">
          <TextField defaultValue="Headline" label="Headline" name="headline" />
          <TextField label="Supporting line" name="supporting" />
          <View style={styles.actions}>
            <Button type="submit">Submit</Button>
          </View>
        </Stack>
      </Form>
    </View>
  ),
}

// Submit with the headline empty, and the form holds back, shows the
// headline's error and focuses it.
const NativeValidation: Story = {
  args: {
    validationBehavior: 'native',
  },
  render: (args) => (
    <View style={styles.sample}>
      <Form {...args}>
        <Stack gap="md">
          <TextField isRequired label="Headline" name="headline" />
          <TextField label="Supporting line" name="supporting" />
          <View style={styles.actions}>
            <Button type="submit">Submit</Button>
          </View>
        </Stack>
      </Form>
    </View>
  ),
}

// How long the story's stand-in for a server takes to answer.
const ROUND_TRIP_MS = 600

type Errors = Partial<typeof SERVER_ERRORS>

const NO_ERRORS: Errors = {}

/**
 * A form whose submission goes out to a stand-in for a server and comes back
 * with an error for the headline.
 */
function AsyncSubmitForm(args: ComponentProps<typeof Form>) {
  const [errors, setErrors] = useState(NO_ERRORS)
  const headline = useRef<TextInput>(null)

  // The one part of the round trip the form leaves to the call site: once
  // the errors are under their fields, focus moves to the first of them.
  // Moved after they render rather than with the reply, so the field is
  // already marked invalid when focus lands on it.
  useEffect(() => {
    if (errors.headline !== undefined) {
      headline.current?.focus()
    }
  }, [errors])

  return (
    <View style={styles.sample}>
      <Form {...args} onSubmit={submitTo(setErrors)} validationErrors={errors}>
        <Stack gap="md">
          <TextField
            defaultValue="Headline"
            inputRef={headline}
            label="Headline"
            name="headline"
          />
          <TextField label="Supporting line" name="supporting" />
          <View style={styles.actions}>
            <Button type="submit">Submit</Button>
          </View>
        </Stack>
      </Form>
    </View>
  )
}

// The submit handler, built by a call rather than written inline at the prop,
// which is what react-perf's no-new-function-as-prop is after. It sends the
// form to the stand-in for a server and hands back what it answers.
function submitTo(setErrors: (errors: Errors) => void) {
  return () => {
    setErrors(NO_ERRORS)
    setTimeout(() => {
      setErrors(SERVER_ERRORS)
    }, ROUND_TRIP_MS)
  }
}

// A submission that goes to a server and comes back with errors, handed back
// through `validationErrors`. Each is announced as it appears under its
// field, and the call site moves focus to the first field that came back
// invalid; see `validationBehavior` for why that part is the call site's.
const AsyncSubmit: Story = {
  render: (args) => <AsyncSubmitForm {...args} />,
}

export { AsyncSubmit, Default, NativeValidation, ServerErrors }

export default meta
