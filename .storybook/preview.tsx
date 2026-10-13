import type { Preview } from '@storybook/react-native-web-vite'

import Canvas from './components/Canvas'

const preview: Preview = {
  decorators: [
    (Story, context) => (
      <Canvas
        fill={context.viewMode !== 'docs'}
        scheme={context.globals.theme === 'dark' ? 'dark' : 'light'}
      >
        <Story />
      </Canvas>
    ),
  ],
  // The scheme is a global rather than addon state, as kanso-ui's is, so that
  // anything driving the preview can set it: `&globals=theme:dark` on a story's
  // URL opens it dark. An addon holding the value privately is invisible to
  // everything but its own panel.
  globalTypes: {
    theme: {
      description: 'Colour scheme the story canvas renders in',
      toolbar: {
        dynamicTitle: true,
        items: [
          { icon: 'sun', title: 'Light', value: 'light' },
          { icon: 'moon', title: 'Dark', value: 'dark' },
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
