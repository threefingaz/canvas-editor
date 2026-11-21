import { useSyncExternalStore } from 'react'
import type { Issue } from '../../requests/format.ts'

// The Issues list of each screen, by screen id, as `useIssues` reads it from
// the frame documents. A screen has no key before its first reading. A new
// list with the same content as the current one changes nothing: the
// subscribers (the count on the frame, the Issues list, the save of the issues
// file) are called only for a real change.

export type IssueScreens = Readonly<Record<string, Issue[]>>

export type IssuesStore = {
  screens: () => IssueScreens
  // The issues of one screen; undefined before the first reading. The same
  // list until its content changes.
  get: (screenId: string) => Issue[] | undefined
  set: (screenId: string, issues: Issue[]) => void
  subscribe: (listener: () => void) => () => void
}

// The same issues in the same sequence. The issues of a screen are built by
// one function (`screenIssues`), thus equal issues have their keys in the same
// sequence.
export function sameIssues(a: readonly Issue[], b: readonly Issue[]): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

export function createIssuesStore(): IssuesStore {
  let screens: IssueScreens = {}
  const listeners = new Set<() => void>()
  return {
    screens: () => screens,
    get: (screenId) => screens[screenId],
    set: (screenId, issues) => {
      const current = screens[screenId]
      if (current !== undefined && sameIssues(current, issues)) return
      screens = { ...screens, [screenId]: issues }
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

// The issues of the editor.
export const issues = createIssuesStore()

export function useIssueScreens(): IssueScreens {
  return useSyncExternalStore(issues.subscribe, issues.screens, issues.screens)
}

export function useScreenIssues(screenId: string): Issue[] | undefined {
  const get = () => issues.get(screenId)
  return useSyncExternalStore(issues.subscribe, get, get)
}
