import { useId, useRef, useState } from 'react'
import { commentLimit } from '../../requests/format.ts'
import { submitKey } from '../focus.ts'
import { useFocusAtEnd } from '../hooks.ts'
import { commentText } from '../inspector/edit.ts'
import { Button, Label, Textarea } from '../ui'
import { cn } from '../ui/lib/utils.ts'

// A text area for a comment for the agent, with a button that sends the text.
// Enter with Ctrl or Cmd sends it too; Enter alone starts a new line. The
// button works only for a text that `commentText` accepts, and `onSubmit`
// gets the trimmed text and says whether it went to the store. The box has
// one of two modes. `change` (a change of a comment): the box has a Cancel
// button (`onCancel`), and Escape cancels too. `new` (a new comment): the
// caller keeps the draft (`onChange`; the bubble keeps it for its place, with
// `initial` as the draft): each new text goes to it, and after the text went
// to the store the box and the draft are empty again; a text that did not go
// out stays. A new `initial` of such a box is a draft that changed outside
// it: the box shows it. Escape is then left to the editor, which closes the
// bubble; the draft stays. With `autoFocus` the text area gets the focus
// when the box opens, with the caret after the text. The text area takes the
// wheel while it can scroll (`data-canvas-scroll`).

type CommentBoxProps = {
  // The text of the button: "Add" for a new comment, "Save" for a change.
  submit: string
  // True when the text went to the store.
  onSubmit: (text: string) => boolean
  initial?: string
  autoFocus?: boolean
  // The text of the label; "Comment for the agent" when there is none.
  label?: string
  className?: string
  // The value of `data-comment-box`, for a check from the console.
  name: string
} & (
  // Each new text of a new comment, for its draft.
  | { mode: 'new'; onChange: (text: string) => void }
  // The end of a change with no new text.
  | { mode: 'change'; onCancel: () => void }
)

export function CommentBox(props: CommentBoxProps) {
  const { submit, onSubmit, initial = '', autoFocus, label = 'Comment for the agent', className, name } = props
  const onChange = props.mode === 'new' ? props.onChange : undefined
  const onCancel = props.mode === 'change' ? props.onCancel : undefined
  const id = useId()
  const [value, setValue] = useState(initial)
  // A draft that changed outside the box shows in it: when the element of the
  // bubble moved to a place with a draft of its own, the store joined the two
  // (`joinDrafts`). The box writes each text to the draft, thus `initial` is
  // its own text at each other render.
  const [draft, setDraft] = useState(initial)
  if (props.mode === 'new' && initial !== draft) {
    setDraft(initial)
    setValue(initial)
  }
  const text = commentText(value)
  const area = useRef<HTMLTextAreaElement>(null)
  useFocusAtEnd(area, autoFocus)

  const send = () => {
    if (text === null || !onSubmit(text) || props.mode === 'change') return
    setValue('')
    onChange?.('')
  }

  return (
    <div className={cn('flex shrink-0 flex-col gap-1.5', className)} data-comment-box={name}>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        ref={area}
        id={id}
        size="sm"
        className="max-h-40 overflow-y-auto"
        data-canvas-scroll=""
        value={value}
        maxLength={commentLimit}
        placeholder="Make this a table"
        onChange={(event) => {
          setValue(event.target.value)
          onChange?.(event.target.value)
        }}
        onKeyDown={(event) => {
          if (submitKey(event)) {
            event.preventDefault()
            send()
          } else if (event.key === 'Escape' && onCancel) {
            // A change puts back its text; a new comment leaves Escape to
            // the editor.
            event.preventDefault()
            event.stopPropagation()
            onCancel()
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
