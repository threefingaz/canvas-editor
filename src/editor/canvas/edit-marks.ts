import { liveItems, locOf, type Item, type PlacedEdit } from '../edits/model.ts'
import type { Point, Rect } from './viewport.ts'

// The marks of the open edits of one screen on the canvas: one mark for each
// element with edits that have a preview (`liveItems`: no comment, no
// `options` or `keep` item, no stale item, no item with a reply of the
// agent), with their count. A mark is derived from the list and the rectangle
// of each target in the frame document; nothing new is saved.

export type EditMark = {
  // The place of the target (`locOf`).
  key: string
  // The count of the edits with a preview on that element.
  count: number
  // The rectangle of the element in canvas coordinates.
  rect: Rect
}

// The size of a mark on the canvas, in px on the screen at each zoom.
export const markSize = 8

// `rectOf` gives the rectangle of the element of an edit, or null when its
// node is not found or the preview hides it (a `remove` edit): that element
// gets no mark. It is called once for each place. The marks keep the order of
// the first edit of each place in the list.
export function editMarks(items: readonly Item[], rectOf: (edit: PlacedEdit) => Rect | null): EditMark[] {
  const places = new Map<string, { edit: PlacedEdit; count: number }>()
  for (const { edit } of liveItems(items)) {
    const key = locOf(edit.target)
    const entry = places.get(key)
    if (entry) entry.count++
    else places.set(key, { edit, count: 1 })
  }
  const marks: EditMark[] = []
  for (const [key, { edit, count }] of places) {
    const rect = rectOf(edit)
    if (rect) marks.push({ key, count, rect })
  }
  return marks
}

// The top left corner of a mark of `size` px on the screen, with its middle at
// the bottom left corner of the element: away from the badge of a marker (top
// left), the pin (top right) and the bar (above the element, or below it
// with a gap).
export function markPoint(rect: Rect, size: number): Point {
  return { x: rect.x - size / 2, y: rect.y + rect.height - size / 2 }
}
