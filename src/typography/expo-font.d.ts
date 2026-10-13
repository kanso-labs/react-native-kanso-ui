// The one function the library calls on expo-font. It is an optional peer, so
// its own types are not installed here.
declare module 'expo-font' {
  export function isLoaded(fontFamily: string): boolean
}
