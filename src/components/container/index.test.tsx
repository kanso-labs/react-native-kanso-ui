import type { ComponentRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import { afterEach, describe, expect, it } from '@jest/globals'
import { act, render, screen } from '@testing-library/react-native'
import { createRef } from 'react'
import { Dimensions, StyleSheet, Text, View } from 'react-native'

import type { ContainerProps } from '.'

import { Container } from '.'
import { scopeFor } from '../../theme/scope'
import { breakpoints } from '../../tokens/defaults'

const { spacing } = scopeFor('light', {}).theme

const CALL_SITE = { marginTop: 4 }

const INITIAL = {
  screen: Dimensions.get('screen'),
  window: Dimensions.get('window'),
}

afterEach(() => {
  Dimensions.set(INITIAL)
})

function container() {
  return screen.getByTestId('container')
}

// The window as the platform reports it when it changes, which is what
// `useWindowDimensions()` listens for.
function resize(width: number) {
  Dimensions.set({ ...INITIAL, window: { ...INITIAL.window, width } })
}

async function setup(props: Omit<ContainerProps, 'children'> = {}) {
  await render(
    <Container testID="container" {...props}>
      <Text>First item</Text>
    </Container>,
  )
}

function styleOf(element: {
  props: { style?: StyleProp<ViewStyle> }
}): ViewStyle {
  return StyleSheet.flatten([element.props.style]) ?? {}
}

describe('Container', () => {
  describe('the measure', () => {
    it('stops growing at the page measure by default', async () => {
      await setup()

      expect(styleOf(container())).toMatchObject({ maxWidth: 960 })
    })

    it('stops growing at the measure it is given, in dp or as a share', async () => {
      await setup({ maxInlineSize: 420 })
      expect(styleOf(container())).toMatchObject({ maxWidth: 420 })

      await setup({ maxInlineSize: '80%' })
      expect(styleOf(container())).toMatchObject({ maxWidth: '80%' })
    })

    it('centres the leftover space either side', async () => {
      await setup()

      expect(styleOf(container())).toMatchObject({ alignSelf: 'center' })
    })

    it('fills the room it has when that is narrower than the measure', async () => {
      await setup()

      expect(styleOf(container())).toMatchObject({ width: '100%' })
    })
  })

  describe('the gutter', () => {
    it('narrows to the compact margin below 600dp', async () => {
      resize(breakpoints.medium - 1)
      await setup()

      expect(styleOf(container())).toMatchObject({
        paddingHorizontal: spacing.lg,
      })
    })

    it('takes the medium margin from 600dp up', async () => {
      resize(breakpoints.medium)
      await setup()

      expect(styleOf(container())).toMatchObject({
        paddingHorizontal: spacing.xl,
      })
    })

    it('follows the window as it changes', async () => {
      resize(breakpoints.medium - 1)
      await setup()
      await act(() => {
        resize(breakpoints.expanded)
      })

      expect(styleOf(container())).toMatchObject({
        paddingHorizontal: spacing.xl,
      })
    })

    it('closes entirely on request, at either size', async () => {
      resize(breakpoints.medium - 1)
      await setup({ padding: 'none' })
      expect(styleOf(container())).toMatchObject({ paddingHorizontal: 0 })

      resize(breakpoints.medium)
      await setup({ padding: 'none' })
      expect(styleOf(container())).toMatchObject({ paddingHorizontal: 0 })
    })
  })

  describe('as a view', () => {
    it('paints nothing', async () => {
      await setup()

      expect(styleOf(container())).not.toHaveProperty('backgroundColor')
    })

    it('lands `style`, `ref` and `testID` on the view, over its own', async () => {
      const ref = createRef<ComponentRef<typeof View>>()
      await setup({ ref, style: [CALL_SITE, { maxWidth: 300 }] })

      expect(styleOf(container())).toMatchObject({
        ...CALL_SITE,
        maxWidth: 300,
      })
      expect(ref.current).not.toBeNull()
    })

    it('draws its children as they were written', async () => {
      await setup()

      expect(screen.getByText('First item')).toBeTruthy()
    })
  })
})
