import type { DocumentPickerAsset } from 'expo-document-picker'
import type { ImagePickerAsset } from 'expo-image-picker'

type DocumentPicker = typeof import('expo-document-picker')

type ImagePicker = typeof import('expo-image-picker')

/**
 * A file a person picked: what it is called, how big it is and what it is,
 * as web's `File` says, and where it is, which a call site reads it or
 * uploads it from. On iOS and Android that is a `file://` URI in the app's
 * cache, a copy the chooser made, and under React Native Web an object URL.
 */
type PickedFile = {
  readonly name: string
  /** Its size in bytes, where the platform says. */
  readonly size: number | undefined
  /** Its MIME type, or an empty string where the platform does not say, as on web. */
  readonly type: string
  readonly uri: string
}
/** What the chooser is asked for, in web's FileTrigger's words. */
type PickOptions = {
  /** The MIME types the chooser offers, such as `image/png` or `image/*`. Every type when left out. */
  readonly acceptedFileTypes?: readonly string[] | undefined
  /** Whether more than one file can be picked. */
  readonly allowsMultiple?: boolean | undefined
  /**
   * Opens the camera rather than the chooser, facing away from the person
   * for `environment` or towards them for `user`, as web's `capture` does.
   */
  readonly defaultCamera?: 'environment' | 'user' | undefined
}

// The two pickers are optional peers, so each is imported where its absence
// can be caught, as src/clipboard imports expo-clipboard: Metro takes an
// import inside a `try` as optional and bundles an app without it, which it
// would not for an import wrapped any other way. Each is imported once, and
// first when a component that picks mounts, so a press finds it loaded:
// under React Native Web a chooser opens only while the press that asked for
// it still counts as one.
let documentPicker: Promise<DocumentPicker | null> | undefined
let imagePicker: Promise<ImagePicker | null> | undefined

// A photo the camera took is named by the platform where it names one, and
// by the last part of its URI where it does not.
function fromCamera(asset: ImagePickerAsset): PickedFile {
  return {
    name: asset.fileName ?? asset.uri.split('/').at(-1) ?? asset.uri,
    size: asset.fileSize,
    type: asset.mimeType ?? '',
    uri: asset.uri,
  }
}

function fromDocument(asset: DocumentPickerAsset): PickedFile {
  return {
    name: asset.name,
    size: asset.size,
    type: asset.mimeType ?? '',
    uri: asset.uri,
  }
}

async function importDocumentPicker(): Promise<DocumentPicker | null> {
  try {
    return await import(/* @vite-ignore */ 'expo-document-picker')
  } catch {
    return null
  }
}

async function importImagePicker(): Promise<ImagePicker | null> {
  try {
    return await import(/* @vite-ignore */ 'expo-image-picker')
  } catch {
    return null
  }
}

async function loadDocumentPicker() {
  documentPicker ??= importDocumentPicker()
  return documentPicker
}

async function loadImagePicker() {
  imagePicker ??= importImagePicker()
  return imagePicker
}

// The camera takes photos and videos alone, so it is asked for videos when
// the accepted types name one and for photos unless they name only videos.
function mediaTypesOf(accepted: readonly string[]) {
  const videos = accepted.some((type) => type.startsWith('video/'))
  const images = !videos || accepted.some((type) => type.startsWith('image/'))

  return [
    ...(images ? (['images'] as const) : []),
    ...(videos ? (['videos'] as const) : []),
  ]
}

/**
 * Opens the system's chooser, or its camera for `defaultCamera`, and settles
 * on the files picked, or on `null` when the person backed out. A camera the
 * person will not let the app use is backing out too.
 *
 * It rejects, naming the package, when the one it needs is not installed:
 * expo-document-picker for the chooser, expo-image-picker for the camera.
 */
async function pickFiles(
  options: PickOptions,
): Promise<null | readonly PickedFile[]> {
  const accepted = options.acceptedFileTypes ?? []

  if (options.defaultCamera !== undefined) {
    const camera = await loadImagePicker()

    if (camera === null) {
      throw new Error(
        'Taking a photo needs expo-image-picker, which is not installed',
      )
    }
    if (!(await camera.requestCameraPermissionsAsync()).granted) {
      return null
    }

    const shot = await camera.launchCameraAsync({
      cameraType: options.defaultCamera === 'user' ? 'front' : 'back',
      mediaTypes: mediaTypesOf(accepted),
    })

    return shot.canceled ? null : shot.assets.map(fromCamera)
  }

  const picker = await loadDocumentPicker()

  if (picker === null) {
    throw new Error(
      'Picking a file needs expo-document-picker, which is not installed',
    )
  }

  // base64 is off, since the package otherwise reads every file picked into
  // memory, which nothing here asks of it.
  const picked = await picker.getDocumentAsync({
    base64: false,
    multiple: options.allowsMultiple ?? false,
    type: accepted.length === 0 ? '*/*' : [...accepted],
  })

  return picked.canceled ? null : picked.assets.map(fromDocument)
}

/**
 * Picks as `pickFiles` does and hands what was picked to `then`, saying
 * nothing when the person backed out. A failure, a missing package among
 * them, is written to the console, where a missing package is a mistake in
 * the app's setup rather than something the person can do anything about.
 */
async function pickThen(
  options: PickOptions,
  then: (files: readonly PickedFile[]) => void,
): Promise<void> {
  let files: null | readonly PickedFile[]

  try {
    files = await pickFiles(options)
  } catch (error) {
    console.error(error)
    return
  }
  if (files !== null) {
    then(files)
  }
}

/**
 * Starts importing the picker the options open, so that a press finds it
 * there. A component that picks calls it once it mounts.
 */
function preparePicker(options: PickOptions) {
  void (options.defaultCamera === undefined
    ? loadDocumentPicker()
    : loadImagePicker())
}

export { pickFiles, pickThen, preparePicker }
export type { PickedFile, PickOptions }
