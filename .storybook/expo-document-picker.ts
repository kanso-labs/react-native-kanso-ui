// What the web Storybook resolves `expo-document-picker` to, through the alias
// in main.ts. The package peers on `expo` itself, which would bring the whole
// of Expo into the root for one function, so the root does not install it,
// and without it a FileTrigger's button opens nothing. This opens the
// browser's chooser through a file input, as the package's own web module
// does, and settles as it does: on the files picked, or as cancelled. The
// device Storybook in example/ installs the package itself.
type Options = {
  readonly multiple: boolean
  readonly type: string | string[]
}

/**
 * Opens a file input, and settles on what it was given. Shared with the
 * stand-in for expo-image-picker, which adds `capture`.
 */
async function chooseFiles({
  accept,
  capture,
  multiple,
}: {
  readonly accept: string
  readonly capture?: string
  readonly multiple: boolean
}) {
  const input = document.createElement('input')

  input.type = 'file'
  input.accept = accept
  input.multiple = multiple
  input.style.display = 'none'
  if (capture !== undefined) {
    input.setAttribute('capture', capture)
  }
  document.body.append(input)

  return new Promise<
    | { readonly assets: null; readonly canceled: true }
    | {
        readonly assets: readonly {
          readonly fileName: string
          readonly fileSize: number
          readonly mimeType: string
          readonly name: string
          readonly size: number
          readonly uri: string
        }[]
        readonly canceled: false
      }
  >((resolve) => {
    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? [])

      input.remove()
      resolve(
        files.length === 0
          ? { assets: null, canceled: true }
          : {
              assets: files.map((file) => ({
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                name: file.name,
                size: file.size,
                uri: URL.createObjectURL(file),
              })),
              canceled: false,
            },
      )
    })
    input.addEventListener('cancel', () => {
      input.remove()
      resolve({ assets: null, canceled: true })
    })
    input.click()
  })
}

async function getDocumentAsync({ multiple, type }: Options) {
  return chooseFiles({
    accept: Array.isArray(type) ? type.join(',') : type,
    multiple,
  })
}

export { chooseFiles, getDocumentAsync }
