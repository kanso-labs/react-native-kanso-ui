import type { Ref } from 'react'
import type { StyleProp, View, ViewProps, ViewStyle } from 'react-native'

import type { MarkImageProps } from '../../mark'

import { Mark } from '../../mark'

// The counterpart to Avatar: Avatar stands for a person, this stands for
// everything else, such as an application, a service or a brand. It is drawn
// as a rounded square with the mark letterboxed, and its tone tints the
// fallback rather than the square. The header of `src/mark/styles.ts` says
// why on all three counts.
//
// The box, the sizes, the tones, the mark's loading and the labelling are
// the mark's in `src/mark`, which Avatar draws a person through as well. No
// Material Design page draws a product mark, so its sizes are Avatar's, 36,
// 40 and 56, which is what lets a mark and a person fill the same slot, and
// its corner is the small one from the radius scale, as web's is.

type ProductIconProps = Omit<ViewProps, 'children' | 'style'> & {
  /**
   * Hides the mark from screen readers, for one beside the name of what it
   * identifies, where it would otherwise announce the name a second time.
   * `name` still supplies the initial, and is not announced.
   * @default false
   */
  readonly decorative?: boolean
  /**
   * Props for the mark's own `Image`: `crossOrigin` and `referrerPolicy` for
   * where it is served from, and `resizeMethod`, `fadeDuration` and
   * `progressiveRenderingEnabled` for how Android decodes and shows it.
   */
  readonly imgProps?: MarkImageProps
  /**
   * What this identifies. Supplies both the fallback initial and the
   * accessible name, so a screen reader announces the thing rather than
   * reading a letter aloud. The initial is the name's first letter, number or
   * emoji, passing over punctuation it opens with: a handle's at sign, a
   * channel's hash or a bracket.
   */
  readonly name: string
  readonly ref?: Ref<View>
  /**
   * Edge length: `sm` 36dp, `md` 40dp, `lg` 56dp. The same three Avatar
   * uses, so the two are interchangeable wherever one leads a row or a card.
   * @default 'md'
   */
  readonly size?: 'lg' | 'md' | 'sm'
  /**
   * The mark to show in place of the initial. The initial stays until it has
   * loaded, and comes back if it fails.
   */
  readonly src?: string
  readonly style?: StyleProp<ViewStyle>
  /**
   * Which container and on-container colour pair to tint the fallback with.
   * It is the fallback's own background, so it is gone once `src` has loaded
   * rather than sitting behind the mark.
   * @default 'primary'
   */
  readonly tone?: 'negative' | 'positive' | 'primary' | 'secondary' | 'tertiary'
}

/**
 * A small square mark identifying something that is not a person, such as
 * an application, a service or a brand. Reach for Avatar when it is a
 * person.
 *
 * ```tsx
 * <ProductIcon name="First item" src={logo} />
 * ```
 *
 * The mark is letterboxed rather than cropped, so a logo of any aspect ratio
 * can be handed over as it was drawn.
 *
 * It is announced as an image named by `name`. When the thing's name is
 * already written next to the mark, mark it `decorative`, so a screen reader
 * reads the name once.
 *
 * The initial is taken in the device's locale. `style`, `ref` and `testID`
 * land on the square.
 */
function ProductIcon({
  size = 'md',
  tone = 'primary',
  ...props
}: ProductIconProps) {
  return <Mark {...props} kind="thing" size={size} tone={tone} />
}

export type { ProductIconProps }

export { ProductIcon }
