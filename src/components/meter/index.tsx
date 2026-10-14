import type { Ref } from 'react'
import type { StyleProp, ViewProps, ViewStyle } from 'react-native'

import { StyleSheet, View } from 'react-native'

import type { IndicatorTone } from '../../indicator'

import {
  IndicatorLabels,
  IndicatorLine,
  readingOf,
  useEased,
  useIndicatorColors,
  useMeasuredWidth,
} from '../../indicator'
import {
  DETERMINATE_EASING,
  stylesOf as indicatorStylesOf,
} from '../../indicator/styles'
import { useTheme } from '../../theme/scope'
import { composeStyles } from '../../theme/styles'

// A meter is the progress indicators page's line, drawn for a measurement
// rather than for a task, as on web: the same three parts at the same 4dp,
// the same label row above them, and the same motion when the number changes.
// All of that is `src/indicator`, shared with ProgressIndicator, so what is
// here is the two things that make it a meter rather than a progress bar.
//
// The first is the role. The root says `meter` rather than `progressbar`, as
// React Aria's `Meter` does on web, and a screen reader says the two
// differently: one is how full something is, the other how far along
// something is. That is also why a meter has no indeterminate state: a
// measurement whose value is unknown is not a measurement.
//
// The second is `tone`. The page draws one colour pair, which is right for a
// task, since progress does not become good or bad on its way to done. A
// measurement does, so `negative` and `positive` recolour the active
// indicator and the stop indicator and leave the track alone. A column of
// meters then reads as one scale with bars of different colours. Which tone a
// value deserves is the call site's to decide: nothing here reads the number
// and picks one.
//
// The value is shown by default, where a progress indicator hides it. A meter
// is the number, and `formatOptions` is what makes it read as a percentage,
// bytes or a plain count, in `locale`.

type MeterProps = Omit<ViewProps, 'children' | 'style'> & {
  /**
   * How the value reads.
   * @default { style: 'percent' }
   */
  readonly formatOptions?: Intl.NumberFormatOptions
  /**
   * What is being measured, shown above the line. A screen reader reads it as
   * the meter's name; a meter whose surroundings name it takes `aria-label`
   * instead and leaves this out.
   */
  readonly label?: string
  /**
   * The BCP 47 locale the value is written in. Defaults to the device's.
   */
  readonly locale?: string
  /**
   * The top of the scale.
   * @default 100
   */
  readonly maxValue?: number
  /**
   * The bottom of the scale.
   * @default 0
   */
  readonly minValue?: number
  readonly ref?: Ref<View>
  /**
   * Whether the value is shown beside the label.
   * @default true
   */
  readonly showValue?: boolean
  readonly style?: StyleProp<ViewStyle>
  /**
   * Which colours the measurement is drawn in. `primary` states without
   * ranking; `negative` and `positive` say the value is bad or good, and
   * recolour the active indicator and the stop indicator, leaving the track in
   * its secondary container so a column of meters still shares one track.
   * @default 'primary'
   */
  readonly tone?: MeterTone
  /**
   * The measurement, between `minValue` and `maxValue`.
   * @default 0
   */
  readonly value?: number
  /** The value as words, in place of the number `formatOptions` writes. */
  readonly valueLabel?: string
}

const styles = StyleSheet.create({
  // The row the line is drawn across, measured for the width it is drawn to.
  line: {
    alignSelf: 'stretch',
  },
})

// The three of the shared line's four tones a meter draws. The fourth,
// `inherit`, is for an indicator inside something that carries its own
// colour, which is a pending button rather than a measurement.
type MeterTone = Extract<IndicatorTone, 'negative' | 'positive' | 'primary'>

/**
 * How full something is, on a scale it names: disk used, storage left, a
 * rating out of five. Pass `value` between `minValue` and `maxValue`, and
 * `formatOptions` to say how the number reads, in `locale`. For how far along
 * a task is, reach for ProgressIndicator instead: a meter has no indeterminate
 * state, because a measurement always has a value.
 *
 * ```tsx
 * <Meter label="Label" tone="negative" value={94} />
 * ```
 *
 * A screen reader hears it as a meter named by its label, with its value as
 * `formatOptions` writes it. `style`, `ref` and `testID` land on the meter as
 * a whole, which is the view a layout positions.
 */
function Meter({
  'aria-label': ariaLabel,
  formatOptions,
  label,
  locale,
  maxValue = 100,
  minValue = 0,
  showValue = true,
  style,
  tone = 'primary',
  value = 0,
  valueLabel,
  ...props
}: MeterProps) {
  const theme = useTheme()
  const colors = useIndicatorColors(tone)
  const reading = readingOf({
    formatOptions,
    locale,
    maxValue,
    minValue,
    value,
    valueLabel,
  })
  const shown = useEased(reading.percentage, {
    duration: theme.motion.durationMedium1,
    easing: DETERMINATE_EASING,
  })
  const { onLayout, width } = useMeasuredWidth()

  return (
    <View
      accessible
      aria-label={label ?? ariaLabel}
      aria-valuemax={maxValue}
      aria-valuemin={minValue}
      aria-valuenow={reading.value}
      aria-valuetext={reading.text}
      role="meter"
      {...props}
      style={composeStyles<ViewStyle>(indicatorStylesOf(theme).root, style)}
    >
      <IndicatorLabels
        label={label}
        value={showValue ? reading.text : undefined}
      />
      <View onLayout={onLayout} style={styles.line}>
        <IndicatorLine colors={colors} percentage={shown} width={width} />
      </View>
    </View>
  )
}

export { Meter }
export type { MeterProps, MeterTone }
