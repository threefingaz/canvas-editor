import { useEffect, useReducer } from 'react'
import { locOf } from '../edits/model.ts'
import { edits } from '../edits/store.ts'
import { frameWindowOf } from '../frame-window.ts'
import { useIssueScreens } from '../issues/store.ts'
import { once } from '../once.ts'
import { hiddenIn } from '../preview/css.ts'
import { usePreviewRemeasure } from '../preview/use-preview.ts'
import { toEditorRect } from '../selection/geometry.ts'
import { nodesByLoc } from '../selection/pick.ts'
import type { FrameBox } from './layout.ts'
import { markerRects, type Marker } from './markers.ts'
import { toScreen, type View } from './viewport.ts'

// The layer above the frames, below the selection layer, that marks each copy
// of each element that is not from the library (the `not-library` issues of
// each screen) with an outline and a badge with its tag name. It does not get
// the pointer.
//
// The rectangles are in canvas coordinates and are measured at each render,
// as those of the selection layer: a new view, a new layout, a new list of
// issues, a new size of a marked node (an observer here), and each application
// of the preview, which can move a node and not change its size.

type MarkersProps = {
  view: View
  frames: readonly FrameBox[]
  // The current document of each frame, by screen id.
  documents: ReadonlyMap<string, Document>
  shown: boolean
}

export function Markers({ view, frames, documents, shown }: MarkersProps) {
  const screens = useIssueScreens()
  const [, remeasure] = useReducer((count: number) => count + 1, 0)

  // A new size of a marked node, with no new frame height.
  useEffect(() => {
    if (!shown) return
    const observers: ResizeObserver[] = []
    for (const [screenId, document] of documents) {
      const frameWindow = frameWindowOf(document)
      const list = screens[screenId]
      if (!frameWindow || !list) continue
      const observer = new frameWindow.ResizeObserver(() => remeasure())
      const nodes = nodesByLoc(document)
      for (const issue of list) {
        if (issue.kind === 'not-library') for (const node of nodes.get(locOf(issue.target)) ?? []) observer.observe(node)
      }
      observers.push(observer)
    }
    return () => {
      for (const observer of observers) observer.disconnect()
    }
  }, [shown, documents, screens])

  // A preview can move a node: measure again.
  usePreviewRemeasure(remeasure, shown)

  if (!shown) return null

  const markers: Marker[] = []
  for (const box of frames) {
    const document = documents.get(box.screen.id)
    const list = screens[box.screen.id]
    if (!document || !list) continue
    const corner = toScreen(view, box)
    // One walk of the document for all the places of the list, and none for
    // a list with no marker.
    const nodes = once(() => nodesByLoc(document))
    const rects = markerRects(
      list,
      (loc) => nodes().get(loc) ?? [],
      (node) => (node.isConnected ? toEditorRect(node.getBoundingClientRect(), corner, view.scale) : null),
      hiddenIn(edits.get(box.screen.id)),
    )
    for (const marker of rects) markers.push({ ...marker, key: `${box.screen.id}:${marker.key}` })
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-clip" data-marker-layer="">
      {markers.map((marker) => (
        <div
          key={marker.key}
          className="absolute border border-dashed border-[color:var(--attention)]"
          data-marker=""
          style={{ left: marker.rect.x, top: marker.rect.y, width: marker.rect.width, height: marker.rect.height }}
        >
          <span
            className="absolute bottom-full -left-px rounded-t-sm bg-[color:var(--attention)] px-1 text-[10px] leading-3.5 whitespace-nowrap text-[color:var(--attention-foreground)]"
            data-marker-label=""
          >
            {marker.tag}
          </span>
        </div>
      ))}
    </div>
  )
}
