import type { Preview } from '@storybook/react-native'

import Canvas from './Canvas'

const preview: Preview = {
  decorators: [
    (Story, context) => (
      <Canvas
        name={context.globals.theme}
        scrolls={context.parameters.scrolls === true}
      >
        <Story />
      </Canvas>
    ),
  ],
}

export default preview
