import type { ReactNode } from 'react'
import type { ColorValue, ViewStyle } from 'react-native'

import { CalendarDate } from '@internationalized/date'
import { StyleSheet, View } from 'react-native'

import type { DemoThemeName } from './themes'

import { AppBar } from '../components/app-bar'
import { Autocomplete } from '../components/autocomplete'
import { Avatar } from '../components/avatar'
import { Badge } from '../components/badge'
import { Breadcrumbs } from '../components/breadcrumbs'
import { Button } from '../components/button'
import { ButtonGroup } from '../components/button-group'
import { Calendar } from '../components/calendar'
import { Card } from '../components/card'
import { Checkbox } from '../components/checkbox'
import { CheckboxGroup } from '../components/checkbox-group'
import { Chip } from '../components/chip'
import { ChipGroup } from '../components/chip-group'
import { Code } from '../components/code'
import { Container } from '../components/container'
import { CopyField } from '../components/copy-field'
import { Currency } from '../components/currency'
import { Dialog } from '../components/dialog'
import { Disclosure } from '../components/disclosure'
import { DisclosureGroup } from '../components/disclosure-group'
import { Fab } from '../components/fab'
import { FabMenu } from '../components/fab-menu'
import { Feed } from '../components/feed'
import { Form } from '../components/form'
import { IconButton } from '../components/icon-button'
import { Keycap } from '../components/keycap'
import { Link } from '../components/link'
import { List } from '../components/list'
import { ListBox } from '../components/list-box'
import { ListDetail } from '../components/list-detail'
import { ListItem } from '../components/list-item'
import { Menu } from '../components/menu'
import { Meter } from '../components/meter'
import { NavigationBar } from '../components/navigation-bar'
import { NavigationRail } from '../components/navigation-rail'
import { NumberField } from '../components/number-field'
import { Popover } from '../components/popover'
import { ProductIcon } from '../components/product-icon'
import { ProgressIndicator } from '../components/progress-indicator'
import { Radio, RadioGroup } from '../components/radio-group'
import { SearchField } from '../components/search-field'
import { SegmentedButton } from '../components/segmented-button'
import { Select } from '../components/select'
import { Separator } from '../components/separator'
import { Sheet } from '../components/sheet'
import { Slider } from '../components/slider'
import { Snackbar } from '../components/snackbar'
import { SplitButton } from '../components/split-button'
import { Stack } from '../components/stack'
import { SupportingPane } from '../components/supporting-pane'
import { Switch } from '../components/switch'
import { Tabs } from '../components/tabs'
import { Tag } from '../components/tag'
import { Text } from '../components/text'
import { TextArea } from '../components/text-area'
import { TextField } from '../components/text-field'
import { Toolbar } from '../components/toolbar'
import { Tooltip } from '../components/tooltip'
import {
  ArrowBackGlyph,
  CloseGlyph,
  PersonGlyph,
  PlusGlyph,
  SearchGlyph,
} from '../glyphs'
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

// The calendar's month, fixed so every scheme's page reads the same whenever
// it is opened, and before today, so no outline moves into it.
const CALENDAR_DATE = new CalendarDate(2026, 9, 15)

// The button group's selection, the first of its two buttons.
const BUTTON_GROUP_SELECTION = ['first']

const CARD_VARIANTS = ['elevated', 'filled', 'outlined'] as const

// The checkbox group's selection, the second of its three checkboxes.
const CHECKBOX_SELECTION = ['second']

// The chip group's selection, the second of its three chips.
const CHIP_SELECTION = ['second']

// The disclosure group's open section, the first of its two.
const DISCLOSURE_GROUP_SELECTION = ['first']

const TABS = ['First item', 'Second item', 'Third item'] as const
const TAG_TONES = ['primary', 'positive', 'negative', 'neutral'] as const

const LIBRARY_DARK = {
  description:
    "The library's own dark theme: the default tokens' dark half, with nothing overridden.",
  label: 'Dark',
}

// The badges' icon buttons' icons, the library's own person glyph under the
// small dot and under a count.
const BADGED = (
  <Badge>
    <PersonGlyph />
  </Badge>
)

const BADGED_COUNT = (
  <Badge count={3}>
    <PersonGlyph />
  </Badge>
)

// The dialog's close button's icon, the library's own close glyph.
const CLOSE = <CloseGlyph />

// The icon the chips hold: web's circle half the slot across, drawn as a view
// in the colour and at the size the slot hands it.
const DOT = <Dot />

// The icon the icon buttons hold, the library's own plus, which reads its
// colour and size from the button around it.
const PLUS = <PlusGlyph />

// The text field's leading icon, the library's own search, which reads its
// colour and size from the slot it sits in.
const SEARCH = <SearchGlyph />

// The bar at the top of the page, its leading and trailing icon buttons
// hoisted for the same reason.
const BAR_LEADING = (
  <IconButton aria-label="Back">
    <ArrowBackGlyph />
  </IconButton>
)
const BAR_TRAILING = (
  <IconButton aria-label="Search">
    <SearchGlyph />
  </IconButton>
)

// Hoisted so the keys are not a new array on every render, which is what
// react-perf's no-new-array-as-prop is after.
const LIST_SELECTION = ['second']
const SEGMENT_SELECTION = ['second']

// The Select section's options, an array since a select reads its options
// straight off it, and hoisted for the same reason.
const SELECT_OPTIONS = [
  <ListBox.Item id="first" key="first">
    First item
  </ListBox.Item>,
  <ListBox.Item id="second" key="second">
    Second item
  </ListBox.Item>,
  <ListBox.Item id="third" key="third">
    Third item
  </ListBox.Item>,
]

// The ListItem section's rows, web's three people with an amount each, their
// slots hoisted so no prop is a new element on every render.
const LIST_ROWS = [
  {
    leading: <Avatar decorative name="Ada Lovelace" tone="primary" />,
    name: 'Ada Lovelace',
    trailing: <Currency locale="en-US" value={1240.5} />,
  },
  {
    leading: <Avatar decorative name="Grace Hopper" tone="secondary" />,
    name: 'Grace Hopper',
    trailing: <Currency locale="en-US" value={-86.2} />,
  },
  {
    leading: <Avatar decorative name="Alan Turing" tone="tertiary" />,
    name: 'Alan Turing',
    trailing: <Currency locale="en-US" value={0} />,
  },
] as const

// The ListDetail section's two panes, hoisted for the same reason.
const LIST_DETAIL_DETAIL = <Placeholder>Detail</Placeholder>
const LIST_DETAIL_LIST = (
  <Card padding="none" variant="outlined">
    <List aria-label="Label" scrollEnabled={false}>
      <List.Item id="first">First item</List.Item>
      <List.Item id="second">Second item</List.Item>
      <List.Item id="third">Third item</List.Item>
    </List>
  </Card>
)

// The SupportingPane section's two panes, hoisted for the same reason.
const SUPPORTING_PANE_MAIN = <Placeholder>Main</Placeholder>
const SUPPORTING_PANE_SUPPORTING = <Placeholder>Supporting</Placeholder>

// The queue the page's snackbar shows, which its button adds to.
const SHOWCASE_MESSAGES = new Snackbar.Queue()

const stylesOf = themedStyles(({ colors, radii, spacing }) =>
  StyleSheet.create({
    // The bar reaches the canvas's edges, past the gutter the canvas draws
    // around the page, as it reaches the screen's in an app, and its content
    // inset lines it up with the page beneath.
    bar: {
      marginHorizontal: -spacing.lg,
      marginTop: -spacing.lg,
    },
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
    panel: {
      paddingTop: spacing.md,
    },
    placeholder: {
      borderColor: colors.outlineVariant,
      borderRadius: radii.md,
      borderStyle: 'dashed',
      borderWidth: 1,
      padding: spacing.md,
    },
    // A dashed box for the layouts, which paint nothing of their own, so
    // what a scheme reaches in them shows as the space between boxes.
    // The two rails side by side, as they would sit at a screen's edge.
    rails: {
      flexDirection: 'row',
      gap: spacing.lg,
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
      <View style={styles.bar}>
        <AppBar
          headline="Headline"
          leading={BAR_LEADING}
          size="md"
          subtitle="Supporting line"
          trailing={BAR_TRAILING}
        />
      </View>

      <View style={styles.intro}>
        <Text role="heading" variant="headlineSmall">
          {label}
        </Text>
        <Text tone="muted" variant="bodyLarge">
          {description}
        </Text>
      </View>

      <Section
        description="The bar above is this component: a leading and a trailing icon button either side of the headline, on the surface role a scheme sets for the top of a screen. It is drawn there rather than here because it belongs at the top of the page."
        title="AppBar"
      />

      <Section
        description="A search field wired to a list, so the filtering is the component and the bar and the rows are all it draws. The card is the page's, giving the rows an edge the wrapper itself never sets."
        title="Autocomplete"
      >
        <Stack gap="sm">
          <Autocomplete>
            <SearchField label="Label" placeholder="Search" />
            <Card padding="none" variant="outlined">
              <List
                aria-label="Label"
                scrollEnabled={false}
                selectionMode="single"
              >
                <List.Item id="first">First item</List.Item>
                <List.Item id="second">Second item</List.Item>
                <List.Item id="third">Third item</List.Item>
              </List>
            </Card>
          </Autocomplete>
        </Stack>
      </Section>

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
        description="The error pair, which a scheme sets like any other role, on the corner of an icon: the small dot, and the large badge holding a count. Each sits on an icon button whose name carries what the mark says."
        title="Badge"
      >
        <View style={styles.row}>
          <IconButton aria-label="Label, new">{BADGED}</IconButton>
          <IconButton aria-label="Label, 3 new">{BADGED_COUNT}</IconButton>
        </View>
      </Section>

      <Section
        description="The trail leans on the muted role, with the page you are on at full strength."
        title="Breadcrumbs"
      >
        <Breadcrumbs aria-label="Label">
          <Breadcrumbs.Item href="/first">First item</Breadcrumbs.Item>
          <Breadcrumbs.Item href="/second">Second item</Breadcrumbs.Item>
          <Breadcrumbs.Item>Third item</Breadcrumbs.Item>
        </Breadcrumbs>
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
          <Button isPending>Label</Button>
        </View>
      </Section>

      <Section
        description="A group draws nothing of its own: what a scheme reaches is the buttons' containers and their corners, which a connected group squares off where its buttons meet."
        title="ButtonGroup"
      >
        <View style={styles.row}>
          <ButtonGroup aria-label="Label">
            <Button variant="tonal">First item</Button>
            <Button variant="tonal">Second item</Button>
          </ButtonGroup>
          <ButtonGroup
            aria-label="Label"
            defaultSelectedKeys={BUTTON_GROUP_SELECTION}
            selectionMode="single"
            variant="connected"
          >
            <Button id="first" variant="outlined">
              First item
            </Button>
            <Button id="second" variant="outlined">
              Second item
            </Button>
          </ButtonGroup>
        </View>
      </Section>

      <Section
        description="The dates and the weekday row take body large from the type scale and the month in the header label large, and the chosen day sits on the primary role."
        title="Calendar"
      >
        <Calendar
          aria-label="Label"
          defaultValue={CALENDAR_DATE}
          locale="en-US"
        />
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
        description="A field label and its supporting text above a column of checkboxes, which is where a scheme's field chrome shows on a control with no box of its own."
        title="CheckboxGroup"
      >
        <CheckboxGroup defaultValue={CHECKBOX_SELECTION} label="Label">
          <Checkbox value="first">First item</Checkbox>
          <Checkbox value="second">Second item</Checkbox>
          <Checkbox isIndeterminate value="third">
            Third item
          </Checkbox>
        </CheckboxGroup>
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
        description="An inline span in the mono face the scheme's type carries, taking its colour and its size from the text around it."
        title="Code"
      >
        <View style={styles.intro}>
          <Text variant="bodyLarge">
            A line naming <Code>--kui-radius-md</Code>
          </Text>
          <Text tone="muted" variant="bodyLarge">
            A muted line naming <Code>--kui-radius-md</Code>
          </Text>
        </View>
      </Section>

      <Section
        description="It lays down a measure and a gutter and paints nothing, so what a scheme reaches here is the spacing."
        title="Container"
      >
        <Container maxInlineSize={360}>
          <Placeholder>
            The container centres its content on the measure it is given, and
            pads it by the margin the window&apos;s size asks for.
          </Placeholder>
        </Container>
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
        description="A dialog is centred over the screen and fills the window below the medium breakpoint. What the page pins is the trigger; the surface, the corner and the scrim behind it are the scheme's."
        title="Dialog"
      >
        <View style={styles.row}>
          <Dialog>
            <Button variant="outlined">Open dialog</Button>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Headline</Dialog.Title>
                <IconButton aria-label="Close" slot="close">
                  {CLOSE}
                </IconButton>
              </Dialog.Header>
              <Dialog.Body>
                A dialog is centred over the screen and fills the window below
                the medium breakpoint, where the page draws its full-screen
                dialog instead.
              </Dialog.Body>
              <Dialog.Footer>
                <Button slot="close" variant="text">
                  Cancel
                </Button>
                <Button slot="close" variant="text">
                  Confirm
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog>
        </View>
      </Section>

      <Section
        description="The header draws the shared row with a caret that turns, and the panel takes the surface under it."
        title="Disclosure"
      >
        <Card padding="none" variant="outlined">
          <Disclosure defaultExpanded>
            <Disclosure.Header supporting="Supporting line">
              First item
            </Disclosure.Header>
            <Disclosure.Panel>
              <Text tone="muted" variant="bodyMedium">
                Supporting line
              </Text>
            </Disclosure.Panel>
          </Disclosure>
        </Card>
      </Section>

      <Section
        description="Several of those under one container, with a rule between each pair drawn from the same role the borders around them take."
        title="DisclosureGroup"
      >
        <Card padding="none" variant="outlined">
          <DisclosureGroup defaultExpandedKeys={DISCLOSURE_GROUP_SELECTION}>
            <Disclosure id="first">
              <Disclosure.Header supporting="Supporting line">
                First item
              </Disclosure.Header>
              <Disclosure.Panel>
                <Text tone="muted" variant="bodyMedium">
                  Supporting line
                </Text>
              </Disclosure.Panel>
            </Disclosure>
            <Disclosure id="second">
              <Disclosure.Header supporting="Supporting line">
                Second item
              </Disclosure.Header>
              <Disclosure.Panel>
                <Text tone="muted" variant="bodyMedium">
                  Supporting line
                </Text>
              </Disclosure.Panel>
            </Disclosure>
          </DisclosureGroup>
        </Card>
      </Section>

      <Section
        description="Each tone reads its container off a colour role, its corner off the radius scale and its lift off the shadow scale, the extended form's label off the type scale as well."
        title="Fab"
      >
        <View style={styles.row}>
          <Fab aria-label="Label">{PLUS}</Fab>
          <Fab aria-label="Label" tone="secondary" variant="filled">
            {PLUS}
          </Fab>
          <Fab label="Label" tone="tertiary">
            {PLUS}
          </Fab>
        </View>
      </Section>

      <Section
        description="Closed, the menu is a FAB on the tone's container a scheme sets; open, its close button takes the tone and its actions the container."
        title="FabMenu"
      >
        <View style={styles.row}>
          <FabMenu aria-label="Label" icon={PLUS}>
            <FabMenu.Item id="first">First item</FabMenu.Item>
            <FabMenu.Item id="second">Second item</FabMenu.Item>
          </FabMenu>
          <FabMenu aria-label="Label" icon={PLUS} tone="tertiary">
            <FabMenu.Item id="first">First item</FabMenu.Item>
            <FabMenu.Item id="second">Second item</FabMenu.Item>
          </FabMenu>
        </View>
      </Section>

      <Section
        description="A grid described by its cell rather than by its columns, which is what lets it reflow with the pane it sits in. It paints nothing, so what a scheme reaches is the gap between the cells."
        title="Feed"
      >
        <Feed minItemWidth={220}>
          <Placeholder>First item</Placeholder>
          <Placeholder>Second item</Placeholder>
          <Placeholder>Third item</Placeholder>
        </Feed>
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
        description="A key drawn with a border and a rule under it, sized from the text around it rather than from a step of the scale."
        title="Keycap"
      >
        <View style={styles.row}>
          <Keycap>Esc</Keycap>
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
        description="The shared row under selection, with a checkbox drawn on every one while the list toggles."
        title="List"
      >
        <Card padding="none" variant="outlined">
          <List
            aria-label="Label"
            defaultSelectedKeys={LIST_SELECTION}
            scrollEnabled={false}
            selectionMode="multiple"
          >
            <List.Item id="first" supporting="Supporting line">
              First item
            </List.Item>
            <List.Item id="second" supporting="Supporting line">
              Second item
            </List.Item>
            <List.Item id="third" supporting="Supporting line">
              Third item
            </List.Item>
          </List>
        </Card>
      </Section>

      <Section
        description="The same row again with the selected one on primary container, which is the layer every selectable collection here draws from."
        title="ListBox"
      >
        <Card padding="none" variant="outlined">
          <ListBox
            aria-label="Label"
            defaultSelectedKeys={LIST_SELECTION}
            scrollEnabled={false}
            selectionMode="single"
          >
            <ListBox.Item id="first" supporting="Supporting line">
              First item
            </ListBox.Item>
            <ListBox.Item id="second" supporting="Supporting line">
              Second item
            </ListBox.Item>
            <ListBox.Item id="third" supporting="Supporting line">
              Third item
            </ListBox.Item>
          </ListBox>
        </Card>
      </Section>

      <Section
        description="A list pane beside a detail pane, laid down and painted by neither, so what a scheme reaches is the space between them. Below the expanded window size the list shows alone. The dashed outline is the page's own."
        title="ListDetail"
      >
        <ListDetail detail={LIST_DETAIL_DETAIL} list={LIST_DETAIL_LIST} />
      </Section>

      <Section
        description="The row every list and menu draws, with its leading, supporting and trailing slots filled. An outlined card with no padding of its own is the bordered container, so the rows keep their inset and the rules between them start where a row's own content does, under the avatar, rather than running edge to edge."
        title="ListItem"
      >
        <Card padding="none" variant="outlined">
          {LIST_ROWS.map(({ leading, name: person, trailing }, index) => (
            <View key={person}>
              {index === 0 ? null : <Separator inset="start" />}
              <ListItem
                interactive
                leading={leading}
                supporting="Supporting line"
                trailing={trailing}
              >
                {person}
              </ListItem>
            </View>
          ))}
        </Card>
      </Section>

      <Section
        description="Items on a popover surface, with a rule between the ones that belong apart. The trigger is a button placed directly inside it."
        title="Menu"
      >
        <View style={styles.row}>
          <Menu>
            <Button variant="outlined">Open a menu</Button>
            <Menu.Content>
              <Menu.Item id="first">First item</Menu.Item>
              <Menu.Item id="second">Second item</Menu.Item>
              <Menu.Separator />
              <Menu.Item id="third">Third item</Menu.Item>
            </Menu.Content>
          </Menu>
        </View>
      </Section>

      <Section
        description="The tone recolours the active indicator and the stop indicator and leaves the track, so a column of meters still shares one track."
        title="Meter"
      >
        <Meter label="Label" value={60} />
        <Meter label="Label" tone="negative" value={94} />
      </Section>

      <Section
        description="The current destination's pill is the secondary container a scheme sets, its label the secondary role; below 600dp each destination is vertical, and from there each is a horizontal pill."
        title="NavigationBar"
      >
        <NavigationBar selectedRoute="/first">
          <NavigationBar.Item href="/first" icon={DOT}>
            First item
          </NavigationBar.Item>
          <NavigationBar.Item
            aria-label="Second item, 3 new"
            badge={3}
            href="/second"
            icon={SEARCH}
          >
            Second item
          </NavigationBar.Item>
          <NavigationBar.Item href="/third" icon={PLUS}>
            Third item
          </NavigationBar.Item>
        </NavigationBar>
      </Section>

      <Section
        description="The same destinations down the leading edge, collapsed and expanded, on the surface role a scheme sets."
        title="NavigationRail"
      >
        <View style={styles.rails}>
          <NavigationRail aria-label="Second label" selectedRoute="/first">
            <NavigationRail.Item href="/first" icon={DOT}>
              First item
            </NavigationRail.Item>
            <NavigationRail.Item href="/second" icon={SEARCH}>
              Second item
            </NavigationRail.Item>
          </NavigationRail>
          <NavigationRail
            aria-label="Third label"
            isExpanded
            selectedRoute="/first"
          >
            <NavigationRail.Item href="/first" icon={DOT}>
              First item
            </NavigationRail.Item>
            <NavigationRail.Item href="/second" icon={SEARCH}>
              Second item
            </NavigationRail.Item>
          </NavigationRail>
        </View>
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
        description="The panel is anchored to the control that opened it, and takes its surface, corner and elevation from the same tokens the page does. A hovered popover holds what a tooltip cannot: its own buttons and links stay reachable while the pointer is inside it."
        title="Popover"
      >
        <View style={styles.row}>
          <Popover trigger="hover">
            <Button variant="outlined">Hover for a popover</Button>
            <Popover.Content>
              <Popover.Title>Headline</Popover.Title>
              <Popover.Description>
                A hovered popover holds what a tooltip cannot: its own buttons
                and links stay reachable while the pointer is inside it.
              </Popover.Description>
            </Popover.Content>
          </Popover>
          <Popover>
            <Button variant="outlined">Open popover</Button>
            <Popover.Content>
              <Popover.Title>Headline</Popover.Title>
              <Popover.Description>
                The panel is anchored to the control that opened it, and takes
                its surface, corner and elevation from the same tokens the page
                does.
              </Popover.Description>
              <Stack direction="row" gap="sm" justify="end">
                <Button slot="close" variant="text">
                  Dismiss
                </Button>
              </Stack>
            </Popover.Content>
          </Popover>
        </View>
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
        description="A control that reads as a field with its options on a popover surface, so it draws both at once."
        title="Select"
      >
        <Select defaultValue="second" label="Label" options={SELECT_OPTIONS} />
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
        description="A sheet runs along the end edge from the medium breakpoint up and along the bottom below it. What the page pins is the trigger; the surface, the corners, the dividers and the scrim behind it are the scheme's."
        title="Sheet"
      >
        <View style={styles.row}>
          <Sheet>
            <Button variant="outlined">Open sheet</Button>
            <Sheet.Content>
              <Sheet.Handle />
              <Sheet.Header>
                <Sheet.Title>Headline</Sheet.Title>
                <IconButton aria-label="Close" slot="close">
                  {CLOSE}
                </IconButton>
              </Sheet.Header>
              <Sheet.Body>
                A sheet runs along the end edge from the medium breakpoint up,
                and along the bottom below it, where it is dragged by its
                handle.
              </Sheet.Body>
              <Sheet.Footer>
                <Button slot="close">Confirm</Button>
                <Button slot="close" variant="outlined">
                  Cancel
                </Button>
              </Sheet.Footer>
            </Sheet.Content>
          </Sheet>
        </View>
      </Section>

      <Section
        description="The filled half of the track takes primary and the rest its container, with the handle on primary again, and the stops on each take on primary and on secondary container. At the medium size the track takes the medium corner and the inset icon on primary."
        title="Slider"
      >
        <Stack gap="lg">
          <Slider defaultValue={40} label="Label" showStops step={10} />
          <Slider defaultValue={40} icon={DOT} label="Label" size="md" />
        </Stack>
      </Section>

      <Section
        description="A message on the inverse surface, which is the one place a scheme's inverse pair is drawn. It has no trigger of its own, so the page carries a button that shows one."
        title="Snackbar"
      >
        <View style={styles.row}>
          <Button onPress={showSnackbar} variant="tonal">
            Show a snackbar
          </Button>
          <Snackbar queue={SHOWCASE_MESSAGES} />
        </View>
      </Section>

      <Section
        description="Both halves read their containers off the variant's colour roles, and the corner where they meet off the radius scale."
        title="SplitButton"
      >
        <View style={styles.row}>
          <SplitButton>
            <SplitButton.Action>Label</SplitButton.Action>
            <SplitButton.Menu aria-label="More options">
              <Menu.Item id="first">First item</Menu.Item>
            </SplitButton.Menu>
          </SplitButton>
          <SplitButton variant="tonal">
            <SplitButton.Action>Label</SplitButton.Action>
            <SplitButton.Menu aria-label="More options">
              <Menu.Item id="first">First item</Menu.Item>
            </SplitButton.Menu>
          </SplitButton>
        </View>
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
        description="The main pane takes what the supporting pane leaves from the expanded window size up, and the whole of the width below that. It paints nothing; the dashed outlines are the page's own."
        title="SupportingPane"
      >
        <SupportingPane
          main={SUPPORTING_PANE_MAIN}
          supporting={SUPPORTING_PANE_SUPPORTING}
        />
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
        description="The active tab's label and the indicator under it take the primary role. The secondary strip keeps its active label on surface and runs a primary line across the tab, with each icon in its tab's own colour."
        title="Tabs"
      >
        <Tabs defaultSelectedKey="First item">
          <Tabs.List aria-label="Sections">
            {TABS.map((tab) => (
              <Tabs.Tab id={tab} key={tab}>
                {tab}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {TABS.map((tab) => (
            <Tabs.Panel id={tab} key={tab} style={styles.panel}>
              <Text tone="muted" variant="bodyMedium">
                Supporting line
              </Text>
            </Tabs.Panel>
          ))}
        </Tabs>
        <Tabs defaultSelectedKey="First item" variant="secondary">
          <Tabs.List aria-label="Sections">
            {TABS.map((tab) => (
              <Tabs.Tab icon={DOT} id={tab} key={tab}>
                {tab}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      </Section>

      <Section
        description="Filled and outlined at each tone, the filled one off a container pair and the outlined one off the rule the borders take."
        title="Tag"
      >
        <View style={styles.row}>
          {TAG_TONES.map((tone) => (
            <Tag key={tone} tone={tone}>
              Label
            </Tag>
          ))}
          {TAG_TONES.map((tone) => (
            <Tag key={`${tone}-outlined`} tone={tone} variant="outlined">
              Label
            </Tag>
          ))}
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
        description="The field grown to several lines, which keeps the label floated and the underline the full width of the box."
        title="TextArea"
      >
        <TextArea
          defaultValue={'First line.\nSecond line.\nThird line.'}
          label="Label"
        />
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

      <Section
        description="A row of icon buttons on a surface of its own, with a rule between the ones that belong apart."
        title="Toolbar"
      >
        <View style={styles.row}>
          <Toolbar aria-label="Label">
            <IconButton aria-label="Add">{PLUS}</IconButton>
            <IconButton aria-label="Add">{PLUS}</IconButton>
            <Separator />
            <IconButton aria-label="Close">{CLOSE}</IconButton>
          </Toolbar>
        </View>
      </Section>

      <Section
        description="The inverse surface again, at the label size, anchored to the control it describes."
        title="Tooltip"
      >
        <View style={styles.row}>
          <Tooltip label="Supporting text">
            <Button variant="outlined">Hover or press and hold</Button>
          </Tooltip>
        </View>
      </Section>
    </View>
  )
}

// The page shows what a snackbar looks like rather than what its action does,
// so the action does nothing.
function showSnackbar() {
  SHOWCASE_MESSAGES.add('First item saved', {
    action: { label: 'Undo', onPress: removeNothing },
  })
}

export type { ShowcaseProps }

export default Showcase
