import { sameRect, type Rect, type Size } from './viewport.ts'

// The part of an option on the canvas. An option of one element is a full
// screen file that marks its block (`part` of its entry in the list,
// `tools/part.ts`), and its frame shows cropped to that block: the iframe
// keeps its full width and its real corner, thus each rectangle of the frame
// document is at the same place of the canvas as in a whole frame, and the
// frame is clipped to the crop. The layout places the option by the size of
// the crop (`layoutFrames`).
//
// The measure of the frame reads the rectangle of the part
// (`useMeasureRects`) and writes it to the store `partRects`; the editor
// reads the store for the layout. The switch "Show the whole screen" of the
// title row is the store `wholeShown`, by screen; it is not saved in a file.
// The pure parts and the two stores are here.

// The place of the part of a screen in its frame document, as the location
// of its element (`<file>:<line>:<column>`); null for a screen with no part.
export function partLoc(screen: { file: string; part?: string; error?: string }): string | null {
  return screen.part === undefined || screen.error !== undefined ? null : `${screen.file}:${screen.part}`
}

// A node of the part that the measure reads.
export type PartNode = { isConnected: boolean; getBoundingClientRect: () => Rect }

// The rectangle of the part in the frame document: the union of the
// rectangles of its nodes (the place can draw more than one copy). A node
// that is no longer in the document, a node that the preview hides and a node
// with no size do not count, as in `rectsOf`; null when no node counts: the
// whole frame then shows.
export function partRectOf<N extends PartNode>(nodes: readonly N[], hidden: (node: N) => boolean): Rect | null {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const node of nodes) {
    if (!node.isConnected || hidden(node)) continue
    const { x, y, width, height } = node.getBoundingClientRect()
    if (width === 0 && height === 0) continue
    left = Math.min(left, x)
    top = Math.min(top, y)
    right = Math.max(right, x + width)
    bottom = Math.max(bottom, y + height)
  }
  return left === Infinity ? null : { x: left, y: top, width: right - left, height: bottom - top }
}

// The free space around the part in its crop, in px of the frame document:
// the shadow and the focus ring of the block stay in the picture, and the
// block does not touch the edge of its frame.
export const cropMargin = 16
// The least size of a crop, in px of the frame document: a block of a few
// px (an icon, a line) still gives a frame that the pointer finds. The title
// row of a frame with a crop is as wide as its column (`titleWidth` of the
// layout); when the option is wider than its base that is the crop, and
// with this width, at a zoom of 100 %, the row has room for the mark
// "Option", the title, the count of issues, "Keep this option", the switch
// of the whole screen and the menu (`titleParts`).
export const minCropWidth = 360
export const minCropHeight = 64

// The crop of a frame for the rectangle of its part, in the coordinates of
// the frame document, in whole px: the part with `cropMargin` around it, at
// least `minCropWidth` by `minCropHeight` (the part stays in the middle), and
// inside the frame (`frame` is the size of the iframe).
export function cropOf(part: Rect, frame: Size): Rect {
  const span = (start: number, size: number, least: number, limit: number): [number, number] => {
    const length = Math.min(limit, Math.ceil(Math.max(least, size + cropMargin * 2)))
    const from = Math.round(start + size / 2 - length / 2)
    return [Math.max(0, Math.min(from, limit - length)), length]
  }
  const [x, width] = span(part.x, part.width, minCropWidth, frame.width)
  const [y, height] = span(part.y, part.height, minCropHeight, frame.height)
  return { x, y, width, height }
}

// The `clip-path` of the iframe box of a frame with a crop: the box shows
// only the crop, and takes the pointer only there.
export function cropClip(crop: Rect, frame: Size): string {
  const right = frame.width - crop.x - crop.width
  const bottom = frame.height - crop.y - crop.height
  return `inset(${crop.y}px ${right}px ${bottom}px ${crop.x}px)`
}

// The part of `rect` that is in the crop of its frame, the two in the same
// coordinates; `rect` itself for a frame with no crop (`crop` null), and null
// when no part of it is in the crop: a mark of the canvas for an element
// that the crop does not show is not drawn, and the outline of an element
// that is larger than the crop ends at the crop.
export function inCrop(rect: Rect, crop: Rect | null): Rect | null {
  if (crop === null) return rect
  const x = Math.max(rect.x, crop.x)
  const y = Math.max(rect.y, crop.y)
  const right = Math.min(rect.x + rect.width, crop.x + crop.width)
  const bottom = Math.min(rect.y + rect.height, crop.y + crop.height)
  if (right < x || bottom < y) return null
  // A rectangle with a size that only touches the crop at an edge is out of
  // it; a line with no width or height (the line of a drop) on the edge stays.
  if ((right === x && rect.width > 0) || (bottom === y && rect.height > 0)) return null
  return { x, y, width: right - x, height: bottom - y }
}

// The rectangle of the part of each screen that the layout crops: each
// measured part, less the screens whose whole frame the user asked for.
export function croppedParts(
  parts: ReadonlyMap<string, Rect>,
  whole: ReadonlySet<string>,
): ReadonlyMap<string, Rect> {
  if (whole.size === 0) return parts
  return new Map([...parts].filter(([id]) => !whole.has(id)))
}

// The state of the switch of the title row of an option with a part: the
// frame shows the block (`part`) or the whole screen (`whole`).
export function partSwitch(whole: boolean): { label: string; next: 'part' | 'whole' } {
  return whole ? { label: 'Show the block only', next: 'part' } : { label: 'Show the whole screen', next: 'whole' }
}

export type PartRectsStore = {
  // The rectangle of the part of each screen, by screen id, in the
  // coordinates of its frame document. The map is a new one after each
  // change, thus it is a snapshot for React.
  get: () => ReadonlyMap<string, Rect>
  // A rectangle that is equal to the one of the store changes nothing, thus
  // a measure that moved nothing starts no new layout.
  set: (screenId: string, rect: Rect) => void
  delete: (screenId: string) => void
  subscribe: (listener: () => void) => () => void
}

export function createPartRectsStore(): PartRectsStore {
  let entries: ReadonlyMap<string, Rect> = new Map()
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) listener()
  }
  return {
    get: () => entries,
    set: (screenId, rect) => {
      if (sameRect(entries.get(screenId), rect)) return
      entries = new Map(entries).set(screenId, rect)
      notify()
    },
    delete: (screenId) => {
      if (!entries.has(screenId)) return
      const next = new Map(entries)
      next.delete(screenId)
      entries = next
      notify()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

// The part rectangles of the editor.
export const partRects = createPartRectsStore()

export type WholeShownStore = {
  // The ids of the screens whose frame shows whole, though the screen has a
  // part. The set is a new one after each change.
  get: () => ReadonlySet<string>
  toggle: (screenId: string) => void
  delete: (screenId: string) => void
  subscribe: (listener: () => void) => () => void
}

export function createWholeShownStore(): WholeShownStore {
  let ids: ReadonlySet<string> = new Set()
  const listeners = new Set<() => void>()
  const change = (next: Set<string>) => {
    ids = next
    for (const listener of listeners) listener()
  }
  return {
    get: () => ids,
    toggle: (screenId) => {
      const next = new Set(ids)
      if (!next.delete(screenId)) next.add(screenId)
      change(next)
    },
    delete: (screenId) => {
      if (!ids.has(screenId)) return
      const next = new Set(ids)
      next.delete(screenId)
      change(next)
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

// The screens of the editor that show whole.
export const wholeShown = createWholeShownStore()
