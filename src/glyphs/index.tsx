import type { ReactNode } from 'react'
import type { ColorValue, StyleProp, ViewStyle } from 'react-native'

import {
  arrowBackPath,
  arrowDownwardPath,
  arrowDropDownPath,
  arrowUpwardPath,
  calendarPath,
  checkPath,
  chevronDownPath,
  chevronEndPath,
  clockPath,
  closePath,
  gridSize,
  keyboardPath,
  minusPath,
  personPath,
  plusPath,
  searchPath,
} from '@kanso-labs/kanso-ui-core/glyphs'
import { I18nManager, StyleSheet } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { HIDDEN } from './hidden'
import { useIconStyle } from './icon-style'
import { glyphStyles } from './styles'

// The glyphs the library's own controls draw, the same set kanso-ui draws on
// web: the check and the dash a checkbox shows, the plus and minus a number
// field's steppers show, the magnifier and cross a search field shows, and the
// rest named beside each one. Private to the library, as on web: a call site
// with icons of its own passes them to the slots that take a node, and reads
// the slot's colour and size through `useIconStyle()`.
//
// The paths are @kanso-labs/kanso-ui-core's, the ones kanso-ui draws too:
// Material Symbols on their 24-unit grid, which is what the checkbox page draws
// at 18dp, the icon buttons page at 20 and the search, menus, date picker and
// time picker pages at 24. The package is a devDependency, so the build writes
// them into dist.

type GlyphProps = {
  /** The fill. Defaults to the colour of the slot the glyph sits in. */
  readonly color?: ColorValue
  /** The square's side in dp. Defaults to the size of the slot. */
  readonly size?: number
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

// What a search view's back button draws, pointing at the page it returns to.
// It says "back" rather than "to the left", so it mirrors under a right-to-left
// layout.
function ArrowBackGlyph(props: GlyphProps) {
  return (
    <Glyph {...props} mirrored>
      <Path d={arrowBackPath} />
    </Glyph>
  )
}

// Which way a sorted column is ordered. Up is ascending and down is
// descending. Neither mirrors under a right-to-left layout: they say "up" and
// "down" rather than "onward", and those do not flip.
function ArrowDownwardGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d={arrowDownwardPath} />
    </Glyph>
  )
}

// What a menu button draws after its label, pointing at the list it opens.
// Down is down in either writing direction, so it does not mirror.
function ArrowDropDownGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d={arrowDropDownPath} />
    </Glyph>
  )
}

function ArrowUpwardGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d={arrowUpwardPath} />
    </Glyph>
  )
}

// What the date picker's trigger draws: the calendar a date is picked from.
function CalendarGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d={calendarPath} />
    </Glyph>
  )
}

function CheckGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d={checkPath} />
    </Glyph>
  )
}

// Points down at the menu a split button's second half opens, and at the
// list a select opens.
function ChevronDownGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d={chevronDownPath} />
    </Glyph>
  )
}

// Points at the submenu a menu item opens. It says "further in" rather than
// "to the right", so it mirrors under a right-to-left layout.
function ChevronEndGlyph(props: GlyphProps) {
  return (
    <Glyph {...props} mirrored>
      <Path d={chevronEndPath} />
    </Glyph>
  )
}

// What the time picker's trigger draws, and the button that takes its keyboard
// entry back to the dial: the clock a time is picked from.
function ClockGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d={clockPath} />
    </Glyph>
  )
}

function CloseGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d={closePath} />
    </Glyph>
  )
}

/**
 * The svg every glyph draws: the 24-unit grid its path is on, a square of the
 * slot's size filled in the slot's colour, and nothing a screen reader
 * announces, since the control around a glyph carries the name. A glyph whose
 * direction means "onward" or "back" passes `mirrored`, which turns it over
 * under a right-to-left layout as `:dir(rtl)` does on web.
 */
function Glyph({
  children,
  color,
  mirrored = false,
  size,
  style,
  testID,
}: GlyphProps & { readonly children: ReactNode; readonly mirrored?: boolean }) {
  const slot = useIconStyle()
  const side = size ?? slot.size
  return (
    <Svg
      {...HIDDEN}
      color={color ?? slot.color}
      fill="currentColor"
      height={side}
      style={StyleSheet.compose(
        mirrored && I18nManager.isRTL ? glyphStyles.mirrored : undefined,
        style,
      )}
      testID={testID}
      viewBox={`0 0 ${gridSize} ${gridSize}`}
      width={side}
    >
      {children}
    </Svg>
  )
}

// What the time picker's dial draws on the button that switches it to typed
// entry.
function KeyboardGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d={keyboardPath} />
    </Glyph>
  )
}

// The same rule stands for a partly selected checkbox and for a stepper's
// decrement; the two names say which is meant at the call site.
function MinusGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d={minusPath} />
    </Glyph>
  )
}

const IndeterminateGlyph = MinusGlyph

// What an avatar with no name to take initials from draws: Material Design's
// anonymous person, a head over shoulders.
function PersonGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d={personPath} />
    </Glyph>
  )
}

function PlusGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d={plusPath} />
    </Glyph>
  )
}

function SearchGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d={searchPath} />
    </Glyph>
  )
}

export {
  ArrowBackGlyph,
  ArrowDownwardGlyph,
  ArrowDropDownGlyph,
  ArrowUpwardGlyph,
  CalendarGlyph,
  CheckGlyph,
  ChevronDownGlyph,
  ChevronEndGlyph,
  ClockGlyph,
  CloseGlyph,
  IndeterminateGlyph,
  KeyboardGlyph,
  MinusGlyph,
  PersonGlyph,
  PlusGlyph,
  SearchGlyph,
}
export type { GlyphProps }
