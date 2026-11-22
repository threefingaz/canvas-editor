import { linkTarget } from '../../frame/screen-link.ts'
import type { Rect } from './viewport.ts'

// The rectangles of the links of each screen in its frame document: for each
// screen that a screen links to, the rectangle of the first visible link
// element with its address. The arrows of the canvas start there
// (`flow.ts`). The measure of the frame writes them (`useMeasureRects`), thus
// a screen has one set of observers; the layer of the flow reads the store
// and reads no frame. The pure parts are here.

// A link element that the measure reads.
export type LinkRectNode = {
  isConnected: boolean
  getAttribute: (name: string) => string | null
  getBoundingClientRect: () => Rect
}

// The rectangle of the first visible link to each screen of `ids`, by the id
// of that screen, in the coordinates of the frame document. `nodes` are the
// link elements in the order of the document. A node that is no longer in the
// document, a node that the preview hides and a node with no size count as
// not there, as in `rectsOf`: a later link to the same screen then gives the
// rectangle. A link to an address that is not a screen of `ids` is left out.
export function linkRectsOf<N extends LinkRectNode>(
  nodes: readonly N[],
  ids: readonly string[],
  hidden: (node: N) => boolean,
): Map<string, Rect> {
  const result = new Map<string, Rect>()
  for (const node of nodes) {
    const target = linkTarget(node.getAttribute('href'), ids)
    if (target.kind !== 'screen' || result.has(target.id)) continue
    if (!node.isConnected || hidden(node)) continue
    const { x, y, width, height } = node.getBoundingClientRect()
    if (width === 0 && height === 0) continue
    result.set(target.id, { x, y, width, height })
  }
  return result
}

// The link rectangles of one screen, by the id of the target screen.
export type LinkRects = ReadonlyMap<string, Rect>

// True when two measures of a screen are the same: the store then keeps the
// old one, and the layer of the flow does not render for a change of a frame
// that moved no link.
export function sameLinkRects(a: LinkRects | undefined, b: LinkRects): boolean {
  if (!a || a.size !== b.size) return false
  for (const [id, rect] of b) {
    const old = a.get(id)
    if (!old || old.x !== rect.x || old.y !== rect.y || old.width !== rect.width || old.height !== rect.height) return false
  }
  return true
}

export type LinkRectsStore = {
  // The link rectangles of each screen, by the id of the screen. The map is
  // a new one after each change, thus it is a snapshot for React.
  get: () => ReadonlyMap<string, LinkRects>
  set: (screenId: string, rects: LinkRects) => void
  delete: (screenId: string) => void
  subscribe: (listener: () => void) => () => void
}

export function createLinkRectsStore(): LinkRectsStore {
  let entries: ReadonlyMap<string, LinkRects> = new Map()
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) listener()
  }
  return {
    get: () => entries,
    set: (screenId, rects) => {
      if (sameLinkRects(entries.get(screenId), rects)) return
      entries = new Map(entries).set(screenId, rects)
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

// The link rectangles of the editor.
export const linkRects = createLinkRectsStore()
