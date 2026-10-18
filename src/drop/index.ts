import type { PickedFile } from '../files'

// What a drop is, in web's React Aria's words, and how a DropZone takes one
// under React Native Web, where the browser hands the page HTML5 drag and
// drop. iOS and Android hand React Native no drag from another app, so there
// the drop is a pick from the chooser, which DropZone turns into the same
// event.

// The slices of the DOM a drop reaches. The library is built without the DOM's
// types, since Hermes has no DOM, so they are written out here, as far as
// they are read.
type DomDataTransfer = {
  dropEffect: string
  readonly effectAllowed: string
  readonly files: ArrayLike<DomFile>
  readonly getData: (format: string) => string
  readonly items: ArrayLike<{ readonly kind: string; readonly type: string }>
  readonly types: readonly string[]
}

type DomDragEvent = {
  readonly clientX: number
  readonly clientY: number
  readonly dataTransfer: DomDataTransfer | null
  readonly preventDefault: () => void
}

type DomDropTarget = {
  readonly addEventListener: (
    type: string,
    listener: (event: DomDragEvent) => void,
  ) => void
  readonly getBoundingClientRect?: () => {
    readonly left: number
    readonly top: number
  }
  readonly removeEventListener: (
    type: string,
    listener: (event: DomDragEvent) => void,
  ) => void
}

type DomFile = Blob & {
  readonly name: string
  readonly text: () => Promise<string>
}

/** The kinds of thing a drag carries, asked about one MIME type at a time. */
type DragTypes = {
  readonly has: (type: string) => boolean
}

/** Where something being dragged came over the target, from its top start corner. */
type DropEnterEvent = {
  readonly type: 'dropenter'
  readonly x: number
  readonly y: number
}

/** What landed on the target, where, and what the drop does with it. */
type DropEvent = {
  readonly dropOperation: Exclude<DropOperation, 'cancel'>
  readonly items: readonly DropItem[]
  readonly type: 'drop'
  readonly x: number
  readonly y: number
}

/** Where something being dragged left the target. */
type DropExitEvent = {
  readonly type: 'dropexit'
  readonly x: number
  readonly y: number
}

/** What the target does with each moment of a drag, all optional. */
type DropHandlers = {
  readonly getDropOperation?:
    | ((
        types: DragTypes,
        allowedOperations: readonly DropOperation[],
      ) => DropOperation)
    | undefined
  readonly onDrop?: ((event: DropEvent) => void) | undefined
  readonly onDropEnter?: ((event: DropEnterEvent) => void) | undefined
  readonly onDropExit?: ((event: DropExitEvent) => void) | undefined
}

type DropItem = FileDropItem | TextDropItem

/** What a drop does with what it carries, as web's drag and drop names it. */
type DropOperation = 'cancel' | 'copy' | 'link' | 'move'

/**
 * A file dropped or picked: the file itself, and its contents as text, read
 * when asked for.
 */
type FileDropItem = PickedFile & {
  readonly getText: () => Promise<string>
  readonly kind: 'file'
}

/**
 * Text dropped from another page or app, in each of the MIME types it was
 * dragged as, such as `text/plain` and `text/uri-list`. Only React Native
 * Web takes one.
 */
type TextDropItem = {
  readonly getText: (type: string) => Promise<string>
  readonly kind: 'text'
  readonly types: ReadonlySet<string>
}

// Every operation, copy first: a file dragged in from the desktop is copied,
// never moved.
const EVERY: readonly DropOperation[] = ['copy', 'link', 'move']

// The operations each `effectAllowed` the dragging page set leaves open.
const ALLOWED: Readonly<Partial<Record<string, readonly DropOperation[]>>> = {
  all: EVERY,
  copy: ['copy'],
  copyLink: ['copy', 'link'],
  copyMove: ['copy', 'move'],
  link: ['link'],
  linkMove: ['link', 'move'],
  move: ['move'],
  none: [],
  uninitialized: EVERY,
}

// What a drag says of its files before it lands, and what a dragged string is
// listed as. The browser lists files as `Files` alone, so their own types are
// read off the items.
const FILES = 'Files'

// What a drag over the target carries, read off its data transfer while it
// is still over the target, where the browser shows only the types.
function dragTypesOf(transfer: DomDataTransfer): DragTypes {
  const files = Array.from(transfer.items, (item) =>
    item.kind === 'file' ? item.type : undefined,
  ).filter((type) => type !== undefined)

  return typesOf([...transfer.types.filter((type) => type !== FILES), ...files])
}

// What a drop carries, read while the drop event runs, since the browser
// guards the data transfer once it has: each file, and every string type
// together as one text item.
function droppedItemsOf(transfer: DomDataTransfer): DropItem[] {
  const files = Array.from(transfer.files, (file): FileDropItem => ({
    getText: async () => file.text(),
    kind: 'file',
    name: file.name,
    size: file.size,
    type: file.type,
    uri: URL.createObjectURL(file),
  }))
  const texts = new Map(
    transfer.types
      .filter((type) => type !== FILES)
      .map((type) => [type, transfer.getData(type)]),
  )

  if (texts.size === 0) {
    return files
  }

  const text: TextDropItem = {
    getText: async (type) => Promise.resolve(texts.get(type) ?? ''),
    kind: 'text',
    types: new Set(texts.keys()),
  }

  return [...files, text]
}

/** A picked file as a file drop item, whose text is read from its URI. */
function fileItemOf(file: PickedFile): FileDropItem {
  return {
    ...file,
    getText: async () => {
      const response = await fetch(file.uri)
      return response.text()
    },
    kind: 'file',
  }
}

/**
 * Whether drops can be watched on a node: under React Native Web, where a
 * View's node is its DOM element.
 */
function isDropTarget(node: unknown): node is DomDropTarget {
  return (
    typeof node === 'object' &&
    node !== null &&
    'addEventListener' in node &&
    'removeEventListener' in node
  )
}

/** Whether an item is a file, for picking the files out of a drop. */
function isFileDropItem(item: DropItem): item is FileDropItem {
  return item.kind === 'file'
}

/** Whether an item is dropped text, for picking it out of a drop. */
function isTextDropItem(item: DropItem): item is TextDropItem {
  return item.kind === 'text'
}

/**
 * The operation a drop of these types would do: the call site's answer, else
 * the first the drag allows, else none at all.
 */
function operationOf(
  handlers: DropHandlers,
  types: DragTypes,
  allowed: readonly DropOperation[],
): DropOperation {
  const first = allowed.at(0)

  if (first === undefined) {
    return 'cancel'
  }
  return handlers.getDropOperation?.(types, allowed) ?? first
}

/** The kinds of thing a set of items carries, for `getDropOperation`. */
function typesOf(types: Iterable<string>): DragTypes {
  const set = new Set(types)
  return { has: (type) => set.has(type) }
}

/**
 * Takes HTML5 drag and drop on a React Native Web element, as web's React
 * Aria does on a DropZone: `onDropEnter` once something the target will take
 * comes over it, `onDropExit` once it leaves or lands, and `onDrop` with what
 * landed. `handlers` is read at each event, so it can follow the props. A
 * drag crossing the target's own children stays over it, counted in and out
 * as the browser reports each. While `isDisabled` returns true nothing is
 * taken, and the browser shows that nothing will be. It hands back what
 * stops it.
 */
function watchDrops(
  target: DomDropTarget,
  handlers: () => DropHandlers,
  isDisabled: () => boolean,
  setOver: (isOver: boolean) => void,
) {
  let depth = 0
  let over = false

  const point = (event: DomDragEvent) => {
    const box = target.getBoundingClientRect?.() ?? { left: 0, top: 0 }
    return { x: event.clientX - box.left, y: event.clientY - box.top }
  }
  const operation = (event: DomDragEvent) =>
    event.dataTransfer === null || isDisabled()
      ? 'cancel'
      : operationOf(
          handlers(),
          dragTypesOf(event.dataTransfer),
          ALLOWED[event.dataTransfer.effectAllowed] ?? EVERY,
        )
  const leave = (event: DomDragEvent) => {
    if (over) {
      over = false
      setOver(false)
      handlers().onDropExit?.({ type: 'dropexit', ...point(event) })
    }
  }

  const onDragEnter = (event: DomDragEvent) => {
    depth += 1

    if (depth === 1 && operation(event) !== 'cancel') {
      event.preventDefault()
      over = true
      setOver(true)
      handlers().onDropEnter?.({ type: 'dropenter', ...point(event) })
    }
  }
  const onDragOver = (event: DomDragEvent) => {
    const chosen = operation(event)

    if (event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = chosen === 'cancel' ? 'none' : chosen
    }
    if (chosen !== 'cancel') {
      event.preventDefault()
    }
  }
  const onDragLeave = (event: DomDragEvent) => {
    depth = Math.max(0, depth - 1)

    if (depth === 0) {
      leave(event)
    }
  }
  const onDrop = (event: DomDragEvent) => {
    const chosen = operation(event)

    depth = 0
    event.preventDefault()

    if (chosen !== 'cancel' && event.dataTransfer !== null) {
      handlers().onDrop?.({
        dropOperation: chosen,
        items: droppedItemsOf(event.dataTransfer),
        type: 'drop',
        ...point(event),
      })
    }
    leave(event)
  }

  target.addEventListener('dragenter', onDragEnter)
  target.addEventListener('dragover', onDragOver)
  target.addEventListener('dragleave', onDragLeave)
  target.addEventListener('drop', onDrop)

  return () => {
    target.removeEventListener('dragenter', onDragEnter)
    target.removeEventListener('dragover', onDragOver)
    target.removeEventListener('dragleave', onDragLeave)
    target.removeEventListener('drop', onDrop)
  }
}

export {
  fileItemOf,
  isDropTarget,
  isFileDropItem,
  isTextDropItem,
  operationOf,
  typesOf,
  watchDrops,
}
export type {
  DragTypes,
  DropEnterEvent,
  DropEvent,
  DropExitEvent,
  DropHandlers,
  DropItem,
  DropOperation,
  FileDropItem,
  TextDropItem,
}
