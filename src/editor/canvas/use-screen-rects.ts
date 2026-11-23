import { useLayoutEffect, useSyncExternalStore } from 'react'
import type { Item, PlacedEdit } from '../edits/model.ts'
import { useScreenEdits } from '../edits/store.ts'
import { frameWindowOf } from '../frame-window.ts'
import { screenLinkSelector } from '../issues/collect.ts'
import { hiddenIn } from '../preview/css.ts'
import { onPreviewApplied } from '../preview/use-preview.ts'
import { nodesByLoc, screenRendered } from '../selection/pick.ts'
import { linkRects, linkRectsOf } from './link-rects.ts'
import { partRectOf, partRects, wholeShown } from './part.ts'
import { currentRects, measured, rectsOf, rectsResult, screenRects, targetNodes } from './screen-rects.ts'
import type { Rect } from './viewport.ts'

// The hooks of the shared rectangles of a screen (`screen-rects.ts`).

// Measures the targets of the edits of one screen in its frame document and
// writes them to the store; one part of each frame calls it (`Frame.tsx`).
// With a screen that has no comment on an element and no edit with a
// preview, or while it is off (`enabled` false: the Preview switch is on),
// no target is measured and the store has no entry.
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
//
// The same measure reads the links of the screen for the arrows of the
// canvas (`link-rects.ts`): the rectangle of the first visible link element
// to each screen of `links`, the ids that the screen file links to. A screen
// with links is observed also with no edit and with the Preview switch on,
// because the arrows show then too; the targets of the edits are measured
// only while `enabled`. A screen with no link, no target and no part is not
// observed.
//
// The same measure reads the part of an option (`part.ts`): the union of the
// rectangles of the nodes of `part`, the location of the block, for the crop
// of the frame. It is read with the Preview switch on too, because the crop
// stays then. Before the first render of the screen, and when the block is
// not found in a rendered screen, the store has no entry, and the frame shows
// whole.
export function useMeasureRects(
  screenId: string,
  document: Document | null,
  enabled: boolean,
  links: readonly string[] = noLinks,
  part: string | null = null,
) {
  const items = useScreenEdits(screenId)
  const targets = enabled && items.some(measured)
  const linked = links.length > 0
  const parted = part !== null
  const watched = document !== null && (targets || linked || parted)

  useLayoutEffect(() => {
    const frameWindow = frameWindowOf(document)
    if (!watched || !document || !frameWindow) {
      screenRects.delete(screenId)
      linkRects.delete(screenId)
      if (!parted) partRects.delete(screenId)
      return
    }
    if (!targets) screenRects.delete(screenId)
    if (!linked) linkRects.delete(screenId)
    if (!parted) partRects.delete(screenId)
    const hidden = hiddenIn(items)
    const linkNodes = () => (linked ? Array.from(document.querySelectorAll(screenLinkSelector)) : [])
    // The nodes of the part: each copy of its place; none while the screen is
    // not rendered.
    const partNodes = () => (parted && screenRendered(document) ? (nodesByLoc(document).get(part) ?? []) : [])
    let nodes = targets ? targetNodes(document, items, measured) : null
    let anchors = linkNodes()
    let block = partNodes()
    const measure = () => {
      if (targets) screenRects.set(screenId, { document, items, rects: nodes && rectsOf(nodes, hidden) })
      if (linked) linkRects.set(screenId, linkRectsOf(anchors, links, hidden))
      if (parted) {
        // A frame that loads again keeps the rectangle of its last measure
        // until the screen is rendered, thus its crop does not open and
        // close at each change of the file.
        const rect = partRectOf(block, hidden)
        if (rect) partRects.set(screenId, rect)
        else if (screenRendered(document)) partRects.delete(screenId)
      }
    }

    const resize = new frameWindow.ResizeObserver(() => schedule(false))
    // The nodes of the targets change when the screen renders: observe them
    // again after each change of the nodes.
    const observe = () => {
      resize.disconnect()
      resize.observe(document.documentElement)
      for (const node of nodes?.values() ?? []) resize.observe(node)
      for (const node of anchors) resize.observe(node)
      for (const node of block) resize.observe(node)
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
          nodes = targets ? targetNodes(document, items, measured) : null
          anchors = linkNodes()
          block = partNodes()
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
  }, [screenId, watched, targets, linked, parted, document, items, links, part])

  // A frame that goes out of the canvas takes its entries with it, and the
  // choice of its whole screen: a later screen with the same id (a new option
  // after a `keep`) starts cropped.
  useLayoutEffect(
    () => () => {
      screenRects.delete(screenId)
      linkRects.delete(screenId)
      partRects.delete(screenId)
      wholeShown.delete(screenId)
    },
    [screenId],
  )
}

// The list of a screen with no link: one array, thus the effect of the
// measure does not run again at each render.
const noLinks: readonly string[] = []

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
