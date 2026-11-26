import type { IdChange, ScreenAction } from '../../requests/api.ts'
import { relationOf } from '../../related/groups.ts'
import { flowProblem, idOf, memberName, nameProblem, renameClashes } from '../../related/names.ts'
import { capitalized } from '../../words.ts'
import { movedScreens } from './follow.ts'

// The screen actions of the menu at the end of the title row of a frame
// (`ScreenMenu.tsx`), pure: which actions a screen has, why one is off, what
// a rename and a delete change, and what the editor shows after an action.
// The server checks each action again (`tools/screen-ops.ts`); these checks
// only tell the user before the call.

// A screen of the list, with the fields that the actions read.
export type ActionScreen = {
  id: string
  flow: string
  name: string
  title: string
  stateOf?: string
  optionOf?: string
  error?: string
  links: readonly string[]
}

export type MenuAction = 'rename' | 'title' | 'flow' | 'left' | 'right' | 'delete'

// One item of the menu: `off` is why it cannot run now, or null.
export type MenuItem = { action: MenuAction; label: string; off: string | null }

export const menuLabels: Record<MenuAction, string> = {
  rename: 'Rename…',
  title: 'Change the title…',
  flow: 'Move to flow…',
  left: 'Move left',
  right: 'Move right',
  delete: 'Delete…',
}

function isBase(screen: ActionScreen): boolean {
  return relationOf(screen) === 'base'
}

// The place of a base screen among the base screens of its row, in the
// sequence of the list (`flow.json`, then by name), at each width: the
// position that `reorder` takes. Null for a state, an option and an unknown
// id.
export function rowPlace(list: readonly ActionScreen[], id: string): { index: number; count: number } | null {
  const screen = list.find((item) => item.id === id)
  if (!screen || !isBase(screen)) return null
  const row = list.filter((item) => item.flow === screen.flow && isBase(item))
  return { index: row.findIndex((item) => item.id === id), count: row.length }
}

// The items of the menu of a screen. A state and an option have the place of
// their base in the row, thus no "Move left" and no "Move right"; they stay
// in the flow of their base, thus "Move to flow…" is off. A file with an
// error can only be deleted: the server reads the other actions from the
// file.
export function menuItems(list: readonly ActionScreen[], id: string): MenuItem[] {
  const screen = list.find((item) => item.id === id)
  if (!screen) return []
  const error = screen.error === undefined ? null : 'The screen file has an error: fix it first'
  const place = rowPlace(list, id)
  const item = (action: MenuAction, off: string | null): MenuItem => ({ action, label: menuLabels[action], off })
  const items = [
    item('rename', error),
    item('title', error),
    item('flow', error ?? (isBase(screen) ? null : 'A state or an option stays in the flow of its base')),
  ]
  if (place !== null) {
    items.push(item('left', error ?? (place.index === 0 ? 'The screen is the first of its row' : null)))
    items.push(item('right', error ?? (place.index === place.count - 1 ? 'The screen is the last of its row' : null)))
  }
  items.push(item('delete', null))
  return items
}

// The action of "Move left" (-1) and "Move right" (1), or null when the
// screen cannot move that way.
export function moveAction(list: readonly ActionScreen[], id: string, step: -1 | 1): ScreenAction | null {
  const place = rowPlace(list, id)
  if (place === null) return null
  const to = place.index + step
  return to < 0 || to >= place.count ? null : { action: 'reorder', screen: id, to }
}

// What a rename to `to` changes, as the server plans it: the id of the
// screen, and the ids of its states and options (a name that starts with the
// name of the screen and `-` follows the new name). `problem` is why the
// server would refuse it, or null.
export type RenamePreview = { id: string; changes: IdChange[]; problem: string | null }

export function renamePreview(
  list: readonly ActionScreen[],
  id: string,
  to: { flow: string; name: string },
): RenamePreview {
  const screen = list.find((item) => item.id === id)
  const next = idOf(to.flow, to.name)
  const result = (changes: IdChange[], problem: string | null): RenamePreview => ({ id: next, changes, problem })
  if (!screen) return result([], `no screen has the id '${id}'`)
  const problem = (to.name === '' ? 'The name is empty' : null) ?? nameProblem(to.name) ?? flowProblem(to.flow)
  if (problem !== null) return result([], problem)
  if (!isBase(screen) && to.flow !== screen.flow) return result([], 'A state or an option stays in the flow of its base')
  if (next === id) return result([], 'This is the id of the screen now')
  const members = movedScreens(list, { action: 'rename', screen: id, flow: to.flow, name: to.name }).slice(1)
  const byId = new Map(list.map((item) => [item.id, item]))
  const pairs: [string, string][] = [[id, next]]
  for (const member of members) {
    const entry = byId.get(member)!
    const moved = idOf(to.flow, memberName(entry.name, screen.name, to.name))
    if (moved !== member) pairs.push([member, moved])
  }
  const changes: IdChange[] = pairs.map(([from, moved]) => ({ from, to: moved }))
  const clash = renameClashes(
    list.map((item) => item.id),
    pairs,
    to.flow,
  )[0]
  return result(changes, clash === undefined ? null : capitalized(clash))
}

// What a delete takes into the trash with the screen (its states, and the
// options of the screen and of its states), and the screens that link to one
// of these and keep a broken link.
export type DeleteSummary = { members: ActionScreen[]; linkedBy: ActionScreen[] }

export function deleteSummary(list: readonly ActionScreen[], id: string): DeleteSummary {
  const ids = movedScreens(list, { action: 'delete', screen: id })
  const deleted = new Set(ids)
  const byId = new Map(list.map((item) => [item.id, item]))
  return {
    members: ids.slice(1).flatMap((member) => byId.get(member) ?? []),
    linkedBy: list.filter((item) => !deleted.has(item.id) && item.links.some((link) => deleted.has(link))),
  }
}

// Why a title cannot be the title of a screen, or null.
export function titleProblem(title: string, current: string): string | null {
  if (title.trim() === '') return 'The title is empty'
  if (title === current) return 'This is the title of the screen now'
  return null
}

// The flows of the list, each one time, in the sequence of the list: the
// choices of "Move to flow…". '' is the screens folder itself.
export function flowsOf(list: readonly ActionScreen[]): string[] {
  return [...new Set(list.map((item) => item.flow))]
}

// The editor after an applied action: the screen of the Changes tab follows
// its new id, or is null when it was deleted; the selection and the bubble of
// a screen whose id changed clear, because its frame is a new one.
export type ViewAfter = { listed: string | null; clearSelection: boolean; closeBubble: boolean }

export function viewAfter(
  changes: readonly IdChange[],
  view: { listed: string | null; selected: string | null; bubble: string | null },
): ViewAfter {
  const moved = new Map(changes.flatMap((change) => (change.from === null ? [] : [[change.from, change.to] as const])))
  const follow = (id: string | null) => (id !== null && moved.has(id) ? moved.get(id)! : id)
  return {
    listed: follow(view.listed),
    clearSelection: view.selected !== null && moved.has(view.selected),
    closeBubble: view.bubble !== null && moved.has(view.bubble),
  }
}
