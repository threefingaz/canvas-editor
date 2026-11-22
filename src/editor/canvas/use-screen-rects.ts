import { useLayoutEffect, useSyncExternalStore } from 'react'
import type { Item, PlacedEdit } from '../edits/model.ts'
import { useScreenEdits } from '../edits/store.ts'
import { frameWindowOf } from '../frame-window.ts'
import { hiddenIn } from '../preview/css.ts'
import { onPreviewApplied } from '../preview/use-preview.ts'
import { currentRects, measured, rectsOf, rectsResult, screenRects, targetNodes } from './screen-rects.ts'
import type { Rect } from './viewport.ts'

// The hooks of the shared rectangles of a screen (`screen-rects.ts`).

// Measures the targets of the edits of one screen in its frame document and
// writes them to the store; one part of each frame calls it (`Frame.tsx`).
// With a screen that has no comment on an element and no edit with a
// preview, or while it is off (`enabled` false: the Preview switch is on),
// nothing is observed and the store has no entry.
//
// The rectangles are measured again after each change of the list, after
// each application of the preview, after a new size of a target or of the
// frame (a screen of `100vh` moves its nodes with no new size of a target),
// after a change of the nodes, the attributes or the text of the frame
// document (the screen renders after the load of the frame, a hot update
// renders it again, a sibling gets wider), and after a font or an image
// loads. At most once for each animation frame. A new view does not measure
// again: each mark places the rectangles in its own coordinates, thus a pan
// or a zoom with many frames walks no frame document. The document is walked
// only after a change of the list or of the nodes.
//
// The measure runs before the paint (a layout effect), thus a new list never
// paints the marks of the old one.
export function useMeasureRects(screenId: string, document: Document | null, enabled: boolean) {
  const items = useScreenEdits(screenId)
  const watched = enabled && document !== null && items.some(measured)

  useLayoutEffect(() => {
    const frameWindow = frameWindowOf(document)
    if (!watched || !document || !frameWindow) {
      screenRects.delete(screenId)
      return
    }
    const hidden = hiddenIn(items)
    let nodes = targetNodes(document, items, measured)
    const measure = () => screenRects.set(screenId, { document, items, rects: nodes && rectsOf(nodes, hidden) })

    const resize = new frameWindow.ResizeObserver(() => schedule(false))
    // The nodes of the targets change when the screen renders: observe them
    // again after each change of the nodes.
    const observe = () => {
      resize.disconnect()
      resize.observe(document.documentElement)
      for (const node of nodes?.values() ?? []) resize.observe(node)
    }

    let pending = 0
    let walk = false
    const schedule = (again: boolean) => {
      walk ||= again
      if (pending !== 0) return
      pending = requestAnimationFrame(() => {
        pending = 0
        if (walk) {
          walk = false
          nodes = targetNodes(document, items, measured)
          observe()
        }
        measure()
      })
    }
    const mutations = new frameWindow.MutationObserver((records) => {
      schedule(records.some((record) => record.type === 'childList'))
    })
    mutations.observe(document, { childList: true, subtree: true, attributes: true, characterData: true })
    // A preview can move or hide a node.
    const stopPreview = onPreviewApplied(() => schedule(false))
    // A font or an image that loads later moves the nodes after it.
    const loaded = () => schedule(false)
    document.addEventListener('load', loaded, true)
    document.fonts?.addEventListener('loadingdone', loaded)

    observe()
    measure()
    return () => {
      resize.disconnect()
      mutations.disconnect()
      stopPreview()
      document.removeEventListener('load', loaded, true)
      document.fonts?.removeEventListener('loadingdone', loaded)
      if (pending !== 0) cancelAnimationFrame(pending)
    }
  }, [screenId, watched, document, items])

  // A frame that goes out of the canvas takes its entry with it.
  useLayoutEffect(() => () => screenRects.delete(screenId), [screenId])
}

// The marks that a layer of the canvas derives from the edits of one screen
// and the shared rectangles of its targets (`rectsResult`): the pins of the
// comments (`useScreenPins`) and the marks of the open edits (`EditMarks`).
// `derive` gets the list and `rectOf`, and is called at each render of the
// caller; `place` gives the rectangle of a node of the document in the
// coordinates of the caller. The element of an edit is the first copy of its
// place. `watches` is a function of the module of the caller, thus it is the
// same at each render: with a screen that has no item that it takes, the
// result is `empty`.
//
// `source` is the current document of the frame, or 'error' for a screen
// file that cannot be read: its frame has no document, and `rectOf` gives
// null for each edit. A list whose watched items have no element to measure
// (only comments on the whole screen) gets the same: the measure writes no
// entry for it. The result is null while the marks are not known: no
// document yet, a measure of an older list or document, or a screen that is
// not rendered yet.
export type ScreenRectsOptions<T> = {
  source: Document | 'error' | null
  enabled: boolean
  watches: (item: Item) => boolean
  place: (nodeRect: Rect) => Rect
  derive: (items: readonly Item[], rectOf: (edit: PlacedEdit) => Rect | null) => T
  empty: T
}

export function useScreenRects<T>(
  screenId: string,
  { source, enabled, watches, place, derive, empty }: ScreenRectsOptions<T>,
): T | null {
  const items = useScreenEdits(screenId)
  const get = () => screenRects.get(screenId)
  const entry = useSyncExternalStore(screenRects.subscribe, get, get)
  const document = source === 'error' ? null : source
  return rectsResult(
    { enabled, items, watches, error: source === 'error', measured: currentRects(entry, document, items) },
    place,
    derive,
    empty,
  )
}
