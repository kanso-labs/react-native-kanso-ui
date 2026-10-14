import type { Ref } from 'react'
import type {
  ImageProps,
  ImageSourcePropType,
  ImageStyle,
  StyleProp,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'

import { Image, Text as NativeText, StyleSheet, View } from 'react-native'

import type { ResolvedTheme } from '../../theme/scope'

import { PersonGlyph } from '../../glyphs'
import { useImageLoadingStatus } from '../../mark/image'
import { initialsOfPerson } from '../../mark/initials'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// A person, drawn as a disc with the photo cropped to fill it, as kanso-ui's
// Avatar draws one. No Material Design page gives an avatar's measurements,
// so the sizes and the tones are web's: `md` is 40dp, Button's and
// IconButton's `md` height, so an avatar and a control line up in a row,
// `lg` is 56dp, and `sm` is 36dp, for a row that wants a person smaller than
// the button beside them. Each tone is a container and on-container pair, so
// the initials are always a role's own foreground.
//
// The initials are set in the label face at medium weight, at the label
// medium, label large and body large sizes, so a larger avatar draws larger
// initials rather than differently styled ones. They keep that size whatever
// the device's text size asks for: the disc is a fixed size and clips what
// runs past it, and the name a screen reader reads is what they stand for.
//
// Which tone a given person gets is the consuming app's decision, since the
// cycle of colours belongs where the list of people is.

type AvatarProps = Omit<ViewProps, 'children' | 'style'> & {
  /**
   * Hides the avatar from screen readers, for one beside the person's name,
   * such as a row whose headline is the name or a byline, where it would
   * otherwise announce the name a second time. `name` still supplies the
   * initials, and is not announced.
   * @default false
   */
  readonly decorative?: boolean
  /**
   * Props for the photo's own `Image`: `crossOrigin` and `referrerPolicy`
   * for where it is served from, and `resizeMethod`, `fadeDuration` and
   * `progressiveRenderingEnabled` for how Android decodes and shows it.
   */
  readonly imgProps?: Pick<
    ImageProps,
    | 'crossOrigin'
    | 'fadeDuration'
    | 'progressiveRenderingEnabled'
    | 'referrerPolicy'
    | 'resizeMethod'
  >
  /**
   * The person this represents. Supplies both the initials and the
   * accessible name, so a screen reader announces who it is rather than
   * reading two letters aloud.
   *
   * A display name, as a reader would see it written: the initials are its
   * first and last words. A title before the name ("Dr."), a generational
   * suffix after it ("Jr.", "III") and an aside in brackets at its end
   * ("(she/her)") are passed over, as is punctuation a word opens with. A
   * name written without spaces between its words, as Japanese and Chinese
   * names are, is one word, and takes one initial.
   */
  readonly name: string
  readonly ref?: Ref<View>
  /**
   * Whether an avatar with no initials to take, for a blank `name`, draws
   * Material Design's anonymous person. `false` leaves the tinted disc
   * empty, for a loading skeleton.
   * @default true
   */
  readonly showPersonIcon?: boolean
  /**
   * Diameter: `sm` 36dp, `md` 40dp, `lg` 56dp.
   * @default 'md'
   */
  readonly size?: 'lg' | 'md' | 'sm'
  /**
   * A photo to show in place of the initials. The initials stay until it has
   * loaded, and come back if it fails.
   */
  readonly src?: string
  readonly style?: StyleProp<ViewStyle>
  /**
   * Which container and on-container colour pair to tint with.
   * @default 'primary'
   */
  readonly tone?: 'negative' | 'positive' | 'primary' | 'secondary' | 'tertiary'
}

type Size = NonNullable<AvatarProps['size']>

type Tone = NonNullable<AvatarProps['tone']>

const DIAMETERS: Readonly<Record<Size, number>> = { lg: 56, md: 40, sm: 36 }

// The anonymous person is three fifths of the disc: 24dp in the 40dp avatar,
// as Material Design draws its placeholder, and the same share of the other
// two.
const GLYPH_SHARE = 0.6

// The role each tone draws the initials and the glyph in.
const CONTENT: Readonly<Record<Tone, keyof ResolvedTheme['colors']>> = {
  negative: 'onNegativeContainer',
  positive: 'onPositiveContainer',
  primary: 'onPrimaryContainer',
  secondary: 'onSecondaryContainer',
  tertiary: 'onTertiaryContainer',
}

const stylesOf = themedStyles(({ colors, radii }) =>
  StyleSheet.create({
    // Clips the photo to the disc, so one of any aspect ratio can be handed
    // over without the call site having to crop it first.
    base: {
      alignItems: 'center',
      borderRadius: radii.circle,
      flexShrink: 0,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    negative: { backgroundColor: colors.negativeContainer },
    positive: { backgroundColor: colors.positiveContainer },
    primary: { backgroundColor: colors.primaryContainer },
    secondary: { backgroundColor: colors.secondaryContainer },
    tertiary: { backgroundColor: colors.tertiaryContainer },
  }),
)

const textStylesOf = themedStyles(({ colors, typography }) =>
  StyleSheet.create({
    lg: {
      fontSize: typography.bodyLargeSize,
      lineHeight: typography.bodyLargeLineHeight,
    },
    md: {
      fontSize: typography.labelLargeSize,
      lineHeight: typography.labelLargeLineHeight,
    },
    negative: { color: colors.onNegativeContainer },
    positive: { color: colors.onPositiveContainer },
    primary: { color: colors.onPrimaryContainer },
    secondary: { color: colors.onSecondaryContainer },
    sm: {
      fontSize: typography.labelMediumSize,
      lineHeight: typography.labelMediumLineHeight,
    },
    tertiary: { color: colors.onTertiaryContainer },
  }),
)

const styles = StyleSheet.create({
  // Laid over the initials and over the picture before it, filling the
  // disc, so a new picture can load in place without moving anything.
  image: {
    ...StyleSheet.absoluteFill,
    height: '100%',
    width: '100%',
  },
  lg: { height: DIAMETERS.lg, width: DIAMETERS.lg },
  md: { height: DIAMETERS.md, width: DIAMETERS.md },
  // Loading: present, so the platform fetches it, and invisible until it
  // has loaded.
  pending: {
    opacity: 0,
  },
  sm: { height: DIAMETERS.sm, width: DIAMETERS.sm },
})

/**
 * A person, as a disc holding their photo or, until it loads or when there
 * is none, their initials. `name` is both where the initials come from and
 * what a screen reader announces, so it is required even with a photo.
 *
 * ```tsx
 * <Avatar name="Ada Lovelace" size="lg" src={photo} />
 * ```
 *
 * It is announced as an image named by `name`. When the person's name is
 * already written next to the avatar, mark it `decorative`, so a screen
 * reader reads the name once. A blank name names nothing, so the avatar is
 * then a plain view, which a screen reader passes over rather than reading
 * as an image with no name.
 *
 * The initials are taken in the device's locale. `style`, `ref` and `testID`
 * land on the disc.
 */
function Avatar({
  decorative = false,
  imgProps,
  name,
  showPersonIcon = true,
  size = 'md',
  src,
  style,
  tone = 'primary',
  ...props
}: AvatarProps) {
  const theme = useTheme()
  const label = useTypeRole('labelLarge')
  const { handlersFor, previous, status } = useImageLoadingStatus(src)

  const own = stylesOf(theme)
  const text = textStylesOf(theme)
  const initials = initialsOfPerson(name)
  const named = !decorative && name.trim() !== ''

  // The initials while no picture shows: before the first loads, and once
  // one fails.
  const showsPicture = status === 'loaded' || previous !== undefined
  let fallback = null
  if (!showsPicture && initials === '') {
    // A blank name, one still loading, has no initials to take, and draws
    // Material Design's anonymous person in the tone's on-container colour.
    // The glyph hides itself from screen readers.
    fallback = showPersonIcon ? (
      <PersonGlyph
        color={theme.colors[CONTENT[tone]]}
        size={DIAMETERS[size] * GLYPH_SHARE}
      />
    ) : null
  } else if (!showsPicture) {
    fallback = (
      <NativeText
        allowFontScaling={false}
        style={composeStyles<TextStyle>(label, text[size], text[tone])}
      >
        {initials}
      </NativeText>
    )
  }

  return (
    <View
      accessible={named ? true : undefined}
      aria-hidden={decorative ? true : undefined}
      aria-label={named ? name : undefined}
      role={named ? 'img' : undefined}
      {...props}
      style={composeStyles<ViewStyle>(own.base, styles[size], own[tone], style)}
    >
      {fallback}
      {/* Two pictures at most, laid over the initials. The one last loaded
          stays while a new `src` loads, and the new one is drawn on top of
          it from the start, hidden until it has loaded. Neither is inverted
          by the iOS Smart Invert setting, which is meant for interface
          colours rather than photos. */}
      {previous === undefined ? null : (
        <Image
          accessibilityIgnoresInvertColors
          key={previous}
          resizeMode="cover"
          source={sourceOf(previous)}
          style={styles.image}
        />
      )}
      {src === undefined || status === 'error' ? null : (
        <Image
          accessibilityIgnoresInvertColors
          key={src}
          {...imgProps}
          {...handlersFor(src)}
          resizeMode="cover"
          source={sourceOf(src)}
          style={composeStyles<ImageStyle>(
            styles.image,
            status === 'loaded' ? undefined : styles.pending,
          )}
        />
      )}
    </View>
  )
}

// An address as the source `Image` takes. The compiler keeps the one it made
// for as long as the address is the same, so a re-render hands the image the
// object it already had.
function sourceOf(uri: string): ImageSourcePropType {
  return { uri }
}

export type { AvatarProps }

export { Avatar }
