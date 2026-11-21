import type { ScreenEntry } from 'virtual:canvas-screens'

// The index of the prototype site: the screens by flow.

export type FlowGroup = { flow: string; screens: ScreenEntry[] }

// One group for each flow, in the order of the first screen of each flow; the
// screens of a group keep the order of the list. The list of
// `virtual:canvas-screens` is in the order of `sortScreens` (by flow, then by
// name), thus the groups are too. A flow in a sub folder (`onboarding/forms`)
// is a group of its own.
export function flowGroups(screens: readonly ScreenEntry[]): FlowGroup[] {
  const groups = new Map<string, ScreenEntry[]>()
  for (const screen of screens) {
    const group = groups.get(screen.flow)
    if (group) group.push(screen)
    else groups.set(screen.flow, [screen])
  }
  return [...groups].map(([flow, list]) => ({ flow, screens: list }))
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
