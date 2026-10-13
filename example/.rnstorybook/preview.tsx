import type { Preview } from '@storybook/react-native'

import Canvas from './Canvas'

const preview: Preview = {
  decorators: [
    (Story) => (
      <Canvas>
        <Story />
      </Canvas>
    ),
  ],
}

export default preview
