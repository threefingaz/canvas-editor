import type { ScreenEntry } from 'virtual:canvas-screens'
import { relationOf, screenGroups } from '../related/groups.ts'

// The index of the prototype site: the screens by flow.

// A base screen and its states. The index leaves out the options: they are
// choices that are still open, not a part of the prototype that a reviewer
// follows. An option still opens at its address.
export type IndexGroup = { base: ScreenEntry; states: ScreenEntry[] }

export type FlowGroup = { flow: string; groups: IndexGroup[] }

// One group for each flow, in the order of the first screen of each flow; in
// a flow, the groups of `screenGroups`, in the order of the list. The list of
// `virtual:canvas-screens` is in the order of `sortScreens` (by flow, then by
// name), thus the groups are too. A flow in a sub folder (`onboarding/forms`)
// is a group of its own. A flow with no group left has no heading.
export function flowGroups(screens: readonly ScreenEntry[]): FlowGroup[] {
  const flows = new Map<string, ScreenEntry[]>()
  for (const screen of screens) {
    const flow = flows.get(screen.flow)
    if (flow) flow.push(screen)
    else flows.set(screen.flow, [screen])
  }
  return [...flows].map(([flow, list]) => ({
    flow,
    groups: screenGroups(list)
      // A group whose base is an option: only a list that breaks the rules of
      // `screenList` has one, and the index leaves out each option.
      .filter((group) => relationOf(group.base.screen) !== 'option')
      .map((group) => ({ base: group.base.screen, states: group.states.map((state) => state.screen) })),
  })).filter((flow) => flow.groups.length > 0)
}

// The text for the screens directly in the screens folder, which have no flow.
export const noFlowTitle = 'Other screens'

// The heading of a flow: the folder names with spaces in place of `-` and `_`,
// the first letter of each part in upper case, and ` / ` between the parts:
// 'test-loop' gives 'Test loop', 'onboarding/forms' gives 'Onboarding / Forms'.
export function flowTitle(flow: string): string {
  if (flow === '') return noFlowTitle
  return flow
    .split('/')
    .map((part) => part.replace(/[-_]+/g, ' ').trim())
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ')
}
