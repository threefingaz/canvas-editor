import { useSyncExternalStore } from 'react'
import type { ScreenEntry } from 'virtual:canvas-screens'
import type { LinkTarget } from '../../frame/screen-link.ts'

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

// The screen of a link target, or null when the target is not a screen
// address or the id is not in the list.
export function navigateTarget<S extends Pick<ScreenEntry, 'id'>>(target: LinkTarget, screens: readonly S[]): S | null {
  if (target.kind !== 'screen') return null
  return screens.find((screen) => screen.id === target.id) ?? null
}
