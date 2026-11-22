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

// The rectangle of the link element of each link, in canvas coordinates: by
// the id of the source screen, then by the id of the target screen. A link
// with no entry has no known element.
export type FlowLinks = ReadonlyMap<string, ReadonlyMap<string, Rect>>

const noLinks: FlowLinks = new Map()

// The link rectangles of the frame documents (`link-rects.ts`, by screen id,
// in the coordinates of each document) in canvas coordinates. A screen with
// no frame in the layout is left out.
export function flowLinks(
  boxes: readonly FlowBox[],
  view: View,
  rects: ReadonlyMap<string, ReadonlyMap<string, Rect>>,
): FlowLinks {
  const result = new Map<string, Map<string, Rect>>()
  for (const box of boxes) {
    const links = rects.get(box.screen.id)
    if (!links) continue
    const corner = toScreen(view, box)
    const placed = new Map<string, Rect>()
    for (const [to, rect] of links) {
      placed.set(to, {
        x: corner.x + rect.x * view.scale,
        y: corner.y + rect.y * view.scale,
        width: rect.width * view.scale,
        height: rect.height * view.scale,
      })
    }
    result.set(box.screen.id, placed)
  }
  return result
}

// What an arrow is for the listed screen: `out` leaves it, `in` reaches it,
// `off` is an arrow of other screens.
export type FlowFocus = 'out' | 'in' | 'off'

// The focus of a pair: null with no listed screen (each arrow is then
// normal).
export function flowFocus(pair: { from: string; to: string }, listed: string | null): FlowFocus | null {
  if (listed === null) return null
  if (pair.from === listed) return 'out'
  return pair.to === listed ? 'in' : 'off'
}

// One arrow: `d` is the path of its line, which stops at the base of the
// head; `tip` is the point of the head, and `angle` its turn in degrees: 0
// points down, 180 points up. `dot` is the middle of the link element that
// the arrow starts at, and `stem` the path from the dot to the start of the
// line; the two are null when the element is not known, and the arrow then
// starts at the frame. `focus` is `flowFocus` of its pair.
export type FlowArrow = {
  from: string
  to: string
  d: string
  tip: Point
  angle: number
  dot: Point | null
  stem: string | null
  focus: FlowFocus | null
}

// The length of an arrow head, in px on the screen.
export const headLength = 7
// Half of the width of an arrow head.
export const headHalf = 3.5

// The distance of an end of an arrow from the near end of its frame, in px,
// and the largest part of the width of the frame that it takes (a frame is
// small on the screen at a low zoom). An arrow to the left has the larger
// values and a higher arc: with a link in each direction between two frames,
// the arrow to the left is around the arrow to the right.
const insetRight = 12
const insetLeft = 28
const partRight = 0.15
const partLeft = 0.35
const extraLift = 12

// The height of an arc above its ends: a part of its length, in these bounds.
const liftPart = 0.12
const minLift = 16
const maxLift = 56
// The least difference of the heights of two arcs of one row while the row
// has the room for them.
const liftStep = 10
// With too little room above a row (a low zoom), the arcs of the row still
// get this height for the lowest one and this difference between two, thus
// each is a curve and no two lie on each other. They then use the space of
// the row above.
// The least height of an arrow of the listed screen.
const focusLeast = 26
export const leastLift = 10
export const leastStep = 7

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

// The middle of the link element of a pair, or null when it is not known or
// is not in its frame (a part that the frame cuts off).
function dotOf(from: FlowFrame, to: FlowFrame, links: FlowLinks): Point | null {
  const rect = links.get(from.id)?.get(to.id)
  if (!rect) return null
  const x = rect.x + rect.width / 2
  const y = rect.y + rect.height / 2
  const { rect: frame } = from
  const inside = x >= frame.x && x <= frame.x + frame.width && y >= frame.y && y <= frame.y + frame.height
  return inside ? { x, y } : null
}

function stemOf(dot: Point | null, x: number, y: number): string | null {
  return dot && `M ${round(dot.x)} ${round(dot.y)} L ${round(x)} ${round(y)}`
}

function rounded(dot: Point | null): Point | null {
  return dot && { x: round(dot.x), y: round(dot.y) }
}

// The ends of an arc in one row, above the title rows: it leaves the source
// above its link element, or with no known element near its end at the side
// of the target, and comes straight down on the near end of the target.
type RowEnds = {
  from: FlowFrame
  to: FlowFrame
  right: boolean
  startX: number
  endX: number
  // The height of the start of the line and of the point of the head.
  y: number
  dot: Point | null
}

function rowEnds(from: FlowFrame, to: FlowFrame, clearance: number, dot: Point | null): RowEnds {
  const right = to.rect.x >= from.rect.x
  const inset = (rect: Rect) => (right ? Math.min(insetRight, rect.width * partRight) : Math.min(insetLeft, rect.width * partLeft))
  const atFrame = right ? from.rect.x + from.rect.width - inset(from.rect) : from.rect.x + inset(from.rect)
  const endX = right ? to.rect.x + inset(to.rect) : to.rect.x + to.rect.width - inset(to.rect)
  return { from, to, right, startX: dot ? dot.x : atFrame, endX, y: to.rect.y - clearance, dot }
}

// The height of an arrow of the listed screen: its full height at each zoom,
// thus the few arrows that the user asked for are clear in a large project,
// also over the row above.
export function focusLift(span: number, right: boolean): number {
  return clampTo(span * liftPart, focusLeast, maxLift) + (right ? 0 : extraLift)
}

// The height of each arc of one row, in the order of `arcs`. Each arc gets
// its own height by the rank of its length: a short arc is low and a long
// one is high, thus an arc is around the shorter ones and no two lie on each
// other. While the room above the row permits it, the height is a part of
// the length of the arc; with less room the heights are spread in the room,
// which is never less than `leastLift` and `leastStep` for each more arc.
export function rowLifts(arcs: readonly { span: number; right: boolean }[], room: number): number[] {
  const count = arcs.length
  const order = arcs.map((_, index) => index).sort((a, b) => arcs[a].span - arcs[b].span || Number(arcs[b].right) - Number(arcs[a].right) || a - b)
  // With no room the band has the height of three arcs at most: more arcs
  // share it, thus a row with many links stays near its own frames and does
  // not cover the rows above. The arrows of the listed screen rise out of the
  // band (`focusLift`).
  const band = Math.max(room, leastLift + leastStep * Math.min(count - 1, 2))
  const lifts: number[] = new Array(count).fill(0)
  let last = 0
  for (const index of order) {
    const arc = arcs[index]
    const full = clampTo(arc.span * liftPart, minLift, maxLift) + (arc.right ? 0 : extraLift)
    last = last === 0 ? full : Math.max(full, last + liftStep)
    lifts[index] = last
  }
  if (last <= band) return lifts
  order.forEach((index, rank) => {
    lifts[index] = count === 1 ? band : leastLift + ((band - leastLift) * rank) / (count - 1)
  })
  return lifts
}

// The arc of a link in one row: it rises from its start and comes straight
// down on the target. The control points are above the two ends, thus the
// line ends vertical, and the top of the arc is 3/4 of their height.
function rowArrow(ends: RowEnds, lift: number, listed: string | null): FlowArrow {
  const { from, to, startX, endX, y, dot } = ends
  const endY = y - headLength
  const top = endY - lift / 0.75
  return {
    from: from.id,
    to: to.id,
    d: `M ${round(startX)} ${round(y)} C ${round(startX)} ${round(top)}, ${round(endX)} ${round(top)}, ${round(endX)} ${round(endY)}`,
    tip: { x: round(endX), y: round(y) },
    angle: 0,
    dot: rounded(dot),
    stem: stemOf(dot, startX, y),
    focus: flowFocus({ from: from.id, to: to.id }, listed),
  }
}

// The curve of a link between two rows, or in a column: from the edge of the
// source that looks at the target to the near edge of the target, vertical at
// its two ends. An end above a frame keeps the distance from its title row.
// The line leaves the source above or below its link element; with no known
// element the two ends are as near to each other as the frames permit.
function crossArrow(from: FlowFrame, to: FlowFrame, clearance: number, dot: Point | null, listed: string | null): FlowArrow {
  const down = to.rect.y >= from.rect.y
  const shift = down ? -rowShift : rowShift
  const middle = (rect: Rect) => rect.x + rect.width / 2
  const within = (x: number, rect: Rect) => {
    const inset = Math.min(insetRight, rect.width * partRight)
    return clampTo(x + shift, rect.x + inset, rect.x + rect.width - inset)
  }
  const startX = dot ? dot.x : within(middle(to.rect), from.rect)
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
    dot: rounded(dot),
    stem: stemOf(dot, startX, startY),
    focus: flowFocus({ from: from.id, to: to.id }, listed),
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
  // The link element of each pair, where it is known: the arrow starts there.
  links: FlowLinks = noLinks,
  // The listed screen, for the focus of each arrow (`flowFocus`).
  listed: string | null = null,
): FlowArrow[] {
  const byId = new Map(frames.map((frame) => [frame.id, frame]))
  const arrows: (FlowArrow | null)[] = []
  // The arcs of each row, with their index in `arrows`: the height of an arc
  // depends on the other arcs of its row.
  const rows: { y: number; arcs: { index: number; ends: RowEnds }[] }[] = []
  for (const pair of pairs) {
    const from = byId.get(pair.from)
    const to = byId.get(pair.to)
    if (!from || !to || from === to) continue
    const dot = dotOf(from, to, links)
    if (Math.abs(from.rect.y - to.rect.y) >= sameTop) {
      arrows.push(crossArrow(from, to, clearance, dot, listed))
      continue
    }
    let row = rows.find((candidate) => Math.abs(candidate.y - to.rect.y) < sameTop)
    if (!row) rows.push((row = { y: to.rect.y, arcs: [] }))
    row.arcs.push({ index: arrows.length, ends: rowEnds(from, to, clearance, dot) })
    arrows.push(null)
  }
  for (const row of rows) {
    const lifts = rowLifts(
      row.arcs.map(({ ends }) => ({ span: Math.abs(ends.endX - ends.startX), right: ends.right })),
      room,
    )
    row.arcs.forEach(({ index, ends }, at) => {
      const focus = flowFocus({ from: ends.from.id, to: ends.to.id }, listed)
      const strong = focus === 'out' || focus === 'in'
      arrows[index] = rowArrow(ends, strong ? Math.max(lifts[at], focusLift(Math.abs(ends.endX - ends.startX), ends.right)) : lifts[at], listed)
    })
  }
  return arrows.filter((arrow) => arrow !== null)
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
