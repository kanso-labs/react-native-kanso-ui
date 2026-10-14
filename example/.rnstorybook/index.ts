import AsyncStorage from '@react-native-async-storage/async-storage'

import { view } from './storybook.requires'

// Storybook keeps the story last opened in the device's storage, so a reload
// comes back to it.
const Storybook = view.getStorybookUI({
  storage: {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
  },
})

export default Storybook
