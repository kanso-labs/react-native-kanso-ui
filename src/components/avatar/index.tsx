import type { Ref } from 'react'
import type { StyleProp, View, ViewProps, ViewStyle } from 'react-native'

import type { MarkImageProps } from '../../mark'

import { Mark } from '../../mark'

// A person, drawn as a disc with the photo cropped to fill it, as kanso-ui's
// Avatar draws one. The box, the sizes, the tones, the photo's loading and
// the labelling are the mark's in `src/mark`, which ProductIcon draws a thing
// through as well, so a person and a thing fill the same slot.
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
  readonly imgProps?: MarkImageProps
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
 * Reach for ProductIcon when what is drawn is not a person; the two share
 * their sizes, so either fills the same slot in a row or a card.
 *
 * The initials are taken in the device's locale. `style`, `ref` and `testID`
 * land on the disc.
 */
function Avatar({ size = 'md', tone = 'primary', ...props }: AvatarProps) {
  return <Mark {...props} kind="person" size={size} tone={tone} />
}

export type { AvatarProps }

export { Avatar }
