// The flow on the canvas: an arrow for each link between two screens, and the
// name of each flow at the left of its row. All the functions here are pure;
// `FlowLayer.tsx` draws their result in the overlay of the canvas. They work
// in canvas coordinates (px on the screen), thus the width of a line, the
// size of an arrow head and the distance from the title row of a frame are
// the same at each zoom.

import { toScreen, type Point, type Rect, type View } from './viewport.ts'

// A frame in canvas coordinates, with the flow of its screen.
export type FlowFrame = { id: string; flow: string; rect: Rect }

// The parts of a frame box of the layout that the flow reads.
export type FlowBox = { screen: { id: string; flow: string }; x: number; y: number; width: number; height: number }

// The frames of the layout (world coordinates) in canvas coordinates.
export function flowFrames(boxes: readonly FlowBox[], view: View): FlowFrame[] {
  return boxes.map((box) => {
    const corner = toScreen(view, box)
    return {
      id: box.screen.id,
      flow: box.screen.flow,
      rect: { x: corner.x, y: corner.y, width: box.width * view.scale, height: box.height * view.scale },
    }
  })
}

// One arrow: `d` is the path of its line, which stops at the base of the
// head; `tip` is the point of the head, and `angle` its turn in degrees: 0
// points down, 180 points up.
export type FlowArrow = { from: string; to: string; d: string; tip: Point; angle: number }

// The length of an arrow head, in px on the screen.
export const headLength = 7
// Half of the width of an arrow head.
export const headHalf = 3.5

// The distance of an end of an arrow from the near end of its frame, in px,
// and the largest part of the width of the frame that it takes (a frame is
// small on the screen at a low zoom). An arrow to the left has the larger
// values and a higher arc: with a link in each direction between two frames,
// the arrow to the left is around the arrow to the right, and the two never
// share a point.
const insetRight = 12
const insetLeft = 28
const partRight = 0.15
const partLeft = 0.35
const extraLift = 12

// The height of an arc above its ends: a part of its length, in these bounds.
const liftPart = 0.12
// The least height of an arc when the rows are near to each other.
const leastLift = 8
const minLift = 16
const maxLift = 56

// The distance of two arrows in opposite directions between two rows.
const rowShift = 6

// Two frames are in one row when their top edges are at one height.
const sameTop = 0.5

function round(value: number): number {
  return Math.round(value * 10) / 10
}

function clampTo(value: number, low: number, high: number): number {
  return low > high ? (low + high) / 2 : Math.min(high, Math.max(low, value))
}

// The arc of a link in one row, above the title rows: it leaves the source
// near its end at the side of the target, rises, and comes straight down on
// the near end of the target. The control points are above the two ends, thus
// the line ends vertical, and the top of the arc is 3/4 of their height.
function rowArrow(from: FlowFrame, to: FlowFrame, clearance: number, room: number): FlowArrow {
  const right = to.rect.x >= from.rect.x
  const inset = (rect: Rect) => (right ? Math.min(insetRight, rect.width * partRight) : Math.min(insetLeft, rect.width * partLeft))
  const startX = right ? from.rect.x + from.rect.width - inset(from.rect) : from.rect.x + inset(from.rect)
  const endX = right ? to.rect.x + inset(to.rect) : to.rect.x + to.rect.width - inset(to.rect)
  const startY = from.rect.y - clearance
  const tipY = to.rect.y - clearance
  const endY = tipY - headLength
  // The arc stays in the free space above the row, thus it does not run
  // into the frames of the row above at a low zoom. An arc to the left stays
  // the higher one of two.
  const full = clampTo(Math.abs(endX - startX) * liftPart, minLift, maxLift) + (right ? 0 : extraLift)
  const lift = Math.min(full, Math.max(leastLift, room) * (right ? 0.7 : 1))
  const top = Math.min(startY, endY) - lift / 0.75
  return {
    from: from.id,
    to: to.id,
    d: `M ${round(startX)} ${round(startY)} C ${round(startX)} ${round(top)}, ${round(endX)} ${round(top)}, ${round(endX)} ${round(endY)}`,
    tip: { x: round(endX), y: round(tipY) },
    angle: 0,
  }
}

// The curve of a link between two rows, or in a column: from the edge of the
// source that looks at the target to the near edge of the target, vertical at
// its two ends. An end above a frame keeps the distance from its title row.
// The two ends are as near to each other as the frames permit.
function crossArrow(from: FlowFrame, to: FlowFrame, clearance: number): FlowArrow {
  const down = to.rect.y >= from.rect.y
  const shift = down ? -rowShift : rowShift
  const middle = (rect: Rect) => rect.x + rect.width / 2
  const within = (x: number, rect: Rect) => {
    const inset = Math.min(insetRight, rect.width * partRight)
    return clampTo(x + shift, rect.x + inset, rect.x + rect.width - inset)
  }
  const startX = within(middle(to.rect), from.rect)
  const endX = within(middle(from.rect), to.rect)
  const startY = down ? from.rect.y + from.rect.height : from.rect.y - clearance
  const tipY = down ? to.rect.y - clearance : to.rect.y + to.rect.height
  const endY = down ? tipY - headLength : tipY + headLength
  const reach = Math.max(minLift, Math.abs(endY - startY) / 2)
  const sign = down ? 1 : -1
  return {
    from: from.id,
    to: to.id,
    d: `M ${round(startX)} ${round(startY)} C ${round(startX)} ${round(startY + sign * reach)}, ${round(endX)} ${round(endY - sign * reach)}, ${round(endX)} ${round(endY)}`,
    tip: { x: round(endX), y: round(tipY) },
    angle: down ? 0 : 180,
  }
}

// One arrow for each pair whose two frames are in `frames`, in the order of
// the pairs. `clearance` is the distance of an arrow from the top edge of a
// frame, in px: the height of the title row and a little more, thus the title
// stays free. A pair of a frame with itself has no arrow.
export function flowArrows(
  frames: readonly FlowFrame[],
  pairs: readonly { from: string; to: string }[],
  clearance: number,
  // The free height above a row for the arcs, in px: the space between two
  // rows at this zoom, less the title row.
  room = Infinity,
): FlowArrow[] {
  const byId = new Map(frames.map((frame) => [frame.id, frame]))
  const arrows: FlowArrow[] = []
  for (const pair of pairs) {
    const from = byId.get(pair.from)
    const to = byId.get(pair.to)
    if (!from || !to || from === to) continue
    const row = Math.abs(from.rect.y - to.rect.y) < sameTop
    arrows.push(row ? rowArrow(from, to, clearance, room * 0.75) : crossArrow(from, to, clearance))
  }
  return arrows
}

// The name of a flow at its row: `x` is the right end of the text and `y` the
// top of the title row of the first frame.
export type FlowLabel = { flow: string; x: number; y: number }

// One label for each flow, in the order of the frames, at the left of the
// first frame of the flow, `gap` px from it, at the height of its title row
// (`rowHeight` px above the frame). The text is the flow as the folders write
// it (`onboarding`, `settings/account`). The screens directly in the screens
// folder have no flow name, thus no label.
export function flowLabels(frames: readonly FlowFrame[], rowHeight: number, gap: number): FlowLabel[] {
  const labels: FlowLabel[] = []
  const seen = new Set<string>()
  for (const frame of frames) {
    if (seen.has(frame.flow)) continue
    seen.add(frame.flow)
    if (frame.flow !== '') labels.push({ flow: frame.flow, x: round(frame.rect.x - gap), y: round(frame.rect.y - rowHeight) })
  }
  return labels
}

const storageKey = 'canvas-editor-links'

// The arrows show unless the stored choice is `off`.
export function parseLinksShown(value: string | null): boolean {
  return value !== 'off'
}

// `localStorage` can be missing or blocked by the browser: then the arrows
// show, and a choice is kept for this session only.
export function readLinksShown(): boolean {
  try {
    return parseLinksShown(window.localStorage.getItem(storageKey))
  } catch {
    return true
  }
}

export function writeLinksShown(shown: boolean) {
  try {
    if (shown) window.localStorage.removeItem(storageKey)
    else window.localStorage.setItem(storageKey, 'off')
  } catch {
    // The choice is kept for this session only.
  }
}
