import type { StyleProp, ViewStyle } from 'react-native'

import { describe, expect, it, jest } from '@jest/globals'
import { render, screen, within } from '@testing-library/react-native'
import { createContext, use, useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { KuiTheme } from '../tokens/defaults'

import { ThemeScope } from '../theme-scope'
import { type ResolvedTheme, useTheme } from '../theme/scope'
import { Overlay, OverlayHost } from './host'

const ACCENT: KuiTheme = { '--kui-color-primary': '#7d5260' }

// What a case sets around something, to see whether it reaches an overlay.
const Marker = createContext('unset')

const mounted = jest.fn()
const seen: ResolvedTheme[] = []

// Opens an overlay while a screen beside it stays mounted.
function App({ open }: { readonly open: boolean }) {
  return (
    <ThemeScope>
      {open ? <Labelled label="first" /> : null}
      <Screen />
    </ThemeScope>
  )
}

function Capture() {
  seen.push(useTheme())
  return null
}

// Closes the first of two overlays.
function Closing({ first }: { readonly first: boolean }) {
  return (
    <ThemeScope>
      {first ? <Labelled label="first" /> : null}
      <Labelled label="second" />
    </ThemeScope>
  )
}

function Labelled({ label }: { readonly label: string }) {
  return (
    <Overlay>
      <View testID={`overlay ${label}`} />
    </Overlay>
  )
}

// Opens a second overlay declared ahead of the first, so the stack follows
// the order they open in rather than the order they are written in.
function Opening({ second }: { readonly second: boolean }) {
  return (
    <ThemeScope>
      {second ? <Labelled label="second" /> : null}
      <Labelled label="first" />
    </ThemeScope>
  )
}

function ReadMarker() {
  return <Text testID="marker">{use(Marker)}</Text>
}

// Changes what the first of two overlays draws.
function Renaming({ label }: { readonly label: string }) {
  return (
    <ThemeScope>
      <Overlay>
        <View testID={`overlay ${label}`} />
      </Overlay>
      <Labelled label="second" />
    </ThemeScope>
  )
}

function Screen() {
  useEffect(() => {
    mounted()
  }, [])
  return null
}

// The labels of the overlays drawn, from the bottom of the stack to the top.
function stack() {
  return screen.queryAllByTestId(/^overlay /).map(testIdOf)
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

function testIdOf(element: { props: { testID?: string } }) {
  return element.props.testID
}

describe('Overlay', () => {
  it('draws above the screen rather than where it is declared', async () => {
    await render(
      <ThemeScope>
        <View testID="screen">
          <Labelled label="first" />
        </View>
      </ThemeScope>,
    )

    expect(stack()).toEqual(['overlay first'])
    expect(
      within(screen.getByTestId('screen')).queryByTestId('overlay first'),
    ).toBeNull()
  })

  it('reads the ThemeScope around it', async () => {
    seen.length = 0

    await render(
      <ThemeScope scheme="light">
        <ThemeScope scheme="dark" testID="inner" theme={ACCENT}>
          <Overlay>
            <Capture />
          </Overlay>
        </ThemeScope>
      </ThemeScope>,
    )

    expect(seen.at(-1)?.colors.primary).toBe('#7d5260')
    // The dark scheme's surface, which the light scope at the root does not
    // have.
    expect(seen.at(-1)?.colors.surface).toBe(
      styleOf(screen.getByTestId('inner')).backgroundColor,
    )
  })

  it('stacks a later overlay above an earlier one', async () => {
    await render(<Opening second={false} />)
    await screen.rerender(<Opening second />)

    expect(stack()).toEqual(['overlay first', 'overlay second'])
  })

  it('leaves the other open when one closes', async () => {
    await render(<Closing first />)
    await screen.rerender(<Closing first={false} />)

    expect(stack()).toEqual(['overlay second'])
  })

  it('keeps its place in the stack when its content changes', async () => {
    await render(<Renaming label="first" />)
    await screen.rerender(<Renaming label="renamed" />)

    expect(stack()).toEqual(['overlay renamed', 'overlay second'])
  })

  it('opens and closes without remounting the screen', async () => {
    mounted.mockClear()

    await render(<App open={false} />)
    await screen.rerender(<App open />)
    expect(stack()).toEqual(['overlay first'])
    await screen.rerender(<App open={false} />)

    expect(stack()).toEqual([])
    expect(mounted).toHaveBeenCalledTimes(1)
  })

  it('starts from none of the context around the control that opened it', async () => {
    await render(
      <ThemeScope>
        <Marker value="around the control">
          <Overlay>
            <ReadMarker />
          </Overlay>
        </Marker>
      </ThemeScope>,
    )

    expect(screen.getByTestId('marker')).toHaveTextContent('unset')
  })

  it('keeps the context around the app', async () => {
    await render(
      <Marker value="around the app">
        <ThemeScope>
          <Overlay>
            <ReadMarker />
          </Overlay>
        </ThemeScope>
      </Marker>,
    )

    expect(screen.getByTestId('marker')).toHaveTextContent('around the app')
  })

  it('passes a touch through wherever no overlay is drawn', async () => {
    await render(
      <ThemeScope>
        <Labelled label="first" />
      </ThemeScope>,
    )

    const entry = screen.getByTestId('overlay first').parent
    const layer = entry?.parent

    expect(entry && styleOf(entry)).toMatchObject({
      pointerEvents: 'box-none',
    })
    expect(layer && styleOf(layer)).toMatchObject({
      pointerEvents: 'box-none',
    })
  })

  it('draws in the nearest host', async () => {
    await render(
      <ThemeScope>
        <View testID="nested">
          <OverlayHost>
            <Labelled label="first" />
          </OverlayHost>
        </View>
      </ThemeScope>,
    )

    expect(
      within(screen.getByTestId('nested')).getByTestId('overlay first'),
    ).toBeTruthy()
  })

  it('needs a ThemeScope around the app', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await expect(render(<Labelled label="first" />)).rejects.toThrow(
        'Wrap the app in a ThemeScope',
      )
    } finally {
      error.mockRestore()
    }
  })
})

describe('ThemeScope', () => {
  it('hosts overlays only at the root', async () => {
    await render(
      <ThemeScope>
        <ThemeScope testID="nested">
          <Labelled label="first" />
        </ThemeScope>
      </ThemeScope>,
    )

    expect(stack()).toEqual(['overlay first'])
    expect(
      within(screen.getByTestId('nested')).queryByTestId('overlay first'),
    ).toBeNull()
  })
})
