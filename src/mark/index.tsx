import type { ComponentRef, Ref } from 'react'
import type {
  ImageProps,
  ImageSourcePropType,
  ImageStyle,
  StyleProp,
  TextStyle,
  ViewProps,
  ViewStyle,
} from 'react-native'

import { Image, Text as NativeText, View } from 'react-native'

import type { ResolvedTheme } from '../theme/scope'
import type { MarkSize, MarkTone } from './styles'

import { PersonGlyph } from '../glyphs'
import { useLocaleOf } from '../i18n/provider'
import { useTheme } from '../theme/scope'
import { composeStyles } from '../theme/styles'
import { useTypeRole } from '../typography/roles'
import { useImageLoadingStatus } from './image'
import { initialOfThing, initialsOfPerson } from './initials'
import {
  DIAMETERS,
  GLYPH_SHARE,
  initialsStylesOf,
  markStyles,
  markStylesOf,
} from './styles'

/** The native props a picture's own `Image` takes, as Avatar and ProductIcon take them. */
type MarkImageProps = Pick<
  ImageProps,
  | 'crossOrigin'
  | 'fadeDuration'
  | 'progressiveRenderingEnabled'
  | 'referrerPolicy'
  | 'resizeMethod'
>

type MarkProps = Omit<ViewProps, 'children' | 'style'> & {
  /**
   * Hides the mark from screen readers, for one beside the name it stands
   * for, which would otherwise be announced twice.
   */
  readonly decorative?: boolean
  /** Props for the picture's own `Image`. */
  readonly imgProps?: MarkImageProps
  /** A person, which Avatar draws, or anything else, which ProductIcon does. */
  readonly kind: keyof typeof KINDS
  /** Supplies the fallback's initials, and the accessible name unless decorative. */
  readonly name: string
  readonly ref?: Ref<ComponentRef<typeof View>>
  /**
   * Whether a person with no initials to take, a blank name, draws the
   * anonymous person, or an empty disc, as a loading skeleton wants.
   */
  readonly showPersonIcon?: boolean
  readonly size: MarkSize
  /** A picture to show in place of the initials once it has loaded. */
  readonly src?: string
  readonly style?: StyleProp<ViewStyle>
  readonly tone: MarkTone
}

// What each kind of mark is drawn as. The header of `./styles` says why the
// two differ where they do; everything not in this table is the same for
// both.
const KINDS = {
  person: {
    initials: initialsOfPerson,
    resizeMode: 'cover',
    shape: 'circle',
    tintsFallback: false,
  },
  thing: {
    initials: initialOfThing,
    resizeMode: 'contain',
    shape: 'square',
    tintsFallback: true,
  },
} as const

// The role each tone draws the anonymous person in.
const CONTENT: Readonly<Record<MarkTone, keyof ResolvedTheme['colors']>> = {
  negative: 'onNegativeContainer',
  positive: 'onPositiveContainer',
  primary: 'onPrimaryContainer',
  secondary: 'onSecondaryContainer',
  tertiary: 'onTertiaryContainer',
}

/**
 * The small identity mark Avatar and ProductIcon both render: a picture once
 * it has loaded, initials until then or if it fails, named for whoever or
 * whatever it stands for. Shared rather than written into each, so a fix to
 * one reaches both, as on web. Not a component of the library's own, and not
 * exported from the package.
 */
function Mark({
  decorative = false,
  imgProps,
  kind,
  name,
  showPersonIcon = true,
  size,
  src,
  style,
  tone,
  ...props
}: MarkProps) {
  const { initials, resizeMode, shape, tintsFallback } = KINDS[kind]
  const theme = useTheme()
  const label = useTypeRole('labelLarge')
  const { handlersFor, previous, status } = useImageLoadingStatus(src)

  const own = markStylesOf(theme)
  const text = initialsStylesOf(theme)
  const locale = useLocaleOf(undefined)
  const fallback = initials(name, locale)

  // Announced as an image named for whoever or whatever it stands for,
  // rather than letting the initials be read: "AL" is not what anyone means
  // to announce. A blank name names nothing, so the mark is then a plain
  // view, which a screen reader passes over rather than reading as an image
  // with no name. A decorative mark is hidden outright, its initials with it.
  const named = !decorative && name.trim() !== ''

  // The initials while no picture shows: before the first loads, and once
  // one fails. They are left out under a picture rather than kept beneath
  // it, since a letterboxed logo would show them through its transparent
  // parts.
  const showsPicture = status === 'loaded' || previous !== undefined
  let initialsNode = null
  if (!showsPicture && kind === 'person' && fallback === '') {
    // A person with no initials to take, a blank name or one still loading,
    // draws Material Design's anonymous person in the tone's on-container
    // colour. The glyph hides itself from screen readers.
    initialsNode = showPersonIcon ? (
      <PersonGlyph
        color={theme.colors[CONTENT[tone]]}
        size={DIAMETERS[size] * GLYPH_SHARE}
      />
    ) : null
  } else if (!showsPicture) {
    // The initials keep their size whatever the device's text size asks
    // for: the mark is a fixed size and clips what runs past it, and the
    // name a screen reader reads is what they stand for.
    const initialsText = (
      <NativeText
        allowFontScaling={false}
        style={composeStyles<TextStyle>(label, text[size], text[tone])}
      >
        {fallback}
      </NativeText>
    )
    initialsNode = tintsFallback ? (
      <View style={composeStyles<ViewStyle>(markStyles.fallback, own[tone])}>
        {initialsText}
      </View>
    ) : (
      initialsText
    )
  }

  return (
    <View
      accessible={named ? true : undefined}
      aria-hidden={decorative ? true : undefined}
      aria-label={named ? name : undefined}
      role={named ? 'img' : undefined}
      {...props}
      style={composeStyles<ViewStyle>(
        own.base,
        own[shape],
        markStyles[size],
        tintsFallback ? undefined : own[tone],
        style,
      )}
    >
      {initialsNode}
      {/* Two pictures at most, laid over the initials. The one last loaded
          stays while a new `src` loads, and the new one is drawn on top of
          it from the start, hidden until it has loaded. Neither is inverted
          by the iOS Smart Invert setting, which is meant for interface
          colours rather than pictures. */}
      {previous === undefined ? null : (
        <Image
          accessibilityIgnoresInvertColors
          key={previous}
          resizeMode={resizeMode}
          source={sourceOf(previous)}
          style={markStyles.image}
        />
      )}
      {src === undefined || status === 'error' ? null : (
        <Image
          accessibilityIgnoresInvertColors
          key={src}
          {...imgProps}
          {...handlersFor(src)}
          resizeMode={resizeMode}
          source={sourceOf(src)}
          style={composeStyles<ImageStyle>(
            markStyles.image,
            status === 'loaded' ? undefined : markStyles.imagePending,
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

export type { MarkImageProps, MarkProps }

export { Mark }
