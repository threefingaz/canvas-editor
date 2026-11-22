import type { Point, Rect } from '../canvas/viewport.ts'
import { isPlaced, locOf, type Item, type PlacedEdit } from '../edits/model.ts'

// The pins of the comments of one screen. A pin is derived from the open
// `comment` items of the screen and the rectangle of each target in the frame
// document; nothing new is saved. The comments on one element are one pin. A
// comment on the whole screen is in the pin `screen`, and a comment whose
// element is not found (a stale item, a node that the frame does not draw)
// or is hidden by the preview (a `remove` edit) is in the pin `lost`: these
// two show in the title row of the frame, with `rect: null`.

export type Pin = {
  // The place of the target (`locOf`), or 'screen', or 'lost'.
  key: string
  // The ids of the comments of this pin, in the order of the list.
  ids: string[]
  // 1-based: the pins on elements in the order of the code, then the pins of
  // the title row. A position, not an id: a comment added before a pin gives
  // it a new number.
  number: number
  // The rectangle of the element in canvas coordinates; null for a pin of the
  // title row.
  rect: Rect | null
  // One of its comments has a reply of the agent.
  replied: boolean
}

// The size of a pin on the canvas, in px on the screen at each zoom (`h-5`).
export const pinSize = 20

export const screenPin = 'screen'
export const lostPin = 'lost'

// `rectOf` gives the rectangle of the element of a comment, or null when its
// node is not found or the preview hides it. It is called once for each place.
export function pinsOf(items: readonly Item[], rectOf: (edit: PlacedEdit) => Rect | null): Pin[] {
  const placed = new Map<string, { edit: PlacedEdit; list: Item[] }>()
  const screen: Item[] = []
  const lost: Item[] = []
  for (const item of items) {
    const { edit } = item
    if (edit.change.kind !== 'comment') continue
    if (!isPlaced(edit)) {
      screen.push(item)
      continue
    }
    if (item.stale) {
      lost.push(item)
      continue
    }
    const key = locOf(edit.target)
    const entry = placed.get(key)
    if (entry) entry.list.push(item)
    else placed.set(key, { edit, list: [item] })
  }

  const pinOf = (key: string, list: readonly Item[], rect: Rect | null): Omit<Pin, 'number'> => ({
    key,
    ids: list.map((item) => item.edit.id),
    rect,
    replied: list.some((item) => item.edit.reply !== undefined),
  })

  const onElements: Omit<Pin, 'number'>[] = []
  // The order of the code: the file, then the line, then the column.
  const inCode = [...placed].sort(([, a], [, b]) => {
    const x = a.edit.target
    const y = b.edit.target
    return x.file === y.file ? x.line - y.line || x.column - y.column : x.file < y.file ? -1 : 1
  })
  for (const [key, entry] of inCode) {
    const rect = rectOf(entry.edit)
    if (rect) onElements.push(pinOf(key, entry.list, rect))
    else lost.push(...entry.list)
  }

  // The lost comments keep the order of the list.
  const order = new Map(items.map((item, index) => [item.edit.id, index]))
  lost.sort((a, b) => order.get(a.edit.id)! - order.get(b.edit.id)!)

  const inTitle: Omit<Pin, 'number'>[] = []
  if (screen.length > 0) inTitle.push(pinOf(screenPin, screen, null))
  if (lost.length > 0) inTitle.push(pinOf(lostPin, lost, null))

  return [...onElements, ...inTitle].map((pin, index) => ({ ...pin, number: index + 1 }))
}

// The pin of a comment, for its bubble: the pin of `pins` that has it, or,
// while the pins are not known (null: no frame document yet), a pin of that
// comment alone at the place where `pinsOf` would put it: the screen, the
// lost comments for a stale item, else its element.
export function pinOfComment(pins: readonly Pin[] | null, item: Item): Pick<Pin, 'key' | 'ids'> {
  const { edit } = item
  const pin = pins?.find((entry) => entry.ids.includes(edit.id))
  if (pin) return pin
  const key = !isPlaced(edit) ? screenPin : item.stale ? lostPin : locOf(edit.target)
  return { key, ids: [edit.id] }
}

// The top left corner of a pin of `size` px on the screen, with its middle at
// the top right corner of the element.
export function pinPoint(rect: Rect, size: number): Point {
  return { x: rect.x + rect.width - size / 2, y: rect.y - size / 2 }
}
