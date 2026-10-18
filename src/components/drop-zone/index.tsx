import type { ComponentRef, ReactNode, Ref } from 'react'
import type {
  GestureResponderEvent,
  HostInstance,
  StyleProp,
  TextStyle,
  ViewStyle,
  View as ViewType,
} from 'react-native'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import type { ButtonSlots } from '../../button/slots'
import type {
  DragTypes,
  DropEnterEvent,
  DropEvent,
  DropExitEvent,
  DropOperation,
} from '../../drop'
import type { PickedFile } from '../../files'

import { ButtonSlotContext } from '../../button/slots'
import {
  fileItemOf,
  isDropTarget,
  operationOf,
  typesOf,
  watchDrops,
} from '../../drop'
import { pickThen, preparePicker } from '../../files'
import { usePressFeedback } from '../../press'
import { refsOf } from '../../ref'
import { withOpacity } from '../../theme/color'
import { useTheme } from '../../theme/scope'
import { composeStyles, themedStyles } from '../../theme/styles'
import { useTypeRole } from '../../typography/roles'

// A place to drop files, and a way to open the file chooser from a button, as
// kanso-ui's DropZone and FileTrigger are. Material Design carries no page for
// either, so the target is drawn from the nearest thing it does carry, the
// outlined card: the same surface, 1dp outline variant rule and medium
// corner, at least 160dp tall with 24dp of padding and its label centred in
// body medium. Web's two departures from that card are kept. **The rule is
// dashed**, since a solid one reads as a card holding content and a dashed one
// as a place to put something. **Something over it fills it** with primary
// container, the rule turning primary and solid, the pair a selected row
// takes, so "this is the target" looks like "this is the one chosen". It
// switches at once rather than over web's short transition, as a card's
// press colours do.
//
// What a drop is depends on the platform, since neither iOS nor Android hands
// React Native a drag from another app. **Under React Native Web it is HTML5
// drag and drop**, as on web, through src/drop. **On iOS and Android the
// target is a press target** that opens the chooser and hands `onDrop` what
// was picked, as file drop items, so a call site writes one handler for both.
// The drop operation it reports is `copy`, which is true of a pick as it is
// of a drop from the desktop: the chooser hands the app a copy in its cache,
// and the person's own file stays where it was. So a call site reading the
// operation is told nothing a pick does not do. The press target lies under
// what the target holds, so a button inside it still takes its own presses,
// and VoiceOver reaches both rather than one.
//
// Disabled is web's: the rule and the label in on surface at the disabled
// content opacity, over the surface, so a dashed rule at full strength stops
// reading as somewhere to aim at, and nothing is taken.
//
// FileTrigger renders nothing of its own. The Button, IconButton or Fab it
// wraps opens the chooser through src/button's default slot, the way a
// button opens the overlay around it, as web's React Aria hands its
// FileTrigger's press to whatever it wraps.

// The least height a target takes, from web: room enough to aim at.
const MIN_HEIGHT = 160

const stylesOf = themedStyles(
  ({ colors, radii, spacing, stateLayerOpacity }) => {
    const disabled = withOpacity(
      colors.onSurface,
      stateLayerOpacity.disabledContent,
    )

    return StyleSheet.create({
      // The label, in the muted role, centred under the target's content.
      label: {
        color: colors.onSurfaceVariant,
        textAlign: 'center',
      },
      labelBox: {
        pointerEvents: 'none',
      },
      labelDisabled: {
        color: disabled,
      },
      labelOver: {
        color: colors.onPrimaryContainer,
      },
      // The press target fills the target under its content, inside the
      // rule. Its ring is drawn over the target's edge rather than around
      // it, as web's is, so a parent clipping its children never cuts the
      // outer half away: set 1dp into the press target, it covers the rule
      // and the 1dp inside it.
      press: {
        borderRadius: radii.md,
      },
      ring: {
        outlineOffset: -1,
      },
      root: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.outlineVariant,
        borderRadius: radii.md,
        borderStyle: 'dashed',
        borderWidth: 1,
        boxSizing: 'border-box',
        gap: spacing.md,
        justifyContent: 'center',
        minHeight: MIN_HEIGHT,
        padding: spacing.xl,
      },
      rootDisabled: {
        borderColor: disabled,
      },
      rootOver: {
        backgroundColor: colors.primaryContainer,
        borderColor: colors.primary,
        borderStyle: 'solid',
      },
    })
  },
)

type DropZoneProps = {
  /**
   * Names the target without drawing anything, for a page that already says
   * what it takes. Beats `label` as the name.
   */
  readonly 'aria-label'?: string
  /** What the target holds beside its label, such as a FileTrigger. */
  readonly children?: ReactNode
  /**
   * What a drop of these types would do, from the operations the drag
   * allows: `cancel` refuses it. A pick on iOS and Android allows `copy`
   * alone. Left out, the first the drag allows.
   */
  readonly getDropOperation?: (
    types: DragTypes,
    allowedOperations: readonly DropOperation[],
  ) => DropOperation
  /**
   * Takes nothing: no drop, and on iOS and Android no press, drawn faded.
   * @default false
   */
  readonly isDisabled?: boolean
  /**
   * What the target says it is for, drawn inside it and used as its name. A
   * string rather than a node, since it is what names the target; anything
   * richer goes in `children`.
   */
  readonly label?: string
  /**
   * Called with what landed: what was dropped under React Native Web, what
   * was picked on iOS and Android.
   */
  readonly onDrop?: (event: DropEvent) => void
  /** Called once something the target takes comes over it. Under React Native Web alone. */
  readonly onDropEnter?: (event: DropEnterEvent) => void
  /** Called once what came over it leaves, or lands. Under React Native Web alone. */
  readonly onDropExit?: (event: DropExitEvent) => void
  readonly ref?: Ref<ComponentRef<typeof ViewType>>
  readonly style?: StyleProp<ViewStyle>
  readonly testID?: string
}

type FileTriggerProps = {
  /** The MIME types the chooser offers, such as `image/png` or `image/*`. Every type when left out. */
  readonly acceptedFileTypes?: readonly string[]
  /** Whether more than one file can be picked. @default false */
  readonly allowsMultiple?: boolean
  /** The Button, IconButton or Fab that opens the chooser. */
  readonly children?: ReactNode
  /**
   * Opens the camera rather than the chooser, facing away from the person
   * for `environment` or towards them for `user`, as web's `capture` does.
   * It takes one photo, or a video where `acceptedFileTypes` names a video
   * type.
   */
  readonly defaultCamera?: 'environment' | 'user'
  /** Called with what was picked. Not called when the person backs out. */
  readonly onSelect?: (files: readonly PickedFile[]) => void
}

/**
 * A place to drop files. Under React Native Web it takes HTML5 drag and drop,
 * as kanso-ui's does; on iOS and Android, which hand an app no drag from
 * another, pressing it opens the file chooser, and `onDrop` is handed what
 * was picked. Either way `onDrop` is handed the items, which
 * `isFileDropItem` and `isTextDropItem` pick apart.
 *
 * ```tsx
 * <DropZone label="Drop here" onDrop={handleDrop}>
 *   <FileTrigger onSelect={handleSelect}>
 *     <Button variant="outlined">Label</Button>
 *   </FileTrigger>
 * </DropZone>
 * ```
 *
 * It is drawn from the outlined card, with a dashed rule rather than a solid
 * one, and fills with the primary container while something is over it.
 * `label` both draws the words and names the target; `aria-label` names it
 * without drawing anything.
 *
 * The chooser is expo-document-picker's, which an app installs alongside the
 * library. Without it a press writes to the console that the package is
 * missing, and nothing opens.
 *
 * `style`, `ref` and `testID` land on the target itself, which is what a
 * layout places.
 */
function DropZone({
  'aria-label': ariaLabel,
  children,
  getDropOperation,
  isDisabled = false,
  label,
  onDrop,
  onDropEnter,
  onDropExit,
  ref,
  style,
  testID,
}: DropZoneProps) {
  const theme = useTheme()
  const { colors, radii } = theme
  const styles = stylesOf(theme)
  const bodyMedium = useTypeRole('bodyMedium')
  const [isOver, setOver] = useState(false)
  const node = useRef<HostInstance | null>(null)
  const web = Platform.OS === 'web'
  const feedback = usePressFeedback({
    color: colors.onSurface,
    corners: { borderRadius: radii.md },
    disabled: isDisabled,
  })
  const handlersNow = useEffectEvent(() => ({
    getDropOperation,
    onDrop,
    onDropEnter,
    onDropExit,
  }))
  const disabledNow = useEffectEvent(() => isDisabled)
  const name = ariaLabel ?? label
  const over = isOver && !isDisabled

  useEffect(() => {
    if (!web) {
      preparePicker({})
      return undefined
    }

    const target = node.current

    if (!isDropTarget(target)) {
      return undefined
    }
    return watchDrops(
      target,
      () => handlersNow(),
      () => disabledNow(),
      setOver,
    )
  }, [web])

  return (
    <View
      // Under React Native Web the target names itself, as a group, and says
      // it is disabled, since there is no press target to carry either.
      aria-disabled={web && isDisabled ? true : undefined}
      aria-label={web ? name : undefined}
      ref={refsOf<HostInstance>(ref, node)}
      role={web && name !== undefined ? 'group' : undefined}
      style={composeStyles<ViewStyle>(
        styles.root,
        over ? styles.rootOver : undefined,
        isDisabled ? styles.rootDisabled : undefined,
        style,
      )}
      testID={testID}
    >
      {web ? null : (
        <Pressable
          {...feedback.handlers}
          aria-label={name}
          disabled={isDisabled}
          onPress={pressOf(getDropOperation, onDrop)}
          role="button"
          style={composeStyles<ViewStyle>(
            StyleSheet.absoluteFill,
            styles.press,
            feedback.ring,
            feedback.ring === undefined ? undefined : styles.ring,
          )}
        >
          {feedback.layer}
        </Pressable>
      )}
      {label === undefined ? null : (
        // Hidden from a screen reader, which hears it as the target's name,
        // and from touches, which land on the press target under it.
        <View aria-hidden style={styles.labelBox}>
          <Text
            style={composeStyles<TextStyle>(
              bodyMedium,
              styles.label,
              over ? styles.labelOver : undefined,
              isDisabled ? styles.labelDisabled : undefined,
            )}
          >
            {label}
          </Text>
        </View>
      )}
      {children}
    </View>
  )
}

/**
 * Opens the file chooser from the button it wraps, and hands `onSelect`
 * what was picked.
 *
 * ```tsx
 * <FileTrigger acceptedFileTypes={['image/*']} onSelect={handleSelect}>
 *   <Button>Label</Button>
 * </FileTrigger>
 * ```
 *
 * It renders nothing of its own, so it takes no `style`: what is seen is the
 * Button, IconButton or Fab it wraps, which opens the chooser after its own
 * `onPress`. `allowsMultiple` takes more than one file, and `defaultCamera`
 * opens the camera instead. kanso-ui's `acceptDirectory` is not here, since
 * neither iOS's chooser nor Android's picks a folder.
 *
 * The chooser is expo-document-picker's and the camera expo-image-picker's,
 * which an app installs alongside the library, the second only for
 * `defaultCamera`. Without the one it needs, a press writes to the console
 * which package is missing, and nothing opens.
 */
function FileTrigger({
  acceptedFileTypes,
  allowsMultiple,
  children,
  defaultCamera,
  onSelect,
}: FileTriggerProps) {
  useEffect(() => {
    preparePicker({ defaultCamera })
  }, [defaultCamera])

  const pick = () => {
    void pickThen(
      { acceptedFileTypes, allowsMultiple, defaultCamera },
      (files) => {
        onSelect?.(files)
      },
    )
  }

  return <ButtonSlotContext value={slotsOf(pick)}>{children}</ButtonSlotContext>
}

// What pressing the target does on iOS and Android: opens the chooser and
// hands `onDrop` what was picked, as a drop that copies, where the call site
// takes the copy. Built by a call rather than inline at the prop, which is
// what react-perf's jsx-no-new-function-as-prop is after; the React Compiler
// memoises the result on its inputs.
function pressOf(
  getDropOperation: DropZoneProps['getDropOperation'],
  onDrop: DropZoneProps['onDrop'],
) {
  return (event: GestureResponderEvent) => {
    const { locationX: x, locationY: y } = event.nativeEvent

    void pickThen({ allowsMultiple: true }, (files) => {
      const dropOperation = operationOf(
        { getDropOperation },
        typesOf(files.map((file) => file.type)),
        ['copy'],
      )

      if (dropOperation !== 'cancel') {
        onDrop?.({
          dropOperation,
          items: files.map(fileItemOf),
          type: 'drop',
          x,
          y,
        })
      }
    })
  }
}

// The slots a FileTrigger hands its button: its press in the default slot,
// in place of any overlay's around it. Built by a call rather than inline at
// the prop, which is what react-perf's jsx-no-new-object-as-prop is after;
// the React Compiler memoises the result on its inputs.
function slotsOf(pick: () => void): ButtonSlots {
  return { default: pick }
}

export { DropZone, FileTrigger }
export type { DropZoneProps, FileTriggerProps }
