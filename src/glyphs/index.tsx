import type { ReactNode } from 'react'
import type { ColorValue, StyleProp, ViewStyle } from 'react-native'

import { I18nManager, StyleSheet } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { useIconStyle } from './icon-style'
import { glyphStyles } from './styles'

// The glyphs the library's own controls draw, the same set kanso-ui draws on
// web: the check and the dash a checkbox shows, the plus and minus a number
// field's steppers show, the magnifier and cross a search field shows, and the
// rest named beside each one. Private to the library, as on web: a call site
// with icons of its own passes them to the slots that take a node, and reads
// the slot's colour and size through `useIconStyle()`.
//
// The paths are kanso-ui's, unchanged: Material Symbols on their 24-unit grid,
// which is what the checkbox page draws at 18dp, the icon buttons page at 20
// and the search, menus, date picker and time picker pages at 24.

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
      <Path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
    </Glyph>
  )
}

// Which way a sorted column is ordered. Up is ascending and down is
// descending. Neither mirrors under a right-to-left layout: they say "up" and
// "down" rather than "onward", and those do not flip.
function ArrowDownwardGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z" />
    </Glyph>
  )
}

// What a menu button draws after its label, pointing at the list it opens.
// Down is down in either writing direction, so it does not mirror.
function ArrowDropDownGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M7 10l5 5 5-5z" />
    </Glyph>
  )
}

function ArrowUpwardGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" />
    </Glyph>
  )
}

// What the date picker's trigger draws: the calendar a date is picked from.
function CalendarGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
    </Glyph>
  )
}

function CheckGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </Glyph>
  )
}

// Points down at the menu a split button's second half opens.
function ChevronDownGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" />
    </Glyph>
  )
}

// Points at the submenu a menu item opens. It says "further in" rather than
// "to the right", so it mirrors under a right-to-left layout.
function ChevronEndGlyph(props: GlyphProps) {
  return (
    <Glyph {...props} mirrored>
      <Path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
    </Glyph>
  )
}

// What the time picker's trigger draws, and the button that takes its keyboard
// entry back to the dial: the clock a time is picked from.
function ClockGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
    </Glyph>
  )
}

function CloseGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
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
      accessibilityElementsHidden
      color={color ?? slot.color}
      fill="currentColor"
      height={side}
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.compose(
        mirrored && I18nManager.isRTL ? glyphStyles.mirrored : undefined,
        style,
      )}
      testID={testID}
      viewBox="0 0 24 24"
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
      <Path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 12H4V7h16v10zm-9-9h2v2h-2zm0 3h2v2h-2zM8 8h2v2H8zm0 3h2v2H8zm-3 0h2v2H5zm0-3h2v2H5zm3 6h8v2H8zm6-3h2v2h-2zm0-3h2v2h-2zm3 3h2v2h-2zm0-3h2v2h-2z" />
    </Glyph>
  )
}

// The same rule stands for a partly selected checkbox and for a stepper's
// decrement; the two names say which is meant at the call site.
function MinusGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M19 13H5v-2h14v2z" />
    </Glyph>
  )
}

const IndeterminateGlyph = MinusGlyph

// What an avatar with no name to take initials from draws: Material Design's
// anonymous person, a head over shoulders.
function PersonGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </Glyph>
  )
}

function PlusGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
    </Glyph>
  )
}

function SearchGlyph(props: GlyphProps) {
  return (
    <Glyph {...props}>
      <Path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
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
