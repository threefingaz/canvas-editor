import type { Issue } from '../../requests/format.ts'
import { locOf } from '../edits/model.ts'
import type { Rect } from './viewport.ts'

// The markers of the elements that are not from the library: an outline and a
// small badge with the tag name on each copy of each `not-library` place of
// the Issues list. The user can hide them with a switch in the toolbar; the
// choice is kept in `localStorage`.

// The second kind of marker: a library element with a value that the screen
// file sets and that has no token (a `no-token` issue with `set: 'screen'`, or
// a local override). Its badge names the value, `gap 16px`, and how many more
// the element has, thus the user sees on the canvas which value deviates.

// One marker: `key` is the place in the code and the index of the copy; `tag`
// is the text of its badge.
export type Marker = { key: string; tag: string; rect: Rect; kind: 'element' | 'value' }

// The text of the badge of each place with a marker: the tag of an element
// that is not from the library, else the first value that deviates and the
// count of the others.
export function markerLabels(issues: readonly Issue[]): Map<string, { tag: string; kind: Marker['kind'] }> {
  const labels = new Map<string, { tag: string; kind: Marker['kind'] }>()
  // The values that the file writes as they are come first.
  const values = new Map<string, string[]>()
  const sorted = [...issues].sort((a, b) => Number(b.kind === 'no-token' && b.written === true) - Number(a.kind === 'no-token' && a.written === true))
  for (const issue of sorted) {
    if (issue.kind === 'not-library') labels.set(locOf(issue.target), { tag: issue.target.tag, kind: 'element' })
    else if ((issue.kind === 'no-token' && issue.set === 'screen') || issue.kind === 'override') {
      const loc = locOf(issue.target)
      const text = `${issue.property} ${issue.value}`
      const list = values.get(loc)
      if (!list) values.set(loc, [text])
      else if (!list.includes(text)) list.push(text)
    }
  }
  for (const [loc, list] of values) {
    if (!labels.has(loc)) labels.set(loc, { tag: list.length === 1 ? list[0] : `${list[0]} +${list.length - 1}`, kind: 'value' })
  }
  return labels
}

// The rect of each visible copy of each place in `issues` that has a marker
// (`markerLabels`). `nodesOf` gives the first DOM node of each copy of a place, in
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
  for (const [loc, label] of markerLabels(issues)) {
    nodesOf(loc).forEach((node, index) => {
      if (hidden(node)) return
      const rect = rectOf(node)
      if (!rect || (rect.width === 0 && rect.height === 0)) return
      result.push({ key: `${loc}#${index}`, ...label, rect })
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
