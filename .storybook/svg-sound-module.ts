// What the web Storybook resolves React Native SVG's sound module to, through
// the alias in main.ts. A pressable shape asks that module for Android's click
// sound, and requires it only on Android, but the import inside it names React
// Native's TurboModuleRegistry, which React Native Web does not export, and the
// bundler rejects the missing name before any platform check runs. On the web
// a press makes no sound, so this plays none.
function playTouchSound() {}

export default { playTouchSound }
