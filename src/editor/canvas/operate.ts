import { useSyncExternalStore } from 'react'
import type { ScreenEntry } from 'virtual:canvas-screens'
import { screenHash, type LinkTarget } from '../../frame/screen-link.ts'

// The Preview switch of the toolbar. Off (the default), a click in a frame
// selects an element. On, a click does not select: a click on a link to a
// screen moves the canvas to the frame of that screen, and the editor hides
// the selection, the outline and the markers. The overlay of each frame stays
// in the two states, thus pan, zoom and the keys of the editor always work.
//
// In code the switch is `operate`: `src/editor/preview/` is the preview of the
// edits in a frame, a different thing.

export type OperateStore = {
  get: () => boolean
  toggle: () => void
  subscribe: (listener: () => void) => () => void
}

export function createOperateStore(): OperateStore {
  let on = false
  const listeners = new Set<() => void>()
  return {
    get: () => on,
    toggle: () => {
      on = !on
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

// The Preview switch of the editor.
export const operate = createOperateStore()

export function useOperate(): boolean {
  return useSyncExternalStore(operate.subscribe, operate.get, operate.get)
}

// What a click on a link does with the Preview switch on: a link to a screen
// moves the view to the frame of that screen (`move`), a link to an unknown
// screen shows a message (`notice`), and a different place does nothing
// (null): no link, an address that is not a screen address, or a screen with
// no frame in the layout.
export type FollowLink<B> = { kind: 'move'; box: B } | { kind: 'notice'; text: string } | null

export function followLink<B extends { screen: Pick<ScreenEntry, 'id'> }>(
  target: LinkTarget | null,
  frames: readonly B[],
): FollowLink<B> {
  if (target === null || target.kind === 'other') return null
  if (target.kind === 'unknown-screen') {
    return { kind: 'notice', text: `The link goes to ${screenHash(target.id)}, and no screen has that address.` }
  }
  const box = frames.find((frame) => frame.screen.id === target.id)
  return box ? { kind: 'move', box } : null
}
