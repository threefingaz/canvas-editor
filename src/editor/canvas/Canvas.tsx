import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { CanvasDotPattern } from '../ui'
import { canScroll, pan, wheelDelta, wheelZoomFactor, zoomAt, type Size, type View } from './viewport.ts'

// The canvas fills its parent. The world layer has the content (the frames)
// and moves with a CSS transform. The wheel moves the canvas; Ctrl or Cmd with
// the wheel, or a trackpad pinch, changes the zoom at the pointer; Space and
// drag, or a drag with the middle button, moves the canvas; Space in a field
// that takes text, and on a control that has the focus from the keyboard (a
// button, a link), is left to it.
// A wheel with no Ctrl or Cmd inside an element with `data-canvas-scroll`
// (the list and the text areas of the comment bubble, the note of the options
// panel) scrolls that element while it can scroll in that direction.

type CanvasProps = {
  view: View
  onViewChange: (update: (view: View) => View) => void
  onResize?: (size: Size) => void
  // Content in world coordinates.
  children?: ReactNode
  // Content above the canvas that does not move, for example the toolbar.
  overlay?: ReactNode
}

type Drag = { pointerId: number; x: number; y: number }

export function Canvas({ view, onViewChange, onResize, children, overlay }: CanvasProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  const [spaceDown, setSpaceDown] = useState(false)
  const [dragging, setDragging] = useState(false)
  // The last pointer position of a drag. A ref, because more than one move
  // can come before the next render.
  const drag = useRef<Drag | null>(null)

  // The listeners are attached once; they call the latest callbacks.
  const callbacks = useRef({ onViewChange, onResize })
  useLayoutEffect(() => {
    callbacks.current = { onViewChange, onResize }
  })

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const observer = new ResizeObserver(() => {
      const next = { width: root.clientWidth, height: root.clientHeight }
      setSize(next)
      callbacks.current.onResize?.(next)
    })
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  // React attaches wheel listeners as passive, and a passive listener cannot
  // stop the zoom of the page. Thus a native listener.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onWheel = (event: WheelEvent) => {
      const zoom = event.ctrlKey || event.metaKey
      if (!zoom && scrollsInside(event.target, root, event.deltaX, event.deltaY)) return
      event.preventDefault()
      const dx = wheelDelta(event.deltaX, event.deltaMode, root.clientWidth)
      const dy = wheelDelta(event.deltaY, event.deltaMode, root.clientHeight)
      if (zoom) {
        const rect = root.getBoundingClientRect()
        const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        callbacks.current.onViewChange((current) => zoomAt(current, wheelZoomFactor(dy), point))
      } else {
        callbacks.current.onViewChange((current) => pan(current, -dx, -dy))
      }
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    return () => root.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Space with a modifier is a shortcut of the system or of a control.
      if (event.code !== 'Space' || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      // A dialog of the screen actions is modal: its Space is its own.
      if (takesSpace(event.target) || document.querySelector('[data-screen-dialog]') !== null) return
      event.preventDefault()
      setSpaceDown(true)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpaceDown(false)
    }
    const onBlur = () => setSpaceDown(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const middle = event.button === 1
    // A second pointer during a pan changes nothing: the pan keeps its anchor.
    if (drag.current !== null || (!middle && !(spaceDown && event.button === 0))) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    setDragging(true)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const last = drag.current
    if (!last || event.pointerId !== last.pointerId) return
    const dx = event.clientX - last.x
    const dy = event.clientY - last.y
    drag.current = { ...last, x: event.clientX, y: event.clientY }
    onViewChange((current) => pan(current, dx, dy))
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    setDragging(false)
  }

  const cursor = dragging ? 'cursor-grabbing' : spaceDown ? 'cursor-grab' : ''

  // `overflow: clip`, not `hidden`: a box with `hidden` is still a scroll
  // container, and a focus on a button outside the view (the title row of a
  // frame, reached with Tab) scrolls it. The view then moves with no change
  // of `view`. The layers in `overlay` clip in the same way.
  return (
    <div
      ref={rootRef}
      className={`relative size-full touch-none overflow-clip bg-[color:var(--background)] select-none ${cursor}`}
      data-canvas=""
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      {/* The pattern is anchored to the middle of the canvas, thus the offset of the world origin from there. */}
      <CanvasDotPattern
        offset={{ x: view.x - size.width / 2, y: view.y - size.height / 2 }}
        scale={view.scale}
      />
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      >
        {children}
      </div>
      {/* While the canvas moves, a layer above the content keeps the pointer from the content. */}
      {(spaceDown || dragging) && <div className="absolute inset-0" />}
      {overlay}
    </div>
  )
}

// True when an element with `data-canvas-scroll` between the target of a
// wheel event and the root of the canvas can scroll in its direction.
function scrollsInside(target: EventTarget | null, root: Element, dx: number, dy: number): boolean {
  let box = target instanceof Element ? target.closest('[data-canvas-scroll]') : null
  while (box && root.contains(box) && box !== root) {
    if (canScroll(box, dx, dy)) return true
    box = box.parentElement?.closest('[data-canvas-scroll]') ?? null
  }
  return false
}

// The controls that Space presses.
const spaceControls =
  'button, a[href], summary, [role="button"], [role="checkbox"], [role="switch"], [role="tab"], [role="radio"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="combobox"], [role="slider"]'

// True for a target that uses Space itself: a field that takes text, and a
// control that Space presses when it has the focus from the keyboard (it
// shows its focus ring, `:focus-visible`). A control that has the focus from
// a click (a button of the toolbar) leaves Space to the canvas, thus Space
// and drag still move it.
function takesSpace(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target.closest('input, textarea, select') !== null) return true
  return target.matches(':focus-visible') && target.closest(spaceControls) !== null
}
