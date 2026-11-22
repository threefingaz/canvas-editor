import { clamp } from '../clamp.ts'

// The view of the canvas: where the world is and how large it shows.
// A world point `w` shows at the canvas point `w * scale + (x, y)`. All the
// functions here are pure; the canvas component reads the events and calls them.

export type View = { x: number; y: number; scale: number }
// The point and rectangle types of the editor, also for the selection.
export type Point = { x: number; y: number }
export type Size = { width: number; height: number }
export type Rect = { x: number; y: number; width: number; height: number }

export const minScale = 0.05
export const maxScale = 4

// The zoom values of the toolbar buttons.
export const zoomSteps = [minScale, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, maxScale]

// The free space around the content when the canvas centers it.
const centerPadding = 64

// The largest wheel delta that one zoom event uses. A mouse wheel with Ctrl
// gives large steps; a trackpad pinch gives small ones.
const maxZoomDelta = 50
const zoomSpeed = 0.01

// The pixels of one line of a wheel event in lines (`deltaMode` 1).
const wheelLinePx = 16

export function clampScale(scale: number): number {
  return Math.min(maxScale, Math.max(minScale, scale))
}

export function toWorld(view: View, point: Point): Point {
  return { x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale }
}

export function toScreen(view: View, point: Point): Point {
  return { x: point.x * view.scale + view.x, y: point.y * view.scale + view.y }
}

export function pan(view: View, dx: number, dy: number): View {
  return { x: view.x + dx, y: view.y + dy, scale: view.scale }
}

// Change the scale by `factor`; the world point below `point` stays in its place.
export function zoomAt(view: View, factor: number, point: Point): View {
  return scaleAt(view, view.scale * factor, point)
}

function scaleAt(view: View, scale: number, point: Point): View {
  const next = clampScale(scale)
  if (next === view.scale) return view
  const world = toWorld(view, point)
  return { x: point.x - world.x * next, y: point.y - world.y * next, scale: next }
}

// The next zoom step in (1) or out (-1), at `point` (the middle of the canvas
// for the toolbar buttons).
export function zoomStep(view: View, direction: 1 | -1, point: Point): View {
  const epsilon = 1e-6
  const next =
    direction > 0
      ? zoomSteps.find((step) => step > view.scale + epsilon)
      : zoomSteps.findLast((step) => step < view.scale - epsilon)
  return next === undefined ? view : scaleAt(view, next, point)
}

// The strips at the top and the bottom of the canvas that content must not
// take, in px on the screen: the title row above a frame, which keeps its
// size at each zoom, and the toolbar at the bottom.
export type Strips = { top: number; bottom: number }

export const noStrips: Strips = { top: 0, bottom: 0 }

// The strip of the toolbar at the bottom of the canvas with its distance from
// the edge, in px on the screen.
export const toolbarStrip = 64

// The strips of the canvas that the overlays cover, in px on the screen: the
// place of the notice at the top and the toolbar at the bottom. The bar of the
// selection and a floating panel stay out of them, and an element whose
// middle is in one of them is not in the view.
export const overlayStrips: Strips = { top: 48, bottom: toolbarStrip }

// The middle height of the free part of the canvas (the canvas less the
// strips); with no free height the strips are left out: the middle of the
// canvas.
function freeMiddleY(size: Size, strips: Strips): number {
  const free = size.height - strips.top - strips.bottom
  return free > 0 ? strips.top + free / 2 : size.height / 2
}

// A view with the content in the middle of the free part of the canvas: the
// canvas less the strips. Content that is larger than that part is made
// smaller to fit; small content shows at 100%.
export function centerOn(bounds: Rect, size: Size, strips: Strips, padding = centerPadding): View {
  const freeHeight = size.height - strips.top - strips.bottom
  const space = { width: size.width - padding * 2, height: freeHeight - padding * 2 }
  let scale = 1
  if (bounds.width > 0 && bounds.height > 0 && space.width > 0 && space.height > 0) {
    scale = clampScale(Math.min(1, space.width / bounds.width, space.height / bounds.height))
  }
  return {
    x: size.width / 2 - (bounds.x + bounds.width / 2) * scale,
    y: freeMiddleY(size, strips) - (bounds.y + bounds.height / 2) * scale,
    scale,
  }
}

// True when the middle of `rect` (in canvas coordinates) is in the free part
// of the canvas (the canvas less the strips), at least `margin` px from each
// of its edges. Only the middle counts, thus an element that is larger than
// the canvas is in the view when its middle shows.
export function inView(rect: Rect, size: Size, margin: number, strips: Strips): boolean {
  const middle = middleOf(rect)
  return (
    middle.x >= margin &&
    middle.x <= size.width - margin &&
    middle.y >= strips.top + margin &&
    middle.y <= size.height - strips.bottom - margin
  )
}

// The point that a zoom of the toolbar or of a key keeps in its place: the
// middle of the selection (in canvas coordinates) when it is in the view,
// thus the selection stays in the view; else the middle of the canvas.
export function zoomAnchor(size: Size, selection: Rect | null): Point {
  if (selection !== null && inView(selection, size, 0, noStrips)) return middleOf(selection)
  return { x: size.width / 2, y: size.height / 2 }
}

// The view moved so that the middle of `rect` (in canvas coordinates) is in
// the middle of the free part of the canvas (the canvas less the strips); the
// scale stays. With no free height, the middle of the canvas.
export function centerRect(view: View, rect: Rect, size: Size, strips: Strips): View {
  const middle = middleOf(rect)
  return pan(view, size.width / 2 - middle.x, freeMiddleY(size, strips) - middle.y)
}

// The view that shows `rect` (in canvas coordinates): the same view when its
// middle is in the free part of the canvas, at least `margin` px from each of
// its edges (`inView`), else the view moved so that its middle is in the
// middle of the free part (`centerRect`). The scale stays.
export function revealView(view: View, rect: Rect, size: Size, margin: number, strips: Strips): View {
  return inView(rect, size, margin, strips) ? view : centerRect(view, rect, size, strips)
}

// The rectangle of the title row of a frame (`box`, in world coordinates) in
// canvas coordinates: above the top left corner of the frame, `height` px
// high at each zoom, as wide as the frame on the screen and at most
// `maxWidth` px: the part of the row with the title and its first parts.
export function titleRowRect(view: View, box: Rect, height: number, maxWidth: number): Rect {
  const corner = toScreen(view, box)
  return { x: corner.x, y: corner.y - height, width: Math.min(box.width * view.scale, maxWidth), height }
}

function middleOf(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

// The view after the canvas changed its size from `before` to `after`: the
// world point in the middle of the canvas stays in the middle, and the scale
// stays. The caller passes two sizes that are not empty: an empty size (the
// first size, or a canvas with no room) has no middle.
export function resized(view: View, before: Size, after: Size): View {
  const dx = (after.width - before.width) / 2
  const dy = (after.height - before.height) / 2
  if (dx === 0 && dy === 0) return view
  return pan(view, dx, dy)
}

// A wheel delta in pixels. `mode` is `WheelEvent.deltaMode`: 0 pixels, 1 lines,
// 2 pages of `pageSize` pixels.
export function wheelDelta(delta: number, mode: number, pageSize: number): number {
  if (mode === 1) return delta * wheelLinePx
  if (mode === 2) return delta * pageSize
  return delta
}

// The zoom factor of one wheel event with Ctrl or Cmd. A browser sends a
// trackpad pinch as such an event too.
export function wheelZoomFactor(deltaY: number): number {
  const delta = clamp(deltaY, -maxZoomDelta, maxZoomDelta)
  return Math.exp(-delta * zoomSpeed)
}

// The scroll values of a box that can scroll (`Element`).
export type ScrollBox = {
  scrollTop: number
  scrollLeft: number
  scrollHeight: number
  scrollWidth: number
  clientHeight: number
  clientWidth: number
}

// True when the box can still scroll in the direction of a wheel delta: a
// list in the comment bubble takes the wheel, and the canvas does not move.
// At its end the box cannot scroll further, and the canvas takes the wheel.
// One px of rounding counts as the end.
export function canScroll(box: ScrollBox, dx: number, dy: number): boolean {
  const down = box.scrollTop + box.clientHeight < box.scrollHeight - 1
  const right = box.scrollLeft + box.clientWidth < box.scrollWidth - 1
  return (dy > 0 && down) || (dy < 0 && box.scrollTop > 0) || (dx > 0 && right) || (dx < 0 && box.scrollLeft > 0)
}
