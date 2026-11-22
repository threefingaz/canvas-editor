import type { Rect } from '../canvas/viewport.ts'
import { dragAfter, idleDrag, type Drag, type DragEvent } from './move-drag.ts'

// The store of the drag of the selected element (`move-drag.ts`): the state
// and the line of the drop. `MoveDrag` sends the events and reads it with
// `useSyncExternalStore`, the selection overlay reads `dragging` to hide the
// hover outline, and the one Escape listener of `App.tsx` reads it with
// `get()` at the key, with no subscription.

// `line` is the line of the drop in the coordinates of the frame document
// (`dropLine`), while a drag runs; null else.
export type DragView = { drag: Drag; line: Rect | null }

export type DragStore = {
  get: () => DragView
  // True while a drag runs (not for a press below the threshold).
  dragging: () => boolean
  // Applies the event, keeps `line` while the next state is a drag, and
  // gives back the move to apply and whether the click is stopped.
  send: (event: DragEvent, line?: Rect | null) => { moveTo: number | null; stopClick: boolean }
  subscribe: (listener: () => void) => () => void
}

const idleView: DragView = { drag: idleDrag, line: null }

export function createDragStore(): DragStore {
  let current: DragView = idleView
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    dragging: () => current.drag.kind === 'dragging',
    send: (event, line = null) => {
      const result = dragAfter(current.drag, event)
      const nextLine = result.state.kind === 'dragging' ? (event.type === 'move' ? line : current.line) : null
      if (result.state !== current.drag || !sameRect(nextLine, current.line)) {
        current = { drag: result.state, line: nextLine }
        for (const listener of listeners) listener()
      }
      return { moveTo: result.moveTo, stopClick: result.stopClick }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a === null || b === null) return a === b
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

// The drag of the editor.
export const moveDrag = createDragStore()
