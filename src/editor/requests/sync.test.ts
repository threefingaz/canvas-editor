import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  formatIssues,
  formatRequest,
  type Change,
  type Edit,
  type Issue,
  type IssuesFile,
  type RequestFile,
  type Target,
} from '../../requests/format.ts'
import type { ScreenAction } from '../../requests/api.ts'
import { createBubbleStore } from '../comments/bubble-store.ts'
import type { Item } from '../edits/model.ts'
import { createEditsStore, type Screens } from '../edits/store.ts'
import { createIssuesStore } from '../issues/store.ts'
import type { IssuesSaved, Loaded, RequestsClient, Saved } from './client.ts'
import { createErrorList } from './file-errors.ts'
import type { ActionResult } from '../screens/client.ts'
import { runAction } from '../screens/follow.ts'
import {
  changedScreens,
  createIssuesSync,
  createSync,
  issuesFileOf,
  mergeEdits,
  requestOf,
  sameEdits,
  saveDelay,
} from './sync.ts'

const welcome = { id: 'onboarding/welcome', file: 'screens/onboarding/welcome.tsx' }
const profile = { id: 'settings/profile', file: 'screens/settings/profile.tsx' }

const target: Target = {
  file: welcome.file,
  line: 12,
  column: 7,
  tag: 'Typography',
  origin: 'library',
  element: 'h1',
  copies: 1,
  label: 'Welcome',
}

const text = (after: string): Change => ({ kind: 'text', before: 'Welcome', after })

function edit(id: string, change: Change = { kind: 'remove' }, line = 12): Edit {
  return { id, target: { ...target, line }, width: 390, change }
}

const item = (value: Edit): Item => ({ edit: value })
const ids = (list: readonly { id: string }[]) => list.map((value) => value.id)

describe('changedScreens', () => {
  test('gives the screens whose list of edits changed', () => {
    const a = [item(edit('e1'))]
    const b = [item(edit('e2', undefined, 20))]
    const before: Screens = { one: a, two: b }
    expect(changedScreens(before, { one: a, two: [...b, item(edit('e3', undefined, 30))] })).toEqual(['two'])
    expect(changedScreens(before, { one: a })).toEqual(['two'])
    expect(changedScreens(before, { one: a, two: b, three: a })).toEqual(['three'])
    expect(changedScreens(before, before)).toEqual([])
  })

  test('a change of the stale mark alone is not a change of the edits', () => {
    const value = edit('e1')
    expect(changedScreens({ one: [{ edit: value }] }, { one: [{ edit: value, stale: true }] })).toEqual([])
  })
})

describe('requestOf', () => {
  test('builds the request file of a screen', () => {
    const value = edit('e1')
    expect(requestOf(welcome, [value])).toEqual({
      version: 1,
      screen: 'onboarding/welcome',
      file: 'screens/onboarding/welcome.tsx',
      edits: [value],
    })
  })

  test('the result is a valid request file', () => {
    expect(() => formatRequest(requestOf(welcome, [edit('e1'), edit('e2', text('Hi'))]))).not.toThrow()
  })
})

describe('sameEdits', () => {
  test('compares the content, not the sequence of the keys', () => {
    const value = edit('e1', text('Hi'))
    const reordered = { change: { after: 'Hi', before: 'Welcome', kind: 'text' }, width: 390, target, id: 'e1' } as Edit
    expect(sameEdits([value], [reordered])).toBe(true)
    expect(sameEdits([value], [edit('e1', text('Hello'))])).toBe(false)
    expect(sameEdits([value], [])).toBe(false)
  })
})

describe('mergeEdits', () => {
  const a = edit('a')
  const b = edit('b', text('Hi'), 20)
  const c = edit('c', undefined, 30)

  test('keeps the remote items with their replies', () => {
    const replied = { ...b, reply: { status: 'conflict' as const, text: 'The code has a different text.' } }
    expect(mergeEdits([a, b], [a, b], [a, replied])).toEqual([a, replied])
  })

  test('drops the items that the agent removed', () => {
    expect(mergeEdits([a, b], [a, b], [b])).toEqual([b])
  })

  test('adds the local items that are not in the base', () => {
    expect(mergeEdits([a, b], [a, b, c], [b])).toEqual([b, c])
  })

  test('drops the base items that the user discarded', () => {
    expect(mergeEdits([a, b], [b], [a, b])).toEqual([b])
  })

  test('a removed item and a new local edit at once: the removed item does not come back', () => {
    expect(mergeEdits([a, b], [a, b, c], [b])).toEqual([b, c])
  })

  test('the remote version of an item wins when both sides changed it', () => {
    const local = edit('b', text('Local'), 20)
    const remote = edit('b', text('Remote'), 20)
    expect(mergeEdits([a, b], [a, local], [a, remote])).toEqual([a, remote])
  })

  test('an item that the user discarded goes out, also when the agent gave it a reply', () => {
    const replied = { ...b, reply: { status: 'unclear' as const, text: 'Which text?' } }
    expect(mergeEdits([a, b], [a], [a, replied])).toEqual([a])
  })

  test('an item that the agent removed goes out, also when the user changed it', () => {
    expect(mergeEdits([a, b], [a, edit('b', text('Local'), 20)], [a])).toEqual([a])
  })

  test('the local version of an item stays when only the editor changed it', () => {
    const local = edit('b', text('Local'), 20)
    expect(mergeEdits([a, b], [a, local], [a, b])).toEqual([a, local])
  })

  test('keeps a remote item that is new in the file', () => {
    expect(mergeEdits([a], [a], [a, c])).toEqual([a, c])
  })

  test('with no base, the file and the local edits are joined with no duplicate', () => {
    expect(mergeEdits([], [a, c], [a, b])).toEqual([a, b, c])
  })
})

// A dev server in memory: the request files, with the same rules as the local
// file API. The hash of a text is the text.
function createServer() {
  const files = new Map<string, string>()
  const textOf = (id: string, edits: Edit[]) => formatRequest(requestOf({ id, file: `screens/${id}.tsx` }, edits))
  const empty = (id: string) => textOf(id, [])
  const current = (id: string) => files.get(id) ?? empty(id)
  const loaded = (text: string) => ({ file: JSON.parse(text) as RequestFile, hash: text })
  const calls: string[] = []
  let failing: string | null = null
  // While held, a call waits for `release`.
  let gate: Promise<void> | null = null
  let open = () => {}

  const client: RequestsClient = {
    loadRequest: async (id): Promise<Loaded> => {
      calls.push(`load ${id}`)
      if (gate) await gate
      if (failing !== null) return { status: 'error', error: failing }
      return { status: 'loaded', ...loaded(current(id)) }
    },
    saveRequest: async (file, base): Promise<Saved> => {
      calls.push(`save ${file.screen}`)
      if (gate) await gate
      if (failing !== null) return { status: 'error', error: failing }
      const text = current(file.screen)
      if (base !== text) return { status: 'conflict', ...loaded(text) }
      const next = formatRequest(file)
      if (file.edits.length === 0) files.delete(file.screen)
      else files.set(file.screen, next)
      return { status: 'saved', ...loaded(current(file.screen)) }
    },
    saveIssues: async () => ({ status: 'error', error: 'not used' }),
  }

  return {
    client,
    calls,
    // A change by hand or by an agent.
    write: (id: string, edits: Edit[]) => files.set(id, textOf(id, edits)),
    remove: (id: string) => files.delete(id),
    edits: (id: string) => ids((JSON.parse(current(id)) as RequestFile).edits),
    fail: (error: string | null) => {
      failing = error
    },
    hold: () => {
      gate = new Promise((resolve) => {
        open = resolve
      })
    },
    release: () => {
      gate = null
      open()
    },
  }
}

function setup() {
  const server = createServer()
  const store = createEditsStore()
  let outside: (id: string) => void = () => {}
  const errors: ReadonlyMap<string, string>[] = []
  const sync = createSync({
    store,
    client: server.client,
    listen: (handler) => {
      outside = handler
      return () => {
        outside = () => {}
      }
    },
    report: createErrorList((next) => errors.push(next)),
  })
  const local = (id: string) => store.get(id).map((value) => value.edit.id)
  return { server, store, sync, local, errors, outside: (id: string) => outside(id) }
}

describe('createSync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('loads the request of each screen at the start', async () => {
    const { server, store, sync, local } = setup()
    server.write(welcome.id, [edit('e1'), edit('e2', text('Hi'), 20)])
    sync.setScreens([welcome, profile])
    await vi.advanceTimersByTimeAsync(0)
    expect(local(welcome.id)).toEqual(['e1', 'e2'])
    expect(local(profile.id)).toEqual([])
    expect(store.canUndo()).toBe(false)
    // The loaded edits are the base: nothing is saved.
    await vi.advanceTimersByTimeAsync(saveDelay * 2)
    expect(server.calls.filter((call) => call.startsWith('save'))).toEqual([])
  })

  test('saves a short time after a change, once for a series of changes', async () => {
    const { server, store, sync } = setup()
    sync.setScreens([welcome, profile])
    await vi.advanceTimersByTimeAsync(0)
    store.apply(welcome.id, edit('e1'))
    await vi.advanceTimersByTimeAsync(saveDelay / 2)
    store.apply(welcome.id, edit('e2', text('Hi'), 20))
    await vi.advanceTimersByTimeAsync(saveDelay - 1)
    expect(server.edits(welcome.id)).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(server.edits(welcome.id)).toEqual(['e1', 'e2'])
    expect(server.calls.filter((call) => call.startsWith('save'))).toEqual(['save onboarding/welcome'])
  })

  test('an undo to the loaded edits saves the loaded edits', async () => {
    const { server, store, sync } = setup()
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    store.apply(welcome.id, edit('e1'))
    await vi.advanceTimersByTimeAsync(saveDelay)
    store.undo()
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(server.edits(welcome.id)).toEqual([])
  })

  test('a file that changed from outside replaces the edits', async () => {
    const { server, sync, local, store, outside } = setup()
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    store.apply(welcome.id, edit('e1'))
    store.apply(welcome.id, edit('e2', text('Hi'), 20))
    await vi.advanceTimersByTimeAsync(saveDelay)
    server.write(welcome.id, [edit('e2', text('Hello'), 20)])
    outside(welcome.id)
    await vi.advanceTimersByTimeAsync(0)
    expect(local(welcome.id)).toEqual(['e2'])
    expect(store.get(welcome.id)[0].edit.change).toEqual(text('Hello'))
    expect(store.canUndo()).toBe(false)
  })

  test('a deleted file takes the edits away', async () => {
    const { server, sync, local, store, outside } = setup()
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    store.apply(welcome.id, edit('e1'))
    await vi.advanceTimersByTimeAsync(saveDelay)
    server.remove(welcome.id)
    outside(welcome.id)
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(local(welcome.id)).toEqual([])
    expect(server.edits(welcome.id)).toEqual([])
  })

  test('the event of its own write changes nothing', async () => {
    const { server, sync, store, outside } = setup()
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    store.apply(welcome.id, edit('e1'))
    await vi.advanceTimersByTimeAsync(saveDelay)
    outside(welcome.id)
    await vi.advanceTimersByTimeAsync(0)
    // The history stays: the content did not come from outside.
    expect(store.canUndo()).toBe(true)
    expect(server.calls).toEqual(['load onboarding/welcome', 'save onboarding/welcome', 'load onboarding/welcome'])
  })

  test('a conflict merges with the file and saves again', async () => {
    const { server, sync, local, store } = setup()
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    store.apply(welcome.id, edit('a'))
    store.apply(welcome.id, edit('b', text('Hi'), 20))
    await vi.advanceTimersByTimeAsync(saveDelay)
    // The agent removes `a`; the editor makes a new edit before it gets the
    // event of the change.
    server.write(welcome.id, [edit('b', text('Hi'), 20)])
    store.apply(welcome.id, edit('c', undefined, 30))
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(local(welcome.id)).toEqual(['b', 'c'])
    expect(server.edits(welcome.id)).toEqual(['b', 'c'])
    expect(server.calls.slice(-2)).toEqual(['save onboarding/welcome', 'save onboarding/welcome'])
  })

  test('a failed save reports the error and keeps the edits', async () => {
    const { server, sync, local, store, errors } = setup()
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    server.fail('500 disk full')
    store.apply(welcome.id, edit('e1'))
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(local(welcome.id)).toEqual(['e1'])
    expect([...errors.at(-1)!.values()]).toEqual(['Cannot save the changes of onboarding/welcome: 500 disk full'])
    // The next change saves all again and clears the error.
    server.fail(null)
    store.apply(welcome.id, edit('e2', text('Hi'), 20))
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(server.edits(welcome.id)).toEqual(['e1', 'e2'])
    expect(errors.at(-1)!.size).toBe(0)
  })

  test('an undo to the saved edits after a failed save clears the error', async () => {
    const { server, sync, store, errors } = setup()
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    server.fail('500 disk full')
    store.apply(welcome.id, edit('e1'))
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(errors.at(-1)!.size).toBe(1)
    store.undo()
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(errors.at(-1)!.size).toBe(0)
  })

  test('a failed load reports the error and saves nothing', async () => {
    const { server, sync, store, errors } = setup()
    server.fail('the file is not JSON')
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    expect([...errors.at(-1)!.values()]).toEqual([
      'Cannot read the changes of onboarding/welcome: the file is not JSON',
    ])
    store.apply(welcome.id, edit('e1'))
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(server.calls).toEqual(['load onboarding/welcome'])
  })

  test('edits made before the load are kept and saved', async () => {
    const { server, sync, local, store } = setup()
    server.write(welcome.id, [edit('a')])
    sync.setScreens([welcome])
    store.apply(welcome.id, edit('c', undefined, 30))
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(local(welcome.id)).toEqual(['a', 'c'])
    expect(server.edits(welcome.id)).toEqual(['a', 'c'])
  })

  test('a new screen is loaded; a removed screen is no longer saved', async () => {
    const { server, sync, local, store } = setup()
    server.write(profile.id, [edit('p1')])
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    sync.setScreens([welcome, profile])
    await vi.advanceTimersByTimeAsync(0)
    expect(local(profile.id)).toEqual(['p1'])
    sync.setScreens([profile])
    store.apply(welcome.id, edit('e1'))
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(server.edits(welcome.id)).toEqual([])
  })

  test('one call at a time: changes during a save give one load and one save after it', async () => {
    const { server, sync, store, outside } = setup()
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    store.apply(welcome.id, edit('e1'))
    server.hold()
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(server.calls).toEqual(['load onboarding/welcome', 'save onboarding/welcome'])
    // During the save: two events and two more edits.
    outside(welcome.id)
    outside(welcome.id)
    store.apply(welcome.id, edit('e2', text('Hi'), 20))
    await vi.advanceTimersByTimeAsync(saveDelay)
    store.apply(welcome.id, edit('e3', undefined, 30))
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(server.calls).toHaveLength(2)
    server.release()
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(server.calls).toEqual([
      'load onboarding/welcome',
      'save onboarding/welcome',
      'load onboarding/welcome',
      'save onboarding/welcome',
    ])
    expect(server.edits(welcome.id)).toEqual(['e1', 'e2', 'e3'])
  })

  test('a screen removed during its call ignores the result and is not called again', async () => {
    const { server, sync, store, local } = setup()
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    store.apply(welcome.id, edit('e1'))
    server.hold()
    await vi.advanceTimersByTimeAsync(saveDelay)
    // A change during the save asks for one more save.
    store.apply(welcome.id, edit('e2', text('Hi'), 20))
    await vi.advanceTimersByTimeAsync(saveDelay)
    server.write(welcome.id, [edit('x')])
    sync.setScreens([])
    server.release()
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(server.calls).toEqual(['load onboarding/welcome', 'save onboarding/welcome'])
    // The file of the result does not come in; the edits that were not saved
    // stay in the store.
    expect(local(welcome.id)).toEqual(['e1', 'e2'])
  })

  test('the unsaved edits of a removed screen stay, and are saved when it comes back', async () => {
    const { server, sync, store, local } = setup()
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    store.apply(welcome.id, edit('e1'))
    await vi.advanceTimersByTimeAsync(saveDelay)
    // An edit in the save delay, then the screen leaves the list.
    store.apply(welcome.id, edit('e2', text('Hi'), 20))
    sync.setScreens([])
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(local(welcome.id)).toEqual(['e1', 'e2'])
    expect(server.edits(welcome.id)).toEqual(['e1'])
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(local(welcome.id)).toEqual(['e1', 'e2'])
    expect(server.edits(welcome.id)).toEqual(['e1', 'e2'])
  })

  test('a removed screen leaves the store; when it comes back, it has the edits of its file only', async () => {
    const { server, sync, store, local } = setup()
    sync.setScreens([welcome, profile])
    await vi.advanceTimersByTimeAsync(0)
    store.apply(profile.id, edit('old'))
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(server.edits(profile.id)).toEqual(['old'])
    // An agent deletes the screen file and its request file.
    server.write(profile.id, [])
    sync.setScreens([welcome])
    expect(local(profile.id)).toEqual([])
    // Undo and redo do not bring the old edits back.
    store.undo()
    expect(local(profile.id)).toEqual([])
    store.redo()
    expect(local(profile.id)).toEqual([])
    // A new screen gets the same id.
    sync.setScreens([welcome, profile])
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(local(profile.id)).toEqual([])
    expect(server.edits(profile.id)).toEqual([])
  })

  test('a screen file that comes back gets the edits of its request file again', async () => {
    const { server, sync, store, local } = setup()
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    store.apply(welcome.id, edit('e1'))
    await vi.advanceTimersByTimeAsync(saveDelay)
    sync.setScreens([])
    expect(local(welcome.id)).toEqual([])
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    expect(local(welcome.id)).toEqual(['e1'])
    expect(server.edits(welcome.id)).toEqual(['e1'])
  })

  test('after a failed load, the next event loads again, clears the error and saves the edits made meanwhile', async () => {
    const { server, sync, store, errors, outside } = setup()
    server.write(welcome.id, [edit('a')])
    server.fail('the file is not JSON')
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    store.apply(welcome.id, edit('e1', text('Hi'), 20))
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(errors.at(-1)!.size).toBe(1)
    server.fail(null)
    outside(welcome.id)
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(errors.at(-1)!.size).toBe(0)
    expect(server.edits(welcome.id)).toEqual(['a', 'e1'])
  })

  test('stop ends the saves and the events, and clears the errors', async () => {
    const { server, sync, store, outside, errors } = setup()
    server.fail('offline')
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    expect(errors.at(-1)!.size).toBe(1)
    server.fail(null)
    sync.stop()
    expect(errors.at(-1)!.size).toBe(0)
    store.apply(welcome.id, edit('e1'))
    await vi.advanceTimersByTimeAsync(saveDelay)
    outside(welcome.id)
    await vi.advanceTimersByTimeAsync(0)
    expect(server.calls).toEqual(['load onboarding/welcome'])
  })

  test('stop ends the saves and the events', async () => {
    const { server, sync, store, outside } = setup()
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    store.apply(welcome.id, edit('e1'))
    sync.stop()
    await vi.advanceTimersByTimeAsync(saveDelay)
    outside(welcome.id)
    await vi.advanceTimersByTimeAsync(0)
    expect(server.calls).toEqual(['load onboarding/welcome'])
  })

  test('saveState: pending in the save delay and during a call, saved after the save, failed after a failed save', async () => {
    const { server, store, sync } = setup()
    expect(sync.saveState(welcome.id)).toBe('saved')
    sync.setScreens([welcome])
    expect(sync.saveState(welcome.id)).toBe('pending')
    await vi.advanceTimersByTimeAsync(0)
    expect(sync.saveState(welcome.id)).toBe('saved')
    store.apply(welcome.id, edit('e1'))
    expect(sync.saveState(welcome.id)).toBe('pending')
    server.hold()
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(sync.saveState(welcome.id)).toBe('pending')
    server.release()
    await vi.advanceTimersByTimeAsync(0)
    expect(sync.saveState(welcome.id)).toBe('saved')
    server.fail('offline')
    store.apply(welcome.id, edit('e2', text('Hi'), 20))
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(sync.saveState(welcome.id)).toBe('failed')
    server.fail(null)
    store.undo()
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(sync.saveState(welcome.id)).toBe('saved')
  })

  test('saveState: a failed load with no edits is saved; with edits it is failed', async () => {
    const { server, store, sync } = setup()
    server.fail('offline')
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    expect(sync.saveState(welcome.id)).toBe('saved')
    store.apply(welcome.id, edit('e1'))
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(sync.saveState(welcome.id)).toBe('failed')
  })

  test('replaceScreens: a dropped id stops at once and is not loaded again while the list still has it', async () => {
    const { server, store, sync, errors } = setup()
    server.write(welcome.id, [edit('e1')])
    sync.setScreens([welcome, profile])
    await vi.advanceTimersByTimeAsync(0)
    server.fail('offline')
    store.apply(profile.id, edit('p1'))
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(errors.at(-1)!.has(`requests:${profile.id}`)).toBe(true)
    server.fail(null)
    server.calls.length = 0

    // The action renamed `profile` to `account`; the list comes later.
    server.remove(profile.id)
    const account = { id: 'settings/account', file: 'screens/settings/account.tsx' }
    server.write(account.id, [edit('p1')])
    sync.replaceScreens([profile.id], [account.id])
    expect(errors.at(-1)!.has(`requests:${profile.id}`)).toBe(false)
    store.replace(profile.id, [])
    await vi.advanceTimersByTimeAsync(saveDelay)
    // The old id is not saved, and the new id is not in the list yet.
    expect(server.calls).toEqual([])
    expect(sync.saveState(profile.id)).toBe('saved')

    sync.setScreens([welcome, profile])
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(server.calls).toEqual([])
    sync.setScreens([welcome, account])
    await vi.advanceTimersByTimeAsync(0)
    expect(server.calls).toEqual([`load ${account.id}`])
    expect(store.get(account.id).map((value) => value.edit.id)).toEqual(['p1'])
  })

  test('replaceScreens with bases: a change and a discard made while a rename ran win over the moved file', async () => {
    const { server, store, sync } = setup()
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(0)
    const account = { id: 'settings/account', file: 'screens/settings/account.tsx' }
    // The moved file has a and b; meanwhile the user changed a and discarded b.
    server.write(account.id, [edit('a', text('Hi')), edit('b', undefined, 30)])
    sync.replaceScreens([], [account.id], new Map([[account.id, [edit('a', text('Hi')), edit('b', undefined, 30)]]]))
    store.replace(account.id, [edit('a', text('Hello'))])
    sync.setScreens([welcome, account])
    await vi.advanceTimersByTimeAsync(0)
    expect(store.get(account.id).map((value) => value.edit)).toEqual([edit('a', text('Hello'))])
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(server.edits(account.id)).toEqual(['a'])
    expect(sync.saveState(account.id)).toBe('saved')
  })

  test('replaceScreens: a new id of the list loads its file again; an id that comes back is loaded', async () => {
    const { server, store, sync } = setup()
    sync.setScreens([welcome, profile])
    await vi.advanceTimersByTimeAsync(0)
    server.calls.length = 0
    // The list came before the answer: the new id is loaded already.
    server.write(welcome.id, [edit('e1')])
    sync.replaceScreens([], [welcome.id])
    await vi.advanceTimersByTimeAsync(0)
    expect(server.calls).toEqual([`load ${welcome.id}`])
    expect(store.get(welcome.id).map((value) => value.edit.id)).toEqual(['e1'])

    // A delete and a restore before the list changes.
    server.calls.length = 0
    sync.replaceScreens([profile.id], [])
    sync.replaceScreens([], [profile.id])
    await vi.advanceTimersByTimeAsync(0)
    expect(server.calls).toEqual([`load ${profile.id}`])
  })
})

// A rename of `welcome` to `start` with the sync of the editor, in each order
// of the answer of the action and the new list of the dev server, with a user
// change while the action runs.
describe('createSync with a rename', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const start = { id: 'onboarding/start', file: 'screens/onboarding/start.tsx' }
  const note = (id: string, words = 'Add a state'): Edit => ({ id, target: null, width: 1440, change: { kind: 'comment', text: words } })
  const rename: ScreenAction = { action: 'rename', screen: welcome.id, flow: 'onboarding', name: 'start' }
  const applied: ActionResult = {
    status: 'applied',
    plan: { action: 'rename', screen: welcome.id, screens: [{ from: welcome.id, to: start.id }], linkedBy: [], moves: [], writes: [], removes: [] },
  }

  type Order = 'answer first' | 'list first' | 'list first, load of the new id not done'
  type Change = 'nothing' | 'a new item' | 'a new text' | 'a discard'
  const orders: Order[] = ['answer first', 'list first', 'list first, load of the new id not done']
  const changes: [Change, (store: ReturnType<typeof createEditsStore>) => void, Edit[]][] = [
    ['nothing', () => {}, [note('e1'), note('e2')]],
    ['a new item', (store) => store.apply(welcome.id, note('e3', 'New')), [note('e1'), note('e2'), note('e3', 'New')]],
    ['a new text', (store) => store.changeComment(welcome.id, 'e1', 'Changed'), [note('e1', 'Changed'), note('e2')]],
    ['a discard', (store) => store.discard(welcome.id, 'e2'), [note('e1')]],
  ]
  const cases = orders.flatMap((order) => changes.map(([name, change, expected]) => [order, name, change, expected] as const))

  test.each(cases)('%s, with %s while it runs: the edits come to the new id and its file', async (order, _name, change, expected) => {
    const { server, store, sync, outside } = setup()
    server.write(welcome.id, [note('e1'), note('e2')])
    sync.setScreens([welcome, profile])
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(store.get(welcome.id)).toHaveLength(2)
    expect(sync.saveState(welcome.id)).toBe('saved')

    let answer: (result: ActionResult) => void = () => {}
    const run = vi.fn(
      () =>
        new Promise<ActionResult>((resolve) => {
          answer = resolve
        }),
    )
    const issuesSync = { setScreens: () => {}, stop: () => {}, replaceScreens: () => {} }
    const done = runAction(rename, {
      sync: { requests: sync, issues: issuesSync },
      edits: store,
      issues: createIssuesStore(),
      drafts: createBubbleStore(),
      report: () => {},
      client: { run },
      list: [
        { id: welcome.id, flow: 'onboarding' },
        { id: profile.id, flow: 'settings' },
      ],
    })

    // The server moves the request file and tells about both files.
    server.write(start.id, [note('e1'), note('e2')])
    server.remove(welcome.id)
    outside(welcome.id)
    outside(start.id)
    await vi.advanceTimersByTimeAsync(0)
    if (order !== 'answer first') {
      sync.setScreens([start, profile])
      await vi.advanceTimersByTimeAsync(0)
    }
    change(store)
    await vi.advanceTimersByTimeAsync(saveDelay * 2)
    // Nothing is written while the action runs.
    expect(server.edits(welcome.id)).toEqual([])
    expect(server.edits(start.id)).toEqual(['e1', 'e2'])

    if (order === 'list first, load of the new id not done') server.hold()
    answer(applied)
    expect(await done).toBe(applied)
    if (order === 'answer first') sync.setScreens([start, profile])
    await vi.advanceTimersByTimeAsync(saveDelay)
    server.release()
    await vi.advanceTimersByTimeAsync(saveDelay * 2)

    expect(store.get(welcome.id)).toEqual([])
    expect(store.get(start.id).map((value) => value.edit)).toEqual(expected)
    expect(server.edits(start.id)).toEqual(ids(expected))
    const file = JSON.parse(await server.client.loadRequest(start.id).then((loaded) => (loaded.status === 'loaded' ? loaded.hash : '')))
    expect((file as RequestFile).edits).toEqual(expected)
    expect(server.edits(welcome.id)).toEqual([])
    expect(sync.saveState(start.id)).toBe('saved')
  })

  test('a refused action ends the hold: the changes made meanwhile are saved at the old id', async () => {
    const { server, store, sync } = setup()
    server.write(welcome.id, [note('e1')])
    sync.setScreens([welcome])
    await vi.advanceTimersByTimeAsync(saveDelay)
    let answer: (result: ActionResult) => void = () => {}
    const run = () =>
      new Promise<ActionResult>((resolve) => {
        answer = resolve
      })
    const issuesSync = { setScreens: () => {}, stop: () => {}, replaceScreens: () => {} }
    const done = runAction(rename, {
      sync: { requests: sync, issues: issuesSync },
      edits: store,
      issues: createIssuesStore(),
      drafts: createBubbleStore(),
      report: () => {},
      client: { run },
      list: [{ id: welcome.id, flow: 'onboarding' }],
    })
    store.apply(welcome.id, note('e2'))
    sync.setScreens([welcome, profile])
    await vi.advanceTimersByTimeAsync(saveDelay * 2)
    expect(server.edits(welcome.id)).toEqual(['e1'])
    // A new screen of the list waits for the end of the hold.
    expect(server.calls).not.toContain(`load ${profile.id}`)
    answer({ status: 'refused', refusals: ['no'] })
    expect(await done).toEqual({ status: 'refused', refusals: ['no'] })
    await vi.advanceTimersByTimeAsync(saveDelay)
    expect(server.edits(welcome.id)).toEqual(['e1', 'e2'])
    expect(server.calls).toContain(`load ${profile.id}`)
  })
})

describe('issuesFileOf', () => {
  test('builds a valid issues file of a screen', () => {
    const list: Issue[] = [{ kind: 'not-library', target: { ...target, tag: 'div', origin: 'host', element: 'div' } }]
    const file = issuesFileOf(welcome, list)
    expect(file).toEqual({ version: 1, screen: welcome.id, file: welcome.file, issues: list })
    expect(() => formatIssues(file)).not.toThrow()
  })
})

describe('createIssuesSync', () => {
  const gap: Issue = { kind: 'no-token', target, property: 'gap', value: '16px', state: 'none' }
  const error: Issue = { kind: 'render-error', text: 'Boom' }

  // A client whose saves wait until `finish`.
  function setupIssues() {
    const store = createIssuesStore()
    const saves: { file: IssuesFile; finish: (result: IssuesSaved) => void }[] = []
    const errors: ReadonlyMap<string, string>[] = []
    const sync = createIssuesSync({
      store,
      client: {
        saveIssues: (file) => new Promise((finish) => saves.push({ file, finish })),
      },
      report: createErrorList((next) => errors.push(next)),
    })
    const saved = () => saves.map(({ file }) => `${file.screen} ${file.issues.map((issue) => issue.kind).join(',')}`)
    // Finishes the open saves and lets their callbacks run.
    const finishAll = async (result: IssuesSaved = { status: 'saved' }) => {
      for (const save of saves.splice(0)) save.finish(result)
      await Promise.resolve()
      await Promise.resolve()
    }
    return { store, sync, saves, saved, finishAll, errors }
  }

  test('saves the list of each screen of the list, and again when it changes', async () => {
    const { store, sync, saved, finishAll, saves } = setupIssues()
    sync.setScreens([welcome, profile])
    expect(saved()).toEqual([])
    store.set(welcome.id, [gap])
    store.set(profile.id, [])
    expect(saved()).toEqual(['onboarding/welcome no-token', 'settings/profile '])
    expect(saves[0].file).toEqual(issuesFileOf(welcome, [gap]))
    await finishAll()
    store.set(welcome.id, [error, gap])
    expect(saved()).toEqual(['onboarding/welcome render-error,no-token'])
  })

  test('equal content saves nothing', async () => {
    const { store, sync, saved, finishAll } = setupIssues()
    sync.setScreens([welcome])
    store.set(welcome.id, [gap])
    await finishAll()
    store.set(welcome.id, [{ ...gap }])
    store.set(profile.id, [gap])
    expect(saved()).toEqual([])
  })

  test('a screen that is not in the list is not saved until it is added', async () => {
    const { store, sync, saved } = setupIssues()
    sync.setScreens([welcome])
    store.set(profile.id, [gap])
    expect(saved()).toEqual([])
    sync.setScreens([welcome, profile])
    expect(saved()).toEqual(['settings/profile no-token'])
  })

  test('one save at a time for a screen: a change during a save is saved after it, only the last list', async () => {
    const { store, sync, saved, finishAll } = setupIssues()
    sync.setScreens([welcome])
    store.set(welcome.id, [gap])
    store.set(welcome.id, [error])
    store.set(welcome.id, [error, gap])
    expect(saved()).toEqual(['onboarding/welcome no-token'])
    await finishAll()
    expect(saved()).toEqual(['onboarding/welcome render-error,no-token'])
    await finishAll()
    expect(saved()).toEqual([])
  })

  test('a failed save reports the error and is tried again at the next change; a success clears it', async () => {
    const { store, sync, saved, finishAll, errors } = setupIssues()
    sync.setScreens([welcome, profile])
    store.set(welcome.id, [gap])
    await finishAll({ status: 'error', error: '500 disk full' })
    expect(errors.at(-1)).toEqual(
      new Map([[`issues:${welcome.id}`, 'Cannot save the issues of onboarding/welcome: 500 disk full']]),
    )
    expect(saved()).toEqual([])
    // A change of a different screen tries the failed one again.
    store.set(profile.id, [])
    expect(saved()).toEqual(['onboarding/welcome no-token', 'settings/profile '])
    await finishAll()
    expect(errors.at(-1)).toEqual(new Map())
  })

  test('replaceScreens: a dropped id saves nothing more while the list still has it; a new id is saved', async () => {
    const { store, sync, saved, finishAll, errors } = setupIssues()
    const account = { id: 'settings/account', file: 'screens/settings/account.tsx' }
    sync.setScreens([welcome, profile])
    store.set(profile.id, [gap])
    store.set(welcome.id, [gap])
    await finishAll({ status: 'error', error: 'offline' })
    expect(errors.at(-1)!.has(`issues:${profile.id}`)).toBe(true)
    sync.replaceScreens([profile.id], [account.id])
    expect(errors.at(-1)!.has(`issues:${profile.id}`)).toBe(false)
    store.set(profile.id, [error])
    sync.setScreens([welcome, profile])
    expect(saved().filter((line) => line.startsWith(profile.id))).toEqual([])
    sync.setScreens([welcome, account])
    store.set(account.id, [error])
    expect(saved().at(-1)).toBe('settings/account render-error')
  })

  test('a removed screen and a stopped sync save nothing more', async () => {
    const { store, sync, saved, finishAll, errors } = setupIssues()
    sync.setScreens([welcome, profile])
    store.set(welcome.id, [gap])
    await finishAll({ status: 'error', error: 'offline' })
    sync.setScreens([profile])
    expect(errors.at(-1)).toEqual(new Map())
    store.set(welcome.id, [error])
    expect(saved()).toEqual([])
    sync.stop()
    store.set(profile.id, [gap])
    expect(saved()).toEqual([])
  })
})
