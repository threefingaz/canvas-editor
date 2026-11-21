import { useEffect, useRef } from 'react'
import { requestChangedEvent } from '../../requests/api.ts'
import { formatVersion, type Edit, type Issue, type IssuesFile, type RequestFile } from '../../requests/format.ts'
import { edits, type EditsStore, type Screens } from '../edits/store.ts'
import { issues, type IssuesStore } from '../issues/store.ts'
import { requestsClient, type RequestsClient } from './client.ts'
import { fileErrors, type ReportError } from './file-errors.ts'

// Keeps the edits store and the request files of the screens the same:
//
// - At the start it loads the request file of each screen, thus the previews
//   stay after a reload of the editor.
// - It saves the file of a screen a short time after a change of its edits.
// - Each save carries the hash of the text that the editor loaded or wrote
//   last. When the file on the disk is different (an agent or the user changed
//   it), the server answers with its content; the editor merges (`mergeEdits`)
//   and saves again.
// - When the dev server tells about a request file that changed, the editor
//   loads it again; content that came from outside replaces the edits.
//
// It also writes the issues file of each screen when its Issues list changes
// (`createIssuesSync`). The editor only writes that file; nothing reads it
// back.

// The time from the last change of the edits of a screen to the save.
export const saveDelay = 300

// A screen of the list: its id and its file.
export type ScreenRef = { id: string; file: string }

// The screens whose list of edits changed. A change of the stale mark alone is
// no change: it is not in the file.
export function changedScreens(before: Screens, after: Screens): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter((key) => {
    const a = before[key] ?? []
    const b = after[key] ?? []
    return a.length !== b.length || a.some((item, index) => item.edit !== b[index].edit)
  })
}

export function requestOf(screen: ScreenRef, list: Edit[]): RequestFile {
  return { version: formatVersion, screen: screen.id, file: screen.file, edits: list }
}

// A text of a value with the keys of each object in a fixed sequence.
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner !== null && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : inner,
  )
}

const sameEdit = (a: Edit, b: Edit) => a === b || canonical(a) === canonical(b)

// The same edits in the same sequence, by content.
export function sameEdits(a: readonly Edit[], b: readonly Edit[]): boolean {
  return a.length === b.length && a.every((value, index) => sameEdit(value, b[index]))
}

// Merges the edits of the editor with the edits of the file, when both changed
// after `base` (the edits of the text that the editor loaded or wrote last).
//
// - The items of the file stay, with the replies of the agent; an item that the
//   agent removed is not there.
// - An item that the user discarded in the editor goes out.
// - An item that only the editor changed keeps the version of the editor; when
//   both changed it, the file wins.
// - The new items of the editor (not in the base) are added at the end.
export function mergeEdits(base: readonly Edit[], local: readonly Edit[], remote: readonly Edit[]): Edit[] {
  const baseById = new Map(base.map((value) => [value.id, value]))
  const localById = new Map(local.map((value) => [value.id, value]))
  const remoteIds = new Set(remote.map((value) => value.id))
  const kept = remote.flatMap((value) => {
    const before = baseById.get(value.id)
    if (before === undefined) return [value]
    const mine = localById.get(value.id)
    if (mine === undefined) return []
    return [sameEdit(value, before) ? mine : value]
  })
  const added = local.filter((value) => !baseById.has(value.id) && !remoteIds.has(value.id))
  return [...kept, ...added]
}

type ScreenState = {
  screen: ScreenRef
  // The hash and the edits of the text that the editor loaded or wrote last;
  // null before the first load.
  hash: string | null
  base: Edit[]
  timer: ReturnType<typeof setTimeout> | null
  // One call at a time for each screen; the flags say what comes next.
  busy: boolean
  needLoad: boolean
  needSave: boolean
}

export type SyncDeps = {
  store: Pick<EditsStore, 'screens' | 'get' | 'replace' | 'subscribe'>
  client: Pick<RequestsClient, 'loadRequest' | 'saveRequest'>
  // Calls `handler` with the screen id when a request file changes, is added
  // or is removed on the disk. Gives the function that stops it.
  listen: (handler: (id: string) => void) => () => void
  // The errors of the load or save of each screen.
  report: ReportError
}

export type Sync = {
  // The current list of screens: a new screen is loaded, a removed screen is
  // no longer saved.
  setScreens: (list: readonly ScreenRef[]) => void
  // Ends the work and clears the errors of the sync.
  stop: () => void
}

export function createSync({ store, client, listen, report }: SyncDeps): Sync {
  const states = new Map<string, ScreenState>()
  let last = store.screens()
  let stopped = false

  const setError = (id: string, error: string | null) => report(`requests:${id}`, error)

  const local = (id: string) => store.get(id).map((item) => item.edit)

  // Takes the edits of the file as the new base and merges the edits of the
  // editor into them.
  const reconcile = (state: ScreenState, remote: Edit[], hash: string) => {
    const id = state.screen.id
    const mine = local(id)
    const merged = mergeEdits(state.base, mine, remote)
    state.base = remote
    state.hash = hash
    if (!sameEdits(merged, remote)) state.needSave = true
    if (!sameEdits(merged, mine)) store.replace(id, merged)
  }

  const load = async (state: ScreenState) => {
    const id = state.screen.id
    const result = await client.loadRequest(id)
    if (stopped || states.get(id) !== state) return
    if (result.status === 'error') {
      setError(id, `Cannot read the changes of ${id}: ${result.error}`)
      return
    }
    setError(id, null)
    // A text that the editor did not load or write last came from outside.
    if (state.hash !== result.hash) reconcile(state, result.file.edits, result.hash)
  }

  const save = async (state: ScreenState) => {
    const id = state.screen.id
    // Nothing is saved before a load: the base is not known.
    if (state.hash === null) return
    const mine = local(id)
    // The file has these edits: nothing is unsaved, also after a failed save.
    if (sameEdits(mine, state.base)) {
      setError(id, null)
      return
    }
    const result = await client.saveRequest(requestOf(state.screen, mine), state.hash)
    if (stopped || states.get(id) !== state) return
    if (result.status === 'error') {
      setError(id, `Cannot save the changes of ${id}: ${result.error}`)
      return
    }
    setError(id, null)
    if (result.status === 'conflict') {
      reconcile(state, result.file.edits, result.hash)
      return
    }
    state.base = result.file.edits
    state.hash = result.hash
  }

  const run = (state: ScreenState) => {
    // A screen that left the list during a call is not loaded or saved again.
    if (stopped || state.busy || states.get(state.screen.id) !== state) return
    let next: (state: ScreenState) => Promise<void>
    if (state.needLoad) {
      state.needLoad = false
      next = load
    } else if (state.needSave) {
      state.needSave = false
      next = save
    } else {
      return
    }
    state.busy = true
    void next(state).finally(() => {
      state.busy = false
      run(state)
    })
  }

  const scheduleSave = (state: ScreenState) => {
    if (state.timer !== null) clearTimeout(state.timer)
    state.timer = setTimeout(() => {
      state.timer = null
      state.needSave = true
      run(state)
    }, saveDelay)
  }

  const unsubscribe = store.subscribe(() => {
    const next = store.screens()
    const changed = changedScreens(last, next)
    last = next
    for (const id of changed) {
      const state = states.get(id)
      if (state) scheduleSave(state)
    }
  })

  const unlisten = listen((id) => {
    const state = states.get(id)
    if (!state) return
    state.needLoad = true
    run(state)
  })

  return {
    setScreens: (list) => {
      if (stopped) return
      const ids = new Set(list.map((screen) => screen.id))
      for (const [id, state] of states) {
        if (ids.has(id)) continue
        if (state.timer !== null) clearTimeout(state.timer)
        states.delete(id)
        setError(id, null)
        // The saved edits of a removed screen go out of the store; its request
        // file stays on the disk. A screen with the same id later (a new option
        // after a `keep` deleted the old one, a file that comes back) loads
        // its file, and old edits do not go into it. Edits that are not saved
        // yet (in the save delay, or made during a save) stay: when the screen
        // comes back, the load merges them as new items and saves them.
        const mine = local(id)
        if (mine.length > 0 && state.hash !== null && sameEdits(mine, state.base)) store.replace(id, [])
      }
      for (const screen of list) {
        const known = states.get(screen.id)
        if (known) {
          known.screen = screen
          continue
        }
        const state: ScreenState = {
          screen,
          hash: null,
          base: [],
          timer: null,
          busy: false,
          needLoad: true,
          needSave: false,
        }
        states.set(screen.id, state)
        run(state)
      }
    },
    stop: () => {
      stopped = true
      unsubscribe()
      unlisten()
      for (const [id, state] of states) {
        if (state.timer !== null) clearTimeout(state.timer)
        setError(id, null)
      }
    },
  }
}

export function issuesFileOf(screen: ScreenRef, list: Issue[]): IssuesFile {
  return { version: formatVersion, screen: screen.id, file: screen.file, issues: list }
}

export type IssuesSyncDeps = {
  store: Pick<IssuesStore, 'screens' | 'subscribe'>
  client: Pick<RequestsClient, 'saveIssues'>
  // The errors of the save of each screen.
  report: ReportError
}

type IssuesState = {
  screen: ScreenRef
  // The list of the last save that started; null before the first and after
  // a failed one.
  saved: Issue[] | null
  busy: boolean
}

// Writes the issues file of each screen of the list when the issues store has
// a new list for it. The store keeps a list until its content changes, thus a
// compare of the lists is sufficient. One save at a time for each screen; a
// list that changes during a save is saved after it, only the last one. A
// failed save is tried again at the next change of the store or of the list
// of screens.
export function createIssuesSync({ store, client, report }: IssuesSyncDeps): Sync {
  const states = new Map<string, IssuesState>()
  let stopped = false

  const setError = (id: string, error: string | null) => report(`issues:${id}`, error)

  const run = (state: IssuesState) => {
    if (stopped || state.busy) return
    const id = state.screen.id
    const list = store.screens()[id]
    if (list === undefined || list === state.saved) return
    state.busy = true
    state.saved = list
    void client.saveIssues(issuesFileOf(state.screen, list)).then((result) => {
      state.busy = false
      if (stopped || states.get(id) !== state) return
      if (result.status === 'error') {
        state.saved = null
        setError(id, `Cannot save the issues of ${id}: ${result.error}`)
        return
      }
      setError(id, null)
      run(state)
    })
  }

  const runAll = () => {
    for (const state of states.values()) run(state)
  }

  const unsubscribe = store.subscribe(runAll)

  return {
    setScreens: (list) => {
      if (stopped) return
      const ids = new Set(list.map((screen) => screen.id))
      for (const id of states.keys()) {
        if (ids.has(id)) continue
        states.delete(id)
        setError(id, null)
      }
      for (const screen of list) {
        const known = states.get(screen.id)
        if (known) known.screen = screen
        else states.set(screen.id, { screen, saved: null, busy: false })
      }
      runAll()
    },
    stop: () => {
      stopped = true
      unsubscribe()
      for (const id of states.keys()) setError(id, null)
    },
  }
}

// The events of the dev server about request files. There are none in a build.
function listenToServer(handler: (id: string) => void): () => void {
  const hot = import.meta.hot
  if (!hot) return () => {}
  const onChange = ({ id }: { id: string }) => handler(id)
  hot.on(requestChangedEvent, onChange)
  return () => hot.off(requestChangedEvent, onChange)
}

// Keeps the edits of the editor and the request files of `list` the same, and
// writes the issues files of `list`, for the life of the component.
export function useRequestSync(list: readonly ScreenRef[]) {
  const sync = useRef<Sync[]>([])

  useEffect(() => {
    const started = [
      createSync({ store: edits, client: requestsClient, listen: listenToServer, report: fileErrors.report }),
      createIssuesSync({ store: issues, client: requestsClient, report: fileErrors.report }),
    ]
    sync.current = started
    return () => {
      for (const one of started) one.stop()
      sync.current = []
    }
  }, [])

  // After the effect above, thus a new sync gets the list too.
  useEffect(() => {
    for (const one of sync.current) one.setScreens(list)
  }, [list])
}
