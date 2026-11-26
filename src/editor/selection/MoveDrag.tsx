import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { inCrop } from '../canvas/part.ts'
import type { Point, Rect, View } from '../canvas/viewport.ts'
import { inLiveFrame } from '../frame-window.ts'
import { moveDrag } from './drag-store.ts'
import { canvasCropOf, canvasRectOf, toFramePoint } from './geometry.ts'
import { dropLine, dropPosition, lineBox, pointIn } from './move-drag.ts'
import { showsPlan } from './move.ts'
import type { Selected } from './store.ts'
import type { Shown, UseMove } from './use-move.ts'

// The drag of the selected element among its siblings, a child of the bar of
// the selection: mounted while an element is selected and Preview is off.
//
// A press with the main button on the overlay of the frame of the selection
// (`[data-frame-overlay]`), in the rectangle of the selected element, and a
// move of `dragThreshold` px on the screen or more starts a drag; with less
// movement it is a click, thus a pick as before. A press on a child of the
// selected element drags the selected element. The rectangles and the flow of the siblings are
// read at the press (`rectsNow`) and kept for the drag. During the drag a line
// shows the place of the drop (`dropLine`), and the release applies the move
// (`moveTo`). The click after a drag is stopped in the capture phase, thus it
// is not a pick (`dragAfter`, the guard of the drag store).
//
// No drag starts when `canDrag` is false: `place.drag` of the move (a parent
// with a preview of a move, no different sibling with an open move, and a
// frame that shows the plan, `showsPlan`, as measured for the last render)
// and no `off` of the bar. The press checks `showsPlan` again, because the
// frame can change between that measure and the press. No drag starts with
// a different button either, or while Space is down (a layer of the canvas then covers the
// frames, thus the overlay gets no press). A node that is no longer in a live
// frame (the agent wrote the file), a selection that follows its element to
// a new document, a `canDrag` that turns off and a plan that no longer fits
// the kept sequence cancel the drag; Escape cancels it too
// (the one Escape listener of `App.tsx`). An unmount cancels a drag that runs.
//
// The listeners are native, on the overlay node, and attached again when the
// frame renders a different overlay node. The overlay node changes only with
// a new render of the frame list or an error of the screen file, which also
// render the selection layer, thus the bar finds the new node. The cursor is
// the attribute `data-drag-cursor` of the overlay (`grab` over the selected
// element, `grabbing` during a drag), which a class of `Frame.tsx` reads;
// removed at the unmount. The line of the drop is in the selection layer, in
// canvas coordinates, with a fixed thickness on the screen and no pointer.
// Nothing is written into the frame.

// The thickness of the line of the drop, in px on the screen.
const lineThickness = 2

type MoveDragProps = {
  selected: Selected
  move: UseMove
  // A drag is possible: `place.drag` of the move, and no `off` of the bar.
  canDrag: boolean
  view: View
  // The top left corner of the frame of the selection in world coordinates,
  // and the crop of an option with a part: the line of the drop ends there.
  box: Point & { crop?: Rect }
}

export function MoveDrag({ selected, move, canDrag, view, box }: MoveDragProps) {
  const { node, screenId } = selected
  const drag = useSyncExternalStore(moveDrag.subscribe, moveDrag.get)

  // The overlay of the frame, found again at each render (a pan or a zoom
  // renders the bar), thus a frame that renders a new overlay node gets the
  // listeners again.
  const overlay = document.querySelector<HTMLElement>(`[data-frame-overlay="${CSS.escape(screenId)}"]`)

  // The latest props for the listeners.
  const latest = useRef({ node, move, canDrag, scale: view.scale })
  useLayoutEffect(() => {
    latest.current = { node, move, canDrag, scale: view.scale }
  })

  useEffect(() => {
    if (!overlay) return
    let kept: Shown | null = null
    // The node of the press: a drag ends when the selection has a different
    // node (the frame loaded again, and the selection followed its element to
    // the new document), because the kept rectangles are of the old one.
    let pressed: Element | null = null
    // The pointer of the press: the events of a second pointer (a second
    // finger, a pen) during a press or a drag change nothing.
    let pointer: number | null = null
    const other = (event: PointerEvent) => moveDrag.get().drag.kind !== 'idle' && event.pointerId !== pointer
    let settle = 0

    const pointOf = (event: PointerEvent | MouseEvent): Point =>
      toFramePoint({ x: event.clientX, y: event.clientY }, overlay.getBoundingClientRect(), latest.current.scale)
    const onElement = (point: Point) => {
      const { node } = latest.current
      return inLiveFrame(node) && pointIn(node.getBoundingClientRect(), point)
    }
    const setCursor = (point: Point) => {
      const { canDrag } = latest.current
      const cursor = moveDrag.dragging() ? 'grabbing' : canDrag && onElement(point) ? 'grab' : null
      if (cursor) overlay.dataset.dragCursor = cursor
      else delete overlay.dataset.dragCursor
    }
    // The capture of a drag goes with its end, thus a drag that Escape or an
    // unmount ended takes the events of no other part (the toolbar, the
    // panel) until the release.
    const release = () => {
      if (pointer !== null && overlay.hasPointerCapture(pointer)) overlay.releasePointerCapture(pointer)
    }
    const cancel = () => {
      release()
      kept = null
      pressed = null
      pointer = null
      moveDrag.send({ type: 'cancel' })
    }
    // The kept rectangles no longer hold, or no drag is possible now: a
    // different node, a node out of its frame, `canDrag` off (an open `keep`,
    // a move of a sibling from the file, an undo), or a plan that the kept
    // sequence no longer shows (an undo or a redo of the own move, the file).
    const stale = () => {
      const { node, canDrag, move } = latest.current
      return (
        !kept || node !== pressed || !canDrag || !inLiveFrame(node) || !showsPlan(kept.sequence, kept.position, move.plan)
      )
    }

    const onPointerDown = (event: PointerEvent) => {
      // A second press (a second pointer) during a press or a drag changes
      // nothing.
      if (event.button !== 0 || moveDrag.get().drag.kind !== 'idle') return
      const point = pointOf(event)
      const { node, move, canDrag } = latest.current
      // The frame must show the plan at the press (`showsPlan`): a drop is
      // then a position in the code after the own move of the element.
      const shown = canDrag && onElement(point) ? move.rectsNow() : null
      kept = shown && showsPlan(shown.sequence, shown.position, move.plan) ? shown : null
      pressed = kept ? node : null
      pointer = event.pointerId
      moveDrag.send({ type: 'press', point, position: kept?.position ?? null })
    }
    const onPointerMove = (event: PointerEvent) => {
      if (other(event)) return
      const point = pointOf(event)
      const state = moveDrag.get().drag.kind
      if (state !== 'idle') {
        if (!kept || stale()) cancel()
        else {
          const drop = dropPosition(kept.rects, kept.position, kept.flow, point)
          const wasDragging = moveDrag.dragging()
          // `buttons`: a release out of the overlay before the drag started
          // (no capture yet) did not come here; the move with no button ends
          // the press.
          const down = (event.buttons & 1) !== 0
          const line = dropLine(kept.rects, kept.position, drop, kept.flow)
          moveDrag.send({ type: 'move', point, drop, down, scale: latest.current.scale }, line)
          if (moveDrag.get().drag.kind === 'idle') {
            kept = null
            pressed = null
            pointer = null
          }
          else if (!wasDragging && moveDrag.dragging()) overlay.setPointerCapture(event.pointerId)
        }
      }
      setCursor(point)
    }
    const onPointerUp = (event: PointerEvent) => {
      if (other(event)) return
      if (moveDrag.get().drag.kind !== 'idle') {
        // The plan can change during a drag (an undo, the file): the frame
        // must still show the kept sequence as the plan (`stale`).
        const live = kept !== null && !stale()
        const { moveTo } = live ? moveDrag.send({ type: 'release' }) : moveDrag.send({ type: 'cancel' })
        if (moveTo !== null && live) latest.current.move.moveTo(moveTo)
        kept = null
        pressed = null
        pointer = null
        setCursor(pointOf(event))
      }
      // A release that no click follows (the pointer is out of the frame)
      // stops no later click. Also after a drag that Escape canceled.
      window.clearTimeout(settle)
      settle = window.setTimeout(() => moveDrag.send({ type: 'settled' }), 0)
    }
    const onPointerCancel = (event: PointerEvent) => {
      if (!other(event)) cancel()
    }
    // The capture can go with no release and no cancel (the browser took the
    // pointer): the drag ends as a cancel. After a release the state is idle
    // already, and this does nothing.
    const onLostCapture = (event: PointerEvent) => {
      if (moveDrag.dragging() && !other(event)) cancel()
    }
    // A press has no capture before the drag starts: a release or a cancel
    // out of the overlay does not come to it, and neither does a release
    // after the window lost the focus. These end the press at once, thus no
    // later move with the button down (a drag of a different control across
    // the overlay) goes on with it. The events of the overlay are its own.
    const onWindowEnd = (event: PointerEvent) => {
      if (event.target instanceof Node && overlay.contains(event.target)) return
      if (moveDrag.get().drag.kind === 'pressed' && !other(event)) cancel()
    }
    const onBlur = () => {
      if (moveDrag.get().drag.kind === 'pressed') cancel()
    }
    const onClick = (event: MouseEvent) => {
      if (!moveDrag.send({ type: 'click' }).stopClick) return
      event.stopPropagation()
      event.preventDefault()
    }
    const onLeave = () => {
      if (!moveDrag.dragging()) delete overlay.dataset.dragCursor
    }

    // A canceled drag (Escape) leaves the cursor of a drag until the pointer
    // moves: put it back at once.
    // A drag that a different part ended (Escape) ends here too.
    const unsubscribe = moveDrag.subscribe(() => {
      if (!moveDrag.dragging() && overlay.dataset.dragCursor === 'grabbing') delete overlay.dataset.dragCursor
      if (moveDrag.get().drag.kind === 'idle' && pointer !== null) {
        release()
        kept = null
        pressed = null
        pointer = null
      }
    })

    overlay.addEventListener('pointerdown', onPointerDown)
    overlay.addEventListener('pointermove', onPointerMove)
    overlay.addEventListener('pointerup', onPointerUp)
    overlay.addEventListener('pointercancel', onPointerCancel)
    overlay.addEventListener('lostpointercapture', onLostCapture)
    overlay.addEventListener('pointerleave', onLeave)
    overlay.addEventListener('click', onClick, true)
    window.addEventListener('pointerup', onWindowEnd, true)
    window.addEventListener('pointercancel', onWindowEnd, true)
    window.addEventListener('blur', onBlur)
    return () => {
      release()
      window.removeEventListener('pointerup', onWindowEnd, true)
      window.removeEventListener('pointercancel', onWindowEnd, true)
      window.removeEventListener('blur', onBlur)
      unsubscribe()
      overlay.removeEventListener('pointerdown', onPointerDown)
      overlay.removeEventListener('pointermove', onPointerMove)
      overlay.removeEventListener('pointerup', onPointerUp)
      overlay.removeEventListener('pointercancel', onPointerCancel)
      overlay.removeEventListener('lostpointercapture', onLostCapture)
      overlay.removeEventListener('pointerleave', onLeave)
      overlay.removeEventListener('click', onClick, true)
      window.clearTimeout(settle)
      delete overlay.dataset.dragCursor
      if (moveDrag.get().drag.kind !== 'idle') moveDrag.send({ type: 'cancel' })
      moveDrag.send({ type: 'settled' })
    }
  }, [overlay])

  const dragging = drag.drag.kind === 'dragging'
  if (!dragging || !drag.line) return null
  // The line ends at the crop of the frame, as the outline of the selection.
  const place = inCrop(canvasRectOf(view, box, drag.line), canvasCropOf(view, box))
  if (!place) return null
  const line = lineBox(place, lineThickness)
  return (
    <div
      className="pointer-events-none absolute bg-[color:var(--link)]"
      data-drop-line=""
      style={{ left: line.x, top: line.y, width: line.width, height: line.height }}
    />
  )
}
