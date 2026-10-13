import { StyleSheet } from 'react-native'

// The glyphs' one style, apart from the glyphs in ./index.tsx so that file
// exports components alone, which is what keeps fast refresh working for it.
const glyphStyles = StyleSheet.create({
  mirrored: {
    transform: [{ scaleX: -1 }],
  },
})

export { glyphStyles }
