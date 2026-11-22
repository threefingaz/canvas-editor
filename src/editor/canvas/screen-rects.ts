import { isLive, isPlaced, locOf, type Item, type PlacedEdit } from '../edits/model.ts'
import { frameWindowOf } from '../frame-window.ts'
import { nodesByLoc, screenRendered, type FrameDocument, type Hidden } from '../selection/pick.ts'
import type { Rect } from './viewport.ts'

// The rectangles of the targets of the edits of each screen in its frame
// document, measured once for each screen and shared by each mark that the
// canvas derives from them: the pins of the comments (the layer of the pins,
// the title row of the frame, the Changes tab, the bubble) and the marks of
// the open edits. One part of the frame measures (`useMeasureRects`), and
// each mark reads the store (`useScreenRects`), thus their numbers agree and
// a screen has one set of observers. The pure parts are here; the hooks are
// in `use-screen-rects.ts`.

// An item whose element gets a mark: a comment on an element (its pin) and
// an edit with a preview (its mark).
export function measured(item: Item): boolean {
  return isPlaced(item.edit) && (item.edit.change.kind === 'comment' || isLive(item))
}

// The document that the measure reads: a frame document with its window.
export type MeasureDocument = FrameDocument & { defaultView: unknown }

// A node that the measure reads.
export type MeasureNode = {
  isConnected: boolean
  getBoundingClientRect: () => Rect
}

// The first copy of the place of each item that `watches` takes, by its
// place, in one walk of the document; a place that draws nothing is not in
// the map. Null while the document has no window (a frame that reloaded) or
// the screen is not rendered yet.
export function targetNodes(
  document: MeasureDocument,
  items: readonly Item[],
  watches: (item: Item) => boolean,
): Map<string, Element> | null {
  if (!frameWindowOf(document as Pick<Document, 'defaultView'>) || !screenRendered(document)) return null
  const all = nodesByLoc(document)
  const result = new Map<string, Element>()
  for (const item of items) {
    const { target } = item.edit
    if (!watches(item) || target === null) continue
    const loc = locOf(target)
    const node = all.get(loc)?.[0]
    if (node && !result.has(loc)) result.set(loc, node)
  }
  return result
}

// The rectangle of each node in the frame document, by its place. A node
// that is no longer in the document, a node that the preview hides, and a
// node with no size (the library does not draw it at this width) count as
// not found: they are not in the result.
export function rectsOf(nodes: ReadonlyMap<string, Element>, hidden: Hidden): Map<string, Rect> {
  const result = new Map<string, Rect>()
  for (const [loc, node] of nodes) {
    const measure = node as unknown as MeasureNode
    if (!measure.isConnected || hidden(node)) continue
    const { x, y, width, height } = measure.getBoundingClientRect()
    if (width === 0 && height === 0) continue
    result.set(loc, { x, y, width, height })
  }
  return result
}

// What a mark of the canvas derives from the list and the measured
// rectangles, in this order: `empty` while it is off (`enabled` false) or the
// list has no item that `watches` takes; for a screen file that cannot be
// read (`error`), or when no item that `watches` takes has an element to
// measure (only comments on the whole screen: the measure then writes no
// entry), `derive` with no rectangle for any edit; null while the rectangles
// are not known (`measured` null); else `derive` with the rectangle of each
// target in the coordinates of the caller (`place`).
export function rectsResult<T>(
  state: {
    enabled: boolean
    items: readonly Item[]
    watches: (item: Item) => boolean
    error: boolean
    measured: ReadonlyMap<string, Rect> | null
  },
  place: (nodeRect: Rect) => Rect,
  derive: (items: readonly Item[], rectOf: (edit: PlacedEdit) => Rect | null) => T,
  empty: T,
): T | null {
  const { items, watches } = state
  if (!state.enabled || !items.some(watches)) return empty
  if (state.error || !items.some((item) => watches(item) && measured(item))) return derive(items, () => null)
  const rects = state.measured
  if (!rects) return null
  return derive(items, (edit) => {
    const rect = rects.get(locOf(edit.target))
    return rect ? place(rect) : null
  })
}

// One measure of a screen: the document and the list that it read, and the
// rectangles by place (null while the screen is not rendered). A mark uses
// it only for its own document and list.
export type ScreenRects = {
  document: Document
  items: readonly Item[]
  rects: ReadonlyMap<string, Rect> | null
}

export type ScreenRectsStore = {
  get: (screenId: string) => ScreenRects | undefined
  set: (screenId: string, entry: ScreenRects) => void
  delete: (screenId: string) => void
  subscribe: (listener: () => void) => () => void
}

export function createScreenRectsStore(): ScreenRectsStore {
  const entries = new Map<string, ScreenRects>()
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) listener()
  }
  return {
    get: (screenId) => entries.get(screenId),
    set: (screenId, entry) => {
      entries.set(screenId, entry)
      notify()
    },
    delete: (screenId) => {
      if (entries.delete(screenId)) notify()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

// The rectangles of the editor.
export const screenRects = createScreenRectsStore()

// The rectangles of an entry when it is for this document and this list;
// null when it is not (a measure of an older list or of a frame that
// reloaded): the marks are then not known for a moment.
export function currentRects(
  entry: ScreenRects | undefined,
  document: Document | null,
  items: readonly Item[],
): ReadonlyMap<string, Rect> | null {
  return entry && entry.document === document && entry.items === items ? entry.rects : null
}
