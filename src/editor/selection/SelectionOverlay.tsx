import { useEffect, useReducer } from 'react'
import type { FrameBox } from '../canvas/layout.ts'
import { toScreen, type Rect, type View } from '../canvas/viewport.ts'
import { edits } from '../edits/store.ts'
import { frameWindowOf } from '../frame-window.ts'
import { hiddenIn } from '../preview/css.ts'
import { onPreviewApplied, usePreviewRemeasure } from '../preview/use-preview.ts'
import { toEditorRect } from './geometry.ts'
import { refind, type Hovered } from './pick.ts'
import { selection, useSelection } from './store.ts'

// The layer above the frames that draws the outline of the element below the
// pointer and the frame of the selected element, with its type as a label.
// It does not get the pointer: the overlay of each frame gets it and the
// editor calls `hitAt` and `pickAt` (see `Frame.tsx` and `App.tsx`).
//
// The rectangles are in canvas coordinates and are measured at each render,
// thus they follow pan and zoom (a new view), a new frame height (a new
// layout), a new size of the selected node (an observer here), and each
// application of the preview, which can move a node and not change its size.
//
// A screen edit reloads its frame. The selection then finds the element with
// the same location and index in the new document, or clears when it is gone
// (see `refind`). It clears when its screen is removed or its file cannot be
// read, and when the preview hides the selected node (a remove edit, also
// after a redo). Escape clears the selection. With the Preview switch on
// (`shown` false) the layer draws nothing.

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
  const [, remeasure] = useReducer((count: number) => count + 1, 0)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A field that uses Escape (it puts back its text) prevents the default.
      if (event.key === 'Escape' && !event.defaultPrevented) selection.clear()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
    const apply = () => {
      const result = refind(selected, frameDocument)
      if (result.action === 'select') selection.select({ ...result.picked, screenId: selected.screenId })
      else if (result.action === 'clear') selection.clear()
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
    return toEditorRect(node.getBoundingClientRect(), toScreen(view, box), view.scale)
  }

  if (!shown) return null

  const selectedRect = selected && rectOf(selected.screenId, selected.node)
  const hoverRect = hover && hover.node !== selected?.node ? rectOf(hover.screenId, hover.node) : null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" data-selection-layer="">
      {hoverRect && (
        <div
          className="absolute border border-[color:var(--link)]"
          data-hover-outline=""
          style={placement(hoverRect)}
        />
      )}
      {selected && selectedRect && (
        <div className="absolute border-2 border-[color:var(--link)]" data-selection-frame="" style={placement(selectedRect)}>
          <span
            className="absolute bottom-full -left-0.5 mb-0.5 rounded-sm bg-[color:var(--link)] px-1 py-px text-[11px] leading-4 whitespace-nowrap text-[color:var(--link-foreground)]"
            data-selection-label=""
          >
            {selected.name}
          </span>
        </div>
      )}
    </div>
  )
}

function placement(rect: Rect) {
  return { left: rect.x, top: rect.y, width: rect.width, height: rect.height }
}
