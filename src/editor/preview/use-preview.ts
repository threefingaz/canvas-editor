import { useEffect } from 'react'
import { labelOf } from '../../requests/format.ts'
import { anchorScreen, type Reading, type ScreenElement } from '../edits/anchor.ts'
import { edits, useScreenEdits } from '../edits/store.ts'
import { frameWindowOf } from '../frame-window.ts'
import { screenRendered, sitesIn } from '../selection/pick.ts'
import { useTokenFile } from '../tokens/editor-tokens.ts'
import { frameTokens } from '../tokens/frame-tokens.ts'
import { applyPreview, codeText, previewAttribute } from './apply.ts'
import { editAttribute } from './css.ts'

// Keeps the preview of the edits of a screen in its frame document: it applies
// the preview when the edits change and when the frame has a new document, and
// again after each change of the document (React renders again and can drop an
// attribute or a text, or put in new nodes).
//
// Before it applies the preview, it checks that each edit is still on its
// element (`anchor`): an agent can change the screen file, and the lines of
// the remaining edits can then be wrong. The elements of a frame document are
// read when the screen is rendered, before the first preview, and the result
// is kept until the document changes from a different source than the
// preview (a state update, a lazy part, a hot update): then they are read
// again. The check runs again at each change of the edits, thus a request
// file that changes after the frame reloaded is checked too. The last reading
// of each screen is kept: the elements of the document before, and the
// document whose places each target is in (`anchor`).
//
// Comments have no preview. The check gets the whole list (a comment on an
// element moves and goes stale with its element; a comment on the screen is
// left out there), and each part of the preview reads the list through
// `liveItems`, which leaves out each comment.

const listeners = new Set<() => void>()

// Calls `listener` after each application of a preview that wrote something:
// a preview can move a node and not change its size, thus a rectangle on the
// canvas must be measured again.
export function onPreviewApplied(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Calls `remeasure` in the next animation frame after an application of a
// preview, after the frame has its new layout; one call for the applications
// of one animation frame. Only while `enabled`. `remeasure` must keep its
// identity (a dispatch of `useReducer`).
export function usePreviewRemeasure(remeasure: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    let pending = 0
    const stop = onPreviewApplied(() => {
      if (pending !== 0) return
      pending = requestAnimationFrame(() => {
        pending = 0
        remeasure()
      })
    })
    return () => {
      stop()
      if (pending !== 0) cancelAnimationFrame(pending)
    }
  }, [remeasure, enabled])
}

// The screen elements of each frame document, read when the screen is
// rendered and again after a change of the document. The selection reads
// them too, to follow its element to a new place (`followPlace`).
const elementsByDocument = new WeakMap<Document, ScreenElement[]>()

export function screenElementsOf(document: Document): ScreenElement[] {
  let elements = elementsByDocument.get(document)
  if (!elements) {
    elements = sitesIn(document).map(({ node, site }) => ({
      file: site.file,
      line: site.line,
      column: site.column,
      tag: site.tag,
      label: labelOf(codeText(node)),
    }))
    elementsByDocument.set(document, elements)
  }
  return elements
}

// The last reading of each screen (see `Reading`).
const readings = new Map<string, Reading<Document>>()

export function usePreview(screenId: string, document: Document | null) {
  const items = useScreenEdits(screenId)
  // New tokens can give a token edit a new value: the preview is applied again.
  const tokenFile = useTokenFile()

  useEffect(() => {
    const frameWindow = frameWindowOf(document)
    if (!document || !frameWindow) return
    const tokens = frameTokens(tokenFile.tokens ?? [], document)
    let warned = false

    const apply = () => {
      // The screen loads after the `load` event of the frame: a new document
      // is empty for a short time. The observer calls again when it renders.
      if (!screenRendered(document)) return
      const elements = screenElementsOf(document)
      const checked = anchorScreen(edits, screenId, items, readings.get(screenId), document, elements)
      if (checked.reading) readings.set(screenId, checked.reading)
      // The check changed the edits: the effect runs again with the new list.
      if (!checked.ready) return
      const result = applyPreview(document, items, tokens)
      // The records of the writes of the preview are dropped: they do not
      // start a new application. A second application would write nothing.
      observer.takeRecords()
      if (result.changed) for (const listener of listeners) listener()
      if (!warned) {
        warned = true
        for (const problem of result.problems) console.warn(`No preview for ${problem}`)
      }
    }

    // A change that the preview did not write (its records are taken below)
    // can add elements or change a text: the elements are read again.
    const observer = new frameWindow.MutationObserver(() => {
      elementsByDocument.delete(document)
      apply()
    })
    observer.observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['style', editAttribute, previewAttribute],
    })

    apply()
    return () => observer.disconnect()
  }, [screenId, document, items, tokenFile])
}
