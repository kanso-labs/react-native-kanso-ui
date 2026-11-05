// The one export the library reads from react-native-keyboard-controller. It
// is an optional peer, so its own types are not installed here.
declare module 'react-native-keyboard-controller' {
  export const KeyboardEvents: {
    addListener(
      name:
        | 'keyboardDidHide'
        | 'keyboardDidShow'
        | 'keyboardWillHide'
        | 'keyboardWillShow',
      listener: (event: { readonly height: number }) => void,
    ): { remove(): void }
  }
}
