import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FrameBox } from '../canvas/layout.ts'
import { inCrop } from '../canvas/part.ts'
import { overlayStrips, type Point, type Rect, type Size, type Strips, type View } from '../canvas/viewport.ts'
import { clamp } from '../clamp.ts'
import type { Item } from '../edits/model.ts'
import { inLiveFrame } from '../frame-window.ts'
import { elementOf, siteOf, type Site } from '../locate/fiber.ts'
import { hiddenIn } from '../preview/css.ts'
import { canvasCropOf, canvasRectOf } from '../selection/geometry.ts'
import { nodesAt, type FrameDocument } from '../selection/pick.ts'
import type { Selected } from '../selection/store.ts'
import type { BubbleTarget } from './bubble.ts'
import { pinPoint, pinSize } from './pins.ts'

// The parts that the floating nodes of the canvas share: the comment bubble
// and the options panel (one floating panel in the layer of the bubble,
// placed next to its anchor with `panelPlace`), and the bar of the selection
// (`barPlace`); the node of the place of a panel in the frame, and its anchor.

// The distance of a floating panel from its anchor and from the edges of the
// canvas, in px on the screen.
export const floatingGap = 8

// The node of a place in the frame: the selected node when the selection is
// at that place in the current document of the frame (a copy of a `map`
// other than the first), else the first copy that the preview does not hide;
// null when there is none, and for the place of the whole screen.
export function nodeOf(
  target: BubbleTarget,
  document: (FrameDocument & { defaultView: object | null }) | null,
  selected: Pick<Selected, 'screenId' | 'loc' | 'node'> | null,
  items: readonly Item[],
): Element | null {
  // A document of a frame that loads again has no window: its nodes are not
  // on the page.
  if (target.loc === null || !document || document.defaultView === null) return null
  if (
    selected &&
    selected.screenId === target.screenId &&
    selected.loc === target.loc &&
    inLiveFrame(selected.node) &&
    selected.node.ownerDocument === document
  ) {
    return selected.node
  }
  const hidden = hiddenIn(items)
  return nodesAt(document, target.loc).find((node) => !hidden(node)) ?? null
}

// The node of the place of a panel (`nodeOf`) and its place in the code; the
// site is null for the whole screen and for an element that is not found.
export function targetSite(
  target: BubbleTarget | null,
  document: Document | null,
  selected: Selected | null,
  items: readonly Item[],
): { node: Element | null; site: Site | null } {
  const node = target ? nodeOf(target, document, selected, items) : null
  const element = node && target?.loc ? elementOf(node, target.loc) : null
  return { node, site: element ? siteOf(element) : null }
}

// The anchor of a panel of an element on the canvas: the place of the pin of
// the element, at its top right corner (`pinPoint`), and the rectangle of
// the element, which the panel does not cover when it has room (`panelPlace`).
// `elementRect` is the rectangle of the pin's element when the pins know it,
// else null, and then the node of the panel is measured; null when neither
// is known: the panel is then at its button in the title row. In a frame
// with a crop (an option with a part) the rectangle is the part that the
// crop shows (`inCrop`), and an element out of the crop has no anchor. A
// node with no size (`display: none`) has no anchor either: its rectangle is
// at the corner of the frame.
export type ElementAnchor = { anchor: Rect; element: Rect }

export function elementAnchor(
  elementRect: Rect | null,
  node: Element | null,
  view: View,
  box: FrameBox,
): ElementAnchor | null {
  const measured = elementRect === null && node && inLiveFrame(node) ? node.getBoundingClientRect() : null
  const sized = measured && (measured.width > 0 || measured.height > 0) ? measured : null
  const whole = elementRect ?? (sized ? canvasRectOf(view, box, sized) : null)
  const rect = whole && inCrop(whole, canvasCropOf(view, box))
  return rect ? { anchor: { ...pinPoint(rect, pinSize), width: pinSize, height: pinSize }, element: rect } : null
}

// The anchor of a panel in the title row of a frame, in the coordinates of
// the layer: the first node of the editor document that one of the selectors
// finds, in their order; null when none of them is in the document.
export function titleAnchor(layer: Element, selectors: readonly string[]): Rect | null {
  const origin = layer.getBoundingClientRect()
  for (const selector of selectors) {
    const node = window.document.querySelector(selector)
    if (!node) continue
    const rect = node.getBoundingClientRect()
    return { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height }
  }
  return null
}

// The top left corner of a floating panel next to its anchor (a pin, the
// selection, a button of the title row), in canvas coordinates: the bubble
// of a comment and the options panel. The panel is at the right of the
// anchor, `gap` from it, with its top at the top of the anchor; with no room
// at the right, at the left; with room on neither side, at the right edge of
// the canvas. It stays `gap` inside the canvas and out of the strips (the
// notice at the top, the toolbar at the bottom), thus an anchor out of the
// view gives a panel at the nearest edge of the free part, and the toolbar
// never covers its buttons. A canvas that is smaller than the panel gives the
// top left corner of the free part, `gap` from the edges.
//
// `element` is the rectangle of the element of the anchor (a pin is at its
// top right corner), which the panel must not cover: the user reads the
// element while he writes about it. With no room at the right, the panel is
// then at the left of the element, else below it, else above it, with its
// right edge at the right edge of the element; only with room on no side
// does it cover the element, as with no `element`.
export function panelPlace(
  anchor: Rect,
  panel: Size,
  canvas: Size,
  gap: number,
  strips: Strips,
  element: Rect | null = null,
): Point {
  const right = anchor.x + anchor.width + gap
  const maxX = canvas.width - gap - panel.width
  const top = strips.top + gap
  const bottom = canvas.height - strips.bottom - gap - panel.height
  const beside = (x: number): Point => ({ x: clamp(x, gap, maxX), y: clamp(anchor.y, top, bottom) })
  if (right <= maxX) return beside(right)
  const left = (element?.x ?? anchor.x) - gap - panel.width
  if (left >= gap) return beside(left)
  if (element) {
    const x = clamp(element.x + element.width - panel.width, gap, maxX)
    const below = element.y + element.height + gap
    if (below >= top && below <= bottom) return { x, y: below }
    const above = element.y - gap - panel.height
    if (above >= top && above <= bottom) return { x, y: above }
  }
  return beside(maxX)
}

// Places a floating node of the canvas, after each render (a new view, a new
// list) and after a new size of the node or of its layer (the canvas): its
// parent. `placeOf` gets the size of the node and of the layer and gives the
// top left corner in the coordinates of the layer, or null while the node has
// no place (it stays hidden). The place is written to the node, which starts
// hidden (the class `invisible`): an anchor in the title row is read from the
// document. `placeOf` is called at each place. The result is the ref of the
// node; the node can mount later than the caller.
export function useFloatingPlace(placeOf: (self: Size, canvas: Size, layer: Element) => Point | null) {
  // The node in a ref for the place, and in state for the observer of its
  // size, which starts when the node mounts.
  const ref = useRef<HTMLDivElement | null>(null)
  const [mounted, setMounted] = useState<HTMLDivElement | null>(null)
  const attach = useCallback((node: HTMLDivElement | null) => {
    ref.current = node
    setMounted(node)
  }, [])
  const place = () => {
    const self = ref.current
    const layer = self?.parentElement
    if (!self || !layer) return
    const point = placeOf(
      { width: self.offsetWidth, height: self.offsetHeight },
      { width: layer.clientWidth, height: layer.clientHeight },
      layer,
    )
    if (!point) {
      self.style.visibility = ''
      return
    }
    self.style.left = `${point.x}px`
    self.style.top = `${point.y}px`
    self.style.visibility = 'visible'
  }
  const latest = useRef(place)
  useLayoutEffect(() => {
    latest.current = place
    place()
  })
  useEffect(() => {
    const layer = mounted?.parentElement
    if (!mounted || !layer) return
    const observer = new ResizeObserver(() => latest.current())
    observer.observe(mounted)
    observer.observe(layer)
    return () => observer.disconnect()
  }, [mounted])
  return attach
}

// Places a floating panel next to its anchor (`panelPlace`), in the free part
// of the canvas: out of the notice and the toolbar. `anchor` gives the anchor
// in the coordinates of the layer, with the element that the panel does not
// cover (`elementAnchor`) or with none (an anchor of the title row), or null
// while it has none.
export function usePanelPlace(anchor: (layer: Element) => { anchor: Rect; element: Rect | null } | null) {
  return useFloatingPlace((self, canvas, layer) => {
    const place = anchor(layer)
    return place && panelPlace(place.anchor, self, canvas, floatingGap, overlayStrips, place.element)
  })
}

// An anchor of the title row for `usePanelPlace`: no element to keep free.
export function rowAnchor(rect: Rect | null): { anchor: Rect; element: null } | null {
  return rect && { anchor: rect, element: null }
}
