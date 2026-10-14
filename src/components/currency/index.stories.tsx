import type { Meta, StoryObj } from '@storybook/react'

import { StyleSheet } from 'react-native'

import type { CurrencyProps } from '.'

import { Currency } from '.'
import { Card } from '../card'
import { Stack } from '../stack'
import { Text } from '../text'

// Every story pins an explicit locale. Without one the component formats for
// whatever locale the device or the browser is set to, which would make what
// a story shows depend on the machine showing it.
const LOCALE = 'en-US'

// Widths chosen to differ in the integer part, since lining those up on the
// decimal point is exactly what tabular figures are for.
const LEDGER = [
  ['First item', -128.4],
  ['Second item', -1450],
  ['Third item', 62.05],
  ['Fourth item', -9.99],
] as const

const styles = StyleSheet.create({
  // Narrow enough that the label and the amount read as one row.
  ledger: {
    width: 300,
  },
})

// Currency sets no size of its own, so each amount here takes the body large
// role from the Text around it, as an amount in an app takes its row's.
function Amount(props: CurrencyProps) {
  return (
    <Text variant="bodyLarge">
      <Currency {...props} />
    </Text>
  )
}

const meta = {
  args: {
    locale: LOCALE,
    value: 42.5,
  },
  component: Currency,
  render: (args) => <Amount {...args} />,
  title: 'Components/Currency',
} satisfies Meta<typeof Currency>

type Story = StoryObj<typeof meta>

// The currencies and locales of web's stories, and Arabic as Egypt writes it
// besides: web's Storybook reaches that one through its Locale control, and
// this one has none. Its digits are Arabic-Indic, and its direction marks
// keep the sign beside the number. It opens in a right-to-left script, so
// React Native Web sets it from the right-hand edge, as it sets any such text.
const Currencies: Story = {
  render: (args) => (
    <Stack gap="md">
      <Amount {...args} currency="USD" />
      <Amount {...args} currency="EUR" locale="de-DE" />
      <Amount {...args} currency="JPY" locale="ja-JP" />
      <Amount {...args} currency="EGP" locale="ar-EG" value={-42.5} />
    </Stack>
  ),
}

const Default: Story = {}

// Size comes from the Text around it, which is the whole reason the component
// sets none: the same element reads as a hero figure inside larger type.
const Hero: Story = {
  render: (args) => (
    <Text variant="displaySmall">
      <Currency {...args} value={1284.32} />
    </Text>
  ),
}

// Tabular figures are the reason a column of amounts is readable at all, so
// the ledger is where they earn their place: the decimal points line up even
// though the integer parts are different widths. An outlined card, so the
// amounts sit on the surface role their tones are held legible on.
const InALedger: Story = {
  render: (args) => (
    <Card style={styles.ledger} variant="outlined">
      <Stack gap="sm">
        {LEDGER.map(([label, value]) => (
          <Stack align="center" direction="row" justify="between" key={label}>
            <Text variant="bodyMedium">{label}</Text>
            <Text variant="bodyMedium">
              <Currency {...args} value={value} />
            </Text>
          </Stack>
        ))}
      </Stack>
    </Card>
  ),
}

const Signs: Story = {
  render: (args) => (
    <Stack gap="md">
      <Amount {...args} sign="auto" value={42.5} />
      <Amount {...args} sign="always" value={42.5} />
      <Amount {...args} sign="never" value={-12.5} />
    </Stack>
  ),
}

// The three tones `auto` resolves to, in the order it decides them: a
// positive value, a negative one, and zero.
const Tones: Story = {
  render: (args) => (
    <Stack gap="md">
      <Amount {...args} value={42.5} />
      <Amount {...args} value={-12.5} />
      <Amount {...args} value={0} />
    </Stack>
  ),
}

export { Currencies, Default, Hero, InALedger, Signs, Tones }

export default meta
