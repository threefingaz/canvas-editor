import { useEffect, useRef } from 'react'
import { requestChangedEvent } from '../../requests/api.ts'
import { formatVersion, type Edit, type Issue, type IssuesFile, type RequestFile } from '../../requests/format.ts'
import { edits, type EditsStore, type Screens } from '../edits/store.ts'
import { issues, type IssuesStore } from '../issues/store.ts'
import { messageOf } from '../../tokens/format.ts'
import { requestsClient, type IssuesSaved, type RequestsClient } from './client.ts'
import { fileErrors, type ReportError } from './file-errors.ts'
import { own } from '../../own.ts'

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
    const a = own(before, key) ?? []
    const b = own(after, key) ?? []
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
// - A screen has at most one `keep` item (`parseRequest` refuses a second):
//   when the two sides each have a different one, the last one stays, as a
//   new `keep` of the store replaces the older one.
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
  const merged = [...kept, ...added]
  const keep = merged.findLast((value) => value.change.kind === 'keep')
  return keep === undefined ? merged : merged.filter((value) => value.change.kind !== 'keep' || value === keep)
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
  // True after a load or a save that failed, until one succeeds.
  failed: boolean
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
  // After a screen action of the tool (`src/editor/screens/follow.ts`): the
  // screens of `drop` are gone or have a new id, and their files moved with
  // them. Their work stops at once and their errors clear, and a later list
  // that still has one of them (the list comes after the answer of the
  // action) does not load it again. The screens of `load` are new or came
  // back: each one of the list loads its file again.
  replaceScreens: (drop: readonly string[], load: readonly string[]) => void
  // Ends the work and clears the errors of the sync.
  stop: () => void
}

// The state of the request file of a screen for a screen action: `saved`
// when the file has the edits of the editor, `pending` while a load or a
// save is to come, `failed` after a load or a save that failed with edits
// that the file does not have.
export type SaveState = 'saved' | 'pending' | 'failed'

export type RequestSync = Omit<Sync, 'replaceScreens'> & {
  saveState: (id: string) => SaveState
  // `replaceScreens` with `bases`: the edits that the moved file has at each
  // new id (the edits of the old id when the action started). The first load
  // of that id merges the edits of the editor against them, thus an item that
  // the user changed or discarded while the action ran keeps that change.
  replaceScreens: (drop: readonly string[], load: readonly string[], bases?: ReadonlyMap<string, readonly Edit[]>) => void
  // Holds the request files of `ids` while a screen action moves them, and
  // gives the function that ends the hold. Meanwhile the screens of `ids` load
  // and save nothing (their requests wait), a new list neither ends them nor
  // clears their edits, and it starts no screen. Thus the edits of the store
  // are the edits of the user, whichever comes first: the answer of the action
  // or the new list. The end of the hold takes the current list, and the held
  // screens that are still there do the work that waits.
  hold: (ids: readonly string[]) => () => void
}

export function createSync({ store, client, listen, report }: SyncDeps): RequestSync {
  const states = new Map<string, ScreenState>()
  let last = store.screens()
  let stopped = false
  // The current list of screens.
  let list: readonly ScreenRef[] = []
  // The ids that a screen action dropped, while the list still has them.
  const gone = new Set<string>()
  // The bases of the new ids of a screen action that the list has not yet.
  const seeds = new Map<string, Edit[]>()
  // The ids of each screen action that runs (`hold`).
  const holds = new Set<ReadonlySet<string>>()
  const held = (id: string) => [...holds].some((ids) => ids.has(id))

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
    const changed = !sameEdits(merged, mine)
    if (!sameEdits(merged, remote)) state.needSave = true
    if (changed) store.replace(id, merged)
    // The change of the store asks for a save with the delay: a list that the
    // file has needs none, and a list that it has not is saved at once
    // (`needSave`), also the edits that a save with the delay waits for (a
    // change during the load), thus the delay is not a second save to wait
    // for.
    if (changed || state.needSave) cancelTimer(state)
  }

  const cancelTimer = (state: ScreenState) => {
    if (state.timer === null) return
    clearTimeout(state.timer)
    state.timer = null
  }

  const load = async (state: ScreenState) => {
    const id = state.screen.id
    const result = await client.loadRequest(id)
    if (stopped || states.get(id) !== state) return
    if (result.status === 'error') {
      state.failed = true
      setError(id, `Cannot read the changes of ${id}: ${result.error}`)
      return
    }
    state.failed = false
    setError(id, null)
    // A text that the editor did not load or write last came from outside.
    if (state.hash !== result.hash) reconcile(state, result.file.edits, result.hash)
    // The same file with edits that it does not have (a save that failed
    // before) is saved again: the error clears only with them in the file.
    else if (!sameEdits(local(id), state.base)) {
      state.needSave = true
      // The save at once takes the edits of a save with the delay.
      cancelTimer(state)
    }
  }

  const save = async (state: ScreenState) => {
    const id = state.screen.id
    // Nothing is saved before a load: the base is not known. After a failed
    // load the save loads again first (a short failure of the dev server),
    // and that load saves the edits when it succeeds.
    if (state.hash === null) {
      if (state.failed) state.needLoad = true
      return
    }
    const mine = local(id)
    // The file has these edits: nothing is unsaved, also after a failed save.
    if (sameEdits(mine, state.base)) {
      state.failed = false
      setError(id, null)
      return
    }
    const result = await client.saveRequest(requestOf(state.screen, mine), state.hash)
    if (stopped || states.get(id) !== state) return
    if (result.status === 'error') {
      state.failed = true
      setError(id, `Cannot save the changes of ${id}: ${result.error}`)
      return
    }
    state.failed = false
    setError(id, null)
    if (result.status === 'conflict') {
      reconcile(state, result.file.edits, result.hash)
      return
    }
    state.base = result.file.edits
    state.hash = result.hash
  }

  const run = (state: ScreenState) => {
    // A screen that left the list during a call is not loaded or saved again;
    // a held screen waits for the end of the hold.
    if (stopped || state.busy || states.get(state.screen.id) !== state || held(state.screen.id)) return
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
    // The client answers each error; a call that throws all the same is an
    // error of the file, and the work of the screen goes on.
    void next(state)
      .catch((error: unknown) => {
        // A screen that left the list or a sync that stopped has no error.
        if (stopped || states.get(state.screen.id) !== state) return
        state.failed = true
        setError(state.screen.id, `Cannot sync the changes of ${state.screen.id}: ${messageOf(error)}`)
      })
      .finally(() => {
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

  const start = (screen: ScreenRef) => {
    const state: ScreenState = {
      screen,
      hash: null,
      base: seeds.get(screen.id) ?? [],
      timer: null,
      busy: false,
      needLoad: true,
      needSave: false,
      failed: false,
    }
    seeds.delete(screen.id)
    states.set(screen.id, state)
    run(state)
  }

  const end = (id: string, state: ScreenState) => {
    if (state.timer !== null) clearTimeout(state.timer)
    states.delete(id)
    setError(id, null)
  }

  // Takes the current list: ends the screens that left it, starts the new
  // ones. While a screen action runs, it starts none (see `hold`).
  const applyList = () => {
    const ids = new Set(list.map((screen) => screen.id))
    for (const id of gone) if (!ids.has(id)) gone.delete(id)
    for (const [id, state] of states) {
      if (ids.has(id) || held(id)) continue
      end(id, state)
      // The saved edits of a removed screen go out of the store; its request
      // file stays on the disk. A screen with the same id later (a new option
      // after a `keep` deleted the old one, a file that comes back) loads
      // its file, and old edits do not go into it. Edits that are not saved
      // yet (in the save delay, or made during a save) stay: when the screen
      // comes back, the load merges them as new items and saves them. With no
      // edits left, the history still goes: an undo would bring old ones back.
      if (state.hash !== null && sameEdits(local(id), state.base)) store.replace(id, [])
    }
    for (const screen of list) {
      if (gone.has(screen.id)) continue
      const known = states.get(screen.id)
      if (known) known.screen = screen
      else if (holds.size === 0) start(screen)
    }
  }

  return {
    setScreens: (next) => {
      if (stopped) return
      list = next
      applyList()
    },
    replaceScreens: (drop, load, bases) => {
      if (stopped) return
      const listed = new Set(list.map((screen) => screen.id))
      for (const id of drop) {
        const state = states.get(id)
        if (state) end(id, state)
        if (listed.has(id)) gone.add(id)
        seeds.delete(id)
      }
      for (const id of load) {
        gone.delete(id)
        const state = states.get(id)
        const base = bases?.get(id)
        if (base !== undefined) {
          if (state) state.base = [...base]
          else seeds.set(id, [...base])
        }
        if (state) {
          state.needLoad = true
          run(state)
          continue
        }
        const screen = list.find((item) => item.id === id)
        if (screen) start(screen)
      }
    },
    hold: (ids) => {
      const set: ReadonlySet<string> = new Set(ids)
      holds.add(set)
      return () => {
        if (!holds.delete(set) || stopped) return
        applyList()
        for (const id of set) {
          const state = states.get(id)
          if (state) run(state)
        }
      }
    },
    saveState: (id) => {
      const state = states.get(id)
      // A screen of the list that is not started yet has a load to come: one
      // with edits, and each one while a hold keeps it from its start (a new
      // id of a screen action whose list came before its answer).
      if (!state) {
        const waits = (local(id).length > 0 || holds.size > 0) && !gone.has(id)
        return waits && list.some((screen) => screen.id === id) ? 'pending' : 'saved'
      }
      if (state.timer !== null || state.busy || state.needSave || state.needLoad) return 'pending'
      // Before the first load the base is the edits of a moved file (the
      // seed of a rename), or none.
      if (sameEdits(local(id), state.base)) return 'saved'
      return state.failed ? 'failed' : 'pending'
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
  store: Pick<IssuesStore, 'screens' | 'subscribe' | 'drop'>
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
// of screens. The issues of each screen that is not in a new list go out of
// the store, thus a screen with that id later (a new option after a `keep`, a
// restored screen) does not write the issues of the old one; so do the issues
// that the store has for a dropped id that a screen action loads again (a
// late collection of the frame of the old screen). The frame of the new
// screen collects its own.
export type IssuesSync = Sync & {
  // Holds the issues files of `ids` while a screen action moves them
  // (`RequestSync.hold`): they save nothing until the end of the hold.
  hold: (ids: readonly string[]) => () => void
}

export function createIssuesSync({ store, client, report }: IssuesSyncDeps): IssuesSync {
  const states = new Map<string, IssuesState>()
  let stopped = false
  let list: readonly ScreenRef[] = []
  // The ids that a screen action dropped, while the list still has them.
  const gone = new Set<string>()
  const holds = new Set<ReadonlySet<string>>()
  const held = (id: string) => [...holds].some((ids) => ids.has(id))

  const setError = (id: string, error: string | null) => report(`issues:${id}`, error)

  const add = (screen: ScreenRef) => {
    store.drop(screen.id)
    states.set(screen.id, { screen, saved: null, busy: false })
  }

  const run = (state: IssuesState) => {
    if (stopped || state.busy || held(state.screen.id)) return
    const id = state.screen.id
    const list = own(store.screens(), id)
    if (list === undefined || list === state.saved) return
    state.busy = true
    state.saved = list
    // A call that throws is an error of the save too: the screen is not busy
    // after it.
    const saved = client.saveIssues(issuesFileOf(state.screen, list)).catch(
      (error: unknown): IssuesSaved => ({ status: 'error', error: messageOf(error) }),
    )
    void saved.then((result) => {
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
    setScreens: (next) => {
      if (stopped) return
      list = next
      const ids = new Set(list.map((screen) => screen.id))
      for (const id of gone) if (!ids.has(id)) gone.delete(id)
      for (const id of states.keys()) {
        if (ids.has(id)) continue
        states.delete(id)
        setError(id, null)
      }
      for (const id of Object.keys(store.screens())) if (!ids.has(id)) store.drop(id)
      for (const screen of list) {
        if (gone.has(screen.id)) continue
        const known = states.get(screen.id)
        if (known) known.screen = screen
        else states.set(screen.id, { screen, saved: null, busy: false })
      }
      runAll()
    },
    replaceScreens: (drop, load) => {
      if (stopped) return
      const listed = new Set(list.map((screen) => screen.id))
      for (const id of drop) {
        states.delete(id)
        setError(id, null)
        if (listed.has(id)) gone.add(id)
      }
      for (const id of load) {
        gone.delete(id)
        const screen = list.find((item) => item.id === id)
        if (screen && !states.has(id)) add(screen)
      }
      runAll()
    },
    hold: (ids) => {
      const set: ReadonlySet<string> = new Set(ids)
      holds.add(set)
      return () => {
        if (holds.delete(set)) runAll()
      }
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

// The syncs of the editor while `useRequestSync` runs, for the screen
// actions: the state of a save, and the change of the ids after an action.
export type EditorSync = { requests: RequestSync; issues: IssuesSync }

let running: EditorSync | null = null

export function editorSync(): EditorSync | null {
  return running
}

// Keeps the edits of the editor and the request files of `list` the same, and
// writes the issues files of `list`, for the life of the component.
export function useRequestSync(list: readonly ScreenRef[]) {
  const sync = useRef<Sync[]>([])

  useEffect(() => {
    const requests = createSync({ store: edits, client: requestsClient, listen: listenToServer, report: fileErrors.report })
    const issuesSync = createIssuesSync({ store: issues, client: requestsClient, report: fileErrors.report })
    const started = [requests, issuesSync]
    sync.current = started
    running = { requests, issues: issuesSync }
    return () => {
      for (const one of started) one.stop()
      sync.current = []
      running = null
    }
  }, [])

  // After the effect above, thus a new sync gets the list too.
  useEffect(() => {
    for (const one of sync.current) one.setScreens(list)
  }, [list])
}
