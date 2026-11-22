import { WarningCircleIcon, XIcon } from '@phosphor-icons/react'
import { screens } from 'virtual:canvas-screens'
import { optionsOf } from '../../related/groups.ts'
import type { Reply, Target } from '../../requests/format.ts'
import { openPin } from '../comments/bubble-store.ts'
import { lostPin, pinOfComment, screenPin } from '../comments/pins.ts'
import { pinsSourceOf, useFramePins } from '../comments/use-pins.ts'
import { staleKeep } from '../edits/keep.ts'
import { isPlaced, locOf, type Item } from '../edits/model.ts'
import { edits, useScreenEdits } from '../edits/store.ts'
import { replyText, summaryOf } from '../edits/summary.ts'
import { useSelection } from '../selection/store.ts'
import { PanelIconButton } from '../ui'
import { cn } from '../ui/lib/utils.ts'
import { ListHeader } from './ListHeader.tsx'
import { selectPlace } from './select-place.ts'

// The list of the edits of a screen, in the sequence the user made them. Each
// item has the tag name of its element, a summary of the change, the reply of
// the agent when it has one, and a button that discards it. A click on an item
// selects its element when the element is visible in the frame: an element that
// a remove edit hides cannot be selected; its discard button brings it back.
// The items of the selected element are marked. A stale item (the element is no
// longer at its place in the code, and no other element matches it, see
// `anchor`) has a warning and no preview; it cannot be selected, only
// discarded. A request for options shows its note. A comment shows its text; a
// click on it selects its element when the frame shows it and opens the
// bubble of its pin on the canvas (`CommentBubble.tsx`), where its text
// changes. A click that selects an element moves the canvas to it when it is
// not in the view (`onReveal`); a comment on the screen and a lost comment
// move the canvas to the title row of the frame (`onShowTitle`), where their
// bubble opens.
// A comment on the screen has no element: its item has the name "Screen". A
// click on a `keep` item moves the canvas to the frame of its option; a `keep`
// whose option is not an option of the screen in the list (the file is gone)
// has a warning and can only be discarded.

type ChangesProps = {
  screenId: string
  // The current frame document of the screen; null when it has none.
  document: Document | null
  // Shown when the screen has no edits.
  empty: string
  // Moves the canvas to the frame of a screen.
  onShowScreen: (id: string) => void
  // Moves the canvas to the title row of the frame of a screen when it is
  // not in the view: the bubble of a pin of the row opens there.
  onShowTitle: (id: string) => void
  // Moves the canvas to the selected element when it is not in the view: a
  // click on an item selected it.
  onReveal: () => void
}

// The reply of the agent on an item.
function ReplyLine({ reply }: { reply: Reply }) {
  return (
    <span className="text-[11px] text-[color:var(--attention)]" data-change-reply={reply.status}>
      {replyText[reply.status]}: {reply.text}
    </span>
  )
}

// The place of the element of an item for the title, or "Screen" for a
// comment on the screen.
function placeOf(target: Target | null): string {
  return target ? `${target.tag}, line ${target.line}` : 'Screen'
}

type ItemButtonProps = {
  item: Item
  title: string
  clickable: boolean
  onClick: () => void
  // The text of a comment, below the summary.
  comment?: string
  // The warning of an item that is out of date; with none, the warning of a
  // stale item when the item is stale.
  warning?: string
}

// The warning of a stale item, and of a `keep` item whose option is gone.
const staleText = 'Not found in the code. The element changed or is gone; no preview.'
const goneText = 'The option is gone from the list of screens. It can only be discarded.'

// The closed form of an item: the name of its element, the summary of the
// change, the text of a comment, the stale warning and the reply of the agent.

function ItemButton({ item, title, clickable, onClick, comment, warning }: ItemButtonProps) {
  const { edit } = item
  const shown = warning ?? (item.stale ? staleText : undefined)
  return (
    <button
      type="button"
      className={cn(
        'flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-md border-0 bg-transparent px-1.5 py-1 text-left text-xs text-inherit',
        clickable ? 'cursor-pointer hover:bg-[color:var(--muted)]' : 'cursor-default',
      )}
      title={title}
      onClick={onClick}
    >
      <span className="flex w-full min-w-0 items-baseline gap-2">
        <span className="shrink-0 font-medium">{edit.target ? edit.target.tag : 'Screen'}</span>
        <span className="min-w-0 truncate text-[color:var(--muted-foreground)]" data-change-summary="">
          {summaryOf(edit)}
        </span>
      </span>
      {comment !== undefined && (
        <span className="line-clamp-3 w-full break-words whitespace-pre-wrap" data-change-comment="">
          {comment}
        </span>
      )}
      {shown !== undefined && (
        <span className="flex items-start gap-1 text-[11px] text-[color:var(--attention)]" data-change-stale="">
          <WarningCircleIcon className="mt-px size-3.5 shrink-0" aria-hidden />
          {shown}
        </span>
      )}
      {edit.reply && <ReplyLine reply={edit.reply} />}
    </button>
  )
}

type CommentItemProps = {
  item: Item
  text: string
  // Opens the bubble of the pin of the comment.
  onOpen: () => void
}

// A comment: a click opens the bubble of its pin on the canvas, where its
// text changes.
function CommentItem({ item, text, onOpen }: CommentItemProps) {
  const { edit } = item
  const title = `${placeOf(edit.target)}: ${summaryOf(edit)}: ${text}. Click to open its pin.`
  return <ItemButton item={item} title={title} clickable onClick={onOpen} comment={text} />
}

type EditItemProps = {
  screenId: string
  item: Item
  document: Document | null
  onReveal: () => void
}

// An edit with a preview, or a request for options: a click selects its
// element when it is visible. A request for options shows its full note below
// the summary.
function EditItem({ screenId, item, document, onReveal }: EditItemProps) {
  const { edit } = item
  const clickable = isPlaced(edit) && !item.stale
  const select = () => {
    if (document && clickable && selectPlace(screenId, document, locOf(edit.target))) onReveal()
  }
  const note = edit.change.kind === 'options' && edit.change.note !== '' ? edit.change.note : undefined
  const title = `${placeOf(edit.target)}: ${summaryOf(edit)}`
  return <ItemButton item={item} title={title} clickable={clickable} onClick={select} comment={note} />
}

type KeepItemProps = {
  screenId: string
  item: Item
  onShowScreen: (id: string) => void
}

// A request to keep an option: a click shows the frame of the option. With
// an option that is gone, the item has a warning and does nothing.
function KeepItem({ screenId, item, onShowScreen }: KeepItemProps) {
  const { change } = item.edit
  const options = optionsOf(screens, screenId).map((entry) => entry.id)
  const stale = staleKeep(item.edit, options)
  const title = stale ? `${summaryOf(item.edit)}: ${goneText}` : `${summaryOf(item.edit)}: click to show the option`
  return (
    <ItemButton
      item={item}
      title={title}
      clickable={!stale}
      onClick={() => !stale && change.kind === 'keep' && onShowScreen(change.option)}
      warning={stale ? goneText : undefined}
    />
  )
}

export function Changes({ screenId, document, empty, onShowScreen, onShowTitle, onReveal }: ChangesProps) {
  const items = useScreenEdits(screenId)
  const selected = useSelection()
  // The pins of the screen, as the canvas has them: a click on a comment opens
  // the bubble of its pin. Only null or not null counts for the rectangle.
  const screen = screens.find((entry) => entry.id === screenId)
  const pins = useFramePins(screenId, screen ? pinsSourceOf(screen, document) : document, true)
  const selectedLoc = selected?.screenId === screenId ? selected.loc : null

  // A comment on an element that the frame shows selects the element first
  // (a new element closes an open bubble), then the bubble opens. The pins of
  // the title row (the screen, the lost comments) show the title row first.
  const openComment = (item: Item) => {
    const pin = pinOfComment(pins, item)
    if (pin.key === screenPin || pin.key === lostPin) onShowTitle(screenId)
    else if (document && selectPlace(screenId, document, pin.key)) onReveal()
    openPin(screenId, pin)
  }

  return (
    <section className="flex flex-col" data-changes={screenId}>
      <ListHeader title="Changes" name="changes" count={items.length} />
      {items.length === 0 ? (
        <p className="m-0 px-3 pb-3 text-xs text-[color:var(--muted-foreground)]">{empty}</p>
      ) : (
        <ul className="m-0 list-none p-0 pb-2">
          {items.map((item) => {
            const { edit } = item
            const mine = selectedLoc !== null && isPlaced(edit) && locOf(edit.target) === selectedLoc
            return (
              <li
                key={edit.id}
                className={cn('flex items-start gap-1 px-1.5', mine && 'bg-[color:var(--muted)] shadow-[inset_2px_0_0_var(--accent)]')}
                data-change={edit.id}
                data-change-mine={mine ? '' : undefined}
              >
                {edit.change.kind === 'comment' ? (
                  <CommentItem item={item} text={edit.change.text} onOpen={() => openComment(item)} />
                ) : edit.change.kind === 'keep' ? (
                  <KeepItem screenId={screenId} item={item} onShowScreen={onShowScreen} />
                ) : (
                  <EditItem screenId={screenId} item={item} document={document} onReveal={onReveal} />
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
