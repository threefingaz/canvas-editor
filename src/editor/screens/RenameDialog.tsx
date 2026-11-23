import { useId, useState, type FormEvent } from 'react'
import type { ScreenAction } from '../../requests/api.ts'
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label } from '../ui'
import { flowsOf, renamePreview, titleProblem, type ActionScreen, type RenamePreview } from './screen-actions.ts'

// The dialog of "Rename…", "Move to flow…" and "Change the title…": one text
// field, what the action changes, and why it cannot run. A rename and a move
// to a flow show the new id of the screen and of each state and option that
// goes with it, and refuse an id that exists (`renamePreview`); the server
// checks it again. `run` does the action and gives the refusals of the
// server, or an empty list when it ran: the dialog then closes.

export type RenameMode = 'rename' | 'flow' | 'title'

type RenameDialogProps = {
  mode: RenameMode
  screen: ActionScreen
  list: readonly ActionScreen[]
  run: (action: ScreenAction) => Promise<string[]>
  onClose: () => void
}

const heads: Record<RenameMode, { title: string; label: string; submit: string }> = {
  rename: { title: 'Rename the screen', label: 'File name', submit: 'Rename' },
  flow: { title: 'Move the screen to a flow', label: 'Flow', submit: 'Move' },
  title: { title: 'Change the title', label: 'Title', submit: 'Change' },
}

function initialValue(mode: RenameMode, screen: ActionScreen): string {
  if (mode === 'rename') return screen.name
  if (mode === 'flow') return screen.flow
  return screen.title
}

export function RenameDialog({ mode, screen, list, run, onClose }: RenameDialogProps) {
  const [value, setValue] = useState(() => initialValue(mode, screen))
  const [busy, setBusy] = useState(false)
  const [refusals, setRefusals] = useState<string[]>([])
  const fieldId = useId()
  const flowsId = useId()
  const head = heads[mode]

  const to = mode === 'flow' ? { flow: value.trim(), name: screen.name } : { flow: screen.flow, name: value.trim() }
  const preview = mode === 'title' ? null : renamePreview(list, screen.id, to)
  const problem = preview ? preview.problem : titleProblem(value, screen.title)
  const action: ScreenAction =
    mode === 'title' ? { action: 'title', screen: screen.id, title: value } : { action: 'rename', screen: screen.id, ...to }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (problem !== null || busy) return
    setBusy(true)
    const reasons = await run(action)
    setBusy(false)
    if (reasons.length === 0) onClose()
    else setRefusals(reasons)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent data-screen-dialog={mode}>
        <form className="grid gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{head.title}</DialogTitle>
            <DialogDescription>
              {screen.title} · {screen.id}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={fieldId}>{head.label}</Label>
            <Input
              id={fieldId}
              value={value}
              autoFocus
              list={mode === 'flow' ? flowsId : undefined}
              spellCheck={false}
              // The text is selected when the dialog opens: a new name
              // replaces it at once.
              onFocus={(event) => event.currentTarget.select()}
              aria-invalid={problem !== null && value !== initialValue(mode, screen) ? true : undefined}
              onChange={(event) => {
                setValue(event.target.value)
                setRefusals([])
              }}
              data-screen-dialog-field=""
            />
            {mode === 'flow' && (
              <datalist id={flowsId}>
                {flowsOf(list).map((flow) => (
                  <option key={flow} value={flow} />
                ))}
              </datalist>
            )}
          </div>
          {preview && <IdChanges preview={preview} />}
          {problem !== null && value !== initialValue(mode, screen) && (
            <p className="m-0 text-xs text-[color:var(--destructive)]" role="alert" data-screen-dialog-problem="">
              {problem}
            </p>
          )}
          {refusals.length > 0 && <Refusals reasons={refusals} />}
          {mode !== 'title' && (
            <p className="m-0 text-xs text-[color:var(--muted-foreground)]">
              Each link to it in the other screens, its request and issues files, and the flow files change with it. A
              link that the code computes does not change: it then shows as a broken link.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={problem !== null || busy} data-screen-dialog-submit="">
              {head.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// The new id of the screen, and of each state and option that goes with it.
function IdChanges({ preview }: { preview: RenamePreview }) {
  if (preview.problem !== null && preview.changes.length === 0) return null
  return (
    <div className="grid gap-1 text-xs" data-screen-dialog-ids="">
      <span className="text-[color:var(--muted-foreground)]">The new id</span>
      <ul className="m-0 grid list-none gap-0.5 p-0 font-mono">
        {preview.changes.map((change) => (
          <li key={change.from} className="truncate" title={`${change.from} → ${change.to}`}>
            {change.to}
          </li>
        ))}
      </ul>
    </div>
  )
}

// The refusals of the server: nothing changed.
export function Refusals({ reasons }: { reasons: readonly string[] }) {
  return (
    <div className="grid gap-1 text-xs text-[color:var(--destructive)]" role="alert" data-screen-dialog-refusals="">
      <span>Nothing changed:</span>
      <ul className="m-0 grid list-disc gap-0.5 pl-4">
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
  )
}
