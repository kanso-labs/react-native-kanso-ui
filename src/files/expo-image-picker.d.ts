// The two functions the library calls on expo-image-picker, and the parts of
// their answers it reads. It is an optional peer, so its own types are not
// installed here.
declare module 'expo-image-picker' {
  type ImagePickerAsset = {
    readonly fileName?: null | string
    readonly fileSize?: number
    readonly mimeType?: string
    readonly uri: string
  }

  type ImagePickerResult =
    | { readonly assets: null; readonly canceled: true }
    | { readonly assets: readonly ImagePickerAsset[]; readonly canceled: false }

  export function launchCameraAsync(options: {
    readonly cameraType: 'back' | 'front'
    readonly mediaTypes: ('images' | 'videos')[]
  }): Promise<ImagePickerResult>

  export function requestCameraPermissionsAsync(): Promise<{
    readonly granted: boolean
  }>

  export type { ImagePickerAsset }
}
