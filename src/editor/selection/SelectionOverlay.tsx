import { useEffect, useReducer, useSyncExternalStore } from 'react'
import type { FrameBox } from '../canvas/layout.ts'
import type { Rect, View } from '../canvas/viewport.ts'
import { bubble } from '../comments/bubble-store.ts'
import { followPlace } from '../edits/anchor.ts'
import { edits } from '../edits/store.ts'
import { frameWindowOf } from '../frame-window.ts'
import { hiddenIn } from '../preview/css.ts'
import { onPreviewApplied, screenElementsOf, usePreviewRemeasure } from '../preview/use-preview.ts'
import { moveDrag } from './drag-store.ts'
import { canvasRectOf } from './geometry.ts'
import { refind, type Hovered } from './pick.ts'
import { SelectionBar } from './SelectionBar.tsx'
import { selection, selectionKey, useSelection } from './store.ts'

// The layer above the frames that draws the outline of the element below the
// pointer, the frame of the selected element, and the bar of the selection
// (`SelectionBar.tsx`) with the name of the element and its actions. The
// layer does not get the pointer, only the bar does: the overlay of each frame
// gets it and the editor calls `hitAt` and `pickAt` (see `Frame.tsx` and
// `App.tsx`).
//
// The rectangles are in canvas coordinates and are measured at each render,
// thus they follow pan and zoom (a new view), a new frame height (a new
// layout), a new size of the selected node (an observer here), and each
// application of the preview, which can move a node and not change its size.
//
// A screen edit reloads its frame. The selection then finds the element at the
// place that the anchor pass gives it (`followPlace`: the same place when the
// change moved nothing, a new place when the agent changed lines above it), or
// clears when it is gone or its place is not certain (see `refind`). A comment
// bubble or options panel of the element follows it to its new place with its
// draft and its focus; when the element is gone or its new place is not
// certain, it stays open with the draft and a warning, detached from the old
// place (the event `gone`): it never takes the element that is there now. An
// open bubble of a different place (the comments on the screen) stays open
// too: the change comes from the file, not from the user (`keepOpen` of the
// bubble store). The selection clears when its screen is removed or its file
// cannot be read, and when the preview hides the selected node (a remove
// edit, also after a redo). Escape clears the selection (the one Escape
// listener of `App.tsx`). With the Preview switch on (`shown` false) the
// layer draws nothing.

type SelectionOverlayProps = {
  view: View
  frames: readonly FrameBox[]
  // The current document of each frame, by screen id.
  documents: ReadonlyMap<string, Document>
  hover: Hovered | null
  shown: boolean
}

export function SelectionOverlay({ view, frames, documents, hover, shown }: SelectionOverlayProps) {
  const selected = useSelection()
  // No outline of the element below the pointer while the selected element
  // drags (`MoveDrag`): the line of the drop shows the place.
  const dragging = useSyncExternalStore(moveDrag.subscribe, moveDrag.dragging)
  const [, remeasure] = useReducer((count: number) => count + 1, 0)

  // The screen of the selection is removed, or its file cannot be read: its
  // frame has no document, thus the selection clears.
  const boxes = new Map(frames.map((box) => [box.screen.id, box]))
  const selectedScreen = selected ? boxes.get(selected.screenId)?.screen : undefined
  const screenGone = selected !== null && (selectedScreen === undefined || selectedScreen.error !== undefined)
  useEffect(() => {
    if (screenGone) selection.clear()
  }, [screenGone])

  // After a reload of the frame, find the element again in the new document.
  // The observer also catches a new render inside the same document (a hot
  // update of the library) that takes the selected node out.
  const frameDocument = selected ? documents.get(selected.screenId) : undefined
  useEffect(() => {
    if (!selected || !frameDocument) return
    const { screenId, loc } = selected
    // The place of the element in the frame document: the same place in the
    // same document (a new render), else its place after a change of the
    // screen file, from the elements of the document before to those of the
    // new one.
    const placeOf = (place: string) => {
      const before = selected.node.ownerDocument
      if (before === frameDocument) return place
      return followPlace(place, selected.index, screenElementsOf(before), screenElementsOf(frameDocument))
    }
    const apply = () => {
      const result = refind(selected, frameDocument, placeOf)
      if (result.action === 'select') {
        const to = result.picked.loc
        if (to !== loc) bubble.send({ type: 'moved', screenId, from: loc, to })
        bubble.keepOpen(() => selection.select({ ...result.picked, screenId }))
      } else if (result.action === 'clear') {
        // A panel of the place stays open, but detached from it: a sibling can
        // be at the old place now.
        bubble.send({ type: 'gone', screenId, loc })
        bubble.keepOpen(() => selection.clear())
      }
    }
    apply()
    const frameWindow = frameWindowOf(frameDocument)
    if (!frameWindow) return
    const observer = new frameWindow.MutationObserver(apply)
    observer.observe(frameDocument, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [selected, frameDocument])

  // The preview hides the selected node or one of its parents: a remove edit
  // of the screen. Checked at each new selection (a frame that loads again
  // finds the element again) and after each application of the preview.
  useEffect(() => {
    if (!selected) return
    const check = () => {
      if (hiddenIn(edits.get(selected.screenId))(selected.node)) selection.clear()
    }
    check()
    return onPreviewApplied(check)
  }, [selected])

  // A new size of the selected node, with no new frame height.
  useEffect(() => {
    const frameWindow = frameWindowOf(selected?.node.ownerDocument)
    if (!selected || !frameWindow) return
    const observer = new frameWindow.ResizeObserver(() => remeasure())
    observer.observe(selected.node)
    return () => observer.disconnect()
  }, [selected])

  // A preview can move a node: measure again.
  usePreviewRemeasure(remeasure, true)

  // The rectangle of a node of a frame in canvas coordinates; null when the
  // node is not in the current document of its frame.
  const rectOf = (screenId: string, node: Element): Rect | null => {
    const box = boxes.get(screenId)
    if (!box || node.ownerDocument !== documents.get(screenId) || !node.isConnected) return null
    return canvasRectOf(view, box, node.getBoundingClientRect())
  }

  if (!shown) return null

  const selectedRect = selected && rectOf(selected.screenId, selected.node)
  const hoverRect = hover && !dragging && hover.node !== selected?.node ? rectOf(hover.screenId, hover.node) : null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-clip" data-selection-layer="">
      {hoverRect && (
        <div
          className="absolute border border-[color:var(--link)]"
          data-hover-outline=""
          style={placement(hoverRect)}
        />
      )}
      {selected && selectedRect && (
        <div className="absolute border-2 border-[color:var(--link)]" data-selection-frame="" style={placement(selectedRect)} />
      )}
      {selected && (
        <SelectionBar
          key={selectionKey(selected)}
          selected={selected}
          rect={selectedRect}
          view={view}
          box={boxes.get(selected.screenId) ?? null}
        />
      )}
    </div>
  )
}

function placement(rect: Rect) {
  return { left: rect.x, top: rect.y, width: rect.width, height: rect.height }
}
