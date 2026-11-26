import { ArrowCounterClockwiseIcon, CheckIcon, PencilSimpleIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { screens } from 'virtual:canvas-screens'
import { counted } from '../../words.ts'
import type { TrashItem } from '../../requests/api.ts'
import { useEditScreens } from '../edits/store.ts'
import { useIssueScreens } from '../issues/store.ts'
import { screensClient } from '../screens/client.ts'
import { runScreenAction } from '../screens/run.ts'
import { messageOf } from '../../tokens/format.ts'
import { Button, PanelContentSurface } from '../ui'
import { cn } from '../ui/lib/utils.ts'
import { projectRows, projectTotals, rowNote, totalsText, type ProjectRow } from './model.ts'

// The Project tab of the panel: the whole project on one page. A line with
// the totals in words, then each flow with its screens: a base screen, its
// states below it with the mark "State", and how many options a screen has.
// A row shows the title, the width, the count of the deviations (a check for
// none, nothing while the issues of the screen are not read yet), the count
// of the open changes, and a note when no link leads to the screen, when it
// has broken links or when its file has an error. A click on a row lists the
// screen in the Changes tab and fits its frame on the canvas
// (`onOpenScreen`). An option has no row: it is a choice that is still open.
// The issues of a screen are read from its frame, thus the counts are those
// of the code with the open previews applied.
//
// The last group, "Deleted screens", lists the folders of the trash
// (`GET /__canvas/trash`, the newest first), each with "Restore", which puts
// the files of the screen back (`restore`). The list is read when the tab
// opens and again after each change of the list of screens.

type ProjectProps = {
  // The listed screen: its row has a mark.
  listed: string | null
  onOpenScreen: (id: string) => void
}

export function Project({ listed, onOpenScreen }: ProjectProps) {
  const issues = useIssueScreens()
  const edits = useEditScreens()
  const flows = projectRows(screens, issues, edits)
  const totals = projectTotals(screens, issues, edits)
  const row = (item: ProjectRow) => (
    <Row key={item.id} row={item} listed={item.id === listed} onOpen={() => onOpenScreen(item.id)} />
  )
  return (
    <PanelContentSurface scrollFadeMode="overflow" data-project="">
      <p
        className="m-0 px-3 pt-3 pb-1 text-xs text-[color:var(--muted-foreground)]"
        data-project-totals=""
        data-project-screens={totals.screens}
        data-project-deviations={totals.deviations}
        data-project-changes={totals.changes}
      >
        {totalsText(totals).join(' · ')}
      </p>
      {flows.map((flow) => (
        <section
          key={flow.flow}
          className="border-t border-[color:var(--editor-line)] pb-1 first-of-type:border-t-0"
          data-project-flow={flow.flow}
        >
          <h3 className="m-0 truncate px-3 pt-2 pb-1 text-xs font-semibold" title={flow.flow}>
            {flow.flow === '' ? 'No flow' : flow.flow}
          </h3>
          <ul className="m-0 list-none p-0">
            {flow.groups.map((group) => [row(group.base), ...group.states.map(row)])}
          </ul>
        </section>
      ))}
      <DeletedScreens list={screens} />
    </PanelContentSurface>
  )
}

// The folders of the trash, or the error of the call; null before the first
// answer.
type TrashState = { items: TrashItem[] } | { error: string } | null

// `list` is the list of screens: a new list after each change of the
// screens folder reads the trash again.
function DeletedScreens({ list }: { list: typeof screens }) {
  const [trash, setTrash] = useState<TrashState>(null)
  // The version of the list: a restore asks again, also when it changed no
  // screen of the list (a file of the trash was missing).
  const [asked, setAsked] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [refusals, setRefusals] = useState<{ folder: string; reasons: string[] } | null>(null)
  // A new list of screens (a delete, a restore, an agent) makes the refusals
  // of an earlier restore old.
  const [refusalsFor, setRefusalsFor] = useState(list)
  if (refusalsFor !== list) {
    setRefusalsFor(list)
    setRefusals(null)
  }
  useEffect(() => {
    let live = true
    void screensClient.trash().then((result) => {
      if (live) setTrash(result.status === 'loaded' ? { items: result.items } : { error: result.error })
    })
    return () => {
      live = false
    }
  }, [asked, list])

  // True from a click until the answer: a second click before the next render
  // starts no second restore.
  const restoring = useRef(false)
  const restore = async (folder: string) => {
    if (restoring.current) return
    restoring.current = true
    setBusy(folder)
    let reasons: string[] | null
    try {
      const result = await runScreenAction({ action: 'restore', folder }, list)
      reasons = result.status === 'applied' ? null : result.status === 'refused' ? result.refusals : [result.error]
    } catch (error) {
      reasons = [messageOf(error)]
    } finally {
      restoring.current = false
      setBusy(null)
    }
    setRefusals(reasons === null ? null : { folder, reasons })
    setAsked((count) => count + 1)
  }

  if (trash === null || ('items' in trash && trash.items.length === 0)) return null
  return (
    <section className="border-t border-[color:var(--editor-line)] pb-1" data-project-trash="">
      <h3 className="m-0 truncate px-3 pt-2 pb-1 text-xs font-semibold">Deleted screens</h3>
      {'error' in trash ? (
        <p className="m-0 px-3 py-1 text-[11px] text-[color:var(--destructive)]">The trash cannot be read: {trash.error}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {trash.items.map((item) => (
            <li key={item.folder} className="flex min-h-7 flex-col justify-center px-3 py-1 text-xs" data-project-deleted={item.folder}>
              <span className="flex w-full min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono" title={item.files.join('\n')}>
                  {item.screen}
                </span>
                <span className="shrink-0 text-[11px] text-[color:var(--muted-foreground)] tabular-nums" title={item.time}>
                  {deletedAt(item.time)}
                </span>
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={busy !== null}
                  title={`Put the files of ${item.screen} back: ${counted(item.files.length, 'file', 'files')}`}
                  onClick={() => void restore(item.folder)}
                  data-project-restore={item.folder}
                >
                  <ArrowCounterClockwiseIcon aria-hidden />
                  Restore
                </Button>
              </span>
              {refusals?.folder === item.folder && (
                <span className="w-full text-[11px] text-[color:var(--destructive)]" role="alert" data-project-restore-refused="">
                  Nothing changed: {refusals.reasons.join('; ')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// The time of a delete, short: the day and the time of the day.
function deletedAt(time: string): string {
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) return time
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Row({ row, listed, onOpen }: { row: ProjectRow; listed: boolean; onOpen: () => void }) {
  const note = rowNote(row)
  const state = row.relation === 'state'
  return (
    <li>
      <button
        type="button"
        className={cn(
          'flex min-h-7 w-full cursor-pointer flex-col justify-center border-0 bg-transparent px-3 py-1 text-left text-xs text-inherit hover:bg-[color:var(--muted)]',
          state && 'pl-6',
          listed && 'bg-[color:var(--muted)] shadow-[inset_2px_0_0_var(--accent)]',
        )}
        onClick={onOpen}
        data-project-row={row.id}
        data-project-relation={row.relation}
        data-project-deviations={row.deviations ?? ''}
        data-project-row-changes={row.changes}
      >
        <span className="flex w-full min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate" title={row.title}>
            {row.title}
          </span>
          {state && <span className="shrink-0 text-[11px] text-[color:var(--muted-foreground)]">State</span>}
          {row.options > 0 && (
            <span className="shrink-0 text-[11px] text-[color:var(--muted-foreground)]" data-project-options={row.options}>
              {counted(row.options, 'option', 'options')}
            </span>
          )}
          <span className="shrink-0 text-[11px] text-[color:var(--muted-foreground)] tabular-nums">{row.width}</span>
          {row.changes > 0 && (
            <span
              className="flex shrink-0 items-center gap-0.5 text-[color:var(--accent)] tabular-nums"
              title={counted(row.changes, 'open change', 'open changes')}
            >
              <PencilSimpleIcon className="size-3" aria-hidden />
              {row.changes}
            </span>
          )}
          {/* A fixed width, thus the counts of the rows are one column. */}
          <span className="flex w-5 shrink-0 justify-end tabular-nums">
            {row.deviations === null ? null : row.deviations === 0 ? (
              <CheckIcon className="size-3.5 text-[color:var(--muted-foreground)]" aria-label="No deviation" />
            ) : (
              <span className="font-medium text-[color:var(--attention)]" title={counted(row.deviations, 'deviation', 'deviations')}>
                {row.deviations}
              </span>
            )}
          </span>
        </span>
        {note !== null && (
          <span
            className={cn(
              'w-full truncate text-[11px]',
              row.error !== null ? 'text-[color:var(--destructive)]' : 'text-[color:var(--muted-foreground)]',
            )}
            title={row.error ?? note}
            data-project-note=""
          >
            {note}
          </span>
        )}
      </button>
    </li>
  )
}
