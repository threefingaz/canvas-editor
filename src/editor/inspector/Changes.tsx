import { WarningCircleIcon, XIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import type { Reply } from '../../requests/format.ts'
import { locOf, type Item } from '../edits/model.ts'
import { edits, useScreenEdits } from '../edits/store.ts'
import { summaryOf } from '../edits/summary.ts'
import { useSelection } from '../selection/store.ts'
import { PanelIconButton } from '../ui'
import { cn } from '../ui/lib/utils.ts'
import { CommentBox } from './CommentBox.tsx'
import { ListHeader } from './ListHeader.tsx'
import { selectPlace } from './select-place.ts'

// The list of the edits of a screen, in the sequence the user made them. Each
// item has the tag name of its element, a summary of the change, the reply of
// the agent when it has one, and a button that discards it. A click on an
// item selects its element when the element is visible in the frame: an
// element that a remove edit hides cannot be selected; its discard button
// brings it back. The items of the selected element are marked. A stale item
// (the element is no longer at its place in the code, and no other element
// matches it, see `anchor`) has a warning and no preview; it cannot be
// selected, only discarded. A comment shows its text; a click on it opens the
// text for a change (Save or Ctrl/Cmd+Enter keeps it, Cancel or Escape puts it
// back) and does not select the element. A comment on the screen has no
// element: its item has the name "Screen".

type ChangesProps = {
  screenId: string
  // The current frame document of the screen; null when it has none.
  document: Document | null
  // Shown when the screen has no edits; with no text the list is not shown.
  empty?: string
  className?: string
}

const replyText: Record<Reply['status'], string> = {
  conflict: 'Conflict',
  'needs-library-change': 'Needs a library change',
  unclear: 'Unclear',
}

export function Changes({ screenId, document, empty, className }: ChangesProps) {
  const items = useScreenEdits(screenId)
  const selected = useSelection()
  // The id of the comment whose text is open for a change.
  const [editing, setEditing] = useState<string | null>(null)
  if (items.length === 0 && empty === undefined) return null
  const selectedLoc = selected?.screenId === screenId ? selected.loc : null

  const select = (item: Item) => {
    if (item.edit.change.kind === 'comment') {
      setEditing(item.edit.id)
      return
    }
    const target = item.edit.target
    if (document && target && !item.stale) selectPlace(screenId, document, locOf(target))
  }

  return (
    <section
      className={cn('flex min-h-0 flex-col border-t border-[color:var(--border)]', className)}
      data-changes={screenId}
    >
      <ListHeader title="Changes" name="changes" count={items.length} />
      {items.length === 0 ? (
        <p className="m-0 px-3 pb-3 text-xs text-[color:var(--muted-foreground)]">{empty}</p>
      ) : (
        <ul className="m-0 min-h-0 list-none overflow-y-auto p-0 pb-2">
          {items.map((item) => {
            const { edit } = item
            const { target } = edit
            const summary = summaryOf(edit)
            const mine = selectedLoc !== null && target !== null && locOf(target) === selectedLoc
            const name = target ? target.tag : 'Screen'
            const place = target ? `${target.tag}, line ${target.line}` : 'Screen'
            const comment = edit.change.kind === 'comment' ? edit.change.text : null
            const full = comment !== null ? `Comment: ${comment}` : summary
            const clickable = comment !== null || (target !== null && !item.stale)
            return (
              <li
                key={edit.id}
                className={cn('flex items-start gap-1 px-1.5', mine && 'bg-[color:var(--muted)] shadow-[inset_2px_0_0_var(--accent)]')}
                data-change={edit.id}
              >
                {comment !== null && editing === edit.id ? (
                  <CommentBox
                    name="change"
                    submit="Save"
                    initial={comment}
                    autoFocus
                    className="min-w-0 flex-1 px-1.5 py-1"
                    onSubmit={(text) => {
                      edits.changeComment(screenId, edit.id, text)
                      setEditing(null)
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <button
                    type="button"
                    className={cn(
                      'flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-md border-0 bg-transparent px-1.5 py-1 text-left text-xs text-inherit',
                      clickable ? 'cursor-pointer hover:bg-[color:var(--muted)]' : 'cursor-default',
                    )}
                    title={comment !== null ? `${place}: ${full}. Click to change the text.` : `${place}: ${full}`}
                    onClick={() => select(item)}
                  >
                    <span className="flex w-full min-w-0 items-baseline gap-2">
                      <span className="shrink-0 font-medium">{name}</span>
                      <span className="min-w-0 truncate text-[color:var(--muted-foreground)]" data-change-summary="">
                        {comment !== null ? 'Comment' : summary}
                      </span>
                    </span>
                    {comment !== null && (
                      <span className="line-clamp-3 w-full break-words whitespace-pre-wrap" data-change-comment="">
                        {comment}
                      </span>
                    )}
                    {item.stale && (
                      <span
                        className="flex items-start gap-1 text-[11px] text-[color:var(--attention)]"
                        data-change-stale=""
                      >
                        <WarningCircleIcon className="mt-px size-3.5 shrink-0" aria-hidden />
                        Not found in the code. The element changed or is gone; no preview.
                      </span>
                    )}
                    {edit.reply && (
                      <span className="text-[11px] text-[color:var(--attention)]" data-change-reply={edit.reply.status}>
                        {replyText[edit.reply.status]}: {edit.reply.text}
                      </span>
                    )}
                  </button>
                )}
                <span className="shrink-0" data-change-discard="">
                  <PanelIconButton label="Discard the change" onClick={() => edits.discard(screenId, edit.id)}>
                    <XIcon />
                  </PanelIconButton>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
