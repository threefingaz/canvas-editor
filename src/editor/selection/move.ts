import type { Rect } from '../canvas/viewport.ts'
import { isLive, type Item } from '../edits/model.ts'
import type { MovePlan } from '../inspector/edit.ts'

// The pure parts of a move of the selected element among its siblings on the
// canvas. The bar, the keys and the drag call the same move (`use-move.ts`),
// thus each of them gives the same `order` edit.

// The indexes of the child nodes in the sequence that the frame shows: by the
// computed `order` of each child, then by its index. The frame decides what
// is shown: the preview can skip an edit, a different sibling can have the
// open move, and the library can set `order` itself.
export function shownOrder(children: readonly { order: number }[]): number[] {
  return children
    .map((child, index) => ({ order: Number.isFinite(child.order) ? child.order : 0, index }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map((entry) => entry.index)
}

// The next position after one step, or null at the end of the sequence.
function nextPosition(position: number, count: number, step: -1 | 1): number | null {
  const next = position + step
  return next >= 0 && next < count ? next : null
}

// The move of the selection for the bar, the keys and the drag: the plan
// (`movePlan`) and `drag`. `drag` is false when the parent shows no preview
// (the frame keeps the sequence of the code) and when a different sibling
// has an open move, a replaced edit that is live (the parent has one `order`
// edit, thus a new move puts that sibling back): the frame would not show
// what the drop gives.
export type SelectionMove = MovePlan & { drag: boolean }

// The move of the selection; null when the element cannot move (no plan).
// A replaced edit that is stale or has a reply has no preview: it is not an
// open move, and it keeps the drag.
export function selectionMove(plan: MovePlan | null, items: readonly Item[]): SelectionMove | null {
  if (!plan) return null
  const replaced = new Set(plan.replaced)
  const siblingMoved = items.some((item) => replaced.has(item.edit.id) && isLive(item))
  return { ...plan, drag: plan.previewed && !siblingMoved }
}

// True when the frame shows the plan: the shown sequence is the sequence of
// the code with only the own move of the element applied, thus the element
// is at `plan.position` and each shown place is a position in the code after
// that move. `sequence` has the indexes of the child nodes in the shown
// sequence (`shownOrder`; the index of a child node is its position in the
// code), `position` is the place of the element in it. False when the
// preview skipped the own move, when a different sibling has an open move,
// and when the library sets `order` itself: a drop on the frame would then
// not be the position that the edit gets, thus no drag starts.
export function showsPlan(
  sequence: readonly number[],
  position: number,
  plan: { position: number; count: number },
): boolean {
  const own = sequence[position]
  if (own === undefined || sequence.length !== plan.count || position !== plan.position) return false
  const expected = Array.from({ length: plan.count }, (_, index) => index).filter((index) => index !== own)
  expected.splice(plan.position, 0, own)
  return expected.every((index, place) => sequence[place] === index)
}

// The flow of the siblings: in a row or in a column, and in the sequence of
// the code or against it (`row-reverse`, a page from right to left).
export type Flow = { axis: 'row' | 'column'; reversed: boolean }

const plainColumn: Flow = { axis: 'column', reversed: false }

// The flow of the siblings, read from their rectangles: the CSS keywords do
// not say it for a grid or a wrapped row. `rects` are in the shown sequence,
// `position` is the place of the element in it, `container` is the layout of
// the parent. A parent that is not a flex or grid container is a column, and
// no rectangle is read. The nearest sibling on the same line as the element
// (its range in y overlaps) makes a row; else the nearest sibling in the
// same column (its range in x overlaps) gives the direction of a column. A
// rectangle with no size (a hidden sibling) does not count.
export function flowOf(rects: readonly Rect[], position: number, container: 'flex' | 'grid' | null): Flow {
  const own = rects[position]
  if (container === null || !own || !hasSize(own)) return plainColumn
  const row = nearest(rects, position, (rect) => overlaps(rect.y, rect.height, own.y, own.height))
  if (row !== null) return { axis: 'row', reversed: laterFirst(rects, position, row, (rect) => rect.x + rect.width / 2) }
  const column = nearest(rects, position, (rect) => overlaps(rect.x, rect.width, own.x, own.width))
  if (column !== null) return { axis: 'column', reversed: laterFirst(rects, position, column, (rect) => rect.y + rect.height / 2) }
  return plainColumn
}

// True when the rectangle has a size: a hidden sibling has none.
export function hasSize(rect: Rect): boolean {
  return rect.width > 0 && rect.height > 0
}

function overlaps(start: number, size: number, ownStart: number, ownSize: number): boolean {
  return start < ownStart + ownSize && ownStart < start + size
}

// The index of the nearest sibling in the sequence that has a size and
// passes `test`; the earlier one first at the same distance. Null with none.
function nearest(rects: readonly Rect[], position: number, test: (rect: Rect) => boolean): number | null {
  for (let distance = 1; distance < rects.length; distance++) {
    for (const index of [position - distance, position + distance]) {
      const rect = rects[index]
      if (rect && hasSize(rect) && test(rect)) return index
    }
  }
  return null
}

// True when the later one of the two in the sequence is first on the screen
// (at the left, or above), by the middle of each rectangle along the axis.
function laterFirst(rects: readonly Rect[], a: number, b: number, middle: (rect: Rect) => number): boolean {
  const [earlier, later] = a < b ? [a, b] : [b, a]
  return middle(rects[later]!) < middle(rects[earlier]!)
}

// An arrow key.
export type Arrow = 'left' | 'right' | 'up' | 'down'

// The two arrows of an axis, the one to the left (or up) on the screen
// first: Left and Right in a row, Up and Down in a column.
export function arrowsOf(axis: Flow['axis']): readonly [Arrow, Arrow] {
  return axis === 'row' ? ['left', 'right'] : ['up', 'down']
}

// The step of an arrow key in a flow: -1 (earlier in the code), 1 (later),
// or null for a key of the other axis. An arrow names a direction on the
// screen, thus in a reversed flow Left moves the element later in the code.
export function stepOf(arrow: Arrow, flow: Flow): -1 | 1 | null {
  const [first, second] = arrowsOf(flow.axis)
  if (arrow !== first && arrow !== second) return null
  return (arrow === second) !== flow.reversed ? 1 : -1
}

// The position in the code that an arrow moves the element to, or null when
// the arrow does nothing: a key of the other axis, or the end of the
// sequence in its direction. `position` is the position of the plan (the
// `after` of the own open move, else the place in the code), `count` the
// count of siblings. A step is a plain step in the code sequence: the new
// edit replaces the open move of a different sibling, thus that sibling goes
// back. The bar turns an arrow on with it, and the keys and the buttons give
// it to `moveTo`.
export function arrowNext(arrow: Arrow, flow: Flow, position: number, count: number): number | null {
  const step = stepOf(arrow, flow)
  return step === null ? null : nextPosition(position, count, step)
}
