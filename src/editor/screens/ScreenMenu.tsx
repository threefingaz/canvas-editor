import { DotsThreeIcon } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { screens } from 'virtual:canvas-screens'
import type { ScreenAction } from '../../requests/api.ts'
import { messageOf } from '../../tokens/format.ts'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui'
import { DeleteDialog } from './DeleteDialog.tsx'
import { screenDialog, useScreenDialog, type OnApplied } from './dialog-store.ts'
import { Refusals, RenameDialog } from './RenameDialog.tsx'
import { runScreenAction } from './run.ts'
import { menuItems, moveAction, type MenuAction } from './screen-actions.ts'

// The menu of the screen actions at the end of the title row of a frame:
// "Rename…", "Change the title…", "Move to flow…", "Move left", "Move right"
// and "Delete…" (`menuItems`; a state and an option have no move in the
// row). An item that is off says why in its title. A move in the row runs at
// once; each other item opens its dialog (`screenDialog`), which the editor
// renders once, outside the canvas (`ScreenDialogs`). The frame has no menu
// with the Preview switch on.

// The text of a result that is not applied, or an empty list when it ran. It
// never rejects: an error that a step of the editor throws is a text too,
// thus a dialog never stays busy.
async function applyAction(action: ScreenAction, onApplied: OnApplied | null): Promise<string[]> {
  try {
    const result = await runScreenAction(action, screens)
    if (result.status === 'applied') {
      onApplied?.(result.plan)
      return []
    }
    return result.status === 'refused' ? result.refusals : [result.error]
  } catch (error) {
    return [messageOf(error)]
  }
}

// True while a move in the row runs: a second move would be computed from the
// list before the first one, thus it waits for the end of the first.
let moving = false

export function ScreenMenu({ screenId }: { screenId: string }) {
  const choose = (action: MenuAction) => {
    if (action === 'left' || action === 'right') {
      if (moving) return
      const move = moveAction(screens, screenId, action === 'left' ? -1 : 1)
      if (move === null) return
      moving = true
      void applyAction(move, null)
        .then((reasons) => {
          // The refusals take no dialog that the user opened meanwhile.
          if (reasons.length > 0 && screenDialog.get() === null) screenDialog.open({ kind: 'refused', screen: screenId, reasons })
        })
        .finally(() => {
          moving = false
        })
      return
    }
    screenDialog.open({ kind: action, screen: screenId })
  }
  const items = menuItems(screens, screenId)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex shrink-0 cursor-pointer items-center border-0 bg-transparent p-0 text-inherit hover:text-[color:var(--foreground)]"
        title="Screen actions"
        aria-label="Screen actions"
        data-frame-menu={screenId}
      >
        <DotsThreeIcon className="size-3.5" weight="bold" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto" data-screen-menu={screenId}>
        {items.map((item) => [
          item.action === 'delete' && <DropdownMenuSeparator key="separator" />,
          <DropdownMenuItem
            key={item.action}
            disabled={item.off !== null}
            variant={item.action === 'delete' ? 'destructive' : 'default'}
            title={item.off ?? undefined}
            onClick={() => choose(item.action)}
            data-screen-menu-item={item.action}
          >
            {item.label}
          </DropdownMenuItem>,
        ])}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// The open dialog of a screen action (`screenDialog`), one for the editor.
// `onApplied` lets the editor follow the new ids after an action.
export function ScreenDialogs({ onApplied }: { onApplied: OnApplied }) {
  const dialog = useScreenDialog()
  const screen = dialog === null ? undefined : screens.find((item) => item.id === dialog.screen)
  // The screen of a dialog left the list (an agent renamed it): the dialog
  // closes, thus a later screen with that id does not open it again.
  const gone = dialog !== null && dialog.kind !== 'refused' && !screen
  useEffect(() => {
    if (gone) screenDialog.close()
  }, [gone])
  if (dialog === null) return null
  // Closes this dialog only: a late answer of a dialog that is gone (a hot
  // update unmounted it) does not close one that the user opened since.
  const close = () => {
    if (screenDialog.get() === dialog) screenDialog.close()
  }
  if (dialog.kind === 'refused') {
    return (
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent data-screen-dialog="refused">
          <DialogHeader>
            <DialogTitle>The screen did not move</DialogTitle>
          </DialogHeader>
          <Refusals reasons={dialog.reasons} />
          <DialogFooter>
            <Button type="button" onClick={close}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
  // The screen left the list: nothing to act on (the effect above closes it).
  if (!screen) return null
  const run = (action: ScreenAction) => applyAction(action, onApplied)
  // The key starts a new dialog for each screen and kind.
  const key = `${dialog.kind} ${dialog.screen}`
  if (dialog.kind === 'delete') return <DeleteDialog key={key} screen={screen} list={screens} run={run} onClose={close} />
  return <RenameDialog key={key} mode={dialog.kind} screen={screen} list={screens} run={run} onClose={close} />
}
