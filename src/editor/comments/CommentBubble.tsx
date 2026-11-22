import { WarningCircleIcon, XIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { screens } from 'virtual:canvas-screens'
import { config } from '../../../canvas.config.ts'
import type { Edit } from '../../requests/format.ts'
import type { FrameBox } from '../canvas/layout.ts'
import type { View } from '../canvas/viewport.ts'
import { editBlock } from '../edits/keep.ts'
import { sameComment, type Item } from '../edits/model.ts'
import { edits, useScreenEdits } from '../edits/store.ts'
import { replyText } from '../edits/summary.ts'
import { commentEdit } from '../inspector/edit.ts'
import { canvasRectOf } from '../selection/geometry.ts'
import { useSelection } from '../selection/store.ts'
import { selectionTarget } from '../selection/target.ts'
import { Button, PanelSurface } from '../ui'
import { bubble, useBubble } from './bubble-store.ts'
import {
  afterAdd,
  bubbleName,
  bubblePlace,
  bubbleScreen,
  commentsOf,
  draftKey,
  liveTarget,
  newBoxOf,
  type CommentsBubble,
} from './bubble.ts'
import { CommentBox } from './CommentBox.tsx'
import { FloatingHeader } from './FloatingHeader.tsx'
import { elementAnchor, rowAnchor, targetSite, titleAnchor, usePanelPlace } from './floating.ts'
import { OptionsPanel } from './OptionsPanel.tsx'
import { lostPin, screenPin } from './pins.ts'
import { elementPresets, linkPresets, screenPresets } from './presets.ts'
import { pinsSourceOf, useScreenPins } from './use-pins.ts'
import { QuickRequests } from './QuickRequests.tsx'

// The bubble of the comments: one floating panel in the overlay of the canvas,
// above the pins and the selection. It lists the comments of one place (a
// pin, or the place of a new comment; `commentsOf`), each with its text, the
// reply of the agent, a change of the text and a discard, and has a box for a
// new comment there, with the draft of its place (`draftKey`). The comments
// of a pin come from the current list by their ids; when none is left (an
// undo, a discard, a request file that the agent wrote), the bubble closes
// (`bubbleAfter`). A new text or reply of a comment from the file closes its
// open text (`sameComment`), thus Save never writes over it.
//
// The bubble is at the right of its pin, of the place of the pin of the
// element, or of its button in the title row of the frame (`panelPlace`),
// and it stays in the free part of the canvas. It takes the pointer and the
// text can be selected; its list and its text areas take the wheel while they
// can scroll (`data-canvas-scroll`). It uses no popover that renders outside
// the canvas. A new comment has the same target and width as an edit of the
// Design tab (`selectionTarget`, `commentEdit`); while the screen has an open
// `keep`, an element takes no new comment and the bubble says why
// (`newBoxOf`). With the Preview switch on (`shown` false) the bubble is not
// drawn; the switch closes it. A screen that leaves the list closes it.
//
// Above the box of a new comment the bubble has the quick requests
// (`QuickRequests.tsx`, `presets.ts`): comments with a fixed text for the
// element or for the screen. A click adds one through `add`, as the button
// "Add" does, and leaves the draft of the box as it is.
//
// The layer holds the options panel too (`OptionsPanel.tsx`): the store has
// one state for the two, thus only one of them is open.

type CommentBubbleProps = {
  view: View
  frames: readonly FrameBox[]
  // The current document of each frame, by screen id.
  documents: ReadonlyMap<string, Document>
  shown: boolean
}

export function CommentBubble({ view, frames, documents, shown }: CommentBubbleProps) {
  const state = useBubble()
  const screenId = bubbleScreen(state)
  const box = screenId === null ? undefined : frames.find((frame) => frame.screen.id === screenId)
  const gone = screenId !== null && box === undefined
  useEffect(() => {
    if (gone) bubble.send({ type: 'close' })
  }, [gone])
  if (!shown || state.kind === 'closed' || !box) return null
  const key = bubblePlace(state)
  const document = documents.get(box.screen.id) ?? null
  return (
    <div className="pointer-events-none absolute inset-0 overflow-clip" data-bubble-layer="">
      {state.kind === 'options' ? (
        <OptionsPanel
          key={key}
          target={state.target}
          live={liveTarget(state) !== null}
          view={view}
          box={box}
          document={document}
        />
      ) : (
        <OpenBubble key={key} state={state} view={view} box={box} document={document} />
      )}
    </div>
  )
}

type OpenBubbleProps = { state: CommentsBubble; view: View; box: FrameBox; document: Document | null }

function OpenBubble({ state, view, box, document }: OpenBubbleProps) {
  const screenId = box.screen.id
  const items = useScreenEdits(screenId)
  const selected = useSelection()
  const comments = commentsOf(state, items)
  const target = state.target

  // The comments of the pin that are left after a change of the list.
  const left = state.kind === 'pin' ? comments.length : null
  useEffect(() => {
    if (left !== null) bubble.send({ type: 'comments', left })
  }, [left])

  // The pins of the screen, from the measure that the layer of the pins
  // reads: the anchor of a pin of an element.
  const pins = useScreenPins(screenId, pinsSourceOf(box.screen, document), true, (nodeRect) =>
    canvasRectOf(view, box, nodeRect),
  )
  const pin =
    state.kind === 'pin' ? (pins ?? []).find((entry) => entry.ids.some((id) => state.ids.includes(id))) : undefined

  // The element of a new comment and its place in the code; none for a
  // detached bubble, whose element the agent took out of the screen file.
  const { node, site } = targetSite(liveTarget(state), document, selected, items)

  // The anchor on the canvas: the pin of the element, or the place of that
  // pin at the top right corner of the element. Null: the title row.
  const anchor = elementAnchor(pin?.rect ?? null, node, view, box)
  const pinKey =
    state.kind === 'pin' ? (pin?.key ?? (target ? screenPin : lostPin)) : state.target.loc === null ? screenPin : null

  // The anchor in the title row: the pin of the row, the button "Comment on
  // the screen", or the title.
  const panel = usePanelPlace((layer) => {
    const id = CSS.escape(screenId)
    const selectors = [
      ...(pinKey === null ? [] : [`[data-frame-pins="${id}"] [data-pin="${CSS.escape(pinKey)}"]`]),
      `[data-frame-comment="${id}"]`,
      `[data-frame-title="${id}"]`,
    ]
    return anchor ?? rowAnchor(titleAnchor(layer, selectors))
  })

  // The comment whose text is open for a change, as it was when it opened.
  const [editing, setEditing] = useState<Edit | null>(null)

  const lost = target === null
  const name = bubbleName(state, site?.tag ?? null, comments)
  // An open `keep` of the screen: an element takes no new comment.
  const block = editBlock(items)
  const draft = target ? bubble.draft(draftKey(target)) : ''
  const newBox = newBoxOf(target, block, site !== null, draft !== '')

  // Adds a comment on the place of the bubble; true when it went to the
  // store. A comment added in the bubble of a pin joins the comments of the
  // pin (`afterAdd`).
  const add = (text: string): boolean => {
    if (!target) return false
    let edit: Edit
    if (target.loc === null) {
      edit = commentEdit(null, box.screen.width, text)
    } else {
      if (!node || !site) return false
      edit = commentEdit(selectionTarget({ node, loc: target.loc }, site), box.screen.width, text)
    }
    if (!edits.apply(screenId, edit)) return false
    const next = afterAdd(state, edit.id)
    if (next) bubble.send(next)
    return true
  }

  // Adds the draft of an element that is not found as a comment on the
  // screen, and shows the comments on the screen.
  const addOnScreen = (text: string): boolean => {
    const edit = commentEdit(null, box.screen.width, text)
    if (!edits.apply(screenId, edit)) return false
    bubble.send({ type: 'open-new', target: { screenId, loc: null } })
    return true
  }

  // The quick requests of the place, only where it takes a new comment: of
  // the screen, or of the element with the requests that link it to a screen.
  const quick =
    !target || newBox !== 'box'
      ? null
      : target.loc === null
        ? {
            presets: screenPresets(
              box.screen,
              config.widths,
              screens.some((screen) => screen.stateOf === screenId),
            ),
            links: [],
          }
        : site && {
            presets: elementPresets(site.origin, box.screen.optionOf !== undefined),
            links: linkPresets(screens, screenId),
          }

  const title = lost ? 'Comments whose element is not found' : `Comments on ${name}`

  return (
    <PanelSurface
      ref={panel}
      className="pointer-events-auto invisible absolute top-0 left-0 flex max-h-[min(28rem,calc(100%-1rem))] w-72 flex-col rounded-lg shadow-lg select-text"
      data-comment-bubble={state.kind}
      data-bubble-screen={screenId}
    >
      <section className="flex min-h-0 flex-1 flex-col" aria-label={title}>
        <FloatingHeader name={name} title={title} closeLabel="Close the comments" />
        {comments.length > 0 && (
          <ul
            className="m-0 min-h-0 shrink list-none overflow-y-auto border-t border-[color:var(--editor-line)] p-0 py-1"
            data-canvas-scroll=""
            data-bubble-comments=""
          >
            {comments.map((item) => (
              <BubbleComment
                key={item.edit.id}
                screenId={screenId}
                item={item}
                lost={lost}
                open={editing?.id === item.edit.id && sameComment(editing, item.edit)}
                onOpen={() => setEditing(item.edit)}
                onClose={() => setEditing(null)}
              />
            ))}
          </ul>
        )}
        {newBox === 'draft' && (
          <p
            className="m-0 flex items-start gap-1 border-t border-[color:var(--editor-line)] px-3 pt-3 text-xs text-[color:var(--attention)]"
            data-bubble-draft=""
          >
            <WarningCircleIcon className="mt-px size-3.5 shrink-0" aria-hidden />
            The element is not found in the frame: the screen file changed. Your text is kept: add it as a comment on
            the screen, or copy it and select the element again.
          </p>
        )}
        {quick && (
          <QuickRequests
            presets={quick.presets}
            links={quick.links}
            texts={comments.map((item) => (item.edit.change.kind === 'comment' ? item.edit.change.text : ''))}
            onAdd={add}
          />
        )}
        {/* One place for the box of the element and of its kept draft, with no
            key of its own: when the element moves or goes while the user types,
            the box and its focus stay (the panel keeps its key, `bubblePlace`). */}
        {target && (newBox === 'box' || newBox === 'draft') && (
          <CommentBox
            name={newBox === 'draft' ? 'bubble-draft' : 'bubble'}
            submit={newBox === 'draft' ? 'Add on the screen' : 'Add'}
            label={newBox === 'draft' ? 'Your text' : comments.length > 0 ? 'New comment' : 'Comment for the agent'}
            initial={bubble.draft(draftKey(target))}
            mode="new"
            onChange={(text) => bubble.setDraft(draftKey(target), text)}
            autoFocus={state.kind === 'new'}
            className={newBox === 'draft' || quick ? 'p-3' : 'border-t border-[color:var(--editor-line)] p-3'}
            onSubmit={newBox === 'draft' ? addOnScreen : add}
          />
        )}
        {newBox === 'blocked' && (
          <p className="m-0 border-t border-[color:var(--editor-line)] p-3 text-xs text-[color:var(--attention)]" data-bubble-blocked="keep">
            {block}
          </p>
        )}
        {newBox === 'no-site' && (
          <p className="m-0 border-t border-[color:var(--editor-line)] p-3 text-xs text-[color:var(--muted-foreground)]" data-bubble-blocked="no-site">
            The element is not found in the frame, thus it takes no new comment.
          </p>
        )}
      </section>
    </PanelSurface>
  )
}

type BubbleCommentProps = {
  screenId: string
  item: Item
  // The bubble of the lost comments names the element of each comment.
  lost: boolean
  // True while the text is open for a change.
  open: boolean
  onOpen: () => void
  onClose: () => void
}

// One comment of the bubble: its text (a click opens it for a change: Save
// or Ctrl/Cmd+Enter keeps it, Cancel or Escape puts it back), the warning of a
// stale item, the reply of the agent, and a button that discards it.
function BubbleComment({ screenId, item, lost, open, onOpen, onClose }: BubbleCommentProps) {
  const { edit } = item
  const text = edit.change.kind === 'comment' ? edit.change.text : ''
  return (
    <li className="flex items-start gap-1 px-1.5 py-0.5" data-bubble-comment={edit.id}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {lost && edit.target && (
          <span className="px-1.5 pt-1 text-[11px] font-medium text-[color:var(--muted-foreground)]">
            {edit.target.tag}, line {edit.target.line}
          </span>
        )}
        {open ? (
          <CommentBox
            name="bubble-change"
            submit="Save"
            label="Change the comment"
            initial={text}
            autoFocus
            className="px-1.5 py-1"
            onSubmit={(next) => {
              edits.changeComment(screenId, edit.id, next)
              onClose()
              return true
            }}
            mode="change"
            onCancel={onClose}
          />
        ) : (
          <button
            type="button"
            className="cursor-pointer rounded-md border-0 bg-transparent px-1.5 py-1 text-left text-xs break-words whitespace-pre-wrap text-inherit hover:bg-[color:var(--muted)]"
            title="Click to change the text"
            onClick={onOpen}
            data-bubble-text=""
          >
            {text}
          </button>
        )}
        {item.stale && (
          <span className="flex items-start gap-1 px-1.5 text-[11px] text-[color:var(--attention)]" data-bubble-stale="">
            <WarningCircleIcon className="mt-px size-3.5 shrink-0" aria-hidden />
            Not found in the code. The element changed or is gone.
          </span>
        )}
        {edit.reply && (
          <span className="px-1.5 pb-1 text-[11px] text-[color:var(--attention)]" data-bubble-reply={edit.reply.status}>
            {replyText[edit.reply.status]}: {edit.reply.text}
          </span>
        )}
      </div>
      <span className="shrink-0" title="Discard the comment">
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Discard the comment"
          className="mt-0.5"
          onClick={() => edits.discard(screenId, edit.id)}
          data-bubble-discard=""
        >
          <XIcon />
        </Button>
      </span>
    </li>
  )
}
