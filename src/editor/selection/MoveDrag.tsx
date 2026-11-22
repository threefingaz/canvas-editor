import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import type { Point, View } from '../canvas/viewport.ts'
import { inLiveFrame } from '../frame-window.ts'
import { moveDrag } from './drag-store.ts'
import { canvasRectOf, toFramePoint } from './geometry.ts'
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
// frame (the agent wrote the file) cancels the drag; Escape cancels it too
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
  // The top left corner of the frame of the selection in world coordinates.
  box: Point
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
    const cancel = () => {
      kept = null
      moveDrag.send({ type: 'cancel' })
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const point = pointOf(event)
      const { move, canDrag } = latest.current
      // The frame must show the plan at the press (`showsPlan`): a drop is
      // then a position in the code after the own move of the element.
      const shown = canDrag && onElement(point) ? move.rectsNow() : null
      kept = shown && showsPlan(shown.sequence, shown.position, move.plan) ? shown : null
      moveDrag.send({ type: 'press', point, position: kept?.position ?? null })
    }
    const onPointerMove = (event: PointerEvent) => {
      const point = pointOf(event)
      const state = moveDrag.get().drag.kind
      if (state !== 'idle') {
        if (!kept || !inLiveFrame(latest.current.node)) cancel()
        else {
          const drop = dropPosition(kept.rects, kept.position, kept.flow, point)
          const wasDragging = moveDrag.dragging()
          // `buttons`: a release out of the overlay before the drag started
          // (no capture yet) did not come here; the move with no button ends
          // the press.
          const down = (event.buttons & 1) !== 0
          const line = dropLine(kept.rects, kept.position, drop, kept.flow)
          moveDrag.send({ type: 'move', point, drop, down, scale: latest.current.scale }, line)
          if (moveDrag.get().drag.kind === 'idle') kept = null
          else if (!wasDragging && moveDrag.dragging()) overlay.setPointerCapture(event.pointerId)
        }
      }
      setCursor(point)
    }
    const onPointerUp = (event: PointerEvent) => {
      if (moveDrag.get().drag.kind !== 'idle') {
        const live = inLiveFrame(latest.current.node)
        const { moveTo } = live ? moveDrag.send({ type: 'release' }) : moveDrag.send({ type: 'cancel' })
        if (moveTo !== null && kept) latest.current.move.moveTo(moveTo)
        kept = null
        setCursor(pointOf(event))
      }
      // A release that no click follows (the pointer is out of the frame)
      // stops no later click. Also after a drag that Escape canceled.
      window.clearTimeout(settle)
      settle = window.setTimeout(() => moveDrag.send({ type: 'settled' }), 0)
    }
    const onPointerCancel = () => cancel()
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
    const unsubscribe = moveDrag.subscribe(() => {
      if (!moveDrag.dragging() && overlay.dataset.dragCursor === 'grabbing') delete overlay.dataset.dragCursor
    })

    overlay.addEventListener('pointerdown', onPointerDown)
    overlay.addEventListener('pointermove', onPointerMove)
    overlay.addEventListener('pointerup', onPointerUp)
    overlay.addEventListener('pointercancel', onPointerCancel)
    overlay.addEventListener('pointerleave', onLeave)
    overlay.addEventListener('click', onClick, true)
    return () => {
      unsubscribe()
      overlay.removeEventListener('pointerdown', onPointerDown)
      overlay.removeEventListener('pointermove', onPointerMove)
      overlay.removeEventListener('pointerup', onPointerUp)
      overlay.removeEventListener('pointercancel', onPointerCancel)
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
  const line = lineBox(canvasRectOf(view, box, drag.line), lineThickness)
  return (
    <div
      className="pointer-events-none absolute bg-[color:var(--link)]"
      data-drop-line=""
      style={{ left: line.x, top: line.y, width: line.width, height: line.height }}
    />
  )
}
