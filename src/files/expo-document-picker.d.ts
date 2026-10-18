// The one function the library calls on expo-document-picker, and the parts
// of its answer it reads. It is an optional peer, so its own types are not
// installed here.
declare module 'expo-document-picker' {
  type DocumentPickerAsset = {
    readonly mimeType?: string
    readonly name: string
    readonly size?: number
    readonly uri: string
  }

  type DocumentPickerResult =
    | { readonly assets: null; readonly canceled: true }
    | {
        readonly assets: readonly DocumentPickerAsset[]
        readonly canceled: false
      }

  export function getDocumentAsync(options: {
    readonly base64: boolean
    readonly multiple: boolean
    readonly type: string | string[]
  }): Promise<DocumentPickerResult>

  export type { DocumentPickerAsset }
}
