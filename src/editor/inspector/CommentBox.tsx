import { useEffect, useId, useRef, useState } from 'react'
import { commentLimit } from '../../requests/format.ts'
import { submitKey } from '../focus.ts'
import { Button, Label, Textarea } from '../ui'
import { cn } from '../ui/lib/utils.ts'
import { commentText } from './edit.ts'

// A text area for a comment for the agent, with a button that sends the text.
// Enter with Ctrl or Cmd sends it too; Enter alone starts a new line. The
// button works only for a text that `commentText` accepts, and `onSubmit`
// gets the trimmed text. With no `initial` text (a new comment) the box is
// empty again after the text went out. With `onCancel` (a change of a
// comment) the box has a Cancel button, and Escape cancels too. With no
// `onCancel`, Escape in a box with a draft leaves the text area and keeps the
// draft; in an empty box it clears the selection, as elsewhere. With
// `autoFocus` the text area gets the focus when the box opens, with the caret
// after the text.

type CommentBoxProps = {
  // The text of the button: "Add" for a new comment, "Save" for a change.
  submit: string
  onSubmit: (text: string) => void
  initial?: string
  onCancel?: () => void
  autoFocus?: boolean
  className?: string
  // The value of `data-comment-box`, for a check from the console.
  name: string
}

export function CommentBox({ submit, onSubmit, initial = '', onCancel, autoFocus, className, name }: CommentBoxProps) {
  const id = useId()
  const [value, setValue] = useState(initial)
  const text = commentText(value)
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const node = area.current
    if (!autoFocus || !node) return
    node.focus()
    node.setSelectionRange(node.value.length, node.value.length)
  }, [autoFocus])

  const send = () => {
    if (text === null) return
    onSubmit(text)
    if (!onCancel) setValue('')
  }

  return (
    <div className={cn('flex shrink-0 flex-col gap-1.5', className)} data-comment-box={name}>
      <Label htmlFor={id}>Comment for the agent</Label>
      <Textarea
        ref={area}
        id={id}
        size="sm"
        className="max-h-40 overflow-y-auto"
        value={value}
        maxLength={commentLimit}
        placeholder="Make this a table"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (submitKey(event)) {
            event.preventDefault()
            send()
          } else if (event.key === 'Escape' && onCancel) {
            event.preventDefault()
            event.stopPropagation()
            onCancel()
          } else if (event.key === 'Escape' && value !== '') {
            // A new comment with a draft: Escape leaves the text area and keeps
            // the draft; it does not clear the selection, which would close
            // the box and lose the text.
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
      />
      <div className="flex items-center justify-end gap-1">
        {onCancel && (
          <Button size="xs" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button size="xs" disabled={text === null} title={`${submit} (Ctrl+Enter or Cmd+Enter)`} onClick={send}>
          {submit}
        </Button>
      </div>
    </div>
  )
}
