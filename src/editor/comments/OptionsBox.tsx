import { CaretDownIcon } from '@phosphor-icons/react'
import { useId, useRef, useState } from 'react'
import { commentLimit, optionCounts } from '../../requests/format.ts'
import { submitKey } from '../focus.ts'
import { useFocusAtEnd } from '../hooks.ts'
import { askLabel } from '../inspector/edit.ts'
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Label, Textarea } from '../ui'
import { cn } from '../ui/lib/utils.ts'

// The box that asks the agent for options: a note of what the options are
// about, and one button in two parts. The main part, "Ask for 3 options",
// sends the request with the usual count (`optionCounts.initial`). The small
// part next to it opens a list with the other counts (`optionCounts.more`);
// an item of the list sends the request at once with its count, and the main
// part does not change. Enter with Ctrl or Cmd in the note sends the usual
// count too. `onSubmit` says whether the request went to the store; only
// then the note is empty again, thus a request that did not go out keeps its
// note. The note takes the wheel while it can scroll (`data-canvas-scroll`).
// With `blocked` (the reason why the screen takes no request for options) the
// two parts are off, and the box says why. The list renders in a portal, as
// the menu of the screen actions does (`data-options-menu`).

type OptionsBoxProps = {
  // True when the request went to the store.
  onSubmit: (count: number, note: string) => boolean
  blocked: string | null
  className?: string
  autoFocus?: boolean
  // The value of `data-options-box`, for a check from the console.
  name: string
}

export function OptionsBox({ onSubmit, blocked, className, autoFocus, name }: OptionsBoxProps) {
  const noteId = useId()
  const [note, setNote] = useState('')
  const area = useRef<HTMLTextAreaElement>(null)

  useFocusAtEnd(area, autoFocus)
  const tooLong = note.trim().length > commentLimit
  const off = blocked !== null || tooLong

  const send = (count: number) => {
    if (off || !onSubmit(count, note)) return
    setNote('')
  }

  return (
    <div className={cn('flex shrink-0 flex-col gap-1.5 outline-none', className)} tabIndex={-1} data-options-box={name}>
      <Label htmlFor={noteId} className="sr-only">
        What the options are about
      </Label>
      <Textarea
        ref={area}
        id={noteId}
        size="sm"
        className="max-h-32 overflow-y-auto"
        data-canvas-scroll=""
        value={note}
        maxLength={commentLimit}
        placeholder="What the options are about (optional)"
        onChange={(event) => setNote(event.target.value)}
        onKeyDown={(event) => {
          if (submitKey(event)) {
            event.preventDefault()
            send(optionCounts.initial)
          } else if (event.key === 'Escape' && note !== '') {
            // Escape leaves the text area and keeps the note, which the panel
            // does not keep when it closes. The focus stays in the panel (the
            // box), thus the keys of the selection do not act behind it, and
            // a second Escape closes it.
            event.preventDefault()
            event.currentTarget.closest<HTMLElement>('[data-options-box]')?.focus()
          }
        }}
        data-options-note=""
      />
      {blocked !== null && (
        <p className="m-0 text-xs text-[color:var(--muted-foreground)]" data-options-blocked="">
          {blocked}
        </p>
      )}
      <div className="flex items-center justify-end gap-px">
        <Button
          size="xs"
          className="rounded-r-none"
          disabled={off}
          title={blocked ?? `${askLabel(optionCounts.initial)} (Ctrl+Enter or Cmd+Enter in the note)`}
          onClick={() => send(optionCounts.initial)}
          data-options-ask={optionCounts.initial}
        >
          {askLabel(optionCounts.initial)}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button size="icon-xs" className="rounded-l-none" />}
            disabled={off}
            title={blocked ?? 'Ask for a different count of options'}
            aria-label="Ask for a different count of options"
            data-options-more=""
          >
            <CaretDownIcon weight="bold" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto" data-options-menu="">
            {optionCounts.more.map((count) => (
              <DropdownMenuItem key={count} onClick={() => send(count)} data-options-ask={count}>
                {askLabel(count)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
