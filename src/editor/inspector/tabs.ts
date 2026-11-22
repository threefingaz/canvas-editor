// The two tabs of the panel at the right of the editor: Design, the values of
// the selected element, and Changes, the edits, the comments, the requests
// and the issues of the listed screen. The panel shows one of them at a time.
// A click on an element in a frame opens Design; a click on the title of a
// frame, on its count of issues, on its mark "Options asked" or on a pin of
// its title row (the comments on the screen, the lost comments) opens
// Changes. A selection that comes from a row of a list in the panel, or from
// a pin on an element, sends no event: the tab stays, thus the user can go
// down the list.

export type Tab = 'design' | 'changes'

// True for the value of a tab: the tabs give the value of a click as text.
export function isTab(value: unknown): value is Tab {
  return value === 'design' || value === 'changes'
}

export type TabEvent = 'pick' | 'title' | 'issues' | 'pin-of-screen'

// The tab after an event.
export function tabAfter(event: TabEvent): Tab {
  return event === 'pick' ? 'design' : 'changes'
}

// True when a click on the title row of the frame of `screenId` (`event`)
// clears the selection: the title, the count of issues and the mark of the
// asked options clear it; a pin of the title row keeps a selection in its own
// screen, because it opens the bubble of that screen next to it.
export function clearsSelection(event: Exclude<TabEvent, 'pick'>, selectedScreen: string | null, screenId: string): boolean {
  return event !== 'pin-of-screen' || selectedScreen !== screenId
}
