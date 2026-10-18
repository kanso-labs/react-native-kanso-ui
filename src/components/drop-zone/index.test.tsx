import type { ComponentRef, ReactElement } from 'react'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native'
import { createRef } from 'react'
import { Platform, StyleSheet, View } from 'react-native'

import type { DragTypes, DropEvent, DropOperation } from '../../drop'
import type { PickedFile } from '../../files'

import { DropZone, FileTrigger } from '.'
import { isFileDropItem } from '../../drop'
import { withOpacity } from '../../theme/color'
import { scopeFor } from '../../theme/scope'
import { Button } from '../button'
import { IconButton } from '../icon-button'

type Asset = {
  readonly fileName?: null | string
  readonly fileSize?: number
  readonly mimeType?: string
  readonly name?: string
  readonly size?: number
  readonly uri: string
}

type CameraOptions = {
  readonly cameraType: 'back' | 'front'
  readonly mediaTypes: ('images' | 'videos')[]
}

type DocumentOptions = {
  readonly base64: boolean
  readonly multiple: boolean
  readonly type: string | string[]
}

type Picked =
  | { readonly assets: null; readonly canceled: true }
  | { readonly assets: readonly Asset[]; readonly canceled: false }

const mockGetDocument = jest.fn<(options: DocumentOptions) => Promise<Picked>>()
const mockLaunchCamera = jest.fn<(options: CameraOptions) => Promise<Picked>>()
const mockRequestCamera = jest.fn<() => Promise<{ granted: boolean }>>()

// Each picker as it is imported, in order.
const mockImported: string[] = []

// The app has both pickers installed in this file. Without them is
// without-pickers.test.tsx, since each import is settled once per file.
jest.mock(
  'expo-document-picker',
  () => {
    mockImported.push('expo-document-picker')
    return {
      getDocumentAsync: async (options: DocumentOptions) =>
        mockGetDocument(options),
    }
  },
  { virtual: true },
)

jest.mock(
  'expo-image-picker',
  () => {
    mockImported.push('expo-image-picker')
    return {
      launchCameraAsync: async (options: CameraOptions) =>
        mockLaunchCamera(options),
      requestCameraPermissionsAsync: async () => mockRequestCamera(),
    }
  },
  { virtual: true },
)

const { theme } = scopeFor('light', {})
const { colors, radii, spacing, stateLayerOpacity, typography } = theme

const LABEL = 'Drop a file here'

const IMAGES = ['image/png', 'image/jpeg']

const CALL_SITE = { marginTop: 4 }

// A call site taking nothing it is offered.
function refuse(): DropOperation {
  return 'cancel'
}

const DISABLED = withOpacity(
  colors.onSurface,
  stateLayerOpacity.disabledContent,
)

// Where a press lands on the target.
const PRESS = {
  currentTarget: { measure: () => undefined },
  nativeEvent: { locationX: 12, locationY: 34 },
}

const FIRST: Asset = {
  mimeType: 'image/png',
  name: 'first.png',
  size: 2048,
  uri: 'file:///cache/first.png',
}

const SECOND: Asset = {
  name: 'second.bin',
  uri: 'file:///cache/second.bin',
}

function picked(...assets: Asset[]): Picked {
  return { assets, canceled: false }
}

const CANCELLED: Picked = { assets: null, canceled: true }

type Host = ReturnType<typeof screen.getByTestId>

function dropOf(onDrop: jest.Mock<(event: DropEvent) => void>) {
  const event = onDrop.mock.calls.at(0)?.[0]

  if (event === undefined) {
    throw new Error('Nothing was dropped')
  }
  return event
}

function label() {
  return screen.getByText(LABEL, { includeHiddenElements: true })
}

function pressTarget() {
  return screen.getByRole('button', { name: LABEL })
}

async function pressZone() {
  await fireEvent.press(pressTarget(), PRESS)
  await settle()
}

// Lets a pick land.
async function settle() {
  await act(async () => {
    await new Promise((resolve) => {
      setImmediate(resolve)
    })
  })
}

// Renders a FileTrigger with a camera and presses the button it wraps.
async function shoot(element: ReactElement) {
  await render(element)
  await fireEvent.press(screen.getByRole('button', { name: 'Label' }))
  await settle()
}

// The press target's state layer, which its press feedback draws first.
function stateLayer(): Host {
  const surface = pressTarget().children.at(0)
  const layer =
    typeof surface === 'string' ? undefined : surface?.children.at(0)

  if (layer === undefined || typeof layer === 'string') {
    throw new Error('Missing state layer')
  }
  return layer
}

function styleOf(element: {
  props: { style?: StyleProp<TextStyle | ViewStyle> }
}): TextStyle & ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

// What the browser hands a listener, as far as a drop reads it: a string
// dragged in from another page.
function webDragEvent() {
  return {
    clientX: 5,
    clientY: 6,
    dataTransfer: {
      dropEffect: 'unset',
      effectAllowed: 'all',
      files: [],
      getData: () => 'Label',
      items: [{ kind: 'string', type: 'text/plain' }],
      types: ['text/plain'],
    },
    preventDefault: () => undefined,
  }
}

function zone() {
  return screen.getByTestId('zone')
}

beforeEach(() => {
  mockGetDocument.mockResolvedValue(picked(FIRST))
  mockLaunchCamera.mockResolvedValue(picked(FIRST))
  mockRequestCamera.mockResolvedValue({ granted: true })
})

afterEach(() => {
  jest.restoreAllMocks()
  mockGetDocument.mockReset()
  mockLaunchCamera.mockReset()
  mockRequestCamera.mockReset()
})

// First in the file on purpose: each picker is imported once per file, so
// only the first components to mount show it happening.
describe('before anything is pressed', () => {
  it('imports the picker each component opens as it mounts', async () => {
    await render(<DropZone label={LABEL} />)
    await settle()

    expect(mockImported).toEqual(['expo-document-picker'])

    await render(
      <FileTrigger defaultCamera="user">
        <Button>Label</Button>
      </FileTrigger>,
    )
    await settle()

    expect(mockImported).toEqual(['expo-document-picker', 'expo-image-picker'])
    expect(mockGetDocument).not.toHaveBeenCalled()
    expect(mockLaunchCamera).not.toHaveBeenCalled()
  })
})

describe('DropZone', () => {
  it('is the outlined card with a dashed rule', async () => {
    await render(<DropZone label={LABEL} testID="zone" />)

    expect(styleOf(zone())).toMatchObject({
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.outlineVariant,
      borderRadius: radii.md,
      borderStyle: 'dashed',
      borderWidth: 1,
      boxSizing: 'border-box',
      gap: spacing.md,
      justifyContent: 'center',
      minHeight: 160,
      padding: spacing.xl,
    })
  })

  it('draws its label centred in body medium, in on surface variant', async () => {
    await render(<DropZone label={LABEL} testID="zone" />)

    expect(styleOf(label())).toMatchObject({
      color: colors.onSurfaceVariant,
      fontSize: typography.bodyMediumSize,
      lineHeight: typography.bodyMediumLineHeight,
      textAlign: 'center',
    })
  })

  it('names its press target with the label, and keeps the label from a screen reader and from touches', async () => {
    await render(<DropZone label={LABEL} testID="zone" />)

    expect(pressTarget()).toBeTruthy()
    expect(screen.queryByText(LABEL)).toBeNull()
    expect(zone().props['aria-label']).toBeUndefined()
    expect(zone().props.role).toBeUndefined()

    const box = label().parent

    expect(box === null ? {} : styleOf(box)).toMatchObject({
      pointerEvents: 'none',
    })
  })

  it('takes aria-label over the label as its name', async () => {
    await render(<DropZone aria-label="Name" label={LABEL} testID="zone" />)

    expect(screen.getByRole('button', { name: 'Name' })).toBeTruthy()
  })

  it('draws no label without one, and is named by aria-label alone', async () => {
    await render(<DropZone aria-label="Name" testID="zone" />)

    expect(screen.getByRole('button', { name: 'Name' })).toBeTruthy()
    expect(zone().children).toHaveLength(1)
  })

  it('fills its whole surface with the press target, under what it holds', async () => {
    await render(
      <DropZone label={LABEL} testID="zone">
        <Button>Label</Button>
      </DropZone>,
    )

    expect(zone().children.at(0)).toBe(pressTarget())
    expect(styleOf(pressTarget())).toMatchObject({
      borderRadius: radii.md,
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    })
    expect(screen.getByRole('button', { name: 'Label' })).toBeTruthy()
  })

  it('draws its state layer in on surface', async () => {
    await render(<DropZone label={LABEL} testID="zone" />)

    await fireEvent(pressTarget(), 'hoverIn', {})

    expect(styleOf(stateLayer())).toMatchObject({
      backgroundColor: colors.onSurface,
      opacity: stateLayerOpacity.hover,
    })
  })

  it('draws its focus ring over its own edge', async () => {
    await render(<DropZone label={LABEL} testID="zone" />)

    expect(styleOf(pressTarget()).outlineWidth).toBeUndefined()
    expect(styleOf(pressTarget()).outlineOffset).toBeUndefined()

    await fireEvent(pressTarget(), 'focus', {})

    expect(styleOf(pressTarget())).toMatchObject({
      outlineColor: colors.primary,
      outlineOffset: -1,
      outlineWidth: 2,
    })
  })

  it('hands what was picked to onDrop, as a drop that copies where it was pressed', async () => {
    const onDrop = jest.fn<(event: DropEvent) => void>()
    mockGetDocument.mockResolvedValue(picked(FIRST, SECOND))
    await render(<DropZone label={LABEL} onDrop={onDrop} testID="zone" />)

    await pressZone()

    expect(mockGetDocument).toHaveBeenCalledWith({
      base64: false,
      multiple: true,
      type: '*/*',
    })

    const event = dropOf(onDrop)

    expect(event).toMatchObject({
      dropOperation: 'copy',
      type: 'drop',
      x: 12,
      y: 34,
    })
    expect(event.items).toEqual([
      expect.objectContaining({
        kind: 'file',
        name: 'first.png',
        size: 2048,
        type: 'image/png',
        uri: 'file:///cache/first.png',
      }),
      expect.objectContaining({
        kind: 'file',
        name: 'second.bin',
        size: undefined,
        type: '',
        uri: 'file:///cache/second.bin',
      }),
    ])
  })

  it('reads a picked file’s text from where the chooser put it', async () => {
    const onDrop = jest.fn<(event: DropEvent) => void>()
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('First item'))
    await render(<DropZone label={LABEL} onDrop={onDrop} testID="zone" />)

    await pressZone()

    const item = dropOf(onDrop).items.find(isFileDropItem)

    await expect(item?.getText()).resolves.toBe('First item')
    expect(fetch).toHaveBeenCalledWith('file:///cache/first.png')
  })

  it('asks getDropOperation about what was picked, allowing a copy alone', async () => {
    const onDrop = jest.fn<(event: DropEvent) => void>()
    const getDropOperation = jest.fn<
      (types: DragTypes, allowed: readonly DropOperation[]) => DropOperation
    >((types) => (types.has('image/png') ? 'link' : 'cancel'))
    await render(
      <DropZone
        getDropOperation={getDropOperation}
        label={LABEL}
        onDrop={onDrop}
        testID="zone"
      />,
    )

    await pressZone()

    expect(getDropOperation.mock.calls.at(0)?.[1]).toEqual(['copy'])
    expect(dropOf(onDrop).dropOperation).toBe('link')
  })

  it('drops nothing the call site refuses', async () => {
    const onDrop = jest.fn<(event: DropEvent) => void>()
    await render(
      <DropZone
        getDropOperation={refuse}
        label={LABEL}
        onDrop={onDrop}
        testID="zone"
      />,
    )

    await pressZone()

    expect(mockGetDocument).toHaveBeenCalled()
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('drops nothing when the person backs out', async () => {
    const onDrop = jest.fn<(event: DropEvent) => void>()
    mockGetDocument.mockResolvedValue(CANCELLED)
    await render(<DropZone label={LABEL} onDrop={onDrop} testID="zone" />)

    await pressZone()

    expect(onDrop).not.toHaveBeenCalled()
  })

  it('picks with no onDrop to hand it to', async () => {
    await render(<DropZone label={LABEL} testID="zone" />)

    await pressZone()

    expect(mockGetDocument).toHaveBeenCalled()
  })

  it('writes a failed pick to the console, and drops nothing', async () => {
    const onDrop = jest.fn<(event: DropEvent) => void>()
    const failure = new Error('Different document picking in progress')
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    mockGetDocument.mockRejectedValue(failure)
    await render(<DropZone label={LABEL} onDrop={onDrop} testID="zone" />)

    await pressZone()

    expect(error).toHaveBeenCalledWith(failure)
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('lands style, ref and testID on the target', async () => {
    const ref = createRef<ComponentRef<typeof View>>()
    await render(
      <DropZone label={LABEL} ref={ref} style={CALL_SITE} testID="zone" />,
    )

    expect(styleOf(zone())).toMatchObject({ marginTop: 4 })
    expect(typeof ref.current?.measure).toBe('function')
  })
})

describe('the disabled DropZone', () => {
  it('fades its rule and its label, and keeps its surface', async () => {
    await render(<DropZone isDisabled label={LABEL} testID="zone" />)

    expect(styleOf(zone())).toMatchObject({
      backgroundColor: colors.surface,
      borderColor: DISABLED,
      borderStyle: 'dashed',
    })
    expect(styleOf(label()).color).toBe(DISABLED)
  })

  it('is announced as disabled, and opens nothing', async () => {
    const onDrop = jest.fn<(event: DropEvent) => void>()
    await render(
      <DropZone isDisabled label={LABEL} onDrop={onDrop} testID="zone" />,
    )

    // The press target carries the state, as it carries the name.
    expect(pressTarget()).toBeDisabled()
    expect(zone().props['aria-disabled']).toBeUndefined()

    await pressZone()

    expect(mockGetDocument).not.toHaveBeenCalled()
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('draws no state layer', async () => {
    await render(<DropZone isDisabled label={LABEL} testID="zone" />)

    await fireEvent(pressTarget(), 'hoverIn', {})

    expect(styleOf(stateLayer()).opacity).toBe(0)
  })
})

describe('DropZone under React Native Web', () => {
  type Listener = (event: unknown) => void

  // Under React Native Web a View's node is its DOM element, which takes
  // listeners. The test renderer's nodes take none, so every node is lent
  // the two methods for the case, keeping what each is handed.
  const listeners = new Map<string, Listener>()
  let restore: (() => void) | undefined

  beforeEach(async () => {
    jest.replaceProperty(Platform, 'OS', 'web')

    const ref = createRef<ComponentRef<typeof View>>()
    const probe = await render(<View ref={ref} />)
    const prototype: unknown = Object.getPrototypeOf(ref.current)

    await probe.unmount()

    if (typeof prototype !== 'object' || prototype === null) {
      throw new Error('A View has no node')
    }
    Object.defineProperties(prototype, {
      addEventListener: {
        configurable: true,
        value: (type: string, listener: Listener) => {
          listeners.set(type, listener)
        },
      },
      removeEventListener: {
        configurable: true,
        value: (type: string) => {
          listeners.delete(type)
        },
      },
    })
    restore = () => {
      Reflect.deleteProperty(prototype, 'addEventListener')
      Reflect.deleteProperty(prototype, 'removeEventListener')
    }
  })

  // What is still mounted unmounts while the methods are there to stop it.
  afterEach(async () => {
    await cleanup()
    restore?.()
    restore = undefined
    listeners.clear()
  })

  async function dispatch(type: string) {
    await act(() => {
      listeners.get(type)?.(webDragEvent())
    })
  }

  it('is no press target, and names itself as a group', async () => {
    await render(<DropZone label={LABEL} testID="zone" />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(zone().props).toMatchObject({ 'aria-label': LABEL, role: 'group' })
  })

  it('takes aria-label over the label as its name', async () => {
    await render(<DropZone aria-label="Name" label={LABEL} testID="zone" />)

    expect(zone().props['aria-label']).toBe('Name')
  })

  it('names nothing without a name', async () => {
    await render(<DropZone testID="zone" />)

    expect(zone().props.role).toBeUndefined()
    expect(zone().props['aria-label']).toBeUndefined()
  })

  it('fills with primary container while something is over it, and stops once it leaves', async () => {
    const onDropEnter = jest.fn()
    const onDropExit = jest.fn()
    await render(
      <DropZone
        label={LABEL}
        onDropEnter={onDropEnter}
        onDropExit={onDropExit}
        testID="zone"
      />,
    )

    await dispatch('dragenter')

    expect(onDropEnter).toHaveBeenCalledWith({ type: 'dropenter', x: 5, y: 6 })
    expect(styleOf(zone())).toMatchObject({
      backgroundColor: colors.primaryContainer,
      borderColor: colors.primary,
      borderStyle: 'solid',
    })
    expect(styleOf(label()).color).toBe(colors.onPrimaryContainer)

    await dispatch('dragleave')

    expect(onDropExit).toHaveBeenCalled()
    expect(styleOf(zone())).toMatchObject({
      backgroundColor: colors.surface,
      borderStyle: 'dashed',
    })
  })

  it('stops drawing a drag over it once it is disabled', async () => {
    const view = await render(<DropZone label={LABEL} testID="zone" />)

    await dispatch('dragenter')
    await view.rerender(<DropZone isDisabled label={LABEL} testID="zone" />)

    expect(styleOf(zone())).toMatchObject({
      backgroundColor: colors.surface,
      borderStyle: 'dashed',
    })
    expect(styleOf(label()).color).toBe(DISABLED)
  })

  it('hands onDrop what landed, read from the latest props', async () => {
    const first = jest.fn<(event: DropEvent) => void>()
    const second = jest.fn<(event: DropEvent) => void>()
    const view = await render(
      <DropZone label={LABEL} onDrop={first} testID="zone" />,
    )

    await view.rerender(
      <DropZone label={LABEL} onDrop={second} testID="zone" />,
    )
    await dispatch('drop')

    expect(first).not.toHaveBeenCalled()
    expect(dropOf(second)).toMatchObject({ dropOperation: 'copy', x: 5, y: 6 })
  })

  it('says it is disabled once it is, takes nothing and draws no fill', async () => {
    const onDrop = jest.fn<(event: DropEvent) => void>()
    const onDropEnter = jest.fn()
    const view = await render(
      <DropZone label={LABEL} onDrop={onDrop} testID="zone" />,
    )

    expect(zone().props['aria-disabled']).toBeUndefined()

    await view.rerender(
      <DropZone
        isDisabled
        label={LABEL}
        onDrop={onDrop}
        onDropEnter={onDropEnter}
        testID="zone"
      />,
    )
    await dispatch('dragenter')
    await dispatch('drop')

    expect(zone().props['aria-disabled']).toBe(true)
    expect(onDropEnter).not.toHaveBeenCalled()
    expect(onDrop).not.toHaveBeenCalled()
    expect(styleOf(zone()).backgroundColor).toBe(colors.surface)
  })

  it('stops listening once it unmounts', async () => {
    const view = await render(<DropZone label={LABEL} testID="zone" />)

    expect(listeners.size).toBe(4)

    await view.unmount()

    expect(listeners.size).toBe(0)
  })
})

describe('FileTrigger', () => {
  it('opens the chooser from the button it wraps, after the button’s own press', async () => {
    const order: string[] = []
    const onPress = jest.fn(() => {
      order.push('press')
    })
    const onSelect = jest.fn((files: readonly PickedFile[]) => {
      order.push(`select ${files.length}`)
    })
    mockGetDocument.mockImplementation(async () => {
      order.push('pick')
      return Promise.resolve(picked(FIRST))
    })
    await render(
      <FileTrigger onSelect={onSelect}>
        <Button onPress={onPress}>Label</Button>
      </FileTrigger>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Label' }))
    await settle()

    expect(order).toEqual(['press', 'pick', 'select 1'])
    expect(onSelect).toHaveBeenCalledWith([
      {
        name: 'first.png',
        size: 2048,
        type: 'image/png',
        uri: 'file:///cache/first.png',
      },
    ])
  })

  it('hands the chooser the accepted types and whether it takes several', async () => {
    await render(
      <FileTrigger acceptedFileTypes={IMAGES} allowsMultiple>
        <IconButton aria-label="Label" />
      </FileTrigger>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Label' }))
    await settle()

    expect(mockGetDocument).toHaveBeenCalledWith({
      base64: false,
      multiple: true,
      type: [...IMAGES],
    })
  })

  it('takes one file of any type unless told otherwise', async () => {
    await render(
      <FileTrigger>
        <Button>Label</Button>
      </FileTrigger>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Label' }))
    await settle()

    expect(mockGetDocument).toHaveBeenCalledWith({
      base64: false,
      multiple: false,
      type: '*/*',
    })
  })

  it('selects nothing when the person backs out', async () => {
    const onSelect = jest.fn()
    mockGetDocument.mockResolvedValue(CANCELLED)
    await render(
      <FileTrigger onSelect={onSelect}>
        <Button>Label</Button>
      </FileTrigger>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Label' }))
    await settle()

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('opens nothing from a disabled button', async () => {
    await render(
      <FileTrigger>
        <Button isDisabled>Label</Button>
      </FileTrigger>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Label' }))
    await settle()

    expect(mockGetDocument).not.toHaveBeenCalled()
  })

  it('reaches only the buttons inside it', async () => {
    await render(
      <>
        <FileTrigger>
          <Button>Label</Button>
        </FileTrigger>
        <Button>Other</Button>
      </>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Other' }))
    await settle()

    expect(mockGetDocument).not.toHaveBeenCalled()
  })

  it('picks with no onSelect to hand it to', async () => {
    await render(
      <FileTrigger>
        <Button>Label</Button>
      </FileTrigger>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Label' }))
    await settle()

    expect(mockGetDocument).toHaveBeenCalled()
  })

  it('works inside a DropZone, beside the zone’s own press target', async () => {
    const onDrop = jest.fn<(event: DropEvent) => void>()
    const onSelect = jest.fn()
    await render(
      <DropZone label={LABEL} onDrop={onDrop} testID="zone">
        <FileTrigger onSelect={onSelect}>
          <Button>Label</Button>
        </FileTrigger>
      </DropZone>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'Label' }))
    await settle()

    expect(onSelect).toHaveBeenCalled()
    expect(onDrop).not.toHaveBeenCalled()
  })
})

describe('FileTrigger’s camera', () => {
  it('opens the camera facing away for environment, after asking to use it', async () => {
    const onSelect = jest.fn()
    mockLaunchCamera.mockResolvedValue(
      picked({
        fileName: 'photo.jpg',
        fileSize: 4096,
        mimeType: 'image/jpeg',
        uri: 'file:///cache/photo.jpg',
      }),
    )

    await shoot(
      <FileTrigger defaultCamera="environment" onSelect={onSelect}>
        <Button>Label</Button>
      </FileTrigger>,
    )

    expect(mockRequestCamera).toHaveBeenCalled()
    expect(mockLaunchCamera).toHaveBeenCalledWith({
      cameraType: 'back',
      mediaTypes: ['images'],
    })
    expect(mockGetDocument).not.toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalledWith([
      {
        name: 'photo.jpg',
        size: 4096,
        type: 'image/jpeg',
        uri: 'file:///cache/photo.jpg',
      },
    ])
  })

  it('faces the person for user', async () => {
    await shoot(
      <FileTrigger defaultCamera="user">
        <Button>Label</Button>
      </FileTrigger>,
    )

    expect(mockLaunchCamera.mock.calls.at(0)?.[0].cameraType).toBe('front')
  })

  it.each([
    [['video/mp4'], ['videos']],
    [
      ['image/png', 'video/*'],
      ['images', 'videos'],
    ],
    [['image/*'], ['images']],
    [['application/pdf'], ['images']],
  ])('asks for %j as %j', async (accepted, media) => {
    await shoot(
      <FileTrigger acceptedFileTypes={accepted} defaultCamera="environment">
        <Button>Label</Button>
      </FileTrigger>,
    )

    expect(mockLaunchCamera.mock.calls.at(0)?.[0].mediaTypes).toEqual(media)
  })

  it('names a photo by its URI where the platform gives no name', async () => {
    const onSelect = jest.fn()
    mockLaunchCamera.mockResolvedValue(
      picked({ fileName: null, uri: 'file:///cache/ABC-123.jpg' }),
    )

    await shoot(
      <FileTrigger defaultCamera="environment" onSelect={onSelect}>
        <Button>Label</Button>
      </FileTrigger>,
    )

    expect(onSelect).toHaveBeenCalledWith([
      {
        name: 'ABC-123.jpg',
        size: undefined,
        type: '',
        uri: 'file:///cache/ABC-123.jpg',
      },
    ])
  })

  it('takes a refused camera as backing out', async () => {
    const onSelect = jest.fn()
    mockRequestCamera.mockResolvedValue({ granted: false })

    await shoot(
      <FileTrigger defaultCamera="environment" onSelect={onSelect}>
        <Button>Label</Button>
      </FileTrigger>,
    )

    expect(mockLaunchCamera).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('selects nothing when the person backs out of the camera', async () => {
    const onSelect = jest.fn()
    mockLaunchCamera.mockResolvedValue(CANCELLED)

    await shoot(
      <FileTrigger defaultCamera="environment" onSelect={onSelect}>
        <Button>Label</Button>
      </FileTrigger>,
    )

    expect(onSelect).not.toHaveBeenCalled()
  })
})
