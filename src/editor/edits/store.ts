import { useSyncExternalStore } from 'react'
import type { Edit } from '../../requests/format.ts'
import {
  canRedo,
  canUndo,
  dropRepeats,
  mapHistory,
  record,
  redo,
  startHistory,
  undo,
  type History,
} from './history.ts'
import { addEdit, discard, isPlaced, replaceComment, type Item } from './model.ts'

// The edits of all screens, by screen id. A screen with no edits has no key.
export type Screens = Readonly<Record<string, Item[]>>

export type EditsStore = {
  screens: () => Screens
  // The items of one screen. The same list until the screen changes.
  get: (screenId: string) => Item[]
  canUndo: () => boolean
  canRedo: () => boolean
  // `replaces`: the ids of the edits that the new edit replaces (a sequence
  // edit replaces the sequence edit of a sibling); they go out in the same
  // history record.
  apply: (screenId: string, edit: Edit, replaces?: readonly string[]) => void
  discard: (screenId: string, id: string) => void
  // A new text for a comment (`replaceComment`); an empty text discards it.
  changeComment: (screenId: string, id: string, text: string) => void
  // Undo and redo work on the edits of all screens.
  undo: () => void
  redo: () => void
  // The edits of a request file that changed from outside. They replace the
  // edits of the screen in each version: the earlier versions of the screen
  // do not agree with the file. Undo and redo keep working for the other
  // screens; a step that changed only this screen goes away.
  replace: (screenId: string, edits: Edit[]) => void
  // `mark` and `retarget` make no history record. They change each version,
  // because they tell a fact about the current screen file.
  mark: (screenId: string, id: string, stale: boolean) => void
  retarget: (screenId: string, id: string, line: number, column: number) => void
  subscribe: (listener: () => void) => () => void
}

const none: Item[] = []

function withScreen(screens: Screens, screenId: string, list: Item[]): Screens {
  const next = { ...screens }
  if (list.length === 0) delete next[screenId]
  else next[screenId] = list
  return next
}

// The same lists of edits for the same screens.
function sameScreens(a: Screens, b: Screens): boolean {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key])
}

// Changes the item with the id. It gives the same list when the item is not
// there or the change gives the same item.
function updateItem(list: Item[], id: string, change: (item: Item) => Item): Item[] {
  let changed = false
  const next = list.map((item) => {
    if (item.edit.id !== id) return item
    const updated = change(item)
    if (updated !== item) changed = true
    return updated
  })
  return changed ? next : list
}

export function createEditsStore(): EditsStore {
  let history: History<Screens> = startHistory({})
  const listeners = new Set<() => void>()
  const get = (screenId: string) => history.present[screenId] ?? none

  const set = (next: History<Screens>) => {
    if (next === history) return
    history = next
    for (const listener of listeners) listener()
  }

  // A new version from a change of the list of one screen.
  const change = (screenId: string, next: (list: Item[]) => Item[]) => {
    const list = get(screenId)
    const changed = next(list)
    if (changed === list) return
    set(record(history, withScreen(history.present, screenId, changed)))
  }

  // A change of one item in each version, with no record.
  const changeEverywhere = (screenId: string, id: string, item: (item: Item) => Item) => {
    const present = history.present
    const next = mapHistory(history, (screens) => {
      const list = screens[screenId]
      if (list === undefined) return screens
      const changed = updateItem(list, id, item)
      return changed === list ? screens : withScreen(screens, screenId, changed)
    })
    // Only a change of the present version is a change for the subscribers.
    if (next.present === present) history = next
    else set(next)
  }

  return {
    screens: () => history.present,
    get,
    canUndo: () => canUndo(history),
    canRedo: () => canRedo(history),
    apply: (screenId, edit, replaces = []) =>
      change(screenId, (list) => addEdit(replaces.reduce(discard, list), edit)),
    discard: (screenId, id) => change(screenId, (list) => discard(list, id)),
    changeComment: (screenId, id, text) => change(screenId, (list) => replaceComment(list, id, text)),
    undo: () => set(undo(history)),
    redo: () => set(redo(history)),
    replace: (screenId, edits) => {
      const list = edits.map((edit) => ({ edit }))
      set(dropRepeats(mapHistory(history, (screens) => withScreen(screens, screenId, list)), sameScreens))
    },
    mark: (screenId, id, stale) =>
      changeEverywhere(screenId, id, (item) => {
        if ((item.stale === true) === stale) return item
        return stale ? { ...item, stale: true } : { edit: item.edit }
      }),
    retarget: (screenId, id, line, column) =>
      changeEverywhere(screenId, id, (item) => {
        const { edit } = item
        if (!isPlaced(edit) || (edit.target.line === line && edit.target.column === column)) return item
        return { ...item, edit: { ...edit, target: { ...edit.target, line, column } } }
      }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

// The edits of the editor.
export const edits = createEditsStore()

export function useEditScreens(): Screens {
  return useSyncExternalStore(edits.subscribe, edits.screens, edits.screens)
}

// The edits of the screen with the id; null (no screen) gives the empty list,
// which never changes.
export function useScreenEdits(screenId: string | null): Item[] {
  const get = () => (screenId === null ? none : edits.get(screenId))
  return useSyncExternalStore(edits.subscribe, get, get)
}

export function useCanUndo(): boolean {
  return useSyncExternalStore(edits.subscribe, edits.canUndo, edits.canUndo)
}

export function useCanRedo(): boolean {
  return useSyncExternalStore(edits.subscribe, edits.canRedo, edits.canRedo)
}
