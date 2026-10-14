import type { StorybookConfig } from '@storybook/react-native'

// The story files the web Storybook reads, in the repository's src.
const main: StorybookConfig = {
  stories: ['../../src/**/*.stories.tsx'],
}

export default main
