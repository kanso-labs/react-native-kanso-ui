import type { Preview } from '@storybook/react-native-web-vite'

import { demoThemes } from '../src/theming/themes'
import Canvas from './components/Canvas'

const preview: Preview = {
  decorators: [
    (Story, context) => (
      <Canvas
        fill={context.viewMode !== 'docs'}
        name={
          typeof context.globals.theme === 'string'
            ? context.globals.theme
            : 'light'
        }
      >
        <Story />
      </Canvas>
    ),
  ],
  // The theme is a global rather than addon state, as kanso-ui's is, so that
  // anything driving the preview can set it: `&globals=theme:dark` on a story's
  // URL opens it dark. An addon holding the value privately is invisible to
  // everything but its own panel.
  globalTypes: {
    theme: {
      description: 'Colour theme the story canvas renders in',
      toolbar: {
        dynamicTitle: true,
        // The library's own two, then the demo schemes the Theming pages are
        // built from. Listing those here rather than only on those pages is
        // what lets any component's story be read in one of them, which is
        // the question a scheme actually has to answer.
        items: [
          { icon: 'sun', title: 'Light', value: 'light' },
          { icon: 'moon', title: 'Dark', value: 'dark' },
          ...Object.entries(demoThemes).map(([value, { label }]) => ({
            icon: 'paintbrush' as const,
            title: label,
            value,
          })),
        ],
        title: 'Theme',
      },
    },
  },
  // A fixed default rather than one read from the machine's appearance, as in
  // kanso-ui: the a11y checks would otherwise run in whichever scheme the CI
  // machine happens to prefer.
  initialGlobals: {
    theme: 'light',
  },
  parameters: {
    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail the run on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'error',
    },
    // The canvas draws its own gutter in a token, inside the scope, so the
    // surface reaches the edge of the frame. Storybook's padded layout would
    // put a white margin around it.
    layout: 'fullscreen',
  },
  // Every component gets an Overview page, Storybook's Docs page renamed in
  // main.ts. A page written as a story rather than around a component, such as
  // the Foundations pages, takes `!autodocs`.
  tags: ['autodocs'],
}

export default preview
