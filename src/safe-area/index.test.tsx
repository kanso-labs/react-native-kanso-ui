import type { StyleProp, ViewStyle } from 'react-native'
import type { TestInstance, TestNode } from 'test-renderer'

import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react-native'
import { StyleSheet, Text, View } from 'react-native'

import { SafeArea } from '.'

const PLACE = { flexGrow: 1 }
const CONTENT = { alignItems: 'center' } as const

function child(node: TestNode | undefined): TestInstance {
  if (node === undefined || typeof node === 'string') {
    throw new TypeError('expected a view')
  }
  return node
}

async function renderArea(props: Parameters<typeof SafeArea>[0] = {}) {
  await render(
    <View testID="parent">
      <SafeArea {...props}>
        <Text>Label</Text>
      </SafeArea>
    </View>,
  )
  const provider = child(screen.getByTestId('parent').children[0])
  return { area: child(provider.children[0]), provider }
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

describe('SafeArea', () => {
  it('reads its insets from a provider of its own, so they are its own box’s', async () => {
    const { area, provider } = await renderArea()

    expect(provider.type).toBe('RNCSafeAreaProvider')
    expect(area.type).toBe('RNCSafeAreaView')
    expect(screen.getByText('Label')).toBeTruthy()
  })

  it('takes no size of its own at rest, where the provider would fill its parent', async () => {
    const { provider } = await renderArea()

    expect(styleOf(provider).flex).toBe(0)
  })

  it('puts the place it is given on the provider, and the view fills it', async () => {
    const { area, provider } = await renderArea({ style: PLACE })

    expect(styleOf(provider)).toMatchObject(PLACE)
    expect(styleOf(area)).toMatchObject({ flexGrow: 1, flexShrink: 1 })
  })

  it('lays out what it holds by its content style, with the edges it is given', async () => {
    const { area } = await renderArea({
      contentStyle: CONTENT,
      edges: ['top'],
    })

    expect(styleOf(area)).toMatchObject(CONTENT)
    expect(area.props.edges).toEqual({
      bottom: 'off',
      left: 'off',
      right: 'off',
      top: 'additive',
    })
  })
})
