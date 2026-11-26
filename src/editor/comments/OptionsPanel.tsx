import { useEffect, useReducer } from 'react'
import type { Target } from '../../requests/format.ts'
import type { FrameBox } from '../canvas/layout.ts'
import type { View } from '../canvas/viewport.ts'
import { editBlock, optionsBlock } from '../edits/keep.ts'
import { edits, useScreenEdits } from '../edits/store.ts'
import { optionsEdit } from '../inspector/edit.ts'
import { onPreviewApplied } from '../preview/use-preview.ts'
import { useSelection } from '../selection/store.ts'
import { selectionTarget } from '../selection/target.ts'
import { PanelSurface } from '../ui'
import { bubble } from './bubble-store.ts'
import type { BubbleTarget } from './bubble.ts'
import { FloatingHeader } from './FloatingHeader.tsx'
import { elementAnchor, rowAnchor, targetSite, titleAnchor, usePanelPlace } from './floating.ts'
import { OptionsBox } from './OptionsBox.tsx'

// The options panel: one floating panel in the layer of the bubble
// (`CommentBubble.tsx`), with the options box, which asks the agent for
// options of an element (the button of the bar) or of the whole screen (the
// button "Ask for options" in the title row of the frame, or in the Changes
// tab). It is at the right of the top right corner of its element, or of its
// button in the title row (`panelPlace`), and it stays in the free part of
// the canvas. The item has the same target and width as an edit of the
// Design tab of the inspector (`selectionTarget`, `optionsEdit`). An option
// has no options, and while the screen has an open `keep` the box is off and
// says why (`optionsBlock`). The panel closes when the item went to the
// store; the title row then shows the mark of the open request.

// `live`: false for a detached panel (`liveTarget`), whose element the agent
// took out of the screen file: it looks for no element at the old place.
type OptionsPanelProps = { target: BubbleTarget; live: boolean; view: View; box: FrameBox; document: Document | null }

export function OptionsPanel({ target, live, view, box, document }: OptionsPanelProps) {
  const screenId = box.screen.id
  const items = useScreenEdits(screenId)
  const selected = useSelection()

  // The element of the options and its place in the code.
  const { node, site } = targetSite(live ? target : null, document, selected, items)

  // A preview can move the element (an edit of the inspector while the panel
  // is open): the anchor is read again after it.
  const [, remeasure] = useReducer((count: number) => count + 1, 0)
  useEffect(() => onPreviewApplied(remeasure), [])

  // The anchor on the canvas: the top right corner of the element. Null: the
  // button in the title row, or the title.
  const anchor = elementAnchor(null, node, view, box)
  const panel = usePanelPlace((layer) => {
    const id = CSS.escape(screenId)
    return anchor ?? rowAnchor(titleAnchor(layer, [`[data-frame-ask-options="${id}"]`, `[data-frame-title="${id}"]`]))
  })

  const blocked = optionsBlock({
    option: box.screen.optionOf !== undefined,
    element: target.loc === null || site !== null,
    block: editBlock(items),
  })
  const name = target.loc === null ? 'the screen' : (site?.tag ?? 'the element')
  const title = `Options of ${name}`

  // True when the request went to the store.
  const ask = (count: number, note: string): boolean => {
    let placed: Target | null = null
    if (target.loc !== null) {
      if (!node || !site) return false
      placed = selectionTarget({ node, loc: target.loc }, site)
    }
    const edit = optionsEdit(placed, box.screen.width, count, note)
    if (!edit) return false
    if (!edits.apply(screenId, edit)) return false
    bubble.send({ type: 'close' })
    return true
  }

  return (
    <PanelSurface
      ref={panel}
      className="pointer-events-auto invisible absolute top-0 left-0 flex w-72 flex-col rounded-lg shadow-lg select-text"
      data-options-panel={target.loc === null ? 'screen' : 'element'}
      data-bubble-screen={screenId}
    >
      <section className="flex flex-col" aria-label={title}>
        <FloatingHeader name={title} title={title} closeLabel="Close the options panel" />
        <OptionsBox
          name={target.loc === null ? 'screen-panel' : 'element-panel'}
          blocked={blocked}
          autoFocus={blocked === null}
          className="border-t border-[color:var(--editor-line)] p-3"
          onSubmit={ask}
        />
      </section>
    </PanelSurface>
  )
}
