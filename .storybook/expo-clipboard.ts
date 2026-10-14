// What the web Storybook resolves `expo-clipboard` to, through the alias in
// main.ts. The package peers on `expo` itself, which would bring the whole of
// Expo into the root for one function, so the root does not install it, and
// without it CopyField draws no button. This writes through the browser's
// clipboard as the package's own web module does first, and reports a refusal
// as the package does, by resolving `false`. The device Storybook in example/
// installs the package itself.
async function setStringAsync(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export { setStringAsync }
