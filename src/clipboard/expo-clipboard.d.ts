// The one function the library calls on expo-clipboard. It is an optional
// peer, so its own types are not installed here.
declare module 'expo-clipboard' {
  export function setStringAsync(text: string): Promise<boolean>
}
