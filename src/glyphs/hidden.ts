import type { SvgProps } from 'react-native-svg'

import { Platform } from 'react-native'

// What hides an svg from screen readers, for the glyphs and anything else the
// library draws in one. On iOS and Android that is React Native's two props,
// one for VoiceOver and one for TalkBack. Under React Native Web,
// react-native-svg hands its props to the `<svg>` as they are, so it is
// `aria-hidden` there, which is the one the browser reads.
const HIDDEN = Platform.select<SvgProps>({
  default: {
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  },
  web: { 'aria-hidden': true },
})

export { HIDDEN }
