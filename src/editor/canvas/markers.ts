import type { Issue } from '../../requests/format.ts'
import { locOf } from '../edits/model.ts'
import type { Rect } from './viewport.ts'

// The markers of the elements that are not from the library: an outline and a
// small badge with the tag name on each copy of each `not-library` place of
// the Issues list. The user can hide them with a switch in the toolbar; the
// choice is kept in `localStorage`.

// One marker: `key` is the place in the code and the index of the copy.
export type Marker = { key: string; tag: string; rect: Rect }

// The rect of each visible copy of each place in `issues` that is not from the
// library. `nodesOf` gives the first DOM node of each copy of a place, in
// document order; `rectOf` gives the rect of a node in canvas coordinates, or
// null when the node is not in the current document. A node that the preview
// hides (`hidden`), and a node with no size at all, have no marker.
export function markerRects<N>(
  issues: readonly Issue[],
  nodesOf: (loc: string) => readonly N[],
  rectOf: (node: N) => Rect | null,
  hidden: (node: N) => boolean,
): Marker[] {
  const result: Marker[] = []
  for (const issue of issues) {
    if (issue.kind !== 'not-library') continue
    const loc = locOf(issue.target)
    nodesOf(loc).forEach((node, index) => {
      if (hidden(node)) return
      const rect = rectOf(node)
      if (!rect || (rect.width === 0 && rect.height === 0)) return
      result.push({ key: `${loc}#${index}`, tag: issue.target.tag, rect })
    })
  }
  return result
}

const storageKey = 'canvas-editor-markers'

// The markers show unless the stored choice is `off`.
export function parseMarkersShown(value: string | null): boolean {
  return value !== 'off'
}

// `localStorage` can be missing (Node in the tests) or blocked by the browser:
// then the markers show, and a choice is kept for this session only.
export function readMarkersShown(): boolean {
  try {
    return parseMarkersShown(window.localStorage.getItem(storageKey))
  } catch {
    return true
  }
}

export function writeMarkersShown(shown: boolean) {
  try {
    if (shown) window.localStorage.removeItem(storageKey)
    else window.localStorage.setItem(storageKey, 'off')
  } catch {
    // The choice is kept for this session only.
  }
}
