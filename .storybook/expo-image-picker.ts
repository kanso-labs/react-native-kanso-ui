// What the web Storybook resolves `expo-image-picker` to, through the alias in
// main.ts, for the reason expo-document-picker.ts beside it gives. The camera
// is a file input with `capture`, as the package's own web module opens it,
// which a phone's browser opens on its camera and a desktop's as a chooser,
// and the browser asks for the camera itself, so permission is granted here.
import { chooseFiles } from './expo-document-picker'

type Options = {
  readonly cameraType: 'back' | 'front'
  readonly mediaTypes: ('images' | 'videos')[]
}

async function launchCameraAsync({ cameraType, mediaTypes }: Options) {
  return chooseFiles({
    accept: mediaTypes
      .map((media) => (media === 'images' ? 'image/*' : 'video/*'))
      .join(','),
    capture: cameraType === 'front' ? 'user' : 'environment',
    multiple: false,
  })
}

async function requestCameraPermissionsAsync() {
  return Promise.resolve({ granted: true })
}

export { launchCameraAsync, requestCameraPermissionsAsync }
