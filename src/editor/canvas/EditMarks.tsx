import { isLive } from '../edits/model.ts'
import { canvasCropOf, canvasRectOf } from '../selection/geometry.ts'
import { editMarks, markPoint, markSize, type EditMark } from './edit-marks.ts'
import { FrameLayer } from './FrameLayer.tsx'
import type { FrameBox } from './layout.ts'
import { inCrop } from './part.ts'
import { useScreenRects } from './use-screen-rects.ts'
import type { View } from './viewport.ts'

// The layer of the marks of the open edits, above the markers and below the
// pins: a small dot at the bottom left corner of each element with edits that
// have a preview (`editMarks`), away from the badge of a marker (top left),
// the pin (top right) and the bar. `data-edit-mark-count` is the count of the
// edits of the element. Neither the layer nor a mark gets the pointer. With
// the Preview switch on, or with the markers switch of the toolbar off, the
// layer draws nothing (`shown` false).
//
// One child for each frame reads the edits of its screen (`useScreenRects`),
// thus an edit renders only the marks of its screen again. The rectangles
// come from the shared measure of the screen; each render places them in the
// coordinates of the canvas (a new view, a new layout). In a frame with a
// crop, an element that the crop does not show has no mark, and the mark of
// an element that is larger than the crop is at the corner of its part in
// the crop (`inCrop`).

type EditMarksProps = {
  view: View
  frames: readonly FrameBox[]
  // The current document of each frame, by screen id.
  documents: ReadonlyMap<string, Document>
  shown: boolean
}

export function EditMarks({ view, frames, documents, shown }: EditMarksProps) {
  return (
    <FrameLayer frames={frames} documents={documents} shown={shown} layer="edit-mark-layer">
      {(box, document) => <FrameMarks view={view} box={box} document={document} />}
    </FrameLayer>
  )
}

const noMarks: EditMark[] = []

function FrameMarks({ view, box, document }: { view: View; box: FrameBox; document: Document | null }) {
  const marks = useScreenRects(box.screen.id, {
    source: document,
    enabled: true,
    // Only the element of an item that the preview shows gets a mark.
    watches: isLive,
    place: (nodeRect) => canvasRectOf(view, box, nodeRect),
    derive: editMarks,
    empty: noMarks,
  })
  if (!marks) return null
  const crop = canvasCropOf(view, box)
  return (
    <>
      {marks.map((mark) => {
        const rect = inCrop(mark.rect, crop)
        if (!rect) return null
        const point = markPoint(rect, markSize)
        return (
          <span
            key={mark.key}
            className="absolute rounded-full bg-[color:var(--accent)] ring-2 ring-[color:var(--background)]"
            style={{ left: point.x, top: point.y, width: markSize, height: markSize }}
            aria-hidden
            data-edit-mark={mark.key}
            data-edit-mark-screen={box.screen.id}
            data-edit-mark-count={mark.count}
          />
        )
      })}
    </>
  )
}
