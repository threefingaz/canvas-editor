import type { Point } from '../canvas/viewport.ts'
import { frameWindowOf } from '../frame-window.ts'
import { elementOf, elementsAt, fiberOf, hostNode, screenElement, siteOf, type Fiber, type Site } from '../locate/fiber.ts'

// From a point of a frame document to the screen element there, and from a
// location and an index to the element again in a new frame document.
//
// The document is that of a frame, thus this module uses no `instanceof` with
// the classes of the editor window. It reads only the members in
// `FrameDocument`, thus the tests give plain objects.

export type FrameDocument = {
  elementFromPoint: (x: number, y: number) => Element | null
  body: { getElementsByTagName: (name: string) => ArrayLike<Element> } | null
  getElementById: (id: string) => { hasChildNodes: () => boolean } | null
}

// A screen element: its first DOM node, its location (the location part,
// `file:line:column`) and its tag name in the screen file.
export type Hit = { node: Element; loc: string; name: string }

// A screen element with its position among the elements with its location.
export type Picked = Hit & { index: number }

// The element below the pointer, in a frame.
export type Hovered = Hit & { screenId: string }

function elementsOf(document: FrameDocument): Element[] {
  return document.body ? Array.from(document.body.getElementsByTagName('*')) : []
}

// The elements with the location `loc`, in document order of their first DOM
// node. `nodes` are the DOM nodes of the document in document order. An
// element that shares its first node with an inner element counts too.
function instances(nodes: Iterable<Element>, loc: string): Hit[] {
  const result: Hit[] = []
  for (const node of nodes) {
    const element = elementOf(node, loc)
    const site = element && siteOf(element)
    if (site) result.push({ node, loc, name: site.tag })
  }
  return result
}

function hitOf(element: Fiber | null): Hit | null {
  const node = element && hostNode(element)
  const site = element && siteOf(element)
  return node && site ? { node, loc: site.loc, name: site.tag } : null
}

function elementAt(document: FrameDocument, point: Point): Fiber | null {
  return screenElement(fiberOf(document.elementFromPoint(point.x, point.y)))
}

// A screen element (the outer record of its location, see `screenElement`)
// of the frame document, with its index. Null when it has no location,
// renders no node, or its node is not among the nodes of the document.
export function pickElement(document: FrameDocument, element: Fiber | null): Picked | null {
  const hit = hitOf(element)
  if (!hit) return null
  const index = instances(elementsOf(document), hit.loc).findIndex((instance) => instance.node === hit.node)
  return index === -1 ? null : { ...hit, index }
}

// True for a node that the preview hides (see `hiddenBy`).
export type Hidden = (node: Element) => boolean

// A node that the preview hides: the node or one of its parent nodes matches
// `selector`, the selector of the removed elements (`removedSelector`). With
// no selector nothing is hidden.
export function hiddenBy(selector: string | null): (node: { closest: (selector: string) => unknown }) => boolean {
  return (node) => selector !== null && node.closest(selector) !== null
}

// The screen element at a point of the frame document (frame coordinates),
// with no index: for the outline that follows the pointer. Null when the point
// has no node, the node is not in a screen element, or the preview hides the
// first node of the element (a node of a portal is outside the hidden node).
export function hitAt(document: FrameDocument, point: Point, hidden: Hidden): Hit | null {
  const hit = hitOf(elementAt(document, point))
  return hit && !hidden(hit.node) ? hit : null
}

// The screen element at a point of the frame document, with its index: for a
// click that selects it. Null as for `hitAt`.
export function pickAt(document: FrameDocument, point: Point, hidden: Hidden): Picked | null {
  const picked = pickElement(document, elementAt(document, point))
  return picked && !hidden(picked.node) ? picked : null
}

// The element with the same location and index in the document; null when it
// is gone. The name is read again: an edit can change the tag.
export function findAgain(document: FrameDocument, loc: string, index: number): Picked | null {
  const found = instances(elementsOf(document), loc)[index]
  return found ? { ...found, index } : null
}

// The first DOM node of each element with the location `loc` (each copy that
// the place draws), in document order. Empty when the place draws nothing.
export function nodesAt(document: FrameDocument, loc: string): Element[] {
  return instances(elementsOf(document), loc).map((instance) => instance.node)
}

// The first DOM node of each copy of each place of the document, by location,
// in one walk of the document: `nodesAt` for all places at once.
export function nodesByLoc(document: FrameDocument): Map<string, Element[]> {
  const result = new Map<string, Element[]>()
  for (const { node, site } of sitesIn(document)) {
    const list = result.get(site.loc)
    if (!list) result.set(site.loc, [node])
    else if (list.at(-1) !== node) list.push(node)
  }
  return result
}

// Each screen element of the frame document with its first DOM node and its
// site: one entry for each copy of a place, in document order of the nodes,
// inner first for the elements of one node.
export function sitesIn(document: FrameDocument): { node: Element; site: Site }[] {
  const result: { node: Element; site: Site }[] = []
  for (const node of elementsOf(document)) {
    for (const element of elementsAt(node)) {
      const site = siteOf(element)
      if (site) result.push({ node, site })
    }
  }
  return result
}

// True when the frame entry (`src/frame/main.tsx`) has rendered into its root.
// The screen loads after the `load` event of the frame, thus a reloaded frame
// is empty for a short time.
export function screenRendered(document: FrameDocument): boolean {
  return document.getElementById('root')?.hasChildNodes() ?? false
}

// The selected element as `refind` reads it.
export type Found = { node: { ownerDocument: unknown; isConnected: boolean }; loc: string; index: number }

export type Refind =
  // The node is still in the current document of its frame.
  | { action: 'keep' }
  // The frame has a new document, but the screen is not rendered yet.
  | { action: 'wait' }
  | { action: 'select'; picked: Picked }
  // The element is gone.
  | { action: 'clear' }

// What the selection does when the document of its frame changes, or when the
// frame document changes inside: a reload of the frame gives a new document,
// and a hot update of the library can render the screen again with new nodes.
export function refind(selected: Found, document: FrameDocument): Refind {
  if (selected.node.ownerDocument === document && selected.node.isConnected) return { action: 'keep' }
  if (!screenRendered(document)) return { action: 'wait' }
  const picked = findAgain(document, selected.loc, selected.index)
  return picked ? { action: 'select', picked } : { action: 'clear' }
}

// The place of an element among the element children of its parent node.
export type Siblings = {
  position: number
  count: number
  // The layout of the parent node: the `order` of a preview works only in a
  // flex or grid container.
  container: 'flex' | 'grid' | null
  // True when a sequence edit is possible: the place draws one copy, the
  // element is the outer element of its node, and each element child of the
  // parent node is the first node of a different screen element with the
  // same parent in the code. Then a position among the child nodes is a
  // position among the sibling elements in the code. A list from a `map` is
  // one place in the code, thus its items cannot move.
  movable: boolean
}

function containerOf(display: string): Siblings['container'] {
  if (display.includes('flex')) return 'flex'
  if (display.includes('grid')) return 'grid'
  return null
}

// The computed `display` of an element of a frame, from the frame window.
function computedDisplay(element: Element): string {
  return frameWindowOf(element.ownerDocument)?.getComputedStyle(element).display ?? ''
}

// The location of the outer screen element whose first node is `node`, and
// the location of its parent element in the code. Null when the node is not
// the first node of a screen element, or the element has no parent element.
function outerOf(node: Element): { loc: string; parent: string } | null {
  const outer = elementsAt(node).at(-1)
  const loc = outer && siteOf(outer)?.loc
  const parentElement = outer && screenElement(outer.return)
  const parent = parentElement && siteOf(parentElement)?.loc
  return loc && parent ? { loc, parent } : null
}

// The place of the element with the location `loc` and the first node `node`
// among the element children of its parent node. `copies` is the count of
// copies that the place draws. Null for a node with no parent element.
export function siblingsOf(
  node: Element,
  loc: string,
  copies: number,
  displayOf: (element: Element) => string = computedDisplay,
): Siblings | null {
  const parent = node.parentElement
  if (!parent) return null
  const children = Array.from(parent.children)
  const position = children.indexOf(node)
  if (position === -1) return null
  const outers = children.map(outerOf)
  const own = outers[position]
  const movable =
    copies === 1 &&
    children.length > 1 &&
    own?.loc === loc &&
    outers.every((outer) => outer !== null && outer.parent === own.parent) &&
    new Set(outers.map((outer) => outer?.loc)).size === children.length
  return { position, count: children.length, container: containerOf(displayOf(parent)), movable }
}
