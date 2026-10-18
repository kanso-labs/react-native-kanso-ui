import { afterEach, describe, expect, it, jest } from '@jest/globals'

import type { DropHandlers } from '.'

import {
  fileItemOf,
  isDropTarget,
  isFileDropItem,
  isTextDropItem,
  operationOf,
  typesOf,
  watchDrops,
} from '.'

type FakeDragEvent = ReturnType<typeof dragEvent>

type GetDropOperation = NonNullable<DropHandlers['getDropOperation']>

type Listener = (event: FakeDragEvent) => void

// A file as the browser hands one over.
function domFile(name: string, type: string, text: string) {
  return new File([text], name, { type })
}

function dragEvent({
  effectAllowed = 'all',
  files = [],
  noTransfer = false,
  strings = {},
}: {
  readonly effectAllowed?: string
  readonly files?: readonly File[]
  readonly noTransfer?: boolean
  readonly strings?: Readonly<Record<string, string>>
} = {}) {
  const transfer = {
    dropEffect: 'unset',
    effectAllowed,
    files,
    getData: (format: string) => strings[format] ?? '',
    items: [
      ...files.map((file) => ({ kind: 'file', type: file.type })),
      ...Object.keys(strings).map((type) => ({ kind: 'string', type })),
    ],
    types: [...(files.length > 0 ? ['Files'] : []), ...Object.keys(strings)],
  }

  return {
    clientX: 30,
    clientY: 50,
    dataTransfer: noTransfer ? null : transfer,
    preventDefault: jest.fn(),
  }
}

// A DOM element, as far as watchDrops reaches one, placed 10 across and 20
// down the page.
function fakeTarget({ boxed = true } = {}) {
  const listeners = new Map<string, Set<Listener>>()

  return {
    addEventListener: (type: string, listener: Listener) => {
      const set = listeners.get(type) ?? new Set()
      set.add(listener)
      listeners.set(type, set)
    },
    dispatch: (type: string, event: FakeDragEvent) => {
      for (const listener of listeners.get(type) ?? []) {
        listener(event)
      }
    },
    ...(boxed ? { getBoundingClientRect: () => ({ left: 10, top: 20 }) } : {}),
    listening: () =>
      [...listeners.values()].reduce((count, set) => count + set.size, 0),
    removeEventListener: (type: string, listener: Listener) => {
      listeners.get(type)?.delete(listener)
    },
  }
}

function watch(
  handlers: DropHandlers = {},
  { boxed = true, disabled = false } = {},
) {
  const target = fakeTarget({ boxed })
  const over: boolean[] = []
  const stop = watchDrops(
    target,
    () => handlers,
    () => disabled,
    (isOver) => {
      over.push(isOver)
    },
  )

  return { over, stop, target }
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('watchDrops', () => {
  it('enters once for a drag crossing the target and its children, and exits once it leaves', () => {
    const onDropEnter = jest.fn()
    const onDropExit = jest.fn()
    const { over, target } = watch({ onDropEnter, onDropExit })
    const event = dragEvent({ strings: { 'text/plain': 'Label' } })

    target.dispatch('dragenter', event)
    target.dispatch('dragenter', event)
    target.dispatch('dragleave', event)

    expect(onDropEnter).toHaveBeenCalledTimes(1)
    expect(onDropEnter).toHaveBeenCalledWith({
      type: 'dropenter',
      x: 20,
      y: 30,
    })
    expect(onDropExit).not.toHaveBeenCalled()
    expect(event.preventDefault).toHaveBeenCalledTimes(1)

    target.dispatch('dragleave', event)

    expect(onDropExit).toHaveBeenCalledWith({ type: 'dropexit', x: 20, y: 30 })
    expect(over).toEqual([true, false])
  })

  it('never counts below nothing, so a stray leave does not shift the next drag', () => {
    const onDropEnter = jest.fn()
    const { target } = watch({ onDropEnter })
    const event = dragEvent({ strings: { 'text/plain': 'Label' } })

    target.dispatch('dragleave', event)
    target.dispatch('dragenter', event)

    expect(onDropEnter).toHaveBeenCalledTimes(1)
  })

  it('reads the point from the page where the target has no box', () => {
    const onDropEnter = jest.fn()
    const { target } = watch({ onDropEnter }, { boxed: false })

    target.dispatch('dragenter', dragEvent({ strings: { 'text/plain': 'x' } }))

    expect(onDropEnter).toHaveBeenCalledWith({
      type: 'dropenter',
      x: 30,
      y: 50,
    })
  })

  it('takes the first operation the drag allows, and shows it as the drop effect', () => {
    const { target } = watch()
    const copying = dragEvent({ strings: { 'text/plain': 'x' } })
    const moving = dragEvent({
      effectAllowed: 'linkMove',
      strings: { 'text/plain': 'x' },
    })
    const unknown = dragEvent({
      effectAllowed: 'sideways',
      strings: { 'text/plain': 'x' },
    })

    target.dispatch('dragover', copying)
    target.dispatch('dragover', moving)
    target.dispatch('dragover', unknown)

    expect(copying.dataTransfer?.dropEffect).toBe('copy')
    expect(copying.preventDefault).toHaveBeenCalled()
    expect(moving.dataTransfer?.dropEffect).toBe('link')
    expect(unknown.dataTransfer?.dropEffect).toBe('copy')
  })

  it.each([
    ['copy', ['copy']],
    ['copyLink', ['copy', 'link']],
    ['copyMove', ['copy', 'move']],
    ['link', ['link']],
    ['linkMove', ['link', 'move']],
    ['move', ['move']],
    ['uninitialized', ['copy', 'link', 'move']],
    ['all', ['copy', 'link', 'move']],
  ])('asks getDropOperation with what %s allows', (effectAllowed, allowed) => {
    const getDropOperation = jest.fn<GetDropOperation>(() => 'copy')
    const { target } = watch({ getDropOperation })

    target.dispatch(
      'dragover',
      dragEvent({ effectAllowed, strings: { 'text/plain': 'x' } }),
    )

    expect(getDropOperation.mock.calls.at(0)?.[1]).toEqual(allowed)
  })

  it('refuses a drag that allows nothing, and one the call site refuses', () => {
    const onDropEnter = jest.fn()
    const onDrop = jest.fn()
    const nothing = dragEvent({
      effectAllowed: 'none',
      strings: { 'text/plain': 'x' },
    })
    const allowed = watch({ onDrop, onDropEnter })

    allowed.target.dispatch('dragenter', nothing)
    allowed.target.dispatch('dragover', nothing)
    allowed.target.dispatch('drop', nothing)

    expect(nothing.dataTransfer?.dropEffect).toBe('none')
    expect(onDropEnter).not.toHaveBeenCalled()
    expect(onDrop).not.toHaveBeenCalled()
    expect(allowed.over).toEqual([])

    const refused = watch({
      getDropOperation: () => 'cancel',
      onDrop,
      onDropEnter,
    })
    const event = dragEvent({ strings: { 'text/plain': 'x' } })

    refused.target.dispatch('dragenter', event)
    refused.target.dispatch('dragover', event)
    refused.target.dispatch('drop', event)

    expect(event.dataTransfer?.dropEffect).toBe('none')
    expect(onDropEnter).not.toHaveBeenCalled()
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('hands getDropOperation the types a drag carries, files by their own type', () => {
    const getDropOperation = jest.fn<GetDropOperation>(() => 'copy')
    const { target } = watch({ getDropOperation })

    target.dispatch(
      'dragover',
      dragEvent({
        files: [domFile('first.png', 'image/png', '')],
        strings: { 'text/uri-list': 'https://example.com' },
      }),
    )

    const types = getDropOperation.mock.calls.at(0)?.[0]

    expect(types?.has('image/png')).toBe(true)
    expect(types?.has('text/uri-list')).toBe(true)
    expect(types?.has('Files')).toBe(false)
    expect(types?.has('text/plain')).toBe(false)
  })

  it('takes nothing while disabled', () => {
    const onDrop = jest.fn()
    const onDropEnter = jest.fn()
    const { target } = watch({ onDrop, onDropEnter }, { disabled: true })
    const event = dragEvent({ strings: { 'text/plain': 'x' } })

    target.dispatch('dragenter', event)
    target.dispatch('dragover', event)
    target.dispatch('drop', event)

    expect(onDropEnter).not.toHaveBeenCalled()
    expect(onDrop).not.toHaveBeenCalled()
    expect(event.dataTransfer?.dropEffect).toBe('none')
  })

  it('takes nothing from a drag with no data transfer', () => {
    const onDrop = jest.fn()
    const onDropEnter = jest.fn()
    const { target } = watch({ onDrop, onDropEnter })
    const event = dragEvent({ noTransfer: true })

    target.dispatch('dragenter', event)
    target.dispatch('dragover', event)
    target.dispatch('drop', event)

    expect(onDropEnter).not.toHaveBeenCalled()
    expect(onDrop).not.toHaveBeenCalled()
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('hands onDrop each file and the text together, then exits', async () => {
    const order: string[] = []
    const onDrop = jest.fn<NonNullable<DropHandlers['onDrop']>>(() => {
      order.push('drop')
    })
    const onDropExit = jest.fn(() => {
      order.push('exit')
    })
    jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:first')
    const { over, target } = watch({ onDrop, onDropExit })
    const event = dragEvent({
      files: [domFile('first.txt', 'text/plain', 'First item')],
      strings: { 'text/plain': 'Label', 'text/uri-list': 'https://x.test' },
    })

    target.dispatch('dragenter', event)
    target.dispatch('drop', event)

    expect(order).toEqual(['drop', 'exit'])
    expect(over).toEqual([true, false])
    expect(event.preventDefault).toHaveBeenCalledTimes(2)

    const dropped = onDrop.mock.calls.at(0)?.[0]

    expect(dropped).toMatchObject({
      dropOperation: 'copy',
      type: 'drop',
      x: 20,
      y: 30,
    })
    expect(dropped?.items).toHaveLength(2)

    const file = dropped?.items.find(isFileDropItem)
    const text = dropped?.items.find(isTextDropItem)

    expect(dropped?.items.map((item) => item.kind)).toEqual(['file', 'text'])

    expect(file).toMatchObject({
      kind: 'file',
      name: 'first.txt',
      size: 10,
      type: 'text/plain',
      uri: 'blob:first',
    })
    expect(text).toMatchObject({ kind: 'text' })
    expect([...(text?.types ?? [])]).toEqual(['text/plain', 'text/uri-list'])
    await expect(file?.getText()).resolves.toBe('First item')
    await expect(text?.getText('text/uri-list')).resolves.toBe('https://x.test')
    await expect(text?.getText('text/html')).resolves.toBe('')
  })

  it('hands onDrop files alone when the drag carries no text', () => {
    const onDrop = jest.fn<NonNullable<DropHandlers['onDrop']>>()
    jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:first')
    const { target } = watch({ onDrop })

    target.dispatch(
      'drop',
      dragEvent({ files: [domFile('first.png', 'image/png', '')] }),
    )

    expect(onDrop.mock.calls.at(0)?.[0].items.map((item) => item.kind)).toEqual(
      ['file'],
    )
  })

  it('exits on a drop only after entering, and reports the drop it was asked for', () => {
    const onDrop = jest.fn<NonNullable<DropHandlers['onDrop']>>()
    const onDropExit = jest.fn()
    const { over, target } = watch({
      getDropOperation: () => 'move',
      onDrop,
      onDropExit,
    })

    target.dispatch('drop', dragEvent({ strings: { 'text/plain': 'x' } }))

    expect(onDrop.mock.calls.at(0)?.[0].dropOperation).toBe('move')
    expect(onDropExit).not.toHaveBeenCalled()
    expect(over).toEqual([])
  })

  it('starts the count again after a drop', () => {
    const onDropEnter = jest.fn()
    const { target } = watch({ onDropEnter })
    const event = dragEvent({ strings: { 'text/plain': 'x' } })

    target.dispatch('dragenter', event)
    target.dispatch('dragenter', event)
    target.dispatch('drop', event)
    target.dispatch('dragenter', event)

    expect(onDropEnter).toHaveBeenCalledTimes(2)
  })

  it('reads the handlers at each event', () => {
    const first = jest.fn()
    const second = jest.fn()
    let handlers: DropHandlers = { onDropEnter: first }
    const target = fakeTarget()
    const event = dragEvent({ strings: { 'text/plain': 'x' } })

    watchDrops(
      target,
      () => handlers,
      () => false,
      () => undefined,
    )
    handlers = { onDropEnter: second }
    target.dispatch('dragenter', event)

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalled()
  })

  it('stops listening once stopped', () => {
    const { stop, target } = watch()

    expect(target.listening()).toBe(4)

    stop()

    expect(target.listening()).toBe(0)
  })
})

describe('the drop helpers', () => {
  it('reads a picked file’s text from its URI', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('First item'))
    const item = fileItemOf({
      name: 'first.txt',
      size: 10,
      type: 'text/plain',
      uri: 'file:///cache/first.txt',
    })

    expect(item).toMatchObject({ kind: 'file', name: 'first.txt' })
    await expect(item.getText()).resolves.toBe('First item')
    expect(fetch).toHaveBeenCalledWith('file:///cache/first.txt')
  })

  it('tells files from text', () => {
    const file = fileItemOf({ name: 'a', size: 1, type: '', uri: 'file:///a' })
    const text = {
      getText: async () => Promise.resolve(''),
      kind: 'text' as const,
      types: new Set<string>(),
    }

    expect(isFileDropItem(file)).toBe(true)
    expect(isFileDropItem(text)).toBe(false)
    expect(isTextDropItem(text)).toBe(true)
    expect(isTextDropItem(file)).toBe(false)
  })

  it('asks types one at a time', () => {
    const types = typesOf(['image/png'])

    expect(types.has('image/png')).toBe(true)
    expect(types.has('image/jpeg')).toBe(false)
  })

  it('takes the call site’s operation, the first allowed, or none', () => {
    const types = typesOf([])

    expect(operationOf({}, types, ['link', 'copy'])).toBe('link')
    expect(
      operationOf({ getDropOperation: () => 'move' }, types, ['copy']),
    ).toBe('move')
    expect(operationOf({ getDropOperation: () => 'move' }, types, [])).toBe(
      'cancel',
    )
  })

  it('takes a node with listeners as a drop target, and nothing else', () => {
    expect(isDropTarget(fakeTarget())).toBe(true)
    expect(isDropTarget({ addEventListener: () => undefined })).toBe(false)
    expect(isDropTarget({ removeEventListener: () => undefined })).toBe(false)
    expect(isDropTarget(null)).toBe(false)
    expect(isDropTarget('node')).toBe(false)
  })
})
