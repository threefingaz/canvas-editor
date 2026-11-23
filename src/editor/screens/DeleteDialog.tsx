import { useState } from 'react'
import type { ScreenAction } from '../../requests/api.ts'
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui'
import { Refusals } from './RenameDialog.tsx'
import { deleteSummary, type ActionScreen } from './screen-actions.ts'

// The dialog of "Delete…": what goes into the trash with the screen (its
// states, and the options of the screen and of its states, each with its open
// changes), and the screens that link to one of them. Their links stay in the
// code and show as broken links; the agent decides what each control does
// now. "Restore" in the Project tab puts the files back.

type DeleteDialogProps = {
  screen: ActionScreen
  list: readonly ActionScreen[]
  run: (action: ScreenAction) => Promise<string[]>
  onClose: () => void
}

export function DeleteDialog({ screen, list, run, onClose }: DeleteDialogProps) {
  const [busy, setBusy] = useState(false)
  const [refusals, setRefusals] = useState<string[]>([])
  const { members, linkedBy } = deleteSummary(list, screen.id)

  const remove = async () => {
    if (busy) return
    setBusy(true)
    const reasons = await run({ action: 'delete', screen: screen.id })
    setBusy(false)
    if (reasons.length === 0) onClose()
    else setRefusals(reasons)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent data-screen-dialog="delete">
        <DialogHeader>
          <DialogTitle>Delete the screen</DialogTitle>
          <DialogDescription>
            {screen.title} · {screen.id}
          </DialogDescription>
        </DialogHeader>
        <p className="m-0 text-xs">
          The file goes into the trash of the project (<code>.canvas/trash/</code>) with its open changes. “Restore” in
          the Project tab puts it back.
        </p>
        {members.length > 0 && (
          <ScreenList title="These go with it:" screens={members} data="members" />
        )}
        {linkedBy.length > 0 ? (
          <ScreenList
            title="These screens link to it. Their links show as broken links, and the agent decides what each control does now:"
            screens={linkedBy}
            data="linked-by"
          />
        ) : (
          <p className="m-0 text-xs text-[color:var(--muted-foreground)]" data-screen-dialog-linked-by="">
            No screen links to it.
          </p>
        )}
        {refusals.length > 0 && <Refusals reasons={refusals} />}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant="destructive-outline" autoFocus onClick={remove} disabled={busy} data-screen-dialog-submit="">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ScreenList({ title, screens, data }: { title: string; screens: readonly ActionScreen[]; data: string }) {
  return (
    <div className="grid gap-1 text-xs" data-screen-dialog-list={data}>
      <span>{title}</span>
      <ul className="m-0 grid max-h-40 list-none gap-0.5 overflow-y-auto p-0">
        {screens.map((item) => (
          <li key={item.id} className="flex min-w-0 gap-2">
            <span className="truncate">{item.title}</span>
            <span className="shrink-0 font-mono text-[color:var(--muted-foreground)]">{item.id}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
