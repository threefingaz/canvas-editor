// The rows of the Project tab: each screen of the project by flow, with its
// counts, and the totals of the project. The functions are pure: they take
// the list of screens, the issues and the edits of all screens as arguments.
//
// An option is a choice that is still open: it has no row. Its base says how
// many options it has, and its open changes count in the total of changes.

import { deviationCount, type Issue } from '../../requests/format.ts'
import { screenGroups, type Related } from '../../related/groups.ts'
import { unknownLinks, unreached } from '../../related/links.ts'

// The fields of a screen that the tab reads. An entry of
// `virtual:canvas-screens` has them.
export type ProjectScreen = {
  id: string
  flow: string
  title: string
  width: number
  links: readonly string[]
  stateOf?: string
  optionOf?: string
  error?: string
}

// The issues of the screens that are read, and the open edits of the screens
// that have edits, by screen id.
export type ProjectIssues = Readonly<Record<string, readonly Issue[] | undefined>>
export type ProjectEdits = Readonly<Record<string, readonly unknown[] | undefined>>

export type ProjectRow = {
  id: string
  title: string
  width: number
  relation: 'base' | 'state'
  // The count of the options of the screen.
  options: number
  // The count of the deviations; null while the issues are not read yet (a
  // file with an error has no frame document, thus it stays null).
  deviations: number | null
  // The count of the open edits.
  changes: number
  // The count of the different screens of the list that the screen links to.
  linksOut: number
  // True when no link leads to the screen and its flow has more than one such
  // screen at its width (`unreached`).
  unreached: boolean
  // The count of the linked ids that no screen has.
  brokenLinks: number
  // The error text of the file, or null.
  error: string | null
}

export type ProjectGroup = { base: ProjectRow; states: ProjectRow[] }

export type ProjectFlow = { flow: string; groups: ProjectGroup[] }

// The flows in the order of the list, each with its groups (`screenGroups`):
// a base screen and its states.
export function projectRows(screens: readonly ProjectScreen[], issues: ProjectIssues, edits: ProjectEdits): ProjectFlow[] {
  const ids = new Set(screens.map((screen) => screen.id))
  const alone = new Set(unreached(screens))
  const row = ({ screen, options }: Related<ProjectScreen>, relation: ProjectRow['relation']): ProjectRow => {
    const list = issues[screen.id]
    return {
      id: screen.id,
      title: screen.title,
      width: screen.width,
      relation,
      options: options.length,
      deviations: list === undefined ? null : deviationCount(list),
      changes: edits[screen.id]?.length ?? 0,
      linksOut: new Set(screen.links.filter((id) => id !== screen.id && ids.has(id))).size,
      unreached: alone.has(screen.id),
      brokenLinks: unknownLinks(screen, ids).length,
      error: screen.error ?? null,
    }
  }

  const flows = new Map<string, ProjectScreen[]>()
  for (const screen of screens) {
    const list = flows.get(screen.flow)
    if (list) list.push(screen)
    else flows.set(screen.flow, [screen])
  }
  return [...flows].map(([flow, list]) => ({
    flow,
    groups: screenGroups(list).map((group) => ({
      base: row(group.base, 'base'),
      states: group.states.map((state) => row(state, 'state')),
    })),
  }))
}

export type ProjectTotals = {
  // The screens that are not options.
  screens: number
  flows: number
  // The deviations of the screens that are not options, and how many of
  // these screens have one or more.
  deviations: number
  deviating: number
  // The open edits of all screens of the list, the options too.
  changes: number
  // The screens (not options, no file error) whose issues are not read yet.
  unread: number
}

export function projectTotals(screens: readonly ProjectScreen[], issues: ProjectIssues, edits: ProjectEdits): ProjectTotals {
  const totals: ProjectTotals = { screens: 0, flows: 0, deviations: 0, deviating: 0, changes: 0, unread: 0 }
  const flows = new Set<string>()
  for (const screen of screens) {
    totals.changes += edits[screen.id]?.length ?? 0
    if (screen.optionOf !== undefined) continue
    totals.screens += 1
    flows.add(screen.flow)
    const list = issues[screen.id]
    if (list === undefined) {
      if (screen.error === undefined) totals.unread += 1
      continue
    }
    const count = deviationCount(list)
    totals.deviations += count
    if (count > 0) totals.deviating += 1
  }
  totals.flows = flows.size
  return totals
}

function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

// The totals in words, in parts for one line: "4 screens in 1 flow",
// "15 deviations in 1 screen" or "No deviation", "12 changes" when there are
// changes, and the screens that are not read yet when there are some. With
// no screen, one part that says so.
export function totalsText(totals: ProjectTotals): string[] {
  if (totals.screens === 0) return ['No screen']
  const parts = [`${counted(totals.screens, 'screen', 'screens')} in ${counted(totals.flows, 'flow', 'flows')}`]
  parts.push(
    totals.deviations === 0
      ? 'No deviation'
      : `${counted(totals.deviations, 'deviation', 'deviations')} in ${counted(totals.deviating, 'screen', 'screens')}`,
  )
  if (totals.changes > 0) parts.push(counted(totals.changes, 'change', 'changes'))
  if (totals.unread > 0) parts.push(`${counted(totals.unread, 'screen', 'screens')} not read yet`)
  return parts
}

// The note of a row: why the screen needs a look, or null. An error of the
// file comes first, because the other counts then say nothing.
export function rowNote(row: ProjectRow): string | null {
  if (row.error !== null) return 'the file has an error'
  const notes: string[] = []
  if (row.unreached) notes.push('no link leads here')
  if (row.brokenLinks > 0) notes.push(counted(row.brokenLinks, 'broken link', 'broken links'))
  return notes.length > 0 ? notes.join(' · ') : null
}
