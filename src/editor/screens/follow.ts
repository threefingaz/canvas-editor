import type { AppliedAction, IdChange, ScreenAction } from '../../requests/api.ts'
import type { Edit } from '../../requests/format.ts'
import { sameEdits } from '../requests/sync.ts'
import { groupMembers, type RelatedScreen } from '../../related/groups.ts'
import type { BubbleStore } from '../comments/bubble-store.ts'
import type { EditsStore } from '../edits/store.ts'
import type { IssuesStore } from '../issues/store.ts'
import type { ReportError } from '../requests/file-errors.ts'
import type { EditorSync, SaveState } from '../requests/sync.ts'
import type { ActionResult, ScreensClient } from './client.ts'

// The editor around a screen action of the tool (`tools/screen-ops.ts`):
//
// - Before it: a rename and a delete move the request files of the screen,
//   its states and its options. The action is off while a save of one of them
//   is pending or failed, thus no edit is lost, and no late save writes a
//   file at the old id.
// - While it runs: the request sync holds the moved screens (`hold`): they
//   load and save nothing, and the new list of the dev server, which can come
//   before the answer, neither ends them nor starts the new ids. A change of
//   the edits of a moved screen that the user makes meanwhile (a new item, a
//   new text of a comment, a discard, an undo) is not in the file that the
//   server moves. After a rename the edits of the editor go to the new id
//   (`carriedEdits`) with the edits of the moved file as the base of its
//   first load, thus the load merges each change and saves it. After a delete
//   it goes with the screen. The rule is the same in each order of the answer
//   and the list.
// - After it: the editor drops the state of each old id (the edits with their
//   undo steps, the drafts of comments, the issues, the file errors, the work
//   of the syncs) and loads the request files of the new ids. The server
//   moved the files with their ids changed inside, thus the edits come back
//   from the files at the new ids.

// The ids to drop and to load after an action: each old id, and each new id.
export function idChanges(screens: readonly IdChange[]): { drop: string[]; load: string[] } {
  const drop = new Set<string>()
  const load = new Set<string>()
  for (const change of screens) {
    if (change.from !== null) drop.add(change.from)
    if (change.to !== null) load.add(change.to)
  }
  return { drop: [...drop], load: [...load] }
}

// The screens whose request files an action moves: for a rename and a delete,
// the screen, its states, and the options of these; none for a move in the
// row, a new title and a restore.
export function movedScreens(list: readonly RelatedScreen[], action: ScreenAction): string[] {
  if (action.action !== 'rename' && action.action !== 'delete') return []
  return [action.screen, ...groupMembers(list, action.screen).map((screen) => screen.id)]
}

// The screens whose request files an action moves or changes: the moved
// screens, and for a rename of an option its base, whose `keep` of the option
// the server gives the new id (`renameRequests` of `tools/screen-ops.ts`). A
// save of the base that is pending would write the old id back.
export function heldScreens(list: readonly RelatedScreen[], action: ScreenAction): string[] {
  const moved = movedScreens(list, action)
  if (action.action !== 'rename') return moved
  const base = list.find((screen) => screen.id === action.screen)?.optionOf
  return base === undefined || moved.includes(base) ? moved : [...moved, base]
}

export type Carried = {
  // The edits of the moved file: of the old id before the call.
  base: Edit[]
  // The edits of the editor: of the old id after the call.
  edits: Edit[]
}

// The edits of each renamed screen whose edits changed while the rename ran
// (a new item, a changed one, a discarded one), by new id: the base and the
// edits of the editor, each with its target in the file of the new id and the
// `option` of a `keep` at its new id. A target moves only when its file is
// one that the plan moved (`moves`), as the server moves the targets of the
// request files: a target in an own component stays. A delete carries
// nothing.
export function carriedEdits(
  plan: Pick<AppliedAction, 'screens' | 'moves'>,
  before: ReadonlyMap<string, readonly Edit[]>,
  now: (id: string) => readonly Edit[],
): Map<string, Carried> {
  const ids = new Map(plan.screens.flatMap((change) => (change.from !== null && change.to !== null ? [[change.from, change.to] as const] : [])))
  const files = new Map(plan.moves.map((step) => [step.from, step.to]))
  const moved = (edit: Edit): Edit => {
    const target = edit.target === null ? null : { ...edit.target, file: files.get(edit.target.file) ?? edit.target.file }
    const change = edit.change.kind === 'keep' && ids.has(edit.change.option) ? { ...edit.change, option: ids.get(edit.change.option)! } : edit.change
    return { ...edit, target, change }
  }
  const carried = new Map<string, Carried>()
  for (const [from, to] of ids) {
    const base = before.get(from) ?? []
    const edits = now(from)
    if (sameEdits(base, edits)) continue
    carried.set(to, { base: base.map(moved), edits: edits.map(moved) })
  }
  return carried
}

// Why the action cannot run now, or null: the first screen of `ids` whose
// changes are not saved.
export function saveBlock(ids: readonly string[], saveState: (id: string) => SaveState): string | null {
  for (const id of ids) {
    const state = saveState(id)
    if (state === 'pending') return `The changes of ${id} are not saved yet. Try again in a moment.`
    if (state === 'failed') return `The changes of ${id} cannot be saved. Fix the file error first.`
  }
  return null
}

export type FollowDeps = {
  sync: EditorSync | null
  edits: Pick<EditsStore, 'replace' | 'get'>
  issues: Pick<IssuesStore, 'drop'>
  drafts: Pick<BubbleStore, 'dropDrafts'>
  report: ReportError
}

// Drops the state of each old id of an applied action and loads the files of
// the new ids. The syncs come first, thus the change of the edits saves
// nothing at an old id.
export function followAction(plan: Pick<AppliedAction, 'screens'>, deps: FollowDeps, bases?: ReadonlyMap<string, readonly Edit[]>) {
  const { drop, load } = idChanges(plan.screens)
  deps.sync?.requests.replaceScreens(drop, load, bases)
  deps.sync?.issues.replaceScreens(drop, load)
  for (const id of drop) {
    deps.edits.replace(id, [])
    deps.issues.drop(id)
    deps.drafts.dropDrafts(id)
    deps.report(`collect:${id}`, null)
  }
}

export type RunDeps = FollowDeps & { client: Pick<ScreensClient, 'run'>; list: readonly RelatedScreen[] }

// Runs one screen action: the check of the saves, the call, and the change of
// the editor after it. A blocked action gives a refusal and makes no call.
export async function runAction(action: ScreenAction, deps: RunDeps): Promise<ActionResult> {
  const moved = movedScreens(deps.list, action)
  const held = heldScreens(deps.list, action)
  const block = deps.sync ? saveBlock(held, deps.sync.requests.saveState) : null
  if (block !== null) return { status: 'refused', refusals: [block] }
  const editsOf = (id: string) => deps.edits.get(id).map((item) => item.edit)
  const before = new Map(moved.map((id) => [id, editsOf(id)]))
  // While the call runs, the syncs hold the screens: the request sync neither
  // loads, saves, ends nor starts them, also when the new list comes before
  // the answer, and the issues sync writes no issues file at an old id. Thus
  // the edits of the store after the call are what the user did.
  const holds = held.length > 0 && deps.sync ? [deps.sync.requests.hold(held), deps.sync.issues.hold(held)] : []
  const release = () => {
    for (const end of holds) end()
  }
  try {
    const result = await deps.client.run(action)
    if (result.status === 'applied') {
      const carried = carriedEdits(result.plan, before, editsOf)
      followAction(result.plan, deps, new Map([...carried].map(([id, item]) => [id, item.base])))
      for (const [id, item] of carried) {
        // An edit that the store has at the new id already (unsaved edits of
        // an earlier screen with that id) stays, unless it is an item of the
        // moved file: the carried edits say what became of each of these.
        const ids = new Set([...item.base, ...item.edits].map((edit) => edit.id))
        deps.edits.replace(id, [...editsOf(id).filter((edit) => !ids.has(edit.id)), ...item.edits])
      }
    }
    return result
  } finally {
    release()
  }
}
