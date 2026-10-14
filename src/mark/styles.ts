import { StyleSheet } from 'react-native'

import { themedStyles } from '../theme/styles'

// The box Avatar and ProductIcon draw in, as kanso-ui's `src/mark/styles.ts`
// draws it, shared so a person and a thing stay the same three sizes in the
// same five tones, and so either can fill a leading slot without moving what
// sits beside it. They differ in the two ways that matter for a mark rather
// than a face, and those are the keys a kind picks between in `./index.tsx`.
//
// A person is a circle with the photo cropped to fill it; a thing is a
// rounded square with its mark letterboxed. A logo is drawn to its own
// bounding box, so a circle crops the corners it was composed with, and
// cropping a face loses nothing anyone minds where cropping a wordmark loses
// the word. The cost of `contain` is letterboxing, a wide mark leaving space
// above and below, and that is the right trade for a mark whose whole job is
// to be recognised.
//
// That cost is also why a thing's tone tints the fallback rather than the
// root. A mark letterboxed into the square does not cover it, and neither
// does one drawn with transparency, so a tint on the root would show as a
// coloured box around every logo that is not an opaque square. On the
// fallback it is seen exactly when it is meant to be: while there is no mark,
// or none has loaded. A photo covers the whole circle, so a person's tone
// stays on the root.
//
// Tones are container and on-container pairs rather than one colour each, so
// the initials are always a role's own foreground.
//
// Sizes carry their own type size but not their own weight or family: the
// label large role's face and weight hold across all three, so a large mark
// is bigger initials rather than differently styled ones.
//
// No Material Design page gives a measurement for one, so the three are
// web's, stated against the scale the library already has. `md` is 40dp,
// Button's and IconButton's own `md` height, so a mark and a control line up
// in a row. `lg` is 56dp. `sm` is 36dp, for a row that wants a person smaller
// than the button beside it.

type MarkSize = 'lg' | 'md' | 'sm'

type MarkTone = 'negative' | 'positive' | 'primary' | 'secondary' | 'tertiary'

const DIAMETERS: Readonly<Record<MarkSize, number>> = { lg: 56, md: 40, sm: 36 }

// The anonymous person is three fifths of the disc: 24dp in the 40dp avatar,
// as Material Design draws its placeholder, and the same share of the other
// two.
const GLYPH_SHARE = 0.6

const markStylesOf = themedStyles(({ colors, radii }) =>
  StyleSheet.create({
    // Clips the picture to the shape, so one of any aspect ratio can be
    // handed over without the call site having to crop it first.
    base: {
      alignItems: 'center',
      flexShrink: 0,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    circle: {
      borderRadius: radii.circle,
    },
    negative: { backgroundColor: colors.negativeContainer },
    positive: { backgroundColor: colors.positiveContainer },
    primary: { backgroundColor: colors.primaryContainer },
    secondary: { backgroundColor: colors.secondaryContainer },
    square: {
      borderRadius: radii.sm,
    },
    tertiary: { backgroundColor: colors.tertiaryContainer },
  }),
)

const initialsStylesOf = themedStyles(({ colors, typography }) =>
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

const markStyles = StyleSheet.create({
  // Fills the root, so a thing's tint is the whole square rather than a box
  // behind its initial.
  fallback: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  // Laid over the initials and over the picture before it, filling the
  // mark, so a new picture can load in place without moving anything.
  image: {
    ...StyleSheet.absoluteFill,
    height: '100%',
    width: '100%',
  },
  // Loading: present, so the platform fetches it, and invisible until it has
  // loaded.
  imagePending: {
    opacity: 0,
  },
  lg: { height: DIAMETERS.lg, width: DIAMETERS.lg },
  md: { height: DIAMETERS.md, width: DIAMETERS.md },
  sm: { height: DIAMETERS.sm, width: DIAMETERS.sm },
})

export type { MarkSize, MarkTone }

export { DIAMETERS, GLYPH_SHARE, initialsStylesOf, markStyles, markStylesOf }
