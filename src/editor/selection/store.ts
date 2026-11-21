import { useSyncExternalStore } from 'react'

// The selected element of a screen. One element at a time.
//
// An element is the JSX element at a place of the screen file (`loc`). A
// `map` gives more than one element with one location, thus `index` is the
// position among the elements with that location, in document order. The
// three values find the element again after its frame reloads; `node` is the
// first DOM node of the element in the current frame document.

export type Selected = {
  screenId: string
  loc: string
  index: number
  // The tag name in the screen file, for the label: `Button`, `Card.Header`, `div`.
  name: string
  node: Element
}

export function sameElement(a: Selected | null, b: Selected | null): boolean {
  if (a === null || b === null) return a === b
  return a.screenId === b.screenId && a.loc === b.loc && a.index === b.index
}

export type SelectionStore = {
  get: () => Selected | null
  // The same element with the same node keeps the current value.
  select: (next: Selected) => void
  clear: () => void
  subscribe: (listener: () => void) => () => void
}

export function createSelectionStore(): SelectionStore {
  let current: Selected | null = null
  const listeners = new Set<() => void>()
  const set = (next: Selected | null) => {
    current = next
    for (const listener of listeners) listener()
  }
  return {
    get: () => current,
    select: (next) => {
      if (sameElement(current, next) && current?.node === next.node) return
      set(next)
    },
    clear: () => {
      if (current !== null) set(null)
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

// The selection of the editor.
export const selection = createSelectionStore()

export function useSelection(): Selected | null {
  return useSyncExternalStore(selection.subscribe, selection.get, selection.get)
}
