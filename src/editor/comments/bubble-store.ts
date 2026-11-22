import { useSyncExternalStore } from 'react'
import { sameElement, selection, type SelectionStore } from '../selection/store.ts'
import { bubbleAfter, closedBubble, draftKey, joinDrafts, pinEvent, type Bubble, type BubbleEvent } from './bubble.ts'
import type { Pin } from './pins.ts'

// The store of the comment bubble (`bubble.ts`) and of the drafts of new
// comments. A draft is kept for its place (`draftKey`) until it is added or
// emptied, thus a click on a different element closes the bubble and does
// not lose the text. The drafts are not saved in a file, and a change of a
// draft notifies no one: a box reads its draft when it opens. When the agent
// writes the screen file while the user types, the draft and the bubble of
// the selected element follow it to its new place (the event `moved`), and
// the change of the selection that follows the file closes no bubble
// (`keepOpen`): an element that is gone keeps its bubble open with the draft,
// detached from its old place (the event `gone`), and the bubble of the
// comments on the screen stays open while the user types in it.

export type BubbleStore = {
  get: () => Bubble
  send: (event: BubbleEvent) => void
  subscribe: (listener: () => void) => () => void
  // The draft of a place; an empty text when it has none.
  draft: (key: string) => string
  // An empty text removes the draft.
  setDraft: (key: string, text: string) => void
  // Runs `change`, a change of the selection that follows a change of the
  // screen file and not the user; the bubble or options panel that is open
  // stays open (the values of the selection during `change` close nothing).
  keepOpen: (change: () => void) => void
}

export function createBubbleStore(): BubbleStore {
  let current: Bubble = closedBubble
  const drafts = new Map<string, string>()
  const listeners = new Set<() => void>()
  // True while `keepOpen` runs its change.
  let holding = false
  const send = (event: BubbleEvent) => {
    if (holding && event.type === 'selected') return
    if (event.type === 'moved') {
      const from = draftKey({ screenId: event.screenId, loc: event.from })
      const to = draftKey({ screenId: event.screenId, loc: event.to })
      const text = drafts.get(from)
      if (text !== undefined && from !== to) {
        drafts.set(to, joinDrafts(drafts.get(to) ?? '', text))
        drafts.delete(from)
      }
    }
    const next = bubbleAfter(current, event)
    if (next === current) return
    current = next
    for (const listener of listeners) listener()
  }
  return {
    get: () => current,
    send,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    draft: (key) => drafts.get(key) ?? '',
    setDraft: (key, text) => {
      if (text === '') drafts.delete(key)
      else drafts.set(key, text)
    },
    keepOpen: (change) => {
      const outer = holding
      holding = true
      try {
        change()
      } finally {
        holding = outer
      }
    },
  }
}

// Sends each new value of the selection to the bubble: a different element
// or no element closes it (`bubbleAfter`). The result stops it.
export function followSelection(store: BubbleStore, selected: Pick<SelectionStore, 'get' | 'subscribe'>): () => void {
  let last = selected.get()
  return selected.subscribe(() => {
    const next = selected.get()
    const same = sameElement(last, next)
    last = next
    store.send({ type: 'selected', same })
  })
}

// The bubble of the editor, which follows the selection of the editor. A hot
// update of this module in the dev server stops the old listener.
export const bubble = createBubbleStore()
const stopFollow = followSelection(bubble, selection)
import.meta.hot?.dispose(stopFollow)

export function useBubble(): Bubble {
  return useSyncExternalStore(bubble.subscribe, bubble.get, bubble.get)
}

// Opens the bubble with the comments of a pin (`pinEvent`).
export function openPin(screenId: string, pin: Pick<Pin, 'key' | 'ids'>) {
  bubble.send(pinEvent(screenId, pin))
}
