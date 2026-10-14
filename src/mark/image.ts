import { useState } from 'react'

/** What a picture's own `Image` reports, bound to the `src` it shows. */
type ImageHandlers = {
  readonly onError: () => void
  readonly onLoad: () => void
}

type ImageLoadingStatus = 'error' | 'loaded' | 'loading'

/**
 * Whether the picture at `src` can be shown yet, from what the component's
 * own `Image` reports, as kanso-ui's `useImageLoadingStatus` reads it from an
 * `<img>`. The image is rendered from the start and hidden until it loads,
 * so the platform fetches it as it would any image, and hands `onLoad` and
 * `onError` to that element. A component keeps its fallback until the
 * picture is ready and brings it back if the picture fails, so a blank or
 * broken image is never what shows.
 *
 * `previous` is the picture last loaded, while a new `src` is still loading,
 * so the component can keep showing it rather than drop back to the fallback
 * for as long as the new one takes. It is cached by then, so it shows at
 * once.
 *
 * No `src` counts as a failure, since the outcome is the same: the fallback
 * shows. Outcomes are remembered against the `src` they came for, so a
 * change of `src` reads as loading rather than as the old outcome.
 */
function useImageLoadingStatus(src: string | undefined) {
  const [loaded, setLoaded] = useState<null | string>(null)
  const [failed, setFailed] = useState<null | string>(null)

  let status: ImageLoadingStatus = 'loading'
  if (src === undefined || failed === src) {
    status = 'error'
  } else if (loaded === src) {
    status = 'loaded'
  }

  // Bound to the `src` the element is keyed on, which is the one its events
  // are about: an element left over from the `src` before cannot report for
  // the one after it.
  function handlersFor(uri: string): ImageHandlers {
    return {
      onError: () => {
        setFailed(uri)
      },
      onLoad: () => {
        setLoaded(uri)
      },
    }
  }

  return {
    handlersFor,
    previous: status === 'loading' ? (loaded ?? undefined) : undefined,
    status,
  }
}

export type { ImageLoadingStatus }

export { useImageLoadingStatus }
