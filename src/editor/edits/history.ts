// A value with its earlier and later versions, for undo and redo. Each
// function gives a new history; the history it gets does not change.

export const historyLimit = 100

export type History<T> = { past: T[]; present: T; future: T[] }

export function startHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] }
}

// A new present value. It clears the redo side and keeps at most
// `historyLimit` earlier values.
export function record<T>(history: History<T>, present: T): History<T> {
  const past = [...history.past, history.present]
  return { past: past.slice(Math.max(0, past.length - historyLimit)), present, future: [] }
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0
}

export function undo<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
  }
}

export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
  }
}

// Changes each version with no new record: for a fact that is true in each
// version, such as a new place of an edit in the code.
export function mapHistory<T>(history: History<T>, change: (value: T) => T): History<T> {
  return {
    past: history.past.map(change),
    present: change(history.present),
    future: history.future.map(change),
  }
}

// Takes out each version that is equal (`same`) to the version before it: an
// undo or a redo to it would change nothing. The present stays the present,
// or the equal version before it.
export function dropRepeats<T>(history: History<T>, same: (a: T, b: T) => boolean): History<T> {
  const all = [...history.past, history.present, ...history.future]
  const kept: T[] = []
  let present = 0
  all.forEach((value, index) => {
    const repeat = kept.length > 0 && same(kept[kept.length - 1], value)
    if (!repeat) kept.push(value)
    if (index === history.past.length) present = kept.length - 1
  })
  return { past: kept.slice(0, present), present: kept[present], future: kept.slice(present + 1) }
}
