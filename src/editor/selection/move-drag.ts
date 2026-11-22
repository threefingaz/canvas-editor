import type { Point, Rect } from '../canvas/viewport.ts'
import { hasSize, type Flow } from './move.ts'

// The pure parts of the drag of the selected element among its siblings. The
// rectangles are in the sequence that the frame shows (`rectsNow` of
// `use-move.ts`), in the coordinates of the frame document, and `position` is
// the place of the element in that sequence. A drag starts only where the
// frame shows the plan (`showsPlan`), thus a shown place is a position in the
// code after the own move of the element, and a drop goes to `moveTo` as it is.

// The distance in px on the screen that a press must move before a drag
// starts, at each zoom: a press with less movement is a click.
export const dragThreshold = 4

// The position where the element lands for a pointer at `point`: before or
// after the sibling whose rectangle is nearest to the pointer, by the side
// of its middle along the axis of the flow. One rule for a row, a column, a
// wrapped row, a grid and a pointer out of all rectangles. The own position
// when the nearest rectangle is the one of the element or when no sibling
// has a size.
export function dropPosition(rects: readonly Rect[], position: number, flow: Flow, point: Point): number {
  const index = nearestRect(rects, point)
  if (index === null || index === position) return position
  const rect = rects[index]!
  const middle = flow.axis === 'row' ? rect.x + rect.width / 2 : rect.y + rect.height / 2
  const along = flow.axis === 'row' ? point.x : point.y
  // On the screen before the middle is earlier in the code, unless the flow
  // is reversed.
  const before = along < middle !== flow.reversed
  if (index > position) return before ? index - 1 : index
  return before ? index : index + 1
}

// The line of the drop at the edge of the sibling that the element goes
// next to, in the coordinates of `rects`, with no thickness (the canvas
// draws it at a fixed size on the screen): a vertical line in a row, a
// horizontal line in a column. Null when the drop keeps the position or that
// sibling has no size.
export function dropLine(rects: readonly Rect[], position: number, drop: number, flow: Flow): Rect | null {
  if (drop === position) return null
  const rect = rects[drop]
  if (!rect || !hasSize(rect)) return null
  // A drop later in the code goes after that sibling, an earlier one before
  // it; a reversed flow puts "after" at the left or above.
  const far = drop > position !== flow.reversed
  if (flow.axis === 'row') return { x: far ? rect.x + rect.width : rect.x, y: rect.y, width: 0, height: rect.height }
  return { x: rect.x, y: far ? rect.y + rect.height : rect.y, width: rect.width, height: 0 }
}

// The index of the rectangle with a size that is nearest to `point` (0 in
// it); the first one at the same distance. Null when none has a size.
function nearestRect(rects: readonly Rect[], point: Point): number | null {
  let best: number | null = null
  let bestDistance = Infinity
  rects.forEach((rect, index) => {
    if (!hasSize(rect)) return
    const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width))
    const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height))
    const distance = Math.hypot(dx, dy)
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}

// The state of a drag. `from` is the position of the element at the press.
// `guard` is true after a drag until the click that follows it, the next
// press, or `settled`: that click is not a pick.
export type Drag =
  | { kind: 'idle'; guard: boolean }
  | { kind: 'pressed'; start: Point; from: number }
  | { kind: 'dragging'; start: Point; from: number; drop: number }

// `press`: the main button went down on the overlay of the frame.
// `position` is the place of the selected element in the shown sequence when
// the press can start a drag (the point is in the rectangle of the element,
// and a drag is possible: `place.drag`, `showsPlan`, no `off` of the bar, no
// Space); null else. `move`: the pointer moved, with the drop position at
// that point, `down` (the main button is still down) and `scale` (the zoom
// of the canvas: `point` is in the coordinates of the frame document, the
// threshold is on the screen). A move with no button down ends a press or a drag as a
// cancel: the release was out of the overlay, thus it did not come.
// `settled`: a timer of 0 ms after a release, thus a drag that ends with no
// click (out of the canvas) does not stop a later pick.
export type DragEvent =
  | { type: 'press'; point: Point; position: number | null }
  | { type: 'move'; point: Point; drop: number; down: boolean; scale: number }
  | { type: 'release' }
  | { type: 'cancel' }
  | { type: 'click' }
  | { type: 'settled' }

export type DragResult = { state: Drag; moveTo: number | null; stopClick: boolean }

export const idleDrag: Drag = { kind: 'idle', guard: false }

// The next state, the move to apply at the release of a drag, and whether a
// click is stopped. An event that changes nothing gives the same state.
export function dragAfter(state: Drag, event: DragEvent): DragResult {
  const same: DragResult = { state, moveTo: null, stopClick: false }
  switch (event.type) {
    case 'press': {
      if (state.kind !== 'idle') return same
      if (event.position !== null) {
        return { ...same, state: { kind: 'pressed', start: event.point, from: event.position } }
      }
      return state.guard ? { ...same, state: idleDrag } : same
    }
    case 'move': {
      if (state.kind === 'idle') return same
      if (!event.down) return dragAfter(state, { type: 'cancel' })
      if (state.kind === 'pressed') {
        const distance = Math.hypot(event.point.x - state.start.x, event.point.y - state.start.y) * event.scale
        if (distance < dragThreshold) return same
      }
      if (state.kind === 'dragging' && state.drop === event.drop) return same
      return { ...same, state: { kind: 'dragging', start: state.start, from: state.from, drop: event.drop } }
    }
    case 'release': {
      if (state.kind === 'pressed') return { ...same, state: idleDrag }
      if (state.kind !== 'dragging') return same
      return {
        state: { kind: 'idle', guard: true },
        moveTo: state.drop === state.from ? null : state.drop,
        stopClick: false,
      }
    }
    case 'cancel': {
      // A canceled drag also stops the click of its release: the pointer
      // moved, and a pick there would surprise the user.
      if (state.kind === 'pressed') return { ...same, state: idleDrag }
      if (state.kind === 'dragging') return { ...same, state: { kind: 'idle', guard: true } }
      return same
    }
    case 'click': {
      if (state.kind === 'idle' && state.guard) return { state: idleDrag, moveTo: null, stopClick: true }
      return same
    }
    case 'settled': {
      if (state.kind === 'idle' && state.guard) return { ...same, state: idleDrag }
      return same
    }
  }
}

// True when `point` is in `rect`, its edges too.
export function pointIn(rect: Rect, point: Point): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
}

// The box of the line of the drop on the screen: `line` is a line with no
// thickness in canvas coordinates (`dropLine` after `canvasRectOf`), and the
// box is `thickness` px wide across it, with the line in its middle.
export function lineBox(line: Rect, thickness: number): Rect {
  if (line.width === 0) return { x: line.x - thickness / 2, y: line.y, width: thickness, height: line.height }
  return { x: line.x, y: line.y - thickness / 2, width: line.width, height: thickness }
}
