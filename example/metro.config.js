const { withStorybook } = require('@storybook/react-native/metro/withStorybook')
const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const config = getDefaultConfig(__dirname)

// The stories and the library they render are in the repository's src, outside
// this app, and Metro only bundles what it watches.
config.watchFolders = [path.resolve(__dirname, '../src')]

// src's imports of react and react-native resolve from this app's
// node_modules. Looking up from src finds the repository's own copies first,
// but Metro only sees files it watches, so it passes them over and falls back
// to this path: one React in the bundle, which every hook needs.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')]

// Generates .rnstorybook/storybook.requires.ts from main.ts whenever Metro
// starts, which is why that file is not committed.
module.exports = withStorybook(config, {
  configPath: path.resolve(__dirname, '.rnstorybook'),
})
