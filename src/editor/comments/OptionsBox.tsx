import { useId, useRef, useState } from 'react'
import { commentLimit, optionCounts } from '../../requests/format.ts'
import { submitKey } from '../focus.ts'
import { useFocusAtEnd } from '../hooks.ts'
import { optionCount } from '../inspector/edit.ts'
import { Button, Input, Label, Textarea } from '../ui'
import { cn } from '../ui/lib/utils.ts'

// The box that asks the agent for options: a count (from `optionCounts.min` to
// `optionCounts.max`, `optionCounts.initial` at first), a note of what the
// options are about, and the button "Ask for options". The count input takes
// any text; `optionCount` keeps the count in the range, and the input shows
// that count again when it loses the focus. Enter with Ctrl or Cmd in the
// note sends the request too. `onSubmit` says whether the request went to
// the store; only then the note is empty again (the count stays), thus a
// request that did not go out keeps its note. The note takes the wheel while
// it can scroll (`data-canvas-scroll`). With `blocked` (the reason why the
// screen takes no request for options) the button is off, and the box says
// why.

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
  const countId = useId()
  const noteId = useId()
  const [countText, setCountText] = useState(String(optionCounts.initial))
  const [note, setNote] = useState('')
  const area = useRef<HTMLTextAreaElement>(null)

  useFocusAtEnd(area, autoFocus)
  const count = optionCount(countText)
  const tooLong = note.trim().length > commentLimit
  const off = blocked !== null || tooLong

  const send = () => {
    if (off || !onSubmit(count, note)) return
    setCountText(String(count))
    setNote('')
  }

  return (
    <div className={cn('flex shrink-0 flex-col gap-1.5', className)} data-options-box={name}>
      <div className="flex items-center gap-2">
        <Label htmlFor={countId} className="flex-1">
          Options from the agent
        </Label>
        <Input
          id={countId}
          size="sm"
          type="number"
          inputMode="numeric"
          className="w-14"
          min={optionCounts.min}
          max={optionCounts.max}
          step={1}
          value={countText}
          aria-label="Count of options"
          onChange={(event) => setCountText(event.target.value)}
          onBlur={() => setCountText(String(count))}
          data-options-count=""
        />
      </div>
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
            send()
          } else if (event.key === 'Escape' && note !== '') {
            // As in the comment box: Escape leaves the text area and keeps the
            // draft, and does not clear the selection.
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
        data-options-note=""
      />
      {blocked !== null && (
        <p className="m-0 text-xs text-[color:var(--muted-foreground)]" data-options-blocked="">
          {blocked}
        </p>
      )}
      <div className="flex items-center justify-end">
        <Button
          size="xs"
          disabled={off}
          title={blocked ?? `Ask the agent for ${count} options (Ctrl+Enter or Cmd+Enter in the note)`}
          onClick={send}
        >
          Ask for options
        </Button>
      </div>
    </div>
  )
}
