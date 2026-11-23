import { useSyncExternalStore } from 'react'
import type { AppliedAction } from '../../requests/api.ts'

// The open dialog of a screen action: the menu of a frame opens it
// (`ScreenMenu.tsx`), and the editor renders it once, outside the canvas
// (`ScreenDialogs`). One dialog at a time. `refused` shows why a move in the
// row did not run, which needs no dialog of its own before the call.

export type DialogKind = 'rename' | 'flow' | 'title' | 'delete'

export type ScreenDialog =
  | { kind: DialogKind; screen: string }
  | { kind: 'refused'; screen: string; reasons: string[] }
  | null

export type DialogStore = {
  get: () => ScreenDialog
  open: (dialog: Exclude<ScreenDialog, null>) => void
  close: () => void
  subscribe: (listener: () => void) => () => void
}

export function createDialogStore(): DialogStore {
  let current: ScreenDialog = null
  const listeners = new Set<() => void>()
  const set = (next: ScreenDialog) => {
    if (next === current) return
    current = next
    for (const listener of listeners) listener()
  }
  return {
    get: () => current,
    open: set,
    close: () => set(null),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export const screenDialog = createDialogStore()

export function useScreenDialog(): ScreenDialog {
  return useSyncExternalStore(screenDialog.subscribe, screenDialog.get, screenDialog.get)
}

// Called after an action of a dialog changed the ids of screens: the editor
// follows them (`viewAfter`).
export type OnApplied = (plan: AppliedAction) => void
