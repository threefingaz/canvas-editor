import type { ScreenAction } from '../../requests/api.ts'
import type { RelatedScreen } from '../../related/groups.ts'
import { bubble } from '../comments/bubble-store.ts'
import { edits } from '../edits/store.ts'
import { issues } from '../issues/store.ts'
import { fileErrors } from '../requests/file-errors.ts'
import { editorSync } from '../requests/sync.ts'
import { screensClient, type ActionResult } from './client.ts'
import { runAction } from './follow.ts'

// Runs one screen action with the stores of the editor (`follow.ts`). `list`
// is the current list of screens.
export function runScreenAction(action: ScreenAction, list: readonly RelatedScreen[]): Promise<ActionResult> {
  return runAction(action, {
    client: screensClient,
    list,
    sync: editorSync(),
    edits,
    issues,
    drafts: bubble,
    report: fileErrors.report,
  })
}
