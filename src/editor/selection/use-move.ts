import { useEffect, useMemo, useReducer } from 'react'
import type { Rect } from '../canvas/viewport.ts'
import type { Item } from '../edits/model.ts'
import { edits } from '../edits/store.ts'
import { frameWindowOf, inLiveFrame } from '../frame-window.ts'
import { movePlan, orderEdit } from '../inspector/edit.ts'
import { onPreviewApplied } from '../preview/use-preview.ts'
import { elementOf, siteOf } from '../locate/fiber.ts'
import { flowOf, selectionMove, showsPlan, shownOrder, type Flow, type SelectionMove } from './move.ts'
import { nodesAt, siblingsOf, type Siblings } from './pick.ts'
import type { Selected } from './store.ts'
import { selectionTarget } from './target.ts'

// The move of the selected element among its siblings, for the bar, the keys
// and the drag; null when the element cannot move. The bar calls it one time
// and gives the result to each part.
//
// - `plan`: the plan of the move (`movePlan`, `selectionMove`). It is read
//   when the selection or the edits of the screen change, not at each render:
//   a pan or a zoom renders the bar again and must not read the frame. A
//   change of the layout of the parent from outside the edits (a reload of
//   the frame gives a new node) is not seen until then; that is accepted.
// - `place`: the flow of the siblings (`flowOf`), for the arrows of the
//   bar, and `drag`: `plan.drag`, and the frame shows the plan
//   (`showsPlan`). It is read with the plan, thus the first render of the
//   bar has it, and again after the preview wrote and after a new size of
//   the parent or of the element (a new width of the frame wraps a row), not
//   at each render; null while the node is not in a live frame. The position
//   on the bar and the on state of each arrow come from the plan.
// - `rectsNow()`: the siblings as the frame shows them at the moment of the
//   call (a key, a button, the start of a drag), thus a fast second key reads
//   the flow after the first preview; null when the node is not in a live
//   frame or has no parent.
// - `moveTo(next)`: the move to the position `next` in the code (a step from
//   `plan.position`, `arrowNext`, or a drop of a drag that started only
//   where the frame shows the plan): the `order` edit, which replaces the
//   order edits of the siblings, thus a sibling with an open move goes back;
//   false when nothing went to the store.
//
// `width` is the width of the frame of the screen: this module imports no
// screen list. With no width (the screen is not in the list) there is no
// move, thus no `order` edit gets a width that no frame has.
export type UseMove = {
  plan: SelectionMove
  place: Place | null
  rectsNow: () => Shown | null
  moveTo: (next: number) => boolean
}

// The siblings as the frame shows them at one moment: their rectangles in
// the shown sequence (in the coordinates of the frame document), the indexes
// of the child nodes in that sequence (`shownOrder`), the place of the
// element in it, and the flow.
export type Shown = {
  rects: Rect[]
  sequence: number[]
  position: number
  flow: Flow
}

// The flow of the siblings as the frame shows them, and whether a drag can
// start, for the bar.
export type Place = { flow: Flow; drag: boolean }

export function useMove(selected: Selected, items: readonly Item[], width: number | null): UseMove | null {
  const { node, loc, screenId } = selected
  // The plan, and the layout of the parent (`siblingsOf`) for the flow.
  const read = useMemo(() => {
    if (!inLiveFrame(node)) return null
    const document = node.ownerDocument
    const parent = node.parentElement
    const copies = nodesAt(document, loc).length
    const siblings = siblingsOf(node, loc, copies)
    const plan = selectionMove(
      movePlan(loc, siblings, items, (place) => nodesAt(document, place)[0]?.parentElement === parent),
      items,
    )
    return plan && siblings && { plan, container: siblings.container }
  }, [node, loc, items])

  // The place is read with the plan, and again after each application of a
  // preview (`onPreviewApplied`: the preview of the same change writes after
  // this render) and after a new size of the parent or of the element. `tick`
  // counts these events: it is a dependency of the memo, thus each one reads
  // the frame again.
  const [tick, remeasure] = useReducer((count: number) => count + 1, 0)
  const place = useMemo(() => {
    void tick
    const shown = read ? readShown(node, read.container) : null
    return (
      shown &&
      read && { flow: shown.flow, drag: read.plan.drag && showsPlan(shown.sequence, shown.position, read.plan) }
    )
  }, [read, node, tick])
  // The listeners depend on the node only: a new plan must not take the
  // listener away at the moment when the preview of the same change writes.
  // The listener of the preview is direct, not `usePreviewRemeasure`: that
  // hook waits for an animation frame, which a hidden pane does not run, and
  // the read here forces the layout (`getBoundingClientRect`), thus it needs
  // no wait.
  useEffect(() => {
    const stop = onPreviewApplied(remeasure)
    const parent = node.parentElement
    const view = frameWindowOf(node.ownerDocument)
    const observer = parent && view && inLiveFrame(node) ? new view.ResizeObserver(remeasure) : null
    observer?.observe(parent!)
    observer?.observe(node)
    return () => {
      stop()
      observer?.disconnect()
    }
  }, [node])

  return useMemo(() => {
    if (!read || width === null) return null
    const { plan, container } = read
    const rectsNow = () => readShown(node, container)
    const moveTo = (next: number) => {
      const element = elementOf(node, loc)
      const site = element && siteOf(element)
      if (!site) return false
      const target = selectionTarget({ node, loc }, site)
      const edit = orderEdit(plan.position, next, plan.count, plan.previewed, target, width)
      return edit !== null && edits.apply(screenId, edit, plan.replaced)
    }
    return { plan, place, rectsNow, moveTo }
  }, [read, place, node, loc, screenId, width])
}

// The siblings of `node` as the frame shows them (`Shown`). `container` is
// the layout of the parent, read with the plan (`siblingsOf`).
function readShown(node: Element, container: Siblings['container']): Shown | null {
  const view = frameWindowOf(node.ownerDocument)
  const parent = node.parentElement
  if (!inLiveFrame(node) || !view || !parent) return null
  const children = Array.from(parent.children)
  const sequence = shownOrder(children.map((child) => ({ order: Number.parseFloat(view.getComputedStyle(child).order) })))
  const position = sequence.indexOf(children.indexOf(node))
  if (position === -1) return null
  const rects = sequence.map((index) => {
    const { x, y, width, height } = children[index]!.getBoundingClientRect()
    return { x, y, width, height }
  })
  return { rects, sequence, position, flow: flowOf(rects, position, container) }
}
