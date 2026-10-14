import type { ReactNode } from 'react'
import type { ColorValue, ViewStyle } from 'react-native'

import { StyleSheet, View } from 'react-native'

import type { DemoThemeName } from './themes'

import { Avatar } from '../components/avatar'
import { Button } from '../components/button'
import { Card } from '../components/card'
import { Checkbox } from '../components/checkbox'
import { Chip } from '../components/chip'
import { ChipGroup } from '../components/chip-group'
import { CopyField } from '../components/copy-field'
import { Currency } from '../components/currency'
import { Form } from '../components/form'
import { IconButton } from '../components/icon-button'
import { Link } from '../components/link'
import { Meter } from '../components/meter'
import { NumberField } from '../components/number-field'
import { ProductIcon } from '../components/product-icon'
import { ProgressIndicator } from '../components/progress-indicator'
import { Radio, RadioGroup } from '../components/radio-group'
import { SearchField } from '../components/search-field'
import { SegmentedButton } from '../components/segmented-button'
import { Separator } from '../components/separator'
import { Stack } from '../components/stack'
import { Switch } from '../components/switch'
import { Text } from '../components/text'
import { TextField } from '../components/text-field'
import { PlusGlyph, SearchGlyph } from '../glyphs'
import { useIconStyle } from '../glyphs/icon-style'
import { useTheme } from '../theme/scope'
import { themedStyles } from '../theme/styles'
import { demoThemes } from './themes'

// The page every story under Theming renders, as on web. Those files hold a
// scheme and nothing else, so anything that differs between two of them on
// screen can only be a token one of the schemes moved, and a value written as
// a literal rather than read from the theme is the one thing that stays put.
//
// One section per component, named after the component and ordered by name,
// so the page is a list to look a component up in. A section is written as
// `Section`, which draws the rule above it along with its headline, and a new
// component is a new `Section` in its alphabetical place, with the sentence
// web's showcase gives it.

type PlaceholderProps = {
  readonly children: string
}

type SectionProps = {
  readonly children?: ReactNode
  readonly description: string
  readonly title: string
}

type ShowcaseProps = {
  /** The scheme the page names in its header: a demo scheme, or the library's dark. */
  readonly name: 'dark' | DemoThemeName
}

const AVATAR_TONES = [
  'primary',
  'secondary',
  'tertiary',
  'positive',
  'negative',
] as const

const CARD_VARIANTS = ['elevated', 'filled', 'outlined'] as const

// The chip group's selection, the second of its three chips.
const CHIP_SELECTION = ['second']

const LIBRARY_DARK = {
  description:
    "The library's own dark theme: the default tokens' dark half, with nothing overridden.",
  label: 'Dark',
}

// The icon the chips hold: web's circle half the slot across, drawn as a view
// in the colour and at the size the slot hands it.
const DOT = <Dot />

// The icon the icon buttons hold, the library's own plus, which reads its
// colour and size from the button around it.
const PLUS = <PlusGlyph />

// The text field's leading icon, the library's own search, which reads its
// colour and size from the slot it sits in.
const SEARCH = <SearchGlyph />

// Hoisted so the keys are not a new array on every render, which is what
// react-perf's no-new-array-as-prop is after.
const SEGMENT_SELECTION = ['second']

const stylesOf = themedStyles(({ colors, radii, spacing }) =>
  StyleSheet.create({
    intro: {
      gap: spacing.xxs,
    },
    // A row of an outlined card with no padding of its own, so the separator
    // section shows rules between real rows.
    item: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    page: {
      gap: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    // A dashed box for the layouts, which paint nothing of their own, so
    // what a scheme reaches in them shows as the space between boxes.
    placeholder: {
      borderColor: colors.outlineVariant,
      borderRadius: radii.md,
      borderStyle: 'dashed',
      borderWidth: 1,
      padding: spacing.md,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    section: {
      gap: spacing.lg,
    },
  }),
)

function Dot() {
  const { color, size } = useIconStyle()

  return <View style={dotOf(color, size)} />
}

function dotOf(color: ColorValue | undefined, size: number): ViewStyle {
  return {
    backgroundColor: color,
    borderRadius: size / 4,
    height: size / 2,
    width: size / 2,
  }
}

function Item({ children }: PlaceholderProps) {
  const styles = stylesOf(useTheme())

  return (
    <View style={styles.item}>
      <Text variant="bodyLarge">{children}</Text>
    </View>
  )
}

function Placeholder({ children }: PlaceholderProps) {
  const styles = stylesOf(useTheme())

  return (
    <View style={styles.placeholder}>
      <Text tone="muted" variant="bodyMedium">
        {children}
      </Text>
    </View>
  )
}

// The chip group's close targets show what a scheme does to them, and the
// page has nothing to remove a chip from.
function removeNothing() {}

// One component's entry. The rule is drawn here rather than between two
// sections at the call site, so a section is one element and the page is the
// list of them.
function Section({ children, description, title }: SectionProps) {
  const styles = stylesOf(useTheme())

  return (
    <View style={styles.section} testID="showcase-section">
      <Separator />
      <View style={styles.intro}>
        <Text role="heading" variant="titleLarge">
          {title}
        </Text>
        <Text tone="muted" variant="bodyMedium">
          {description}
        </Text>
      </View>
      {children}
    </View>
  )
}

/**
 * One page, rendered identically by every story under Theming. Only the theme
 * around it changes, so anything that differs between two of them is
 * something a token moved.
 */
function Showcase({ name }: ShowcaseProps) {
  const styles = stylesOf(useTheme())
  const { description, label } =
    name === 'dark' ? LIBRARY_DARK : demoThemes[name]

  return (
    <View style={styles.page}>
      <View style={styles.intro}>
        <Text role="heading" variant="headlineSmall">
          {label}
        </Text>
        <Text tone="muted" variant="bodyLarge">
          {description}
        </Text>
      </View>

      <Section
        description="A circle for a person, tinted from a container/on-container pair, at each tone and at both sizes, and the anonymous person a blank name draws in the on-container role."
        title="Avatar"
      >
        <View style={styles.row}>
          {AVATAR_TONES.map((tone) => (
            <Avatar key={tone} name="Ada Lovelace" tone={tone} />
          ))}
          <Avatar name="Grace Hopper" size="lg" />
          <Avatar name="" />
        </View>
      </Section>

      <Section
        description="Every variant reads its container off a colour role and its corner off the radius scale, a square button's and a selected toggle's among them, so a scheme moves all of them at once — the elevated button off its shadow scale as well."
        title="Button"
      >
        <View style={styles.row}>
          <Button>Label</Button>
          <Button variant="tonal">Label</Button>
          <Button variant="elevated">Label</Button>
          <Button variant="outlined">Label</Button>
          <Button variant="text">Label</Button>
          <Button shape="square" variant="tonal">
            Label
          </Button>
          <Button defaultSelected variant="outlined">
            Label
          </Button>
          <Button isDisabled>Label</Button>
        </View>
      </Section>

      <Section
        description="The three variants separate themselves by shadow, by a darker surface, and by a rule — one axis per variant, and a scheme can move any of them. A disabled card fades its container and what it holds."
        title="Card"
      >
        <Stack gap="md">
          {CARD_VARIANTS.map((variant) => (
            <Card key={variant} variant={variant}>
              <Stack gap="sm">
                <Text variant="titleMedium">Headline</Text>
                <Text tone="muted" variant="bodySmall">
                  Supporting line
                </Text>
              </Stack>
            </Card>
          ))}
          <Card interactive isDisabled variant="filled">
            <Stack gap="sm">
              <Text variant="titleMedium">Headline</Text>
              <Text tone="muted" variant="bodySmall">
                Supporting line
              </Text>
            </Stack>
          </Card>
        </Stack>
      </Section>

      <Section
        description="The box takes the on-surface-variant role while empty and the primary pair once marked, and the indeterminate dash takes that same pair."
        title="Checkbox"
      >
        <View style={styles.row}>
          <Checkbox>Label</Checkbox>
          <Checkbox defaultSelected>Label</Checkbox>
          <Checkbox isIndeterminate>Label</Checkbox>
          <Checkbox isDisabled>Label</Checkbox>
        </View>
      </Section>

      <Section
        description="A chip leans on the container roles, which is where a scheme's secondary family shows up; a selected one takes a pair of its own, an icon takes the primary role, and an elevated assist chip sits on the low container at elevation 1."
        title="Chip"
      >
        <View style={styles.row}>
          <Chip icon={DOT}>First item</Chip>
          <Chip defaultSelected icon={DOT}>
            Second item
          </Chip>
          <Chip>Third item</Chip>
          <Chip elevated icon={DOT} variant="assist">
            Fourth item
          </Chip>
        </View>
      </Section>

      <Section
        description="The same chip under a field label, selectable and removable, with the remove control taking the chip's own text role."
        title="ChipGroup"
      >
        <ChipGroup
          defaultSelectedKeys={CHIP_SELECTION}
          label="Label"
          onRemove={removeNothing}
          selectionMode="multiple"
        >
          <ChipGroup.Chip id="first">First item</ChipGroup.Chip>
          <ChipGroup.Chip id="second">Second item</ChipGroup.Chip>
          <ChipGroup.Chip id="third">Third item</ChipGroup.Chip>
        </ChipGroup>
      </Section>

      <Section
        description="A read-only field with the value it copies, so it draws the field's own surface and the button that sits in its trailing slot."
        title="CopyField"
      >
        <CopyField value="--kui-color-primary" />
      </Section>

      <Section
        description="An amount takes the positive or negative role from its sign, and tabular figures from the type scale, so a column of them lines up."
        title="Currency"
      >
        <View style={styles.row}>
          <Text variant="bodyLarge">
            <Currency locale="en-US" value={1240.5} />
          </Text>
          <Text variant="bodyLarge">
            <Currency currency="EUR" locale="en-US" value={-42} />
          </Text>
          <Text variant="bodyLarge">
            <Currency locale="en-US" value={0} />
          </Text>
        </View>
      </Section>

      <Section
        description="A form draws nothing and lays nothing out: it hands the fields inside it their validation behaviour, and a message it reports lands in the field's own supporting text."
        title="Form"
      >
        <Form>
          <Stack gap="md">
            <TextField defaultValue="Label" label="Label" />
            <TextField
              defaultValue="Label"
              error="Supporting line"
              label="Label"
            />
          </Stack>
        </Form>
      </Section>

      <Section
        description="The button's variants again at the icon's own size. A chosen toggle takes a second pair of roles and rests at the squarer corner."
        title="IconButton"
      >
        <View style={styles.row}>
          <IconButton aria-label="Add">{PLUS}</IconButton>
          <IconButton aria-label="Add" variant="outlined">
            {PLUS}
          </IconButton>
          <IconButton aria-label="Add" variant="tonal">
            {PLUS}
          </IconButton>
          <IconButton aria-label="Add" variant="filled">
            {PLUS}
          </IconButton>
          <IconButton aria-label="Add" defaultSelected={false}>
            {PLUS}
          </IconButton>
          <IconButton aria-label="Add" defaultSelected variant="tonal">
            {PLUS}
          </IconButton>
        </View>
      </Section>

      <Section
        description="The primary role in running text, so a scheme that moves primary moves every link on the page with it."
        title="Link"
      >
        <Text variant="bodyLarge">
          <Link href="/first">Label</Link>
        </Text>
      </Section>

      <Section
        description="The tone recolours the active indicator and the stop indicator and leaves the track, so a column of meters still shares one track."
        title="Meter"
      >
        <Meter label="Label" value={60} />
        <Meter label="Label" tone="negative" value={94} />
      </Section>

      <Section
        description="The text field's chrome around a value the field formats itself, in the tabular figures the type scale carries. The outlined box centres the value and the side-by-side steppers on one line, which a scheme's own line heights and padding move."
        title="NumberField"
      >
        <NumberField defaultValue={1234.5} label="Label" />
        <NumberField
          defaultValue={1234.5}
          label="Label"
          steppers="horizontal"
          variant="outlined"
        />
      </Section>

      <Section
        description="A rounded square for a thing, tinted from the same container/on-container pairs the avatar takes."
        title="ProductIcon"
      >
        <View style={styles.row}>
          {AVATAR_TONES.map((tone) => (
            <ProductIcon key={tone} name="Label" tone={tone} />
          ))}
          <ProductIcon name="Label" size="lg" />
        </View>
      </Section>

      <Section
        description="The active indicator takes primary and the track secondary container, linear and circular, flat and wavy alike."
        title="ProgressIndicator"
      >
        <ProgressIndicator label="Label" showValue value={60} />
        <ProgressIndicator aria-label="Label" shape="wavy" value={60} />
        <View style={styles.row}>
          <ProgressIndicator aria-label="Label" value={60} variant="circular" />
          <ProgressIndicator
            aria-label="Label"
            isIndeterminate
            variant="circular"
          />
          <ProgressIndicator
            aria-label="Label"
            shape="wavy"
            value={60}
            variant="circular"
          />
        </View>
      </Section>

      <Section
        description="The ring takes the on-surface-variant role while empty and primary once chosen, the same pair the checkbox draws."
        title="RadioGroup"
      >
        <RadioGroup defaultValue="second" label="Label">
          <Radio value="first">First item</Radio>
          <Radio value="second">Second item</Radio>
          <Radio value="third">Third item</Radio>
        </RadioGroup>
      </Section>

      <Section
        description="The field with a glyph at its leading edge, which takes the same muted role the supporting text does, and a ring in the error role once there is a message."
        title="SearchField"
      >
        <Stack gap="md">
          <SearchField label="Label" placeholder="Supporting text" />
          <SearchField
            error="Supporting line"
            label="Label"
            placeholder="Supporting text"
          />
        </Stack>
      </Section>

      <Section
        description="One container for the whole strip, with the chosen segment on a pair of its own and a rule between each pair of segments."
        title="SegmentedButton"
      >
        <SegmentedButton
          aria-label="Label"
          defaultSelectedKeys={SEGMENT_SELECTION}
        >
          <SegmentedButton.Segment id="first">
            First item
          </SegmentedButton.Segment>
          <SegmentedButton.Segment id="second">
            Second item
          </SegmentedButton.Segment>
          <SegmentedButton.Segment id="third">
            Third item
          </SegmentedButton.Segment>
        </SegmentedButton>
      </Section>

      <Section
        description="A rule is the same colour as a border, so it draws from the outline-variant role rather than one of its own. Full width, inset at the leading end, and inset at both."
        title="Separator"
      >
        <Card padding="none" variant="outlined">
          <Item>First item</Item>
          <Separator />
          <Item>Second item</Item>
          <Separator inset="start" />
          <Item>Third item</Item>
          <Separator inset="both" />
          <Item>Fourth item</Item>
        </Card>
      </Section>

      <Section
        description="One direction, one gap off the spacing scale, and nothing painted, so what a scheme reaches is the step between the boxes. The dashed outlines are the page's own."
        title="Stack"
      >
        <Stack direction="row" gap="md" wrap>
          <Placeholder>First item</Placeholder>
          <Placeholder>Second item</Placeholder>
          <Placeholder>Third item</Placeholder>
        </Stack>
      </Section>

      <Section
        description="The track takes its container while off and primary once on, with the handle on the matching on-role."
        title="Switch"
      >
        <View style={styles.row}>
          <Switch>Label</Switch>
          <Switch defaultSelected icon>
            Label
          </Switch>
        </View>
      </Section>

      <Section
        description="The scale and the tones, which is where a scheme's typeface and its semantic colour roles are read straight off."
        title="Text"
      >
        <Stack gap="sm">
          <Text variant="displaySmall">Headline</Text>
          <Text variant="headlineSmall">Headline</Text>
          <Text variant="titleLarge">Headline</Text>
          <Text variant="bodyLarge">Supporting line</Text>
          <Text variant="labelSmall">Label</Text>
        </Stack>
        <View style={styles.row}>
          <Text tone="primary">Primary</Text>
          <Text tone="muted">Muted</Text>
          <Text tone="positive">Positive</Text>
          <Text tone="negative">Negative</Text>
          <Text tone="error">Error</Text>
        </View>
      </Section>

      <Section
        description="The filled field carries its own surface, a label that floats to the top once the field holds a value, and an underline that takes the primary role while focused, or the error role once there is a message. The outlined one moves that rule to the whole box, with a notch where the label sits."
        title="TextField"
      >
        <Stack gap="md">
          <TextField defaultValue="" label="Label" />
          <TextField defaultValue="Label" label="Label" />
          <TextField
            defaultValue="01"
            description="Supporting line"
            label="Label"
            numeric
          />
          <TextField
            defaultValue="Label"
            error="Supporting line"
            label="Label"
          />
          <TextField
            characterCount
            defaultValue="Label"
            description="Supporting line"
            label="Label"
            leadingIcon={SEARCH}
            maxLength={20}
            suffix="Suffix"
          />
          <TextField defaultValue="Label" label="Label" variant="outlined" />
        </Stack>
      </Section>
    </View>
  )
}

export type { ShowcaseProps }

export default Showcase
